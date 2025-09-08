import { defineModel } from '../../src/tools/defineModel.js';
import { StorageService } from '../../src/app/storage.js';

describe('defineModel Tool', () => {
  let storageService: StorageService;
  const sessionId = 'test-session';

  beforeEach(() => {
    storageService = new StorageService();
  });

  it('should define a new model and store it correctly', async () => {
    const params = {
      model_name: 'my_model',
      model_code: 'x = 1',
      inputs: ['a'],
    };
    await defineModel(sessionId, params, { storageService });

    const model = storageService.getModel(sessionId, 'my_model');
    expect(model).toBeDefined();
    expect(model?.name).toBe('my_model');
    expect(model?.code).toBe('x = 1');
    expect(model?.inputs).toEqual(['a']);
  });

  it('should throw an error if model_name is empty', async () => {
    const params = { model_name: '', model_code: 'x=1', inputs: [] };
    await expect(
      defineModel(sessionId, params, { storageService }),
    ).rejects.toThrow('Model name cannot be empty.');
  });

  it('should store the model_code exactly as provided, without truncation', async () => {
    const fullCode = `# 1. Create the problem variable
# We want to maximize, so we use LpMaximize
model = LpProblem("FurnitureProduction", LpMaximize)`;

    const params = {
      model_name: 'furniture',
      model_code: fullCode,
      inputs: [],
    };
    await defineModel(sessionId, params, { storageService });

    const model = storageService.getModel(sessionId, 'furniture');
    expect(model?.code).toBe(fullCode);
  });
});
