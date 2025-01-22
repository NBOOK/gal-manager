import fs from 'node:fs'
import os from 'node:os'
import { spawn } from 'node:child_process'
import sharp from 'sharp';
import path from 'node:path'
import { readVdf, VdfMap, writeVdf, getShortcutHash } from "steam-binary-vdf";

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
                        // let totalSize = 0;
                        // const calculateDiskUsage = async (dir: string) => {
                        //   const subEntries = await fs.promises.readdir(dir, { withFileTypes: true });
                        //   for (const subEntry of subEntries) {
                        //     const subEntryPath = path.join(dir, subEntry.name);
                        //     const subStats = await fs.promises.stat(subEntryPath);
                        //     if (subEntry.isDirectory()) {
                        //       await calculateDiskUsage(subEntryPath); // 递归子目录
                        //     } else {
                        //       totalSize += subStats.size; // 文件大小
                        //     }
                        //   }
                        // };

                        // await calculateDiskUsage(entryPath); // 开始计算磁盘占用
                        // result.diskUsage = totalSize;
                        // result.diskUsage = await getDiskUsage(entryPath);

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
        console.error('Error reading directory:', (err as Error).message);
        // throw err;
        return [];
    }
}

async function getDiskUsage(dirPath: string): Promise<number> {
    const platform = os.platform();

    // console.log('platform:', platform);
    // console.log('dirPath:', dirPath);

    if (platform === 'win32') {
        // Windows: 使用 PowerShell 的 Get-ChildItem 命令计算目录大小
        return new Promise((resolve, reject) => {
            const powershell = spawn('powershell', [
                '-NoProfile',
                '-Command',
                `Get-ChildItem -Recurse -Force -File "${dirPath}" | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum`
            ]);
            let output = '';
            powershell.stdout.on('data', (data) => (output += data.toString()));
            powershell.stderr.on('data', (data) => console.error(data.toString()));
            powershell.on('close', (code) => {
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
            const du = spawn('du', ['-sbL', dirPath]); // 使用 `du` 命令获取目录大小，单位字节，-L 跟踪符号链接
            let output = '';
            let errorOutput = '';

            du.stdout.on('data', (data) => (output += data.toString()));
            du.stderr.on('data', (data) => (errorOutput += data.toString()));

            du.on('close', (code) => {
                if (output.trim()) {
                    // 如果 `stdout` 有输出，尝试解析大小并忽略错误
                    try {
                        const size = parseInt(output.split('\t')[0], 10); // 解析 <大小>\t<路径>
                        if (!isNaN(size)) {
                            if (errorOutput.trim()) {
                                console.warn(`du stderr: ${errorOutput.trim()}`);
                            }
                            resolve(size);
                        } else {
                            reject(new Error('Failed to parse du output.'));
                        }
                    } catch (err) {
                        reject(err);
                    }
                } else if (errorOutput.trim()) {
                    // 如果完全没有有效输出，则认为是严重错误
                    reject(new Error(`du command failed: ${errorOutput.trim()}`));
                } else {
                    reject(new Error(`du command exited with code ${code}, but no output.`));
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

async function fetchConfig(jsonPath?: string)
    : Promise<any> {
    if (!jsonPath) {
        jsonPath = path.join(os.homedir(), '.local', 'share', 'GalManager', 'config.json');
    }
    try {
        const exists = await fileExists(jsonPath);
        if (!exists) {
            return {};
        }

        const data = await fs.promises.readFile(jsonPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error fetching config:', error);
        return {};
    }
}

async function saveConfig(config: any, jsonPath?: string): Promise<void> {
    if (!jsonPath) {
        jsonPath = path.join(os.homedir(), '.local', 'share', 'GalManager', 'config.json');
    }
    try {
        const data = JSON.stringify(config, null, 2);
        await fs.promises.writeFile(jsonPath, data, 'utf-8');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

async function resizeImage(
    sourcePath: string,
    targetWidth: number,
    format: 'jpg' | 'webp' = 'jpg',
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
                chromaSubsampling: '4:4:4',
                progressive: true,
                optimiseCoding: true,
                mozjpeg: true,
                trellisQuantisation: true,
                overshootDeringing: true,
                optimiseScans: true,
            })
            .toFile(targetPath);

        return targetPath;
    } catch (error) {
        console.error('Error resizing image:', error);
        throw error;
    }
}

async function createSymbolicLink(source: string, target: string): Promise<void> {
    try {
        await fs.promises.unlink(target); // 删除现有目标
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error; // 忽略 ENOENT 错误（目标不存在）
        }
    }
    try {
        await fs.promises.symlink(source, target);
        // console.log(`Symbolic link created from ${source} to ${target}`);
    } catch (error) {
        // console.error('Error creating symbolic link:', error);
        throw error;
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

export default {
    scanDir,
    getDiskUsage,
    fileExists,
    resizeImage,
    fetchConfig,
    saveConfig,
    createSymbolicLink,
    readVdfFile,
    writeVdfFile,
    getGameID,
};