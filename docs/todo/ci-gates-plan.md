# CI Gates Plan — Cross-Repo Drift Prevention

## Context

The recent CLAUDE.md refactor (PR-19 spa-velocity, PR-16 api-velocity) installed a `cross-repo-workspace` skill with 4 review-time enforcement directives (ENFORCE-1..4). Those catch what subagents can see *at review time*: missing coordination doc, missing lens-switch attestation, unqualified ADR refs, single-side architect review.

But several cross-repo failure modes bite at **integration time**, after review approves the diff. The simulation in the prior conversation flagged these:

1. **Missing DB migration** — api-velocity diff adds a TypeORM entity, but no `*.sql` migration file ships with it. E2E fails on `relation does not exist`.
2. **DTO ↔ Zod schema drift** — api-velocity changes a response shape; spa-velocity's Zod parser throws at runtime. Tests in each repo pass independently; integration breaks.
3. **One-sided contract change** — api-velocity adds/removes/renames an endpoint without a paired spa-velocity client update. Reverse direction also possible.
4. **No full-stack e2e in CI** — spa-velocity's e2e infra already supports cross-repo boot (`playwright.config.ts` webServer at `../../api-velocity`), but CI never exercises it. First integration test is production.

The four gates below close these gaps. Phased so the cheap wins ship first.

---

## Phase A — Mechanical wins (Migration-applied + Full-stack smoke)

### Gate A1: Migration-applied (api-velocity CI)

**Lives in:** `api-velocity/.github/workflows/` (new workflow or step added to existing)

**What it catches:** A PR that adds/modifies a file matching `src/**/*.entity.ts` but does NOT add a new file under `src/shared/infrastructure/database/migrations/*.sql`.

**Implementation:** new workflow `migration-gate.yml` triggered on PR:

```yaml
on:
  pull_request:
    branches: [master]
jobs:
  migration-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Detect entity changes
        run: |
          ENTITY_CHANGES=$(git diff --name-only origin/${{ github.base_ref }}...HEAD \
            -- 'src/**/*.entity.ts' | wc -l | tr -d ' ')
          MIGRATION_ADDS=$(git diff --name-only --diff-filter=A origin/${{ github.base_ref }}...HEAD \
            -- 'src/shared/infrastructure/database/migrations/*.sql' | wc -l | tr -d ' ')
          if [ "$ENTITY_CHANGES" -gt 0 ] && [ "$MIGRATION_ADDS" -eq 0 ]; then
            echo "::error::Entity files changed but no migration added."
            git diff --name-only origin/${{ github.base_ref }}...HEAD -- 'src/**/*.entity.ts'
            exit 1
          fi
```

**Escape hatch:** commit message contains `[skip-migration-check]` AND has user approval — for legitimate cases (rename, type-only entity change).

**Critical files:**
- `api-velocity/.github/workflows/migration-gate.yml` (new)
- Existing: `api-velocity/src/shared/infrastructure/database/migrations/` (the canonical migration location)

**Estimated effort:** 30–45 min.

---

### Gate A2: Full-stack smoke (spa-velocity CI)

**Lives in:** `spa-velocity/.github/workflows/` (new workflow)

**What it catches:** spa-velocity's diff breaks integration with the *current* api-velocity master, OR a cross-repo PR pair fails when run together.

**Implementation:** new workflow `cross-repo-smoke.yml` triggered on PR:

```yaml
on:
  pull_request:
    branches: [main]
jobs:
  smoke:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready
    steps:
      - name: Check out spa-velocity
        uses: actions/checkout@v4
        with: { path: spa-velocity }
      - name: Check out api-velocity
        uses: actions/checkout@v4
        with:
          repository: TierOne-Studio/api-velocity
          ref: master
          path: api-velocity
          token: ${{ secrets.CROSS_REPO_TOKEN }}
      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Install api-velocity
        run: cd api-velocity && npm ci
      - name: Apply migrations
        run: cd api-velocity && psql -h localhost -U postgres -f src/shared/infrastructure/database/migrations/001_initial_schema.sql
        # extend: loop over all *.sql files in order
      - name: Install spa-velocity
        run: cd spa-velocity && npm ci
      - name: Playwright install
        run: cd spa-velocity && npx playwright install chromium --with-deps
      - name: Smoke e2e (cross-repo)
        run: cd spa-velocity && npm run test:e2e:smoke
        env:
          BACKEND_PROJECT_ROOT: ${{ github.workspace }}/api-velocity
          E2E_API_BASE_URL: http://127.0.0.1:3100
          E2E_FE_URL: http://127.0.0.1:4173
```

**Note:** `playwright.config.ts` already understands `BACKEND_PROJECT_ROOT` env var and uses `webServer` to boot api-velocity. The existing `e2e/global-setup.ts` seeds the test DB. **No application code changes needed** — only the CI workflow.

**Critical files:**
- `spa-velocity/.github/workflows/cross-repo-smoke.yml` (new)
- Existing: `spa-velocity/playwright.config.ts`, `spa-velocity/e2e/global-setup.ts`, `spa-velocity/e2e/auth/auth.spec.ts` (the smoke target)
- Requires: GitHub secret `CROSS_REPO_TOKEN` (PAT or App token) with read access to api-velocity

**Cross-PR coordination (optional extension):** in a coordinated cross-repo PR, the spa-velocity PR body can include `Uses api-velocity: <branch-name>` and the workflow parses that to use the paired branch instead of `master`. ~+15 lines of YAML.

**Estimated effort:** 60–90 min, mostly token + secrets setup.

---

## Phase B — Heuristic gate (Bilateral-ADR check)

### Gate B1: Bilateral-contract change detection

**Lives in:** Both repos. Bidirectional check.

**What it catches:** A PR that changes an API contract (new/removed/renamed endpoint, modified response DTO) in api-velocity *without* a paired PR in spa-velocity (or vice versa).

**Implementation challenge:** "contract-changing" is heuristic. Reasonable detectors:
- In **api-velocity**: diff touches `src/**/*.controller.ts` AND changes route paths (`@Get('...')`/`@Post(...)`) or DTO shapes
- In **spa-velocity**: diff touches `src/**/services/*.ts` AND changes endpoint paths in axios calls, or `src/**/types/*.ts` API-response types

**Approach:** GitHub Actions workflow + comment-based pairing convention.

PR description convention (enforced by workflow):
- API-side contract PR includes: `### Cross-repo\nPaired SPA PR: TierOne-Studio/spa-velocity#NNN`
- SPA-side contract PR includes: `### Cross-repo\nPaired API PR: TierOne-Studio/api-velocity#NNN`

Workflow steps:
1. Detect contract-change keywords in diff: `grep -E '@(Get|Post|Put|Patch|Delete)\(' src/**/*.controller.ts` or equivalent for SPA
2. If detected, parse PR body for `Paired (API|SPA) PR: \S+/\S+#\d+`
3. If contract change but no pairing → warn (LOW); if missing AND PR description doesn't include `### Standalone change` opt-out → fail (HIGH)
4. If pairing present → use `gh api` to fetch the paired PR's status; warn if paired PR not open/draft

**Escape hatch:** PR description includes `### Standalone change\nRationale: <one-line>` to bypass the gate. Forces explicit acknowledgement.

**Critical files:**
- `spa-velocity/.github/workflows/bilateral-pr.yml` (new)
- `api-velocity/.github/workflows/bilateral-pr.yml` (new, mirror)
- `.ruler/skills/cross-repo-workspace/SKILL.md` (both repos) — extend with the new PR-template convention as Rule 8 + ENFORCE-5 directive

**Estimated effort:** 2–3 hours per repo, mostly diff-heuristic tuning. False positives expected; iterate on the regex set.

---

## Phase C — Architectural decision (Schema-drift via OpenAPI codegen)

### C1: ADR for the schema-contract source-of-truth

**Decision:** api-velocity generates OpenAPI from NestJS via `@nestjs/swagger`. spa-velocity codegens TypeScript types (or Zod schemas) from the OpenAPI artifact and validates API responses against them.

**Write before code:**
- `api-velocity/docs/decisions/ADR-010-openapi-as-contract-source.md` (next available number)
- `spa-velocity/docs/decisions/ADR-011-openapi-codegen-for-api-types.md` (next available number)
- Both ADRs cross-reference each other via the bilateral-ADR convention from `cross-repo-workspace` Rule 4

### C2: api-velocity emits OpenAPI

- Add `@nestjs/swagger` (already approved via asks-first dep gate documented in the ADR)
- Decorate controllers with `@ApiOkResponse({ type: VelocityResponseDto })` etc.
- Build step emits `dist/openapi.json` (or schema.json)
- Publish artifact: either S3 (alongside the bundle) or as a GitHub Release asset on each merge to `master`

**Critical files:**
- `api-velocity/src/main.ts` (add `SwaggerModule.setup`)
- `api-velocity/src/modules/**/*.controller.ts` (add `@ApiResponse` decorators incrementally)
- `api-velocity/.github/workflows/deploy-ecr.yml` (add openapi.json artifact upload)

### C3: spa-velocity codegens from openapi.json

- Add `openapi-typescript` (or `orval` for Zod-emitter) as devDep (asks-first gate)
- `npm run codegen:api` script: fetch latest `openapi.json` → emit `src/shared/api/types.generated.ts`
- Commit generated file (don't gitignore; review-visible)
- Drift check workflow: `npm run codegen:api && git diff --exit-code` — if anything changed, the PR forgot to regenerate types

**Critical files:**
- `spa-velocity/package.json` (new script)
- `spa-velocity/src/shared/api/openapi.json` (fetched artifact, committed)
- `spa-velocity/src/shared/api/types.generated.ts` (codegen output, committed)
- `spa-velocity/.github/workflows/cross-repo-smoke.yml` (extend with codegen drift check)

### C4: runtime validation (optional, depends on appetite)

Either:
- Treat the generated TS types as a static contract (Zod-free; trust the compiler) — cheaper
- OR generate Zod schemas too (via `orval` or `openapi-zod-client`), validate every API response at runtime — heavier but catches mid-prod drift

**Recommendation:** static types first (Phase C close enough). Runtime Zod validation as a Phase D follow-up if production data shows the contract drifts at runtime.

**Estimated effort:** 1–2 days end-to-end for Phase C (including ADRs, decorator pass, codegen script wiring, smoke test).

---

## Phase ordering and dependencies

```
Phase A (gates A1 + A2)            ← Independent. Either repo, both shippable in a day.
        │
        ▼
Phase B (gate B1)                  ← Depends on A2 being in place (Phase B needs cross-repo
                                     PR awareness; A2 establishes the cross-repo CI surface).
        │
        ▼
Phase C (ADRs + C1..C4)            ← Independent of A/B but biggest effort.
                                     Could ship in parallel with B if there's capacity.
```

**Recommended order:** A → B → C, one phase per PR pair (one PR per repo per phase). Each phase ships with tests proving the gate fires on a deliberately-broken example.

---

## Verification (how to confirm each gate works)

| Gate | Verify by |
|---|---|
| A1 Migration-applied | Create a deliberate PR adding `src/modules/velocity/entities/velocity.entity.ts` with no migration → gate fails. Add `001-velocity.sql` → gate passes. |
| A2 Full-stack smoke | On a PR that breaks integration (e.g., spa-velocity calls `/api/velocity` but api-velocity has no such endpoint), the workflow runs the e2e smoke and fails on Playwright assertion. On a clean PR, it goes green in ~3–5 min. |
| B1 Bilateral check | Open a contract-change PR in api-velocity with no pairing → fails. Add the `Paired SPA PR:` line → passes. Open a contract-change PR with an OPEN paired PR → passes. Close the paired PR → workflow surfaces a warning on next push. |
| C1–C4 Schema-drift | Change a DTO in api-velocity without updating the SPA codegen → spa-velocity's `npm run codegen:api && git diff --exit-code` fails. After running codegen, types update, drift check passes, e2e (A2) catches any consuming-code mismatch. |

---

## Cross-repo skill updates (paired with each phase)

Phase A: no skill changes. (Gates run in CI; skill body unchanged.)

Phase B: add Rule 8 + ENFORCE-5 to `cross-repo-workspace/SKILL.md` (both repos) — codify the PR-pairing convention.

Phase C: write the bilateral ADRs. Update `cross-repo-workspace/SKILL.md` Rule 4 to cite ADR-010 (api) and ADR-011 (spa) as the OpenAPI-contract example.

---

## Risks and open questions to surface during execution

1. **A2 needs a GitHub PAT/App token** with read access to api-velocity from spa-velocity's workflow. Org-level setup; not a code change.
2. **A2 cost:** running e2e on every PR adds CI minutes. Smoke (single login spec) is ~3 min; the full suite would be ~15–30 min. Start with smoke.
3. **B1 false positives:** the contract-change detector is heuristic. Expect ~10% false-positive rate initially; tune the regex set over the first month.
4. **C1's @nestjs/swagger decorator coverage:** retrofitting every controller is grunt work. Plan for incremental adoption (new endpoints first, backfill older ones over 2–3 sprints).
5. **C1's openapi.json freshness:** if api-velocity master moves while a spa-velocity PR is open, the codegen output goes stale. Mitigation: A2's smoke test catches the resulting break.

---

## Critical files referenced (paths to touch in execution)

**Existing (read/extend, don't replace):**
- `spa-velocity/playwright.config.ts` — webServer config for cross-repo boot
- `spa-velocity/e2e/global-setup.ts` — DB seeding for e2e
- `spa-velocity/e2e/auth/auth.spec.ts` — smoke target
- `api-velocity/src/shared/infrastructure/database/migrations/` — migration file location
- `api-velocity/src/main.ts` — entry; add Swagger setup in C2
- `.ruler/skills/cross-repo-workspace/SKILL.md` (both repos) — extend with Rule 8 + ENFORCE-5 in Phase B

**New (per phase):**
- Phase A: `api-velocity/.github/workflows/migration-gate.yml`, `spa-velocity/.github/workflows/cross-repo-smoke.yml`
- Phase B: `{spa,api}-velocity/.github/workflows/bilateral-pr.yml`
- Phase C: `api-velocity/docs/decisions/ADR-010-*.md`, `spa-velocity/docs/decisions/ADR-011-*.md`, `spa-velocity/src/shared/api/{openapi.json,types.generated.ts}`, codegen script

---

## Phase exit criteria

Each phase ships when:
- The gate fires on a deliberately-broken example PR
- The gate stays green on a clean PR
- Acceptance test suite (`bash .ruler/tests/run-acceptance.sh` in each repo) still 100% pass
- A short note in `cross-repo-workspace/SKILL.md` references the new CI gate (so future cross-repo work knows the guardrail exists)
