import { Hono } from 'hono';
import type { Context, Env as HonoEnv } from 'hono';
import type {
  Env,
  ExportedHandler,
  InputQueueMessage,
  ProcessingQueueMessage,
  ResultsQueueMessage,
  QueueMessage,
  MessageBatch,
  R2Event,
  ProcessingStats,
  DurableObject,
  DurableObjectNamespace,
  Queue
} from '../types';

// Extend Hono's environment type with our bindings
type AppEnv = HonoEnv & Env;

// Create Hono app with environment bindings
const app = new Hono<AppEnv>();

let processingStartTime: number;

// Health check endpoint
app.get('/', (c) => c.text('OK'));

// Metrics endpoint
app.get('/metrics', async (c) => {
  const env = c.env as unknown as AppEnv;
  const statsId = env.STATS.idFromName('global');
  const statsObj = env.STATS.get(statsId);
  const stats = await statsObj.fetch('/stats');

  // Update queue depths
  const queueDepths = {
    input: await env.INPUT_QUEUE.length(),
    processing: await env.PROCESSING_QUEUE.length(),
    results: await env.RESULTS_QUEUE.length(),
  };

  const currentStats = await stats.json() as ProcessingStats;
  currentStats.queueDepths = queueDepths;
  currentStats.lastUpdated = Date.now();

  return c.json(currentStats);
});

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

// Process JSONL file from R2 bucket
async function processJSONLFile(message: InputQueueMessage, env: Env): Promise<void> {
  try {
    // Get file from R2
    const file = await env.STORAGE.get(message.file);
    if (!file) {
      throw new Error(`File not found: ${message.file}`);
    }

    // Read file content as text
    const content = await file.text();
    const lines = content.trim().split('\n');

    // Queue each line for processing
    for (const line of lines) {
      try {
        const jsonData = JSON.parse(line);
        await env.PROCESSING_QUEUE.send({
          data: jsonData,
          sourceFile: message.file,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`Error processing line from ${message.file}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error processing file ${message.file}:`, error);
  }
}

// Process individual JSONL line with AI
async function processJSONLLine(message: ProcessingQueueMessage, env: Env): Promise<void> {
  const MAX_RETRIES = 3;
  const retryCount = message.retryCount || 0;
  const startTime = Date.now();

  try {
    // Process data with Workers AI
    const inputs = [message.data];
    const results = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', inputs);

    // Update processing stats
    const statsId = env.STATS.idFromName('global');
    const stats = env.STATS.get(statsId);
    try {
      await stats.fetch('/stats', {
        method: 'POST',
        body: JSON.stringify({
          totalProcessed: 1,
          averageProcessingTime: Date.now() - startTime,
        }),
      });
    } catch (error) {
      console.error('Error updating processing stats:', error);
    }

    // Queue result for batching
    await env.RESULTS_QUEUE.send({
      result: results[0],
      sourceFile: message.sourceFile,
      timestamp: Date.now(),
      batchId: getBatchId(message.timestamp),
    });
  } catch (error) {
    console.error(`Error processing line from ${message.sourceFile}:`, error);

    // Update error stats
    const statsId = env.STATS.idFromName('global');
    const stats = env.STATS.get(statsId);
    await stats.fetch('/stats', {
      method: 'POST',
      body: JSON.stringify({
        failedRequests: 1,
      }),
    });

    if (retryCount < MAX_RETRIES) {
      await env.PROCESSING_QUEUE.send({
        ...message,
        retryCount: retryCount + 1,
        timestamp: Date.now(),
      });
    } else {
      throw error;
    }
  }
}

// Get batch ID based on timestamp (1-minute windows)
function getBatchId(timestamp: number): string {
  const minute = Math.floor(timestamp / 60000);
  return `batch-${minute}`;
}

// Batch size for results
const BATCH_SIZE = 100;

// Process results and save to R2
async function processResults(messages: QueueMessage<ResultsQueueMessage>[], env: Env): Promise<void> {
  try {
    // Group messages by source file and batch ID
    const batches = new Map<string, ResultsQueueMessage[]>();

    for (const message of messages) {
      const key = `${message.body.sourceFile}-${message.body.batchId}`;
      const batch = batches.get(key) || [];
      batch.push(message.body);
      batches.set(key, batch);

      // Process batch if it reaches the size limit
      if (batch.length >= BATCH_SIZE) {
        await saveBatchToR2(batch, env);
        batches.delete(key);
      }
    }

    // Process remaining batches
    for (const batch of batches.values()) {
      await saveBatchToR2(batch, env);
    }
  } catch (error) {
    console.error('Error processing results batch:', error);
  }
}

// Save batch of results to R2
async function saveBatchToR2(batch: ResultsQueueMessage[], env: Env): Promise<void> {
  if (batch.length === 0) return;

  const sourceFile = batch[0].sourceFile;
  const batchId = batch[0].batchId;
  const outputKey = sourceFile.replace('input/', 'output/').replace('.jsonl', `-${batchId}.jsonl`);

  try {
    const content = batch.map(msg => JSON.stringify(msg.result)).join('\n');
    await env.STORAGE.put(outputKey, content);
    console.log(`Saved batch to ${outputKey}`);
  } catch (error) {
    console.error(`Error saving batch to ${outputKey}:`, error);
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

  // Queue handlers
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    // Update queue depths
    const statsId = env.STATS.idFromName('global');
    const stats = env.STATS.get(statsId);
    const queueName = batch.queue.toUpperCase().replace(/-/g, '_') as keyof Pick<Env, 'INPUT_QUEUE' | 'PROCESSING_QUEUE' | 'RESULTS_QUEUE'>;

    try {
      await stats.fetch('/stats', {
        method: 'POST',
        body: JSON.stringify({
          queueDepths: {
            [batch.queue]: await env[queueName].length(),
          },
        }),
      });
    } catch (error) {
      console.error('Error updating queue stats:', error);
    }

    // Process messages
    for (const message of batch.messages) {
      try {
        switch (batch.queue) {
          case 'llm-do-input':
            await processJSONLFile(message.body as InputQueueMessage, env);
            break;
          case 'llm-do-processing':
            await processJSONLLine(message.body as ProcessingQueueMessage, env);
            break;
          case 'llm-do-results':
            // Handle results in batches
            await processResults(batch.messages as QueueMessage<ResultsQueueMessage>[], env);
            return; // Exit early as we process all messages at once
        }
        message.ack();
      } catch (error) {
        console.error(`Error processing message in queue ${batch.queue}:`, error);
        message.retry();
      }
    }
  }
} as ExportedHandler<Env>;
