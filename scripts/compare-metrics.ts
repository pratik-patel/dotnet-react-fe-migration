import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VIEWPORTS = ['1920', '1440', '1024', '768'];

type Metrics = {
  documentWidth: number;
  documentHeight: number;
  elementCount: number;
  headerCount: number;
  buttonCount: number;
  inputCount: number;
};

function pctDelta(a: number, b: number): number {
  const denom = Math.max(1, a);
  return Math.abs(b - a) / denom;
}

function compareMetrics(base: Metrics, react: Metrics): Array<{ severity: 'critical' | 'warn' | 'info'; metric: string; message: string }> {
  const deltas: Array<{ severity: 'critical' | 'warn' | 'info'; metric: string; message: string }> = [];

  const checks: Array<{ key: keyof Metrics; critical: number; warn: number }> = [
    { key: 'documentWidth', critical: 0.2, warn: 0.1 },
    { key: 'documentHeight', critical: 0.2, warn: 0.1 },
    { key: 'elementCount', critical: 0.2, warn: 0.1 },
    { key: 'headerCount', critical: 0.5, warn: 0.3 },
    { key: 'buttonCount', critical: 0.5, warn: 0.3 },
    { key: 'inputCount', critical: 0.5, warn: 0.3 },
  ];

  for (const c of checks) {
    const d = pctDelta(base[c.key], react[c.key]);
    if (d >= c.critical) {
      deltas.push({
        severity: 'critical',
        metric: c.key,
        message: `${String(c.key)} delta ${(d * 100).toFixed(1)}% exceeds critical threshold`,
      });
    } else if (d >= c.warn) {
      deltas.push({
        severity: 'warn',
        metric: c.key,
        message: `${String(c.key)} delta ${(d * 100).toFixed(1)}% exceeds warn threshold`,
      });
    }
  }

  if (deltas.length === 0) {
    deltas.push({ severity: 'info', metric: 'all', message: 'No significant structural deltas detected' });
  }
  return deltas;
}

function main(): void {
  const ids = fs
    .readdirSync(path.join(ROOT, 'artifacts', 'manifests'))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'))
    .map((f) => path.basename(f, '.json'));

  for (const id of ids) {
    const outDir = path.join(ROOT, 'artifacts', 'validation', 'metrics-deltas', id);
    fs.mkdirSync(outDir, { recursive: true });

    for (const vp of VIEWPORTS) {
      const basePath = path.join(ROOT, 'artifacts', 'baseline', 'metrics', id, vp, 'default.json');
      const reactPath = path.join(ROOT, 'artifacts', 'validation', 'metrics', id, vp, 'default.json');
      const outPath = path.join(outDir, `${vp}-default.json`);

      if (!fs.existsSync(basePath) || !fs.existsSync(reactPath)) {
        const missing = [
          {
            severity: 'critical',
            metric: 'metrics_artifact',
            message: `Missing metrics artifact for viewport ${vp}`,
          },
        ];
        fs.writeFileSync(outPath, JSON.stringify(missing, null, 2));
        continue;
      }

      const base = JSON.parse(fs.readFileSync(basePath, 'utf8')) as Metrics;
      const react = JSON.parse(fs.readFileSync(reactPath, 'utf8')) as Metrics;
      const delta = compareMetrics(base, react);
      fs.writeFileSync(outPath, JSON.stringify(delta, null, 2));
    }
  }

  console.log('Metrics comparison complete');
}

main();
