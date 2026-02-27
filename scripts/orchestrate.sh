#!/usr/bin/env bash
set -euo pipefail

export TS_NODE_TRANSPILE_ONLY=1
export TS_NODE_COMPILER_OPTIONS='{"moduleResolution":"NodeNext"}'

workflow_cfg="scripts/workflow.config.json"
if [ ! -f "$workflow_cfg" ]; then
  echo "Missing workflow config: $workflow_cfg"
  exit 1
fi

loop_enabled=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(String(c.remediationLoop?.enabled ?? true));')
max_cycles=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(c.remediationLoop?.maxCycles ?? 3);')
min_pass_rate=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(c.remediationLoop?.minPassRate ?? 1);')
max_needs_review_rate=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(c.remediationLoop?.maxNeedsReviewRate ?? 0);')
require_zero_critical=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(String(c.remediationLoop?.requireZeroCriticalFailures ?? true));')
strict_pass_required=$(node -e 'const c=require("./scripts/workflow.config.json"); console.log(String(c.remediationLoop?.strictPassRequired ?? false));')

echo "[1/5] Validate manifests"
echo "Run analyst agent first, then press Enter"
read -r
npx ts-node scripts/validate-manifests.ts

echo "[2/5] Capture baseline from .NET app"
npx ts-node scripts/capture-baseline.ts

echo "[3/5] Build React app expected via agents"
echo "Run architect_normalizer -> builder agents, then press Enter"
read -r

if [ "$loop_enabled" != "true" ]; then
  echo "Remediation loop disabled. Stopping after initial setup."
  exit 0
fi

cycle=1
while [ "$cycle" -le "$max_cycles" ]; do
  echo "[Loop $cycle/$max_cycles] validator"
  npx ts-node scripts/capture-react.ts
  npx ts-node scripts/pixel-compare.ts
  npx ts-node scripts/compare-metrics.ts
  bash scripts/run-e2e-parity.sh
  npx ts-node scripts/run-a11y-checks.ts
  npx ts-node scripts/run-perf-checks.ts
  npx ts-node scripts/generate-scorecard.ts

  decision=$(node -e '
const fs=require("fs");
const s=JSON.parse(fs.readFileSync("artifacts/validation/scorecards/_composite-summary.json","utf8"));
const total=Math.max(1,s.total||1);
const passRate=(s.pass||0)/total;
const reviewRate=(s.needsReview||0)/total;
const critical=s.criticalFailures||0;
const minPass=Number(process.argv[1]);
const maxReview=Number(process.argv[2]);
const reqZero=process.argv[3]==="true";
const strictPass=process.argv[4]==="true";
const thresholdOk=passRate>=minPass && reviewRate<=maxReview && (!reqZero || critical===0);
const strictOk=(s.fail||0)===0 && (s.needsReview||0)===0;
const ok=strictPass ? strictOk : thresholdOk;
console.log(ok?"accept":"retry");
' "$min_pass_rate" "$max_needs_review_rate" "$require_zero_critical" "$strict_pass_required")

  if [ "$decision" = "accept" ]; then
    echo "Threshold accepted. Loop complete."
    exit 0
  fi

  if [ "$cycle" -lt "$max_cycles" ]; then
    echo "Run fixer/builder agents for failed screens, then press Enter"
    read -r
  fi

  cycle=$((cycle + 1))
done

echo "Max cycles reached. Move unresolved screens to checkpoint_exceptions."
exit 1
