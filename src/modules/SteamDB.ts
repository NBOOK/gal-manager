import GameEntry from "@/modules/GameEntry";
import { VdfMap } from "steam-binary-vdf";
import { Mutex } from "async-mutex";
import { useGameStore } from "@/store/global-store";
let gameStore: ReturnType<typeof useGameStore>;

export function steamDBSetStore() {
  if (!gameStore) {
    gameStore = useGameStore();
  }
}

class SteamDB {
  // paths, ID
  private static instance: SteamDB | null = null;
  private steamShortcutPath: string = "";
  private steamControllerConfigPath: string = "";
  private steamControllerTemplatePath: string = "";
  private steamLocalConfigPath: string = "";
  private steamOnlineCategoryPath: string = "";
  private steamGridPath: string = "";
  // private steamLaunchOptionsPrefix: string = "";
  linkLowRes: boolean = true;
  private mutex = new Mutex();

  // fetched
  private shortcutVDF: VdfMap | null = null;
  private controllerVDF: any | null = null;
  private steamCategories: SteamCategory[] = []; // get cat name and ID from level db
  private localConfigVDF: Record<string, any> = {};

  // derived
  private steamGameIndices: Record<string, number> = {};
  private steamGameLaunchers: Record<string, string> = {}; // map gameNameEN to launcher name (Lutris/Heroic)
  controllerLayouts: string[] = [];
  private steamCategoryIDs: Record<string, string> = {}; // map cat name to ID
  private nonSteamCategories: any = {};

  get steamCategoriesNames(): string[] {
    return Object.keys(this.steamCategoryIDs);
  }

  constructor() {
    if (SteamDB.instance) {
      return SteamDB.instance;
    }
    SteamDB.instance = this;
  }

  async setup(config: any) {
    this.steamShortcutPath = config.steam.shortcutPath;
    this.steamGridPath = config.steam.gridPath;
    this.linkLowRes = config.assetsLinkLowRes;
    this.steamControllerConfigPath = config.steam.controllerConfigPath;
    this.steamControllerTemplatePath = config.steam.controllerTemplatePath;
    this.steamLocalConfigPath = config.steam.localConfigPath;
    this.steamOnlineCategoryPath = config.steam.onlineCategoryPath;

    // ------- Shortcut VDF -------
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

        const launchOptions = game.LaunchOptions.replace('"', "");
        if (launchOptions.includes(config.lutris.steamLaunchOptions)) {
          this.steamGameLaunchers[gameNameEN] = "Lutris";
        } else if (launchOptions.includes(config.heroic.steamLaunchOptions)) {
          this.steamGameLaunchers[gameNameEN] = "Heroic";
        } else {
          this.steamGameLaunchers[gameNameEN] = "Unknown";
        }
      });
    }

    // ------- Controller VDF -------
    this.controllerVDF = await window.ipcRenderer.invoke(
      "readVDF",
      `${this.steamControllerConfigPath}/configset_controller_neptune.vdf`
    );
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

    // ------- Steam Categories -------
    this.steamCategories = await window.ipcRenderer.invoke(
      "getSteamCategories",
      this.steamOnlineCategoryPath
    );
    this.steamCategories.forEach((category) => {
      this.steamCategoryIDs[category.name] = category.id;
    });
    this.localConfigVDF = await window.ipcRenderer.invoke(
      "readVDF",
      this.steamLocalConfigPath
    );

    this.nonSteamCategories = JSON.parse(
      this.localConfigVDF.UserLocalConfigStore.WebStorage[
        "user-collections"
      ].replace(/\\\"/g, '"')
    );
    console.log("nonSteamCategories", this.nonSteamCategories);
  }

  async removeGame(game: GameEntry, reAdd: boolean = false) {
    await this.mutex.runExclusive(
      async () => await this._removeGame(game, reAdd)
    );
  }

  private async _removeGame(game: GameEntry, reAdd: boolean = false) {
    // ---------- Remove game shortcut ----------
    if (!this.shortcutVDF) {
      return;
    }
    const gameIndex: string = this.getGameIndex(game).toString();
    const appID = this.getAppID(game.gameNameEN);
    delete (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex];

    console.log("Writing VDF file", this.steamShortcutPath, this.shortcutVDF);
    await window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.shortcutVDF)
    );
    console.log("VDF- file written");

    // ---------- Unlink image assets ----------
    console.log("Unlinking image assets", game, appID);
    await this.unlinkImageAssets(game, appID);
    console.log("Image assets unlinked");

    delete this.steamGameIndices[game.gameNameEN];

    // ---------- Remove game controller config ----------
    const layoutEntryName = game.gameNameEN
      .toLowerCase()
      .replace(/[\/~:.*?"]/g, "")
      .substring(0, 64);
    console.log("layoutEntryName", layoutEntryName);
    // skip deletion if not re-adding
    if (!reAdd && this.controllerVDF["controller_config"][layoutEntryName]) {
      console.log(
        `Removing controller config for ${game.gameNameEN}, layout: ${layoutEntryName}`
      );
      delete this.controllerVDF["controller_config"][layoutEntryName];
      await window.ipcRenderer.invoke(
        "writeVDF",
        `${this.steamControllerConfigPath}/configset_controller_neptune.vdf`,
        JSON.stringify(this.controllerVDF)
      );
      const nonTemplatePath = `${this.steamControllerConfigPath}/${layoutEntryName}`;
      if (await window.ipcRenderer.invoke("fileExists", nonTemplatePath)) {
        await window.ipcRenderer.invoke("removeItem", nonTemplatePath);
      }
    }

    // ---------- Remove game categories ----------
    if (this.categoriesForGame(appID).length > 0) {
      for (const categoryName of this.categoriesForGame(appID)) {
        const categoryID = this.steamCategoryIDs[categoryName];
        if (!categoryID) {
          console.error(`Category ${categoryName} not found in SteamDB`);
          continue;
        }
        console.log(
          `Removing ${game.gameNameEN} from category ${categoryName}, ID: ${categoryID}`
        );
        const category = this.nonSteamCategories[categoryID];
        category.added = category.added.filter((id: number) => id !== appID);

        this.localConfigVDF.UserLocalConfigStore.WebStorage[
          "user-collections"
        ] = JSON.stringify(this.nonSteamCategories).replace(/"/g, `\\"`);
        await window.ipcRenderer.invoke(
          "writeVDF",
          this.steamLocalConfigPath,
          JSON.stringify(this.localConfigVDF)
        );
      }
    }

    delete this.steamGameLaunchers[game.gameNameEN];
  }

  async addGame(game: GameEntry, gameConfig: GameConfig) {
    await this.mutex.runExclusive(
      async () => await this._addGame(game, gameConfig)
    );
  }

  private async _addGame(game: GameEntry, gameConfig: GameConfig) {
    // ---------- Add game shortcut ----------
    if (!this.shortcutVDF || !this.controllerVDF) {
      return;
    }
    const gameIndex: string = this.getGameIndex(game).toString();
    let exePath = "";
    let startDir = "";
    let launchOptions = "";
    const appID = this.getAppID(game.gameNameEN);

    if (gameConfig.launcher === "Lutris") {
      exePath = gameStore.config.value.lutris.steamTargetPath;
      startDir = gameStore.config.value.lutris.steamStartIn;
      launchOptions =
        gameStore.config.value.lutris.steamLaunchOptions + game.gameNameSlug;
    } else if (gameConfig.launcher === "Heroic") {
      exePath = gameStore.config.value.heroic.steamTargetPath;
      startDir = gameStore.config.value.heroic.steamStartIn;
      launchOptions =
        gameStore.config.value.heroic.steamLaunchOptions + game.gameNameSlug;
    } else {
      throw new Error("Invalid launcher");
    }
    this.steamGameLaunchers[game.gameNameEN] = gameConfig.launcher;

    const shortcut = {
      appid: appID, // @TOCHECK possibly not needed anymore, but can be used to identify assets names
      AppName: game.gameNameEN,
      Exe: exePath,
      StartDir: startDir,
      icon: game.imageAssets.paths.icon,
      ShortcutPath: "",
      LaunchOptions: launchOptions,
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

    console.log("Writing VDF file", this.steamShortcutPath, this.shortcutVDF);
    await window.ipcRenderer.invoke(
      "writeVdfFile",
      this.steamShortcutPath,
      JSON.stringify(this.shortcutVDF)
    );
    console.log("VDF file written");

    // ---------- Link image assets ----------
    console.log("Linking image assets", game, appID);
    await this.linkImageAssets(game, appID);
    console.log("Image assets linked");

    this.steamGameIndices[game.gameNameEN] = parseInt(gameIndex, 10);

    // ---------- Add game controller config ----------
    const layoutEntryName = game.gameNameEN
      .toLowerCase()
      .replace(/[\/~:.*?"]/g, "")
      .substring(0, 64);
    // skip addition if layout is not provided or already set in Steam
    if (
      gameConfig.controllerLayout !== "--" &&
      !this.controllerVDF["controller_config"][layoutEntryName]
    ) {
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
      this.controllerVDF["controller_config"][layoutEntryName] = {
        template: gameConfig.controllerLayout,
      };
      await window.ipcRenderer.invoke(
        "writeVDF",
        `${this.steamControllerConfigPath}/configset_controller_neptune.vdf`,
        JSON.stringify(this.controllerVDF)
      );
    }

    // ---------- Add game categories ----------
    if (gameConfig.steamCategories.length > 0) {
      for (const categoryName of gameConfig.steamCategories) {
        const categoryID = this.steamCategoryIDs[categoryName];
        if (!categoryID) {
          console.error(`Category ${categoryName} not found in SteamDB`);
          continue;
        }
        console.log(
          `Adding ${game.gameNameEN} to category ${categoryName}, ID: ${categoryID}`
        );
        const category = this.nonSteamCategories[categoryID];
        console.log("category", category);
        if (!category.added.includes(appID)) {
          category.added.push(appID);
        }
      }
      this.localConfigVDF.UserLocalConfigStore.WebStorage["user-collections"] =
        JSON.stringify(this.nonSteamCategories).replace(/"/g, `\\"`);
      await window.ipcRenderer.invoke(
        "writeVDF",
        this.steamLocalConfigPath,
        JSON.stringify(this.localConfigVDF)
      );
    }
  }

  getAppID(gameOrGameNameSlug: GameEntry | string): number {
    let gameNameSlug: string;
    if (typeof gameOrGameNameSlug === "string") {
      gameNameSlug = gameOrGameNameSlug;
    } else {
      gameNameSlug = gameOrGameNameSlug.gameNameSlug;
    }
    const uniqueID = gameNameSlug;
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

    // even if logo source file is .webp, we force png extension for logo to be compatible with Steam
    await this.linkImage(game.imageAssets.paths.logo, appID, "_logo", "png");
    if (this.linkLowRes) {
      await this.linkImage(game.imageAssets.paths.headerSD, appID, "");
      await this.linkImage(game.imageAssets.paths.capsuleSD, appID, "p");
      await this.linkImage(game.imageAssets.paths.heroSD, appID, "_hero");
    } else {
      await this.linkImage(game.imageAssets.paths.header, appID, "");
      await this.linkImage(game.imageAssets.paths.capsule, appID, "p");
      await this.linkImage(game.imageAssets.paths.hero, appID, "_hero");
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

    // even if logo source file is .webp, we force png extension for logo to be compatible with Steam
    await this.unlinkImage(game.imageAssets.paths.logo, appID, "_logo", "png");
    await this.unlinkImage("dummy.json", appID, "");
    if (this.linkLowRes) {
      await this.unlinkImage(game.imageAssets.paths.headerSD, appID, "");
      await this.unlinkImage(game.imageAssets.paths.capsuleSD, appID, "p");
      await this.unlinkImage(game.imageAssets.paths.heroSD, appID, "_hero");
    } else {
      await this.unlinkImage(game.imageAssets.paths.header, appID, "");
      await this.unlinkImage(game.imageAssets.paths.capsule, appID, "p");
      await this.unlinkImage(game.imageAssets.paths.hero, appID, "_hero");
    }
  }

  private async linkImage(
    sourcePath: string,
    appID: number,
    suffix: string,
    extension: string = ""
  ) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${
      extension || assetExtention
    }`;

    console.log(`${sourcePath} -> ${targetPath}`);
    await window.ipcRenderer.invoke(
      "createSymbolicLink",
      sourcePath,
      targetPath
    );
  }

  private async unlinkImage(
    sourcePath: string,
    appID: number,
    suffix: string,
    extension: string = ""
  ) {
    const assetExtention = sourcePath.split(".").pop();
    const targetPath = `${this.steamGridPath}/${appID}${suffix}.${
      extension || assetExtention
    }`;

    console.log(`[X] ${targetPath}`);
    await window.ipcRenderer.invoke("removeSymbolicLink", targetPath);
  }

  private getGameIndex(game: GameEntry): number {
    // Return the index of the game in steamDB or largest steamDB index + 1
    // DON't use this function to check if the game is in steamDB
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return -1;
    }

    if (this.steamGameIndices[game.gameNameEN] !== undefined) {
      return this.steamGameIndices[game.gameNameEN];
    }
    const indices = Object.values(this.steamGameIndices);
    const largestIndex = indices.length > 0 ? Math.max(...indices) : 0;
    return largestIndex + 1;
  }

  gameLauncher(game: GameEntry): string {
    return this.steamGameLaunchers[game.gameNameEN] || "Unknown";
  }

  inDB(game: GameEntry): boolean {
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return false;
    }
    return this.steamGameIndices[game.gameNameEN] !== undefined;
  }

  categoriesForGame(gameOrAppID: GameEntry | number): string[] {
    if (!this.shortcutVDF || !this.shortcutVDF.shortcuts) {
      return [];
    }
    const categories: string[] = [];

    let appID: number;
    if (typeof gameOrAppID === "number") {
      appID = gameOrAppID;
    } else {
      const gameIndex = this.getGameIndex(gameOrAppID).toString();
      const shortcut = (this.shortcutVDF.shortcuts as Record<string, any>)[
        gameIndex
      ];
      if (shortcut) {
        appID = (this.shortcutVDF.shortcuts as Record<string, any>)[gameIndex]
          .appid as number;
      } else {
        appID = this.getAppID(gameOrAppID.gameNameEN);
      }
    }

    for (const [categoryName, categoryID] of Object.entries(
      this.steamCategoryIDs
    )) {
      // console.log("categoryName and categoryID", categoryName, categoryID);
      const category = this.nonSteamCategories[categoryID];
      if (category && category.added && category.added.includes(appID)) {
        categories.push(categoryName);
      }
    }
    return categories;
  }
}

export default SteamDB;
