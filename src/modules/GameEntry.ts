class GameEntry {
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
    inNetDisk: boolean = false;
    inSDCard: boolean = false;
    inDeck: boolean = false;
    inAssets: boolean = false;
    inLutrisDB: boolean = false;
    inSteamDB: boolean = false;
    imageAssets?: ImageAssets;


    static async create(entry: DirEntry, basePath: string): Promise<GameEntry> {
        const gameEntry = new GameEntry(entry);

        // 调用并行执行的任务函数
        const [diskUsage, imageAssets] = await GameEntry.executeInParallel(entry, basePath);

        gameEntry.diskUsage = diskUsage;
        gameEntry.imageAssets = imageAssets;

        return gameEntry;
    }

    private static async executeInParallel(entry: DirEntry, basePath: string): Promise<[number, ImageAssets | undefined]> {
        const diskUsagePromise = window.ipcRenderer.invoke('getDiskUsage', `${basePath}/${entry.name}`);
        const imageAssetsPromise = ImageAssets.create(entry, basePath);

        return Promise.all([diskUsagePromise, imageAssetsPromise]);
    }

    constructor(entry: DirEntry) {
        this.folderName = entry.name;
        this.gameBrand = entry.name.split(' - ')[0];
        this.gameName = entry.name.split(' - ').slice(1).join(' - ');
        this.createdTime = entry.createdTime;
        this.modifiedTime = entry.modifiedTime;
    }

}

export default GameEntry;