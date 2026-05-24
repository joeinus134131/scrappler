import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const scrapeQueue = new Queue('scrape-jobs', { connection });
export const queueEvents = new QueueEvents('scrape-jobs', { connection });

console.log('📦 BullMQ Queue Initialized');
