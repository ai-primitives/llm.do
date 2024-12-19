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
              name: 'AI',
              type: 'ai',
              models: [{
                name: '@cf/meta/llama-2-7b-chat-int8',
                type: 'mock',
                response: 'Test response'
              }]
            },
            STORAGE: {
              name: 'STORAGE',
              type: 'r2',
              bucketName: 'llm-do-test-bucket'
            },
            INPUT_QUEUE: {
              name: 'INPUT_QUEUE',
              type: 'queue',
              queueName: 'llm-do-test-queue'
            },
            PROCESSING_QUEUE: {
              name: 'PROCESSING_QUEUE',
              type: 'queue',
              queueName: 'llm-do-test-queue'
            }
          }
        },
      },
    },
  },
})
