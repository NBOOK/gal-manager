declare global {
  interface DirEntry {
    basePath: string;
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
    symbolicTarget: string;
    // diskUsage: number;
    size: number;
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
    id: string;
    title: string;
    origTitle: string;
    kind: "romanized" | "alias" | "title" | "releaseTitle" | "stored";
    weight: number;
    year: string;
  }

  interface VNDeveloper {
    id: string;
    name: string;
    origName: string;
    kind: "romanized" | "developer" | "publisher" | "stored";
  }

  interface GameConfig {
    gameName: string;
    gameBrand: string;
    gameNameEN: string;
    gameBrandEN: string;
    gameNameSlug: string;
    gameReleaseYear: string;
    steamCategories: string[];
    heroicPrefix: string;
    heroicRunner: string;
    heroicCategories: string[];
    lutrisPrefix: string;
    lutrisRunner: string;
    lutrisCategories: string[];
    launcher: string;
    locale: string;
    controllerLayout: string;
    executable: string;
    platform: string;
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

  interface SteamCategory {
    id: string;
    name: string;
    addded: number[];
    removed: number[];
  }
}
export {};
