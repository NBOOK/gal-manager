import { useGameStore } from "@/store/global-store";
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
  // iconPath: string = "";
  // logoPath: string = "";
  // headerPath: string = "";
  // capsulePath: string = "";
  // heroPath: string = "";
  // headerSDPath: string = "";
  // capsuleSDPath: string = "";
  // heroSDPath: string = "";

  get gameFolderPath() {
    return `${this.basePath}/${this.gameBrand}${this.splitter}${this.gameName}`;
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
    basePath: string,
    gameBrand: string,
    gameName: string,
    splitter: string
  ): Promise<ImageAssets> {
    const imageAssets = new ImageAssets(
      basePath,
      gameBrand,
      gameName,
      splitter
    );
    await imageAssets.setGamePath(basePath, gameBrand, gameName);
    return imageAssets;
  }

  constructor(
    basePath: string,
    gameBrand: string,
    gameName: string,
    splitter: string
  ) {
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
  }

  async openImageOrGameFolder() {
    //@TODO
    // open image assets folder in file manager if exists
    // else open game folder
    // console.log(
    //   "openImageOrGameFolder",
    //   this.basePath,
    //   this.gameBrand,
    //   this.gameName
    // );
    if (await window.ipcRenderer.invoke("fileExists", this.assetsFolderPath)) {
      window.ipcRenderer.invoke("openPath", this.assetsFolderPath);
    } else {
      window.ipcRenderer.invoke("openPath", this.gameFolderPath);
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
}

export default ImageAssets;
