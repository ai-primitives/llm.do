import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
				miniflare: {
					bindings: {
						AI: {
							run: async () => ['AI response'],
						},
						STORAGE: {
							get: async () => ({
								text: () => Promise.resolve('{"text": "test"}\n{"text": "test2"}'),
							}),
							put: async () => {},
						},
						INPUT_QUEUE: {
							send: async () => {},
							length: async () => 0,
						},
						PROCESSING_QUEUE: {
							send: async () => {},
							length: async () => 0,
						},
						RESULTS_QUEUE: {
							send: async () => {},
							length: async () => 0,
						},
						STATS: {
							idFromName: () => ({ toString: () => 'global' }),
							get: () => ({
								fetch: async () => new Response(JSON.stringify({ totalProcessed: 0 })),
							}),
						},
					},
				},
			},
		},
	},
})
