import { defineModel } from '../../src/tools/defineModel';
import { StorageService } from '../../src/app/storage';
import { Model } from '../../src/schemas/models';

jest.mock('../../src/app/storage');

describe('defineModel Tool', () => {
  let storageService: jest.Mocked<StorageService>;
  const sessionId = 'test-session';

  beforeEach(() => {
    storageService = new StorageService() as jest.Mocked<StorageService>;
    // Mock the implementation of setModel for verification
    storageService.setModel = jest.fn();
  });

  it('should call StorageService.setModel with the correct parameters', async () => {
    const params = {
      model_name: 'my_model',
      model_code: 'x = 1',
      inputs: ['a', 'b'],
    };

    await defineModel(sessionId, params, { storageService });

    const expectedModel: Model = {
      name: params.model_name,
      code: params.model_code,
      type: 'pulp.LpProblem',
      inputs: params.inputs,
    };

    expect(storageService.setModel).toHaveBeenCalledTimes(1);
    expect(storageService.setModel).toHaveBeenCalledWith(sessionId, expectedModel);
  });

  it('should return a success status object', async () => {
    const params = {
      model_name: 'my_model',
      model_code: 'x = 1',
      inputs: ['a', 'b'],
    };

    const result = await defineModel(sessionId, params, { storageService });

    expect(result).toEqual({
      status: 'ok',
      model_name: 'my_model',
      model_type: 'pulp.LpProblem',
    });
  });

  it('should throw an error if the model_name is empty', async () => {
    const params = {
      model_name: '',
      model_code: 'x = 1',
      inputs: ['a', 'b'],
    };

    await expect(
      defineModel(sessionId, params, { storageService })
    ).rejects.toThrow('Model name cannot be empty.');
  });
});
