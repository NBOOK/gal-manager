import GameEntry from "@/modules/GameEntry";
import { Mutex } from "async-mutex";
// import { useGameStore } from "@/store/global-store";
// let gameStore: ReturnType<typeof useGameStore>;

// export function heroicDBSetStore() {
//   if (!gameStore) {
//     gameStore = useGameStore();
//   }
// }

class HeroicDB {
  private static instance: HeroicDB | null = null;

  private heroicGameConfigPath: string = "";
  private heroicGameListPath: string = "";
  private heroicConfigPath: string = "";
  private wineRunnerPath: string = "";
  private winePrefixPath: string = "";
  wineRunners: string[] = [];
  winePrefixes: string[] = [];
  linkLowRes: boolean = true;

  private heroicGameList: Record<string, any> = {};
  heroicPerGameConfigs: Record<string, any> = {};
  heroicCategories: Record<string, string[]> = {};

  private mutex = new Mutex();

  constructor() {
    if (HeroicDB.instance) {
      return HeroicDB.instance;
    }
    HeroicDB.instance = this;
  }

  async setup(config: any) {
    this.heroicGameConfigPath = config.heroic.gameConfigPath;
    this.heroicGameListPath = config.heroic.gameListPath;
    this.heroicConfigPath = config.heroic.configPath;
    this.wineRunnerPath = config.wineRunnerPath;
    this.winePrefixPath = config.winePrefixPath;
    this.linkLowRes = config.assetsLinkLowRes;

    // get heroic wineRunners (folder name only)
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

    // get wine winePrefixes (folder name only)
    this.winePrefixes = (
      await window.ipcRenderer.invoke("scanDir", this.winePrefixPath)
    )
      .filter((item: DirEntry) => item.isDirectory)
      .map((item: DirEntry) => item.name);
    this.winePrefixes.unshift("default");

    // load heroic game-paths.json
    const heroicGameList = (
      await window.ipcRenderer.invoke(
        "fetchJsonConfig",
        this.heroicGameListPath
      )
    ).games;

    // convert [{xxx}, {xxx}, ...] to {gameName: {xxx}, ...}
    heroicGameList.forEach((obj: any) => {
      const path = obj.folder_name;
      const pathParts = path.split("/");
      const folderName = pathParts[pathParts.length - 1];
      const splitter = folderName.includes(" ‐ ") ? " ‐ " : " - ";
      const gameName = folderName.split(splitter).slice(1).join(splitter);
      this.heroicGameList[gameName] = obj;
    });

    const heroicConfig = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      this.heroicConfigPath
    );
    this.heroicCategories = heroicConfig.games.customCategories;
  }

  async addGame(game: GameEntry, gameConfig: GameConfig) {
    await this.mutex.runExclusive(
      async () => await this._addGame(game, gameConfig)
    );
  }

  async removeGame(game: GameEntry) {
    await this.mutex.runExclusive(async () => await this._removeGame(game));
  }

  private async _addGame(game: GameEntry, gameConfig: GameConfig) {
    console.log("Adding to Heroic: ", game, gameConfig);
    const folderPath = `${game.basePath}/${game.folderName}`;
    const exePath = `${folderPath}/${gameConfig.executable}`;

    // add game to library
    const heroicGameInfo: Record<string, any> = {
      runner: "sideload",
      app_name: gameConfig.gameNameSlug,
      title: gameConfig.gameNameEN,
      brand: gameConfig.gameBrandEN,
      install: {
        executable: exePath,
        platform: gameConfig.platform === "Windows" ? "Windows" : "linux", // lowercase linux
      },
      folder_name: folderPath,
      is_installed: true,
      art_cover: this.linkLowRes
        ? game.imageAssets.paths.headerSD
        : game.imageAssets.paths.header,
      art_square: this.linkLowRes
        ? game.imageAssets.paths.capsuleSD
        : game.imageAssets.paths.capsule,
    };
    if (gameConfig.gameReleaseYear) {
      heroicGameInfo.year = parseInt(gameConfig.gameReleaseYear);
    }
    this.heroicGameList[gameConfig.gameName] = heroicGameInfo;
    const updatedHeroicGameList = Object.values(this.heroicGameList);
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify({ games: updatedHeroicGameList }),
      this.heroicGameListPath
    );
    console.log("Game added to heroic liabrary.");

    // -------------------- save per game config --------------------
    console.log("Saving pergame config: ", game);

    const heroicPerGameConfig: Record<string, any> = {
      [game.gameNameSlug]: {},
    };
    if (gameConfig.heroicRunner !== "default") {
      let runnerType = gameConfig.heroicRunner.split("-")[0]; // Proton | Wine
      const runner = gameConfig.heroicRunner; //.split("-").slice(1).join("-");
      const runnerName = `${runnerType} - ${runner}`;
      const wineVersion: Record<string, any> = {
        type: runnerType.toLowerCase(), // "proton" | "wine"
        name: runnerName,
      };
      if (runnerType === "Wine") {
        wineVersion.bin = `${this.wineRunnerPath}/${runner}/bin/wine`;
        wineVersion.lib32 = `${this.wineRunnerPath}/${runner}/lib`;
        wineVersion.wineserver = `${this.wineRunnerPath}/${runner}/bin/wineserver`;
      } else if (runnerType === "Proton") {
        wineVersion.bin = `${this.wineRunnerPath}/${runner}/proton`;
      } else {
        throw new Error(`Unknown runner type: ${runnerType}`);
      }
      heroicPerGameConfig[game.gameNameSlug].wineVersion = wineVersion;
    }
    if (gameConfig.heroicPrefix !== "default") {
      heroicPerGameConfig[
        game.gameNameSlug
      ].winePrefix = `${this.winePrefixPath}/${gameConfig.heroicPrefix}`;
    }
    if (gameConfig.locale !== "ja_JP.utf8") {
      const env_locale = { key: "LANG", value: gameConfig.locale };
      // check heroicPerGameConfig[game.gameNameSlug].enviromentOptions (should be a list of objects)
      if (!heroicPerGameConfig[game.gameNameSlug].enviromentOptions) {
        heroicPerGameConfig[game.gameNameSlug].enviromentOptions = [];
      }
      // replace or add LANG in enviromentOptions
      const envIndex = heroicPerGameConfig[
        game.gameNameSlug
      ].enviromentOptions.findIndex((env: any) => env.key === "LANG");
      if (envIndex !== -1) {
        heroicPerGameConfig[game.gameNameSlug].enviromentOptions[envIndex] =
          env_locale;
      } else {
        heroicPerGameConfig[game.gameNameSlug].enviromentOptions.push(
          env_locale
        );
      }
    }
    this.heroicPerGameConfigs[game.gameName] = {
      ...(this.heroicPerGameConfigs[game.gameName] || {}),
      ...heroicPerGameConfig,
    };

    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify(heroicPerGameConfig),
      `${this.heroicGameConfigPath}/${gameConfig.gameNameSlug}.json`
    );
    console.log("Per game config saved");

    // -------------------- update heroicDB Categories --------------------
    console.log("Updating heroicDB Categories");
    console.log("heroicCategories: ", this.heroicCategories);
    console.log("gameConfig.heroicCategories: ", gameConfig.heroicCategories);
    gameConfig.heroicCategories.forEach((category) => {
      if (!this.heroicCategories[category]) {
        this.heroicCategories[category] = [];
      }
      if (
        !this.heroicCategories[category].includes(
          `${game.gameNameSlug}_sideload`
        )
      ) {
        this.heroicCategories[category].push(`${game.gameNameSlug}_sideload`);
      }
    });
    const heroicConfig = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      this.heroicConfigPath
    );
    heroicConfig.games.customCategories = this.heroicCategories;
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify(heroicConfig),
      this.heroicConfigPath
    );
    console.log("heroicDB Categories updated");
  }

  private async _removeGame(game: GameEntry) {
    console.log("Removing: ", game);
    delete this.heroicGameList[game.gameName];
    console.log("heroicGameList after deletion: ", this.heroicGameList);
    const updatedHeroicGameList = Object.values(this.heroicGameList);
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify({ games: updatedHeroicGameList }),
      this.heroicGameListPath
    );
    console.log("Game removed from heroic library.");

    // remove per game config
    await window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.heroicGameConfigPath}/${game.gameNameSlug}.json`
    );
    delete this.heroicPerGameConfigs[game.gameName];
    console.log("Per game config removed");

    // -------------------- update heroicDB Categories --------------------
    console.log("Updating heroicDB Categories");
    Object.keys(this.heroicCategories).forEach((category) => {
      this.heroicCategories[category] = this.heroicCategories[category].filter(
        (gameId) => gameId !== `${game.gameNameSlug}_sideload`
      );
    });
    const heroicConfig = await window.ipcRenderer.invoke(
      "fetchJsonConfig",
      this.heroicConfigPath
    );

    heroicConfig.games.customCategories = this.heroicCategories;
    await window.ipcRenderer.invoke(
      "saveJsonConfig",
      JSON.stringify(heroicConfig),
      this.heroicConfigPath
    );
    console.log("heroicDB Categories updated");
  }

  inDB(game: GameEntry): boolean {
    return this.heroicGameList.hasOwnProperty(game.gameName);
  }

  async getGameConfig(game: GameEntry): Promise<Record<string, string>> {
    if (!this.inDB(game)) {
      return {};
    }
    const heroicGame = this.heroicGameList[game.gameName];
    const gameProperties: Record<string, string> = {
      gameNameEN: heroicGame.title,
      gameNameSlug: heroicGame.app_name,
      gameBrandEN: heroicGame.brand,
      platform: heroicGame.install.platform,
      gameReleaseYear: heroicGame.year,
    };

    // load and cache heroic per-game configs
    const gameConfigPath = `${this.heroicGameConfigPath}/${heroicGame.app_name}.json`;
    try {
      const config = await window.ipcRenderer.invoke(
        "fetchJsonConfig",
        gameConfigPath
      );
      this.heroicPerGameConfigs[heroicGame.app_name] = config;
    } catch (err) {
      console.log(
        `No heroic per-game config found for ${heroicGame.app_name} at ${gameConfigPath}: ${err}`
      );
    }

    return gameProperties;
  }

  getPerGameConfig(game: GameEntry): Record<string, any> {
    return (
      this.heroicPerGameConfigs[game.gameNameSlug]?.[game.gameNameSlug] || {}
    );
  }

  async categoriesForGame(game: GameEntry): Promise<string[]> {
    if (!this.inDB(game)) {
      return [];
    }
    const categories: string[] = [];
    Object.keys(this.heroicCategories).forEach((category) => {
      if (
        this.heroicCategories[category].includes(
          `${game.gameNameSlug}_sideload`
        )
      ) {
        categories.push(category);
      }
    });
    return categories;
  }
}

export default HeroicDB;
