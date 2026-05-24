import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ProxyManager {
  /**
   * Get a random active proxy from the pool
   */
  static async getProxy() {
    const proxies = await prisma.proxyPool.findMany({
      where: { isActive: true },
      orderBy: { lastUsedAt: 'asc' }
    });

    if (proxies.length === 0) return null;

    // Pick the one used longest ago
    const proxy = proxies[0];

    // Update last used timestamp
    await prisma.proxyPool.update({
      where: { id: proxy.id },
      data: { lastUsedAt: new Date() }
    });

    return {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      username: proxy.username || undefined,
      password: proxy.password || undefined,
      id: proxy.id
    };
  }

  /**
   * Report a failed proxy use
   */
  static async reportFailure(proxyId: number) {
    const proxy = await prisma.proxyPool.findUnique({ where: { id: proxyId } });
    if (!proxy) return;

    const newFailCount = proxy.failCount + 1;
    await prisma.proxyPool.update({
      where: { id: proxyId },
      data: { 
        failCount: newFailCount,
        isActive: newFailCount < 5 // Deactivate after 5 failures
      }
    });
  }
}
