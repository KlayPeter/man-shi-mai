import { configValidationSchema } from '../../src/config/config.schema';

describe('startup configuration', () => {
  const config = {
    MONGODB_URI: 'mongodb://127.0.0.1:27028/test',
    JWT_SECRET: 'local-test-secret',
    DEEPSEEK_API_KEY: 'test-only',
  };
  it('accepts an isolated test environment with documented defaults', () => {
    const result = configValidationSchema.validate({
      ...config,
      NODE_ENV: 'test',
    });
    expect(result.error).toBeUndefined();
    expect(result.value.PORT).toBe(3000);
  });
  it.each(['MONGODB_URI', 'JWT_SECRET', 'DEEPSEEK_API_KEY'])(
    'fails early without %s',
    (key) => {
      expect(
        configValidationSchema.validate({ ...config, [key]: undefined }).error,
      ).toBeDefined();
    },
  );
  it('rejects a weak production JWT secret', () => {
    expect(
      configValidationSchema.validate({ ...config, NODE_ENV: 'production' })
        .error,
    ).toBeDefined();
  });
});
