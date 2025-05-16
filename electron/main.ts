import { app, BrowserWindow, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";
import registerIpcMain from "./src/ipc-registration";

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
      // devTools: isDev,
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
  closeSteamOrQuit();
  registerIpcMain(win, MAIN_DIST);
  createWindow();
  // Menu.setApplicationMenu(null)
});

function closeSteamOrQuit() {
  if (isSteamRunning()) {
    const result = dialog.showMessageBoxSync({
      type: "warning",
      title: "Steam is Running",
      message:
        "Please close Steam before running this application. Do you want to close Steam now?",
      buttons: ["Yes", "No"],
      defaultId: 0, // 默认选中 Yes
      cancelId: 1, // 按 Esc 或关闭窗口时视为 No
    });

    if (result === 0) {
      // 用户选择 Yes
      killSteam();
    } else {
      // 用户选择 No
      app.quit();
    }
  }
}

function isSteamRunning() {
  try {
    execSync("pgrep -x steam"); // 成功执行表示 Steam 运行中
    return true;
  } catch (error) {
    return false; // 没找到进程
  }
}

function killSteam() {
  try {
    execSync("pkill -x steam"); // 直接结束所有 steam 进程
    console.log("Steam 终止命令已发送，等待进程退出...");

    // 轮询检测 Steam 是否彻底关闭
    let maxRetries = 20;
    while (isSteamRunning() && maxRetries > 0) {
      console.log(`Steam 未关闭，剩余重试次数：${maxRetries}`);
      execSync("sleep 1"); // 等待 1 秒
      maxRetries--;
    }

    if (isSteamRunning()) {
      console.log("Steam 未能成功关闭");
      app.quit();
    } else {
      console.log("Steam 已成功关闭");
    }
  } catch (error) {
    console.error("关闭 Steam 失败:", error);
    app.quit();
  }
}

// getFileIcon("/home/deck/Games/Gal/ALcot - LOVEREC/LOVEREC.exe", 0);
