import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            AI: { name: 'AI' },
            STORAGE: { name: 'STORAGE' },
            INPUT_QUEUE: { name: 'INPUT_QUEUE' },
            PROCESSING_QUEUE: { name: 'PROCESSING_QUEUE' },
            RESULTS_QUEUE: { name: 'RESULTS_QUEUE' },
            STATS: { name: 'STATS' }
          },
          modules: true,
          scriptPath: 'src/index.ts',
          buildCommand: 'npm run build',
          compatibilityDate: '2024-01-01',
          compatibilityFlags: ['nodejs_compat']
        }
      }
    }
  }
})
