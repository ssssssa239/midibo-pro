import { openDB, IDBPDatabase } from 'idb';
import { InstrumentProfile } from '../types/midiboProfile';
import { DEFAULT_PROFILES } from '../constants/defaultProfiles';

const DB_NAME = 'midibo27_db';
const DB_VERSION = 1;
const STORE_NAME = 'profiles';

export class ProfileStorage {
  private static instance: ProfileStorage;
  private dbPromise: Promise<IDBPDatabase>;

  private constructor() {
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          // id をプライマリキーとするオブジェクトストアを作成
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      }
    });
  }

  public static getInstance(): ProfileStorage {
    if (!ProfileStorage.instance) {
      ProfileStorage.instance = new ProfileStorage();
    }
    return ProfileStorage.instance;
  }

  /**
   * 全プロファイルを取得（DBが空なら初期デフォルトプロファイルを投入して返す）
   */
  public async loadAllProfiles(): Promise<InstrumentProfile[]> {
    const db = await this.dbPromise;
    const all = await db.getAll(STORE_NAME);

    if (all.length === 0) {
      // 初期シードとして DEFAULT_PROFILES を一括保存
      const tx = db.transaction(STORE_NAME, 'readwrite');
      for (const p of DEFAULT_PROFILES) {
        await tx.store.put(p);
      }
      await tx.done;
      return DEFAULT_PROFILES;
    }

    return all;
  }

  /**
   * 単一プロファイルを保存（新規追加または更新）
   */
  public async saveProfile(profile: InstrumentProfile): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, profile);
  }

  /**
   * 複数のプロファイルを一括保存
   */
  public async saveAllProfiles(profiles: InstrumentProfile[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const p of profiles) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  /**
   * プロファイルを削除
   */
  public async deleteProfile(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }
}