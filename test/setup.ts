import { beforeAll, afterAll, vi } from 'vitest'

beforeAll(() => {
  // Mock AI binding
  vi.mock('AI', () => ({
    run: vi.fn().mockResolvedValue(['AI response'])
  }))

  // Mock R2 binding
  vi.mock('STORAGE', () => ({
    get: vi.fn().mockImplementation(() => ({
      text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}')
    })),
    put: vi.fn()
  }))

  // Mock queue bindings
  vi.mock('INPUT_QUEUE', () => ({
    send: vi.fn(),
    length: vi.fn().mockResolvedValue(0)
  }))

  vi.mock('PROCESSING_QUEUE', () => ({
    send: vi.fn(),
    length: vi.fn().mockResolvedValue(0)
  }))

  vi.mock('RESULTS_QUEUE', () => ({
    send: vi.fn(),
    length: vi.fn().mockResolvedValue(0)
  }))

  // Mock stats binding
  vi.mock('STATS', () => ({
    idFromName: vi.fn().mockReturnValue({ toString: () => 'global' }),
    get: vi.fn().mockReturnValue({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ totalProcessed: 0 })))
    })
  }))
})

afterAll(() => {
  vi.clearAllMocks()
})
