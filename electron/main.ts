import { app, BrowserWindow, ipcMain, RelaunchOptions, shell } from "electron";
// import { createRequire } from 'node:module'
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { VdfMap } from "steam-binary-vdf";
import utils from "./utils";
import { execFile } from "node:child_process";
// import { fstat } from 'node:fs';

// check if we are running in development mode
const isDev = process.env.NODE_ENV === "development";

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "favicon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      // nodeIntegration: true, // Enable Node.js integration
      webSecurity: !isDev, // Disable same-origin policy during development
      devTools: isDev,
    },
    autoHideMenuBar: true,
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  registerIpcMain();
  createWindow();
  // Menu.setApplicationMenu(null)
});

// prettier-ignore
function registerIpcMain() {
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
  ipcMain.handle('scanDir', (_event, dirPath: string) => {
    return utils.scanDir(dirPath)
  });
  ipcMain.handle('getDiskUsage', (_event, dirPath: string) => {
    return utils.getDiskUsage(dirPath)
  });
  ipcMain.handle('fileExists', (_event, filePath: string) => {
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
  ipcMain.handle('start-copy', async (event, source:string, destination:string, dirOnly=false, include:string[]=[], exclude:string[]=[]) => {
    try {
      if ((await fs.promises.stat(source)).isDirectory()) {
        await utils.copyDirectory(source, destination, dirOnly, include, exclude, event);
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
}
