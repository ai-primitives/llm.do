# llm.do

A Cloudflare Worker that provides a scalable proxy and queue system for processing JSONL files through Workers AI. The worker watches an R2 bucket for new JSONL files, processes each line through Workers AI, and saves batched results back to R2.

## Architecture

### Components

1. **R2 Bucket Watcher**
   - Monitors input folder for JSONL file changes
   - Triggers event notifications on file creation
   - Uses R2 bucket event notifications system

2. **Queue System**
   - Input Queue: Receives file change notifications
   - Processing Queue: Handles individual JSONL lines
   - Results Queue: Collects AI processing results

3. **Workers AI Integration**
   - Processes each JSONL line through Workers AI
   - Configurable model selection
   - Handles API responses and errors

4. **Results Processor**
   - Batches results (100 items or 1 minute threshold)
   - Saves batched results to R2 output folder
   - Maintains JSONL format for output files

## Setup

1. Create required Cloudflare resources:
   - R2 bucket with event notifications enabled
   - Three queues: input, processing, and results
   - Workers AI binding in wrangler.toml

2. Configure wrangler.toml:
```toml
[ai]
binding = "AI"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "your-bucket-name"

[[queues.producers]]
binding = "INPUT_QUEUE"
queue = "input-queue-name"

[[queues.producers]]
binding = "PROCESSING_QUEUE"
queue = "processing-queue-name"

[[queues.producers]]
binding = "RESULTS_QUEUE"
queue = "results-queue-name"

[[queues.consumers]]
queue = "input-queue-name"

[[queues.consumers]]
queue = "processing-queue-name"

[[queues.consumers]]
queue = "results-queue-name"
```

## Usage

1. Upload JSONL files to the R2 bucket's input folder
2. The system automatically:
   - Detects new files via R2 event notifications
   - Processes each line through Workers AI
   - Batches results (100 items or 1 minute)
   - Saves results to output folder

## Development

See [TODO.md](./TODO.md) for implementation status and upcoming tasks.
