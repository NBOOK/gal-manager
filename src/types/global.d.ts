declare global {
  interface DirEntry {
    basePath: string;
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
    symbolicTarget: string;
    // diskUsage: number;
    createdTime: number;
    modifiedTime: number;
  }
  // let GameEntryVar: typeof GameEntry;
  // let ImageAssetsVar: typeof ImageAssets;
  // let SteamDBVar: typeof SteamDB;

  interface HTMLElement {
    __resizeObserver__?: ResizeObserver;
    __intersectionObserver__?: IntersectionObserver;
  }

  interface VNTitle {
    title: string;
    origTitle: string;
    kind: "romanized" | "alias" | "title" | "releaseTitle";
    weight: number;
  }

  interface GameConfig {
    gameName: string;
    gameBrand: string;
    gameNameEN: string;
    gameNameSlug: string;
    winePrefix: string;
    wineRunner: string;
    executable: string;
    locale: string;
    controllerLayout: string;
    steamCollections: string[];
    lutrisCategories: string[];
  }

  type SyncStrategy = "l2r" | "r2l" | "newest" | "skip";

  interface FileInfo {
    modified: Date;
    size: number;
    isDirectory: boolean;
  }

  interface SyncManager {
    syncList: DirSyncer[];
    managerOpen: boolean;
    progress: number;
  }

  interface SaveSyncConfig {
    remotePath: string;
    localPath: string;
    items: string[];
  }
}
export {};
