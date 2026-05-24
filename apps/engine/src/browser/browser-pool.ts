import { chromium, Browser, BrowserContext } from 'playwright';

export class BrowserPool {
  private browser: Browser | null = null;
  private contexts: Set<BrowserContext> = new Set();

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      console.log('🌐 Playwright Browser Pool Initialized');
    }
  }

  async getContext(proxy?: string): Promise<BrowserContext> {
    await this.init();
    const context = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      proxy: proxy ? { server: proxy } : undefined,
    });
    
    // Simple stealth inject
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    this.contexts.add(context);
    return context;
  }

  async releaseContext(context: BrowserContext) {
    this.contexts.delete(context);
    await context.close();
  }

  async close() {
    for (const context of this.contexts) {
      await context.close();
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserPool = new BrowserPool();
