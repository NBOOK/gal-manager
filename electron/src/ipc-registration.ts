import { app, ipcMain, RelaunchOptions, shell } from "electron";

import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { VdfMap } from "steam-binary-vdf";
import utils from "./utils";
import { execFile } from "node:child_process";
// import { getFileIcon } from "./ico";

// prettier-ignore
function registerIpcMain(win: Electron.BrowserWindow | null, MAIN_DIST: string) {
    ipcMain.handle('restartApp', () => {
      const options: RelaunchOptions = {
        args: process.argv.slice(1).concat(['--relaunch']),
        execPath: process.execPath
      };
      // Fix for .AppImage
      if (app.isPackaged && process.env.APPIMAGE) { 
        execFile(process.env.APPIMAGE, options.args);
        app.quit();
        return;
      }
      app.relaunch(options);
      app.quit();
    });
    ipcMain.handle('quitApp', () => {
      app.quit();
    });
    ipcMain.handle('openDevTools', () => {
      win?.webContents.openDevTools();
    });
    ipcMain.handle('scanDir', (_event, dirPath: string, netDiskOnline: boolean = false, skipSymbolicTargetPrefix?: string) => {
      if (dirPath.startsWith("<MAIN_DIST>")) {
        dirPath = path.join(MAIN_DIST, dirPath.slice(11));
      } else if (dirPath.startsWith("<HOME>")) {
        dirPath = path.join(os.homedir(), dirPath.slice(6));
      }
      return utils.scanDir(dirPath, netDiskOnline, skipSymbolicTargetPrefix)
    });
    ipcMain.handle('getDirDiskUsage', (_event, dirPath: string) => {
      return utils.getDirDiskUsage(dirPath)
    });
    ipcMain.handle('saveDiskUsageCache', (_event, trim: boolean) => {
      return utils.saveDiskUsageCache(trim)
    });
    ipcMain.handle('getDiskUsage', (_event, dirPath: string) => {
      return utils.getDiskUsage(dirPath)
    });
    ipcMain.handle('fileExists', (_event, filePath: string) => {
      if (filePath.startsWith("<MAIN_DIST>")) {
        filePath = path.join(MAIN_DIST, filePath.slice(11));
      } else if (filePath.startsWith("<HOME>")) {
        filePath = path.join(os.homedir(), filePath.slice(6));
      }
      return utils.fileExists(filePath)
    });
    ipcMain.handle('resizeImage', (_event, sourcePath: string, targetWidth: number, format: 'jpg' | 'webp', compression: number) => {
      return utils.resizeImage(sourcePath, targetWidth, format, compression)
    });
    ipcMain.handle('fetchJsonConfig', (_event, jsonPath?: string) => {
      return utils.fetchJsonConfig(jsonPath)
    });
    ipcMain.handle('saveJsonConfig', (_event, serializedConfig: string, jsonPath?: string) => {
      const config = JSON.parse(serializedConfig)
      return utils.saveJsonConfig(config, jsonPath)
    });
    ipcMain.handle('fetchYamlConfig', (_event, yamlPath: string) => {
      return utils.fetchYamlConfig(yamlPath)
    });
    ipcMain.handle('saveYamlConfig', (_event, serializedConfig: string, yamlPath: string) => {
      const config = JSON.parse(serializedConfig)
      return utils.saveYamlConfig(config, yamlPath)
    });
    ipcMain.handle('createSymbolicLink', (_event, source: string, target: string) => {
      return utils.createSymbolicLink(source, target)
    });
    ipcMain.handle('removeSymbolicLink', (_event, target: string) => {
      return utils.removeSymbolicLink(target)
    });
    ipcMain.handle('readVdfFile', (_event, filePath: string) => {
      return utils.readVdfFile(filePath)
    });
    ipcMain.handle('writeVdfFile', (_event, filePath: string, serializedVDF: string) => {
      const vdf: VdfMap = JSON.parse(serializedVDF)
      return utils.writeVdfFile(filePath, vdf)
    });
    ipcMain.handle('getGameID', (_event, name: string) => {
      return utils.getGameID(name)
    });
    ipcMain.handle('readFile', (_event, filePath: string, options?: { encoding?: BufferEncoding, flag?: string }) => {
      return fs.promises.readFile(filePath, options || 'utf-8');
    });
    ipcMain.handle('writeFile', (_event, filePath: string, data: any, options?: { encoding?: BufferEncoding, flag?: string }) => {
      return fs.promises.writeFile(filePath, data, options || 'utf-8');
    });
    ipcMain.handle('sqliteDBOp', (_event, op: string, params: any) => {
      return utils.sqliteDBOp(op, params);
    });
    ipcMain.handle('kuroshiroOp', (_event, op: string, params: any) => {
      return utils.kuroshiroOp(op, params)
    });
    ipcMain.handle('openExternal', (_event, url: string) => {
      return shell.openExternal(url)
    });
    ipcMain.handle('openPath', (_event, openpath: string) => {
      if (openpath.startsWith("<MAIN_DIST>")) {
        openpath = path.join(MAIN_DIST, openpath.slice(11));
      } else if (openpath.startsWith("<HOME>")) {
        openpath = path.join(os.homedir(), openpath.slice(6));
      }
      return shell.openPath(openpath)
    });
    ipcMain.handle('showItemInFolder', (_event, openpath: string) => {
      if (openpath.startsWith("<MAIN_DIST>")) {
        openpath = path.join(MAIN_DIST, openpath.slice(11));
      } else if (openpath.startsWith("<HOME>")) {
        openpath = path.join(os.homedir(), openpath.slice(6));
      }
      return shell.showItemInFolder(openpath)
    });
    ipcMain.handle('getFileNameWithType', (_event, filePath: string, format?: string) => {
      return utils.getFileNameWithType(filePath, format)
    });
    ipcMain.handle('renameItem', (_event, oldPath: string, newPath: string) => {
      return utils.renameItem(oldPath, newPath)
    });
    ipcMain.handle('removeItem', (_event, path: string) => {
      return utils.removeItem(path)
    });
    ipcMain.handle('start-copy', async (event, source:string, destination:string, include:string[]=[], exclude:string[]=[]) => {
      if (source.startsWith("<MAIN_DIST>")) {
        source = path.join(MAIN_DIST, source.slice(11));
      } else if (source.startsWith("<HOME>")) {
        source = path.join(os.homedir(), source.slice(6));
      }
      if (destination.startsWith("<MAIN_DIST>")) {
        destination = path.join(MAIN_DIST, destination.slice(11));
      } else if (destination.startsWith("<HOME>")) {
        destination = path.join(os.homedir(), destination.slice(6));
      }
      try {
        if ((await fs.promises.stat(source)).isDirectory()) {
          await utils.copyDirectory(source, destination, include, exclude, event);
        } 
        else {
          const startWithExclude = exclude.some((excludePath) => {
            return source.startsWith(excludePath);
          });
          const isInclude = include.includes(source);
          if (startWithExclude && !isInclude) return;
          await utils.copyFileWithProgress(source, destination, event);
        }
        event.sender.send('copy-finished', { success: true });
      } catch (error) {
        event.sender.send('copy-finished', { success: false, error: (error as Error).message });
      }
    });
    ipcMain.handle('readlink', (_event, path: string) => {
      return fs.promises.readlink(path);
    });
    ipcMain.handle('getFileInfos', (_event, filePath: string) => {
      return utils.getFileInfos(filePath);
    });
    ipcMain.handle('readVDF', (_event, filePath: string) => {
      return utils.readVDF(filePath);
    });
    ipcMain.handle('writeVDF', (_event, filePath: string, serializedJSON: string) => {
      return utils.writeVDF(filePath, JSON.parse(serializedJSON));
    });
    ipcMain.handle('getSteamCategories', (_event, dbPath:string) => {
      return utils.getSteamCategories(dbPath);
    });
    ipcMain.handle('getFileIcon', (_event, path: string) => {
      return utils.getFileIcon(path);
    }
    );
    ipcMain.handle('createFolder', (_event, folderPath: string) => {
      if (folderPath.startsWith("<MAIN_DIST>")) {
        folderPath = path.join(MAIN_DIST, folderPath.slice(11));
      }
      if(folderPath.startsWith("<HOME>")) {
        folderPath = path.join(os.homedir(), folderPath.slice(6));
      }
      return fs.promises.mkdir(folderPath);
    });
    ipcMain.handle('filesIdentical', (_event, sourcePath: string, targetPath:string, loose: boolean=true) => {
      return utils.filesIdentical(sourcePath, targetPath, loose);
    });
    ipcMain.handle('hasExecutableMagic', (_event, filePath: string) => {
      return utils.hasExecutableMagic(filePath);
    });
  }

export default registerIpcMain;
