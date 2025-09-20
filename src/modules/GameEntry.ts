import ImageAssets from "@/modules/ImageAssets";
import utils from "./utils";
import { DirSyncer } from "./Synchronizer";
import { useGameStore } from "@/store/global-store";
let gameStore: ReturnType<typeof useGameStore>;

export function gameEntrySetStore() {
  if (!gameStore) {
    gameStore = useGameStore();
  }
}

class GameEntry {
  basePath: string = "";
  // folderName: string = "";
  gameBrand: string = "";
  gameBrandEN: string = "";
  gameName: string = "";
  gameNameEN: string = "";
  gameNameSlug: string = "";
  gameReleaseYear: string = "";
  platform: string = "";
  // launcher: string = ""; // "Lutris" | "Heroic" | ""
  createdTime: number = 0;
  modifiedTime: number = 0;
  diskUsage: number = 0;
  selected: boolean = false;
  linked: boolean = false;
  linkedBasePath: string = "";
  inNetDisk: boolean = false;
  inSDCard: boolean = false;
  inDeck: boolean = false;
  imageAssets!: ImageAssets;
  splitter: string = " - ";

  get folderName(): string {
    return `${this.gameBrand}${this.splitter}${this.gameName}`;
  }

  get gamePath(): string {
    return `${this.basePath}/${this.folderName}`;
  }

  get inLutrisDB(): boolean {
    return gameStore.lutrisDB.inDB(this);
  }

  get inSteamDB(): boolean {
    return gameStore.steamDB.inDB(this);
  }

  get inHeroicDB(): boolean {
    return gameStore.heroicDB.inDB(this);
  }

  get inDatabase(): number {
    const total =
      (this.inLutrisDB ? 1 : 0) +
      (this.inSteamDB ? 1 : 0) +
      (this.inHeroicDB ? 1 : 0);
    // 0: not in db, 2: in some dbs, 1: in all dbs
    return total === 3 ? 1 : total === 0 ? 0 : 2;
  }

  get inAssets(): number {
    if (this.imageAssets.assetsCount === 5) return 1;
    else if (this.imageAssets.assetsCount > 0) return 2;
    else return 0;
  }

  get lutrisRunner(): string {
    if (!this.inLutrisDB) return "";
    const perGameConfig = gameStore.lutrisDB.getPerGameConfig(this);
    if (perGameConfig.wine && perGameConfig.wine.version) {
      return perGameConfig.wine.version;
    } else {
      return "default";
    }
  }

  get lutrisPrefix(): string {
    if (!this.inLutrisDB) return "";
    const perGameConfig = gameStore.lutrisDB.getPerGameConfig(this);
    const prefix = perGameConfig.game.prefix;
    if (!prefix) return "";
    return perGameConfig.game.prefix.replace(/\/$/, "").split("/").pop();
  }

  get heroicRunner(): string {
    if (!this.inHeroicDB) return "";
    const perGameConfig = gameStore.heroicDB.getPerGameConfig(this);
    if (perGameConfig.wineVersion?.name !== undefined) {
      return perGameConfig.wineVersion.name.split(" - ")[1];
    } else {
      return "default";
    }
  }

  get heroicPrefix(): string {
    if (!this.inHeroicDB) return "";
    const perGameConfig = gameStore.heroicDB.getPerGameConfig(this);
    console.log(perGameConfig);
    if (perGameConfig.winePrefix !== undefined) {
      return perGameConfig.winePrefix.split("/").pop();
    } else {
      return "default";
    }
  }

  get launcher(): string {
    return gameStore.steamDB.gameLauncher(this);
  }

  get wineRunner(): string {
    return this.launcher === "Heroic" ? this.heroicRunner : this.lutrisRunner;
  }

  get winePrefix(): string {
    return this.launcher === "Heroic" ? this.heroicPrefix : this.lutrisPrefix;
  }

  constructor() {}

  async setup(entry: DirEntry) {
    this.basePath = entry.basePath;
    // if (entry.symbolicTarget) {
    // handled in Loading.vue
    // }
    if (entry.name.includes(" ‐ ")) this.splitter = " ‐ ";
    if (!entry.name.includes(this.splitter)) {
      throw new Error(
        `The entry name "${entry.name}" does not contain the splitter "${this.splitter}".`
      );
    }
    this.gameBrand = entry.name.split(this.splitter)[0];
    this.gameName = entry.name
      .split(this.splitter)
      .slice(1)
      .join(this.splitter);
    this.createdTime = entry.createdTime;
    this.modifiedTime = entry.modifiedTime;

    await this.refreshDiskUsage();

    this.imageAssets = await ImageAssets.create(
      this,
      this.basePath,
      this.gameBrand,
      this.gameName,
      this.splitter
    );

    // this.inLutrisDB = gameStore.lutrisDB.inDB(this);
    if (this.inLutrisDB) {
      const gameProperties = await gameStore.lutrisDB.getGameConfig(this);
      this.gameNameEN = gameProperties.gameNameEN;
      if (gameProperties.gameBrandEN) {
        this.gameBrandEN = gameProperties.gameBrandEN;
      } else {
        this.gameBrandEN = await utils.romanize(this.gameBrand);
      }
      this.gameNameSlug = gameProperties.gameNameSlug;
      if (
        gameProperties.gameReleaseYear &&
        gameProperties.gameReleaseYear !== "null"
      ) {
        this.gameReleaseYear = gameProperties.gameReleaseYear;
      }
      if (gameProperties.gamePlatform) {
        this.platform = gameProperties.gamePlatform;
      } else {
        this.platform = "Unknown";
      }
    } else {
      this.gameNameEN = await utils.romanize(this.gameName);
      this.gameBrandEN = await utils.romanize(this.gameBrand);
      this.gameNameSlug = utils.slugify(this.gameNameEN);
      this.platform = "Unknown";
    }
    // this.inSteamDB = gameStore.steamDB.inDB(this);
  }

  async refreshDiskUsage() {
    this.diskUsage = await window.ipcRenderer.invoke(
      "getDirDiskUsage",
      `${this.basePath}/${this.folderName}`
    );
  }

  async link(refreshDiskUsage = true) {
    console.log(`Linking ${this.gamePath}...`);
    await window.ipcRenderer.invoke(
      "createSymbolicLink",
      this.gamePath,
      `${gameStore.config.value.gamesMainPath}/${this.folderName}`
    );
    this.linked = true;
    this.linkedBasePath = this.basePath;
    this.basePath = gameStore.config.value.gamesMainPath;
    this.imageAssets.basePath = this.basePath;

    if (refreshDiskUsage) {
      await this.refreshDiskUsage();
    }
  }

  async unlink(refreshDiskUsage = true) {
    console.log(`Unlinking ${this.gamePath}...`);
    await window.ipcRenderer.invoke("removeSymbolicLink", this.gamePath);
    this.linked = false;

    if (this.inDeck) {
      this.basePath = gameStore.config.value.gamesDataPath;
    } else if (this.inSDCard) {
      this.basePath = gameStore.config.value.gamesSDPath;
    } else if (this.inNetDisk) {
      this.basePath = gameStore.config.value.gamesExternalPath;
    } else {
      // throw new Error("Game not found in any disk");
      console.log("Game not found in any disk");
    }
    this.imageAssets.basePath = this.basePath;
    this.linkedBasePath = "";

    if (refreshDiskUsage) {
      await this.refreshDiskUsage();
    }
  }

  async refreshLink() {
    if (!this.linked) return;

    const mapping = [
      { flag: "inDeck", path: gameStore.config.value.gamesDataPath },
      { flag: "inSDCard", path: gameStore.config.value.gamesSDPath },
      { flag: "inNetDisk", path: gameStore.config.value.gamesExternalPath },
    ];

    for (const { flag, path } of mapping) {
      if (this[flag as keyof GameEntry]) {
        if (this.linkedBasePath !== path) {
          await this.unlink(false);
          await this.link(false);
          await this.refreshDiskUsage();
        }
        break;
      }
    }
  }

  async addDB(gameConfig: GameConfig) {
    if (this.inDatabase > 0) {
      throw new Error("Game is already in database, remove it first");
      return;
    }
    this.gameBrandEN = gameConfig.gameBrandEN;
    this.gameNameEN = gameConfig.gameNameEN;
    this.gameNameSlug = gameConfig.gameNameSlug;
    // this.launcher = gameConfig.launcher;
    this.platform = gameConfig.platform;
    this.gameReleaseYear = gameConfig.gameReleaseYear;

    if (!this.inLutrisDB) {
      console.log(`Adding ${this.folderName} to LutrisDB...`);
      await gameStore.lutrisDB.addGame(this, gameConfig);
      console.log(`${this.folderName} added to LutrisDB`);
    }

    if (!this.inHeroicDB) {
      console.log(`Adding ${this.folderName} to HeroicDB...`);
      await gameStore.heroicDB.addGame(this, gameConfig);
      console.log(`${this.folderName} added to HeroicDB`);
    }

    if (!this.inSteamDB) {
      console.log(`Adding ${this.folderName} to SteamDB...`);
      await gameStore.steamDB.addGame(this, gameConfig);
      console.log(`${this.folderName} added to SteamDB`);
    }
  }

  async removeDB(reAdd = false) {
    if (this.inHeroicDB) {
      console.log(`Removing ${this.folderName} from HeroicDB...`);
      await gameStore.heroicDB.removeGame(this);
      // this.inHeroicDB = false;
    }
    if (this.inLutrisDB) {
      console.log(`Removing ${this.folderName} from LutrisDB...`);
      await gameStore.lutrisDB.removeGame(this);
      // this.inLutrisDB = false;
    }

    if (this.inSteamDB) {
      console.log(`Removing ${this.folderName} from SteamDB...`);
      await gameStore.steamDB.removeGame(this, reAdd);
      // this.inSteamDB = false;
    }
  }

  async rename(newFolderName: string) {
    if (this.folderName === newFolderName) {
      return;
    }

    // DB should be removed before renaming
    if (this.inDatabase > 0) {
      throw new Error("Game is in database, remove it first");
      return;
    }

    // const wasInDatabase = this.inDatabase > 0;
    // const wasLinked = this.linked;

    // if (wasInDatabase) {
    //   await this.removeDB();
    // }
    // if (wasLinked) {
    await this.unlink(false);
    // }
    const gameBasePaths = [
      gameStore.config.value.gamesDataPath,
      gameStore.config.value.gamesSDPath,
      gameStore.config.value.gamesNetPath,
      gameStore.config.value.gamesAssetsPath,
    ];
    for (const basePath of gameBasePaths) {
      const source = `${basePath}/${this.folderName}`;
      const target = `${basePath}/${newFolderName}`;
      const sourceExists = await window.ipcRenderer.invoke(
        "fileExists",
        source
      );
      console.log(`${source} exists: ${sourceExists}`);
      if (sourceExists) {
        console.log(`Renaming ${source} to ${target}`);
        await window.ipcRenderer.invoke("renameItem", source, target);
      }
    }
    const newGameBrand = newFolderName.split(this.splitter)[0];
    const newGameName = newFolderName
      .split(this.splitter)
      .slice(1)
      .join(this.splitter);
    this.gameBrand = newGameBrand;
    this.gameName = newGameName;
    this.imageAssets.gameBrand = this.gameBrand;
    this.imageAssets.gameName = this.gameName;
    // if (wasLinked) {
    await this.link(false);
    // }
    // if (wasInDatabase) {
    //   await this.addDB(gameConfig);
    // }
  }

  async downloadTo(target: string) {
    const exclude = [this.imageAssets.assetsFolderPath];
    const include = [
      this.imageAssets.capsulePath,
      this.imageAssets.headerPath,
      this.imageAssets.heroPath,
      this.imageAssets.logoPath,
      this.imageAssets.iconPath,
      this.imageAssets.capsuleSDPath,
      this.imageAssets.headerSDPath,
      this.imageAssets.heroSDPath,
    ].filter((path) => path !== "");

    const destination = `${target}/${this.folderName}`;
    console.log(`Downloading ${this.gamePath} to ${destination}...`);
    console.log(`Include: ${include}`);
    console.log(`Exclude: ${exclude}`);
    await window.ipcRenderer.invoke(
      "start-copy",
      this.gamePath,
      destination,
      include,
      exclude
    );
    console.log(`Downloaded ${this.gamePath} to ${destination}`);

    const assetsSource = this.imageAssets.assetsFolderPath;
    const assetsDestination = `${gameStore.config.value.gamesAssetsPath}/${this.folderName}/${gameStore.config.value.assetsFolderName}`;
    console.log(`Downloading ${assetsSource} to ${assetsDestination}...`);
    console.log(`Include: ${include}`);
    console.log(`Exclude: ${exclude}`);
    await window.ipcRenderer.invoke(
      "start-copy",
      assetsSource,
      assetsDestination,
      include,
      exclude
    );
    console.log(`Downloaded ${assetsSource} to ${assetsDestination}`);

    await this.deleteLocal(); // delete using old status

    if (target === gameStore.config.value.gamesDataPath) {
      this.inDeck = true;
    } else if (target === gameStore.config.value.gamesSDPath) {
      this.inSDCard = true;
    }

    if (this.linked) {
      await this.refreshLink();
    } else {
      this.basePath = target;
      this.imageAssets.basePath = this.basePath;
    }
  }

  async deleteLocal() {
    const basePath = this.linked ? this.linkedBasePath : this.basePath;
    if (basePath === gameStore.config.value.gamesExternalPath) {
      console.log("Cannot delete game from external mount point");
      return;
    }
    const target = `${basePath}/${this.folderName}`;
    console.log(`Deleting ${target}...`);
    await window.ipcRenderer.invoke("removeItem", target);
    console.log(`Deleted ${target}`);

    if (basePath === gameStore.config.value.gamesDataPath) {
      this.inDeck = false;
    } else if (basePath === gameStore.config.value.gamesSDPath) {
      this.inSDCard = false;
    }

    if (this.linked) {
      await this.unlink();
      if (this.inNetDisk) {
        await this.link();
      } else {
        // game not exists in any disk, remove from db and delete
        if (this.inDatabase > 0) {
          await this.removeDB();
        }
        const assetsTarget = `${gameStore.config.value.gamesAssetsPath}/${this.folderName}`;
        console.log(`Deleting ${assetsTarget}...`);
        await window.ipcRenderer.invoke("removeItem", assetsTarget);
        console.log(`Deleted ${assetsTarget}`);
        delete gameStore.games[this.gameName];
      }
    } else {
      if (this.inNetDisk) {
        await this.unlink(); // set basePath and linkedBasePath
      } else {
        const assetsTarget = `${gameStore.config.value.gamesAssetsPath}/${this.folderName}`;
        console.log(`Deleting ${assetsTarget}...`);
        await window.ipcRenderer.invoke("removeItem", assetsTarget);
        console.log(`Deleted ${assetsTarget}`);
        delete gameStore.games[this.gameName];
      }
    }

    await this.refreshDiskUsage();
  }

  async getSyncManager(strategy: SyncStrategy = "l2r") {
    if (!(this.inNetDisk && (this.inDeck || this.inSDCard))) {
      console.log("Game not found in both local and remote disks");
      return;
    }
    const remotePath = `${gameStore.config.value.gamesExternalPath}/${this.folderName}`;
    const localPath = this.gamePath;

    const exclude = [gameStore.config.value.assetsFolderName];
    // const include = [
    //   this.imageAssets.capsuleName,
    //   this.imageAssets.headerName,
    //   this.imageAssets.heroName,
    //   this.imageAssets.logoName,
    //   this.imageAssets.iconName,
    //   this.imageAssets.capsuleSDName,
    //   this.imageAssets.headerSDName,
    //   this.imageAssets.heroSDName,
    // ]
    //   .filter((name) => name !== "")
    //   .map((name) => `${gameStore.config.value.assetsFolderName}/${name}`);
    let include: string[] = [];
    for (const asset of [
      gameStore.config.value.assetsCapsuleName,
      gameStore.config.value.assetsHeaderName,
      gameStore.config.value.assetsHeroName,
      gameStore.config.value.assetsLogoName,
      gameStore.config.value.assetsIconName,
    ]) {
      for (const suffix of ["", gameStore.config.value.assetsLowResSuffix]) {
        for (const format of ["png", "webp", "jpg", "ico"]) {
          include.push(
            `${gameStore.config.value.assetsFolderName}/${asset}${suffix}.${format}`
          );
        }
      }
    }
    console.log("Include: ", include);

    const sync = new DirSyncer(remotePath, localPath, include, exclude);
    await sync.scan();
    await sync.setStrategy(strategy);
    console.log(sync.fileSyncers.map((item) => item.relativePath));
    return sync;
  }
}

export default GameEntry;
