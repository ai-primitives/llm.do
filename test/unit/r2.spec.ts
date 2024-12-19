import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ExportedHandler, ExecutionContext, Env, R2Event } from '../../types'
import worker from '../../src/index'

const typedWorker = worker as ExportedHandler<Env>

describe('R2 Event Handler', () => {
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

  it('processes JSONL files from input folder', async () => {
    const event: R2Event = {
      type: 'upload',
      key: 'input/test.jsonl',
      size: 100
    }

    env.STORAGE.get = vi.fn().mockResolvedValueOnce({
      text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}')
    })

    await typedWorker.r2Event(event, env, ctx)
    expect(env.INPUT_QUEUE.send).toHaveBeenCalledWith({
      file: 'input/test.jsonl',
      timestamp: expect.any(Number)
    })
  })

  it('ignores non-JSONL files', async () => {
    const event: R2Event = {
      type: 'upload',
      key: 'input/test.txt',
      size: 100
    }

    await typedWorker.r2Event(event, env, ctx)
    expect(env.INPUT_QUEUE.send).not.toHaveBeenCalled()
  })
})
