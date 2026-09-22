import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService {
  constructor(private readonly configService: ConfigService) {}

  getConnectionInfo(): string {
    return this.configService.getOrThrow<string>('MONGODB_URI');
  }

  getPort(): number {
    return this.configService.get<number>('PORT', 3000);
  }
}
