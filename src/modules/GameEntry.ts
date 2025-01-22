import ImageAssets from '@modules/ImageAssets';
import { useGameStore } from "@store/global-store";
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
    splitter: string = ' - ';


    static async create(entry: DirEntry): Promise<GameEntry> {
        const gameEntry = new GameEntry(entry);

        // 调用并行执行的任务函数
        await gameEntry.setGamePath(gameEntry.basePath, gameEntry.gameBrand, gameEntry.gameName);

        return gameEntry;
    }

    constructor(entry: DirEntry) {
        this.basePath = entry.basePath;
        this.folderName = entry.name;
        if (entry.name.indexOf(' ‐ ') > 0) this.splitter = ' ‐ ';
        this.gameBrand = entry.name.split(this.splitter)[0];
        this.gameBrandEN = this.gameBrand;
        this.gameName = entry.name.split(this.splitter).slice(1).join(this.splitter);
        this.gameNameEN = this.gameName;
        this.createdTime = entry.createdTime;
        this.modifiedTime = entry.modifiedTime;
    }


    private async setGamePath(basePath: string, gameBrand: string, gameName: string) {
        if (this.diskUsage > 0 && basePath === this.basePath && gameBrand === this.gameBrand && gameName === this.gameName) {
            return;
        }
        [this.basePath, this.gameBrand, this.gameName] = [basePath, gameBrand, gameName];

        const [diskUsage, imageAssets]: [number, ImageAssets] = await Promise.all([
            window.ipcRenderer.invoke('getDiskUsage', `${basePath}/${gameBrand}${this.splitter}${gameName}`),
            ImageAssets.create(basePath, gameBrand, gameName, this.splitter)
        ]);

        this.diskUsage = diskUsage;
        this.imageAssets = imageAssets;
    }

    async link() {
        //@TODO
        console.log(`Linking ${this.folderName}...`);
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
        if (!this.inSteamDB)
            console.log(`Adding ${this.folderName} to SteamDB...`);
    }

    async removeDB() {
        //@TODO
        //placeholder, maybe should create a new DB class?
        if (this.inLutrisDB)
            console.log(`Removing ${this.folderName} from LutrisDB...`);
        if (this.inSteamDB)
            console.log(`Removing ${this.folderName} from SteamDB...`);
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