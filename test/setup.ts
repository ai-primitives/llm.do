import { beforeAll, afterAll, vi } from 'vitest'
import type { Env } from '../types'

// Extend globalThis interface
declare global {
  var AI: Env['AI'] | undefined
  var STORAGE: Env['STORAGE'] | undefined
  var INPUT_QUEUE: Env['INPUT_QUEUE'] | undefined
  var PROCESSING_QUEUE: Env['PROCESSING_QUEUE'] | undefined
  var RESULTS_QUEUE: Env['RESULTS_QUEUE'] | undefined
  var STATS: Env['STATS'] | undefined
}

// Create global mocks
const mockAI = {
  run: vi.fn().mockResolvedValue(['AI response'])
}

const mockStorage = {
  get: vi.fn().mockImplementation(() => ({
    text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}')
  })),
  put: vi.fn(),
  head: vi.fn(),
  delete: vi.fn(),
  list: vi.fn().mockResolvedValue({ objects: [] }),
  createMultipartUpload: vi.fn(),
  resumeMultipartUpload: vi.fn()
}

const mockQueue = {
  send: vi.fn(),
  length: vi.fn().mockResolvedValue(0)
}

const mockStats = {
  idFromName: vi.fn().mockReturnValue({ toString: () => 'global' }),
  get: vi.fn().mockReturnValue({
    fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalProcessed: 0 })))
  })
}

beforeAll(() => {
  // Define global bindings
  globalThis.AI = mockAI
  globalThis.STORAGE = mockStorage
  globalThis.INPUT_QUEUE = { ...mockQueue }
  globalThis.PROCESSING_QUEUE = { ...mockQueue }
  globalThis.RESULTS_QUEUE = { ...mockQueue }
  globalThis.STATS = mockStats
})

afterAll(() => {
  vi.clearAllMocks()
  // Clean up global bindings
  delete globalThis.AI
  delete globalThis.STORAGE
  delete globalThis.INPUT_QUEUE
  delete globalThis.PROCESSING_QUEUE
  delete globalThis.RESULTS_QUEUE
  delete globalThis.STATS
})

// Export mocks for test usage
export {
  mockAI,
  mockStorage,
  mockQueue,
  mockStats
}
