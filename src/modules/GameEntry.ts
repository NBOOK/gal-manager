import ImageAssets from '@modules/ImageAssets';

class GameEntry {
    basePath: string = "";
    folderName: string = "";
    gameBrand: string = "";
    gameBrandEN: string = "";
    gameName: string = "";
    gameNameEN: string = "";
    createdTime: number = 0;
    modifiedTime: number = 0;
    diskUsage: number = 0;
    selected: boolean = false;
    linked: boolean = false;
    linkedPath: string = "";
    inNetDisk: boolean = false;
    inSDCard: boolean = false;
    inDeck: boolean = false;
    inAssets: boolean = false;
    inLutrisDB: boolean = false;
    inSteamDB: boolean = false;
    imageAssets?: ImageAssets;
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
        this.gameName = entry.name.split(this.splitter).slice(1).join(this.splitter);
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
        console.log(`Linking ${this.folderName}...`);
        this.linked = true;
    }

    async unlink() {
        console.log(`Unlinking ${this.folderName}...`);
        this.linked = false;
    }
}

export default GameEntry;