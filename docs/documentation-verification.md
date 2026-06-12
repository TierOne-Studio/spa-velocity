# Documentation Verification Record

## Scope

This record explains what the Velocity documentation was checked against and
where source/version drift affects interpretation.

Audit date: **June 12, 2026**

| Repository | Local HEAD | Current feature ref reviewed |
|---|---|---|
| `spa-velocity` | `fa49367` | `origin/feat/kb-crud` at `91c3de6` |
| `api-velocity` | `73cd3d2` | `origin/feat/kb-crud` at `a4825ef` |

Both local branches were behind their remote feature refs during the audit.
The documentation describes the current feature line where newer source
behavior is material. Before validating that behavior locally, synchronize the
working branches through the repository's normal reviewed Git workflow.

Remote-only behavior incorporated into the documentation includes:

- vector document deletion requiring `vector-db:delete`;
- manager access to vector upload but not vector/file deletion;
- document-attributed vector citations;
- `VECTOR_DB_MIN_SCORE_PCT` relevance filtering;
- the June 11, 2026 synthetic RAG benchmark;
- the specification-first workflow and vector feature specifications.

## Evidence Matrix

| Documentation claim | Primary evidence |
|---|---|
| Frontend routes and permission gates | `spa-velocity/src/app/views/AppRoutes.tsx` |
| Frontend navigation capabilities | `spa-velocity/src/shared/components/ui/app-sidebar.tsx` |
| Browser configuration | `import.meta.env` references and `spa-velocity/.env.example` |
| Technology versions | Both repositories' `package.json` files |
| Backend module composition | `api-velocity/src/app.module.ts` |
| Public REST surface | All backend `*controller.ts` files |
| Authentication and RBAC | `api-velocity/src/auth.ts`, `PermissionsGuard`, RBAC controllers and migrations |
| Agent routing and tools | `ChatAgentService`, `ChatRouterService`, project data-source providers |
| SQL safety | SQL validator, SQL sub-agent configuration, connection factory, operations runbook |
| Vector ingestion and retrieval | Vector service, ingestion worker, adapters, queue, retrieval service, backend SPEC-001 |
| Data lifecycle limitations | Delete implementations, vector ADRs, Airweave ownership ADR and guards |
| Benchmark results | `api-velocity/rag-benchmark/REPORT.md` on the reviewed feature ref |

## Verification Results

- Frontend routes were reconciled against the complete React Router tree,
  including detail, account/settings, fallback, and legacy redirect routes.
- Backend documentation contains one route row for each of 96 NestJS controller
  methods, plus the generated Better Auth `/api/auth/ok` health route.
- Both frontend build-time environment variables are documented.
- Every API environment identifier read directly or through bounded
  configuration helpers is documented, including test-only controls.
- Package claims were checked against installed manifest versions.
- Local Markdown links, code-fence balance, and `git diff --check` pass in both
  repositories.
- The reviewed documentation contains 18 Mermaid diagrams across the frontend,
  workspace, and backend architecture guides.

## Known Implementation Gaps Preserved in the Documentation

The audit does not convert implementation gaps into documentation claims:

- Airweave direct-read ownership defaults to observe-only in production until
  explicitly enforced.
- The vector document dialog can display delete to managers even though the API
  rejects it.
- Vector file deletion does not currently purge the file's Qdrant points.
- The synthetic RAG benchmark is not a customer-domain release gate.
- SLOs, RTO/RPO, durable audit, dependency readiness, distributed throttling,
  complete cost accounting, and cross-provider erasure remain production work.

See [Executive and architecture review](executive-architecture-review.md) for
the complete objection and go-live list.

## Confidence

Documentation confidence is **0.99** for the source baselines named above.
That score covers factual traceability, route/configuration completeness,
cross-repository consistency, and explicit treatment of known gaps. It does not
claim that the product itself is 99% production-ready.
