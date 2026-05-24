import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// List all proxies
router.get('/', async (req, res) => {
  try {
    const proxies = await prisma.proxyPool.findMany({
      orderBy: { lastUsedAt: 'desc' }
    });
    res.json(proxies);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch proxies' });
  }
});

// Add new proxy
router.post('/', async (req, res) => {
  try {
    const proxy = await prisma.proxyPool.create({
      data: req.body
    });
    res.json(proxy);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add proxy' });
  }
});

// Toggle proxy status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const proxy = await prisma.proxyPool.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!proxy) return res.status(404).json({ error: 'Proxy not found' });

    const updated = await prisma.proxyPool.update({
      where: { id: proxy.id },
      data: { isActive: !proxy.isActive, failCount: 0 }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle proxy' });
  }
});

export default router;
