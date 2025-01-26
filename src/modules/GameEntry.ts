import ImageAssets from "@modules/ImageAssets";
import { useGameStore } from "@store/global-store";
import utils from "./utils";
let gameStore: ReturnType<typeof useGameStore>;

export function gameEntrySetConfig() {
  if (!gameStore) {
    gameStore = useGameStore();
  }
}

class GameEntry {
  basePath: string = "";
  folderName: string = "";
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
  linkedPath: string = "";
  inNetDisk: boolean = false;
  inSDCard: boolean = false;
  inUSB: boolean = false; // @TODO : add USB support
  inDeck: boolean = false;
  inLutrisDB: boolean = false;
  inSteamDB: boolean = false;
  starred: boolean = false;
  imageAssets!: ImageAssets;
  splitter: string = " - ";

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
    this.folderName = entry.name;
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
    window.ipcRenderer.invoke(
      "createSymbolicLink",
      `${this.basePath}/${this.folderName}`,
      `${gameStore.config.value.gamesMainPath}/${this.folderName}`
    );
    this.linked = true;
    this.basePath = gameStore.config.value.gamesMainPath;
    this.imageAssets.basePath = this.basePath;
  }

  async unlink() {
    // console.log(`Unlinking ${this.folderName}...`);
    window.ipcRenderer.invoke(
      "removeSymbolicLink",
      `${this.basePath}/${this.folderName}`
    );
    this.linked = false;

    if (this.inDeck) {
      this.basePath = gameStore.config.value.gamesDataPath;
    } else if (this.inSDCard) {
      this.basePath = gameStore.config.value.gamesSDPath;
    } else if (this.inUSB) {
      this.basePath = gameStore.config.value.gamesUSBPath;
    } else if (this.inNetDisk) {
      this.basePath = gameStore.config.value.gamesMainPath;
    } else {
      throw new Error("Game not found in any disk");
    }
    this.imageAssets.basePath = this.basePath;
  }

  async addDB() {
    //@TODO
    //placeholder, maybe should create a new DB class?
    if (!this.inLutrisDB)
      console.log(`Adding ${this.folderName} to LutrisDB...`);
    if (!this.inSteamDB) {
      console.log(`Adding ${this.folderName} to SteamDB...`);
      gameStore.steamDB.addGame(this);
      this.inSteamDB = true;
    }
  }

  async removeDB() {
    //@TODO
    //placeholder, maybe should create a new DB class?
    if (this.inLutrisDB)
      console.log(`Removing ${this.folderName} from LutrisDB...`);
    if (this.inSteamDB) {
      console.log(`Removing ${this.folderName} from SteamDB...`);
      gameStore.steamDB.removeGame(this);
      this.inSteamDB = false;
    }
  }

  async localMove() {
    //@TODO
    console.log(`Moving ${this.folderName}...`);
    this.inDeck = !this.inDeck;
    this.inSDCard = !this.inSDCard;
    // await this.setGamePath();
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
}

export default GameEntry;
