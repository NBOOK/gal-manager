import GameEntry from "./GameEntry";


class SteamDB {
    private steamID: string = "";
    private steamShortcutPath: string = "";
    private steamGridPath: string = "";

    private static instance: SteamDB | null = null;

    constructor(config: any) {
        if (SteamDB.instance) {
            return SteamDB.instance;
        }
        this.steamID = config.steamID;
        this.steamShortcutPath = config.steamShortcutPath;
        this.steamGridPath = config.steamGridPath;
        SteamDB.instance = this;

        console.log('SteamDB', this.steamID, this.steamShortcutPath, this.steamGridPath);
    }


    private taskQueue: GameEntry[] = [];

    private processing: boolean = false;
    private processQueue() {
        if (this.processing) {
            return;
        }
        this.processing = true;
        while (this.taskQueue.length > 0) {
            this._addGame(this.taskQueue.shift()!);
        }
        this.processing = false;
    }

    async addGame(game: GameEntry) {
        this.taskQueue.push(game);
        this.processQueue();
    }

    private _addGame(game: GameEntry) {
        console.log('addGame', game.gameName);
    }
}

export default SteamDB;