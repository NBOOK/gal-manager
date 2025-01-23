import GameEntry from "./GameEntry";
import { VdfMap } from "steam-binary-vdf";

class SteamDB {
  private static instance: SteamDB | null = null;

  private steamID: string = "";
  private steamShortcutPath: string = "";
  private steamGridPath: string = "";
  private steamLaunchOptionsPrefix: string = "";
  private vdf: VdfMap | null = null;
  linkLowRes: boolean = true;

  private taskQueue: { action: "add" | "remove"; game: GameEntry }[] = [];
  private processing: boolean = false;

  constructor() {
    if (SteamDB.instance) {
      return SteamDB.instance;
    }
    SteamDB.instance = this;
  }

  async setup(config: any) {
    this.steamID = config.steamID;
    this.steamShortcutPath = config.steamShortcutPath;
    this.steamGridPath = config.steamGridPath;
    this.linkLowRes = config.assetsLinkLowRes;
    this.steamLaunchOptionsPrefix = config.steamLaunchOptionsPrefix;

    this.vdf = await window.ipcRenderer.invoke(
      "readVdfFile",
      this.steamShortcutPath
    );
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }
    this.processing = true;
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      if (task.action === "add") {
        await this._addGame(task.game);
      } else if (task.action === "remove") {
        await this._removeGame(task.game);
      }
    }
    this.processing = false;
  }

  async removeGame(game: GameEntry) {
    this.taskQueue.push({ action: "remove", game });
    this.processQueue(); // @TOCHECK should we await this?
  }

  private async _removeGame(game: GameEntry) {
    if (!this.vdf) {
      return;
    }
    const gameIndex = this.getGameIndex(game.gameNameSlug);
    const gameID = this.getGameID(game.gameNameEN);
    delete (this.vdf.shortcuts as Record<string, any>)[gameIndex];
    window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.vdf)
    );

    this.unlinkImage(game.imageAssets.logoPath, gameID, "_logo");
    this.unlinkImage("dummy.json", gameID, "");
    if (this.linkLowRes) {
      this.unlinkImage(game.imageAssets.headerSDPath, gameID, "");
      this.unlinkImage(game.imageAssets.capsuleSDPath, gameID, "p");
      this.unlinkImage(game.imageAssets.heroSDPath, gameID, "_hero");
    } else {
      this.unlinkImage(game.imageAssets.headerPath, gameID, "");
      this.unlinkImage(game.imageAssets.capsulePath, gameID, "p");
      this.unlinkImage(game.imageAssets.heroPath, gameID, "_hero");
    }
  }

  async addGame(game: GameEntry) {
    this.taskQueue.push({ action: "add", game });
    this.processQueue(); // @TOCHECK should we await this?
  }

  private async _addGame(game: GameEntry) {
    if (!this.vdf) {
      return;
    }
    const gameIndex = this.getGameIndex(game.gameNameSlug);
    const exePath = `"/usr/bin/flatpak"`;
    const startDir = `"/usr/bin"`;
    // const gameID = await window.ipcRenderer.invoke('getGameID', (exePath + game.gameNameEN));
    const gameID = this.getGameID(game.gameNameEN);

    const shortcut = {
      appid: gameID, // @TOCHECK possibly not needed anymore
      AppName: game.gameNameEN,
      Exe: exePath,
      StartDir: startDir,
      icon: game.imageAssets.iconPath,
      ShortcutPath: "",
      LaunchOptions: `run net.lutris.Lutris lutris:rungame/${game.gameNameSlug}`,
      IsHidden: 0,
      AllowDesktopConfig: 1,
      AllowOverlay: 1,
      openvr: 0,
      Devkit: 0,
      DevkitGameID: "",
      LastPlayTime: "",
      tags: {}, // tags are are now stored in localconfig.vdf and this field is ignored
    };

    (this.vdf.shortcuts as Record<string, any>)[gameIndex] = shortcut;

    window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.vdf)
    );

    this.linkImage(game.imageAssets.logoPath, gameID, "_logo");
    if (this.linkLowRes) {
      this.linkImage(game.imageAssets.headerSDPath, gameID, "");
      this.linkImage(game.imageAssets.capsuleSDPath, gameID, "p");
      this.linkImage(game.imageAssets.heroSDPath, gameID, "_hero");
    } else {
      this.linkImage(game.imageAssets.headerPath, gameID, "");
      this.linkImage(game.imageAssets.capsulePath, gameID, "p");
      this.linkImage(game.imageAssets.heroPath, gameID, "_hero");
    }
  }

  private getGameID(gameNameEN: string): number {
    const exe = "/usr/bin/flatpak";
    const uniqueID = exe + gameNameEN;
    const encoder = new TextEncoder();
    const data = encoder.encode(uniqueID);

    function crc32(buf: Uint8Array): number {
      const table = Array.from({ length: 256 }, (_, k) => {
        let c = k;
        for (let j = 0; j < 8; j++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        return c >>> 0;
      });

      let crc = 0xffffffff;
      for (const byte of buf) {
        crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
      }

      return (crc ^ 0xffffffff) >>> 0;
    }

    const crc32Result = crc32(data);
    const gameID = (crc32Result | 0x80000000) >>> 0;
    return gameID;
  }

  private linkImage(sourcePath: string, gameID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${gameID}${suffix}.${assetExtention}`;
    window.ipcRenderer.invoke("createSymbolicLink", sourcePath, targetPath);
  }

  private unlinkImage(sourcePath: string, gameID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${gameID}${suffix}.${assetExtention}`;
    window.ipcRenderer.invoke("removeSymbolicLink", targetPath);
  }

  private getGameIndex(gameNameSlug: string): string {
    if (!this.vdf || !this.vdf.shortcuts) {
      return "0";
    }
    const launchOptions = this.steamLaunchOptionsPrefix + gameNameSlug;
    const keys = Object.keys(this.vdf.shortcuts);
    for (const key of keys) {
      if (
        (this.vdf.shortcuts as Record<string, any>)[key].LaunchOptions ===
        launchOptions
      ) {
        return key;
      }
    }

    const largestIndex = keys.length > 0 ? Math.max(...keys.map(Number)) : 0;
    return (largestIndex + 1).toString();
  }

  inDB(gameNameSlug: string): boolean {
    if (!this.vdf || !this.vdf.shortcuts) {
      return false;
    }
    const launchOptions = this.steamLaunchOptionsPrefix + gameNameSlug;
    const keys = Object.keys(this.vdf.shortcuts);
    for (const key of keys) {
      if (
        (this.vdf.shortcuts as Record<string, any>)[key].LaunchOptions ===
        launchOptions
      ) {
        return true;
      }
    }
    return false;
  }
}

export default SteamDB;
