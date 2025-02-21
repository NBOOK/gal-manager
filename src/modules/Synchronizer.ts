class FileSyncer {
  relativePath: string;
  fileInfoL: FileInfo | null;
  fileInfoR: FileInfo | null;
  strategy: SyncStrategy;
  private dirL: string;
  private dirR: string;
  prependName: string = "";
  selected: boolean = false;

  constructor(
    relativePath: string,
    dirL: string,
    dirR: string,
    fileInfoL: FileInfo | null,
    fileInfoR: FileInfo | null,
    strategy: SyncStrategy = "newest",
    prependName: string = ""
  ) {
    this.relativePath = relativePath;
    this.dirL = dirL;
    this.dirR = dirR;
    this.fileInfoL = fileInfoL;
    this.fileInfoR = fileInfoR;
    this.strategy = strategy;
    this.prependName = prependName;
  }

  get baseFolderName(): string {
    return this.dirL.split("/").pop() || "";
  }
  get parentFolderPath(): string {
    return this.relativePath.split("/").at(-2) || "";
  }
  get fileName(): string {
    return this.relativePath.split("/").pop() || "";
  }

  /**
   * 返回当前策略的等价策略。
   */
  get actualStrategy(): SyncStrategy {
    if (this.strategy !== "newest") {
      return this.strategy;
    }

    // newest 策略下，如果 dirL 和 dirR 都存在，则根据修改时间决定具体策略
    if (this.fileInfoL && this.fileInfoR) {
      return this.fileInfoL.modified < this.fileInfoR.modified ? "r2l" : "l2r";
    }

    return this.fileInfoL ? "l2r" : "r2l";
  }

  behaviorOf(strategy: SyncStrategy): string {
    if (strategy === "skip") return "skip";
    if (strategy === "l2r") {
      if (this.fileInfoL && this.fileInfoR) return "updateR";
      else if (this.fileInfoL && !this.fileInfoR) return "addR";
      else if (!this.fileInfoL && this.fileInfoR) return "deleteR";
      else {
        console.error("Invalid state");
        return "skip";
      }
    } else {
      if (this.fileInfoL && this.fileInfoR) return "updateL";
      else if (this.fileInfoL && !this.fileInfoR) return "deleteL";
      else if (!this.fileInfoL && this.fileInfoR) return "addL";
      else {
        console.error("Invalid state");
        return "skip";
      }
    }
  }

  get behavior(): string {
    return this.behaviorOf(this.actualStrategy);
  }

  get isDirectory(): boolean {
    if (this.fileInfoL && this.fileInfoL.isDirectory) return true;
    if (this.fileInfoR && this.fileInfoR.isDirectory) return true;
    return false;
  }

  /**
   * 执行同步：
   * - l2r：以 dirL 为权威。如果 dirL 存在则复制到 dirR，否则删除 dirR 中对应文件（如果存在）。
   * - r2l：以 dirR 为权威。如果 dirR 存在则复制到 dirL，否则删除 dirL 中对应文件（如果存在）。
   * - newest：如果两边都存在则比较修改时间，将较新的复制到较旧的一边；如果仅存在一边，则复制到另一边。
   *
   * 此处调用了 window.ipcRenderer.invoke("start-copy", source, target) 来实现文件复制/删除操作，
   * 根据实际情况可以在 ipc 主进程中处理具体的文件系统操作。
   */
  async sync(): Promise<void> {
    if (
      this.fileInfoL &&
      this.fileInfoR &&
      this.fileInfoL.isDirectory &&
      this.fileInfoR.isDirectory
    ) {
      throw new Error("Both are directories, should be filtered out");
    }

    const strategy = this.actualStrategy;
    if (strategy === "skip") return;

    // 默认情况：left --> right（即 dirL -> dirR）
    let source = `${this.dirL}/${this.relativePath}`;
    let target = `${this.dirR}/${this.relativePath}`;

    if (strategy === "r2l") {
      // 右到左：dirR -> dirL
      [source, target] = [target, source];
    }

    // 通过 ipcRenderer 调用主进程进行文件复制/删除操作
    if (await window.ipcRenderer.invoke("fileExists", source)) {
      if (this.isDirectory) {
        await window.ipcRenderer.invoke("createFolder", target);
      } else {
        await window.ipcRenderer.invoke("start-copy", source, target);
      }
    } else {
      await window.ipcRenderer.invoke("removeItem", target);
    }
  }

  async showInFolder(): Promise<void> {
    const pathL = `${this.dirL}/${this.relativePath}`;
    const pathR = `${this.dirR}/${this.relativePath}`;
    const pathExistL = await window.ipcRenderer.invoke("fileExists", pathL);
    const pathExistR = await window.ipcRenderer.invoke("fileExists", pathR);
    if (pathExistL) {
      await window.ipcRenderer.invoke("showItemInFolder", pathL);
    }
    if (pathExistR) {
      await window.ipcRenderer.invoke("showItemInFolder", pathR);
    }
    if (!pathExistL && !pathExistR) {
      console.error("File not found on both sides");
    }
  }
}

/**
 * 该类用于维护两个目录（dirL 和 dirR）之间所有不一致的文件项。
 * 内部通过 scan() 方法扫描两个目录，生成不一致的 FileSyncer 列表，
 * 并可通过 syncAll() 方法将所有不一致项执行同步。
 */
class DirSyncer {
  dirL: string;
  dirR: string;
  include: string[];
  exclude: string[];
  fileSyncers: FileSyncer[];

  prependName: string = "";

  constructor(
    dirL: string,
    dirR: string,
    include: string[] = [],
    exclude: string[] = [],
    prependName: string = ""
  ) {
    this.dirL = dirL;
    this.dirR = dirR;
    this.include = include;
    this.exclude = exclude;
    this.prependName = prependName;
    this.fileSyncers = [];
  }

  /**
   * 扫描两个目录 dirL 和 dirR，递归比较它们的文件（基于相对路径）。
   * 不一致的文件包括：
   *   - 文件仅存在于其中一边；
   *   - 文件在两边都存在，但文件大小或修改时间不同。
   * 扫描后将不一致的文件生成 FileSyncer 对象，保存在 fileSyncers 成员中。
   */
  async scan(): Promise<void> {
    const mapL: Map<string, FileInfo> = await window.ipcRenderer.invoke(
      "getFileInfos",
      this.dirL
    );
    const mapR: Map<string, FileInfo> = await window.ipcRenderer.invoke(
      "getFileInfos",
      this.dirR
    );

    // 获取所有文件的相对路径（按字母顺序排序）
    const allFiles = new Set<string>([...mapL.keys(), ...mapR.keys()].sort());
    this.fileSyncers = [];

    for (const relativePath of allFiles) {
      const fileInfoL = mapL.get(relativePath) || null;
      const fileInfoR = mapR.get(relativePath) || null;

      // 如果文件在 exclude 中但不在 include 中，则跳过
      const startWithExclude = this.exclude.some((ex) =>
        relativePath.startsWith(ex)
      );
      const isInclude = this.include.includes(relativePath);
      if (startWithExclude && !isInclude) {
        continue;
      }

      // 如果两边都是文件夹，直接跳过
      if (
        fileInfoL &&
        fileInfoL.isDirectory &&
        fileInfoR &&
        fileInfoR.isDirectory
      ) {
        continue;
      }

      // 如果两边都存在且文件大小和修改时间一致，则认为文件内容相同，跳过该文件
      if (fileInfoL && fileInfoR) {
        if (
          fileInfoL.size === fileInfoR.size &&
          fileInfoL.modified.getTime() === fileInfoR.modified.getTime()
        ) {
          continue;
        }
      }

      const item = new FileSyncer(
        relativePath,
        this.dirL,
        this.dirR,
        fileInfoL,
        fileInfoR,
        "newest",
        this.prependName
      );
      this.fileSyncers.push(item);
    }
  }

  /**
   * 遍历所有不一致的文件项，并执行各自的 sync() 操作实现同步。
   */
  async syncAll(): Promise<void> {
    const sortedFileSyncers = this.fileSyncers.sort((a, b) => {
      const behaviorOrder = [
        "skip",
        "deleteR",
        "deleteL",
        "addR",
        "updateR",
        "addL",
        "updateL",
      ];
      const depth = (path: string) => path.split("/").length;

      // Helper function to determine if a FileSyncer should be at the front or back
      const isFrontDir = (fs: FileSyncer) =>
        fs.isDirectory && (fs.behavior === "addL" || fs.behavior === "addR");
      const isBackDir = (fs: FileSyncer) =>
        fs.isDirectory &&
        (fs.behavior === "deleteL" || fs.behavior === "deleteR");

      if (isFrontDir(a) && !isFrontDir(b)) return -1;
      if (!isFrontDir(a) && isFrontDir(b)) return 1;
      if (isBackDir(a) && !isBackDir(b)) return 1;
      if (!isBackDir(a) && isBackDir(b)) return -1;

      if (isFrontDir(a) && isFrontDir(b)) {
        return depth(a.relativePath) - depth(b.relativePath);
      }
      if (isBackDir(a) && isBackDir(b)) {
        return depth(b.relativePath) - depth(a.relativePath);
      }

      if (!a.isDirectory && !b.isDirectory) {
        const behaviorComparison =
          behaviorOrder.indexOf(a.behavior) - behaviorOrder.indexOf(b.behavior);
        if (behaviorComparison !== 0) return behaviorComparison;
      }

      return a.relativePath.localeCompare(b.relativePath);
    });

    for (const item of sortedFileSyncers) {
      await item.sync();
    }
  }

  setStrategy(strategy: SyncStrategy): void {
    for (const item of this.fileSyncers) {
      item.strategy = strategy;
    }
  }
}

export { FileSyncer, DirSyncer };
