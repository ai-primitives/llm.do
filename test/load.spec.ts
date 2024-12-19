import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '@cloudflare/workers-types';
import worker from '../src/index';
import type { R2Event, Env } from '../types';

// Cast worker to handle optional methods
const typedWorker = worker as {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  r2Event?(event: R2Event, env: Env, ctx: ExecutionContext): Promise<void>;
  queue?(batch: any, env: Env, ctx: ExecutionContext): Promise<void>;
};

// Mock environment
const mockEnv = {
  AI: {
    run: vi.fn().mockResolvedValue(['AI response']),
  },
  STORAGE: {
    get: vi.fn(),
    put: vi.fn(),
  },
  STATS: {
    idFromName: vi.fn().mockReturnValue({ toString: () => 'global' }),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalProcessed: 0 }))),
    }),
  },
  INPUT_QUEUE: {
    send: vi.fn(),
    length: vi.fn(),
  },
  PROCESSING_QUEUE: {
    send: vi.fn(),
    length: vi.fn(),
  },
  RESULTS_QUEUE: {
    send: vi.fn(),
    length: vi.fn(),
  },
} as unknown as Env;

describe('Load Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle concurrent file uploads', async () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      type: 'upload' as const,
      key: `input/test${i}.jsonl`,
      size: 100,
    } satisfies R2Event));

    // Mock storage responses
    (mockEnv.STORAGE.get as any).mockImplementation((key: string) => ({
      text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}'),
    }));

    // Process files concurrently
    const ctx = {} as ExecutionContext;
    await Promise.all(files.map(event =>
      typedWorker.r2Event?.(event, mockEnv, ctx)
    ));

    // Verify all files were processed
    expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledTimes(10);
    files.forEach((file, i) => {
      expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledWith({
        file: `input/test${i}.jsonl`,
        timestamp: expect.any(Number),
      });
    });
  });

  it('should process large JSONL files', async () => {
    // Create a large JSONL file with 1000 lines
    const largeJSONL = Array.from({ length: 1000 }, (_, i) =>
      JSON.stringify({ text: `test${i}` })
    ).join('\n');

    const event: R2Event = {
      type: 'upload',
      key: 'input/large.jsonl',
      size: largeJSONL.length,
    };

    // Mock storage response with large file
    (mockEnv.STORAGE.get as any).mockResolvedValueOnce({
      text: () => Promise.resolve(largeJSONL),
    });

    const ctx = {} as ExecutionContext;
    await typedWorker.r2Event?.(event, mockEnv, ctx);

    // Verify large file was processed
    expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledTimes(1);
    expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledWith({
      file: 'input/large.jsonl',
      timestamp: expect.any(Number),
    });

    // Verify each line was queued for processing
    expect(mockEnv.PROCESSING_QUEUE.send).toHaveBeenCalledTimes(1000);
  });
});
