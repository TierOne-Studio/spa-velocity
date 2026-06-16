# Velocity Product Overview

## Executive Summary

Velocity is a governed enterprise knowledge assistant for organizations whose
answers are distributed across documents, connected services, and relational
databases.

Instead of exposing those systems independently, Velocity lets an organization
assemble approved data sources into projects. Users then ask questions inside a
project-scoped conversation. The platform selects an appropriate retrieval or
analysis path, streams the answer, and preserves source or SQL execution
metadata.

Velocity is not only a chat interface. It combines:

- a multi-source knowledge and analytics workspace;
- a multi-tenant identity and authorization layer;
- administration for users, organizations, sessions, roles, and approvals;
- source lifecycle management;
- an extensible agent and provider architecture.

The current implementation is best assessed as a strong platform foundation
for a controlled enterprise pilot. It should not be described as generally
production-ready for regulated or mission-critical workloads until the
organization closes the readiness gates in the
[Executive and architecture review](executive-architecture-review.md).

## The Problem It Solves

Operational questions often require a person to:

1. know which system contains the answer;
2. have access to that system;
3. understand its schema or navigation;
4. combine evidence from multiple locations;
5. explain the result to someone else.

Velocity compresses that workflow into a governed conversation. Source
configuration remains an administrator or manager responsibility, while
authorized members consume the resulting capability through chat.

## User Value

### Faster decisions

Users can ask business questions in natural language instead of manually
searching repositories, documents, or database tables.

### Governed access

The same organization and permission context controls navigation, API access,
project membership, source management, and chat execution. A visible page is
not treated as authorization; the backend rechecks every protected operation.

### Grounded answers

Document-oriented answers are built from retrieved source text. Database
answers are built from executed read-only SQL, with execution details available
to the UI. When evidence is insufficient, the agent is instructed to say so
rather than invent organization-specific facts.

### Reusable workspaces

Projects group a business domain, its approved data sources, and its
conversations. A team can create separate projects for finance, customer
support, product, engineering, or any other bounded context.

### Flexible knowledge strategy

An organization can use:

- Airweave to connect and index supported external systems;
- SQL connections for live analytical questions against PostgreSQL;
- Velocity vector databases for uploaded documents stored in S3 and indexed in
  Qdrant;
- more than one source in the same project.

## Primary Personas

| Persona | Goals in Velocity |
|---|---|
| Executive or business leader | Ask grounded questions and get concise, traceable answers without learning each source system |
| Analyst or operator | Explore live organizational data through natural language and inspect the SQL used |
| Organization member | Use approved projects and chat without managing credentials |
| Organization manager | Configure sources, projects, users, sessions, and day-to-day access |
| Organization admin | Perform consequential operations such as source or vector database deletion |
| Platform superadmin | Operate across organizations, inspect system-wide state, and impersonate users for support |
| Developer or architect | Extend source providers, UI features, API modules, or agent capabilities |

## Best-Fit Use Cases

Velocity is a good fit when:

- a team has recurring questions across documents and PostgreSQL data;
- source owners can define approved projects, tables, and collections;
- users benefit from natural-language access but still need visible evidence;
- the organization can begin with a bounded pilot and measure answer quality;
- administrators are prepared to own identity, permissions, source lifecycle,
  and operational controls.

Velocity is not yet a complete fit when:

- the workload requires a certified compliance posture out of the box;
- answers must be treated as autonomous decisions without human review;
- hard real-time latency or offline operation is required;
- data deletion must already be proven across PostgreSQL, S3, Qdrant, and every
  upstream connector;
- the buyer expects packaged infrastructure, managed operations, contractual
  availability, or disaster-recovery guarantees from these repositories alone.

## Product Capabilities

### Identity and onboarding

- email/password signup and login;
- email verification and password reset;
- organization invitations;
- approval, rejection, and pending-account states;
- session management and revocation;
- controlled user impersonation.

### Multi-tenant administration

- organizations and memberships;
- active-organization switching;
- platform and organization role resolution;
- custom roles and permission assignment;
- superadmin cross-organization views;
- permission-filtered navigation and route guards.

### Projects

A project is the unit that binds conversations to approved context. It contains:

- an organization owner;
- a name and description;
- one or more data-source attachments;
- project-scoped chat conversations.

Only sources in a `ready` state participate in chat execution.

### Airweave collections

Velocity can create and manage Airweave collections and source connections.
Collection ownership is associated with a Velocity organization, and
collection lists are filtered to that organization's allowlist. Direct-read
enforcement is controlled by `AIRWEAVE_READ_LOCKDOWN_ENFORCE`; production
deployments default to observe-only unless the operator explicitly enables it
after reviewing `airweave.read_would_403` events.

This option is best when the organization wants Airweave's catalog and
connectors to index external systems.

### SQL connections

Managers can configure PostgreSQL connections, test them, restrict visible
tables, and attach them to projects. Passwords are encrypted at rest by the API.

During chat, a dedicated SQL sub-agent:

- inspects the permitted schema;
- generates one read-only statement;
- executes it with time, row, byte, and pool limits;
- returns structured results for answer synthesis;
- records the SQL and execution metadata without persisting result rows in the
  conversation metadata.

### Velocity vector databases

Organizations can create a vector database, upload supported files, and attach
the ready database to a project.

The backend:

1. stores the original file in S3;
2. queues ingestion in PostgreSQL through pg-boss;
3. extracts text from PDF, DOCX, or UTF-8 text formats;
4. chunks and embeds the text with OpenAI;
5. stores vectors in Qdrant;
6. retrieves relevant chunks during chat.

Supported upload types are PDF, DOCX, TXT, Markdown, CSV, and JSON, up to 50 MB
per file.

### Conversational experience

The chat experience includes:

- private conversation history per user and organization;
- required project selection;
- streamed retrieval/thinking status and answer content;
- source citations;
- SQL execution cards;
- project source inspection;
- conversation grouping by project;
- abort propagation when the browser disconnects.

## Agentic Behavior

Velocity supports three execution lanes:

1. **Direct RAG lane**: retrieve from Airweave and/or Velocity vector databases,
   then synthesize a grounded answer.
2. **Direct SQL lane**: invoke the database tool and its SQL sub-agent, then
   synthesize from the executed result.
3. **General agent lane**: allow the outer agent to choose and combine available
   retrieval and database tools for ambiguous or multi-source questions.

An optional classifier routes confident questions directly to RAG or SQL to
save an outer tool-selection model call. Low-confidence or malformed classifier
results fall back to the general agent lane.

See the backend [Agentic architecture](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/agentic-architecture.md)
for the detailed implementation and sequence diagrams.

## Business Benefits

- **Reduced time to answer**: fewer handoffs between domain experts and data
  owners.
- **Lower training burden**: users interact through questions instead of
  learning every source UI or database schema.
- **Stronger governance**: credentials and integration configuration remain
  server-side and permission-gated.
- **Better traceability**: responses retain citations or SQL execution
  metadata. This is useful evidence, but it is not a compliance-grade audit
  trail.
- **Incremental adoption**: teams can begin with one project and one source,
  then add source types and organizations.
- **Extensibility**: providers and ports isolate source-specific behavior from
  the chat orchestration layer.

## Current Boundaries

- The backend currently supports PostgreSQL for live database questions.
- The `external` project source kind exists in the type contract but is not
  implemented.
- The current backend boots the vector module unconditionally, so S3, Qdrant,
  OpenAI, and PostgreSQL/pg-boss configuration are startup requirements even
  for deployments that do not yet expose vector database screens.
- Airweave features depend on an Airweave account and API key.
- Airweave direct-read ownership enforcement defaults to observe-only in
  production. Set `AIRWEAVE_READ_LOCKDOWN_ENFORCE=true` after the rollout
  observation gate before treating direct collection reads as tenant-isolated.
- The direct router is opt-in; the general agent is the default path.
- The frontend repository does not include production deployment
  infrastructure.
- SQL safety is defense in depth, but operators must still provision a
  least-privilege, SELECT-only database role and appropriate network controls.
- The SQL host guard rejects private, loopback, link-local, and metadata
  addresses. Connecting a typical private enterprise database requires an
  approved networking or connector architecture rather than exposing the
  database publicly.
- Tenant isolation is implemented in application guards, services, and
  repository predicates. PostgreSQL row-level security is not part of the
  current defense model.
- The browser stores bearer and impersonation tokens in local storage. A
  production hosting layer must treat XSS prevention and Content Security Policy
  as critical controls.
- Data retention, complete cross-provider deletion, audit logging, SLOs,
  backup/restore objectives, and disaster recovery require deployment-specific
  decisions.
- Deleting an uploaded vector file removes its ingestion record and attempts to
  remove the S3 object, but its Qdrant points are not currently purged. Do not
  treat that action as immediate data erasure.

## Product Success Measures

Useful production measures include:

- question-to-answer latency by execution lane;
- answer completion and user retry rate;
- retrieved source count and empty-retrieval rate;
- SQL query success, timeout, and read-only rejection rate;
- active projects, connected sources, and recurring users;
- percentage of answers with citations or SQL evidence;
- token usage and tool-call count by route;
- source ingestion success and retry rate.

These are proposed measures, not a claim that the current repositories provide
a complete analytics, cost-accounting, or customer-domain quality-evaluation
system. A synthetic 100-question RAG run dated June 11, 2026 provides an
engineering baseline: 90% strict answer accuracy, 96% including partial
answers, 88% document hit@1, 95% hit@3, 6.3-second average latency, and
8.0-second p95 latency. Because the corpus is fictional and the run used one
long conversation with manual review, a pilot must still establish
domain-specific baselines and target thresholds before business benefits are
presented as validated outcomes.
