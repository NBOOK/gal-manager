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

  interface GameConnfig {
    gameName: string;
    gameBrand: string;
    gameNameEN: string;
    gameNameSlug: string;
    winePrefix: string;
    wineRunner: string;
    executable: string;
    locale: string;
  }

  type SyncStrategy = "l2r" | "r2l" | "newest" | "skip";

  interface FileInfo {
    modified: Date;
    size: number;
    isDirectory: boolean;
  }
}
export {};
