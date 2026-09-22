import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // DB
  MONGODB_URI: Joi.string().uri().required(),
  DB_TYPE: Joi.string().valid('mongodb').default('mongodb'),

  // JWT
  JWT_SECRET: Joi.string()
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .min(32)
        .invalid('your_jwt_secret_key_here', 'mmx-secret'),
    }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Server
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  CORS_ORIGINS: Joi.string().allow('').optional(),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // AI
  DEEPSEEK_API_KEY: Joi.string()
    .required()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().invalid('your_deepseek_api_key_here'),
    }),
  DEEPSEEK_MODEL: Joi.string().default('deepseek-chat'),
  PAYMENT_MODE: Joi.string().valid('disabled', 'virtual').default('disabled'),
  MAX_TOKENS: Joi.number().default(4000),
});
