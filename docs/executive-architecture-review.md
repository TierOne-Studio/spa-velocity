# Executive and Architecture Review

## Review Position

Velocity has a credible product and architecture foundation:

- a clear project boundary around users, conversations, and approved sources;
- multi-tenant identity, organization membership, roles, and permissions;
- multiple knowledge paths through Airweave, uploaded documents, and
  PostgreSQL;
- explicit agent routing with bounded SQL execution;
- recoverable asynchronous document ingestion;
- modular frontend and backend code with automated tests.

The current implementation is suitable for a controlled pilot with bounded
data, named owners, and human review. It is not automatically ready for
regulated, mission-critical, or contractual-SLA production use. That conclusion
does not mean the architecture is unsuitable. It means several non-functional
requirements and operating controls remain decisions rather than implemented
platform guarantees.

## Questions a CTO or Buyer Should Ask

### 1. What measurable business outcome does Velocity improve?

**Current answer:** Velocity is designed to reduce time spent locating systems,
requesting access, translating schemas, and assembling evidence.

**Objection:** The repository contains proposed success measures, not validated
ROI, adoption, or quality results.

**Required decision:** Select two or three pilot workflows, capture their
current time/cost/error baseline, and define target improvements before making
quantified benefit claims.

### 2. Which use cases are safe enough for the first release?

**Current answer:** Bounded internal knowledge search, assisted analytics over
SELECT-only PostgreSQL data, and project-scoped document Q&A are the strongest
fits.

**Objection:** A general-purpose assistant can be applied to decisions with very
different risk profiles.

**Required decision:** Classify allowed use cases. Exclude autonomous legal,
medical, financial, employment, security, or production-control decisions
unless separate domain controls and human approval exist.

### 3. How is answer quality proven?

**Current answer:** The agent is instructed to use project sources, expose
citations or SQL execution metadata, acknowledge insufficient evidence, and
avoid treating retrieved instructions as authoritative. A synthetic
100-question end-to-end RAG benchmark dated June 11, 2026 reported 90% strict
answer accuracy, 96% including partial answers, 88% document hit@1, 95% hit@3,
6.3-second average latency, and 8.0-second p95 latency.

**Objection:** The benchmark is a useful engineering baseline, not a production
quality guarantee. It uses six documents for a fictional company, manual review
of flagged answers, one long conversation thread, and no customer-specific
refusal, injection, SQL-routing, cost, or release-gate criteria. Citations prove
provenance, not correctness.

**Required decision:** Keep the synthetic suite as a regression baseline and
create a versioned golden question set per pilot domain with expected evidence,
acceptable answers, refusal cases, route choice, latency, and cost thresholds.
Run both before model, prompt, retrieval, or schema changes.

### 4. Can one tenant access another tenant's data?

**Current answer:** Organization context is checked by API guards, application
services, and repository predicates. Superadmin cross-organization access is
explicit. Airweave collection lists are organization-allowlist filtered.

**Objection:** Isolation is primarily application-enforced. PostgreSQL row-level
security is not an independent last line of defense, and a missing
`organization_id` predicate can become a data-leak defect. Airweave direct-read
ownership enforcement is also rollout-flagged and defaults to observe-only in
production, where it logs `airweave.read_would_403` instead of rejecting until
explicitly enabled.

**Required decision:** Confirm whether application-level isolation satisfies
the threat model. For higher-assurance deployments, evaluate PostgreSQL RLS,
separate schemas/databases, automated cross-tenant tests, and durable access
auditing. Require a clean Airweave observation window and set
`AIRWEAVE_READ_LOCKDOWN_ENFORCE=true` before tenant-isolation sign-off.

### 5. Where does customer data go?

**Current answer:** Depending on enabled features, data can pass through
PostgreSQL, S3, Qdrant, OpenAI, Airweave, and Resend. Uploaded source files are
stored in S3; extracted chunks and embeddings are stored in Qdrant. Retrieved
text and database results used for answer synthesis can be sent to OpenAI.

**Objection:** Data-processing terms, model-training settings, retention,
residency, regional routing, subprocessors, and sensitive-data classifications
are deployment and vendor-account decisions.

**Required decision:** Produce a data-flow inventory and approve each provider
for the target customer and jurisdiction before ingesting sensitive data.

### 6. Is there a complete audit trail?

**Current answer:** Operational logs and conversation metadata retain useful
execution evidence such as citations, SQL text, route, duration, and selected
identifiers.

**Objection:** There is no dedicated immutable audit subsystem for role changes,
impersonation, cross-organization access, source administration, exports, or
destructive operations. Operational logs are not a compliance audit trail.

**Required decision:** Define auditable events, retention, integrity,
administrator access, export, and alerting requirements. Implement a durable
audit destination before claiming audit compliance.

### 7. Is browser authentication acceptable for the target threat model?

**Current answer:** The SPA stores Better Auth bearer tokens in localStorage and
sends them in the `Authorization` header while omitting cookies.

**Objection:** JavaScript-readable storage increases the impact of XSS or a
compromised browser dependency. Impersonation can place both original and
effective tokens in browser storage.

**Required decision:** Treat CSP, dependency governance, security headers,
token expiry/revocation, and XSS testing as go-live controls. Revisit the token
delivery model if the target compliance profile rejects localStorage tokens.

### 8. Can the SQL agent modify or overload a customer database?

**Current answer:** The application validates statements, uses a read-only
transaction, limits time/rows/bytes/pools, restricts tables, and blocks unsafe
network destinations.

**Objection:** Application checks are not a substitute for database grants.
SELECT statements can still be expensive, and an incorrectly provisioned role
can expose sensitive tables.

**Required decision:** Require a dedicated SELECT-only database role, explicit
table grants, TLS, network egress policy, query monitoring, and a customer-owned
revocation procedure for every connection.

### 9. How are private enterprise databases reached?

**Current answer:** The API dials approved PostgreSQL hosts directly and applies
an SSRF guard that rejects private, loopback, link-local, metadata, and other
reserved destinations.

**Objection:** Most enterprise databases are intentionally private. Making them
publicly reachable to satisfy the current connection model would weaken the
security posture.

**Required decision:** Choose a supported private-connectivity pattern such as
VPC peering, private service networking, an outbound customer connector, or an
approved tunnel. Do not solve this by broadly disabling SSRF protection or
exposing a database to the public internet.

### 10. How does the system resist prompt injection and data exfiltration?

**Current answer:** Retrieved text is treated as data, the prompt tells the
model to ignore embedded instructions, tools are built only from ready project
sources, and SQL/database boundaries are enforced outside the model.

**Objection:** Prompt instructions are a partial mitigation, not a deterministic
content-security boundary. There is no separate content policy engine,
classification gateway, or comprehensive adversarial evaluation suite.

**Required decision:** Define prohibited outputs and sensitive-data classes,
add adversarial retrieval tests, and decide whether model/provider moderation
or a deterministic output policy is required.

### 11. What happens under load or during a partial outage?

**Current answer:** REST/SSE application paths can run on multiple API
instances, pg-boss coordinates persistent ingestion jobs, and provider failures
are surfaced or partially degraded.

**Objection:** Chat rate limits are process-local, every API replica starts
ingestion workers, SSE consumes a connection for the duration of a response,
and downstream provider quotas can become the real capacity limit.

**Required decision:** Load-test the expected concurrency and document replica,
worker, connection-pool, timeout, queue-depth, provider-quota, and load-shedding
settings.

### 12. What availability and recovery are promised?

**Current answer:** The backend has a process health endpoint, persistent data,
recoverable ingestion jobs, and a container image.

**Objection:** There is no defined SLO, dependency-aware readiness check, RTO,
RPO, tested backup/restore procedure, multi-region design, or documented
disaster-recovery exercise.

**Required decision:** Set service objectives, define dependency failure
behavior, automate backups, and execute restoration and failover tests.

### 13. Is deletion complete and provable?

**Current answer:** Application rows use scoped deletes and cascades where
appropriate, and individual uploaded blobs are deleted from S3 on the normal
path.

**Objection:** S3 orphans can remain after partial failures. Deleting an
uploaded file does not currently remove its Qdrant points, vector database
collection cleanup is deferred, soft-deleted vector records await a janitor,
and Airweave ownership-write failures can create upstream orphans.

**Required decision:** Define retention and deletion SLAs, implement
reconciliation and purge jobs, and produce evidence that deletion reaches every
provider.

### 14. Can cost be predicted and controlled?

**Current answer:** The system has agent iteration, retrieval-size, row, byte,
timeout, and rate-limit controls. Some outer-agent token metadata is logged.

**Objection:** SQL sub-agent usage is not fully counted, there are no per-tenant
budgets or quotas, and there is no complete cost attribution across OpenAI,
Airweave, S3, Qdrant, PostgreSQL, and egress.

**Required decision:** Establish per-route and per-tenant usage accounting,
budgets, alerts, and hard/soft quota behavior before broad rollout.

### 15. How portable is the architecture?

**Current answer:** Ports, providers, and registries isolate much of the
Airweave, Qdrant, S3, OpenAI, and database-specific code.

**Objection:** The running application currently requires PostgreSQL, S3,
Qdrant, and OpenAI configuration, and the agent behavior is coupled to
LangChain/OpenAI semantics.

**Required decision:** Decide whether provider portability is a real commercial
requirement. If it is, prove a second adapter for the required boundary rather
than claiming portability from interfaces alone.

### 16. Who operates and supports the platform?

**Current answer:** The repositories provide application code, runbooks, tests,
and a backend Dockerfile.

**Objection:** There is no complete infrastructure-as-code, environment
promotion model, on-call policy, incident ownership matrix, support SLA, or
formal release compatibility contract between the frontend and backend.

**Required decision:** Name service, security, data, AI-quality, and customer
support owners. Define deployment, rollback, incident, and cross-repository
release procedures.

## Ranked Objections

### Critical before regulated or mission-critical production

1. Approve the data-processing, privacy, retention, residency, and subprocessor
   model.
2. Define and implement complete deletion and reconciliation across PostgreSQL,
   S3, Qdrant, Airweave, and logs.
3. Establish a durable security audit trail for privileged and destructive
   operations.
4. Define SLO, RTO, RPO, backup, restore, and dependency-readiness behavior.
5. Approve the tenant-isolation and browser-token threat models.

### High before broad enterprise rollout

1. Promote the synthetic RAG benchmark into a repeatable regression signal and
   add domain-specific quality, injection, refusal, SQL-routing, and cost
   evaluations.
2. Add request correlation, structured metrics, tracing, alerting, and complete
   LLM/tool cost accounting.
3. Serialize startup migrations and test multi-replica deployment behavior.
4. Add shared/distributed rate limiting or explicitly accept per-instance
   enforcement.
5. Define a secure private-database connectivity pattern.
6. Load-test SSE, database pools, ingestion workers, and provider quotas.
7. Remove or redact verification URLs and PII from email logs, and make email
   delivery configuration fail appropriately for environments where
   verification and invitations are required.

### Medium for product maturity

1. Formalize API versioning and frontend/backend compatibility.
2. Package infrastructure and environment promotion as code.
3. Add per-tenant budgets, quotas, and usage reporting.
4. Prove alternate providers only where commercial requirements justify them.
5. Add product analytics and feedback capture for measured adoption.
6. Align the vector document-delete control with `vector-db:delete` so managers
   are not offered an operation the API correctly rejects.

## Recommended Pilot

1. Select one organization, one bounded business workflow, and one or two
   approved sources.
2. Exclude regulated and highly sensitive data until the data-processing review
   is complete.
3. Define 25-50 representative questions, expected evidence, refusal cases, and
   maximum latency/cost, using the synthetic benchmark methodology as a
   starting harness rather than as customer acceptance evidence.
4. Provision least-privilege source access and name a source owner.
5. Require users to verify evidence before acting on consequential answers.
6. Review incorrect, incomplete, and expensive answers weekly.
7. Compare measured results with the pre-pilot workflow baseline.
8. Expand only after quality, security, reliability, and cost thresholds are
   met.

## Go-Live Gate

A production owner should be able to answer **yes** to each item:

- [ ] Target users, use cases, prohibited use cases, and human-review rules are
  approved.
- [ ] Data classification, residency, retention, deletion, and provider terms
  are approved.
- [ ] Tenant-isolation and browser-token threat models are accepted.
- [ ] Airweave direct-read lockdown is enabled after a clean observation window.
- [ ] Privileged actions and cross-organization access have durable audit
  records.
- [ ] SQL connections use verified SELECT-only roles and explicit table grants.
- [ ] CSP and required browser security headers are deployed and tested.
- [ ] A representative AI evaluation suite meets quality, refusal, latency, and
  cost thresholds.
- [ ] SLO, RTO, RPO, backup, restore, and incident procedures are defined and
  exercised.
- [ ] Dependency-aware readiness, metrics, alerts, request correlation, and
  tracing meet operational needs.
- [ ] Startup migrations and ingestion workers are safe under the intended
  replica count.
- [ ] S3, Qdrant, Airweave, database, and log deletion paths are reconciled and
  provable.
- [ ] Per-tenant usage, provider spend, and abuse controls have owners and
  thresholds.
- [ ] Frontend/backend compatibility, deployment, rollback, and support
  ownership are documented.

## Decision Ownership

| Decision area | Accountable owner |
|---|---|
| Business outcomes, allowed use cases, and rollout | Executive sponsor and product owner |
| Source approval, table grants, and data quality | Data owner for each project |
| Identity, tenant isolation, CSP, audit, and incident response | Security owner |
| SLO, capacity, backups, restore, deployment, and on-call | Platform/service owner |
| Models, prompts, evaluations, cost thresholds, and unsafe-answer review | AI quality owner |
| Retention, residency, legal hold, and erasure | Privacy/compliance owner |
| Customer onboarding, support, and escalation | Customer operations owner |

One person may hold more than one role in a small team, but none of these
decisions should be implicitly owned by the codebase.

## Executive Conclusion

Velocity's differentiator is not merely natural-language chat. It is the
combination of project-scoped context, governed source access, multi-source
agent routing, and visible evidence. That is a credible foundation.

The primary risk is not the modular architecture. It is presenting a capable
application foundation as a complete enterprise operating product before
quality evidence, data governance, observability, deletion, recovery, and
support controls are in place. A disciplined pilot is the correct next
commercial and technical step.
