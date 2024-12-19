import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
          ai: {
            models: {
              '@cf/meta/llama-2-7b-chat-int8': {
                type: 'mock',
                response: 'Test response'
              }
            }
          },
          r2: {
            buckets: [{
              binding: 'STORAGE',
              bucket_name: 'llm-do-test-bucket'
            }]
          },
          queues: {
            producers: [{
              binding: 'INPUT_QUEUE',
              queue_name: 'llm-do-test-queue'
            }],
            consumers: [{
              binding: 'PROCESSING_QUEUE',
              queue_name: 'llm-do-test-queue'
            }]
          }
        },
      },
    },
  },
})
