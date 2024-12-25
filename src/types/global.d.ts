
declare global {
    interface DirEntry {
        name: string;
        isDirectory: boolean;
        isFile: boolean;
        isSymbolicLink: boolean;
        symbolicTarget: string | null;
        diskUsage: number;
        createdTime: number;
        modifiedTime: number;
    }


    var GameEntry: typeof GameEntry;
}
export { }