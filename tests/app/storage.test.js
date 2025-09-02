import { StorageService } from '@app/storage';
describe('StorageService', () => {
    let storage;
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
});
