import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { WechatModule } from './wechat/wechat.module';
import { PaymentModule } from './payment/payment.module';
import { StsModule } from './sts/sts.module';
import { InterviewModule } from './interview/interview.module';
import { ResumeModule } from './resume/resume.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtStrategy } from './auth/jwt.strategy';
import { getTokenExpirationSeconds } from './common/utils/jwt.util';
import { TraceIdMiddleware } from './common/middleware/trace-id.middleware';
import { configValidationSchema } from './config/config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.development',
      ignoreEnvFile: ['production', 'test'].includes(
        process.env.NODE_ENV || '',
      ),
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.ms(),
        winston.format.json(),
      ),
      defaultMeta: {
        service: 'manshimai-server',
      },
      transports: [new winston.transports.Console()],
    }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const expirationSeconds = getTokenExpirationSeconds();
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expirationSeconds,
          },
        };
      },
      inject: [ConfigService],
      global: true,
    }),
    UserModule,
    WechatModule,
    PaymentModule,
    StsModule,
    InterviewModule,
    ResumeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
