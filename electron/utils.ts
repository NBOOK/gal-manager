import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import sharp from "sharp";
import path from "node:path";
import { readVdf, VdfMap, writeVdf, getShortcutHash } from "steam-binary-vdf";
import YAML from "yaml";
import { Database as DatabaseType, Statement } from "better-sqlite3";
import { MAIN_DIST } from "./main";
import Kuroshiro from "@sglkc/kuroshiro";
import KuromojiAnalyzer from "@sglkc/kuroshiro-analyzer-kuromoji";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

let sqliteDB: DatabaseType;
const kuroshiro = new Kuroshiro();
// (async () => {
//   try {
//     // const kuroshiro = new Kuroshiro();
//     await kuroshiro.init(new KuromojiAnalyzer());
//     console.log("Kuroshiro initialized.");
//     // 其他代码
//   } catch (error) {
//     console.error("初始化失败:", error);
//   }
// })();

async function scanDir(dirPath: string): Promise<DirEntry[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    const serializedEntries = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);
        const isSymbolicLink = entry.isSymbolicLink();

        // 初始化返回对象
        const result: DirEntry = {
          basePath: dirPath,
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          isSymbolicLink,
          symbolicTarget: "",
          // diskUsage: 0,
          createdTime: 0,
          modifiedTime: 0,
        };

        try {
          // 如果是符号链接，解析目标路径并确定类型
          if (isSymbolicLink) {
            result.symbolicTarget = await fs.promises.readlink(entryPath);
            const stats = await fs.promises.stat(entryPath);
            result.isDirectory = stats.isDirectory();
            result.isFile = stats.isFile();
          }

          // 如果是目录（或符号链接指向目录），计算磁盘占用和时间戳
          if (result.isDirectory) {
            // 获取创建时间和修改时间
            const stats = await fs.promises.stat(entryPath);
            result.createdTime = stats.birthtimeMs;
            result.modifiedTime = stats.mtimeMs;
          }
        } catch (err) {
          console.warn(`Error processing entry ${entry.name}:`, err);
        }

        return result;
      })
    );

    return serializedEntries;
  } catch (err) {
    console.error("Error reading directory:", (err as Error).message);
    // throw err;
    return [];
  }
}

async function getDiskUsage(dirPath: string): Promise<number> {
  const platform = os.platform();

  // console.log('platform:', platform);
  // console.log('dirPath:', dirPath);

  if (platform === "win32") {
    // Windows: 使用 PowerShell 的 Get-ChildItem 命令计算目录大小
    return new Promise((resolve, reject) => {
      const powershell = spawn("powershell", [
        "-NoProfile",
        "-Command",
        `Get-ChildItem -Recurse -Force -File "${dirPath}" | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum`,
      ]);
      let output = "";
      powershell.stdout.on("data", (data) => (output += data.toString()));
      powershell.stderr.on("data", (data) => console.error(data.toString()));
      powershell.on("close", (code) => {
        if (code === 0) {
          const size = parseInt(output.trim(), 10);
          resolve(size || 0); // 防止返回 NaN，默认返回 0
        } else {
          reject(new Error(`PowerShell command failed with code ${code}`));
        }
      });
    });
  } else {
    // Unix-like: 使用 du 命令
    return new Promise((resolve, reject) => {
      const du = spawn("du", ["-sbL", dirPath]); // 使用 `du` 命令获取目录大小，单位字节，-L 跟踪符号链接
      let output = "";
      let errorOutput = "";

      du.stdout.on("data", (data) => (output += data.toString()));
      du.stderr.on("data", (data) => (errorOutput += data.toString()));

      du.on("close", (code) => {
        if (output.trim()) {
          // 如果 `stdout` 有输出，尝试解析大小并忽略错误
          try {
            const size = parseInt(output.split("\t")[0], 10); // 解析 <大小>\t<路径>
            if (!isNaN(size)) {
              if (errorOutput.trim()) {
                console.warn(`du stderr: ${errorOutput.trim()}`);
              }
              resolve(size);
            } else {
              reject(new Error("Failed to parse du output."));
            }
          } catch (err) {
            reject(err);
          }
        } else if (errorOutput.trim()) {
          // 如果完全没有有效输出，则认为是严重错误
          reject(new Error(`du command failed: ${errorOutput.trim()}`));
        } else {
          reject(
            new Error(`du command exited with code ${code}, but no output.`)
          );
        }
      });
    });
  }
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
    jsonPath = path.join(
      os.homedir(),
      ".local",
      "share",
      "GalManager",
      "config.json"
    );
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
    jsonPath = path.join(
      os.homedir(),
      ".local",
      "share",
      "GalManager",
      "config.json"
    );
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
  try {
    await fs.promises.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // throw error;
      console.error("Error removing symbolic link:", error);
    }
  }
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
  sqliteDB = new Database(dbPath);
}

async function sqliteDBInsert(
  gameNameEN: string,
  gameNameSlug: string,
  lutrisGameIndex: number,
  timestamp: number
): Promise<number> {
  const sqlInsert = `
    INSERT INTO games (
      id, name, slug, parent_slug, platform, runner, executable,
      directory, updated, lastplayed, installed, installed_at,
      configpath, has_custom_banner, has_custom_icon, has_custom_coverart_big,
      playtime, hidden, service, service_id, discord_id, sortname
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING rowid;
  `;
  // prettier-ignore
  const data = [
    lutrisGameIndex, gameNameEN, gameNameSlug, null, "Windows", "wine", null,
    "", null, 0, 1, timestamp,
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

async function sqliteDBQuery(lutrisGameIndex: number): Promise<{
  gameNameEN: string;
  gameNameSlug: string;
  gameConfigName: string;
} | null> {
  const sqlQuery = `SELECT name, slug, configpath FROM games WHERE id = ?;`;

  // Prepare and execute the SQL statement
  const statement: Statement = sqliteDB.prepare(sqlQuery);
  const result = statement.get(lutrisGameIndex) as
    | { name: string; slug: string; configpath: string }
    | undefined;

  return result
    ? {
        gameNameEN: result.name,
        gameNameSlug: result.slug,
        gameConfigName: result.configpath,
      }
    : null;
}

async function sqliteDBOp(op: string, params: any): Promise<any> {
  try {
    switch (op) {
      case "connect":
        // Connect operation requires dbPath
        return await sqliteDBConnect(params.dbPath);

      case "insert":
        // Insert operation requires gameNameEN, gameNameSlug, lutrisGameIndex, and timestamp
        return await sqliteDBInsert(
          params.gameNameEN,
          params.gameNameSlug,
          params.lutrisGameIndex,
          params.timestamp
        );

      case "delete":
        // Delete operation requires lutrisGameIndex
        return await sqliteDBDelete(params.lutrisGameIndex);

      case "query":
        // Query operation requires lutrisGameIndex
        return await sqliteDBQuery(params.lutrisGameIndex);

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
          new KuromojiAnalyzer({ dictPath: path.join(MAIN_DIST, "dict") })
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
  await fs.promises.mkdir(dest, { recursive: true });
  const files = await fs.promises.readdir(src);

  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stats = await fs.promises.stat(srcPath);

    if (stats.isDirectory()) {
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
}

// 复制文件并发送进度
async function copyFileWithProgress(
  src: string,
  dest: string,
  event: Electron.IpcMainInvokeEvent
) {
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
}

async function getFileInfos(root: string): Promise<Map<string, FileInfo>> {
  const map = new Map<string, FileInfo>();

  async function traverse(
    currentDir: string,
    relativePath: string
  ): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.promises.readdir(currentDir);
    } catch (error) {
      console.error(`Error reading directory ${currentDir}:`, error);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const newRelativePath = path.join(relativePath, entry);
      let stats;
      try {
        stats = await fs.promises.stat(fullPath);
      } catch (error) {
        console.error(`Error stating ${fullPath}:`, error);
        continue;
      }
      if (stats.isDirectory()) {
        await traverse(fullPath, newRelativePath);
      } else if (stats.isFile()) {
        map.set(newRelativePath, { modified: stats.mtime, size: stats.size });
      }
    }
  }

  await traverse(root, "");
  return map;
}

export default {
  scanDir,
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
};
