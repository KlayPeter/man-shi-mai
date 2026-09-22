import * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import {
  AudioTranscoderService,
  TRANSCODE_TIMEOUT_MS,
} from '../../src/interview/services/audio-transcoder.service';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
const wav = Buffer.from('RIFFxxxxWAVEtest');
describe('transcoder failure cleanup', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });
  it('kills an overlong conversion and reports timeout only after process exit', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    const process = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      kill: jest.fn(() => true),
    });
    const spawn = jest
      .mocked(childProcess.spawn)
      .mockReturnValue(
        process as unknown as childProcess.ChildProcessWithoutNullStreams,
      );
    const pending = new AudioTranscoderService().toPcm(wav);
    const rejected = expect(pending).rejects.toMatchObject({ status: 504 });
    for (let i = 0; i < 1000 && !spawn.mock.calls.length; i++)
      await new Promise<void>((resolve) => setImmediate(resolve));
    expect(spawn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(TRANSCODE_TIMEOUT_MS);
    expect(process.kill).toHaveBeenCalledWith('SIGKILL');
    process.emit('close', null);
    await rejected;
  });
  it('never invokes ffmpeg for playlists or unsupported formats', async () => {
    const spawn = jest.mocked(childProcess.spawn);
    await expect(
      new AudioTranscoderService().toPcm(
        Buffer.from('#EXTM3U\nhttps://example.test/file'),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(spawn).not.toHaveBeenCalled();
  });
});
