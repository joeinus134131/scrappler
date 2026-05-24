import { BrowserContext, Page } from 'playwright';
import { browserPool } from '../browser/browser-pool';

export interface ScrapeJobPayload {
  jobId: string;
  parameters: any;
  platform: string;
  jobType?: string;
}

export abstract class BaseScraper {
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;

  constructor(
    protected payload: ScrapeJobPayload,
    protected onProgress?: (message: string) => void
  ) {}

  abstract scrape(): Promise<any>;

  protected async setupBrowser() {
    this.onProgress?.('🌐 Initializing browser context...');
    this.context = await browserPool.getContext();
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);
    this.onProgress?.('🎭 Stealth context established');
  }

  protected async randomDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async execute() {
    try {
      await this.setupBrowser();
      console.log(`[Scraper] Starting job ${this.payload.jobId} for ${this.payload.platform}`);
      const result = await this.scrape();
      return result;
    } catch (error) {
      console.error(`[Scraper] Job ${this.payload.jobId} failed:`, error);
      throw error;
    } finally {
      if (this.context) {
        await browserPool.releaseContext(this.context);
      }
    }
  }
}
