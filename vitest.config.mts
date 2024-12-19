import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
          modules: true,
          experimental: {
            disableExperimentalWarning: true,
          },
          bindings: {
            AI: {
              prepare: () => ({
                run: async () => ({ response: 'Test response' })
              })
            },
            STORAGE: {
              get: async () => new Response('test'),
              put: async () => {},
              list: async () => ({ objects: [] })
            },
            INPUT_QUEUE: {
              send: async () => {},
              sendBatch: async () => {}
            },
            PROCESSING_QUEUE: {
              send: async () => {},
              sendBatch: async () => {}
            }
          }
        },
      },
    },
  },
})
