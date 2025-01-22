import { app, BrowserWindow, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import utils from './utils';


// check if we are running in development mode
const isDev = process.env.NODE_ENV === 'development';

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // nodeIntegration: true, // Enable Node.js integration
      webSecurity: !isDev, // Disable same-origin policy during development
    },
    autoHideMenuBar: true,
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  registerIpcMain()
  createWindow()
  // Menu.setApplicationMenu(null)
})

function registerIpcMain() {
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
  ipcMain.handle('fetchConfig', (_event, jsonPath?: string) => {
    return utils.fetchConfig(jsonPath)
  });
  ipcMain.handle('saveConfig', (_event, config: any, jsonPath?: string) => {
    return utils.saveConfig(config, jsonPath)
  });
  ipcMain.handle('createSymbolicLink', (_event, source: string, target: string) => {
    return utils.createSymbolicLink(source, target)
  });
}
