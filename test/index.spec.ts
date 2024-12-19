import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';
import type { R2Event, Env, InputQueueMessage, ProcessingQueueMessage, ResultsQueueMessage, MessageBatch, ExportedHandler } from '../types';

// Assert worker type with required methods
const typedWorker = worker as Required<ExportedHandler<Env>>;

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

describe('Worker API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds with health check', async () => {
    const request = new Request('http://example.com/health');
    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    const response = await typedWorker.fetch(request, mockEnv, ctx);
    expect(await response.text()).toBe('OK');
  });

  it('returns metrics with queue depths', async () => {
    const request = new Request('http://example.com/metrics');
    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;

    // Setup queue length mocks
    (mockEnv.INPUT_QUEUE.length as any).mockResolvedValue(5);
    (mockEnv.PROCESSING_QUEUE.length as any).mockResolvedValue(10);
    (mockEnv.RESULTS_QUEUE.length as any).mockResolvedValue(3);

    const response = await typedWorker.fetch(request, mockEnv, ctx);
    const metrics = await response.json() as { totalProcessed: number; queueDepths: { input: number; processing: number; results: number; } };

    expect(metrics).toHaveProperty('totalProcessed');
    expect(metrics).toHaveProperty('queueDepths');
    expect(metrics.queueDepths).toEqual({
      input: 5,
      processing: 10,
      results: 3,
    });
  });
});

describe('R2 Event Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes JSONL files from input folder', async () => {
    const event: R2Event = {
      type: 'upload',
      key: 'input/test.jsonl',
      size: 100,
    };

    (mockEnv.STORAGE.get as any).mockResolvedValueOnce({
      text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}'),
    });

    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    await typedWorker.r2Event(event, mockEnv, ctx);

    expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledTimes(1);
    expect(mockEnv.INPUT_QUEUE.send).toHaveBeenCalledWith({
      file: 'input/test.jsonl',
      timestamp: expect.any(Number),
    });
  });

  it('ignores non-JSONL files', async () => {
    const event: R2Event = {
      type: 'upload',
      key: 'input/test.txt',
      size: 100,
    };

    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    await typedWorker.r2Event(event, mockEnv, ctx);

    expect(mockEnv.INPUT_QUEUE.send).not.toHaveBeenCalled();
  });
});

describe('Queue Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes input queue messages', async () => {
    const message: InputQueueMessage = {
      file: 'input/test.jsonl',
      timestamp: Date.now(),
    };

    (mockEnv.STORAGE.get as any).mockResolvedValueOnce({
      text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}'),
    });


    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    const batch: MessageBatch<InputQueueMessage> = {
      queue: 'llm-do-input',
      messages: [{ body: message, ack: vi.fn(), retry: vi.fn(), id: '1', timestamp: Date.now() }],
    };
    await typedWorker.queue(batch, mockEnv, ctx);

    expect(mockEnv.PROCESSING_QUEUE.send).toHaveBeenCalledTimes(2);
  });

  it('processes AI messages with retry', async () => {
    const message: ProcessingQueueMessage = {
      data: { text: 'test' },
      sourceFile: 'input/test.jsonl',
      timestamp: Date.now(),
    };

    const retry = vi.fn();
    (mockEnv.AI.run as any).mockRejectedValueOnce(new Error('AI processing failed'));

    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    const batch: MessageBatch<ProcessingQueueMessage> = {
      queue: 'llm-do-processing',
      messages: [{ body: message, ack: vi.fn(), retry, id: '1', timestamp: Date.now() }],
    };
    await typedWorker.queue(batch, mockEnv, ctx);

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('batches results messages', async () => {
    const messages = Array.from({ length: 3 }, (_, i) => ({
      body: {
        result: `result${i}`,
        sourceFile: 'input/test.jsonl',
        timestamp: Date.now(),
        batchId: 'batch-1',
      } as ResultsQueueMessage,
      ack: vi.fn(),
      retry: vi.fn(),
      id: String(i),
      timestamp: Date.now(),
    }));

    const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
    const batch: MessageBatch<ResultsQueueMessage> = {
      queue: 'llm-do-results',
      messages,
    };
    await typedWorker.queue(batch, mockEnv, ctx);

    expect(mockEnv.STORAGE.put).toHaveBeenCalledTimes(1);
    expect(mockEnv.STORAGE.put).toHaveBeenCalledWith(
      'output/test-batch-1.jsonl',
      expect.stringContaining('result0')
    );

    messages.forEach(msg => {
      expect(msg.ack).toHaveBeenCalledTimes(1);
    });
  });
});
