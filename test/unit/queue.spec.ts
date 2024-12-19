import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ExportedHandler, ExecutionContext, Env, MessageBatch, InputQueueMessage, ProcessingQueueMessage, ResultsQueueMessage } from '../../types'
import worker from '../../src/index'

const typedWorker = worker as ExportedHandler<Env>

describe('Queue Processing', () => {
  let env: Env
  let ctx: ExecutionContext

  beforeEach(() => {
    env = {
      AI: {
        run: vi.fn().mockResolvedValue(['AI response'])
      },
      STORAGE: {
        get: vi.fn(),
        put: vi.fn(),
        head: vi.fn(),
        delete: vi.fn(),
        list: vi.fn().mockResolvedValue({ objects: [] })
      },
      STATS: {
        idFromName: vi.fn().mockReturnValue({ toString: () => 'global' }),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalProcessed: 0 })))
        })
      },
      INPUT_QUEUE: {
        send: vi.fn(),
        length: vi.fn().mockResolvedValue(0)
      },
      PROCESSING_QUEUE: {
        send: vi.fn(),
        length: vi.fn().mockResolvedValue(0)
      },
      RESULTS_QUEUE: {
        send: vi.fn(),
        length: vi.fn().mockResolvedValue(0)
      }
    } as unknown as Env
    ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext
  })

  it('processes input queue messages', async () => {
    const message: InputQueueMessage = {
      file: 'input/test.jsonl',
      timestamp: Date.now()
    }

    const batch: MessageBatch<InputQueueMessage> = {
      queue: 'llm-do-input',
      messages: [{ body: message, ack: vi.fn(), retry: vi.fn(), id: '1', timestamp: Date.now() }]
    }

    await typedWorker.queue(batch, env, ctx)
    expect(env.PROCESSING_QUEUE.send).toHaveBeenCalled()
  })

  it('processes AI messages with retry', async () => {
    const message: ProcessingQueueMessage = {
      data: { text: 'test' },
      sourceFile: 'input/test.jsonl',
      timestamp: Date.now()
    }

    const retry = vi.fn()
    env.AI.run = vi.fn().mockRejectedValueOnce(new Error('AI Error'))
      .mockResolvedValueOnce(['AI response'])

    const batch: MessageBatch<ProcessingQueueMessage> = {
      queue: 'llm-do-processing',
      messages: [{ body: message, ack: vi.fn(), retry, id: '1', timestamp: Date.now() }]
    }

    await typedWorker.queue(batch, env, ctx)
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('batches results messages', async () => {
    const messages = Array.from({ length: 3 }, (_, i) => ({
      body: {
        result: `result${i}`,
        sourceFile: 'input/test.jsonl',
        timestamp: Date.now(),
        batchId: 'batch-1'
      } as ResultsQueueMessage,
      ack: vi.fn(),
      retry: vi.fn(),
      id: String(i),
      timestamp: Date.now()
    }))

    const batch: MessageBatch<ResultsQueueMessage> = {
      queue: 'llm-do-results',
      messages
    }

    await typedWorker.queue(batch, env, ctx)
    expect(env.STORAGE.put).toHaveBeenCalledWith(
      'output/test-batch-1.jsonl',
      expect.stringContaining('result0')
    )
  })
})
