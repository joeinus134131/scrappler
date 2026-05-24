import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Export all results as JSON
router.get('/json', async (req, res) => {
  try {
    const results = await prisma.scrapeResult.findMany({
      include: { platform: true }
    });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=scrappler_export.json');
    res.send(JSON.stringify(results, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

// Export as CSV (Basic)
router.get('/csv', async (req, res) => {
  try {
    const results = await prisma.scrapeResult.findMany({
      include: { platform: true }
    });
    
    let csv = 'ID,Platform,Type,ScrapedAt,Target\n';
    results.forEach(r => {
      const target = (r.normalizedData as any)?.username || (r.normalizedData as any)?.entityName || '—';
      csv += `${r.id},${r.platform.name},${r.contentType},${r.scrapedAt.toISOString()},${target}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=scrappler_export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export' });
  }
});

// Export as PDF (Enterprise Report)
router.get('/pdf', async (req, res) => {
  try {
    const results = await prisma.scrapeResult.findMany({
      include: { platform: true },
      take: 50,
      orderBy: { scrapedAt: 'desc' }
    });

    let html = `
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; color: #333; }
            h1 { color: #4f46e5; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f1f5f9; }
          </style>
        </head>
        <body>
          <h1>Scrappler Data Intelligence Report</h1>
          <p>Generated at: ${new Date().toISOString()}</p>
          <table>
            <tr><th>Platform</th><th>Type</th><th>Sentiment</th><th>Data Target</th></tr>
    `;

    results.forEach(r => {
      const target = (r.normalizedData as any)?.username || (r.normalizedData as any)?.location || '—';
      html += `<tr>
        <td>${r.platform.name}</td>
        <td>${r.contentType}</td>
        <td>${r.sentiment || 'N/A'}</td>
        <td>${target}</td>
      </tr>`;
    });

    html += `</table></body></html>`;

    // Try using playwright to generate PDF
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html);
      const pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=scrappler_report.pdf');
      res.send(pdfBuffer);
    } catch (e) {
      // Fallback if playwright fails in API context
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;
