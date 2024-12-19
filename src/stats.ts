/// <reference types="@cloudflare/workers-types" />
import type { ProcessingStats } from '../types';

type StatsUpdate = Partial<ProcessingStats>;

export class StatsCounter {
  private state: DurableObjectState;
  private stats: ProcessingStats;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.stats = {
      totalProcessed: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      queueDepths: {},
      lastUpdated: Date.now(),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/stats':
        if (request.method === 'GET') {
          return new Response(JSON.stringify(this.stats), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (request.method === 'POST') {
          const update = await request.json() as StatsUpdate;
          this.updateStats(update);
          return new Response(JSON.stringify(this.stats), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        break;
    }

    return new Response('Not Found', { status: 404 });
  }

  private updateStats(update: StatsUpdate): void {
    if (update.totalProcessed) {
      this.stats.totalProcessed += update.totalProcessed;
    }
    if (update.failedRequests) {
      this.stats.failedRequests += update.failedRequests;
    }
    if (update.averageProcessingTime) {
      // Update running average
      const total = this.stats.totalProcessed;
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (total - 1) + update.averageProcessingTime) / total;
    }
    if (update.queueDepths) {
      this.stats.queueDepths = { ...this.stats.queueDepths, ...update.queueDepths };
    }
    this.stats.lastUpdated = Date.now();
  }
}
