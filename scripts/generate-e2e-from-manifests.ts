import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const outDir = path.join(ROOT, 'react-app', 'e2e-generated');

function safeId(v: string): string {
  return v.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function jsString(v: string): string {
  return JSON.stringify(v);
}

function buildSpec(screenId: string, route: string, contracts: any[]): string {
  const tests = contracts.map((c, idx) => {
    const contractId = safeId(String(c.contractId || `contract_${idx + 1}`));
    const elementId = String(c.elementId || '').trim();
    const trigger = String(c.trigger || 'click');
    const selector = elementId ? `[data-testid="${elementId}"]` : '';

    const pre = elementId
      ? `const target = page.locator(${jsString(selector)});\n  await expect(target).toHaveCount(1);`
      : `test.fail(true, 'Missing elementId for contract ${contractId}.');`;

    const action =
      trigger === 'click'
        ? 'await target.click();'
        : trigger === 'change'
          ? "await target.fill('test-value');"
          : `test.fail(true, ${jsString(`Unsupported trigger '${trigger}' for contract ${contractId}.`)});`;

    return `
test(${jsString(`${screenId} contract ${contractId}`)}, async ({ page }) => {
  await page.goto(BASE_URL + ROUTE);
  ${pre}
  ${action}
});`;
  });

  return `import { test, expect } from '@playwright/test';

const BASE_URL = process.env.REACT_APP_URL || 'http://localhost:5173';
const ROUTE = ${jsString(route)};

test.describe(${jsString(screenId)}, () => {${tests.join('\n')}
});
`;
}

function main(): void {
  if (!fs.existsSync(manifestsDir)) {
    console.error('manifests directory not found');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const files = fs
    .readdirSync(manifestsDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'));

  for (const file of files) {
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestsDir, file), 'utf8'));
    const screenId = String(manifest.screenId || path.basename(file, '.json'));
    const route = String(manifest.route || '/');
    const contracts = Array.isArray(manifest.interactiveContracts) ? manifest.interactiveContracts : [];

    const spec = buildSpec(screenId, route, contracts);
    fs.writeFileSync(path.join(outDir, `${screenId}.spec.ts`), spec);
  }

  console.log(`Generated E2E specs from manifests: ${outDir}`);
}

main();
