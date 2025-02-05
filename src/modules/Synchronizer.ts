class FileSyncer {
  relativePath: string;
  fileInfoL: FileInfo | null;
  fileInfoR: FileInfo | null;
  strategy: SyncStrategy;
  private dirL: string;
  private dirR: string;

  constructor(
    relativePath: string,
    dirL: string,
    dirR: string,
    fileInfoL: FileInfo | null,
    fileInfoR: FileInfo | null,
    strategy: SyncStrategy = "newest"
  ) {
    this.relativePath = relativePath;
    this.dirL = dirL;
    this.dirR = dirR;
    this.fileInfoL = fileInfoL;
    this.fileInfoR = fileInfoR;
    this.strategy = strategy;
  }

  get baseFolderName(): string {
    return this.dirL.split("/").pop() || "";
  }
  get parentFolderPath(): string {
    return this.relativePath.split("/").slice(0, -1).join("/");
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

  get behavior(): string {
    const strategy = this.actualStrategy;
    if (strategy === "l2r") {
      if (this.fileInfoL && this.fileInfoR) return "updateR";
      else if (this.fileInfoL && !this.fileInfoR) return "addR";
      else if (!this.fileInfoL && this.fileInfoR) return "deleteR";
      else {
        throw new Error("Invalid state");
        return "";
      }
    } else {
      if (this.fileInfoL && this.fileInfoR) return "updateL";
      else if (this.fileInfoL && !this.fileInfoR) return "deleteL";
      else if (!this.fileInfoL && this.fileInfoR) return "addL";
      else {
        throw new Error("Invalid state");
        return "";
      }
    }
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
    // 默认情况：left --> right（即 dirL -> dirR）
    let source = `${this.dirL}/${this.relativePath}`;
    let target = `${this.dirR}/${this.relativePath}`;

    const strategy = this.actualStrategy;

    if (strategy === "r2l") {
      // 右到左：dirR -> dirL
      [source, target] = [target, source];
    }

    // 通过 ipcRenderer 调用主进程进行文件复制/删除操作
    if (await window.ipcRenderer.invoke("fileExists", source)) {
      await window.ipcRenderer.invoke("start-copy", source, target);
    } else {
      await window.ipcRenderer.invoke("removeItem", target);
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
  dirName: string;
  fileSyncers: FileSyncer[];

  constructor(dirName: string, dirL: string, dirR: string) {
    this.dirName = dirName;
    this.dirL = dirL;
    this.dirR = dirR;
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
        fileInfoR
      );
      this.fileSyncers.push(item);
    }
  }

  /**
   * 遍历所有不一致的文件项，并执行各自的 sync() 操作实现同步。
   */
  async syncAll(): Promise<void> {
    for (const item of this.fileSyncers) {
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
