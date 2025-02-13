import GameEntry from "@/modules/GameEntry";
import { VdfMap } from "steam-binary-vdf";
import { Mutex } from "async-mutex";

class SteamDB {
  private static instance: SteamDB | null = null;

  //   private steamID: string = "";
  private steamShortcutPath: string = "";
  private steamControllerConfigPath: string = "";
  private steamControllerTemplatePath: string = "";
  private steamGridPath: string = "";
  private steamLaunchOptionsPrefix: string = "";
  private shortcutVDF: VdfMap | null = null;
  private controllerVDF: any | null = null;
  linkLowRes: boolean = true;
  controllerLayouts: string[] = [];

  private steamGameIndices: Record<string, number> = {};

  private mutex = new Mutex();

  // private taskQueue: { action: "add" | "remove"; game: GameEntry }[] = [];
  // private processing: boolean = false;

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
    this.steamControllerConfigPath = config.steamControllerConfigPath;
    this.steamControllerTemplatePath = config.steamControllerTemplatePath;

    this.shortcutVDF = await window.ipcRenderer.invoke(
      "readVdfFile",
      this.steamShortcutPath
    );
    if (this.shortcutVDF && this.shortcutVDF.shortcuts) {
      const shortcuts = this.shortcutVDF.shortcuts as Record<string, any>;
      Object.keys(shortcuts).forEach((key) => {
        const game = shortcuts[key];
        const gameNameEN = game.AppName;
        const steamGameIndex = parseInt(key, 10);
        this.steamGameIndices[gameNameEN] = steamGameIndex;
      });
    }
    this.controllerVDF = await window.ipcRenderer.invoke(
      "readVDF",
      this.steamControllerConfigPath
    );
    // console.log(this.controllerVDF);

    this.controllerLayouts = (
      await window.ipcRenderer.invoke(
        "scanDir",
        "<HOME>/.config/GalManager/controller_layouts"
      )
    )
      .filter(
        (item: DirEntry) => !item.isDirectory && item.name.endsWith(".vdf")
      )
      .map((item: DirEntry) => item.name);

    this.controllerLayouts.unshift("--");
  }

  async removeGame(game: GameEntry) {
    await this.mutex.runExclusive(async () => await this._removeGame(game));
  }

  private async _removeGame(game: GameEntry) {
    if (!this.shortcutVDF) {
      return;
    }
    const gameIndex: string = this.getGameIndex(game).toString();
    const appID = this.getAppID(game.gameNameEN);
    delete (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex];

    console.log("Writing VDF- file", this.steamShortcutPath, this.shortcutVDF);
    await window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.shortcutVDF)
    );
    console.log("VDF- file written");

    console.log("Unlinking image assets", game, appID);
    await this.unlinkImageAssets(game, appID);
    console.log("Image assets unlinked");

    delete this.steamGameIndices[game.gameNameEN];
  }

  async addGame(game: GameEntry, gameConfig: GameConfig) {
    // this.taskQueue.push({ action: "add", game });
    // this.processQueue(); // @TOCHECK should we await this?
    await this.mutex.runExclusive(
      async () => await this._addGame(game, gameConfig)
    );
  }

  private async _addGame(game: GameEntry, gameConfig: GameConfig) {
    if (!this.shortcutVDF || !this.controllerVDF) {
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

    (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex] = shortcut;

    console.log("Writing VDF+ file", this.steamShortcutPath, this.shortcutVDF);
    await window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.shortcutVDF)
    );
    console.log("VDF+ file written");

    console.log("Linking image assets", game, appID);
    await this.linkImageAssets(game, appID);
    console.log("Image assets linked");

    this.steamGameIndices[game.gameNameEN] = parseInt(gameIndex, 10);

    if (gameConfig.controllerLayout !== "--") {
      if (
        !(await window.ipcRenderer.invoke(
          "fileExists",
          `${this.steamControllerTemplatePath}/${gameConfig.controllerLayout}`
        ))
      ) {
        await window.ipcRenderer.invoke(
          "createSymbolicLink",
          `<HOME>/.config/GalManager/controller_layouts/${gameConfig.controllerLayout}`,
          `${this.steamControllerTemplatePath}/${gameConfig.controllerLayout}`
        );
      }
      this.controllerVDF["controller_config"][game.gameNameEN.toLowerCase()] = {
        template: gameConfig.controllerLayout,
      };
      await window.ipcRenderer.invoke(
        "writeVDF",
        this.steamControllerConfigPath,
        JSON.stringify(this.controllerVDF)
      );
    }
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
    console.log(`AppID for ${uniqueID}: ${appID}`);
    return appID;
  }

  async linkImageAssets(game: GameEntry, appID?: number) {
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return;
    }
    if (!appID) {
      const gameIndex: string = this.getGameIndex(game).toString(); // should get a valid index if inDB
      appID = (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex]
        .appid as number;
    }

    await this.linkImage(game.imageAssets.logoPath, appID, "_logo");
    if (this.linkLowRes) {
      await this.linkImage(game.imageAssets.headerSDPath, appID, "");
      await this.linkImage(game.imageAssets.capsuleSDPath, appID, "p");
      await this.linkImage(game.imageAssets.heroSDPath, appID, "_hero");
    } else {
      await this.linkImage(game.imageAssets.headerPath, appID, "");
      await this.linkImage(game.imageAssets.capsulePath, appID, "p");
      await this.linkImage(game.imageAssets.heroPath, appID, "_hero");
    }
  }

  private async unlinkImageAssets(game: GameEntry, appID?: number) {
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return;
    }
    if (!appID) {
      const gameIndex: string = this.getGameIndex(game).toString(); // should get a valid index if inDB
      appID = (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex]
        .appid as number;
    }

    await this.unlinkImage(game.imageAssets.logoPath, appID, "_logo");
    await this.unlinkImage("dummy.json", appID, "");
    if (this.linkLowRes) {
      await this.unlinkImage(game.imageAssets.headerSDPath, appID, "");
      await this.unlinkImage(game.imageAssets.capsuleSDPath, appID, "p");
      await this.unlinkImage(game.imageAssets.heroSDPath, appID, "_hero");
    } else {
      await this.unlinkImage(game.imageAssets.headerPath, appID, "");
      await this.unlinkImage(game.imageAssets.capsulePath, appID, "p");
      await this.unlinkImage(game.imageAssets.heroPath, appID, "_hero");
    }
  }

  private async linkImage(sourcePath: string, appID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${assetExtention}`;

    console.log(`${sourcePath} -> ${targetPath}`);
    await window.ipcRenderer.invoke(
      "createSymbolicLink",
      sourcePath,
      targetPath
    );
  }

  private async unlinkImage(sourcePath: string, appID: number, suffix: string) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${assetExtention}`;

    console.log(`[X] ${targetPath}`);
    await window.ipcRenderer.invoke("removeSymbolicLink", targetPath);
  }

  private getGameIndex(game: GameEntry): number {
    // Return the index of the game in steamDB or largest steamDB index + 1
    // DON't use this function to check if the game is in steamDB
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return -1;
    }
    // const launchOptions = this.steamLaunchOptionsPrefix + gameNameSlug;
    // const keys = Object.keys(this.shortcutVDF.shortcuts);
    // for (const key of keys) {
    //   if (
    //     (this.shortcutVDF.shortcuts as Record<string, any>)[key].AppName === gameNameEN
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
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return false;
    }
    return this.steamGameIndices[game.gameNameEN] !== undefined;
  }
}

export default SteamDB;
