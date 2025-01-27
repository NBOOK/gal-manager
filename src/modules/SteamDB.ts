import GameEntry from "@/modules/GameEntry";
import { VdfMap } from "steam-binary-vdf";

class SteamDB {
  private static instance: SteamDB | null = null;

  //   private steamID: string = "";
  private steamShortcutPath: string = "";
  private steamGridPath: string = "";
  private steamLaunchOptionsPrefix: string = "";
  private vdf: VdfMap | null = null;
  linkLowRes: boolean = true;

  private steamGameIndices: Record<string, number> = {};

  private taskQueue: { action: "add" | "remove"; game: GameEntry }[] = [];
  private processing: boolean = false;

  constructor() {
    if (SteamDB.instance) {
      return SteamDB.instance;
    }
    SteamDB.instance = this;
  }

  async setup(config: any) {
    // this.steamID = config.steamID;
    this.steamShortcutPath = config.steamShortcutPath;
    this.steamGridPath = config.steamGridPath;
    this.linkLowRes = config.assetsLinkLowRes;
    this.steamLaunchOptionsPrefix = config.steamLaunchOptionsPrefix;

    this.vdf = await window.ipcRenderer.invoke(
      "readVdfFile",
      this.steamShortcutPath
    );
    if (this.vdf && this.vdf.shortcuts) {
      const shortcuts = this.vdf.shortcuts as Record<string, any>;
      Object.keys(shortcuts).forEach((key) => {
        const game = shortcuts[key];
        const gameNameEN = game.AppName;
        const steamGameIndex = parseInt(key, 10);
        this.steamGameIndices[gameNameEN] = steamGameIndex;
      });
    }
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
    const gameIndex: string = this.getGameIndex(game).toString();
    const appID = this.getAppID(game.gameNameEN);
    delete (this.vdf.shortcuts as Record<string, any>)[gameIndex];
    window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.vdf)
    );

    this.unlinkImageAssets(game, appID);

    delete this.steamGameIndices[game.gameNameEN];
  }

  async addGame(game: GameEntry) {
    this.taskQueue.push({ action: "add", game });
    this.processQueue(); // @TOCHECK should we await this?
  }

  private async _addGame(game: GameEntry) {
    if (!this.vdf) {
      return;
    }
    const gameIndex: string = this.getGameIndex(game).toString();
    const exePath = `"/usr/bin/flatpak"`;
    const startDir = `"/usr/bin"`;
    // const appID = await window.ipcRenderer.invoke('getAppID', (exePath + game.gameNameEN));
    const appID = this.getAppID(game.gameNameEN);

    const shortcut = {
      appid: appID, // @TOCHECK possibly not needed anymore, but can be used to identify assets names
      AppName: game.gameNameEN,
      Exe: exePath,
      StartDir: startDir,
      icon: game.imageAssets.iconPath,
      ShortcutPath: "",
      LaunchOptions: `${this.steamLaunchOptionsPrefix}${game.gameNameSlug}`,
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

    this.linkImageAssets(game, appID);

    this.steamGameIndices[game.gameNameEN] = parseInt(gameIndex, 10);
  }

  private getAppID(gameNameEN: string): number {
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
    const appID = (crc32Result | 0x80000000) >>> 0;
    return appID;
  }

  async linkImageAssets(game: GameEntry, appID?: number) {
    if (!this.vdf || !this.vdf.shortcuts || !this.inDB(game)) {
      return;
    }
    if (!appID) {
      const gameIndex: string = this.getGameIndex(game).toString(); // should get a valid index if inDB
      appID = (this.vdf.shortcuts as Record<string, any>)[gameIndex]
        .appid as number;
    }

    this.linkImage(game.imageAssets.logoPath, appID, "_logo");
    if (this.linkLowRes) {
      this.linkImage(game.imageAssets.headerSDPath, appID, "");
      this.linkImage(game.imageAssets.capsuleSDPath, appID, "p");
      this.linkImage(game.imageAssets.heroSDPath, appID, "_hero");
    } else {
      this.linkImage(game.imageAssets.headerPath, appID, "");
      this.linkImage(game.imageAssets.capsulePath, appID, "p");
      this.linkImage(game.imageAssets.heroPath, appID, "_hero");
    }
  }

  async unlinkImageAssets(game: GameEntry, appID?: number) {
    if (!this.vdf || !this.vdf.shortcuts || !this.inDB(game)) {
      return;
    }
    if (!appID) {
      const gameIndex: string = this.getGameIndex(game).toString(); // should get a valid index if inDB
      appID = (this.vdf.shortcuts as Record<string, any>)[gameIndex]
        .appid as number;
    }

    this.unlinkImage(game.imageAssets.logoPath, appID, "_logo");
    this.unlinkImage("dummy.json", appID, "");
    if (this.linkLowRes) {
      this.unlinkImage(game.imageAssets.headerSDPath, appID, "");
      this.unlinkImage(game.imageAssets.capsuleSDPath, appID, "p");
      this.unlinkImage(game.imageAssets.heroSDPath, appID, "_hero");
    } else {
      this.unlinkImage(game.imageAssets.headerPath, appID, "");
      this.unlinkImage(game.imageAssets.capsulePath, appID, "p");
      this.unlinkImage(game.imageAssets.heroPath, appID, "_hero");
    }
  }

  private linkImage(sourcePath: string, appID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${assetExtention}`;
    window.ipcRenderer.invoke("createSymbolicLink", sourcePath, targetPath);
  }

  private unlinkImage(sourcePath: string, appID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${assetExtention}`;
    window.ipcRenderer.invoke("removeSymbolicLink", targetPath);
  }

  private getGameIndex(game: GameEntry): number {
    // Return the index of the game in steamDB or largest steamDB index + 1
    // DON't use this function to check if the game is in steamDB
    if (!this.vdf || !this.vdf.shortcuts) {
      return -1;
    }
    // const launchOptions = this.steamLaunchOptionsPrefix + gameNameSlug;
    // const keys = Object.keys(this.vdf.shortcuts);
    // for (const key of keys) {
    //   if (
    //     (this.vdf.shortcuts as Record<string, any>)[key].AppName === gameNameEN
    //   ) {
    //     return key;
    //   }
    // }
    if (this.steamGameIndices[game.gameNameEN] !== undefined) {
      return this.steamGameIndices[game.gameNameEN];
    }
    const indices = Object.values(this.steamGameIndices);
    const largestIndex = indices.length > 0 ? Math.max(...indices) : 0;
    return largestIndex + 1;
  }

  inDB(game: GameEntry): boolean {
    if (!this.vdf || !this.vdf.shortcuts) {
      return false;
    }
    return this.steamGameIndices[game.gameNameEN] !== undefined;
  }
}

export default SteamDB;
