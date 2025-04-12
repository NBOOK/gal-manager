import { useGameStore } from "@/store/global-store";
import GameEntry from "./GameEntry";
let gameStore: ReturnType<typeof useGameStore>;

export function imageAssetsSetConfig() {
  if (!gameStore) {
    gameStore = useGameStore();
  }
}

class ImageAssets {
  basePath: string = "";
  gameBrand: string = "";
  gameName: string = "";
  splitter: string = " - ";
  iconName: string = "";
  logoName: string = "";
  capsuleName: string = "";
  headerName: string = "";
  heroName: string = "";
  capsuleSDName: string = "";
  headerSDName: string = "";
  heroSDName: string = "";

  game: GameEntry | null = null;

  get gameFolderName() {
    return `${this.gameBrand}${this.splitter}${this.gameName}`;
  }
  get gameFolderPath() {
    return `${this.basePath}/${this.gameFolderName}`;
  }
  get assetsFolderPath() {
    return `${this.gameFolderPath}/${gameStore.config.value.assetsFolderName}`;
  }
  get iconPath() {
    return this.iconName ? `${this.assetsFolderPath}/${this.iconName}` : "";
  }
  get logoPath() {
    return this.logoName ? `${this.assetsFolderPath}/${this.logoName}` : "";
  }
  get capsulePath() {
    return this.capsuleName
      ? `${this.assetsFolderPath}/${this.capsuleName}`
      : "";
  }
  get headerPath() {
    return this.headerName ? `${this.assetsFolderPath}/${this.headerName}` : "";
  }
  get heroPath() {
    return this.heroName ? `${this.assetsFolderPath}/${this.heroName}` : "";
  }
  get capsuleSDPath() {
    return this.capsuleSDName
      ? `${this.assetsFolderPath}/${this.capsuleSDName}`
      : "";
  }
  get headerSDPath() {
    return this.headerSDName
      ? `${this.assetsFolderPath}/${this.headerSDName}`
      : "";
  }
  get heroSDPath() {
    return this.heroSDName ? `${this.assetsFolderPath}/${this.heroSDName}` : "";
  }

  static async create(
    game: GameEntry,
    basePath: string,
    gameBrand: string,
    gameName: string,
    splitter: string
  ): Promise<ImageAssets> {
    const imageAssets = new ImageAssets(
      game,
      basePath,
      gameBrand,
      gameName,
      splitter
    );
    await imageAssets.setGamePath(basePath, gameBrand, gameName);
    return imageAssets;
  }

  constructor(
    game: GameEntry,
    basePath: string,
    gameBrand: string,
    gameName: string,
    splitter: string
  ) {
    this.game = game;
    this.basePath = basePath;
    this.gameBrand = gameBrand;
    this.gameName = gameName;
    this.splitter = splitter;
  }

  async setGamePath(basePath: string, gameBrand: string, gameName: string) {
    // if (basePath === this.basePath && gameBrand === this.gameBrand && gameName === this.gameName) {
    //     return;
    // }
    [this.basePath, this.gameBrand, this.gameName] = [
      basePath,
      gameBrand,
      gameName,
    ];
    await this.scanImageAssets();
  }

  async scanImageAssets() {
    const assetNames: { [key: string]: string } = {
      iconName: gameStore.config.value.assetsIconName,
      logoName: gameStore.config.value.assetsLogoName,
      capsuleName: gameStore.config.value.assetsCapsuleName,
      headerName: gameStore.config.value.assetsHeaderName,
      heroName: gameStore.config.value.assetsHeroName,
      capsuleSDName:
        gameStore.config.value.assetsCapsuleName +
        gameStore.config.value.assetsLowResSuffix,
      headerSDName:
        gameStore.config.value.assetsHeaderName +
        gameStore.config.value.assetsLowResSuffix,
      heroSDName:
        gameStore.config.value.assetsHeroName +
        gameStore.config.value.assetsLowResSuffix,
    };

    const formats: { [key: string]: string[] } = {
      iconName: ["ico", "png", "bmp", "webp", "jpg"],
      logoName: ["png", "webp"],
      capsuleName: ["png", "webp", "jpg"],
      headerName: ["png", "webp", "jpg"],
      heroName: ["png", "webp", "jpg"],
      capsuleSDName: ["webp", "jpg"],
      headerSDName: ["webp", "jpg"],
      heroSDName: ["webp", "jpg"],
    };

    // get assets extension
    await Promise.all(
      Object.entries(assetNames).map(async ([key, assetName]) => {
        for (const format of formats[key]) {
          const filePath = `${this.assetsFolderPath}/${assetName}.${format}`;
          const exists = await window.ipcRenderer.invoke(
            "fileExists",
            filePath
          );
          if (exists) {
            const fileName = `${assetName}.${format}`;
            (this as any)[key] = fileName;
            break;
          }
        }
      })
    );

    // resize low resolution images
    await Promise.all([
      (async () => {
        if (this.capsuleName && !this.capsuleSDName) {
          this.capsuleSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            this.capsulePath,
            300,
            gameStore.config.value.assetsLowResFormat
          );
        }
      })(),
      (async () => {
        if (this.headerPath && !this.headerSDPath) {
          this.headerSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            this.headerPath,
            460,
            gameStore.config.value.assetsLowResFormat
          );
        }
      })(),
      (async () => {
        if (this.heroPath && !this.heroSDPath) {
          this.heroSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            this.heroPath,
            1280,
            gameStore.config.value.assetsLowResFormat
          );
        }
      })(),
    ]);

    await Promise.all(
      this.validAssetsNames.map(async (assetName) => {
        const sourcePath = `${this.assetsFolderPath}/${assetName}`;
        const targetPath = `${gameStore.config.value.gamesAssetsPath}/${this.gameFolderName}/${gameStore.config.value.assetsFolderName}/${assetName}`;
        if (sourcePath === targetPath) return;
        if (!(await window.ipcRenderer.invoke("fileExists", targetPath))) {
          // console.log("copy assets: ", sourcePath, targetPath);
          await window.ipcRenderer.invoke("start-copy", sourcePath, targetPath);
        } else if (
          !(await window.ipcRenderer.invoke(
            "filesIdentical",
            sourcePath,
            targetPath
          ))
        ) {
          // console.log("copy assets: ", sourcePath, targetPath);
          await window.ipcRenderer.invoke("start-copy", sourcePath, targetPath);
        }
      })
    );
  }

  async openImageOrGameFolder(kind?: string) {
    if (kind === "steam" && this.game?.inSteamDB) {
      const steamAppId = gameStore.steamDB.getAppID(this.game);
      for (const suffix of ["", "p", "_hero", "_logo"]) {
        for (const format of ["jpg", "png", "webp"]) {
          const assetName = `${steamAppId}${suffix}.${format}`;
          console.log(
            "Open Steam Grid Image: ",
            `${gameStore.config.value.steamGridPath}/${assetName}`
          );
          if (
            await window.ipcRenderer.invoke(
              "fileExists",
              `${gameStore.config.value.steamGridPath}/${assetName}`
            )
          ) {
            window.ipcRenderer.invoke(
              "showItemInFolder",
              `${gameStore.config.value.steamGridPath}/${assetName}`
            );
            return;
          }
        }
      }
    } else if (kind === "lutris" && this.game?.inLutrisDB) {
      const slug = this.game?.gameNameSlug;
      for (const targetFolderPath of [
        gameStore.config.value.lutrisBannerPath,
        gameStore.config.value.lutrisCoverPath,
        gameStore.config.value.lutrisIconPath,
      ]) {
        for (const format of ["jpg", "png", "webp"]) {
          const assetName = `${slug}.${format}`;
          if (
            await window.ipcRenderer.invoke(
              "fileExists",
              `${targetFolderPath}/${assetName}`
            )
          ) {
            window.ipcRenderer.invoke(
              "showItemInFolder",
              `${targetFolderPath}/${assetName}`
            );
            return;
          }
        }
      }
    } else {
      if (
        await window.ipcRenderer.invoke("fileExists", this.assetsFolderPath)
      ) {
        window.ipcRenderer.invoke("openPath", this.assetsFolderPath);
      } else if (
        await window.ipcRenderer.invoke("fileExists", this.gameFolderPath)
      ) {
        window.ipcRenderer.invoke("openPath", this.gameFolderPath);
      }
    }
  }

  get assetsCount(): number {
    let count = 0;
    if (this.iconPath) count++;
    if (this.logoPath) count++;
    if (this.headerPath) count++;
    if (this.capsulePath) count++;
    if (this.heroPath) count++;
    return count;
  }

  get validAssetsNames(): string[] {
    return [
      this.headerName,
      this.capsuleName,
      this.iconName,
      this.logoName,
      this.heroName,
      this.capsuleSDName,
      this.headerSDName,
      this.heroSDName,
    ].filter((name) => name !== "");
  }
}

export default ImageAssets;
