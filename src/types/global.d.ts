
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


    var GameEntry: typeof GameEntry;
    var ImageAssets: typeof ImageAssets;
}
export { }