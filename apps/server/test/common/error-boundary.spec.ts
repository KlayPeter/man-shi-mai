import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { TraceIdMiddleware } from '../../src/common/middleware/trace-id.middleware';

describe('HTTP error and trace boundaries', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does not disclose unknown exception details or query text in a 500 response or logs', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      method: 'POST',
      path: '/interview/resume/quiz/stream',
      url: '/interview/resume/quiz/stream?resume=private-text',
    } as Request;
    const response = { status } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(
      new Error('private-text mongodb://user:password@host'),
      host,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '服务器内部错误',
        path: request.path,
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('private-text');
    expect(JSON.stringify(logged.mock.calls)).not.toContain('private-text');
    expect(JSON.stringify(logged.mock.calls)).not.toContain('password');
  });

  it('keeps explicit client errors actionable', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', path: '/interview/mock/start' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(
      new BadRequestException('请选择目标岗位'),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '请选择目标岗位' }),
    );
  });

  it('replaces an unsafe trace header and never logs URL query data', () => {
    const logged = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const setHeader = jest.fn();
    const on = jest.fn();
    const response = { setHeader, on, statusCode: 200 } as unknown as Response;
    const request = {
      headers: { 'x-trace-id': 'unsafe value with spaces' },
      method: 'GET',
      path: '/history',
      originalUrl: '/history?resume=private-text',
      url: '/history?resume=private-text',
    } as unknown as Request;
    const next = jest.fn();
    new TraceIdMiddleware().use(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(setHeader.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(logged.mock.calls)).toContain('/history');
    expect(JSON.stringify(logged.mock.calls)).not.toContain('private-text');
  });
});
