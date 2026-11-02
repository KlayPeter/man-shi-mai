import { ConfigService } from '@nestjs/config';
import WebSocket, { WebSocketServer } from 'ws';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { DashscopeSpeechService } from '../../src/interview/services/dashscope-speech.service';

class LocalSpeech extends DashscopeSpeechService {
  constructor(private readonly url: string) {
    super(new ConfigService({ DASHSCOPE_API_KEY: 'test-only' }));
  }
  protected connect(key: string) {
    return new WebSocket(this.url, {
      headers: { Authorization: `Bearer ${key}` },
    });
  }
}
const wav = Buffer.alloc(100);
wav.write('RIFF');
wav.write('WAVE', 8);

describe('DashScope WebSocket protocol (local server only)', () => {
  let server: WebSocketServer;
  let service: LocalSpeech;
  beforeEach(async () => {
    server = new WebSocketServer({ port: 0 });
    await once(server, 'listening');
    service = new LocalSpeech(
      `ws://127.0.0.1:${(server.address() as AddressInfo).port}`,
    );
  });
  afterEach(async () => {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it('sends complete Sambert text and collects binary audio without finish-task', async () => {
    server.on('connection', (socket, req) => {
      expect(req.headers.authorization).toBe('Bearer test-only');
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.header).toMatchObject({
          action: 'run-task',
          streaming: 'out',
        });
        expect(message.payload).toMatchObject({
          model: 'sambert-zhida-v1',
          input: { text: '你好' },
          parameters: { format: 'wav', sample_rate: 16000 },
        });
        const header = { task_id: message.header.task_id };
        socket.send(
          JSON.stringify({ header: { ...header, event: 'task-started' } }),
        );
        socket.send(wav.subarray(0, 50));
        socket.send(wav.subarray(50));
        socket.send(
          JSON.stringify({ header: { ...header, event: 'task-finished' } }),
        );
      });
    });
    await expect(service.synthesize('你好')).resolves.toEqual(wav);
  });
  it('sends PCM after task-started and keeps final sentences in order without duplicates', async () => {
    let received = 0;
    server.on('connection', (socket) => {
      let taskId = '';
      const send = (event: string, payload = {}) =>
        socket.send(
          JSON.stringify({ header: { event, task_id: taskId }, payload }),
        );
      socket.on('message', (data, binary) => {
        if (binary) {
          received += data.length;
          return;
        }
        const message = JSON.parse(data.toString());
        taskId = message.header.task_id;
        if (message.header.action === 'run-task') {
          expect(message.payload.model).toBe('paraformer-realtime-v2');
          expect(received).toBe(0);
          send('task-started');
        } else {
          expect(message.header.action).toBe('finish-task');
          expect(received).toBe(32000);
          for (const sentence of [
            { begin_time: 0, sentence_end: false, text: '临时' },
            { begin_time: 1000, sentence_end: true, text: '第二句。' },
            { begin_time: 0, sentence_end: true, text: '第一句。' },
            { begin_time: 0, sentence_end: true, text: '第一句。' },
          ])
            send('result-generated', { output: { sentence } });
          send('task-finished');
        }
      });
    });
    await expect(service.recognize(Buffer.alloc(32000))).resolves.toBe(
      '第一句。第二句。',
    );
  });
  it('maps quota exhaustion without leaking provider text', async () => {
    server.on('connection', (socket) =>
      socket.on('message', (data) => {
        const { header } = JSON.parse(data.toString());
        socket.send(
          JSON.stringify({
            header: {
              task_id: header.task_id,
              event: 'task-failed',
              error_code: 'AllocationQuota.FreeTierOnly',
              error_message: 'private upstream content',
            },
          }),
        );
      }),
    );
    await expect(service.synthesize('你好')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('额度'),
    });
  });
  it('rejects malformed frames and closed connections rather than returning partial success', async () => {
    server.on('connection', (socket) =>
      socket.on('message', () => socket.send('invalid json')),
    );
    await expect(service.synthesize('你好')).rejects.toMatchObject({
      status: 502,
    });
    server.removeAllListeners('connection');
    server.on('connection', (socket) =>
      socket.on('message', () => socket.close()),
    );
    await expect(service.synthesize('你好')).rejects.toMatchObject({
      status: 502,
    });
  });
  it('closes the socket on cancellation and validates before connecting', async () => {
    const controller = new AbortController();
    server.on('connection', (socket) =>
      socket.on('message', () => controller.abort()),
    );
    await expect(
      service.synthesize('你好', controller.signal),
    ).rejects.toMatchObject({ status: 499 });
    await expect(service.synthesize(' ')).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.recognize(Buffer.alloc(2))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.synthesize('你好', AbortSignal.abort()),
    ).rejects.toMatchObject({ status: 499 });
  });
});
