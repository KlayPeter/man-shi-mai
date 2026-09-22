import { ConfigService } from '@nestjs/config';
import { ChatDeepSeek } from '@langchain/deepseek';
import { AIModelFactory } from '../../src/ai/services/ai-model.factory';

jest.mock('@langchain/deepseek', () => ({ ChatDeepSeek: jest.fn() }));

describe('AIModelFactory', () => {
  const chatDeepSeek = ChatDeepSeek as jest.MockedClass<typeof ChatDeepSeek>;

  beforeEach(() => jest.clearAllMocks());

  it('uses the current default model and configured token limit', () => {
    const values: Record<string, string | number> = {
      DEEPSEEK_API_KEY: 'test-only',
      MAX_TOKENS: 1200,
      DEEPSEEK_TEMPERATURE: 0,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    new AIModelFactory(config).createDefaultModel();

    expect(chatDeepSeek).toHaveBeenCalledWith({
      apiKey: 'test-only',
      model: 'deepseek-flash',
      temperature: 0,
      maxTokens: 1200,
    });
  });

  it('fails before creating a model when the API key is absent', () => {
    const config = { get: jest.fn() } as unknown as ConfigService;
    expect(() => new AIModelFactory(config).createDefaultModel()).toThrow(
      'DEEPSEEK_API_KEY 不存在',
    );
    expect(chatDeepSeek).not.toHaveBeenCalled();
  });
});
