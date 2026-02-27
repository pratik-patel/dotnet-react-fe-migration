import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = process.cwd();

function comparePair(basePath: string, reactPath: string, diffPath: string): number {
  const base = PNG.sync.read(fs.readFileSync(basePath));
  const react = PNG.sync.read(fs.readFileSync(reactPath));

  if (base.width !== react.width || base.height !== react.height) {
    return 100;
  }

  const diff = new PNG({ width: base.width, height: base.height });
  const diffPixels = pixelmatch(base.data, react.data, diff.data, base.width, base.height, { threshold: 0.1 });
  fs.mkdirSync(path.dirname(diffPath), { recursive: true });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  return (diffPixels / (base.width * base.height)) * 100;
}

function classify(diff: number): 'PASS' | 'NEEDS_REVIEW' | 'FAIL' {
  if (diff < 2) return 'PASS';
  if (diff <= 10) return 'NEEDS_REVIEW';
  return 'FAIL';
}

function main(): void {
  const manifests = fs
    .readdirSync(path.join(ROOT, 'artifacts', 'manifests'))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'))
    .map((f) => path.basename(f, '.json'));

  for (const id of manifests) {
    let worst = 0;
    let comparedPairs = 0;
    let missingPairs = 0;
    for (const vp of ['1920', '1440', '1024', '768']) {
      const base = path.join(ROOT, 'artifacts', 'baseline', 'screenshots', id, vp, 'default.png');
      const react = path.join(ROOT, 'artifacts', 'validation', 'screenshots', id, vp, 'default.png');
      if (!fs.existsSync(base) || !fs.existsSync(react)) {
        missingPairs += 1;
        continue;
      }
      const diff = comparePair(base, react, path.join(ROOT, 'artifacts', 'validation', 'diffs', id, vp, 'default.png'));
      worst = Math.max(worst, diff);
      comparedPairs += 1;
    }

    const overall =
      comparedPairs === 0 ? 'FAIL' : missingPairs > 0 ? 'NEEDS_REVIEW' : classify(worst);

    const result = {
      screenId: id,
      maxDiffPercentage: Number(worst.toFixed(4)),
      comparedPairs,
      missingPairs,
      overall,
    };

    fs.mkdirSync(path.join(ROOT, 'artifacts', 'validation', 'scorecards'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'artifacts', 'validation', 'scorecards', `${id}.json`), JSON.stringify(result, null, 2));
  }

  console.log('Pixel comparison complete');
}

main();
