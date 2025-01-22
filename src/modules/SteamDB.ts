import GameEntry from "./GameEntry";
import { VdfMap } from "steam-binary-vdf";


class SteamDB {
    private static instance: SteamDB | null = null;

    private steamID: string = "";
    private steamShortcutPath: string = "";
    private steamGridPath: string = "";
    private vdf: VdfMap | null = null;
    linkLowRes: boolean = true;

    private taskQueue: GameEntry[] = [];
    private processing: boolean = false;

    constructor() {
        if (SteamDB.instance) {
            return SteamDB.instance;
        }
        SteamDB.instance = this;
    }

    async setup(config: any) {
        this.steamID = config.steamID;
        this.steamShortcutPath = config.steamShortcutPath;
        this.steamGridPath = config.steamGridPath;
        this.linkLowRes = config.assetsLinkLowRes;

        this.vdf = await window.ipcRenderer.invoke('readVdfFile', this.steamShortcutPath);

        console.log('SteamDB', this.steamID, this.steamShortcutPath, this.steamGridPath, this.vdf);
    }
    private async processQueue() {
        if (this.processing) {
            return;
        }
        this.processing = true;
        while (this.taskQueue.length > 0) {
            await this._addGame(this.taskQueue.shift()!);
        }
        this.processing = false;
    }

    async addGame(game: GameEntry) {
        this.taskQueue.push(game);
        this.processQueue(); // @TOCHECK should we await this?
    }

    private async _addGame(game: GameEntry) {
        if (!this.vdf) {
            return;
        }
        console.log('addGame', game.gameName);
        const gameIndex = this.getGameIndex(game.gameNameEN);
        const exePath = `"/usr/bin/flatpak"`;
        const startDir = `"/usr/bin"`;
        const gameID = await window.ipcRenderer.invoke('getGameID', (exePath + game.gameNameEN));

        const shortcut = {
            AppName: game.gameNameEN,
            exe: exePath,
            StartDir: startDir,
            icon: game.imageAssets.iconPath,
            ShortcutPath: '',
            LaunchOptions: `run net.lutris.Lutris lutris:rungame/${game.gameNameSlug}`,
            IsHidden: 0,
            AllowDesktopConfig: 1,
            AllowOverlay: 1,
            openvr: 0,
            Devkit: 0,
            DevkitGameID: '',
            LastPlayTime: '',
            tags: {} // tags are are now stored in localconfig.vdf and this field is ignored
        };

        (this.vdf.shortcuts as Record<string, any>)[gameIndex] = shortcut;
        window.ipcRenderer.invoke('writeVdfFile', this.steamShortcutPath, this.vdf);

        this.linkImage(game.imageAssets.logoPath, gameID, '_logo');
        if (this.linkLowRes) {
            this.linkImage(game.imageAssets.headerSDPath, gameID, '');
            this.linkImage(game.imageAssets.capsuleSDPath, gameID, 'p');
            this.linkImage(game.imageAssets.heroSDPath, gameID, '_hero');
        }
        else {
            this.linkImage(game.imageAssets.headerPath, gameID, '');
            this.linkImage(game.imageAssets.capsulePath, gameID, 'p');
            this.linkImage(game.imageAssets.heroPath, gameID, '_hero');
        }
    }

    private linkImage(sourcePath: string, gameID: string, suffix: string) {
        const assetExtention = sourcePath.split('.').pop();
        const targetPath = `${this.steamGridPath}/${gameID}${suffix}.${assetExtention}`;
        window.ipcRenderer.invoke('createSymbolicLink', sourcePath, targetPath);
    }

    private getGameIndex(gameNameEN: string): string {
        if (!this.vdf || !this.vdf.shortcuts) {
            return '0';
        }

        const keys = Object.keys(this.vdf.shortcuts);
        for (const key of keys) {
            if ((this.vdf.shortcuts as Record<string, any>)[key].AppName === gameNameEN) {
                return key;
            }
        }

        const largestIndex = keys.length > 0 ? Math.max(...keys.map(Number)) : 0;
        return (largestIndex + 1).toString();
    }

    inDB(gameNameSlug: string): boolean {
        if (!this.vdf || !this.vdf.shortcuts) {
            return false;
        }

        const keys = Object.keys(this.vdf.shortcuts);
        for (const key of keys) {
            if ((this.vdf.shortcuts as Record<string, any>)[key].LaunchOptions.includes(gameNameSlug)) {
                return true;
            }
        }
        return false;
    }
}

export default SteamDB;