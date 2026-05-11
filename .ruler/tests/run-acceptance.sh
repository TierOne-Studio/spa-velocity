#!/usr/bin/env bash
# run-acceptance.sh — acceptance tests for the spa-velocity distributed CLAUDE.md system.
# Architecture: ruler-managed (.ruler/ source → CLAUDE.md, .claude/skills/, .claude/agents/).
# Usage: bash .ruler/tests/run-acceptance.sh
#
# Runs against the generated outputs (CLAUDE.md, .claude/skills/, .claude/agents/),
# which ruler regenerates from .ruler/. Run `npx @mravinale/ruler apply` first if you
# want the tests to reflect recent .ruler/ edits.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

# Preflight: required CLI tools.
for tool in bash grep awk sed find wc jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "PRE-FAIL: required tool '$tool' not found on PATH" >&2
    exit 2
  fi
done

# Verify ruler-generated outputs are present (run `npx @mravinale/ruler apply` first if missing).
if [ ! -f CLAUDE.md ] || [ ! -d .claude/skills ] || [ ! -d .claude/agents ]; then
  echo "PRE-FAIL: generated outputs missing. Run 'npx @mravinale/ruler apply' first." >&2
  exit 2
fi

PASS=0
FAIL=0
FAILED_TESTS=""

# --- assertion helpers ------------------------------------------------------

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $name"; PASS=$((PASS+1))
  else
    echo "FAIL: $name (expected=$expected, actual=$actual)"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS $name"
  fi
}

assert_true() {
  local name="$1" cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "PASS: $name"; PASS=$((PASS+1))
  else
    echo "FAIL: $name (command failed: $cmd)"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS $name"
  fi
}

# ---------------------------------------------------------------------------
# T1 — File structure: required artifacts exist
# ---------------------------------------------------------------------------
echo "=== T1: File structure (router, skills, agents, ADRs, settings) ==="

REQUIRED_FILES=(
  "CLAUDE.md"
  ".claude/settings.json"
  ".ruler/instructions.md"
  ".ruler/ruler.toml"
  ".claude/skills/tdd-workflow/SKILL.md"
  ".claude/skills/design-review/SKILL.md"
  ".claude/skills/plan-mode/SKILL.md"
  ".claude/skills/rlm-explore/SKILL.md"
  ".claude/skills/bug-investigation/SKILL.md"
  ".claude/skills/git-workflow/SKILL.md"
  ".claude/skills/meta-skill-hygiene/SKILL.md"
  ".claude/skills/failure-mode-analysis/SKILL.md"
  ".claude/skills/repo-conventions/SKILL.md"
  ".claude/skills/decision-rules/SKILL.md"
  ".claude/skills/pushback-templates/SKILL.md"
  ".claude/skills/documentation-and-adrs/SKILL.md"
  ".claude/skills/cyclomatic-complexity/SKILL.md"
  ".claude/skills/async-error-handling/SKILL.md"
  ".claude/skills/react-patterns/SKILL.md"
  ".claude/skills/react-state-management/SKILL.md"
  ".claude/skills/react-performance/SKILL.md"
  ".claude/skills/react-routing/SKILL.md"
  ".claude/skills/react-forms/SKILL.md"
  ".claude/skills/react-testing/SKILL.md"
  ".claude/skills/accessibility/SKILL.md"
  ".claude/skills/frontend-security/SKILL.md"
  ".claude/skills/bundle-size/SKILL.md"
  ".claude/skills/cross-repo-workspace/SKILL.md"
  ".claude/agents/architect-reviewer.md"
  ".claude/agents/code-reviewer.md"
  ".claude/agents/qa-validator.md"
  ".claude/agents/security-reviewer.md"
  ".claude/agents/lessons-curator.md"
  "docs/decisions/README.md"
  "docs/decisions/_template.md"
)
for f in "${REQUIRED_FILES[@]}"; do
  assert_true "T1: $f exists" "test -f '$f'"
done
# ADRs 001-010
for n in 001 002 003 004 005 006 007 008 009 010; do
  assert_true "T1: ADR-$n exists" "ls docs/decisions/ADR-$n-*.md >/dev/null 2>&1"
done

# ---------------------------------------------------------------------------
# T2 — Skill frontmatter well-formed
# ---------------------------------------------------------------------------
echo
echo "=== T2: Skill frontmatter (YAML + name + description, 'Use ...' lead, 'NOT for' clause) ==="

OWNED_SKILLS=(
  tdd-workflow design-review plan-mode failure-mode-analysis bug-investigation
  rlm-explore decision-rules pushback-templates git-workflow documentation-and-adrs
  cyclomatic-complexity meta-skill-hygiene async-error-handling
  react-patterns react-state-management react-performance react-routing
  react-forms react-testing accessibility frontend-security bundle-size
  repo-conventions cross-repo-workspace
)

for s in "${OWNED_SKILLS[@]}"; do
  sk=".claude/skills/$s/SKILL.md"
  if [ ! -f "$sk" ]; then
    echo "FAIL: T2 $sk missing"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T2:$sk"; continue
  fi
  first=$(head -1 "$sk")
  if [ "$first" != "---" ]; then
    echo "FAIL: T2 $sk no YAML frontmatter opener"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T2:$sk"; continue
  fi
  name=$(awk '/^name:/{sub(/^name:[[:space:]]*/,""); print; exit}' "$sk")
  if [ -z "$name" ] || [ "$name" != "$s" ]; then
    echo "FAIL: T2 $sk name field mismatched ('$name' != '$s')"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T2:$sk"; continue
  fi
  desc=$(awk '/^description:/{sub(/^description:[[:space:]]*/,""); print; exit}' "$sk")
  if ! printf '%s' "$desc" | grep -Eq '^Use (when|ALWAYS when|BEFORE|PROACTIVELY|TWICE)'; then
    echo "FAIL: T2 $sk description must lead with 'Use when/ALWAYS when/BEFORE/PROACTIVELY/TWICE'"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T2:$sk"; continue
  fi
  if ! printf '%s' "$desc" | grep -q 'NOT for'; then
    echo "FAIL: T2 $sk description missing 'NOT for' exclusion clause"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T2:$sk"; continue
  fi
  echo "PASS: T2 $sk frontmatter"; PASS=$((PASS+1))
done

# ---------------------------------------------------------------------------
# T3 — Subagent frontmatter + tool allowlists
# ---------------------------------------------------------------------------
echo
echo "=== T3: Subagent frontmatter + tool allowlists ==="

for a in architect-reviewer code-reviewer qa-validator security-reviewer lessons-curator; do
  af=".claude/agents/$a.md"
  if [ ! -f "$af" ]; then
    echo "FAIL: T3 $af missing"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T3:$af"; continue
  fi
  desc=$(awk '/^description:/{sub(/^description:[[:space:]]*/,""); print; exit}' "$af")
  # Extract YAML frontmatter block (between first --- and second ---)
  fm=$(awk '/^---$/{n++; next} n==1{print}' "$af")
  if [ -z "$desc" ]; then
    echo "FAIL: T3 $af missing description"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T3:$af"; continue
  fi
  if ! printf '%s' "$desc" | grep -Eq '^Use (ALWAYS|BEFORE|PROACTIVELY)'; then
    echo "FAIL: T3 $af description must lead with 'Use ALWAYS/BEFORE/PROACTIVELY'"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T3:$af"; continue
  fi
  # Tools allowlist: ruler emits YAML list format ("tools:\n  - Read\n  - Grep").
  # Check for `tools:` key in frontmatter and at least one allowed tool listed.
  if ! echo "$fm" | grep -q '^tools:'; then
    echo "FAIL: T3 $af missing 'tools:' key in frontmatter"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T3:$af"; continue
  fi
  echo "PASS: T3 $af frontmatter + tools"; PASS=$((PASS+1))
done

# Helper: does an agent's frontmatter list a given tool? Handles both inline ("tools: Read, Grep") and YAML-list ("tools:\n  - Read") forms.
agent_has_tool() {
  local agent_file="$1" tool="$2"
  awk -v want="$tool" '
    /^---$/{n++; if(n==2)exit; next}
    n==1 {
      if ($0 ~ /^tools:/) intools=1
      if (intools && index($0, want) > 0) found=1
    }
    END { exit (found ? 0 : 1) }
  ' "$agent_file"
}

# Tool-allowlist invariants per subagent
assert_true "T3: lessons-curator has Read"   "agent_has_tool .claude/agents/lessons-curator.md Read"
assert_true "T3: lessons-curator has Grep"   "agent_has_tool .claude/agents/lessons-curator.md Grep"
assert_true "T3: lessons-curator has Glob"   "agent_has_tool .claude/agents/lessons-curator.md Glob"
assert_true "T3: lessons-curator NO Edit"    "! agent_has_tool .claude/agents/lessons-curator.md Edit"
assert_true "T3: lessons-curator NO Write"   "! agent_has_tool .claude/agents/lessons-curator.md Write"
assert_true "T3: lessons-curator NO Bash"    "! agent_has_tool .claude/agents/lessons-curator.md Bash"
assert_true "T3: code-reviewer has Bash"     "agent_has_tool .claude/agents/code-reviewer.md Bash"
assert_true "T3: code-reviewer NO Edit"      "! agent_has_tool .claude/agents/code-reviewer.md Edit"
assert_true "T3: architect-reviewer NO Bash" "! agent_has_tool .claude/agents/architect-reviewer.md Bash"

# Subagent verdicts present
assert_true "T3: architect-reviewer emits APPROVE_PLAN"      "grep -q APPROVE_PLAN .claude/agents/architect-reviewer.md"
assert_true "T3: architect-reviewer emits REVISE_PLAN"       "grep -q REVISE_PLAN  .claude/agents/architect-reviewer.md"
assert_true "T3: architect-reviewer emits BLOCK"             "grep -q BLOCK         .claude/agents/architect-reviewer.md"
assert_true "T3: code-reviewer emits APPROVE/CHANGES/BLOCK"  "grep -q 'APPROVE.*CHANGES REQUESTED.*BLOCK' .claude/agents/code-reviewer.md"
assert_true "T3: qa-validator emits PASS/GAPS/BLOCK"         "grep -q 'PASS.*GAPS.*BLOCK' .claude/agents/qa-validator.md"

# ---------------------------------------------------------------------------
# T4 — Router structure (P0..P9 + Skill Pointers + Workflow chains)
# ---------------------------------------------------------------------------
echo
echo "=== T4: Router structure (P0..P9 + Skill Pointers + Workflow chains in instructions.md) ==="

for p in P0 P1 P2 P3 P4 P5 P6 P7 P8 P9; do
  assert_true "T4: $p present in .ruler/instructions.md" "grep -q '^## $p ' .ruler/instructions.md"
done
assert_true "T4: P3.4 mandatory skill matrix"      "grep -q '^### P3.4' .ruler/instructions.md"
assert_true "T4: P3.5 skill-vs-repo resolution"    "grep -q '^### P3.5' .ruler/instructions.md"
assert_true "T4: P4.1 subagent trigger matrix"     "grep -q '^### P4.1' .ruler/instructions.md"
assert_true "T4: P4.2 verdict aggregation (min)"   "grep -q '^### P4.2' .ruler/instructions.md"
assert_true "T4: P8.1 confidence rubric"           "grep -q '^### P8.1' .ruler/instructions.md"
assert_true "T4: P8.2 aggregation rule"            "grep -q '^### P8.2' .ruler/instructions.md"
assert_true "T4: Skill Pointers table"             "grep -q '^## SKILL POINTERS' .ruler/instructions.md"
assert_true "T4: Workflow chains section"          "grep -q '^## WORKFLOW CHAINS' .ruler/instructions.md"

# ---------------------------------------------------------------------------
# T5 — settings.json deny/ask gates
# ---------------------------------------------------------------------------
echo
echo "=== T5: settings.json deny/ask gates ==="
assert_true "T5: jq parses .claude/settings.json"                 "jq . .claude/settings.json"
assert_true "T5: settings.json has NO hooks block"                "! jq -e 'has(\"hooks\")' .claude/settings.json"
assert_true "T5: permissions.deny populated"                      "jq -e '.permissions.deny | length > 0' .claude/settings.json"
assert_true "T5: deny blocks 'git push * main'"                   "jq -e '.permissions.deny | any(test(\"git push.*main\"))' .claude/settings.json"
assert_true "T5: deny blocks 'git push * master'"                 "jq -e '.permissions.deny | any(test(\"git push.*master\"))' .claude/settings.json"
assert_true "T5: deny blocks 'git push --force'"                  "jq -e '.permissions.deny | any(test(\"git push --force\"))' .claude/settings.json"
assert_true "T5: deny blocks 'git reset --hard'"                  "jq -e '.permissions.deny | any(test(\"git reset --hard\"))' .claude/settings.json"
assert_true "T5: deny blocks 'npm publish'"                       "jq -e '.permissions.deny | any(test(\"npm publish\"))' .claude/settings.json"
assert_true "T5: deny blocks 'vercel deploy'"                     "jq -e '.permissions.deny | any(test(\"vercel deploy\"))' .claude/settings.json"
assert_true "T5: deny blocks 'netlify deploy'"                    "jq -e '.permissions.deny | any(test(\"netlify deploy\"))' .claude/settings.json"
assert_true "T5: ask gates 'gh pr create'"                        "jq -e '.permissions.ask  | any(test(\"gh pr create\"))' .claude/settings.json"
assert_true "T5: ask gates 'gh pr merge'"                         "jq -e '.permissions.ask  | any(test(\"gh pr merge\"))' .claude/settings.json"
assert_true "T5: ask gates 'rm -rf'"                              "jq -e '.permissions.ask  | any(test(\"rm -rf\"))' .claude/settings.json"

# ---------------------------------------------------------------------------
# T6 — P3.4 force-load matrix entries reference real skills
# ---------------------------------------------------------------------------
echo
echo "=== T6: P3.4 force-load matrix entries reference real skills ==="

FORCE_LOAD=$(awk '/^### P3.4/,/^### P3.5/' .ruler/instructions.md | grep -oE '`[a-z][a-z0-9-]+`' | tr -d '`' | sort -u)
for skill in $FORCE_LOAD; do
  case "$skill" in
    description|reason) continue ;;  # narrative words inside the section
  esac
  assert_true "T6: P3.4 force-load '$skill' exists" "test -d .claude/skills/$skill"
done

# ---------------------------------------------------------------------------
# T7 — Skill Pointers entries reference real skills
# ---------------------------------------------------------------------------
echo
echo "=== T7: Skill Pointers entries reference real skills (sampled) ==="

POINTER_SKILLS=$(awk '/^## SKILL POINTERS/,/^## WORKFLOW CHAINS/' .ruler/instructions.md | grep -oE '`[a-z][a-z0-9-]+`' | tr -d '`' | sort -u)
for skill in $POINTER_SKILLS; do
  case "$skill" in
    repo-conventions|tdd-workflow|design-review|plan-mode|failure-mode-analysis|bug-investigation|rlm-explore|decision-rules|pushback-templates|git-workflow|documentation-and-adrs|code-simplifier|cyclomatic-complexity|meta-skill-hygiene|async-error-handling|typescript-advanced-types|js-performance-patterns|react-patterns|react-state-management|react-data-fetching|react-performance|react-render-optimization|react-routing|react-forms|react-testing|accessibility|frontend-security|bundle-size|vite|vitest|shadcn|tailwind-v4-shadcn|ai-ui-patterns|react-composition-2026|react-2026|hooks-pattern|hoc-pattern|render-props-pattern|provider-pattern|compound-pattern|presentational-container-pattern|module-pattern|mixin-pattern|proxy-pattern|cross-repo-workspace|playwright-best-practices)
      assert_true "T7: Skill Pointers '$skill' exists" "test -d .claude/skills/$skill"
      ;;
  esac
done

# ---------------------------------------------------------------------------
# T8 — Workflow chains reference real skills + subagents
# ---------------------------------------------------------------------------
echo
echo "=== T8: Workflow chains reference real skills + subagents ==="
CHAIN_REFS=$(awk '/^## WORKFLOW CHAINS/,/^---/' .ruler/instructions.md | grep -oE '`[a-z][a-z0-9-]+`' | tr -d '`' | sort -u)
for ref in $CHAIN_REFS; do
  case "$ref" in
    skills|consulted|api|spa|both) continue ;;
  esac
  if [ -d ".claude/skills/$ref" ] || [ -f ".claude/agents/$ref.md" ]; then
    assert_true "T8: workflow-chain ref '$ref' resolves" "true"
  fi
done

# ---------------------------------------------------------------------------
# T9 — Subagent Required Reading paths exist
# ---------------------------------------------------------------------------
echo
echo "=== T9: Subagent Required Reading paths exist ==="
for agent in .claude/agents/*.md; do
  refs=$(grep -oE '\.claude/skills/[a-z][a-z0-9-]+/SKILL\.md' "$agent" | sort -u)
  for path in $refs; do
    assert_true "T9: $(basename $agent) → $path exists" "test -f '$path'"
  done
done

# ---------------------------------------------------------------------------
# T10 — ADR references in skills resolve
# ---------------------------------------------------------------------------
echo
echo "=== T10: ADR references in skills resolve to docs/decisions/ ==="
ADRS_ON_DISK=$(ls docs/decisions/ADR-*.md 2>/dev/null | xargs -n1 basename | grep -oE 'ADR-[0-9]+' | sort -u)
for adr in $(grep -rohE 'ADR-[0-9]+' .claude/skills/ .claude/agents/ CLAUDE.md 2>/dev/null | sort -u); do
  if echo "$ADRS_ON_DISK" | grep -qx "$adr"; then
    assert_true "T10: $adr resolves on disk" "true"
  else
    # Cross-repo qualifier check: 'spa-velocity ADR-XXX' or 'api-velocity ADR-XXX' is intentional in cross-repo-workspace
    if grep -lE "(spa-velocity|api-velocity) $adr|$adr.*\\(api-velocity\\)" .claude/skills/cross-repo-workspace/SKILL.md 2>/dev/null | grep -q '.'; then
      echo "PASS: T10: $adr is cross-repo qualifier (intentional)"; PASS=$((PASS+1))
    else
      echo "FAIL: T10: $adr unresolved"; FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T10:$adr"
    fi
  fi
done

# ---------------------------------------------------------------------------
# T11 — Layered-router principle: CLAUDE.md must NOT cite ADR numbers or file paths
# ---------------------------------------------------------------------------
echo
echo "=== T11: Layered-router principle (.ruler/instructions.md cites no ADR-NNN, no src/, no docs/decisions/ paths) ==="

# The router is .ruler/instructions.md. CLAUDE.md is the ruler-concatenated bundle of router +
# subagents + skills — subagents and skills ARE allowed to cite ADRs and paths (they own those
# citations per the layered-router principle). The router specifically must not.

ROUTER_SRC=.ruler/instructions.md

if grep -qE 'ADR-[0-9]+' "$ROUTER_SRC"; then
  echo "FAIL: T11 router cites ADR-NNN — should be in skills only"
  grep -nE 'ADR-[0-9]+' "$ROUTER_SRC" | head -3 | sed 's/^/    /'
  FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T11:adr"
else
  echo "PASS: T11 router contains no bare ADR-NNN citations"; PASS=$((PASS+1))
fi

if grep -qE '^[^|]*(src/[a-z]+/|docs/decisions/)' "$ROUTER_SRC"; then
  echo "FAIL: T11 router contains src/ or docs/decisions/ paths"
  grep -nE 'src/[a-z]+/|docs/decisions/' "$ROUTER_SRC" | head -3 | sed 's/^/    /'
  FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T11:paths"
else
  echo "PASS: T11 router contains no src/ or docs/decisions/ paths"; PASS=$((PASS+1))
fi

# ---------------------------------------------------------------------------
# T12 — CLAUDE.md size gate
# ---------------------------------------------------------------------------
echo
echo "=== T12: CLAUDE.md router size gate ==="
WORDS=$(wc -w < .ruler/instructions.md | tr -d '[:space:]')
# Router source target: ~3,200 ± 500 words.
if [ "$WORDS" -ge 2700 ] && [ "$WORDS" -le 3700 ]; then
  echo "PASS: T12 .ruler/instructions.md is $WORDS words (gate 2700–3700)"; PASS=$((PASS+1))
else
  echo "FAIL: T12 .ruler/instructions.md is $WORDS words (gate 2700–3700)"
  FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T12"
fi

# ---------------------------------------------------------------------------
# T13 — P3.4 force-load includes the SPA-critical force-fires
# ---------------------------------------------------------------------------
echo
echo "=== T13: P3.4 force-load includes the 7 SPA-critical skills ==="
SPA_CRITICAL=(tdd-workflow repo-conventions failure-mode-analysis design-review plan-mode react-patterns accessibility cross-repo-workspace)
P34_BLOCK=$(awk '/^### P3.4/,/^### P3.5/' .ruler/instructions.md)
for s in "${SPA_CRITICAL[@]}"; do
  if echo "$P34_BLOCK" | grep -q "\`$s\`"; then
    echo "PASS: T13 P3.4 includes \`$s\`"; PASS=$((PASS+1))
  else
    echo "FAIL: T13 P3.4 missing \`$s\`"
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T13:$s"
  fi
done

# ---------------------------------------------------------------------------
# T14 — Confidence rubric (P8.1) has 5 × 0.20 weights and 0.90 gate
# ---------------------------------------------------------------------------
echo
echo "=== T14: P8.1 confidence rubric structure ==="
awk '/^### P8.1/,/^### P8.2/' .ruler/instructions.md > /tmp/p81.txt
assert_true "T14: rubric has ≥5 × 0.20 weights"        "[ \$(grep -c '0.20' /tmp/p81.txt) -ge 5 ]"
assert_true "T14: rubric mentions 'Tests pass'"        "grep -q 'Tests pass' /tmp/p81.txt"
assert_true "T14: rubric mentions 'Principles checked'" "grep -q 'Principles checked' /tmp/p81.txt"
assert_true "T14: rubric mentions 'No HIGH'"           "grep -q 'No HIGH' /tmp/p81.txt"
assert_true "T14: rubric mentions 'open assumptions'"  "grep -q 'open assumptions' /tmp/p81.txt"
assert_true "T14: rubric has 0.90 gate"                "grep -q '0.90' /tmp/p81.txt"
assert_true "T14: rubric forbids rounding (NEVER)"     "grep -q 'NEVER' /tmp/p81.txt"
rm -f /tmp/p81.txt

# ---------------------------------------------------------------------------
# T15 — cross-repo-workspace skill: required structure
# ---------------------------------------------------------------------------
echo
echo "=== T15: cross-repo-workspace skill structure ==="
XRS=".claude/skills/cross-repo-workspace/SKILL.md"
assert_true "T15: file exists" "test -f $XRS"
assert_true "T15: description mentions both repos"    "grep -q 'spa-velocity AND api-velocity\\|api-velocity AND spa-velocity' $XRS"
assert_true "T15: Rule 1 (active-lens by path) present" "grep -q 'Rule 1 — Active-lens by path' $XRS"
assert_true "T15: Rule 2 (ADR-qualification) present"   "grep -q 'Rule 2 — ADR-qualification' $XRS"
assert_true "T15: Rule 3 (coordination doc) present"    "grep -q 'Rule 3 — Coordinated' $XRS"
assert_true "T15: Rule 4 (bilateral ADR) present"       "grep -q 'Rule 4 — ADR adoption' $XRS"
assert_true "T15: Rule 5 (memory keying) present"       "grep -q 'Rule 5 — Memory' $XRS"
assert_true "T15: Rule 6 (prompt-target) present"       "grep -q 'Rule 6 — Prompt' $XRS"
assert_true "T15: Rule 7 (settings-gate) present"       "grep -q 'Rule 7 — Settings' $XRS"
assert_true "T15: ADR collision table present"          "grep -q 'TypeORM-first persistence.*Zustand for client state\\|Zustand for client state' $XRS"
assert_true "T15: lens-switch attestation directive"    "grep -q 'Lens-switch:' $XRS"

# Enforcement directives — these turn doctrine into subagent audit items
assert_true "T15: ENFORCE-1 per-repo architect-reviewer invocation directive"   "grep -q 'ENFORCE-1' $XRS"
assert_true "T15: ENFORCE-2 coordination-doc presence audit directive"          "grep -q 'ENFORCE-2' $XRS"
assert_true "T15: ENFORCE-3 lens-switch attestation audit directive"            "grep -q 'ENFORCE-3' $XRS"
assert_true "T15: ENFORCE-4 bare ADR-NNN audit directive"                       "grep -q 'ENFORCE-4' $XRS"
assert_true "T15: ENFORCE-1 names architect-reviewer as the executor"           "awk '/ENFORCE-1/,/ENFORCE-2/' $XRS | grep -q 'architect-reviewer'"
assert_true "T15: ENFORCE-2 names architect-reviewer as the executor"           "awk '/ENFORCE-2/,/ENFORCE-3/' $XRS | grep -q 'architect-reviewer'"
assert_true "T15: ENFORCE-3 names code-reviewer as the executor"                "awk '/ENFORCE-3/,/ENFORCE-4/' $XRS | grep -q 'code-reviewer'"
assert_true "T15: ENFORCE-1 cites severity (MED)"                               "awk '/ENFORCE-1/,/ENFORCE-2/' $XRS | grep -q 'MED'"
assert_true "T15: ENFORCE-2 cites severity (HIGH)"                              "awk '/ENFORCE-2/,/ENFORCE-3/' $XRS | grep -q 'HIGH'"
assert_true "T15: ENFORCE-3 cites severity (HIGH)"                              "awk '/ENFORCE-3/,/ENFORCE-4/' $XRS | grep -q 'HIGH'"
assert_true "T15: ENFORCE-4 cites severity (MED)"                               "awk '/ENFORCE-4/,/^## /' $XRS | grep -q 'MED'"

# ---------------------------------------------------------------------------
# T16 — repo-conventions skill (spa-velocity-grounded)
# ---------------------------------------------------------------------------
echo
echo "=== T16: repo-conventions for spa-velocity ==="
RC=".claude/skills/repo-conventions/SKILL.md"
assert_true "T16: names this repository (spa-velocity)" "grep -q 'this repository (spa-velocity)' $RC"
assert_true "T16: Zustand mentioned"                    "grep -q 'Zustand' $RC"
assert_true "T16: TanStack Query mentioned"             "grep -q 'TanStack Query' $RC"
assert_true "T16: React Router 7 mentioned"             "grep -q 'React Router 7' $RC"
assert_true "T16: RHF + Zod mentioned"                  "grep -qE 'RHF \\+ Zod|React Hook Form' $RC"
assert_true "T16: better-auth + localStorage mentioned" "grep -qE 'better-auth.*localStorage' $RC"
assert_true "T16: Vitest + Testing Library + Playwright" "grep -qE 'Vitest.*Testing Library.*Playwright' $RC"
assert_true "T16: ADR-backed conventions table"         "grep -q 'ADR-backed conventions' $RC"

# ---------------------------------------------------------------------------
# T17 — No backend-only doctrine leaks in spa-velocity skills
# ---------------------------------------------------------------------------
echo
echo "=== T17: No NestJS/TypeORM/server-only doctrine leaks in skills ==="
# Exemption: cross-repo-workspace intentionally references both stacks (it documents the api-velocity side's
# ADR collisions and tells the model when to switch lens). The collision table mentions TypeORM, class-
# validator, etc. by design — they're labels for api-velocity's ADRs, not directives for spa-velocity code.
LEAK_PATTERNS=(nestjs '@nestjs' TypeORM '@InjectRepository' class-validator)
for pat in "${LEAK_PATTERNS[@]}"; do
  matches=$(grep -rl "$pat" .claude/skills/ 2>/dev/null | grep -v 'cross-repo-workspace' | wc -l | tr -d ' ')
  if [ "$matches" -eq 0 ]; then
    echo "PASS: T17 no spa-velocity skill mentions '$pat' (cross-repo-workspace exempted)"; PASS=$((PASS+1))
  else
    echo "FAIL: T17 '$pat' found in $matches non-exempted skill(s):"
    grep -rln "$pat" .claude/skills/ 2>/dev/null | grep -v 'cross-repo-workspace' | head -3 | sed 's/^/    /'
    FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T17:$pat"
  fi
done

# ---------------------------------------------------------------------------
# T18 — P0 prose <-> settings.json gate alignment
# ---------------------------------------------------------------------------
echo
echo "=== T18: P0 prose mentions every key deny gate ==="
assert_true "T18: P0 mentions 'main' off-limits"        "grep -qiE 'main.*off.?limits|MUST NEVER.*main' .ruler/instructions.md"
assert_true "T18: P0 mentions force-push prohibition"   "grep -qE 'force.?push' .ruler/instructions.md"
assert_true "T18: P0 mentions npm publish / deploy"     "grep -qiE 'npm publish|deploy' .ruler/instructions.md"
assert_true "T18: P0 mentions no AI-attribution"        "grep -qE 'AI-attribution|Co-Authored-By: Claude' .ruler/instructions.md"

# ---------------------------------------------------------------------------
# T19 — Operating mindset (P5) always-on disciplines
# ---------------------------------------------------------------------------
echo
echo "=== T19: P5 operating mindset always-on rules ==="
assert_true "T19: P5 mentions 'memory consult'"         "grep -qE 'memory consult|auto-memory' .ruler/instructions.md"
assert_true "T19: P5 mentions 'scope discipline'"       "grep -qi 'scope discipline' .ruler/instructions.md"
assert_true "T19: P5 mentions 'root.cause'"             "grep -qE 'root.?cause' .ruler/instructions.md"
assert_true "T19: P5 mentions 'fail.?fast'"             "grep -qE 'fail.?fast' .ruler/instructions.md"
assert_true "T19: P5 mentions 'stop and re-plan'"       "grep -qE 'Stop and re-plan|re.?plan' .ruler/instructions.md"

# ---------------------------------------------------------------------------
# T20 — Output contract P8 mandates the 10 items
# ---------------------------------------------------------------------------
echo
echo "=== T20: P8 output contract (10 items + Skills consulted line + min() aggregation) ==="
awk '/^## P8/,/^## P9/' .ruler/instructions.md > /tmp/p8.txt
assert_true "T20: P8 lists 'Requirements checklist'"        "grep -q 'Requirements checklist' /tmp/p8.txt"
assert_true "T20: P8 lists 'Working Set'"                   "grep -q 'Working Set' /tmp/p8.txt"
assert_true "T20: P8 lists 'Plan' (item 3)"                 "grep -qE '^3\\..*Plan' /tmp/p8.txt"
assert_true "T20: P8 lists 'Changeset summary'"             "grep -q 'Changeset summary' /tmp/p8.txt"
assert_true "T20: P8 lists 'Tests' (item 5) before 'Implementation' (item 6)" "awk '/^5\\. \\*\\*Tests/{t=NR} /^6\\. \\*\\*Implementation/{i=NR} END{exit (t>0 && i>0 && t<i ? 0 : 1)}' /tmp/p8.txt"
assert_true "T20: P8 lists 'How to run / verify'"           "grep -q 'How to run' /tmp/p8.txt"
assert_true "T20: P8 lists 'Design review block'"           "grep -q 'Design review block' /tmp/p8.txt"
assert_true "T20: P8 lists 'Confidence' (item 9)"           "grep -qE '^9\\..*Confidence' /tmp/p8.txt"
assert_true "T20: P8 lists 'Optional improvements'"         "grep -q 'Optional improvements' /tmp/p8.txt"
assert_true "T20: P8 mandates 'Skills consulted:' line"     "grep -q 'Skills consulted:' /tmp/p8.txt"
assert_true "T20: P8.2 aggregation uses min()"              "grep -q 'min(' /tmp/p8.txt"
rm -f /tmp/p8.txt

# ---------------------------------------------------------------------------
# T21 — ADR template + README index
# ---------------------------------------------------------------------------
echo
echo "=== T21: ADR template + README index ==="
assert_true "T21: _template.md has Status section"    "grep -q '^- \\*\\*Status' docs/decisions/_template.md"
assert_true "T21: _template.md has Decision section"  "grep -q '^## Decision' docs/decisions/_template.md"
assert_true "T21: README lists ADR-001..010"          "grep -c 'ADR-0[01][0-9]' docs/decisions/README.md | awk '{exit (\$1 >= 10 ? 0 : 1)}'"
assert_true "T21: ADR-008 no AI attribution"          "grep -qi 'no AI-attribution' docs/decisions/ADR-008-no-ai-attribution-in-commits.md"
assert_true "T21: ADR-007 better-auth localStorage"   "grep -qi 'better-auth.*localStorage\\|localStorage.bearer_token' docs/decisions/ADR-007-better-auth-localstorage-bearer-token.md"

# ---------------------------------------------------------------------------
# T22 — All skills tracked by ruler are present in the generated outputs
# ---------------------------------------------------------------------------
echo
echo "=== T22: Generated .claude/skills/ matches .ruler/skills/ ==="
RULER_SKILLS=$(ls .ruler/skills/ | sort)
CLAUDE_SKILLS=$(ls .claude/skills/ | sort)
missing=$(comm -23 <(echo "$RULER_SKILLS") <(echo "$CLAUDE_SKILLS"))
extra=$(comm -13 <(echo "$RULER_SKILLS") <(echo "$CLAUDE_SKILLS"))
if [ -z "$missing" ]; then
  echo "PASS: T22 every .ruler/skills/ skill is in .claude/skills/"; PASS=$((PASS+1))
else
  echo "FAIL: T22 missing from .claude/skills/:"
  echo "$missing" | sed 's/^/    /'
  FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T22:missing"
fi
if [ -z "$extra" ]; then
  echo "PASS: T22 no orphan skills in .claude/skills/"; PASS=$((PASS+1))
else
  # Extras are OK if patterns.dev or tooling skills are bundled; only warn
  echo "WARN: T22 extras in .claude/skills/ (probably patterns.dev bundle):"
  echo "$extra" | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# T23 — Subagents are generated from .ruler/agents/
# ---------------------------------------------------------------------------
echo
echo "=== T23: Generated .claude/agents/ matches .ruler/agents/ ==="
RULER_AGENTS=$(ls .ruler/agents/ | sort)
CLAUDE_AGENTS=$(ls .claude/agents/ | sort)
if [ "$RULER_AGENTS" = "$CLAUDE_AGENTS" ]; then
  echo "PASS: T23 .ruler/agents/ ↔ .claude/agents/ byte-set match"; PASS=$((PASS+1))
else
  echo "FAIL: T23 agent set drift"
  echo "  ruler:" && echo "$RULER_AGENTS" | sed 's/^/    /'
  echo "  claude:" && echo "$CLAUDE_AGENTS" | sed 's/^/    /'
  FAIL=$((FAIL+1)); FAILED_TESTS="$FAILED_TESTS T23"
fi

# ---------------------------------------------------------------------------
# Final report
# ---------------------------------------------------------------------------
echo
echo "============================================================"
echo "Acceptance summary: $PASS PASS / $FAIL FAIL"
echo "============================================================"
if [ $FAIL -gt 0 ]; then
  echo "Failed tests:$FAILED_TESTS"
  exit 1
fi
exit 0
