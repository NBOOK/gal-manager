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

    static async create(entry: DirEntry, basePath: string): Promise<GameEntry> {
        const gameEntry = new GameEntry(entry);
        gameEntry.diskUsage = await window.ipcRenderer.invoke('getDiskUsage', `${basePath}/${entry.name}`);
        return gameEntry;
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