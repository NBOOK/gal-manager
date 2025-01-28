import { toRomaji, toKana, isKana } from "wanakana";
import GameEntry from "@/modules/GameEntry";
const collator = new Intl.Collator("ja");

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

async function vndbQueryName(
  gameName: string,
  romanized: string
): Promise<VNTitle[]> {
  const results: VNTitle[] = [];

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
          ["or", ["lang", "=", "en"], ["lang", "=", "ja"], ["lang", "=", "zh"]],
        ],
        fields:
          "titles.official, titles.main, titles.lang, titles.latin, titles.title, aliases",
        sort: "searchrank",
        results: 15,
      }),
    });

    const releaseRequest = fetch("https://api.vndb.org/kana/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: ["search", "=", gameName],
        fields: "title,alttitle",
        sort: "searchrank",
        results: 15,
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
          !["en", "ja", "zh-Hans", "zh-Hant"].includes(title.lang)
        )
          continue;
        if (title.main) weight *= 1.1;
        results.push({
          title: title.latin ? title.latin : title.title,
          origTitle: title.title,
          kind: "title",
          weight:
            weight *
            editRatio(romanized, title.latin ? title.latin : title.title),
        });
      }
      for (const alias of vn.aliases) {
        let weight = 0.9 - idx * 0.2;
        if (cjkRegex.test(alias)) continue; // 只保留拉丁化别名
        results.push({
          title: alias,
          origTitle: "",
          kind: "alias",
          weight: weight * editRatio(romanized, alias),
        });
      }
    }

    // 处理 Release 数据
    for (const [idx, release] of releaseData.results.entries()) {
      let weight = 1 - idx * 0.05;
      results.push({
        title: release.title,
        origTitle: release.alttitle,
        kind: "releaseTitle",
        weight: weight * editRatio(romanized, release.title),
      });
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  return results;
}

async function getGameNameEN(gameName: string): Promise<VNTitle[]> {
  const romanized = await romanize(gameName);
  const candidates = (await vndbQueryName(gameName, romanized)).sort(
    (a, b) => b.weight - a.weight
  );

  const uniqueCandidates: Record<string, VNTitle> = {};

  candidates
    .filter((item) => item.kind === "title")
    .forEach((item) => {
      if (!(slugify(item.title) in uniqueCandidates))
        uniqueCandidates[slugify(item.title)] = item;
    });

  candidates
    .filter((item) => item.kind === "releaseTitle")
    .forEach((item) => {
      if (!(slugify(item.title) in uniqueCandidates))
        uniqueCandidates[slugify(item.title)] = item;
    });

  candidates
    .filter((item) => item.kind === "alias")
    .forEach((item) => {
      if (!(slugify(item.title) in uniqueCandidates))
        uniqueCandidates[slugify(item.title)] = item;
    });

  const cleanedCandidates = Object.values(uniqueCandidates).sort(
    (a, b) => b.weight - a.weight
  );

  const romanizedTitle: VNTitle = {
    title: romanized,
    origTitle: "",
    kind: "romanized",
    weight: 1,
  };
  if (cleanedCandidates.length >= 6) {
    cleanedCandidates.splice(5, 0, romanizedTitle);
  } else {
    cleanedCandidates.push(romanizedTitle);
  }

  // Normalize weights to 0-100
  const maxWeight = Math.max(...cleanedCandidates.map((title) => title.weight));
  const minWeight = Math.min(...cleanedCandidates.map((title) => title.weight));

  for (const title of cleanedCandidates) {
    title.weight = ((title.weight - minWeight) / (maxWeight - minWeight)) * 100;
  }
  return cleanedCandidates;
}

async function guessLauncher(executables: string[]): Promise<string[]> {
  const exe2score: Record<string, number> = {};

  for (const executable of executables) {
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
    const pureRomaji = isKana(toKana(exe.toLowerCase().replace(/\.exe$/, "")));
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
    exe2score[executable] = score;
  }

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

function filterGamesByQuery(
  games: GameEntry[],
  searchQuery: string
): GameEntry[] {
  if (searchQuery) {
    searchQuery = searchQuery.toLowerCase();
    if (searchQuery.includes("@name=")) {
      const nameQuery = searchQuery
        .split("@name=")[1]
        .split("@brand=")[0]
        .trim();
      games = games.filter(
        (game) =>
          game.gameName.toLowerCase().includes(nameQuery) ||
          game.gameNameEN.toLowerCase().includes(nameQuery)
      );
    } else if (searchQuery.includes("@brand=")) {
      const brandQuery = searchQuery
        .split("@brand=")[1]
        .split("@name=")[0]
        .trim();
      games = games.filter(
        (game) =>
          game.gameBrand.toLowerCase().includes(brandQuery) ||
          game.gameBrandEN.toLowerCase().includes(brandQuery)
      );
    } else {
      games = games.filter(
        (game) =>
          game.gameName.toLowerCase().includes(searchQuery) ||
          game.gameNameEN.toLowerCase().includes(searchQuery) ||
          game.gameBrand.toLowerCase().includes(searchQuery) ||
          game.gameBrandEN.toLowerCase().includes(searchQuery)
      );
    }
  }
  return games;
}

function filterGamesByFilter(
  games: GameEntry[],
  filterConfig: Record<string, { toggled: boolean; value: any }>,
  filterOperator: Record<string, boolean>
): GameEntry[] {
  let operator = filterOperator.group1
    ? (list: boolean[]) => list.every(Boolean)
    : (list: boolean[]) => list.some(Boolean);
  let toggledKeys = Object.entries(filterConfig)
    .filter(
      ([key, value]) =>
        ["linked", "inDatabase", "inAssets", "starred", "selected"].includes(
          key
        ) && value.toggled
    )
    .map(([key]) => key as keyof GameEntry);
  if (toggledKeys.length) {
    games = games.filter((game) =>
      operator(toggledKeys.map((key) => game[key] === filterConfig[key].value))
    );
  }

  operator = filterOperator.group2
    ? (list: boolean[]) => list.every(Boolean)
    : (list: boolean[]) => list.some(Boolean);
  toggledKeys = Object.entries(filterConfig)
    .filter(
      ([key, value]) =>
        ["inNetDisk", "inSDCard", "inDeck", "inUSB"].includes(key) &&
        value.toggled
    )
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
  filterOperator: Record<string, boolean>,
  sortBy: keyof GameEntry,
  ascending: boolean
): GameEntry[] {
  games = filterGamesByQuery(games, searchQuery);
  games = filterGamesByFilter(games, filterConfig, filterOperator);
  games = sortGames(games, sortBy, ascending);
  return games;
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
};
