import { StorageService } from '../app/storage.js';
import { Model } from '../schemas/models.js';

interface DefineModelParams {
  model_name: string;
  model_code: string;
  inputs: string[];
}

interface DefineModelServices {
  storageService: StorageService;
}

export async function defineModel(
  sessionId: string,
  params: DefineModelParams,
  services: DefineModelServices,
) {
  if (!params.model_name || params.model_name.trim().length === 0) {
    throw new Error('Model name cannot be empty.');
  }

  const { storageService } = services;

  const model: Model = {
    name: params.model_name,
    code: params.model_code,
    type: 'pulp.LpProblem',
    inputs: params.inputs,
  };

  storageService.setModel(sessionId, model);

  return {
    status: 'ok',
    model_name: model.name,
    model_type: model.type,
  };
}
