import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get trends (simple day-wise aggregation)
router.get('/trends', async (req, res) => {
  try {
    const results = await prisma.scrapeResult.findMany({
      select: {
        scrapedAt: true,
        platform: { select: { slug: true } }
      },
      orderBy: { scrapedAt: 'asc' }
    });

    // Group by date and platform
    const groups: Record<string, Record<string, number>> = {};
    results.forEach(r => {
      const date = r.scrapedAt.toISOString().split('T')[0];
      if (!groups[date]) groups[date] = {};
      const slug = r.platform.slug;
      groups[date][slug] = (groups[date][slug] || 0) + 1;
    });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

export default router;
