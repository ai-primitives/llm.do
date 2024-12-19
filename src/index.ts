import { Hono } from 'hono';
import type { Context, Env as HonoEnv } from 'hono';

// Extend Hono's environment type with our bindings
type AppEnv = HonoEnv & Env;

// Create Hono app with environment bindings
const app = new Hono<AppEnv>();

// Health check endpoint
app.get('/', (c) => c.text('OK'));

// R2 bucket event handler
async function handleR2Event(event: R2Event, env: Env): Promise<void> {
  if (event.type !== 'upload' || !event.key.startsWith('input/')) {
    return;
  }

  // Process only JSONL files
  if (!event.key.endsWith('.jsonl')) {
    return;
  }

  try {
    // Queue the file for processing
    await env.INPUT_QUEUE.send({
      file: event.key,
      timestamp: Date.now(),
    });
    console.log(`Queued file for processing: ${event.key}`);
  } catch (error) {
    console.error(`Error queueing file ${event.key}:`, error);
  }
}

// Worker fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // R2 bucket event handler
  async r2Event(event: R2Event, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleR2Event(event, env);
  },
} satisfies ExportedHandler<Env>;
