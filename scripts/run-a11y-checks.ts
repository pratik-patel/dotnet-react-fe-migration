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

async function countCriticalA11y(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('input, select, textarea'));
    let unlabeled = 0;

    fields.forEach((el) => {
      const id = el.getAttribute('id');
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      const hasFor = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const wrapped = !!el.closest('label');
      if (!aria && !hasFor && !wrapped) unlabeled += 1;
    });

    return unlabeled;
  });
}

async function main(): Promise<void> {
  const outDir = path.join(ROOT, 'artifacts', 'validation', 'a11y-results');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const manifests = getManifests();
  const summary: Record<string, { criticalViolations: number }> = {};

  for (const m of manifests) {
    await page.goto(`${BASE_URL}${m.route}`);
    await page.waitForLoadState('networkidle');
    const criticalViolations = await countCriticalA11y(page);
    summary[m.screenId] = { criticalViolations };
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('Accessibility summary written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
