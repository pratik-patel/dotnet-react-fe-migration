const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const viewsRoot = path.join(ROOT, 'legacy-src', 'SampleMvcWebApp', 'SampleWebApp', 'Views');
const controllersRoot = path.join(ROOT, 'legacy-src', 'SampleMvcWebApp', 'SampleWebApp', 'Controllers');
const outDir = path.join(ROOT, 'artifacts', 'manifests');
const PHASE_RANK = { foundation: 0, standard: 1, guided: 2 };
const COMPLEXITY_RANK = { low: 0, medium: 1, high: 2 };

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
function toKebab(v) { return v.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').replace(/_/g, '-').toLowerCase(); }

function getViews() {
  const result = [];
  const folders = fs.readdirSync(viewsRoot);
  for (const folder of folders) {
    const full = path.join(viewsRoot, folder);
    if (!fs.statSync(full).isDirectory()) continue;
    if (folder === 'Shared') continue;
    const files = fs.readdirSync(full).filter(f => f.endsWith('.cshtml'));
    for (const file of files) {
      if (file.startsWith('_')) continue;
      result.push({ folder, file, full: path.join(full, file) });
    }
  }
  return result.sort((a,b)=> (a.folder+a.file).localeCompare(b.folder+b.file));
}

function extractActionLinks(content, defaultController) {
  const out = [];
  const re = /ActionLink\("([^"]+)"\s*,\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const label = m[1];
    const action = m[2];
    const controller = m[3] || defaultController;
    out.push({ id: toKebab(`${controller}-${action}-${label}`), label, to: `/${controller}/${action}` });
  }
  return out;
}

function inferRoute(controller, action) {
  if (['Edit', 'Details', 'Delete'].includes(action)) return `/${controller}/${action}/{id}`;
  return `/${controller}/${action}`;
}

function inferComplexity(content, action) {
  const factors = [];
  if (/BeginForm\(/.test(content)) factors.push('server form submission');
  if (/ValidationSummary|ValidationMessageFor/.test(content)) factors.push('validation handling');
  if (/<table/i.test(content)) factors.push('data table layout');
  if (/ActionLink\(/.test(content)) factors.push('cross navigation links');
  if (/TempData\["(message|errorMessage)"\]/.test(content)) factors.push('conditional message banners');
  if (/EditorFor\(model => model\.[^)]+\)/g.test(content) && (content.match(/EditorFor\(/g) || []).length >= 4) factors.push('multi-field form');
  if (/Async/.test(action)) factors.push('async screen variant');

  let complexity = 'low';
  if (factors.length >= 4) complexity = 'high';
  else if (factors.length >= 2) complexity = 'medium';
  return { complexity, factors };
}

function buildManifest(view) {
  const controller = view.folder;
  const action = path.basename(view.file, '.cshtml');
  const screenId = toKebab(`${controller}-${action}`);
  const content = read(view.full);
  const controllerFile = path.join(controllersRoot, `${controller}Controller.cs`);
  const pageTitle = (content.match(/<h2>\s*([^<]+)\s*<\/h2>/i)?.[1] || action).trim();

  const { complexity, factors } = inferComplexity(content, action);
  const links = extractActionLinks(content, controller);
  const hasForm = /BeginForm\(/.test(content);
  const hasTable = /<table/i.test(content);

  const dataSources = [];
  dataSources.push({
    id: `load-${screenId}`,
    endpoint: `GET ${inferRoute(controller, action)}`,
    method: 'GET',
    routeParams: inferRoute(controller, action).includes('{id}') ? ['id'] : [],
    queryParams: [],
    requestShape: inferRoute(controller, action).includes('{id}') ? { id: 'number' } : null,
    responseShape: hasTable ? [{ row: 'object' }] : { viewModel: 'object | null' },
    usedBy: hasTable ? ['MainTable'] : ['MainContent'],
    confidence: 'medium'
  });

  if (hasForm) {
    dataSources.push({
      id: `submit-${screenId}`,
      endpoint: `POST /${controller}/${action}`,
      method: 'POST',
      routeParams: [],
      queryParams: [],
      requestShape: { formValues: 'object' },
      responseShape: { onSuccess: `302 /${controller}/Index`, onValidationError: `200 /${controller}/${action}` },
      usedBy: ['MainForm'],
      confidence: 'medium'
    });
  }

  const interactiveContracts = [];
  for (const link of links) {
    interactiveContracts.push({
      contractId: `navigate-${link.id}`,
      elementId: link.id,
      trigger: 'click',
      preconditions: [],
      action: { type: 'navigate', to: link.to },
      onSuccess: [{ type: 'navigate', to: link.to }],
      onError: [],
      confidence: 'medium'
    });
  }

  if (hasForm) {
    interactiveContracts.push({
      contractId: `submit-${screenId}`,
      elementId: `submit-${screenId}-button`,
      trigger: 'click',
      preconditions: ['form is valid'],
      action: { type: 'api', endpoint: `POST /${controller}/${action}`, payloadBinding: 'formValues' },
      onSuccess: [{ type: 'navigate', to: `/${controller}/Index` }],
      onError: [{ type: 'inlineValidation', mapping: 'validation summary + field errors' }],
      confidence: 'medium'
    });
  }

  const businessLogic = [];
  if (/TempData\["message"\]/.test(content)) {
    businessLogic.push({
      ruleId: 'show-success-banner',
      type: 'conditional-visibility',
      expression: 'tempData.message != null',
      affectedComponentIds: ['SuccessBanner'],
      confidence: 'high'
    });
  }
  if (/TempData\["errorMessage"\]/.test(content)) {
    businessLogic.push({
      ruleId: 'show-error-banner',
      type: 'conditional-visibility',
      expression: 'tempData.errorMessage != null',
      affectedComponentIds: ['ErrorBanner'],
      confidence: 'high'
    });
  }

  const uiStates = [{
    name: 'default-loaded',
    trigger: `GET ${inferRoute(controller, action)}`,
    visualChanges: ['screen content visible']
  }];
  if (hasForm) {
    uiStates.push({
      name: 'validation-errors',
      trigger: `POST invalid /${controller}/${action}`,
      visualChanges: ['validation summary visible', 'field error messages visible']
    });
  }

  const components = {
    PageHeader: { id: 'PageHeader', type: 'heading', text: pageTitle },
    MainContent: {
      id: 'MainContent',
      type: hasForm ? 'form' : hasTable ? 'data-grid' : 'content-block'
    }
  };
  if (links.length) components.TopNavLinks = { id: 'TopNavLinks', type: 'link-group', links };
  if (hasTable) components.MainTable = { id: 'MainTable', type: 'data-grid', dataSourceRef: `load-${screenId}` };
  if (hasForm) components.MainForm = { id: 'MainForm', type: 'form', dataSourceRef: `load-${screenId}`, submitContractRef: `submit-${screenId}` };

  return {
    screenId,
    route: inferRoute(controller, action),
    pageTitle,
    complexity,
    complexityFactors: factors.length ? factors : ['static content'],
    sourceFiles: {
      view: path.relative(ROOT, view.full),
      controller: fs.existsSync(controllerFile) ? path.relative(ROOT, controllerFile) : '',
      viewModel: '',
      css: []
    },
    dataSources,
    interactiveContracts,
    businessLogic,
    enableDisableRules: [],
    uiStates,
    renderModel: {
      layout: {
        type: hasForm ? 'form-page' : hasTable ? 'content-table' : 'content-page',
        breakpoints: ['768px', '1024px', '1440px'],
        zones: [{ name: 'main', children: Object.keys(components) }]
      },
      components
    }
  };
}

function makeExecutionPlan(manifests) {
  const byRoute = new Map(manifests.map((m) => [m.route, m.screenId]));
  const phaseFor = (m) => (m.complexity === 'high' ? 'guided' : 'standard');

  const screens = manifests.map((m) => {
    const deps = new Set();
    for (const contract of m.interactiveContracts || []) {
      const target = contract?.action?.to;
      if (typeof target === 'string') {
        const depScreen = byRoute.get(target);
        if (depScreen && depScreen !== m.screenId) deps.add(depScreen);
      }
    }
    return {
      screenId: m.screenId,
      route: m.route,
      complexity: m.complexity,
      phase: phaseFor(m),
      priority: 100,
      dependencies: Array.from(deps).sort(),
      sourceFiles: m.sourceFiles
    };
  });

  screens.sort((a, b) => {
    const phaseCmp = PHASE_RANK[a.phase] - PHASE_RANK[b.phase];
    if (phaseCmp !== 0) return phaseCmp;
    const complexityCmp = COMPLEXITY_RANK[a.complexity] - COMPLEXITY_RANK[b.complexity];
    if (complexityCmp !== 0) return complexityCmp;
    const depCmp = a.dependencies.length - b.dependencies.length;
    if (depCmp !== 0) return depCmp;
    return a.screenId.localeCompare(b.screenId);
  });

  return {
    planVersion: '1.0',
    orderingRules: [
      'phase(foundation,standard,guided)',
      'complexity(low,medium,high)',
      'dependencyCount(asc)',
      'screenId(asc)'
    ],
    screens
  };
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  // Remove previous per-screen manifests to keep deterministic output set.
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.') && f !== 'schemas') {
      fs.unlinkSync(path.join(outDir, f));
    }
  }

  const views = getViews();
  const manifests = views.map(buildManifest);

  for (const manifest of manifests) {
    write(path.join(outDir, `${manifest.screenId}.json`), manifest);
  }

  const summary = manifests.map(m => ({
    screenId: m.screenId,
    route: m.route,
    pageTitle: m.pageTitle,
    complexity: m.complexity
  }));
  write(path.join(outDir, '_summary.json'), summary);

  const apiMap = new Map();
  for (const m of manifests) {
    for (const d of m.dataSources) {
      const key = `${d.method}|${d.endpoint}`;
      if (!apiMap.has(key)) apiMap.set(key, { method: d.method, endpoint: d.endpoint, screens: [] });
      apiMap.get(key).screens.push(m.screenId);
    }
  }
  write(path.join(outDir, '_api-catalog.json'), Array.from(apiMap.values()));

  const freq = {};
  for (const m of manifests) {
    for (const c of Object.values(m.renderModel.components)) {
      freq[c.type] = (freq[c.type] || 0) + 1;
    }
  }
  write(path.join(outDir, '_component-frequency.json'), freq);

  const audit = [];
  for (const m of manifests) {
    if (!m.interactiveContracts.length) {
      audit.push({
        screenId: m.screenId,
        item: 'No interactive contracts extracted',
        confidence: 'low',
        note: 'Static or parsing-limited view; verify manually if interactions exist.'
      });
    }
    if (m.complexity === 'high' && m.route.includes('{id}') && m.route.includes('/Edit')) {
      audit.push({
        screenId: m.screenId,
        item: 'Complex edit form server-side validation mapping',
        confidence: 'medium',
        note: 'Ensure detailed validation semantics are preserved during builder pass.'
      });
    }
  }
  write(path.join(outDir, '_business-rules-audit.json'), audit);

  const guidedBuild = manifests.filter(m => m.complexity === 'high').map(m => m.screenId);
  const standardBuild = manifests.filter(m => m.complexity !== 'high').map(m => m.screenId);
  const rationale = {};
  for (const m of manifests.filter(x => x.complexity === 'high')) rationale[m.screenId] = m.complexityFactors;
  write(path.join(outDir, '_complexity-routing.json'), { standardBuild, guidedBuild, rationale });

  const executionPlan = makeExecutionPlan(manifests);
  write(path.join(outDir, '_execution-plan.json'), executionPlan);

  console.log(`Generated ${manifests.length} screen manifests.`);
}

main();
