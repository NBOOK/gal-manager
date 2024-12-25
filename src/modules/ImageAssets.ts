class ImageAssets {
    basePath: string = "";
    gameName: string = "";
    icon: string = "";
    logo: string = "";
    header: string = "";
    capsule: string = "";
    hero: string = "";
    headerHD: string = "";
    capsuleHD: string = "";
    heroHD: string = "";

    static async create(entry: DirEntry, basePath: string): Promise<ImageAssets> {
        const imageAssets = new ImageAssets(entry, basePath);
        return imageAssets;
    }

    constructor(entry: DirEntry, basePath: string) {
        this.basePath = basePath;
        this.gameName = entry.name;
    }

    async scanImageAssets() {
    }

    async checkCreateLowRes() {

    }

    assetsCount(): number {
        let count = 0;
        if (this.icon) count++;
        if (this.logo) count++;
        if (this.header) count++;
        if (this.capsule) count++;
        if (this.hero) count++;
        return count;
    }
}