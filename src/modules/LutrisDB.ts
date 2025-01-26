import GameEntry from "./GameEntry";

class LutrisDB {
  private static instance: LutrisDB | null = null;

  private lutrisGameConfigPath: string = "";
  private lutrisGameListPath: string = "";
  private lutrisDBPath: string = "";
  private lutrisIconPath: string = "";
  private lutrisBannerPath: string = "";
  private lutrisCoverPath: string = "";
  private lutrisDdefaultLocale: string = "";
  private lutrisDefaultRunner: string = "";
  private lutrisDefaultWinePrefix: string = "";
  private lutrisLaunchOptions: string = "";
  private wineRunnerPath: string = "";
  private winePrefixPath: string = "";
  linkLowRes: boolean = true;

  private lutrisGameList: Record<string, string> = {};
  private lutrisGameIndices: Record<string, number> = {};

  private taskQueue: { action: "add" | "remove"; game: GameEntry }[] = [];
  private processing: boolean = false;

  constructor() {
    if (LutrisDB.instance) {
      return LutrisDB.instance;
    }
    LutrisDB.instance = this;
  }

  async setup(config: any) {
    this.lutrisGameConfigPath = config.lutrisGameConfigPath;
    this.lutrisGameListPath = config.lutrisGameListPath;
    this.lutrisDBPath = config.lutrisDBPath;
    this.lutrisIconPath = config.lutrisIconPath;
    this.lutrisBannerPath = config.lutrisBannerPath;
    this.lutrisCoverPath = config.lutrisCoverPath;
    this.lutrisDdefaultLocale = config.lutrisDdefaultLocale;
    this.lutrisDefaultRunner = config.lutrisDefaultRunner;
    this.lutrisDefaultWinePrefix = config.lutrisDefaultWinePrefix;
    this.lutrisLaunchOptions = config.lutrisLaunchOptions;
    this.wineRunnerPath = config.wineRunnerPath;
    this.winePrefixPath = config.winePrefixPath;

    await window.ipcRenderer.invoke("sqliteDBOp", "connect", {
      dbPath: this.lutrisDBPath,
    });

    this.lutrisGameList = await window.ipcRenderer.invoke(
      "fetchYamlConfig",
      this.lutrisGameListPath
    );
    Object.keys(this.lutrisGameList).forEach((key) => {
      const path = this.lutrisGameList[key];
      const pathParts = path.split("/");
      const folderName = pathParts[pathParts.length - 2];
      const splitter = folderName.includes(" ‐ ") ? " ‐ " : " - ";
      const gameName = folderName.split(splitter).slice(1).join(splitter);
      const lutrisGameIndex = parseInt(key, 10);

      this.lutrisGameIndices[gameName] = lutrisGameIndex;
    });
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }
    this.processing = true;
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      if (task.action === "add") {
        await this._addGame(task.game);
      } else if (task.action === "remove") {
        await this._removeGame(task.game);
      }
    }
    this.processing = false;
  }

  async removeGame(game: GameEntry) {
    this.taskQueue.push({ action: "remove", game });
    this.processQueue(); // @TOCHECK should we await this?
  }

  async _addGame(game: GameEntry) {}

  async _removeGame(game: GameEntry) {}

  async getGameConfig(gameConfigName: string): Promise<Record<string, string>> {
    return await window.ipcRenderer.invoke(
      "fetchYamlConfig",
      `${this.lutrisGameConfigPath}/${gameConfigName}.yml`
    );
  }

  async saveGameConfig(gameConfigName: string, config: Record<string, string>) {
    return await window.ipcRenderer.invoke(
      "saveYamlConfig",
      config,
      `${this.lutrisGameConfigPath}/${gameConfigName}.yml`
    );
  }

  inDB(game: GameEntry): boolean {
    return this.lutrisGameIndices[game.gameName] !== undefined;
  }

  getGameIndex(game: GameEntry): number {
    // Return the index of the game in lutrisDB or largest lutrisDB index + 1
    // DON't use this function to check if the game is in lutrisDB

    if (this.lutrisGameIndices[game.gameName] !== undefined) {
      return this.lutrisGameIndices[game.gameName];
    }
    const indices = Object.values(this.lutrisGameIndices);
    const largestIndex = indices.length > 0 ? Math.max(...indices) : 0;
    return largestIndex + 1;
  }

  async getGameProperties(game: GameEntry): Promise<Record<string, string>> {
    if (!this.inDB(game)) {
      return {};
    }
    const lutrisGameIndex = this.getGameIndex(game);
    return await window.ipcRenderer.invoke("sqliteDBOp", "query", {
      lutrisGameIndex: lutrisGameIndex,
    });
  }
}

export default LutrisDB;
