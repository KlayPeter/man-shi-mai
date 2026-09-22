import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../../src/auth/jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return mapped user details from token payload', async () => {
      const payload = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      const result = await strategy.validate(payload);
      expect(result).toEqual({
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });
  });
});
