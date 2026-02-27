const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const planPath = path.join(manifestsDir, '_execution-plan.json');
const pagesDir = path.join(ROOT, 'react-app', 'src', 'pages');
const e2eDir = path.join(ROOT, 'react-app', 'e2e');
const notesDir = path.join(ROOT, 'artifacts', 'conversion-notes');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function toPascal(screenId) {
  return String(screenId)
    .split(/[-_]/g)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function esc(v) {
  return String(v).replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function pageTsx(manifest) {
  const componentName = `${toPascal(manifest.screenId)}Page`;
  const links = (manifest.interactiveContracts || [])
    .filter((c) => c && c.action && c.action.type === 'navigate' && c.action.to)
    .map((c) => ({
      id: c.elementId || c.contractId,
      label: c.elementId || c.contractId,
      to: c.action.to,
    }));

  const states = Array.isArray(manifest.uiStates) ? manifest.uiStates : [];
  const logic = Array.isArray(manifest.businessLogic) ? manifest.businessLogic : [];
  const components = manifest.renderModel && manifest.renderModel.components ? manifest.renderModel.components : {};

  return `import { PageShell } from '../components/shared/PageShell';
import { LinkGroup } from '../components/shared/LinkGroup';
import { AlertGroup } from '../components/shared/AlertGroup';

const LINKS = ${JSON.stringify(links, null, 2)} as const;
const UI_STATES = ${JSON.stringify(states, null, 2)} as const;
const BUSINESS_LOGIC = ${JSON.stringify(logic, null, 2)} as const;
const COMPONENTS = ${JSON.stringify(components, null, 2)} as const;

export default function ${componentName}() {
  const alerts = [] as Array<{ id: string; level: 'success' | 'error' | 'info'; text: string }>;

  return (
    <PageShell title={${JSON.stringify(esc(manifest.pageTitle || manifest.screenId))}}>
      {LINKS.length > 0 ? <LinkGroup links={[...LINKS]} /> : null}
      {alerts.length > 0 ? <AlertGroup items={alerts} /> : null}

      <section data-testid="screen-${esc(manifest.screenId)}" style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <p><strong>Route:</strong> {${JSON.stringify(esc(manifest.route || ''))}}</p>
        <p><strong>Complexity:</strong> ${esc(manifest.complexity || '')}</p>

        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)' }}>Render Components</h2>
          <pre style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
{JSON.stringify(COMPONENTS, null, 2)}
          </pre>
        </div>

        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)' }}>UI States</h2>
          <pre style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
{JSON.stringify(UI_STATES, null, 2)}
          </pre>
        </div>

        <div>
          <h2 style={{ fontSize: 'var(--font-size-md)' }}>Business Logic</h2>
          <pre style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto' }}>
{JSON.stringify(BUSINESS_LOGIC, null, 2)}
          </pre>
        </div>
      </section>
    </PageShell>
  );
}
`;
}

function e2eSpec(manifest) {
  const sid = manifest.screenId;
  const route = manifest.route || '/';
  return `import { test, expect } from '@playwright/test';

test('${esc(sid)} renders', async ({ page }) => {
  await page.goto('${esc(route)}');
  await expect(page.getByTestId('screen-${esc(sid)}')).toBeVisible();
});
`;
}

function noteText(manifest, orderIndex) {
  const contracts = Array.isArray(manifest.interactiveContracts) ? manifest.interactiveContracts.length : 0;
  const states = Array.isArray(manifest.uiStates) ? manifest.uiStates.length : 0;
  const dataSources = Array.isArray(manifest.dataSources) ? manifest.dataSources.length : 0;
  return `# ${manifest.screenId}\n\n- buildOrder: ${orderIndex}\n- route: ${manifest.route}\n- complexity: ${manifest.complexity}\n- dataSources: ${dataSources}\n- interactiveContracts: ${contracts}\n- uiStates: ${states}\n- status: first-pass generated from manifest\n- integrationGaps: backend wiring not executed in builder script\n`;
}

function main() {
  if (!fs.existsSync(planPath)) {
    console.error(`Missing execution plan: ${planPath}`);
    process.exit(1);
  }
  ensureDir(pagesDir);
  ensureDir(e2eDir);
  ensureDir(notesDir);

  const plan = readJson(planPath);
  const screens = Array.isArray(plan.screens) ? plan.screens : [];
  if (!screens.length) {
    console.error('No screens in execution plan');
    process.exit(1);
  }

  for (let i = 0; i < screens.length; i += 1) {
    const screenId = screens[i].screenId;
    const manifestPath = path.join(manifestsDir, `${screenId}.json`);
    if (!fs.existsSync(manifestPath)) {
      console.error(`Missing manifest for screen: ${screenId}`);
      process.exit(1);
    }
    const manifest = readJson(manifestPath);

    fs.writeFileSync(path.join(pagesDir, `${screenId}.tsx`), pageTsx(manifest));
    fs.writeFileSync(path.join(e2eDir, `${screenId}.spec.ts`), e2eSpec(manifest));
    fs.writeFileSync(path.join(notesDir, `${screenId}.md`), noteText(manifest, i + 1));
  }

  const routeMap = screens.map((s) => {
    const comp = `${toPascal(s.screenId)}Page`;
    return { screenId: s.screenId, route: s.route, component: comp };
  });
  const imports = routeMap.map((r) => `import ${r.component} from './${r.screenId}';`).join('\n');
  const routes = routeMap.map((r) => `  { screenId: '${r.screenId}', route: '${r.route}', component: ${r.component} },`).join('\n');
  fs.writeFileSync(
    path.join(pagesDir, 'index.ts'),
    `${imports}\n\nexport const generatedRoutes = [\n${routes}\n];\n`,
  );

  console.log(`Built ${screens.length} screens from execution plan.`);
}

main();
