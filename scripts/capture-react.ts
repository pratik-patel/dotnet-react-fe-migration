import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { stabilizePage } from './stabilize-page';

const BASE_URL = process.env.REACT_APP_URL || 'http://localhost:5173';
const VIEWPORTS = [1920, 1440, 1024, 768];

async function captureMetrics(page: import('@playwright/test').Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const visible = elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      elementCount: visible.length,
      headerCount: visible.filter((el) => /^H[1-6]$/.test(el.tagName)).length,
      buttonCount: visible.filter((el) => el.tagName === 'BUTTON' || el.getAttribute('role') === 'button').length,
      inputCount: visible.filter((el) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)).length,
    };
  });
}

async function main(): Promise<void> {
  const manifestsDir = path.resolve('artifacts/manifests');
  const files = fs.readdirSync(manifestsDir).filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const f of files) {
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
    const screenId = manifest.screenId;
    const route = manifest.route;
    await page.goto(`${BASE_URL}${route}`);

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 1080 });
      await stabilizePage(page);
      const dir = path.join('artifacts', 'validation', 'screenshots', screenId, String(width));
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'default.png'), fullPage: true });

      const metrics = await captureMetrics(page);
      const metricsDir = path.join('artifacts', 'validation', 'metrics', screenId, String(width));
      fs.mkdirSync(metricsDir, { recursive: true });
      fs.writeFileSync(path.join(metricsDir, 'default.json'), JSON.stringify(metrics, null, 2));
    }
  }

  await browser.close();
  console.log('React capture complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
