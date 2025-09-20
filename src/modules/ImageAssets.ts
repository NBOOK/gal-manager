import GameEntry from "./GameEntry";
import { useGameStore } from "@/store/global-store";
let gameStore: ReturnType<typeof useGameStore>;

export function imageAssetsSetStore() {
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
    // await imageAssets.setGamePath(basePath, gameBrand, gameName);
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

  async setupAssets(orderedDirs: string[]) {
    // console.log(orderedDirs);
    const sourceDir = orderedDirs[0];
    const localSourceDir = orderedDirs[1];
    const targetDirs = orderedDirs.slice(2);

    var sourceAssets = await this.scanImageAssets(sourceDir);
    sourceAssets = await this.generateLowResAssets(sourceDir, sourceAssets);

    const localSourceAssets = await this.scanImageAssets(localSourceDir);
    await this.syncImageAssets(
      sourceDir,
      sourceAssets,
      localSourceDir,
      localSourceAssets
    );

    for (const targetDir of targetDirs) {
      const targetAssets = await this.scanImageAssets(targetDir);
      await this.syncImageAssets(
        localSourceDir,
        localSourceAssets,
        targetDir,
        targetAssets
      );
    }
  }

  /**
   * Scans a directory for image assets and returns their filenames
   * @param dirPath Directory path to scan, defaults to this.assetsFolderPath
   * @returns Object containing found asset filenames
   */
  async scanImageAssets(
    dirPath: string = this.assetsFolderPath
  ): Promise<{ [key: string]: string }> {
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

    const foundAssets: { [key: string]: string } = {
      iconName: "",
      logoName: "",
      capsuleName: "",
      headerName: "",
      heroName: "",
      capsuleSDName: "",
      headerSDName: "",
      heroSDName: "",
    };

    // get assets extension
    await Promise.all(
      Object.entries(assetNames).map(async ([key, assetName]) => {
        for (const format of formats[key]) {
          const filePath = `${dirPath}/${assetName}.${format}`;
          const exists = await window.ipcRenderer.invoke(
            "fileExists",
            filePath
          );
          if (exists) {
            const fileName = `${assetName}.${format}`;
            foundAssets[key] = fileName;

            // If scanning the default folder, update instance properties
            // if (dirPath === this.assetsFolderPath) {
            //   (this as any)[key] = fileName;
            // }
            break;
          }
        }
      })
    );

    // If scanning default folder, generate low-res assets
    if (dirPath === this.assetsFolderPath) {
      for (const key of Object.keys(foundAssets)) {
        (this as any)[key] = foundAssets[key];
      }
    }

    return foundAssets;
  }

  /**
   * Generates low resolution versions of image assets if they don't exist
   * @param dirPath Directory containing assets, defaults to this.assetsFolderPath
   * @param assetsNames Object containing asset filenames, uses instance properties if not provided
   * @returns Object containing generated low-res asset filenames
   */
  async generateLowResAssets(
    dirPath: string = this.assetsFolderPath,
    assetsNames?: { [key: string]: string }
  ): Promise<{ [key: string]: string }> {
    const assets = assetsNames || {
      capsuleName: this.capsuleName,
      headerName: this.headerName,
      heroName: this.heroName,
      capsuleSDName: this.capsuleSDName,
      headerSDName: this.headerSDName,
      heroSDName: this.heroSDName,
    };

    // const generatedAssets: {[key: string]: string} = {
    //   capsuleSDName: assets.capsuleSDName,
    //   headerSDName: assets.headerSDName,
    //   heroSDName: assets.heroSDName
    // };

    await Promise.all([
      (async () => {
        if (assets.capsuleName && !assets.capsuleSDName) {
          const capsulePath = `${dirPath}/${assets.capsuleName}`;
          const capsuleSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            capsulePath,
            300,
            gameStore.config.value.assetsLowResFormat
          );
          assets.capsuleSDName = capsuleSDName;
          // Update instance if working on default folder
          // if (dirPath === this.assetsFolderPath) {
          //   this.capsuleSDName = capsuleSDName;
          // }
        }
      })(),
      (async () => {
        if (assets.headerName && !assets.headerSDName) {
          const headerPath = `${dirPath}/${assets.headerName}`;
          const headerSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            headerPath,
            460,
            gameStore.config.value.assetsLowResFormat
          );
          assets.headerSDName = headerSDName;
          // Update instance if working on default folder
          // if (dirPath === this.assetsFolderPath) {
          //   this.headerSDName = headerSDName;
          // }
        }
      })(),
      (async () => {
        if (assets.heroName && !assets.heroSDName) {
          const heroPath = `${dirPath}/${assets.heroName}`;
          const heroSDName = await window.ipcRenderer.invoke(
            "resizeImage",
            heroPath,
            1280,
            gameStore.config.value.assetsLowResFormat
          );
          assets.heroSDName = heroSDName;
          // Update instance if working on default folder
          // if (dirPath === this.assetsFolderPath) {
          //   this.heroSDName = heroSDName;
          // }
        }
      })(),
    ]);

    if (dirPath === this.assetsFolderPath) {
      for (const key of ["capsuleSDName", "headerSDName", "heroSDName"]) {
        (this as any)[key] = assets[key];
      }
    }

    return assets;
  }

  /**
   * Synchronizes image assets between source and target directories
   * @param sourceDirPath Source directory path
   * @param sourceAssetsNames Object containing source asset filenames
   * @param targetDirPath Target directory path
   * @param targetAssetsNames Object containing target asset filenames
   * @returns Object containing synchronized asset filenames
   */
  async syncImageAssets(
    sourceDirPath: string,
    sourceAssetsNames: { [key: string]: string },
    targetDirPath: string,
    targetAssetsNames: { [key: string]: string }
  ): Promise<{ [key: string]: string }> {
    const result: { [key: string]: string } = { ...targetAssetsNames };
    const assetKeys = [
      "iconName",
      "logoName",
      "capsuleName",
      "headerName",
      "heroName",
      "capsuleSDName",
      "headerSDName",
      "heroSDName",
    ];

    await Promise.all(
      assetKeys.map(async (key) => {
        const sourceAssetName = sourceAssetsNames[key];
        const targetAssetName = targetAssetsNames[key];

        if (!sourceAssetName) return; // Skip if source asset doesn't exist

        const sourcePath = `${sourceDirPath}/${sourceAssetName}`;
        const targetPath = `${targetDirPath}/${sourceAssetName}`;

        // Case 3.1: Target asset doesn't exist
        if (!targetAssetName) {
          await window.ipcRenderer.invoke("start-copy", sourcePath, targetPath);
          result[key] = sourceAssetName;
        }
        // Case 3.2: Target asset exists but has different filename
        else if (targetAssetName !== sourceAssetName) {
          const oldTargetPath = `${targetDirPath}/${targetAssetName}`;
          await window.ipcRenderer.invoke("removeItem", oldTargetPath);
          await window.ipcRenderer.invoke("start-copy", sourcePath, targetPath);
          result[key] = sourceAssetName;
        }
        // Case 3.3: Target asset has same filename but different content
        else if (
          !(await window.ipcRenderer.invoke(
            "filesIdentical",
            sourcePath,
            targetPath
          ))
        ) {
          await window.ipcRenderer.invoke("removeItem", targetPath);
          await window.ipcRenderer.invoke("start-copy", sourcePath, targetPath);
          result[key] = sourceAssetName;
        }

        // Update instance if target is default folder
        if (targetDirPath === this.assetsFolderPath) {
          (this as any)[key] = result[key];
        }
      })
    );

    return result;
  }

  async openImageOrGameFolder(kind?: string) {
    if (kind === "steam" && this.game?.inSteamDB) {
      const steamAppId = gameStore.steamDB.getAppID(this.game);
      for (const suffix of ["", "p", "_hero", "_logo"]) {
        for (const format of ["jpg", "png", "webp"]) {
          const assetName = `${steamAppId}${suffix}.${format}`;
          console.log(
            "Open Steam Grid Image: ",
            `${gameStore.config.value.steam.gridPath}/${assetName}`
          );
          if (
            await window.ipcRenderer.invoke(
              "fileExists",
              `${gameStore.config.value.steam.gridPath}/${assetName}`
            )
          ) {
            window.ipcRenderer.invoke(
              "showItemInFolder",
              `${gameStore.config.value.steam.gridPath}/${assetName}`
            );
            return;
          }
        }
      }
    } else if (kind === "lutris" && this.game?.inLutrisDB) {
      const slug = this.game?.gameNameSlug;
      for (const targetFolderPath of [
        gameStore.config.value.lutris.bannerPath,
        gameStore.config.value.lutris.coverPath,
        gameStore.config.value.lutris.iconPath,
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
