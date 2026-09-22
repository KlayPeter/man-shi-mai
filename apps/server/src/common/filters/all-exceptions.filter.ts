import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp(); // 获取HTTP上下文
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR; // 默认状态码500
    let message = '服务器内部错误';
    let error: any = null;

    // 处理HttpException类型的异常
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const responseIbj = exceptionResponse as any;
        message = responseIbj.message || '请求失败';
        error = responseIbj.error || null;
      }
    }
    // 处理其他异常
    else if (exception instanceof Error) {
      // 未知异常可能包含数据库连接串、供应商返回体或简历文本。
      this.logger.error(`未处理的异常类型：${exception.name}`);
    }

    // 记录异常日志
    this.logger.error(
      `请求错误: ${request.method} ${request.path} - 状态码: ${status} - 消息: ${message}`,
    );

    // 返回统一标准错误响应格式
    const errorResponse = {
      code: status,
      message: Array.isArray(message) ? message[0] : message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.path,
      ...(error && { error }), // 如果有额外错误信息，则包含在响应中
    };
    response.status(status).json(errorResponse);
  }
}
