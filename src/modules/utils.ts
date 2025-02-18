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

function createTermMatcher(term: string): (game: GameEntry) => boolean {
  let fields: (keyof GameEntry)[];
  let searchTerm = term.toLowerCase();

  if (term.startsWith("@n=")) {
    fields = ["gameName", "gameNameEN"];
    searchTerm = term.slice(3).toLowerCase();
  } else if (term.startsWith("@b=")) {
    fields = ["gameBrand", "gameBrandEN"];
    searchTerm = term.slice(3).toLowerCase();
  } else {
    fields = ["gameName", "gameNameEN", "gameBrand", "gameBrandEN"];
  }

  return (game: GameEntry) =>
    fields.some((field) =>
      (game[field] as string).toLowerCase().includes(searchTerm)
    );
}

// -------------------------------------------------------------------------------

function cleanAndCapitalize(input: string): string {
  const cleaned = input
    .replace(
      /\s?([!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~“”‘’～∼＊、，。：？！ー‐－（）『』「」【】…．．．※＃・＋])\s?/g,
      "$1"
    )
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const capitalized = cleaned
    .split(" ")
    .map((word) => {
      if (word === word.toUpperCase()) {
        return word;
      } else if (word.length <= 2) {
        return word;
      } else {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    })
    .join(" ");
  return capitalized;
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
    .replace(/-+/g, "-");
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
    "bundle",
    "bundled",
    "collection",
    "patch",
    "aniversary",
    "ultimate",
    "dmm",
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

  // const suffixRegex = new RegExp(
  //   `(?:\\s+-)?(?:\\s*${keywordPattern})+(?:\\s*-?\\s*)$`,
  //   "i"
  // );

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
          "titles{official, main, lang, latin, title}, developers{name, original}, aliases",
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
        fields: "title, alttitle, producers{name, original}",
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
          "設定", "チェック", "ツール"
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

// function filterGamesByQuery(
//   games: GameEntry[],
//   searchQuery: string
// ): GameEntry[] {
//   if (searchQuery) {
//     searchQuery = searchQuery.toLowerCase();
//     if (searchQuery.includes("@n=")) {
//       const nameQuery = searchQuery.split("@n=")[1].split("@b=")[0].trim();
//       games = games.filter(
//         (game) =>
//           game.gameName.toLowerCase().includes(nameQuery) ||
//           game.gameNameEN.toLowerCase().includes(nameQuery)
//       );
//     } else if (searchQuery.includes("@b=")) {
//       const brandQuery = searchQuery.split("@b=")[1].split("@n=")[0].trim();
//       games = games.filter(
//         (game) =>
//           game.gameBrand.toLowerCase().includes(brandQuery) ||
//           game.gameBrandEN.toLowerCase().includes(brandQuery)
//       );
//     } else {
//       games = games.filter(
//         (game) =>
//           game.gameName.toLowerCase().includes(searchQuery) ||
//           game.gameNameEN.toLowerCase().includes(searchQuery) ||
//           game.gameBrand.toLowerCase().includes(searchQuery) ||
//           game.gameBrandEN.toLowerCase().includes(searchQuery)
//       );
//     }
//   }
//   return games;
// }

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
