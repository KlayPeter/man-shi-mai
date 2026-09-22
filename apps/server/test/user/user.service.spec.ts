import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../src/user/user.service';
import { User } from '../../src/user/schemas/user.schema';
import { ConsumptionRecord } from '../../src/interview/schemas/consumption-record.schema';
import { UserConsumption } from '../../src/user/schemas/consumption-record.schema';
import { PaymentRecord } from '../../src/payment/payment-record.schema';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let userModel: any;
  let consumptionRecordModel: any;
  let userConsumptionModel: any;
  let paymentRecordModel: any;
  let jwtService: any;

  const mockUserDoc = {
    _id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedpassword',
    comparePassword: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    }),
    save: jest.fn().mockResolvedValue(true),
  };

  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
    exec: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    // Mock user model as both a constructor and query handler
    const mockUserModelConstructor = jest
      .fn()
      .mockImplementation(() => mockUserDoc);
    const mockUserModel = Object.assign(mockUserModelConstructor, {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    });

    const mockConsumptionRecordModel = {
      find: jest.fn().mockReturnValue(mockQuery),
      aggregate: jest.fn().mockResolvedValue([]),
    };

    const mockUserConsumptionInstance = {
      save: jest.fn().mockResolvedValue({
        userId: 'user-123',
        type: 'test-type',
        quantity: 1,
        source: 'free',
        _id: 'record-123',
      }),
    };
    const mockUserConsumptionModel = jest
      .fn()
      .mockImplementation(() => mockUserConsumptionInstance);

    const mockPaymentRecordModel = {
      find: jest.fn().mockReturnValue(mockQuery),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(ConsumptionRecord.name),
          useValue: mockConsumptionRecordModel,
        },
        {
          provide: getModelToken(UserConsumption.name),
          useValue: mockUserConsumptionModel,
        },
        {
          provide: getModelToken(PaymentRecord.name),
          useValue: mockPaymentRecordModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get(getModelToken(User.name));
    consumptionRecordModel = module.get(getModelToken(ConsumptionRecord.name));
    userConsumptionModel = module.get(getModelToken(UserConsumption.name));
    paymentRecordModel = module.get(getModelToken(PaymentRecord.name));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a user successfully', async () => {
      userModel.findOne.mockResolvedValue(null);

      const result = await service.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(userModel.findOne).toHaveBeenCalled();
      expect(result).toEqual({
        _id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    it('should throw BadRequestException if username or email already exists', async () => {
      userModel.findOne.mockResolvedValue(mockUserDoc);

      await expect(
        service.register({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should return token and user info on successful login', async () => {
      userModel.findOne.mockResolvedValue(mockUserDoc);
      mockUserDoc.comparePassword.mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user).toBeDefined();
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      userModel.findOne.mockResolvedValue(mockUserDoc);
      mockUserDoc.comparePassword.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserInfo', () => {
    it('should return user info without password if user exists', async () => {
      const mockLeanQuery = {
        lean: jest.fn().mockResolvedValue({
          _id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          password: 'hashedpassword',
        }),
      };
      userModel.findById.mockReturnValue(mockLeanQuery);

      const result = await service.getUserInfo('user-123');
      expect(result.password).toBeUndefined();
      expect(result.username).toBe('testuser');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const mockLeanQuery = {
        lean: jest.fn().mockResolvedValue(null),
      };
      userModel.findById.mockReturnValue(mockLeanQuery);

      await expect(service.getUserInfo('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.findByIdAndUpdate.mockResolvedValue({
        _id: 'user-123',
        username: 'updateduser',
        email: 'updated@example.com',
      });

      const result = await service.updateUser('user-123', {
        username: 'updateduser',
        email: 'updated@example.com',
      });

      expect(result.username).toBe('updateduser');
    });

    it('should throw BadRequestException if new email is already in use', async () => {
      userModel.findOne.mockResolvedValue({ _id: 'other-user' });

      await expect(
        service.updateUser('user-123', {
          email: 'inuse@example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createConsumptionRecord', () => {
    it('should create and save user consumption record', async () => {
      const result = await service.createConsumptionRecord(
        'user-123',
        'test-type',
      );
      expect(result._id).toBe('record-123');
      expect(result.userId).toBe('user-123');
    });
  });

  describe('getUserConsumptionRecords', () => {
    it('should query consumption records and aggregate stats', async () => {
      const records = [{ _id: 'rec-1', userId: 'user-123', type: 'interview' }];
      const stats = [{ _id: 'interview', count: 1 }];

      // Mock chain find -> sort -> skip -> limit -> lean
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(records),
      };
      consumptionRecordModel.find.mockReturnValue(mockChain);
      consumptionRecordModel.aggregate.mockResolvedValue(stats);

      const result = await service.getUserConsumptionRecords('user-123');
      expect(result.records).toEqual(records);
      expect(result.stats).toEqual(stats);
    });
  });

  describe('getUserTransactions', () => {
    it('should query payment records sorted by creation date', async () => {
      const transactions = [{ _id: 'tx-1', amount: 100 }];
      const mockChain = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(transactions),
      };
      paymentRecordModel.find.mockReturnValue(mockChain);

      const result = await service.getUserTransactions('user-123');
      expect(result).toEqual(transactions);
    });
  });
});
