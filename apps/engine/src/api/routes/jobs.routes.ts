import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { scrapeQueue } from '../../core/queue';

const router = Router();
const prisma = new PrismaClient();

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const jobs = await prisma.scrapeJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: { platform: true }
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Create new job
router.post('/', async (req, res) => {
  try {
    const { platform, jobType, parameters } = req.body;
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: 'admin@scrappler.com', name: 'Admin', passwordHash: 'hash', role: 'admin' }
      });
    }

    const dbPlatform = await prisma.platform.findUnique({ where: { slug: platform.toLowerCase() } });
    if (!dbPlatform) return res.status(400).json({ error: 'Unsupported platform' });

    const dbJob = await prisma.scrapeJob.create({
      data: {
        userId: user.id,
        platformId: dbPlatform.id,
        jobType: jobType || 'profile_scrape',
        parameters: parameters || {},
        status: 'pending'
      }
    });

    const jobOptions: any = {};
    if (parameters?.schedule && parameters.schedule !== 'none') {
      let cronPattern = '';
      if (parameters.schedule === 'hourly') cronPattern = '0 * * * *';
      else if (parameters.schedule === 'daily') cronPattern = '0 0 * * *';
      else if (parameters.schedule === 'weekly') cronPattern = '0 0 * * 0';

      if (cronPattern) {
        jobOptions.repeat = { pattern: cronPattern };
      }
    }

    const queueJob = await scrapeQueue.add('scrape-jobs', {
      jobId: dbJob.id,
      platform,
      jobType: jobType || 'profile_scrape',
      parameters
    }, jobOptions);

    res.json({ status: 'queued', jobId: dbJob.id, queueId: queueJob.id, isRecurring: !!jobOptions.repeat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Get job stats
router.get('/stats', async (req, res) => {
  try {
    const total = await prisma.scrapeJob.count();
    const completed = await prisma.scrapeJob.count({ where: { status: 'completed' } });
    const failed = await prisma.scrapeJob.count({ where: { status: 'failed' } });
    const running = await prisma.scrapeJob.count({ where: { status: 'running' } });
    res.json({ total, completed, failed, running });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job stats' });
  }
});

export default router;
