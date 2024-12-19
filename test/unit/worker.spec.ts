import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ExportedHandler, ExecutionContext, Env } from '../../types'
import worker from '../../src/index'

const typedWorker = worker as ExportedHandler<Env>

describe('Worker API', () => {
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

  describe('Health Check', () => {
    it('responds with health check', async () => {
      const request = new Request('http://example.com/')
      const response = await typedWorker.fetch(request, env, ctx)
      expect(await response.text()).toBe('OK')
    })
  })

  describe('Metrics Endpoint', () => {
    it('returns metrics with queue depths', async () => {
      const request = new Request('http://example.com/metrics')
      const response = await typedWorker.fetch(request, env, ctx)
      const metrics = await response.json()
      expect(metrics).toHaveProperty('totalProcessed')
      expect(metrics).toHaveProperty('queueDepths')
    })
  })
})
