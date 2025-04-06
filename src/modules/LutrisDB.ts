import GameEntry from "@/modules/GameEntry";
import { Mutex } from "async-mutex";

class LutrisDB {
  private static instance: LutrisDB | null = null;

  private lutrisGameConfigPath: string = "";
  private lutrisGameListPath: string = "";
  private lutrisDBPath: string = "";
  private lutrisIconPath: string = "";
  private lutrisBannerPath: string = "";
  private lutrisCoverPath: string = "";
  private wineRunnerPath: string = "";
  private winePrefixPath: string = "";
  wineRunners: string[] = [];
  winePrefixes: string[] = [];
  linkLowRes: boolean = true;

  private lutrisGameList: Record<string, string> = {}; // read cache game list
  private lutrisGameIndices: Record<string, number> = {};
  private lustrisPerGameConfigs: Record<string, any> = {}; // read game yaml config
  lutrisCategories: Record<string, number> = {}; // cat name to index

  private mutex = new Mutex();

  constructor() {
    if (LutrisDB.instance) {
      return LutrisDB.instance;
    }
    LutrisDB.instance = this;
  }

  async setup(config: any) {
    this.lutrisGameConfigPath = config.lutrisGameConfigPath;
    this.lutrisGameListPath = config.lutrisGameListPath;
    this.lutrisDBPath = config.lutrisDBPath;
    this.lutrisIconPath = config.lutrisIconPath;
    this.lutrisBannerPath = config.lutrisBannerPath;
    this.lutrisCoverPath = config.lutrisCoverPath;
    this.wineRunnerPath = config.wineRunnerPath;
    this.winePrefixPath = config.winePrefixPath;
    this.linkLowRes = config.assetsLinkLowRes;

    // get wine runners (folder name only)
    this.wineRunners = (
      await window.ipcRenderer.invoke("scanDir", this.wineRunnerPath)
    )
      .filter((item: DirEntry) => item.isDirectory)
      .map((item: DirEntry) => item.name)
      .sort((a: string, b: string) => {
        if (a.includes("latest") === b.includes("latest")) {
          return a.localeCompare(b);
        }
        return a.includes("latest") ? -1 : 1;
      });
    this.wineRunners.unshift("default");

    // get wine prefixes (folder name only)
    this.winePrefixes = (
      await window.ipcRenderer.invoke("scanDir", this.winePrefixPath)
    )
      .filter((item: DirEntry) => item.isDirectory)
      .map((item: DirEntry) => item.name)
      .sort((a: string, b: string) => {
        if (a.includes("ADV") === b.includes("ADV")) {
          return a.localeCompare(b);
        }
        return a.includes("ADV") ? -1 : 1;
      });

    // connect DB
    await window.ipcRenderer.invoke("sqliteDBOp", "connect", {
      dbPath: this.lutrisDBPath,
    });

    // load lutris game-paths.json
    this.lutrisGameList = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      this.lutrisGameListPath
    );
    // convert [{id: exePath}...] to {gameName: id}
    Object.keys(this.lutrisGameList).forEach((key) => {
      const path = this.lutrisGameList[key];
      const pathParts = path.split("/");
      const folderName = pathParts[pathParts.length - 2];
      const splitter = folderName.includes(" ‐ ") ? " ‐ " : " - ";
      const gameName = folderName.split(splitter).slice(1).join(splitter);
      const lutrisGameIndex = parseInt(key, 10);

      this.lutrisGameIndices[gameName] = lutrisGameIndex;
    });

    this.lutrisCategories = await window.ipcRenderer.invoke(
      "sqliteDBOp",
      "getCategories"
    );
  }

  async addGame(game: GameEntry, gameConfig: GameConfig) {
    // this.taskQueue.push({ action: "remove", game });
    // this.processQueue(); // @TOCHECK should we await this?
    await this.mutex.runExclusive(
      async () => await this._addGame(game, gameConfig)
    );
  }

  async removeGame(game: GameEntry) {
    await this.mutex.runExclusive(async () => await this._removeGame(game));
  }

  private async _addGame(game: GameEntry, gameConfig: GameConfig) {
    console.log("Adding: ", game, gameConfig);
    const timestamp: number = Math.floor(Date.now() / 1000);
    const exePath = `${game.basePath}/${game.folderName}/${gameConfig.executable}`;
    const lutrisPerGameConfig: {
      game_brand: string;
      name: string;
      game_slug: string;
      year?: string;
      game: { exe: string; prefix: string };
      system: { locale: string };
      wine?: { version: string };
    } = {
      game_brand: gameConfig.gameBrandEN,
      name: gameConfig.gameNameEN,
      game_slug: gameConfig.gameNameSlug,
      game: {
        exe: exePath,
        prefix: `${this.winePrefixPath}/${gameConfig.winePrefix}`,
      },
      system: { locale: gameConfig.locale },
    };
    if (gameConfig.wineRunner !== "default") {
      lutrisPerGameConfig.wine = { version: gameConfig.wineRunner };
    }
    if (gameConfig.gameReleaseYear) {
      lutrisPerGameConfig.year = gameConfig.gameReleaseYear;
    }

    // -------------------- save per game config --------------------
    console.log("Saving pergame config: ", lutrisPerGameConfig);
    await window.ipcRenderer.invoke(
      "saveYamlConfig",
      JSON.stringify(lutrisPerGameConfig),
      `${this.lutrisGameConfigPath}/${gameConfig.gameNameSlug}-${timestamp}.yml`
    );
    this.lustrisPerGameConfigs[game.gameName] = lutrisPerGameConfig;
    console.log("Per game config saved");

    // -------------------- update lutris game-paths.json --------------------
    console.log("Updating game list");
    const lutrisGameIndex = this.getGameIndex(game);
    this.lutrisGameIndices[game.gameName] = lutrisGameIndex;
    this.lutrisGameList[lutrisGameIndex.toString()] = exePath;
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify(this.lutrisGameList),
      this.lutrisGameListPath
    );
    console.log("Game list updated");

    // -------------------- update lutrisDB --------------------
    console.log("Updating lutrisDB+");
    await window.ipcRenderer.invoke("sqliteDBOp", "insertGame", {
      gameNameEN: gameConfig.gameNameEN,
      gameNameSlug: gameConfig.gameNameSlug,
      lutrisGameIndex: lutrisGameIndex,
      timestamp: timestamp,
      year: gameConfig.gameReleaseYear,
    });
    console.log("lutrisDB updated+");

    // -------------------- link images, not awaiting is OK --------------------
    console.log("Linking images");
    await this.linkImageAssets(game, gameConfig);
    console.log("Images linked");

    // -------------------- update lutrisDB Categories --------------------
    console.log("Updating lutrisDB Categories");
    console.log("lutrisCategories: ", this.lutrisCategories);
    console.log("gameConfig.lutrisCategories: ", gameConfig.lutrisCategories);
    const lutrisCategoryIndeces = gameConfig.lutrisCategories.map(
      (category) => this.lutrisCategories[category]
    );
    console.log("lutrisCategoryIndeces: ", lutrisCategoryIndeces);
    await window.ipcRenderer.invoke("sqliteDBOp", "setGameCategories", {
      lutrisGameIndex: lutrisGameIndex,
      lutrisCategoryIndeces: JSON.stringify(lutrisCategoryIndeces),
    });
    console.log("lutrisDB Categories updated");
  }

  private async linkImageAssets(game: GameEntry, gameConfig: GameConfig) {
    await window.ipcRenderer.invoke(
      "createSymbolicLink",
      game.imageAssets.iconPath,
      `${this.lutrisIconPath}/lutris_${gameConfig.gameNameSlug}.png` // icon has lutris_ prefix and is always png
    );
    if (this.linkLowRes) {
      await window.ipcRenderer.invoke(
        "createSymbolicLink",
        game.imageAssets.capsuleSDPath,
        `${this.lutrisCoverPath}/${gameConfig.gameNameSlug}.jpg` // extention doesn't matter here
      );
      await window.ipcRenderer.invoke(
        "createSymbolicLink",
        game.imageAssets.headerSDPath,
        `${this.lutrisBannerPath}/${gameConfig.gameNameSlug}.jpg`
      );
    } else {
      await window.ipcRenderer.invoke(
        "createSymbolicLink",
        game.imageAssets.capsulePath,
        `${this.lutrisCoverPath}/${gameConfig.gameNameSlug}.jpg` // extention doesn't matter here
      );
      await window.ipcRenderer.invoke(
        "createSymbolicLink",
        game.imageAssets.headerPath,
        `${this.lutrisBannerPath}/${gameConfig.gameNameSlug}.jpg`
      );
    }
  }

  private async _removeGame(game: GameEntry) {
    console.log("Removing: ", game);
    const lutrisGameIndex = this.getGameIndex(game);
    const perGameConfigName = (await this.getGameConfig(game)).gameConfigName;

    // remove per game config
    console.log("Removing per game config");
    await window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.lutrisGameConfigPath}/${perGameConfigName}.yml`
    );
    delete this.lustrisPerGameConfigs[game.gameName];
    console.log("Per game config removed");

    // update lutris game-paths.json
    console.log("Updating game list");
    delete this.lutrisGameIndices[game.gameName];
    delete this.lutrisGameList[lutrisGameIndex.toString()];
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify(this.lutrisGameList),
      this.lutrisGameListPath
    );
    console.log("Game list updated");

    // update lutrisDB
    console.log("Updating lutrisDB-");
    await window.ipcRenderer.invoke("sqliteDBOp", "deleteGame", {
      lutrisGameIndex: lutrisGameIndex,
    });
    console.log("lutrisDB- updated");

    // unlink images, not awaiting is OK
    console.log("Unlinking images");
    await window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.lutrisCoverPath}/${game.gameNameSlug}.jpg`
    );
    await window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.lutrisBannerPath}/${game.gameNameSlug}.jpg`
    );
    await window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.lutrisIconPath}/lutris_${game.gameNameSlug}.png`
    );
    console.log("Images unlinked");

    // update lutrisDB Categories
    await window.ipcRenderer.invoke("sqliteDBOp", "setGameCategories", {
      lutrisGameIndex: lutrisGameIndex,
      lutrisCategoryIndeces: JSON.stringify([]),
    });
  }

  inDB(game: GameEntry): boolean {
    return this.lutrisGameIndices[game.gameName] !== undefined;
  }

  getGameIndex(game: GameEntry): number {
    // Return the index of the game in lutrisDB or largest lutrisDB index + 1
    // DON't use this function to check if the game is in lutrisDB

    if (this.lutrisGameIndices[game.gameName] !== undefined) {
      return this.lutrisGameIndices[game.gameName];
    }
    const indices = Object.values(this.lutrisGameIndices);
    const largestIndex = indices.length > 0 ? Math.max(...indices) : 0;
    return largestIndex + 1;
  }

  async getGameConfig(game: GameEntry): Promise<Record<string, string>> {
    if (!this.inDB(game)) {
      return {};
    }
    const lutrisGameIndex = this.getGameIndex(game);
    const gameProperties = await window.ipcRenderer.invoke(
      "sqliteDBOp",
      "queryGame",
      {
        lutrisGameIndex: lutrisGameIndex,
      }
    );

    if (
      gameProperties.gameConfigName &&
      !this.lustrisPerGameConfigs[game.gameName]
    ) {
      const pergameConfig = await window.ipcRenderer.invoke(
        "fetchYamlConfig",
        `${this.lutrisGameConfigPath}/${gameProperties.gameConfigName}.yml`
      );
      this.lustrisPerGameConfigs[game.gameName] = pergameConfig;
      if (pergameConfig.game_brand) {
        gameProperties.gameBrandEN = pergameConfig.game_brand;
      }
    }
    return gameProperties;
  }

  getCachedGameConfig(game: GameEntry): Record<string, any> {
    return this.lustrisPerGameConfigs[game.gameName];
  }

  async categoriesForGame(game: GameEntry): Promise<string[]> {
    if (!this.inDB(game)) {
      return [];
    }
    const lutrisGameIndex = this.getGameIndex(game);
    const categories = (await window.ipcRenderer.invoke(
      "sqliteDBOp",
      "getGameCategories",
      {
        lutrisGameIndex: lutrisGameIndex,
      }
    )) as { id: number; name: string }[];
    return categories.map((category) => category.name);
  }
}

export default LutrisDB;
