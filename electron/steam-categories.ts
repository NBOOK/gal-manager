// steam-categories.ts
// import { Level } from "level";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Level } = require("level");
import iconv from "iconv-lite";

/** 单个集合项的数据结构 */
export interface CollectionData {
  key: string;
  timestamp: number;
  value: any;
  conflictResolutionMethod: string;
  strMethodId: string;
}

/** 一个命名空间下的集合映射 */
export interface CollectionMap {
  [collectionKey: string]: CollectionData;
}

/** 所有命名空间对应的集合数据 */
export interface Collections {
  [namespace: string]: CollectionMap;
}

export class SteamCategories {
  private db?: typeof Level.prototype;
  private dbPath: string;
  private steam3Id: string;
  private namespaceKeys: string[] = [];
  public collections: Collections = {};
  public collectionsFiltered: Collections = {};
  private keyPrefix: string;

  constructor(dbPath: string, steamid: string) {
    // console.log("SteamCategories constructor", dbPath, steamid);
    this.dbPath = dbPath;
    this.steam3Id = steamid;
    this.keyPrefix = `_https://steamloopback.host\u0000\u0001U${this.steam3Id}-cloud-storage-namespace`;
    // console.log("SteamCategories constructor", this.keyPrefix);
  }

  /**
   * 读取 LevelDB 数据，获取所有命名空间下的集合数据
   */
  async read(): Promise<Record<string, any>> {
    this.db = new Level(this.dbPath, { valueEncoding: "hex" });

    const nsKey = `${this.keyPrefix}s`;
    const nsValue = await this.db.get(nsKey, { valueEncoding: "utf8" });
    this.namespaceKeys = JSON.parse(nsValue.slice(1)).map(
      (x: any) => `${this.keyPrefix}-${x[0]}`
    );

    const collections: Record<string, any> = {};

    const iterator = this.db.iterator({
      gte: `${this.keyPrefix}-`,
      lte: `${this.keyPrefix}-~`,
    });

    for await (const [key, value] of iterator) {
      if (this.namespaceKeys.includes(key)) {
        const id = key.replace(`${this.keyPrefix}-`, "");
        if (!["00", "01"].includes(value.substring(0, 2))) {
          throw new Error("Illegal BOM");
        }
        try {
          collections[id] = this.unserializeCollections(value);
        } catch (err) {
          throw err;
        }
      }
    }

    this.collections = collections;
    return collections;
  }

  /**
   * 返回所有集合名称列表（去除了前缀 "user-collections."）
   */
  list(): string[] {
    const names: string[] = [];
    for (const collection of Object.values(this.collections)) {
      for (const key of Object.keys(collection)) {
        if (key.includes("from-tag-"))
          names.push(key.replace("user-collections.from-tag-", ""));
      }
    }
    return names;
  }

  /**
   * 删除指定 id 的集合项，删除成功返回 true，否则返回 false
   */
  remove(collectionId: string): boolean {
    for (const namespace in this.collections) {
      if (`user-collections.${collectionId}` in this.collections[namespace]) {
        delete this.collections[namespace][`user-collections.${collectionId}`];
        return true;
      }
    }
    return false;
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }

  /**
   * 判断数据库是否已关闭（基于 level 内部的 status 属性）
   */
  isClosed(): boolean {
    return this.db?.status === "closed";
  }

  /**
   * 判断数据库是否处于打开状态
   */
  isOpen(): boolean {
    return this.db?.status === "open";
  }

  /**
   * 根据集合 id 获取对应的数据，若不存在则返回 false
   */
  get(id: string): CollectionData | false {
    const key = `user-collections.${id}`;
    for (const collection of Object.values(this.collections)) {
      if (key in collection) {
        return collection[key];
      }
    }
    return false;
  }

  /**
   * 添加一个新的集合项，返回添加的数据对象
   */
  add(id: string, values: object): CollectionData {
    const data: CollectionData = {
      key: `user-collections.${id}`,
      timestamp: Math.ceil(Date.now() / 1000),
      value: { id, ...values },
      conflictResolutionMethod: "custom",
      strMethodId: "union-collections",
    };

    // 如果没有任何命名空间，则新建一个 default 命名空间
    const namespaceKeys = Object.keys(this.collections);
    if (namespaceKeys.length === 0) {
      this.collections["default"] = {};
      this.collections["default"][data.key] = data;
    } else {
      // 默认添加到最后一个命名空间下
      const lastKey = namespaceKeys[namespaceKeys.length - 1];
      this.collections[lastKey][data.key] = data;
    }
    return data;
  }

  /**
   * 将内存中修改后的集合数据写回 LevelDB
   */
  async save(): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    const promises = Object.entries(this.collections).map(
      ([namespace, collection]) => {
        const fullKey = `${this.keyPrefix}-${namespace}`;
        const serialized = this.serializeCollections(collection);
        return this.db!.put(fullKey, serialized);
      }
    );
    await Promise.all(promises);
  }

  /**
   * 序列化传入的集合数据为一个 hex 格式字符串
   * 先将集合对象转换为数组，再 JSON 序列化，然后用 utf16le 编码转为 hex 字符串，并在前面添加 '00' 作为 BOM 标记
   */
  serializeCollections(collection: CollectionMap): string {
    const output: [string, CollectionData][] = [];
    for (const [key, data] of Object.entries(collection)) {
      // 为避免直接修改原对象，这里做个浅拷贝
      const dataCopy: CollectionData = { ...data };
      if (dataCopy.value) {
        dataCopy.value = JSON.stringify(dataCopy.value);
      }
      output.push([key, dataCopy]);
    }
    const jsonString = JSON.stringify(output);
    const encoded = iconv.encode(jsonString, "utf16le").toString("hex");
    return `00${encoded}`;
  }

  /**
   * 将 hex 字符串反序列化还原为集合数据对象
   * 支持 '00' 与 '01' 两种 BOM 格式
   */
  unserializeCollections(input: string): CollectionMap {
    let transformed: string;
    if (input.substring(0, 2) === "01") {
      const matches = input.slice(2).match(/.{1,2}/g);
      if (!matches) {
        throw new Error("Invalid input format");
      }
      transformed = matches.join("00") + "00";
    } else {
      transformed = input.slice(2);
    }
    const buffer = Buffer.from(transformed, "hex");
    const decoded = iconv.decode(buffer, "utf16le");
    const arr: [string, CollectionData][] = JSON.parse(decoded);
    const output: CollectionMap = {};
    for (const [key, data] of arr) {
      const dataCopy: CollectionData = { ...data };
      if (dataCopy.value) {
        dataCopy.value = JSON.parse(dataCopy.value);
      }
      output[key] = dataCopy;
    }
    return output;
  }
}
