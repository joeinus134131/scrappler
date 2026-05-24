import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all API credentials
router.get('/', async (req, res) => {
  try {
    const creds = await prisma.apiCredential.findMany();
    // Mask API keys for security before sending to frontend
    const safeCreds = creds.map(c => ({
      ...c,
      apiKey: c.apiKey.substring(0, 4) + '*'.repeat(16)
    }));
    res.json(safeCreds);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// Update or insert an API credential
router.post('/', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    // Get the admin user
    const user = await prisma.user.findFirst();
    if (!user) return res.status(400).json({ error: 'No admin user found' });

    const cred = await prisma.apiCredential.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: provider
        }
      },
      update: { apiKey },
      create: {
        userId: user.id,
        provider,
        apiKey
      }
    });

    res.json({ status: 'success', provider: cred.provider });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save credential' });
  }
});

export default router;
