// import fs from "node:fs";
import fs from "original-fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import sharp from "sharp";
import * as ResEdit from "resedit";
import { readVdf, VdfMap, writeVdf, getShortcutHash } from "steam-binary-vdf";
import vdf from "vdf";
import YAML from "yaml";
import { Database as DatabaseType, Statement } from "better-sqlite3";
import { MAIN_DIST, isDev, isPackaged } from "../main";
import Kuroshiro from "@sglkc/kuroshiro";
import KuromojiAnalyzer from "@sglkc/kuroshiro-analyzer-kuromoji";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SqliteDB = require("better-sqlite3");
import { SteamCategories } from "./steam-categories";
import { nodeDust, getDustBinaryPath } from "node-dust";
import Store from "./electron-store";

const store = new Store("diskUsageCache");
let dustBinaryPath = getDustBinaryPath();
let steamCat: SteamCategories;
let sqliteDB: DatabaseType;
const kuroshiro = new Kuroshiro();

async function scanDir(dirPath: string): Promise<DirEntry[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    const serializedEntries = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);
        const isSymbolicLink = entry.isSymbolicLink();

        // 初始化返回对象
        const stats = await fs.promises.stat(path.join(dirPath, entry.name));
        const result: DirEntry = {
          basePath: dirPath,
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          isSymbolicLink: isSymbolicLink,
          symbolicTarget: "",
          // diskUsage: 0,
          size: stats.size,
          createdTime: stats.birthtimeMs,
          modifiedTime: stats.mtimeMs,
        };

        try {
          // 如果是符号链接，解析目标路径并确定类型
          if (isSymbolicLink) {
            try {
              result.symbolicTarget = await fs.promises.readlink(entryPath);
              const stats = await fs.promises.stat(entryPath);
              result.isDirectory = stats.isDirectory();
              result.isFile = stats.isFile();
              result.modifiedTime = stats.mtimeMs;
              result.createdTime = stats.birthtimeMs;
            } catch (err) {
              // 如果符号链接失效/指向的位置不存在，则删除这个符号链接并返回null
              await fs.promises.unlink(entryPath);
              result.basePath = "";
            }
          }

          // // 如果是目录（或符号链接指向目录），返回时间戳
          // if (result.isDirectory) {
          //   // 获取创建时间和修改时间
          //   const stats = await fs.promises.stat(entryPath);
          //   result.createdTime = stats.birthtimeMs;
          //   result.modifiedTime = stats.mtimeMs;
          // }
        } catch (err) {
          console.warn(`Error processing entry ${entry.name}:`, err);
        }

        return result;
      })
    );

    return serializedEntries.filter((entry) => entry.basePath !== "");
  } catch (err) {
    console.error("Error reading directory:", (err as Error).message);
    // throw err;
    return [];
  }
}

async function dustGetDirDiskUsage(dirPath: string): Promise<number> {
  let binaryPath = dustBinaryPath;
  if (!isDev && isPackaged) {
    binaryPath = dustBinaryPath.replace("app.asar", "app.asar.unpacked");
  }

  const jsonResult = await nodeDust(["-j", "-s", "-o", "b", dirPath], {
    binaryPath: binaryPath,
  });
  if (jsonResult.error) {
    console.error("Spawn dust error: ", jsonResult.error);
    return 0;
  }
  if (jsonResult.code !== 0) {
    console.error(
      `dust command failed with code ${jsonResult.code}:\n`,
      jsonResult.stderr
    );
    return 0;
  }

  try {
    const parsed = JSON.parse(jsonResult.stdout);
    const size = parseInt(parsed.size.replace(/B$/, ""), 10);
    if (isNaN(size)) {
      console.error("Parsed size is NaN from dust stdout.");
      return 0;
    }
    return size;
  } catch (e) {
    console.error("Could not parse JSON from dust stdout.", e);
    console.log("Raw stdout was:", jsonResult.stdout);
    return 0;
  }
}

async function getDirDiskUsage(dirPath: string): Promise<number> {
  const entries = await scanDir(dirPath);
  // `map` 会返回一个由 Promise 组成的数组
  const diskUsagePromises = entries.map(async (entry) => {
    const cacheKey = path.join(path.basename(entry.basePath), entry.name);
    const cachedStats = store.get(cacheKey, {
      modifiedTime: 0,
      diskUsage: 0,
      checked: true,
    }) as { modifiedTime: number; diskUsage: number; checked: boolean };

    // 如果缓存有效，直接返回缓存中的值
    if (cachedStats.modifiedTime === entry.modifiedTime) {
      store.set(cacheKey, {
        modifiedTime: entry.modifiedTime,
        diskUsage: cachedStats.diskUsage,
        checked: true,
      });
      return cachedStats.diskUsage;
    }

    // 否则，重新计算并更新缓存
    const diskUsage = entry.isFile
      ? entry.size
      : await dustGetDirDiskUsage(path.join(entry.basePath, entry.name));
    store.set(cacheKey, {
      modifiedTime: entry.modifiedTime,
      diskUsage: diskUsage,
      checked: true,
    });

    // 返回新计算出的值
    return diskUsage;
  });

  // 等待所有获取磁盘用量的 Promise 完成
  const diskUsages = await Promise.all(diskUsagePromises);

  // 在所有并行操作结束后，再进行安全的求和
  const accumulatedDiskUsage = diskUsages.reduce(
    (sum: number, usage: number) => sum + usage,
    0
  );
  return accumulatedDiskUsage;
}

function saveDiskUsageCache(trim: boolean = false): void {
  // 清理所有缓存中包含 "entryStats:" 的键
  Object.entries(store.store).forEach(([key, value]) => {
    // if (key.startsWith("entryStats:")) {
    const stats = value as {
      modifiedTime: number;
      diskUsage: number;
      checked: boolean;
    };

    if (!stats.checked) {
      if (trim) store.delete(key);
    } else {
      store.set(key, {
        modifiedTime: stats.modifiedTime,
        diskUsage: stats.diskUsage,
        checked: false, // 将 checked 设置为 false，表示下次需要重新检查
      });
    }
    // }
  });

  store.save();
}

function getDiskUsage(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // 执行 df 命令
    exec(`df ${path}`, (error, stdout, _stderr) => {
      if (error) {
        reject(error);
        return;
      }

      // 假设 df 输出类似如下格式：
      // Filesystem     1K-blocks    Used Available Use% Mounted on
      // /dev/sda1       20511356 8626432   982556   47% /
      // 使用正则匹配第一个出现的百分比数字
      const match = stdout.match(/(\d+)%/);
      if (match) {
        resolve(parseInt(match[0])); // match[0] 包含 "47%" 格式的结果
      } else {
        reject(new Error('Failed to parse "df" output.'));
      }
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fetchJsonConfig(jsonPath?: string): Promise<any> {
  if (!jsonPath) {
    jsonPath = path.join(os.homedir(), ".config", "GalManager", "config.json");
  } else if (jsonPath.startsWith("<MAIN_DIST>")) {
    jsonPath = path.join(MAIN_DIST, jsonPath.slice(11));
  } else if (jsonPath.startsWith("<HOME>")) {
    jsonPath = path.join(os.homedir(), jsonPath.slice(6));
  }

  try {
    const exists = await fileExists(jsonPath);
    if (!exists) {
      return {};
    }

    const data = await fs.promises.readFile(jsonPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error fetching json config: ", jsonPath, error);
    return {};
  }
}

async function saveJsonConfig(config: any, jsonPath?: string): Promise<void> {
  if (!jsonPath) {
    jsonPath = path.join(os.homedir(), ".config", "GalManager", "config.json");
  } else if (jsonPath.startsWith("<MAIN_DIST>")) {
    jsonPath = path.join(MAIN_DIST, jsonPath.slice(11));
  } else if (jsonPath.startsWith("<HOME>")) {
    jsonPath = path.join(os.homedir(), jsonPath.slice(6));
  }
  try {
    const data = JSON.stringify(config, null, 2);
    await fs.promises.writeFile(jsonPath, data, "utf-8");
  } catch (error) {
    console.error("Error saving json config: ", jsonPath, error);
  }
}

async function fetchYamlConfig(yamlPath: string): Promise<any> {
  try {
    const exists = await fileExists(yamlPath);
    if (!exists) {
      return {};
    }

    const data = await fs.promises.readFile(yamlPath, "utf-8");
    return YAML.parse(data);
  } catch (error) {
    console.error("Error fetching yaml config:", yamlPath, error);
    return {};
  }
}

async function saveYamlConfig(config: any, yamlPath: string): Promise<void> {
  try {
    const data = YAML.stringify(config);
    await fs.promises.writeFile(yamlPath, data, "utf-8");
  } catch (error) {
    console.error("Error saving yaml config:", yamlPath, error);
  }
}

async function resizeImage(
  sourcePath: string,
  targetWidth: number,
  format: "jpg" | "webp" = "jpg",
  quality: number = 95
): Promise<string> {
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);
  const targetName = `${baseName}_sd.${format}`;
  const targetPath = path.join(path.dirname(sourcePath), targetName);

  // return targetPath;

  try {
    const image = sharp(sourcePath);

    await image
      .resize({ width: targetWidth, background: { r: 255, g: 255, b: 255 } })
      .toFormat(format, {
        quality: quality,
        chromaSubsampling: "4:4:4",
        progressive: true,
        optimiseCoding: true,
        mozjpeg: true,
        trellisQuantisation: true,
        overshootDeringing: true,
        optimiseScans: true,
      })
      .toFile(targetPath);

    return targetName;
  } catch (error) {
    console.error("Error resizing image:", error);
    throw error;
  }
}

async function createSymbolicLink(
  source: string,
  target: string
): Promise<void> {
  try {
    await fs.promises.unlink(target); // 删除现有目标
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // throw error; // 忽略 ENOENT 错误（目标不存在）
      console.error("Error unlinking target:", error);
    }
  }
  try {
    await fs.promises.symlink(source, target);
    // console.log(`Symbolic link created from ${source} to ${target}`);
  } catch (error) {
    // console.error('Error creating symbolic link:', error);
    // throw error;
    console.error("Error creating symbolic link:", error);
  }
}

async function removeSymbolicLink(target: string): Promise<void> {
  // process.noAsar = true;
  try {
    await fs.promises.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // throw error;
      console.error("Error removing symbolic link:", error);
    }
  }
  // process.noAsar = false;
}

async function readVdfFile(filePath: string): Promise<VdfMap> {
  return readVdf(await fs.promises.readFile(filePath));
}

async function writeVdfFile(filePath: string, vdf: VdfMap): Promise<void> {
  fs.promises.writeFile(filePath, writeVdf(vdf));
}

async function getGameID(name: string): Promise<string> {
  return getShortcutHash(name);
}

async function sqliteDBConnect(dbPath: string): Promise<void> {
  sqliteDB = new SqliteDB(dbPath);
}

async function sqliteDBInsertGame(
  gameNameEN: string,
  gameNameSlug: string,
  lutrisGameIndex: number,
  timestamp: number,
  year: string
): Promise<number> {
  const sqlInsert = `
    INSERT INTO games (
      id, name, slug, parent_slug, platform, runner, executable,
      directory, updated, lastplayed, installed, installed_at, year,
      configpath, has_custom_banner, has_custom_icon, has_custom_coverart_big,
      playtime, hidden, service, service_id, discord_id, sortname
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING rowid;
  `;
  var yearVal = year ? parseInt(year) : null;
  // prettier-ignore
  const data = [
    lutrisGameIndex, gameNameEN, gameNameSlug, null, "Windows", "wine", null,
    "", null, 0, 1, timestamp, yearVal,
    `${gameNameSlug}-${timestamp}`, 1, 1, 1, 
    0.0, 0, null, null, null, "",
  ];

  const statement: Statement = sqliteDB.prepare(sqlInsert);
  const result = statement.run(data);

  return result.lastInsertRowid as number;
}

async function sqliteDBDelete(lutrisGameIndex: number): Promise<void> {
  const sqlDelete = `DELETE FROM games WHERE id = ?;`;
  const statement: Statement = sqliteDB.prepare(sqlDelete);
  statement.run(lutrisGameIndex);
}

async function sqliteDBQueryGame(lutrisGameIndex: number): Promise<{
  gameNameEN: string;
  gameNameSlug: string;
  gameConfigName: string;
  gameReleaseYear: string;
} | null> {
  const sqlQuery = `SELECT name, slug, configpath, year FROM games WHERE id = ?;`;

  // Prepare and execute the SQL statement
  const statement: Statement = sqliteDB.prepare(sqlQuery);
  const result = statement.get(lutrisGameIndex) as
    | { name: string; slug: string; configpath: string; year: number }
    | undefined;

  return result
    ? {
        gameNameEN: result.name,
        gameNameSlug: result.slug,
        gameConfigName: result.configpath,
        gameReleaseYear: String(result.year),
      }
    : null;
}

async function sqliteDBGetCategories(): Promise<Record<string, number>> {
  const sqlQuery = `SELECT id, name FROM categories;`;
  const statement: Statement = sqliteDB.prepare(sqlQuery);
  const results = statement.all() as { id: number; name: string }[];
  const categories: Record<string, number> = {};
  results.forEach((result) => {
    categories[result.name] = result.id;
  });
  return categories;
}

async function sqliteDBGetGameCategories(lutrisGameIndex: number) {
  const sqlQuery = `
    SELECT categories.id, categories.name
    FROM categories
    JOIN games_categories ON categories.id = games_categories.category_id
    WHERE games_categories.game_id = ?;
  `;
  const statement: Statement = sqliteDB.prepare(sqlQuery);
  const results = statement.all(lutrisGameIndex) as {
    id: number;
    name: string;
  }[];
  return results;
}

async function sqliteDBSetGameCategories(
  lutrisGameIndex: number,
  lutrisCategoryIndeces: number[]
) {
  const sqlDelete = `DELETE FROM games_categories WHERE game_id = ?;`;
  let statement: Statement = sqliteDB.prepare(sqlDelete);
  statement.run(lutrisGameIndex);
  lutrisCategoryIndeces.forEach((categoryIndex) => {
    const sqlInsert = `INSERT INTO games_categories (game_id, category_id) VALUES (?, ?);`;
    const data = [lutrisGameIndex, categoryIndex];
    statement = sqliteDB.prepare(sqlInsert);
    statement.run(data);
  });
}

async function sqliteDBOp(op: string, params: any): Promise<any> {
  try {
    switch (op) {
      case "connect":
        return await sqliteDBConnect(params.dbPath);

      case "insertGame":
        // Insert operation requires gameNameEN, gameNameSlug, lutrisGameIndex, and timestamp
        return await sqliteDBInsertGame(
          params.gameNameEN,
          params.gameNameSlug,
          params.lutrisGameIndex,
          params.timestamp,
          params.year
        );

      case "deleteGame":
        // Delete operation requires lutrisGameIndex
        return await sqliteDBDelete(params.lutrisGameIndex);

      case "queryGame":
        // Query operation requires lutrisGameIndex
        return await sqliteDBQueryGame(params.lutrisGameIndex);

      case "getCategories":
        return await sqliteDBGetCategories();

      case "getGameCategories":
        return await sqliteDBGetGameCategories(params.lutrisGameIndex);

      case "setGameCategories":
        // console.log("setGameCategories:", params);
        // console.log(
        //   "categoryIndices:",
        //   JSON.parse(params.lutrisCategoryIndeces)
        // );
        return await sqliteDBSetGameCategories(
          params.lutrisGameIndex,
          JSON.parse(params.lutrisCategoryIndeces)
        );

      default:
        throw new Error(`Unsupported operation: ${op}`);
    }
  } catch (error) {
    console.error(`Error handling sqliteDBOp (${op}, ${params}):`, error);
    throw error;
  }
}

async function kuroshiroOp(op: string, params: any): Promise<string> {
  switch (op) {
    case "init":
      try {
        await kuroshiro.init(
          isPackaged
            ? new KuromojiAnalyzer({
                dictPath: path.join(
                  process.env.APP_ROOT,
                  "node_modules/@sglkc/kuromoji/dict"
                ),
              })
            : new KuromojiAnalyzer()
        );
        return "Kuroshiro initialized.";
      } catch (error) {
        // throw error;
        return `Error initializing Kuroshiro: ${error}`;
      }

    case "convert":
      return await kuroshiro.convert(params.text, {
        to: params.to,
        mode: params.mode,
      });

    case "hasJapanese":
      return await kuroshiro.Util.hasJapanese(params.text);

    default:
      throw new Error(`Unsupported operation: ${op}`);
  }
}

async function getFileNameWithType(
  dirPath: string,
  format: string = "exe"
): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(`.${format}`))
      .map((entry) => entry.name);
  } catch (error) {
    console.error("Error reading directory:", dirPath, error);
    return [];
  }
}

async function renameItem(oldPath: string, newPath: string): Promise<void> {
  try {
    await fs.promises.rename(oldPath, newPath);
  } catch (error) {
    console.error("Error renaming item:", error);
    throw error;
  }
}

async function removeItem(itemPath: string): Promise<void> {
  // process.noAsar = true;
  try {
    const stats = await fs.promises.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.promises.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(itemPath);
    }
  } catch (error) {
    console.error("Error removing item:", error);
    // throw error;
  }
  // process.noAsar = false;
}

async function getTotalSize(dir: string): Promise<number> {
  // use fs.promises.readdir and fs.promises.stat to get
  // the total size of all files in a directory, should be
  // more accurate interms of size copied than using du
  let totalSize = 0;

  async function getSize(filePath: string) {
    const stats = await fs.promises.stat(filePath);
    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(filePath);
      for (const file of files) {
        await getSize(path.join(filePath, file));
      }
    } else {
      totalSize += stats.size;
    }
  }

  await getSize(dir);
  return totalSize;
}

// 递归复制目录
async function copyDirectory(
  src: string,
  dest: string,
  include: string[],
  exclude: string[],
  event: Electron.IpcMainInvokeEvent
) {
  // process.noAsar = true;
  await fs.promises.mkdir(dest, { recursive: true });

  const files = await fs.promises.readdir(src);

  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stats = await fs.promises.stat(srcPath);

    if (stats.isDirectory()) {
      const startWithExclude = exclude.some((excludePath) => {
        return srcPath.startsWith(excludePath);
      });
      const containedInInclude = include.some((includePath) => {
        return includePath.startsWith(srcPath);
      });
      if (startWithExclude && !containedInInclude) continue;

      await copyDirectory(srcPath, destPath, include, exclude, event);
    } else {
      // leaf file
      const startWithExclude = exclude.some((excludePath) => {
        return srcPath.startsWith(excludePath);
      });
      const isInclude = include.includes(srcPath);
      if (startWithExclude && !isInclude) continue;

      await copyFileWithProgress(srcPath, destPath, event);
    }
  }
  // process.noAsar = false;
}

// 复制文件并发送进度
async function copyFileWithProgress(
  src: string,
  dest: string,
  event: Electron.IpcMainInvokeEvent
) {
  // process.noAsar = true;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const stats = await fs.promises.stat(src);
  return new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(src);
    const writeStream = fs.createWriteStream(dest);

    readStream.on("data", (chunk) => {
      event.sender.send("copy-progress", {
        increment: chunk.length,
      });
    });

    // readStream.on("end", resolve);
    readStream.on("error", reject);
    writeStream.on("error", reject);

    writeStream.on("finish", async () => {
      try {
        await fs.promises.utimes(dest, stats.atime, stats.mtime); // 保留原时间
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    readStream.pipe(writeStream);
  });
  // process.noAsar = false;
}

async function createFolder(folderPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

async function getFileInfos(root: string): Promise<Map<string, FileInfo>> {
  // process.noAsar = true;

  const map = new Map<string, FileInfo>();

  async function traverse(
    currentDir: string,
    relativePath: string
  ): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(currentDir);
    } catch (error) {
      console.error("Error reading directory ${currentDir}:", error);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const newRelativePath = path.join(relativePath, entry);
      let stats;
      try {
        stats = await fs.promises.stat(fullPath);
      } catch (error) {
        console.error("Error stating ${fullPath}:", error);
        continue;
      }
      map.set(newRelativePath, {
        modified: stats.mtime,
        size: stats.size,
        isDirectory: stats.isDirectory(),
      });
      if (stats.isDirectory()) {
        await traverse(fullPath, newRelativePath);
      }
    }
  }
  if (await fileExists(root)) {
    map.set("", {
      modified: (await fs.promises.stat(root)).mtime,
      size: (await fs.promises.stat(root)).size,
      isDirectory: true,
    });
  }
  await traverse(root, "");

  // process.noAsar = false;
  return map;
}

async function filesIdentical(sourcePath: string, targetPath: string) {
  try {
    // 获取两个文件的状态信息
    const sourceStats = await fs.promises.stat(sourcePath);
    const targetStats = await fs.promises.stat(targetPath);

    // 比较文件大小和修改时间
    const sizeMatches = sourceStats.size === targetStats.size;
    const mtimeMatches =
      sourceStats.mtime.getTime() === targetStats.mtime.getTime();

    // 如果大小和修改时间都匹配，则认为文件相同
    return sizeMatches && mtimeMatches;
  } catch (error) {
    // console.error("Error comparing files:", error);
    // 出错时返回 false，这样会触发文件复制
    return false;
  }
}

async function readVDF(filePath: string): Promise<any> {
  try {
    const fileContent = await fs.promises.readFile(filePath, "utf8");
    const parsed = vdf.parse(fileContent);
    return parsed;
  } catch (error) {
    throw new Error(`读取或解析 VDF 文件失败: ${error}`);
  }
}

async function writeVDF(filePath: string, json: any): Promise<void> {
  try {
    const vdfString = vdf.dump(json).replace(/\n{2,}/g, "\n");
    // console.log(vdfString);
    await fs.promises.writeFile(filePath, vdfString, "utf8");
  } catch (error) {
    throw new Error(`写入 VDF 文件失败: ${error}`);
  }
}

async function getSteamCategories(dbPath: string, steamId: string) {
  try {
    steamCat = new SteamCategories(dbPath, steamId);
    let categories;
    for (let i = 0; i < 30; i++) {
      try {
        categories = await steamCat.read();
        break;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    if (!categories) {
      return [];
    }
    await steamCat.close();

    console.log("SteamCategories read.");

    return Object.values(categories["1"])
      .filter(
        (category: any) =>
          category.is_deleted !== true &&
          category.key.includes("user-collections")
      )
      .map((category: any) => category.value);
    // category.value.added stores the AppID of steam games
    // we only need category.value.id and category.value.name
  } catch (error) {
    console.error("Error setting up SteamCategories:", error);
    return [];
  }
}

async function getFileIcon(path: string): Promise<string[]> {
  //   console.log(path);
  const results: string[] = [];
  try {
    const binary = await fs.promises.readFile(path);
    const ex = ResEdit.NtExecutable.from(binary, { ignoreCert: true });
    const exRes = ResEdit.NtExecutableResource.from(ex, true);
    const iconEntries = ResEdit.Resource.IconGroupEntry.fromEntries(
      exRes.entries
    );
    if (iconEntries.length === 0) {
      console.warn("No icon entries found in the file.");
      return results; // 直接返回空数组，不进入循环
    }
    for (let i = 0; i < iconEntries.length; i++) {
      try {
        const entry = iconEntries[i];
        // console.log("entry");
        const iconItems = entry.getIconItemsFromEntries(exRes.entries);
        // console.log("iconItems");
        const iconFile = new ResEdit.Data.IconFile();
        // console.log("iconFile");
        iconFile.icons = iconItems.map(function (item) {
          return { data: item };
        });
        // console.log("iconFile.icons");
        // const blob = new Blob([iconFile.generate()], { type: "image/x-icon" });
        // const url = URL.createObjectURL(blob);
        // console.log("url", url);
        // results.push(url);

        // 生成ico文件的二进制数据
        const iconBuffer = iconFile.generate();
        // console.log("iconBuffer");
        // 使用 Node 的 Buffer 将二进制数据转换为 base64 字符串
        const base64Data = Buffer.from(iconBuffer).toString("base64");
        // console.log("base64Data");
        // 拼接data URI前缀后存入结果数组
        results.push(`data:image/x-icon;base64,${base64Data}`);
      } catch (error) {
        console.error("Error getting file icon:", error);
      }
    }
  } catch (error) {
    console.error("Error reading file:", error);
  }
  return results;
}

export default {
  scanDir,
  getDirDiskUsage,
  saveDiskUsageCache,
  getDiskUsage,
  fileExists,
  resizeImage,
  fetchJsonConfig,
  saveJsonConfig,
  fetchYamlConfig,
  saveYamlConfig,
  createSymbolicLink,
  removeSymbolicLink,
  readVdfFile,
  writeVdfFile,
  getGameID,
  sqliteDBOp,
  kuroshiroOp,
  getFileNameWithType,
  getTotalSize,
  copyDirectory,
  copyFileWithProgress,
  renameItem,
  removeItem,
  getFileInfos,
  readVDF,
  writeVDF,
  getSteamCategories,
  getFileIcon,
  createFolder,
  filesIdentical,
};
