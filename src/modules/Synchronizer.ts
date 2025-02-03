/**
 * 表示一个不一致的文件项，包含相对于根目录的文件路径、两边的修改时间、文件大小以及同步策略。
 * sync() 方法根据策略将文件从一边复制到另一边或删除多余文件。
 */
class FileSyncItem {
  relativePath: string;
  dirAInfo: FileInfo | null;
  dirBInfo: FileInfo | null;
  strategy: SyncStrategy;
  private dirA: string;
  private dirB: string;

  constructor(
    relativePath: string,
    dirA: string,
    dirB: string,
    dirAInfo: FileInfo | null,
    dirBInfo: FileInfo | null,
    strategy: SyncStrategy = "newest"
  ) {
    this.relativePath = relativePath;
    this.dirA = dirA;
    this.dirB = dirB;
    this.dirAInfo = dirAInfo;
    this.dirBInfo = dirBInfo;
    this.strategy = strategy;
  }

  /**
   * 执行同步：
   * - l2r：以 dirA 为权威。如果 dirA 存在则复制到 dirB，否则删除 dirB 中对应文件（如果存在）。
   * - r2l：以 dirB 为权威。如果 dirB 存在则复制到 dirA，否则删除 dirA 中对应文件（如果存在）。
   * - newest：如果两边都存在则比较修改时间，将较新的复制到较旧的一边；如果仅存在一边，则复制到另一边。
   */
  async sync(): Promise<void> {
    // left --> right by default
    let source = `${this.dirA}/${this.relativePath}`;
    let target = `${this.dirB}/${this.relativePath}`;
    if (this.strategy === "r2l") {
      source = `${this.dirB}/${this.relativePath}`;
      target = `${this.dirA}/${this.relativePath}`;
    } else if (this.strategy === "newest") {
      if (this.dirAInfo && this.dirBInfo) {
        if (this.dirAInfo.modified > this.dirBInfo.modified) {
          source = `${this.dirA}/${this.relativePath}`;
          target = `${this.dirB}/${this.relativePath}`;
        } else {
          source = `${this.dirB}/${this.relativePath}`;
          target = `${this.dirA}/${this.relativePath}`;
        }
      } else if (this.dirAInfo && !this.dirBInfo) {
        source = `${this.dirA}/${this.relativePath}`;
        target = `${this.dirB}/${this.relativePath}`;
      } else if (!this.dirAInfo && this.dirBInfo) {
        source = `${this.dirB}/${this.relativePath}`;
        target = `${this.dirA}/${this.relativePath}`;
      }
    }

    await window.ipcRenderer.invoke("start-copy", source, target);
  }
}

/**
 * 扫描两个目录 dirA 和 dirB，递归比较它们的文件（基于相对路径）。
 * 不一致的文件包括：
 *   - 文件仅存在于其中一边
 *   - 文件在两边都存在，但文件大小或修改时间不同
 * 返回一个包含 FileSyncItem 对象的数组，每个对象都带有 sync() 方法以便根据策略执行同步。
 */
async function syncDirectories(
  dirA: string,
  dirB: string
): Promise<FileSyncItem[]> {
  const mapA: Map<string, FileInfo> = await window.ipcRenderer.invoke(
    "getFileInfos",
    dirA
  );
  const mapB: Map<string, FileInfo> = await window.ipcRenderer.invoke(
    "getFileInfos",
    dirB
  );

  const allFiles = new Set<string>([...mapA.keys(), ...mapB.keys()].sort());
  const result: FileSyncItem[] = [];

  for (const relativePath of allFiles) {
    const infoA = mapA.get(relativePath) || null;
    const infoB = mapB.get(relativePath) || null;

    // 如果两边都存在且大小和修改时间一致，则认为文件内容相同，跳过
    if (infoA && infoB) {
      if (
        infoA.size === infoB.size &&
        infoA.modified.getTime() === infoB.modified.getTime()
      ) {
        continue;
      }
    }

    const item = new FileSyncItem(relativePath, dirA, dirB, infoA, infoB);
    result.push(item);
  }

  return result;
}

export { FileSyncItem, syncDirectories };
