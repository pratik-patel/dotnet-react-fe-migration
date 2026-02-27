import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const BASE_URL = process.env.REACT_APP_URL || 'http://localhost:5173';

function getManifests(): Array<{ screenId: string; route: string }> {
  const dir = path.join(ROOT, 'artifacts', 'manifests');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'));
  return files.map((f) => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { screenId: m.screenId || path.basename(f, '.json'), route: m.route };
  });
}

async function measure(page: import('@playwright/test').Page, url: string): Promise<{ loadTimeMs: number; maxBundleKb: number }> {
  let maxBundleBytes = 0;
  page.on('response', async (res) => {
    try {
      const req = res.request();
      if (req.resourceType() !== 'script') return;
      const lenHeader = res.headers()['content-length'];
      const len = lenHeader ? Number(lenHeader) : 0;
      if (Number.isFinite(len)) maxBundleBytes = Math.max(maxBundleBytes, len);
    } catch {
      // ignore response parsing errors
    }
  });

  const start = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const loadTimeMs = Date.now() - start;

  return {
    loadTimeMs,
    maxBundleKb: Number((maxBundleBytes / 1024).toFixed(2)),
  };
}

async function main(): Promise<void> {
  const outDir = path.join(ROOT, 'artifacts', 'validation', 'perf-results');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const manifests = getManifests();
  const summary: Record<string, { loadTimeMs: number; maxBundleKb: number }> = {};

  for (const m of manifests) {
    const page = await browser.newPage();
    summary[m.screenId] = await measure(page, `${BASE_URL}${m.route}`);
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('Performance summary written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
