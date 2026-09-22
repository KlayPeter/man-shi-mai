import { configValidationSchema } from '../../src/config/config.schema';
import { corsOrigins } from '../../src/config/cors-origins';

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
  it('rejects the example AI key in production', () => {
    expect(
      configValidationSchema.validate({
        ...config,
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
        DEEPSEEK_API_KEY: 'your_deepseek_api_key_here',
      }).error,
    ).toBeDefined();
  });
});

describe('browser origins', () => {
  it('defaults to no cross-origin browser access in production', () => {
    expect(corsOrigins('production')).toEqual([]);
    expect(corsOrigins('development')).toContain('http://localhost:8000');
  });
  it('accepts only explicit full origins and removes duplicates', () => {
    expect(
      corsOrigins(
        'production',
        'https://app.example.test,https://app.example.test',
      ),
    ).toEqual(['https://app.example.test']);
    for (const value of [
      '*',
      'https://app.example.test/path',
      'https://user:secret@app.example.test',
      'javascript:alert(1)',
    ]) {
      expect(() => corsOrigins('production', value)).toThrow();
    }
  });
});
