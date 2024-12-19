import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './wrangler.toml',
          experimental: {
            disableExternalModules: true
          }
        },
        miniflare: {
          modules: true,
          scriptPath: 'src/index.ts',
          compatibilityDate: '2024-01-01'
        }
      }
    }
  }
})
