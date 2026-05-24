import { Worker, Job } from 'bullmq';
import { scrapeQueue } from './queue';
import { PrismaClient } from '@prisma/client';
import { ThreadsScraper, InstagramScraper, FacebookScraper, TikTokScraper, GoogleScraper } from '../scrapers';
import { ProxyManager } from './proxy-manager';
import { AIAgent } from './ai-agent';
import { socketServer } from '../index';

const prisma = new PrismaClient();

export class JobOrchestrator {
  private worker: Worker;

  constructor() {
    // Setup BullMQ worker
    this.worker = new Worker(
      'scrape-jobs',
      async (job: Job) => {
        return this.processJob(job);
      },
      { connection: scrapeQueue.opts.connection }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} has completed!`);
      this.updateJobStatus(job.data.jobId, 'completed');
    });

    this.worker.on('failed', (job, err) => {
      console.log(`❌ Job ${job?.id} has failed with ${err.message}`);
      if (job) this.updateJobStatus(job.data.jobId, 'failed', err.message);
    });

    console.log('🤖 Job Orchestrator is running and listening for tasks...');
  }

  private async processJob(job: Job) {
    const { platform, parameters } = job.data;
    console.log(`Processing job for platform: ${platform}`, parameters);
    
    const dbJob = await prisma.scrapeJob.findUnique({
      where: { id: job.data.jobId },
      include: { platform: true }
    });

    if (!dbJob) throw new Error('Job not found in database');

    await this.updateJobStatus(job.data.jobId, 'running');
    socketServer.emit('job_status', { jobId: job.data.jobId, status: 'running', message: '🚀 Initializing scraper...' });

    // 1. Prepare Scraper & Proxy
    const proxy = await ProxyManager.getProxy();
    const onProgress = (msg: string) => {
      socketServer.emit('job_status', { jobId: dbJob.id, status: 'running', message: msg });
    };

    socketServer.emit('job_status', { 
      jobId: job.data.jobId, 
      status: 'running', 
      message: proxy ? `🌐 Using Proxy: ${proxy.server}` : '📡 Using Direct Connection' 
    });
    let scraperInstance;

    switch(platform.toLowerCase()) {
      case 'threads':
        scraperInstance = new ThreadsScraper({ jobId: dbJob.id, parameters, platform }, onProgress);
        break;
      case 'instagram':
        scraperInstance = new InstagramScraper({ jobId: dbJob.id, parameters, platform }, onProgress);
        break;
      case 'facebook':
        scraperInstance = new FacebookScraper({ jobId: dbJob.id, parameters, platform }, onProgress);
        break;
      case 'tiktok':
        scraperInstance = new TikTokScraper({ jobId: dbJob.id, parameters, platform }, onProgress);
        break;
      case 'google':
        scraperInstance = new GoogleScraper({ jobId: dbJob.id, parameters, platform }, onProgress);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    try {
      // 2. Perform Scrape
      socketServer.emit('job_status', { jobId: dbJob.id, status: 'running', message: '🔍 Scraping targets...' });
      const result = await scraperInstance.execute();
      socketServer.emit('job_status', { jobId: dbJob.id, status: 'running', message: '✅ Scraping successful!' });

      // 3. AI Analysis
      socketServer.emit('job_status', { jobId: dbJob.id, status: 'running', message: '🤖 AI Agent analyzing sentiment...' });
      const sentiment = AIAgent.analyzeSentiment(JSON.stringify(result.rawData));

      // 4. Save Results
      await prisma.scrapeResult.create({
        data: {
          jobId: dbJob.id,
          platformId: dbJob.platformId,
          contentType: result.contentType,
          rawData: result.rawData as any,
          normalizedData: result.normalizedData as any,
          sentiment: sentiment.label,
          sentimentScore: sentiment.score
        }
      });

      socketServer.emit('job_status', { jobId: dbJob.id, status: 'completed', message: '💎 Intelligence Vault updated!' });
      return { status: 'success', data: result.normalizedData };
    } catch (error: any) {
      if (proxy) await ProxyManager.reportFailure(proxy.id);
      throw error;
    }
  }

  private async updateJobStatus(jobId: string, status: string, errorMessage?: string) {
    try {
      if (!jobId) return;
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: { 
          status,
          ...(status === 'completed' && { completedAt: new Date() }),
          ...(status === 'running' && { startedAt: new Date() }),
          ...(errorMessage && { errorMessage })
        }
      });
    } catch (e) {
      console.error(`Failed to update job status for ${jobId}:`, e);
    }
  }
}

export const orchestrator = new JobOrchestrator();
