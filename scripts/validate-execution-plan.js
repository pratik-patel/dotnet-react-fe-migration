const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const planPath = path.join(manifestsDir, '_execution-plan.json');
const summaryPath = path.join(manifestsDir, '_summary.json');
const outPath = path.join(manifestsDir, '_execution-plan.validation.json');

const phaseOrder = ['foundation', 'standard', 'guided'];
const complexityOrder = ['low', 'medium', 'high'];

function rank(order, v) {
  const idx = order.indexOf(String(v));
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function detectCycle(graph) {
  const visited = new Set();
  const stack = new Set();
  const trail = [];

  function dfs(node) {
    visited.add(node);
    stack.add(node);
    trail.push(node);
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (stack.has(dep)) {
        const start = trail.indexOf(dep);
        return [...trail.slice(start), dep];
      }
    }
    stack.delete(node);
    trail.pop();
    return null;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      const cycle = dfs(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

function readPrimaryRoute(obj) {
  if (obj && typeof obj.primaryRoute === 'string' && obj.primaryRoute) return obj.primaryRoute;
  if (obj && typeof obj.route === 'string' && obj.route) return obj.route;
  return '';
}

function main() {
  const result = {
    generatedAt: new Date().toISOString(),
    planPath,
    summaryPath,
    valid: false,
    errors: [],
    warnings: [],
    normalizedOrderingSummary: {
      expectedOrder: [],
      actualOrder: []
    }
  };

  if (!fs.existsSync(manifestsDir)) {
    result.errors.push('Missing artifacts/manifests directory.');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (!fs.existsSync(planPath)) result.errors.push('Missing _execution-plan.json');
  if (!fs.existsSync(summaryPath)) result.errors.push('Missing _summary.json');
  if (result.errors.length) {
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const summaryById = new Map(summary.map((s) => [String(s.screenId), s]));
  const summaryIds = Array.from(summaryById.keys()).sort();

  if (!Array.isArray(plan.screens) || plan.screens.length === 0) {
    result.errors.push('Plan.screens must be a non-empty array.');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const seen = new Set();
  const actualOrder = [];
  const graph = new Map();

  for (const item of plan.screens) {
    const screenId = String(item.screenId || '');
    const deps = Array.isArray(item.dependencies) ? item.dependencies.map(String) : [];

    if (!screenId) {
      result.errors.push('Execution plan item missing screenId.');
      continue;
    }
    if (seen.has(screenId)) result.errors.push(`Duplicate screenId: ${screenId}`);
    seen.add(screenId);
    actualOrder.push(screenId);
    graph.set(screenId, deps);

    if (!summaryById.has(screenId)) result.errors.push(`Unknown screenId in plan: ${screenId}`);
    const summaryRow = summaryById.get(screenId);
    if (summaryRow) {
      const planRoute = readPrimaryRoute(item);
      const summaryRoute = readPrimaryRoute(summaryRow);
      if (planRoute !== summaryRoute) {
        result.errors.push(`Route mismatch for ${screenId}: plan='${planRoute}' summary='${summaryRoute}'`);
      }
      if (String(item.complexity) !== String(summaryRow.complexity)) {
        result.errors.push(`Complexity mismatch for ${screenId}: plan='${item.complexity}' summary='${summaryRow.complexity}'`);
      }
    }

    if (!phaseOrder.includes(String(item.phase))) {
      result.errors.push(`Invalid phase for ${screenId}: ${item.phase}`);
    }
    if (!complexityOrder.includes(String(item.complexity))) {
      result.errors.push(`Invalid complexity for ${screenId}: ${item.complexity}`);
    }

    const depSet = new Set();
    for (const dep of deps) {
      if (depSet.has(dep)) result.errors.push(`Duplicate dependency for ${screenId}: ${dep}`);
      depSet.add(dep);
      if (dep === screenId) result.errors.push(`Self dependency not allowed for ${screenId}`);
      if (!summaryById.has(dep)) result.errors.push(`Unknown dependency for ${screenId}: ${dep}`);
    }
  }

  for (const sid of summaryIds) {
    if (!seen.has(sid)) result.errors.push(`Missing screen in plan: ${sid}`);
  }

  const cycle = detectCycle(graph);
  if (cycle) result.errors.push(`Dependency cycle detected: ${cycle.join(' -> ')}`);

  const expectedOrder = [...plan.screens]
    .sort((a, b) => {
      const phaseCmp = rank(phaseOrder, a.phase) - rank(phaseOrder, b.phase);
      if (phaseCmp !== 0) return phaseCmp;
      const cCmp = rank(complexityOrder, a.complexity) - rank(complexityOrder, b.complexity);
      if (cCmp !== 0) return cCmp;
      const depCmp = (Array.isArray(a.dependencies) ? a.dependencies.length : 0) -
        (Array.isArray(b.dependencies) ? b.dependencies.length : 0);
      if (depCmp !== 0) return depCmp;
      return String(a.screenId).localeCompare(String(b.screenId));
    })
    .map((s) => String(s.screenId));

  result.normalizedOrderingSummary.expectedOrder = expectedOrder;
  result.normalizedOrderingSummary.actualOrder = actualOrder;

  if (expectedOrder.join('|') !== actualOrder.join('|')) {
    result.errors.push('Plan order does not match deterministic ordering rules.');
  }

  result.valid = result.errors.length === 0;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  if (!result.valid) process.exit(1);
  console.log(`Execution plan validation passed: ${outPath}`);
}

main();
