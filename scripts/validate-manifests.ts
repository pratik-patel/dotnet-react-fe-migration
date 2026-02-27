import fs from 'node:fs';
import path from 'node:path';
import Ajv, { ErrorObject } from 'ajv';

type Issue = { screenId: string; severity: 'error' | 'warn'; message: string };
type JsonRecord = Record<string, unknown>;

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const reportPath = path.join(manifestsDir, '_manifest-validation-report.json');
const schemaDir = path.join(ROOT, '.codex', 'schemas');
const screenSchemaPath = path.join(schemaDir, 'screen-manifest.schema.json');
const executionPlanPath = path.join(manifestsDir, '_execution-plan.json');
const executionPlanSchemaPath = path.join(schemaDir, 'execution-plan.schema.json');

const phaseOrder = ['foundation', 'standard', 'guided'] as const;
const complexityOrder = ['low', 'medium', 'high'] as const;

function formatAjvError(err: ErrorObject): string {
  const at = err.instancePath || '/';
  return `${at} ${err.message || 'schema validation error'}`.trim();
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateManifest(filePath: string, validate: ReturnType<Ajv['compile']>): Issue[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const m = JSON.parse(raw);
  const screenId = m.screenId || path.basename(filePath, '.json');
  const issues: Issue[] = [];

  const schemaValid = validate(m);
  if (!schemaValid) {
    for (const err of validate.errors || []) {
      issues.push({
        screenId,
        severity: 'error',
        message: `Schema: ${formatAjvError(err)}`,
      });
    }
  }

  // Additional semantic guards not fully expressible in generic schema.
  if (Array.isArray(m.interactiveContracts) && m.interactiveContracts.length === 0) {
    issues.push({ screenId, severity: 'warn', message: 'No interactiveContracts defined' });
  }
  if (Array.isArray(m.uiStates) && m.uiStates.length === 0) {
    issues.push({ screenId, severity: 'warn', message: 'No uiStates defined' });
  }
  if (m.renderModel?.components && Object.keys(m.renderModel.components).length === 0) {
    issues.push({ screenId, severity: 'error', message: 'renderModel.components must not be empty' });
  }

  return issues;
}

function rankOf<T extends readonly string[]>(ordered: T, value: unknown): number {
  const idx = ordered.indexOf(String(value));
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function readPrimaryRoute(obj: JsonRecord): string {
  const primaryRoute = obj.primaryRoute;
  const route = obj.route;
  if (typeof primaryRoute === 'string' && primaryRoute.length > 0) return primaryRoute;
  if (typeof route === 'string' && route.length > 0) return route;
  return '';
}

function detectCycle(nodes: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const trail: string[] = [];

  const dfs = (node: string): string[] | null => {
    visited.add(node);
    inStack.add(node);
    trail.push(node);

    const deps = nodes.get(node) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (inStack.has(dep)) {
        const start = trail.indexOf(dep);
        return [...trail.slice(start), dep];
      }
    }

    inStack.delete(node);
    trail.pop();
    return null;
  };

  for (const node of nodes.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }

  return null;
}

function validateExecutionPlan(
  screenIds: string[],
  manifestById: Map<string, JsonRecord>,
  validate: ReturnType<Ajv['compile']>,
): { issues: Issue[]; summary: JsonRecord } {
  const issues: Issue[] = [];
  if (!fs.existsSync(executionPlanPath)) {
    issues.push({
      screenId: '_execution-plan',
      severity: 'error',
      message: `Missing required file: ${executionPlanPath}`,
    });
    return { issues, summary: { valid: false, reason: 'missing file' } };
  }

  const planRaw = readJson(executionPlanPath);
  const schemaValid = validate(planRaw);
  if (!schemaValid) {
    for (const err of validate.errors || []) {
      issues.push({
        screenId: '_execution-plan',
        severity: 'error',
        message: `Schema: ${formatAjvError(err)}`,
      });
    }
    return { issues, summary: { valid: false, reason: 'schema errors' } };
  }

  const plan = planRaw as { screens: Array<JsonRecord> };
  const seen = new Set<string>();
  const orderIds: string[] = [];
  const depsGraph = new Map<string, string[]>();

  for (const item of plan.screens) {
    const screenId = String(item.screenId);
    const dependencies = Array.isArray(item.dependencies)
      ? item.dependencies.map((d) => String(d))
      : [];

    if (seen.has(screenId)) {
      issues.push({
        screenId: '_execution-plan',
        severity: 'error',
        message: `Duplicate screenId in execution plan: ${screenId}`,
      });
    }
    seen.add(screenId);
    orderIds.push(screenId);
    depsGraph.set(screenId, dependencies);

    if (!manifestById.has(screenId)) {
      issues.push({
        screenId: '_execution-plan',
        severity: 'error',
        message: `Unknown screenId in execution plan: ${screenId}`,
      });
    }

    const depSet = new Set<string>();
    for (const dep of dependencies) {
      if (!depSet.has(dep)) depSet.add(dep);
      else {
        issues.push({
          screenId: '_execution-plan',
          severity: 'error',
          message: `Duplicate dependency for ${screenId}: ${dep}`,
        });
      }
      if (dep === screenId) {
        issues.push({
          screenId: '_execution-plan',
          severity: 'error',
          message: `Self dependency is not allowed: ${screenId}`,
        });
      }
      if (!manifestById.has(dep)) {
        issues.push({
          screenId: '_execution-plan',
          severity: 'error',
          message: `Unknown dependency '${dep}' referenced by ${screenId}`,
        });
      }
    }

    const manifest = manifestById.get(screenId);
    if (manifest) {
      const planRoute = readPrimaryRoute(item);
      const manifestRoute = readPrimaryRoute(manifest);
      if (planRoute !== manifestRoute) {
        issues.push({
          screenId: '_execution-plan',
          severity: 'error',
          message: `Route mismatch for ${screenId}: plan='${planRoute}' manifest='${manifestRoute}'`,
        });
      }
      if (String(item.complexity) !== String(manifest.complexity)) {
        issues.push({
          screenId: '_execution-plan',
          severity: 'error',
          message: `Complexity mismatch for ${screenId}: plan='${String(
            item.complexity,
          )}' manifest='${String(manifest.complexity)}'`,
        });
      }
    }
  }

  const missingScreens = screenIds.filter((id) => !seen.has(id));
  for (const missing of missingScreens) {
    issues.push({
      screenId: '_execution-plan',
      severity: 'error',
      message: `Missing screen in execution plan: ${missing}`,
    });
  }

  const cycle = detectCycle(depsGraph);
  if (cycle) {
    issues.push({
      screenId: '_execution-plan',
      severity: 'error',
      message: `Dependency cycle detected: ${cycle.join(' -> ')}`,
    });
  }

  const expectedOrder = [...plan.screens].sort((a, b) => {
    const phaseCmp = rankOf(phaseOrder, a.phase) - rankOf(phaseOrder, b.phase);
    if (phaseCmp !== 0) return phaseCmp;
    const complexityCmp =
      rankOf(complexityOrder, a.complexity) - rankOf(complexityOrder, b.complexity);
    if (complexityCmp !== 0) return complexityCmp;
    const depCmp = (Array.isArray(a.dependencies) ? a.dependencies.length : 0) -
      (Array.isArray(b.dependencies) ? b.dependencies.length : 0);
    if (depCmp !== 0) return depCmp;
    return String(a.screenId).localeCompare(String(b.screenId));
  });

  const expectedIds = expectedOrder.map((s) => String(s.screenId));
  if (expectedIds.join('|') !== orderIds.join('|')) {
    issues.push({
      screenId: '_execution-plan',
      severity: 'error',
      message:
        'Execution plan order is not deterministic (expected phase/complexity/dependencyCount/screenId sort order).',
    });
  }

  return {
    issues,
    summary: {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      totalPlanScreens: plan.screens.length,
      expectedOrder: expectedIds,
      actualOrder: orderIds,
    },
  };
}

function main(): void {
  if (!fs.existsSync(manifestsDir)) {
    console.error('manifests directory not found');
    process.exit(1);
  }
  if (!fs.existsSync(screenSchemaPath)) {
    console.error(`Manifest schema not found: ${screenSchemaPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(executionPlanSchemaPath)) {
    console.error(`Execution plan schema not found: ${executionPlanSchemaPath}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(manifestsDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'));
  if (files.length === 0) {
    console.error('No screen manifests found. Run analyst first.');
    process.exit(1);
  }

  const schema = readJson(screenSchemaPath);
  const executionPlanSchema = readJson(executionPlanSchemaPath);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const validateExecution = ajv.compile(executionPlanSchema);

  const screenIssues = files.flatMap((f) => validateManifest(path.join(manifestsDir, f), validate));
  const manifestById = new Map<string, JsonRecord>();
  for (const f of files) {
    const data = readJson(path.join(manifestsDir, f)) as JsonRecord;
    const screenId = String(data.screenId || path.basename(f, '.json'));
    manifestById.set(screenId, data);
  }
  const screenIds = Array.from(manifestById.keys()).sort();
  const executionPlanResult = validateExecutionPlan(
    screenIds,
    manifestById,
    validateExecution,
  );
  const issues = [...screenIssues, ...executionPlanResult.issues];
  const errors = issues.filter((i) => i.severity === 'error');

  const report = {
    generatedAt: new Date().toISOString(),
    validator: 'ajv',
    schemaPath: screenSchemaPath,
    executionPlanSchemaPath,
    executionPlanPath,
    totalScreens: files.length,
    totalIssues: issues.length,
    totalErrors: errors.length,
    executionPlan: executionPlanResult.summary,
    issues,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (errors.length > 0) {
    console.error(`Manifest completeness failed with ${errors.length} error(s). See ${reportPath}`);
    process.exit(1);
  }

  console.log(`Manifest completeness passed. Report: ${reportPath}`);
}

main();
