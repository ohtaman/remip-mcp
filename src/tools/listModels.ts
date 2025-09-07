import { StorageService } from '../app/storage.js';
import { Model } from '../schemas/models.js';

export async function listModels(
  sessionId: string,
  params: {},
  services: { storageService: StorageService },
): Promise<Model[]> {
  return services.storageService.listModels(sessionId);
}
