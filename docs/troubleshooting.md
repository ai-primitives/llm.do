# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the llm.do worker.

## Common Issues and Resolution Steps

### 1. File Processing Failures

#### Symptoms
- Files in input folder not being processed
- Missing output files
- Incomplete JSONL processing

#### Resolution Steps
1. Check file format and location
   - Ensure files are valid JSONL format
   - Verify files are in the `input/` folder
   - Check file permissions and R2 bucket access

2. Monitor queue depths
   ```bash
   curl https://your-worker.workers.dev/metrics
   ```
   - High input queue depth indicates processing bottleneck
   - Zero queue depth might indicate R2 event notification issues

3. Verify R2 event notifications
   - Check wrangler.toml configuration
   - Ensure R2 bucket exists and is properly configured
   - Verify worker has necessary permissions

### 2. AI Processing Errors

#### Symptoms
- High retry rates in processing queue
- Timeout errors in worker logs
- Missing or incomplete results

#### Resolution Steps
1. Check Workers AI availability
   - Monitor Workers AI status page
   - Verify model binding in wrangler.toml
   - Check for rate limiting issues

2. Adjust retry configuration
   - Default retry limit: 3 attempts
   - Exponential backoff: 1s, 2s, 4s
   - Consider increasing limits for large files

3. Monitor processing metrics
   ```bash
   curl https://your-worker.workers.dev/metrics
   ```
   - Check error rates and processing times
   - Verify queue depths for bottlenecks

### 3. Queue Processing Issues

#### Symptoms
- Messages stuck in queues
- Inconsistent processing order
- Missing or duplicate results

#### Resolution Steps
1. Check queue configuration
   - Verify queue bindings in wrangler.toml
   - Check queue retention periods
   - Monitor queue depths and throughput

2. Debug message flow
   - Input queue: File metadata
   - Processing queue: Individual JSONL lines
   - Results queue: Processed AI responses

3. Monitor batch processing
   - Results are batched by:
     - 100 messages or
     - 1-minute window
   - Check output file naming pattern

### 4. Monitoring Alerts

#### Symptoms
- High queue depths
- Increased error rates
- Processing delays

#### Resolution Steps
1. Check system health
   ```bash
   curl https://your-worker.workers.dev/
   ```
   - Verify worker is responding
   - Check for error messages

2. Monitor queue metrics
   ```bash
   curl https://your-worker.works.dev/metrics
   ```
   - Track queue depths over time
   - Identify processing bottlenecks

3. Review worker logs
   - Check for error patterns
   - Monitor retry attempts
   - Verify successful processing

## Performance Characteristics

### Limitations
- Maximum file size: 100MB
- Processing rate: ~1000 lines/minute
- Concurrent file limit: 10 files
- Queue depth limit: 10,000 messages

### Graceful Degradation
The worker implements several strategies for handling service degradation:

1. AI Service Outages
   - Automatic retries with exponential backoff
   - Failed messages return to queue
   - Processing continues when service recovers

2. High Load Handling
   - Queue depth monitoring
   - Batch processing for efficiency
   - Automatic rate limiting

3. Error Recovery
   - Failed messages are retried
   - Partial results are saved
   - Processing resumes from last checkpoint

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Queues Documentation](https://developers.cloudflare.com/queues/)
