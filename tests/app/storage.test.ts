
import { StorageService } from '@app/storage';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
  });

  it('should set and get a value', () => {
    const sessionId = 'session1';
    const key = 'mykey';
    const value = { data: 'mydata' };

    storage.set(sessionId, key, value);
    const retrieved = storage.get(sessionId, key);

    expect(retrieved).toEqual(value);
  });

  it('should return undefined for a non-existent key', () => {
    const sessionId = 'session1';
    const key = 'nonexistent';

    const retrieved = storage.get(sessionId, key);

    expect(retrieved).toBeUndefined();
  });

  it('should not allow one session to access another session\'s data', () => {
    const sessionId1 = 'session1';
    const sessionId2 = 'session2';
    const key = 'mykey';
    const value1 = { data: 'mydata1' };
    const value2 = { data: 'mydata2' };

    storage.set(sessionId1, key, value1);
    storage.set(sessionId2, key, value2);

    const retrieved1 = storage.get(sessionId1, key);
    const retrieved2 = storage.get(sessionId2, key);

    expect(retrieved1).toEqual(value1);
    expect(retrieved2).toEqual(value2);
    expect(storage.get('nonexistent', key)).toBeUndefined();
  });

  it('should delete a value', () => {
    const sessionId = 'session1';
    const key = 'mykey';
    const value = { data: 'mydata' };

    storage.set(sessionId, key, value);
    storage.delete(sessionId, key);
    const retrieved = storage.get(sessionId, key);

    expect(retrieved).toBeUndefined();
  });

  it('should clear all data for a specific session', () => {
    const sessionId1 = 'session1';
    const sessionId2 = 'session2';

    // Set data for two different sessions
    storage.set(sessionId1, 'key1', 'value1');
    storage.set(sessionId1, 'key2', 'value2');
    storage.set(sessionId2, 'key1', 'value3');

    // Clear session 1
    const deletedCount = storage.clearSession(sessionId1);
    expect(deletedCount).toBe(2);

    // Check that session 1 data is gone
    expect(storage.get(sessionId1, 'key1')).toBeUndefined();
    expect(storage.get(sessionId1, 'key2')).toBeUndefined();

    // Check that session 2 data is still there
    expect(storage.get(sessionId2, 'key1')).toEqual('value3');
  });
});
