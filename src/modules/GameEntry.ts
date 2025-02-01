import ImageAssets from "@/modules/ImageAssets";
import { useGameStore } from "@/store/global-store";
import utils from "./utils";
let gameStore: ReturnType<typeof useGameStore>;

export function gameEntrySetConfig() {
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
  createdTime: number = 0;
  modifiedTime: number = 0;
  diskUsage: number = 0;
  selected: boolean = false;
  linked: boolean = false;
  linkedBasePath: string = "";
  inNetDisk: boolean = false;
  inSDCard: boolean = false;
  inUSB: boolean = false; // @TODO : add USB support
  inDeck: boolean = false;
  inLutrisDB: boolean = false;
  inSteamDB: boolean = false;
  starred: boolean = false;
  imageAssets!: ImageAssets;
  splitter: string = " - ";

  get folderName(): string {
    return `${this.gameBrand}${this.splitter}${this.gameName}`;
  }

  get gamePath(): string {
    return `${this.basePath}/${this.folderName}`;
  }

  get inDatabase(): number {
    if (this.inLutrisDB && this.inSteamDB) return 1;
    else if (this.inLutrisDB || this.inSteamDB) return 2;
    else return 0;
  }

  get inAssets(): number {
    if (this.imageAssets.assetsCount === 5) return 1;
    else if (this.imageAssets.assetsCount > 0) return 2;
    else return 0;
  }

  // performance is not good
  //   get inSteamDB() {
  //     return gameStore.steamDB.inDB(this.gameNameSlug);
  //   }

  // static async create(entry: DirEntry): Promise<GameEntry> {
  //   const gameEntry = new GameEntry(entry);

  //   await gameEntry.setGamePath(
  //     gameEntry.basePath,
  //     gameEntry.gameBrand,
  //     gameEntry.gameName
  //   );

  //   return gameEntry;
  // }

  constructor() {}

  async setup(entry: DirEntry) {
    this.basePath = entry.basePath;
    // this.folderName = entry.name;
    if (entry.name.includes(" ‐ ")) this.splitter = " ‐ ";
    this.gameBrand = entry.name.split(this.splitter)[0];
    // this.gameBrandEN = this.gameBrand;
    this.gameBrandEN = await utils.romanize(this.gameBrand);
    this.gameName = entry.name
      .split(this.splitter)
      .slice(1)
      .join(this.splitter);
    this.createdTime = entry.createdTime;
    this.modifiedTime = entry.modifiedTime;

    const [diskUsage, imageAssets]: [number, ImageAssets] = await Promise.all([
      window.ipcRenderer.invoke(
        "getDiskUsage",
        `${this.basePath}/${this.gameBrand}${this.splitter}${this.gameName}`
      ),
      ImageAssets.create(
        this.basePath,
        this.gameBrand,
        this.gameName,
        this.splitter
      ),
    ]);

    this.diskUsage = diskUsage;
    this.imageAssets = imageAssets;

    this.inLutrisDB = gameStore.lutrisDB.inDB(this);
    if (this.inLutrisDB) {
      const gameProperties = await gameStore.lutrisDB.getGameProperties(this);
      this.gameNameEN = gameProperties.gameNameEN;
      this.gameNameSlug = gameProperties.gameNameSlug;
    } else {
      this.gameNameEN = await utils.romanize(this.gameName);
      this.gameNameSlug = utils.slugify(this.gameNameEN);
    }
    this.inSteamDB = gameStore.steamDB.inDB(this);
  }

  async link() {
    console.log(`Linking ${this.gamePath}...`);
    window.ipcRenderer.invoke(
      "createSymbolicLink",
      this.gamePath,
      `${gameStore.config.value.gamesMainPath}/${this.folderName}`
    );
    this.linked = true;
    this.linkedBasePath = this.basePath;
    this.basePath = gameStore.config.value.gamesMainPath;
    this.imageAssets.basePath = this.basePath;
  }

  async unlink() {
    console.log(`Unlinking ${this.gamePath}...`);
    window.ipcRenderer.invoke("removeSymbolicLink", this.gamePath);
    this.linked = false;

    if (this.inDeck) {
      this.basePath = gameStore.config.value.gamesDataPath;
    } else if (this.inSDCard) {
      this.basePath = gameStore.config.value.gamesSDPath;
    } else if (this.inUSB) {
      this.basePath = gameStore.config.value.gamesUSBPath;
    } else if (this.inNetDisk) {
      this.basePath = gameStore.config.value.gamesExternalPath;
    } else {
      // throw new Error("Game not found in any disk");
      console.log("Game not found in any disk");
    }
    this.imageAssets.basePath = this.basePath;
    this.linkedBasePath = "";
  }

  async addDB(gameConfig: GameConnfig) {
    //@TODO
    // gameName always comes from folderName,
    // If not match call other functions to rename the folder
    // this.gameName = gameConfig.gameName;
    // if (
    //   this.gameNameEN !== gameConfig.gameNameEN ||
    //   this.gameNameSlug !== gameConfig.gameNameSlug
    // ) {
    //   console.log(`New name of ${this.gameNameEN} is ${gameConfig.gameNameEN}`);
    //   console.log(`Removing old ${this.gameNameEN} from DB...`);
    //   await this.removeDB();
    //   console.log(`${this.gameNameEN} removed from DB`);
    //   this.gameNameEN = gameConfig.gameNameEN;
    //   this.gameNameSlug = gameConfig.gameNameSlug;
    // }
    if (this.inDatabase > 0) {
      throw new Error("Game is already in database, remove it first");
      return;
    }
    this.gameNameEN = gameConfig.gameNameEN;
    this.gameNameSlug = gameConfig.gameNameSlug;
    if (!this.inLutrisDB) {
      console.log(`Adding ${this.folderName} to LutrisDB...`);
      await gameStore.lutrisDB.addGame(this, gameConfig);
      this.inLutrisDB = true;
      console.log(`${this.folderName} added to LutrisDB`);
    }
    if (!this.inSteamDB) {
      console.log(`Adding ${this.folderName} to SteamDB...`);
      await gameStore.steamDB.addGame(this);
      this.inSteamDB = true;
      console.log(`${this.folderName} added to SteamDB`);
    }
  }

  async removeDB() {
    if (this.inLutrisDB) {
      console.log(`Removing ${this.folderName} from LutrisDB...`);
      await gameStore.lutrisDB.removeGame(this);
      this.inLutrisDB = false;
    }

    if (this.inSteamDB) {
      console.log(`Removing ${this.folderName} from SteamDB...`);
      await gameStore.steamDB.removeGame(this);
      this.inSteamDB = false;
    }
  }

  async rename(gameConfig: GameConnfig) {
    if (
      this.gameName === gameConfig.gameName &&
      this.gameBrand === gameConfig.gameBrand
    ) {
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
    await this.unlink();
    // }
    const gameBasePaths = [
      gameStore.config.value.gamesDataPath,
      gameStore.config.value.gamesSDPath,
      gameStore.config.value.gamesUSBPath,
      gameStore.config.value.gamesNetPath,
      gameStore.config.value.gamesAssetsPath,
    ];
    for (const basePath of gameBasePaths) {
      const source = `${basePath}/${this.folderName}`;
      const target = `${basePath}/${gameConfig.gameBrand}${this.splitter}${gameConfig.gameName}`;
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
    this.gameBrand = gameConfig.gameBrand;
    this.gameName = gameConfig.gameName;
    this.imageAssets.gameBrand = this.gameBrand;
    this.imageAssets.gameName = this.gameName;
    // if (wasLinked) {
    await this.link();
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
    } else if (target === gameStore.config.value.gamesUSBPath) {
      this.inUSB = true;
    }

    if (this.linked) {
      await this.unlink();
      await this.link();
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
    } else if (basePath === gameStore.config.value.gamesUSBPath) {
      this.inUSB = false;
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
  }
}

export default GameEntry;
