import { toRomaji, toKana, isKana } from "wanakana";
import GameEntry from "@/modules/GameEntry";
const collator = new Intl.Collator("ja");

type Token =
  | { type: "term"; value: string }
  | { type: "operator"; value: string };
type ASTNode =
  | { type: "term"; value: string }
  | { type: "not"; expr: ASTNode }
  | { type: "and"; left: ASTNode; right: ASTNode }
  | { type: "or"; left: ASTNode; right: ASTNode };

function filterGamesByQuery(
  games: GameEntry[],
  searchQuery: string
): GameEntry[] {
  if (!searchQuery) return games;
  if (!searchQuery.trim()) return games;
  searchQuery = searchQuery
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*/g, "|")
    .replace(/!\s*/g, "!")
    .replace(/<\s*/g, "<")
    .replace(/\s*>/g, ">");
  while ([" ", "|"].includes(searchQuery[0]))
    searchQuery = searchQuery.slice(1);
  while ([" ", "|", "!"].includes(searchQuery[searchQuery.length - 1]))
    searchQuery = searchQuery.slice(0, -1);

  const tokens = tokenize(searchQuery);
  const parser = new Parser(tokens);
  let ast: ASTNode;
  try {
    ast = parser.parse();
  } catch (e) {
    return [];
  }
  const evaluator = compileAST(ast);
  return games.filter((game) => evaluator(game));
}

function tokenize(searchQuery: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = searchQuery.length;

  while (i < len) {
    const c = searchQuery[i];
    if (["<", ">", "!", "|"].includes(c)) {
      tokens.push({ type: "operator", value: c });
      i++;
    } else if (c === " ") {
      tokens.push({ type: "operator", value: " " });
      while (i < len && searchQuery[i] === " ") i++;
    } else {
      let term = "";
      while (i < len && !["<", ">", "!", "|", " "].includes(searchQuery[i])) {
        term += searchQuery[i++];
      }
      if (term) tokens.push({ type: "term", value: term });
    }
  }
  return tokens;
}

class Parser {
  private current = 0;
  constructor(private tokens: Token[]) {}

  parse(): ASTNode {
    return this.parseAndExpression();
  }

  private parseOrExpression(): ASTNode {
    let left = this.parseNotExpression();
    while (this.match("operator", "|")) {
      this.consume();
      left = { type: "or", left, right: this.parseNotExpression() };
    }
    return left;
  }

  private parseAndExpression(): ASTNode {
    let left = this.parseOrExpression();
    while (this.match("operator", " ")) {
      this.consume();
      left = { type: "and", left, right: this.parseOrExpression() };
    }
    return left;
  }

  private parseNotExpression(): ASTNode {
    if (this.match("operator", "!")) {
      this.consume();
      return { type: "not", expr: this.parseNotExpression() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    if (this.match("operator", "<")) {
      this.consume();
      const expr = this.parseAndExpression();
      if (!this.match("operator", ">")) throw new Error();
      this.consume();
      return expr;
    }
    const token = this.consume();
    if (token.type === "term") return { type: "term", value: token.value };
    throw new Error();
  }

  private consume(): Token {
    if (this.current >= this.tokens.length) throw new Error();
    return this.tokens[this.current++];
  }

  private match(type: "operator" | "term", value?: string): boolean {
    const token = this.tokens[this.current];
    return (
      token?.type === type && (value === undefined || token.value === value)
    );
  }
}

function compileAST(node: ASTNode): (game: GameEntry) => boolean {
  switch (node.type) {
    case "term":
      const matcher = createTermMatcher(node.value);
      return (game) => matcher(game);
    case "not":
      const exprFn = compileAST(node.expr);
      return (game) => !exprFn(game);
    case "and":
      const leftAnd = compileAST(node.left);
      const rightAnd = compileAST(node.right);
      return (game) => leftAnd(game) && rightAnd(game);
    case "or":
      const leftOr = compileAST(node.left);
      const rightOr = compileAST(node.right);
      return (game) => leftOr(game) || rightOr(game);
  }
}

function createTermMatcher(termRaw: string): (g: GameEntry) => boolean {
  // ===================== name / brand =====================
  const lower = termRaw.toLowerCase();
  if (lower.startsWith("@n:") || lower.startsWith("@name:")) {
    const q = termRaw.slice(termRaw.indexOf(":") + 1).trim();
    if (!q) throw new Error("empty @n term");
    return (g) =>
      ["gameName", "gameNameEN"].some((k) =>
        (g[k as keyof GameEntry] as unknown as string)
          .toLowerCase()
          .includes(q.toLowerCase())
      );
  }
  if (lower.startsWith("@b:") || lower.startsWith("@brand:")) {
    const q = termRaw.slice(termRaw.indexOf(":") + 1).trim();
    if (!q) throw new Error("empty @b term");
    return (g) =>
      ["gameBrand", "gameBrandEN"].some((k) =>
        (g[k as keyof GameEntry] as unknown as string)
          .toLowerCase()
          .includes(q.toLowerCase())
      );
  }

  // ===================== release year =====================
  if (lower.startsWith("@y:") || lower.startsWith("@year:")) {
    const raw = termRaw.slice(termRaw.indexOf(":") + 1).trim();
    const range = parseYearRange(raw); // throws on failure
    return (g) => {
      const yr = toFullYear(g.gameReleaseYear);
      if (yr === null) return false;
      const [start, end] = range;
      return (start === null || yr >= start) && (end === null || yr <= end);
    };
  }

  // ===================== disk size ========================
  if (lower.startsWith("@s:") || lower.startsWith("@size:")) {
    const raw = termRaw.slice(termRaw.indexOf(":") + 1).trim();
    const range = parseSizeRange(raw); // throws on failure
    return (g) => {
      const [start, end] = range;
      return (
        (start === null || g.diskUsage >= start) &&
        (end === null || g.diskUsage <= end)
      );
    };
  }

  // ---------------- fallback – search all 4 text fields ----
  const qLower = termRaw.toLowerCase();
  return (g) =>
    ["gameName", "gameNameEN", "gameBrand", "gameBrandEN"].some((k) =>
      (g[k as keyof GameEntry] as unknown as string)
        .toLowerCase()
        .includes(qLower)
    );
}

/* ------------------------------------------------------------
 * Helper – Year parsing
 * ---------------------------------------------------------- */
function toFullYear(str: string): number | null {
  const m = str.match(/^\d{2,4}$/);
  if (!m) return null;
  let num = +str;
  if (str.length === 2) {
    num += str[0] === "7" || str[0] === "8" || str[0] === "9" ? 1900 : 2000;
  }
  return num;
}

function parseYearRange(raw: string): [number | null, number | null] {
  if (!raw) throw new Error("empty year term");
  const parts = raw.split("-");
  if (parts.length === 1) {
    const y = toFullYear(parts[0]);
    if (y === null) throw new Error("invalid year");
    return [y, y];
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    const start = a ? toFullYear(a) : null;
    const end = b ? toFullYear(b) : null;
    if (start === null && end === null) throw new Error("invalid year range");
    return [start, end];
  }
  throw new Error("invalid year range format");
}

/* ------------------------------------------------------------
 * Helper – Size parsing
 * ---------------------------------------------------------- */
const SIZE_FACTORS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

function strToBytes(str: string): number | null {
  const m = str.trim().match(/^(\d+(?:\.\d+)?)([tgmk]?b?)?$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  let unit = (m[2] || "b").toLowerCase();
  if (unit.length === 1 && unit !== "b") unit += "b"; // ensure unit is in kb, mb, gb, tb format
  const factor = SIZE_FACTORS[unit as keyof typeof SIZE_FACTORS];
  if (!factor) return null;
  return Math.round(value * factor);
}

function parseSizeRange(raw: string): [number | null, number | null] {
  if (!raw) throw new Error("empty size term");
  const parts = raw.split("-");
  if (parts.length === 1) {
    const s = strToBytes(parts[0]);
    if (s === null) throw new Error("invalid size");
    return [s, s];
  }
  if (parts.length === 2) {
    const start = parts[0] ? strToBytes(parts[0]) : null;
    const end = parts[1] ? strToBytes(parts[1]) : null;
    if (start === null && end === null) throw new Error("invalid size range");
    return [start, end];
  }
  throw new Error("invalid size range format");
}

// -------------------------------------------------------------------------------

function cleanAndCapitalize(input: string) {
  // 1. 提取清理标点的正则表达式到变量中
  const punctuationRegex =
    /\s?([!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~“”‘’～∼＊、，。：？！ー‐－（）『』「」【】…．．．※＃・＋])\s?/g;

  // 清理字符串：去除标点周围的空格，合并空格，去除变音符号
  const cleaned = input
    .replace(punctuationRegex, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 构造分隔符正则表达式（包含所有指定的标点和空格）
  const separatorChars =
    "\\s!\\\"#$%&'()*+,./:;<=>?@[\\]^_`{|}~“”‘’～∼＊、，。：？！ー‐－（）『』「」【】…．．．※＃・＋-";
  const splitRegex = new RegExp(`([${separatorChars}]+)`, "g");
  const isSeparator = (s: string) =>
    new RegExp(`^[${separatorChars}]+$`).test(s);

  // 分割成单词和分隔符的数组
  const tokens = cleaned.split(splitRegex);

  // 处理每个单词，保留分隔符
  const processedTokens = tokens.map((token) => {
    if (isSeparator(token)) {
      return token; // 分隔符保持不变
    } else {
      // 应用原来的单词处理逻辑
      if (token === token.toUpperCase()) {
        return token; // 全大写保留
      } else if (token.length <= 2) {
        return token; // 短单词保留
      } else if ((token.match(/[A-Z]/g) || []).length > 1) {
        return token; // 多个大写字母保留
      } else {
        // 首字母大写，其余小写
        return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
      }
    }
  });

  let result = processedTokens.join("");

  // 新增步骤：在返回结果前，对成对的括号、引号及横线/波浪线添加空格

  // 辅助函数：转义正则表达式特殊字符
  function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 处理成对的不同符号（如括号和中文引号）
  const distinctPairs = [
    { left: "(", right: ")" },
    { left: "（", right: "）" },
    { left: "【", right: "】" },
    { left: "『", right: "』" },
    { left: "「", right: "」" },
    { left: "‘", right: "’" },
    { left: "“", right: "”" },
  ];

  distinctPairs.forEach((pair) => {
    const leftCount = (
      result.match(new RegExp(escapeRegExp(pair.left), "g")) || []
    ).length;
    const rightCount = (
      result.match(new RegExp(escapeRegExp(pair.right), "g")) || []
    ).length;
    if (leftCount > 0 && leftCount === rightCount) {
      // 在左符号前面（且前面无空格）添加空格
      result = result.replace(
        new RegExp(`(?<!\\s)${escapeRegExp(pair.left)}`, "g"),
        " " + pair.left
      );
      // 在右符号后面（且后面无空格）添加空格
      result = result.replace(
        new RegExp(`${escapeRegExp(pair.right)}(?!\\s)`, "g"),
        pair.right + " "
      );
    }
  });

  // 处理成对的相同符号：横线、波浪线及英文引号
  const identicalSymbols = ['"', "'", "-", "－", "‐", "ー", "~", "～", "∼"];
  identicalSymbols.forEach((sym) => {
    const occurrences = (result.match(new RegExp(escapeRegExp(sym), "g")) || [])
      .length;
    if (occurrences > 0) {
      let count = 0;
      result = result.replace(new RegExp(escapeRegExp(sym), "g"), () => {
        count++;
        // 如果是奇数个中的最后一个（落单），两侧都添加空格
        if (occurrences % 2 === 1 && count === occurrences) {
          return " " + sym + " ";
        } else if (count % 2 === 1) {
          // 成对中左侧符号：左侧加空格
          return " " + sym;
        } else {
          // 成对中右侧符号：右侧加空格
          return sym + " ";
        }
      });
    }
  });

  // merge multiple spaces into one
  result = result.replace(/\s+/g, " ");

  return result.trim();
}

async function romanize(text: string): Promise<string> {
  const kanaed = await window.ipcRenderer.invoke("kuroshiroOp", "convert", {
    text: text,
    to: "hiragana",
    mode: "spaced",
  });
  const romanized = toRomaji(kanaed);
  const cleaned = cleanAndCapitalize(romanized);
  return cleaned;
}

function slugify(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((e) => (/[a-zA-Z0-9]/.test(e) ? e : "-"))
    .join("")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ");
}

function editRatio(s: string, t: string, trim: boolean = true): number {
  function editDistance(s: string, t: string): number {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
      arr[i] = [i];
      for (let j = 1; j <= s.length; j++) {
        arr[i][j] =
          i === 0
            ? j
            : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
              );
      }
    }
    return arr[t.length][s.length];
  }

  s = s.toLocaleLowerCase();
  t = t.toLocaleLowerCase();
  if (trim) {
    s = s.replace(/\s+/g, "");
    t = t.replace(/\s+/g, "");
  }

  const lenS = s.length;
  const lenT = t.length;

  if (lenS === 0 && lenT === 0) return 1; // 如果两个字符串都为空，返回相似度 1

  const distance = editDistance(s, t);
  return 1 - distance / Math.max(lenS, lenT);
}

function releaseTitleCleaner(title: string, origTitle: string) {
  const dash = ["-", "‐", "～", "~", "―", "－"];
  const prefix = ["\\(", "（", "\\[", "【", "「", "『"];
  const suffix = ["\\)", "）", "\\]", "】", "」", "』"];

  const keywords = [
    ...dash,
    ...prefix,
    ...suffix,
    "first",
    "press",
    "limited",
    "regular",
    "deluxe",
    "perfect",
    "trial",
    "premium",
    "web",
    "download",
    "dl",
    "package",
    "pkg",
    "popular",
    "standard",
    "complete",
    "new",
    "disk",
    "dvd",
    "cd",
    "rom",
    "pc",
    "pack",
    "edition",
    "ver[.\\d]*",
    "version[.\\d]*",
    "box",
    "basic",
    "special",
    "low price",
    "set",
    "for",
    "original",
    "work",
    "bundled?",
    "collection",
    "patch",
    "aniversary",
    "(?:un)?censored",
    "free",
    "ultimate",
    "dmm",
    "demo",
    "18+",
    "adult",
    "r18",
    "dlsite",
    "steam",
    "support",
    "exclusive",
    "all age",
    "all ages",
    "初回",
    "限定",
    "通常",
    "豪華",
    "体験",
    "完全",
    "生産",
    "販売",
    "一般",
    "廉価",
    "無料",
    "特典",
    "本編",
    "同梱",
    "特装",
    "ロイヤル",
    "プレミアム",
    "スタンダード",
    "ダウンロード",
    "コンプリート",
    "パッケージ",
    "パック",
    "エディション",
    "アップデート",
    "コレクション",
    "ボックス",
    "バージョン",
    "スーパー",
    "セット",
    "パッチ",
    "\\d*th",
    "win\\d*",
    "dows\\d*",
    "\\d*周年",
    "記念",
    "対応",
    "新装",
    "再販",
    "独占",
    "全年齢",
    "版",
  ];

  const keywordPattern = `(?:${[...keywords, ...prefix, ...suffix].join("|")})`;
  const suffixPattern = `(?:${[...dash, ...suffix].join("|")})`;

  const suffixRegex = new RegExp(
    `(?:\\s+${suffixPattern})?(?!${suffixPattern})(?:\\s*${keywordPattern})+(?:\\s*-?\\s*)$`,
    "i"
  );

  title = title.replace(suffixRegex, "").trim();
  let lastChar = title.at(-1);
  if (
    lastChar &&
    dash.includes(lastChar) &&
    title.split(lastChar).length === 2
  ) {
    title = title.slice(0, -1).trim();
  }

  origTitle = origTitle.replace(suffixRegex, "").trim();
  lastChar = origTitle.at(-1);
  if (
    lastChar &&
    dash.includes(lastChar) &&
    origTitle.split(lastChar).length === 2
  ) {
    origTitle = origTitle.slice(0, -1).trim();
  }

  return [title, origTitle];
}

async function vndbQueryName(
  gameName: string,
  gameBrand: string,
  romanizedName: string
) {
  console.log("Querying VNDB for:", gameName, gameBrand);
  const gameResults: VNTitle[] = [];
  const brandResults: VNDeveloper[] = [];

  const cjkRegex =
    /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309F\u30A0-\u30FF]/;

  try {
    // 创建两个请求的 Promise
    const vnRequest = fetch("https://api.vndb.org/kana/vn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: [
          "and",
          ["search", "=", gameName],
          ["lang", "=", "ja"],
          // ["developer", "=", ["search", "=", gameBrand]],
          ...gameBrand
            .split("×")
            .map((brand) => ["developer", "=", ["search", "=", brand]]),
        ],
        fields:
          "titles{official, main, lang, latin, title}, developers{name, original}, aliases, released",
        sort: "searchrank",
        results: 20,
      }),
    });

    const releaseRequest = fetch("https://api.vndb.org/kana/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: [
          "and",
          ["search", "=", gameName],
          ["lang", "=", "ja"],
          ["platform", "=", "win"],
          // ["producer", "=", ["search", "=", gameBrand]],
          ...gameBrand
            .split("×")
            .map((brand) => ["producer", "=", ["search", "=", brand]]),
        ],
        fields: "title, alttitle, producers{name, original}, released",
        sort: "searchrank",
        results: 20,
      }),
    });

    // 并行等待两个请求完成
    const [vnResponse, releaseResponse] = await Promise.all([
      vnRequest,
      releaseRequest,
    ]);

    // 检查响应状态
    if (!vnResponse.ok) {
      console.error(`VN request failed: ${vnResponse.statusText}`);
    }
    if (!releaseResponse.ok) {
      console.error(`Release request failed: ${releaseResponse.statusText}`);
    }

    // 尽可能解析 JSON 数据，即使部分失败
    const vnData = vnResponse.ok ? await vnResponse.json() : { results: [] };
    const releaseData = releaseResponse.ok
      ? await releaseResponse.json()
      : { results: [] };

    console.log("VN data:", vnData);
    console.log("Release data:", releaseData);

    // 处理 VN 数据
    for (const [idx, vn] of vnData.results.entries()) {
      for (const title of vn.titles) {
        let weight = 1.1 - idx * 0.2;
        if (
          !title.official ||
          title.lang !== "ja"
          // !["en", "ja", "zh-Hans", "zh-Hant"].includes(title.lang)
        )
          continue;
        if (title.main) weight *= 1.1;
        gameResults.push({
          id: vn.id,
          title: title.latin ? title.latin : title.title,
          origTitle: title.title,
          kind: "title",
          weight:
            weight *
            editRatio(romanizedName, title.latin ? title.latin : title.title),
          year: vn.released.split("-")[0],
        });
      }
      for (const alias of vn.aliases) {
        let weight = 0.9 - idx * 0.2;
        if (cjkRegex.test(alias)) continue; // 只保留拉丁化别名
        gameResults.push({
          id: vn.id,
          title: alias,
          origTitle: "",
          kind: "alias",
          weight: weight * editRatio(romanizedName, alias),
          year: vn.released.split("-")[0],
        });
      }
      for (const developer of vn.developers) {
        if (brandResults.some((brand) => brand.name === developer.name))
          continue;
        brandResults.push({
          id: developer.id,
          name: developer.name,
          origName: developer.original ? developer.original : developer.name,
          kind: "developer",
        });
      }
    }

    // 处理 Release 数据
    for (const [idx, release] of releaseData.results.entries()) {
      let weight = 1 - idx * 0.05;
      const [title, origTitle] = releaseTitleCleaner(
        release.title,
        release.alttitle ? release.alttitle : release.title
      );
      gameResults.push({
        id: release.id,
        title: title,
        origTitle: origTitle,
        kind: "releaseTitle",
        weight: weight * editRatio(romanizedName, title),
        year: release.released.split("-")[0],
      });

      for (const producer of release.producers) {
        if (brandResults.some((brand) => brand.name === producer.name))
          continue;
        brandResults.push({
          id: producer.id,
          name: producer.name,
          origName: producer.original ? producer.original : producer.name,
          kind: "publisher",
        });
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  return { titles: gameResults, brands: brandResults };
}

async function getGameNameEN(gameName: string, gameBrnad: string) {
  const romanizedName = await romanize(gameName);
  const romanizedBrand = await romanize(gameBrnad);
  const results = await vndbQueryName(gameName, gameBrnad, romanizedName);
  console.log("boundle:", results);
  const titleCandidates = results.titles;
  const brandCandidates = results.brands;
  titleCandidates.sort((a, b) => b.weight - a.weight);

  const uniqueCandidates: Record<string, VNTitle> = {};

  titleCandidates
    .filter((item) => item.kind === "title")
    .forEach((item) => {
      if (!(slugify(item.title) in uniqueCandidates))
        uniqueCandidates[slugify(item.title)] = item;
    });

  titleCandidates
    .filter((item) => item.kind === "releaseTitle")
    .forEach((item) => {
      if (!(slugify(item.title) in uniqueCandidates))
        uniqueCandidates[slugify(item.title)] = item;
    });

  // alias are too noisy, skip them
  // titleCandidates
  //   .filter((item) => item.kind === "alias")
  //   .forEach((item) => {
  //     if (!(slugify(item.title) in uniqueCandidates))
  //       uniqueCandidates[slugify(item.title)] = item;
  //   });

  const cleanedCandidates = Object.values(uniqueCandidates).sort(
    (a, b) => b.weight - a.weight
  );

  if (
    !cleanedCandidates.some(
      (title) => slugify(title.title) === slugify(romanizedName)
    )
  ) {
    const romanizedTitle: VNTitle = {
      id: "",
      title: romanizedName,
      origTitle: gameName,
      kind: "romanized",
      weight: 1,
      year: "",
    };
    if (cleanedCandidates.length >= 6) {
      cleanedCandidates.splice(5, 0, romanizedTitle);
    } else {
      cleanedCandidates.push(romanizedTitle);
    }
  }

  // Normalize weights to 0-100
  const maxWeight = Math.max(...cleanedCandidates.map((title) => title.weight));
  const minWeight = Math.min(...cleanedCandidates.map((title) => title.weight));

  for (const title of cleanedCandidates) {
    title.weight = ((title.weight - minWeight) / (maxWeight - minWeight)) * 100;
  }

  if (
    !brandCandidates.some(
      (brand) => slugify(brand.name) === slugify(romanizedBrand)
    )
  ) {
    const romanizedDeveloper: VNDeveloper = {
      id: "",
      name: romanizedBrand,
      origName: gameBrnad,
      kind: "romanized",
    };
    brandCandidates.push(romanizedDeveloper);
  }

  return { titles: cleanedCandidates, brands: brandCandidates };
}

async function guessLauncher(executables: string[]): Promise<string[]> {
  const exe2score: Record<string, number> = {};

  const scores = await Promise.all(
    executables.map(async (executable) => {
      const exe = executable.toLowerCase();
      let score = 0;

      // prettier-ignore
      if (["advhd.exe", "bgi.exe", "cs2.exe", "exhibit.exe", 'siglusengine.exe']
          .includes(exe)
      ) {
        score += 10;
      }

      const hasJapanese = await window.ipcRenderer.invoke(
        "kuroshiroOp",
        "hasJapanese",
        {
          text: exe,
        }
      );
      const pureRomaji = isKana(
        toKana(exe.toLowerCase().replace(/\.exe$/, ""))
      );
      if (hasJapanese || pureRomaji) {
        score += 2;
      }

      if (
        ["vol", "game", "fd", "launch", "load", "start"].some((keyword) =>
          exe.includes(keyword)
        )
      ) {
        score += 1;
      }

      if (/\d/.test(exe)) {
        score += 1;
      }

      // prettier-ignore
      if ([
          "acmp.exe", "bhvc.exe", "autorun.exe", "authtool.exe", "bootmenu.exe",
          "bootstrap.exe",
          ].includes(exe)
      ) {
        score -= 10;
      }

      // prettier-ignore
      if ([
          "gui", "32", "64", "inst", "menu", "update", "setting", "setup",
          "tool", "cfg", "conf", "crash", "bug", "upload", "patch", "copy",
          "courier", "train", "check", "file", "chk", "unity", "save",
          "viewer", "protect", "support", "unins", 
          "設定", "環境", "情報", "セーブ", "チェック", "ツール"
          ].some((keyword) => exe.includes(keyword))
      ) {
        score -= 3;
      }
      return { executable, score };
    })
  );

  scores.forEach(({ executable, score }) => {
    exe2score[executable] = score;
  });

  const sortedExe = executables.sort((a, b) => exe2score[b] - exe2score[a]);

  return sortedExe;
}

function sortGames(
  games: GameEntry[],
  sortBy: keyof GameEntry = "gameName",
  ascending: boolean = true
): GameEntry[] {
  return games.sort((gameA, gameB) => {
    if (sortBy === "gameName" || sortBy === "gameBrand") {
      // 使用日语排序
      return ascending
        ? collator.compare(gameA[sortBy], gameB[sortBy])
        : collator.compare(gameB[sortBy], gameA[sortBy]);
    } else {
      // 其他字段使用默认排序逻辑
      if (gameA[sortBy] < gameB[sortBy]) return ascending ? -1 : 1;
      if (gameA[sortBy] > gameB[sortBy]) return ascending ? 1 : -1;
      return 0;
    }
  });
}

function filterGamesByFilter(
  games: GameEntry[],
  filterConfig: Record<string, { toggled: boolean; value: any }>,
  filterOperator: boolean
): GameEntry[] {
  let operator = filterOperator
    ? (list: boolean[]) => list.every(Boolean)
    : (list: boolean[]) => list.some(Boolean);
  let toggledKeys = Object.entries(filterConfig)
    .filter(([_key, value]) => value.toggled)
    .map(([key]) => key as keyof GameEntry);
  if (toggledKeys.length) {
    games = games.filter((game) =>
      operator(toggledKeys.map((key) => game[key] === filterConfig[key].value))
    );
  }

  return games;
}

function filterSortGames(
  games: GameEntry[],
  searchQuery: string,
  filterConfig: Record<string, { toggled: boolean; value: any }>,
  filterOperator: boolean,
  sortBy: keyof GameEntry,
  ascending: boolean
): GameEntry[] {
  games = filterGamesByQuery(games, searchQuery);
  games = filterGamesByFilter(games, filterConfig, filterOperator);
  games = sortGames(games, sortBy, ascending);
  return games;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Bytes`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024; // 转换为 KB
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatTime(
  time: number,
  unitStyle: "long" | "short" | "abbr" = "short"
): string {
  // 定义各个单位在不同显示风格下的文本
  const unitsMapping = {
    long: {
      days: { singular: "day", plural: "days" },
      hours: { singular: "hour", plural: "hours" },
      minutes: { singular: "minute", plural: "minutes" },
      seconds: { singular: "second", plural: "seconds" },
    },
    short: {
      days: { singular: "day", plural: "day" },
      hours: { singular: "hr", plural: "hr" },
      minutes: { singular: "min", plural: "min" },
      seconds: { singular: "sec", plural: "sec" },
    },
    abbr: {
      days: { singular: "d", plural: "d" },
      hours: { singular: "h", plural: "h" },
      minutes: { singular: "m", plural: "m" },
      seconds: { singular: "s", plural: "s" },
    },
  };

  // 辅助函数，根据数值和单位返回对应文本
  const getUnit = (
    value: number,
    unit: "days" | "hours" | "minutes" | "seconds"
  ): string => {
    const unitData = unitsMapping[unitStyle][unit];
    // 对于 long 格式，根据值是否为 1 决定使用单数或复数形式
    if (unitStyle === "long") {
      return value === 1 ? unitData.singular : unitData.plural;
    }
    // 对于 short 与 abbr，直接返回缩写（一般不区分单复数）
    return unitData.singular;
  };

  // 定义换算关系：一天 86400 秒、1 小时 3600 秒、1 分钟 60 秒
  const daySeconds = 86400;
  const hourSeconds = 3600;
  const minuteSeconds = 60;

  // 如果时长大于 3 天，直接返回 "3+" 加上日单位
  if (time > 3 * daySeconds) {
    return `3+ ${getUnit(5, "days")}`;
  }

  // 分解时间为 天、小时、分钟、秒
  const days = Math.floor(time / daySeconds);
  time %= daySeconds;
  const hours = Math.floor(time / hourSeconds);
  time %= hourSeconds;
  const minutes = Math.floor(time / minuteSeconds);
  const seconds = Math.floor(time % minuteSeconds);

  // 按单位重要性依次存入数组
  type UnitKey = "days" | "hours" | "minutes" | "seconds";
  const units: Array<{ value: number; key: UnitKey }> = [
    { value: days, key: "days" },
    { value: hours, key: "hours" },
    { value: minutes, key: "minutes" },
    { value: seconds, key: "seconds" },
  ];

  // 找出第一个非 0 的单位（如果全部为 0，则取最后一项）
  let primaryIndex = units.findIndex((u) => u.value > 0);
  if (primaryIndex === -1) {
    primaryIndex = units.length - 1;
  }

  // 在 primary 后查找下一个非 0 的单位
  let secondaryIndex = -1;
  for (let i = primaryIndex + 1; i < units.length; i++) {
    if (units[i].value > 0) {
      secondaryIndex = i;
      break;
    }
  }

  // 如果找到了第二个非 0 的单位，则返回两个单位，否则只返回第一个单位
  if (secondaryIndex !== -1) {
    return (
      `${units[primaryIndex].value} ${getUnit(
        units[primaryIndex].value,
        units[primaryIndex].key
      )} ` +
      `${units[secondaryIndex].value} ${getUnit(
        units[secondaryIndex].value,
        units[secondaryIndex].key
      )}`
    );
  } else {
    return `${units[primaryIndex].value} ${getUnit(
      units[primaryIndex].value,
      units[primaryIndex].key
    )}`;
  }
}

export default {
  romanize,
  slugify,
  getGameNameEN,
  guessLauncher,
  sortGames,
  filterGamesByQuery,
  filterSortGames,
  vndbQueryName,
  formatSize,
  formatTime,
};
