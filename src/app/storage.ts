
import NodeCache from 'node-cache';

export class StorageService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache();
  }

  private getKey(sessionId: string, key: string): string {
    return `${sessionId}:${key}`;
  }

  public set<T>(sessionId: string, key: string, value: T): void {
    this.cache.set(this.getKey(sessionId, key), value);
  }

  public get<T>(sessionId: string, key: string): T | undefined {
    return this.cache.get<T>(this.getKey(sessionId, key));
  }

  public delete(sessionId: string, key: string): void {
    this.cache.del(this.getKey(sessionId, key));
  }

  public clearSession(sessionId: string): number {
    const keysToDelete = this.cache.keys().filter(key => key.startsWith(`${sessionId}:`));
    if (keysToDelete.length > 0) {
      return this.cache.del(keysToDelete);
    }
    return 0;
  }
}
