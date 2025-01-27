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
}
export {};
