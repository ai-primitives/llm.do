import { Hono } from 'hono';
import type { Context, Env as HonoEnv } from 'hono';

// Extend Hono's environment type with our bindings
type AppEnv = HonoEnv & Env;

// Create Hono app with environment bindings
const app = new Hono<AppEnv>();

// Health check endpoint
app.get('/', (c) => c.text('OK'));

// Worker fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
