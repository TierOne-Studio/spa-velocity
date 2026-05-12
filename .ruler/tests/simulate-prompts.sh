#!/usr/bin/env bash
# simulate-prompts.sh — static skill-trigger simulation for spa-velocity.
#
# This is NOT an LLM run. It's a static contract test: for each canonical
# (prompt, expected_skills) case, assert that every expected skill's
# description contains enough keywords from the prompt that the LLM's
# description-match heuristic would plausibly load it.
#
# Failure means trigger drift: either the skill description was weakened,
# or the prompt's expected skill list is now stale.
#
# Threshold: every expected skill must contain ≥1 lowercased prompt token
# (length ≥4) in its description. Stop-words filtered.
#
# Usage: bash .ruler/tests/simulate-prompts.sh

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_DIR"

PASS=0
FAIL=0
FAILED=""

# Stop-words excluded from keyword matching.
STOP_WORDS="the a an this that these those is are was were be been being have has had do does did will would could should may might can must shall and or but if then else when while of in on at by for to from with into onto over under up down out off about our we i you they it its their my your add new use using fix update create make build write test"

skill_description() {
  local name="$1"
  local f=".claude/skills/$name/SKILL.md"
  if [ ! -f "$f" ]; then
    echo ""
    return
  fi
  awk '/^description:/{sub(/^description:[[:space:]]*/,""); print; exit}' "$f" | tr '[:upper:]' '[:lower:]'
}

prompt_tokens() {
  local p="$1"
  echo "$p" | tr '[:upper:]' '[:lower:]' \
    | tr -c '[:alpha:]' ' ' \
    | tr ' ' '\n' \
    | awk -v stop="$STOP_WORDS" '
        BEGIN { n = split(stop, arr, " "); for (i=1;i<=n;i++) s[arr[i]] = 1 }
        length($0) >= 4 && !($0 in s) { print }
      ' \
    | sort -u
}

match_count() {
  local prompt="$1" desc="$2"
  local count=0
  while IFS= read -r tok; do
    [ -z "$tok" ] && continue
    if printf '%s' "$desc" | grep -q "$tok"; then
      count=$((count+1))
    fi
  done <<EOF
$(prompt_tokens "$prompt")
EOF
  echo "$count"
}

THRESHOLD=1
check_case() {
  local case_name="$1" prompt="$2" expected_skill="$3"
  local desc
  desc=$(skill_description "$expected_skill")
  if [ -z "$desc" ]; then
    echo "FAIL: $case_name — skill '$expected_skill' has no description (or skill missing)"
    FAIL=$((FAIL+1)); FAILED="$FAILED $case_name:$expected_skill"
    return
  fi
  local n
  n=$(match_count "$prompt" "$desc")
  if [ "$n" -ge "$THRESHOLD" ]; then
    echo "PASS: $case_name → $expected_skill ($n keyword(s) matched)"
    PASS=$((PASS+1))
  else
    echo "FAIL: $case_name → $expected_skill (only $n keyword(s), need ≥$THRESHOLD)"
    echo "  prompt: $prompt"
    echo "  desc[:200]: ${desc:0:200}"
    FAIL=$((FAIL+1)); FAILED="$FAILED $case_name:$expected_skill"
  fi
}

run_case() {
  local id="$1" prompt="$2" expected_csv="$3"
  IFS=',' read -ra skills <<< "$expected_csv"
  for s in "${skills[@]}"; do
    check_case "$id" "$prompt" "$s"
  done
}

# Workflow-chain mention check
check_workflow_chain_mentions() {
  local case_name="$1" expected_skills_csv="$2"
  local section
  section=$(awk '/^## WORKFLOW CHAINS/,/^---/' .ruler/instructions.md)
  IFS=',' read -ra arr <<< "$expected_skills_csv"
  for s in "${arr[@]}"; do
    if printf '%s' "$section" | grep -q "$s"; then
      echo "PASS: $case_name workflow-chain mentions $s"
      PASS=$((PASS+1))
    else
      echo "FAIL: $case_name workflow-chain missing $s"
      FAIL=$((FAIL+1)); FAILED="$FAILED $case_name:chain:$s"
    fi
  done
}

echo "=== Skill-trigger simulation: prompt → expected skill descriptions ==="
echo
echo "NOTE: Per P3.4, several skills (tdd-workflow, repo-conventions, design-review,"
echo "failure-mode-analysis, plan-mode, react-patterns, accessibility, cross-repo-workspace)"
echo "are MANDATORY for any executable-code change — they fire regardless of description"
echo "match. Per-case keyword assertions below only cover DISCRETIONARY skills (those whose"
echo "triggering depends on the prompt's content)."
echo

# --- React feature work -----------------------------------------------------
echo "--- Case: feature — new route + data fetching"
run_case "feat-route" \
  "Add a new protected route that fetches user profile data and shows a loading state" \
  "react-routing,react-data-fetching,react-state-management"
check_workflow_chain_mentions "feat-route" "react-patterns,react-routing,react-state-management"

echo
echo "--- Case: form work"
run_case "feat-form" \
  "Add a new signup form with email validation and async submit error handling" \
  "react-forms,async-error-handling"

echo
echo "--- Case: rendering performance"
run_case "perf-rerender" \
  "Investigate why this component rerenders on every keystroke and reduce the rerender cost" \
  "react-performance,react-render-optimization,react-state-management"

echo
echo "--- Case: bundle work"
run_case "perf-bundle" \
  "Add a new dependency for date formatting and check the bundle size impact" \
  "bundle-size,frontend-security"

echo
echo "--- Case: a11y"
run_case "a11y-dialog" \
  "Add a confirmation dialog with keyboard navigation and focus management" \
  "accessibility,react-patterns"

# --- Security work ----------------------------------------------------------
echo
echo "--- Case: XSS / token storage"
run_case "sec-xss" \
  "Render user-submitted markdown safely without enabling raw HTML injection" \
  "frontend-security"

run_case "sec-tokens" \
  "Review how the auth token is stored and whether localStorage exposure is acceptable" \
  "frontend-security"

# --- Routing & auth ---------------------------------------------------------
echo
echo "--- Case: route guard"
run_case "route-guard" \
  "Add an admin-only route that redirects unauthenticated users to /login" \
  "react-routing,frontend-security"

# --- Bug investigation ------------------------------------------------------
echo
echo "--- Case: failing test"
run_case "bug-failing-test" \
  "This test is failing intermittently in CI — investigate the root cause" \
  "bug-investigation,failure-mode-analysis"

# --- Cross-repo coordination ------------------------------------------------
echo
echo "--- Case: cross-repo feature"
run_case "cross-repo-feat" \
  "Add a /users/me endpoint in api-velocity and a useMe() hook in spa-velocity using TanStack Query with caching and optimistic updates" \
  "cross-repo-workspace,react-data-fetching"

# --- TDD & process ----------------------------------------------------------
echo
echo "--- Case: planning a non-trivial change"
run_case "plan-feat" \
  "Plan a refactor that splits the chat feature into three smaller modules" \
  "plan-mode,bug-investigation"

# --- ADR + documentation ---------------------------------------------------
echo
echo "--- Case: structural decision"
run_case "adr-decision" \
  "We need to decide between Zustand and Jotai for the new feature; document the rationale" \
  "documentation-and-adrs,decision-rules"

# --- Test stack ------------------------------------------------------------
echo
echo "--- Case: writing a component test"
run_case "test-component" \
  "Write a Vitest test for this component using Testing Library queries" \
  "react-testing,vitest"

echo
echo "--- Case: writing a Playwright e2e"
run_case "test-e2e" \
  "Write a Playwright test that walks the login flow including OAuth redirect handling" \
  "playwright-best-practices"

# --- TypeScript advanced ---------------------------------------------------
echo
echo "--- Case: complex generics"
run_case "ts-generics" \
  "Define a type-safe generic hook with conditional return types based on the input shape" \
  "typescript-advanced-types"

# --- Async patterns --------------------------------------------------------
echo
echo "--- Case: async error handling"
run_case "async-patterns" \
  "Refactor this Promise.all to allow partial failures using Promise.allSettled with AbortSignal" \
  "async-error-handling"

# --- Cyclomatic complexity -------------------------------------------------
echo
echo "--- Case: nested if-else"
run_case "complexity-nested" \
  "Flatten the nested conditionals in this function using guard clauses and early returns" \
  "cyclomatic-complexity"

# --- Git workflow ----------------------------------------------------------
echo
echo "--- Case: PR creation"
run_case "git-pr" \
  "Commit the changes and open a pull request against main" \
  "git-workflow"

# --- Pushback --------------------------------------------------------------
echo
echo "--- Case: simpler alternative + pushback"
run_case "pushback" \
  "The user proposed introducing a new library; surface a simpler alternative and the scope tradeoff before deciding the framing" \
  "pushback-templates,decision-rules"

# --- RLM explore -----------------------------------------------------------
echo
echo "--- Case: unfamiliar codebase"
run_case "rlm" \
  "I'm new to this repo — help me understand the chat feature's architecture" \
  "rlm-explore,repo-conventions"

# --- Final report ----------------------------------------------------------
echo
echo "============================================================"
echo "Simulation summary: $PASS PASS / $FAIL FAIL"
echo "============================================================"
if [ $FAIL -gt 0 ]; then
  echo "Failed cases:$FAILED"
  echo
  echo "Drift signal — either:"
  echo "  (a) a skill description was weakened (removed a load-bearing keyword), OR"
  echo "  (b) the test case is stale (the prompt's expected skill list no longer reflects intent)"
  echo
  echo "Fix the side that's actually wrong. Don't just rubber-stamp."
  exit 1
fi
exit 0
