import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all results
router.get('/', async (req, res) => {
  try {
    const results = await prisma.scrapeResult.findMany({
      orderBy: { scrapedAt: 'desc' },
      include: { platform: true },
      take: 50 // Limit to 50 for performance on list
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get results count/stats
router.get('/stats', async (req, res) => {
  try {
    const total = await prisma.scrapeResult.count();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results stats' });
  }
});

export default router;
