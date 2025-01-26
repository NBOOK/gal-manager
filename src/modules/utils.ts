function cleanAndCapitalize(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ");
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
  // const romanized = await kuroshiro.convert(text, {
  //   to: "romaji",
  //   mode: "spaced",
  // });
  const romanized = await window.ipcRenderer.invoke("kuroshiroOp", "convert", {
    text: text,
    to: "romaji",
    mode: "spaced",
  });
  const cleaned = cleanAndCapitalize(romanized);
  return cleaned;
}

function slugify(text: string): string {
  return text
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
        filters: ["search", "=", gameName],
        fields:
          "titles.official, titles.main, titles.lang, titles.latin, titles.title, aliases",
        results: 15,
      }),
    });

    const releaseRequest = fetch("https://api.vndb.org/kana/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: ["search", "=", gameName],
        fields: "title,alttitle",
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
    for (const vn of vnData.results) {
      for (const title of vn.titles) {
        if (!title.official) continue;
        results.push({
          title: title.latin ? title.latin : title.title,
          origTitle: title.title,
          kind: "title",
          ratio: editRatio(romanized, title.latin ? title.latin : title.title),
        });
      }
      for (const alias of vn.aliases) {
        if (cjkRegex.test(alias)) continue;
        results.push({
          title: alias,
          origTitle: "",
          kind: "alias",
          ratio: editRatio(romanized, alias),
        });
      }
    }

    // 处理 Release 数据
    for (const release of releaseData.results) {
      results.push({
        title: release.title,
        origTitle: release.alttitle,
        kind: "releaseTitle",
        ratio: editRatio(romanized, release.title),
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
    (a, b) => b.ratio - a.ratio
  );
  const romanizedTitle: VNTitle = {
    title: romanized,
    origTitle: "",
    kind: "romanized",
    ratio: 1,
  };
  if (candidates.length >= 6) {
    candidates.splice(5, 0, romanizedTitle);
  } else {
    candidates.push(romanizedTitle);
  }
  return candidates;
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
    const hiragana = await window.ipcRenderer.invoke("kuroshiroOp", "convert", {
      text: exe,
      to: "hiragana",
    });
    if (hasJapanese || !/[a-zA-Z]/.test(hiragana)) {
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

export default {
  romanize,
  slugify,
  getGameNameEN,
  guessLauncher,
};
