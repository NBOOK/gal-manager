import ImageAssets from "@modules/ImageAssets";
import { useGameStore } from "@store/global-store";
// import { computed } from 'vue';
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

  static async create(entry: DirEntry): Promise<GameEntry> {
    const gameEntry = new GameEntry(entry);

    await gameEntry.setGamePath(
      gameEntry.basePath,
      gameEntry.gameBrand,
      gameEntry.gameName
    );

    return gameEntry;
  }

  constructor(entry: DirEntry) {
    this.basePath = entry.basePath;
    this.folderName = entry.name;
    if (entry.name.indexOf(" ‐ ") > 0) this.splitter = " ‐ ";
    this.gameBrand = entry.name.split(this.splitter)[0];
    this.gameBrandEN = this.gameBrand;
    this.gameName = entry.name
      .split(this.splitter)
      .slice(1)
      .join(this.splitter);
    this.gameNameEN = this.gameName;
    this.gameNameSlug = this.gameNameEN;
    this.createdTime = entry.createdTime;
    this.modifiedTime = entry.modifiedTime;
  }

  private async setGamePath(
    basePath: string,
    gameBrand: string,
    gameName: string
  ) {
    if (
      this.diskUsage > 0 &&
      basePath === this.basePath &&
      gameBrand === this.gameBrand &&
      gameName === this.gameName
    ) {
      return;
    }
    [this.basePath, this.gameBrand, this.gameName] = [
      basePath,
      gameBrand,
      gameName,
    ];

    const [diskUsage, imageAssets]: [number, ImageAssets] = await Promise.all([
      window.ipcRenderer.invoke(
        "getDiskUsage",
        `${basePath}/${gameBrand}${this.splitter}${gameName}`
      ),
      ImageAssets.create(basePath, gameBrand, gameName, this.splitter),
    ]);

    this.diskUsage = diskUsage;
    this.imageAssets = imageAssets;
    this.inSteamDB = gameStore.steamDB.inDB(this.gameNameSlug);
  }

  async link() {
    window.ipcRenderer.invoke(
      "createSymbolicLink",
      `${this.basePath}/${this.folderName}`,
      `${gameStore.config.value.gamesMainPath}/${this.folderName}`
    );
    this.linked = true;
  }

  async unlink() {
    //@TODO
    console.log(`Unlinking ${this.folderName}...`);
    this.linked = false;
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
