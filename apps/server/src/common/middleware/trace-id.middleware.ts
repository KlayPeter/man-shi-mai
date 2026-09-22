import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// 使用 AsyncLocalStorage 来存储 TraceID
// 这样任何地方都能访问到它，而不用传参
export const traceIdStorage = new AsyncLocalStorage<string>();

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TraceIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const routePath = (req.originalUrl || req.path).split('?')[0];
    // 从请求头中获取 TraceID，如果没有就生成一个
    const requestedTraceId = req.headers['x-trace-id'];
    const traceId =
      typeof requestedTraceId === 'string' &&
      /^[A-Za-z0-9_-]{1,64}$/.test(requestedTraceId)
        ? requestedTraceId
        : uuidv4();

    // 将 TraceID 存储在 AsyncLocalStorage 中
    // 这样 Service 中就能访问到它
    traceIdStorage.run(traceId, () => {
      // 将 TraceID 加到响应头中，前端可以看到
      res.setHeader('x-trace-id', traceId);

      // 记录请求开始
      this.logger.log(`[${traceId}] 请求开始: ${req.method} ${routePath}`);

      // 监听响应完成
      res.on('finish', () => {
        this.logger.log(
          `[${traceId}] 请求结束: ${req.method} ${routePath} - 状态码: ${res.statusCode}`,
        );
      });

      next();
    });
  }
}
