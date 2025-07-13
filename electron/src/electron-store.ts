import { app } from "electron";
import path from "path";
import fs from "fs";

/**
 * 一个轻量级的、仅在主进程使用的 Electron 数据存储类。
 * 数据被缓存在内存中，只有在调用 save() 方法时才会写入磁盘。
 */
export default class Store<
  T extends Record<string, any> = Record<string, any>
> {
  private readonly path: string;
  private _data: T;

  /**
   * 创建一个 Store 实例。
   * @param configName - 配置文件的名称（不含.json后缀）。文件将存储在 app.getPath('userData') 目录下。
   */
  constructor(configName: string = "config") {
    // 获取 userData 目录路径
    const userDataPath = app.getPath("userData");
    // 拼接完整的配置文件路径
    this.path = path.join(userDataPath, `${configName}.json`);

    // 从磁盘加载现有数据
    this._data = this.loadDataFromFile();
  }

  /**
   * 从磁盘加载数据。如果文件不存在或数据损坏，则返回一个空对象。
   * @returns 解析后的数据对象。
   */
  private loadDataFromFile(): T {
    try {
      // 检查文件是否存在
      if (fs.existsSync(this.path)) {
        return JSON.parse(fs.readFileSync(this.path, { encoding: "utf-8" }));
      }
    } catch (error) {
      // 如果文件损坏或解析失败，打印错误并返回空对象
      console.error(`Error reading or parsing store file: ${this.path}`, error);
    }
    // 文件不存在或发生错误时返回一个空对象
    return {} as T;
  }

  /**
   * 获取指定键的值。
   * @param key - 要获取的键。
   * @param defaultValue - 如果键不存在时返回的默认值。
   * @returns 返回键对应的值，如果不存在则返回默认值或 undefined。
   */
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
    return this._data[key] !== undefined ? this._data[key] : defaultValue;
  }

  /**
   * 设置一个键值对。数据仅保存在内存中，需要调用 save() 来持久化。
   * @param key - 要设置的键。
   * @param value - 要设置的值。
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this._data[key] = value;
  }

  /**
   * 删除一个键。操作仅在内存中进行，需要调用 save() 来持久化。
   * @param key - 要删除的键。
   */
  delete<K extends keyof T>(key: K): void {
    delete this._data[key];
  }

  /**
   * 将当前内存中的数据同步写入到磁盘上的JSON文件中。
   * 为了保证数据可读性，会进行格式化存储。
   */
  save(): void {
    try {
      // 确保目录存在
      fs.mkdirSync(path.dirname(this.path), { recursive: true });
      // 将数据格式化为JSON字符串并写入文件
      fs.writeFileSync(this.path, JSON.stringify(this._data, null, 2));
    } catch (error) {
      console.error(`Error saving store file: ${this.path}`, error);
    }
  }

  /**
   * 提供对内部数据存储的只读访问，支持遍历。
   * 例如：Object.entries(store.store).forEach(...)
   */
  get store(): T {
    return this._data;
  }
}
