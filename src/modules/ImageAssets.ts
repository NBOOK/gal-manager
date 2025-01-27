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
  iconPath: string = "";
  logoPath: string = "";
  headerPath: string = "";
  capsulePath: string = "";
  heroPath: string = "";
  headerSDPath: string = "";
  capsuleSDPath: string = "";
  heroSDPath: string = "";

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
      iconPath: gameStore.config.value.assetsIconName,
      logoPath: gameStore.config.value.assetsLogoName,
      capsulePath: gameStore.config.value.assetsCapsuleName,
      headerPath: gameStore.config.value.assetsHeaderName,
      heroPath: gameStore.config.value.assetsHeroName,
      capsuleSDPath:
        gameStore.config.value.assetsCapsuleName +
        gameStore.config.value.assetsLowResSuffix,
      headerSDPath:
        gameStore.config.value.assetsHeaderName +
        gameStore.config.value.assetsLowResSuffix,
      heroSDPath:
        gameStore.config.value.assetsHeroName +
        gameStore.config.value.assetsLowResSuffix,
    };

    const formats: { [key: string]: string[] } = {
      iconPath: ["ico", "png", "bmp", "webp", "jpg"],
      logoPath: ["png", "webp"],
      capsulePath: ["png", "webp", "jpg"],
      headerPath: ["png", "webp", "jpg"],
      heroPath: ["png", "webp", "jpg"],
      capsuleSDPath: ["webp", "jpg"],
      headerSDPath: ["webp", "jpg"],
      heroSDPath: ["webp", "jpg"],
    };

    await Promise.all(
      Object.entries(assetNames).map(async ([key, assetName]) => {
        for (const format of formats[key]) {
          const filePath = `${this.basePath}/${this.gameBrand}${this.splitter}${this.gameName}/${gameStore.config.value.assetsFolderName}/${assetName}.${format}`;
          const exists = await window.ipcRenderer.invoke(
            "fileExists",
            filePath
          );
          if (exists) {
            (this as any)[key] = filePath;
            break;
          }
        }
      })
    );

    await Promise.all([
      (async () => {
        if (this.capsulePath && !this.capsuleSDPath) {
          this.capsuleSDPath = await window.ipcRenderer.invoke(
            "resizeImage",
            this.capsulePath,
            300
          );
        }
      })(),
      (async () => {
        if (this.headerPath && !this.headerSDPath) {
          this.headerSDPath = await window.ipcRenderer.invoke(
            "resizeImage",
            this.headerPath,
            460
          );
        }
      })(),
      (async () => {
        if (this.heroPath && !this.heroSDPath) {
          this.heroSDPath = await window.ipcRenderer.invoke(
            "resizeImage",
            this.heroPath,
            1280
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
    const assetsFolderPath = `${this.basePath}/${this.gameBrand}${this.splitter}${this.gameName}/${gameStore.config.value.assetsFolderName}`;
    const gameFolderPath = `${this.basePath}/${this.gameBrand}${this.splitter}${this.gameName}`;
    if (await window.ipcRenderer.invoke("fileExists", assetsFolderPath)) {
      window.ipcRenderer.invoke("openPath", assetsFolderPath);
    } else {
      window.ipcRenderer.invoke("openPath", gameFolderPath);
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
