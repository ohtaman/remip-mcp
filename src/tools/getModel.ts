import { StorageService } from '../app/storage.js';
import { Model } from '../schemas/models.js';

export async function getModel(
  sessionId: string,
  params: { model_name: string },
  services: { storageService: StorageService },
): Promise<Model> {
  const model = services.storageService.getModel(sessionId, params.model_name);
  if (!model) {
    throw new Error(`Model not found: ${params.model_name}`);
  }
  return model;
}
