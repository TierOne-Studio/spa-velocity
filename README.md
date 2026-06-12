# Velocity

Velocity is a multi-tenant enterprise knowledge assistant. It gives teams one
permission-aware workspace for:

- asking grounded questions across documents, connected knowledge sources, and
  live PostgreSQL databases;
- organizing data sources and conversations into projects;
- managing organization-owned Airweave collections, SQL connections, and
  Velocity-managed vector databases;
- administering users, organizations, sessions, roles, permissions, approvals,
  and impersonation.

This repository contains the React frontend. The companion NestJS backend is
[`api-velocity`](https://github.com/TierOne-Studio/api-velocity).

## Why Velocity

Most organizations split operational knowledge across documents, SaaS tools,
and databases. Velocity creates a governed conversational layer over those
systems without giving every user direct access to the underlying credentials
or infrastructure.

For business and technology leaders, the result is:

- faster access to operational answers;
- one access-control model across chat, data sources, and administration;
- organization-scoped access controls for multi-tenant deployments;
- source-grounded responses and visible SQL execution details;
- an extensible project and provider model rather than a single-purpose
  chatbot.

See [Product overview](docs/product-overview.md) for the business value,
personas, capabilities, and current limitations.

## Documentation

| Document | Audience | Purpose |
|---|---|---|
| [Documentation index](docs/README.md) | All audiences | Entry point for the complete frontend and workspace documentation set |
| [Product overview](docs/product-overview.md) | Executives, product leaders, developers | What Velocity does, why it matters, and how the capabilities fit together |
| [User guide](docs/user-guide.md) | End users and administrators | How to configure organizations, sources, projects, and grounded chat |
| [Executive and architecture review](docs/executive-architecture-review.md) | Executives, buyers, architects, security and operations leaders | Due-diligence questions, objections, readiness gaps, and go-live gates |
| [Documentation verification](docs/documentation-verification.md) | Reviewers and maintainers | Audited source baselines, evidence matrix, drift disclosure, checks, and confidence |
| [Frontend architecture](docs/frontend-architecture.md) | Frontend developers | React architecture, routes, state, auth, RBAC, UI composition, and tests |
| [Workspace architecture](docs/workspace-architecture.md) | Technical leaders and full-stack developers | How the SPA and API collaborate, including the end-to-end data and agent flow |
| [Architecture decisions](docs/decisions/README.md) | Maintainers | Accepted frontend engineering decisions |
| [Backend architecture](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/architecture.md) | Backend developers | NestJS modules, layers, persistence, tenancy, and security |
| [Agentic architecture](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/agentic-architecture.md) | AI/backend developers | Router, RAG, SQL sub-agent, streaming, ingestion, and failure behavior |
| [API reference](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/api-reference.md) | API consumers | REST endpoint families, permissions, and response conventions |
| [Operations](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/deployment-and-operations.md) | Developers and operators | Environment, infrastructure, startup, verification, and production concerns |

## Core User Journey

1. An administrator creates or selects an organization and assigns members.
2. A manager connects organization data through Airweave, a PostgreSQL
   connection, or a Velocity vector database.
3. The manager creates a project and attaches one or more ready data sources.
4. A user creates a project-scoped conversation and asks a question.
5. The backend routes the question to document retrieval, database analysis, or
   the general tool-calling agent.
6. The SPA streams progress, the answer, citations, and SQL execution metadata.

## Quick Start

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- the sibling [`api-velocity`](https://github.com/TierOne-Studio/api-velocity)
  repository
- the backend infrastructure required by the features you intend to use

Expected workspace layout:

```text
Repositories/Github/
├── api-velocity/
└── spa-velocity/
```

### Start the backend

Follow the backend
[Quick Start](https://github.com/TierOne-Studio/api-velocity#quick-start), then verify it is
listening on `http://localhost:3000`.

### Start the frontend

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:5173>.

Frontend configuration:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes | Base URL for Better Auth, REST, and SSE requests |
| `VITE_AIRWEAVE_CONNECT_URL` | No | Airweave Connect SDK endpoint; defaults to the SDK service when unset |

Do not put secrets in `VITE_*` variables. Vite embeds them in the browser
bundle.

## Common Commands

```bash
npm run dev                 # Vite development server
npm run build               # TypeScript check and production build
npm run lint                # ESLint
npm test                    # Vitest with coverage
npm run test:watch          # Vitest watch mode
npm run test:e2e:smoke      # Critical login flow
npm run test:e2e:full       # Full Playwright suite
```

Playwright starts the frontend and backend test servers defined in
`playwright.config.ts`. The full end-to-end suite requires a test PostgreSQL
database and the backend repository.

## Technology

- React 19 and TypeScript
- Vite 7
- React Router 7
- TanStack Query 5 and Zustand 5
- React Hook Form and Zod
- Tailwind CSS 4, Radix UI, and CVA
- Better Auth browser client
- Vitest, Testing Library, and Playwright
- Server-Sent Events for streamed chat responses

## Repository Shape

```text
src/
├── app/                 # Bootstrap, providers, routes, and global styles
├── features/            # Auth, Admin, Chat, Projects, Airweave, SQL, Vector DB
├── shared/              # UI primitives, contexts, hooks, API/auth utilities
└── test/                # Vitest setup
e2e/                     # Playwright suites grouped by product area
docs/                    # Product, user, architecture, and decision docs
```

Start with:

- `src/app/views/AppRoutes.tsx` for the route and provider composition;
- `src/shared/components/ui/app-sidebar.tsx` for the permission-driven product
  navigation;
- `src/features/Chat/views/ChatPage.tsx` for the primary user experience;
- `src/features/Projects/` for project and data-source configuration.

## AI-Assisted Development

The repository uses Ruler as the source of truth for coding-agent instructions.
Canonical guidance is under `.ruler/`; generated assistant-specific files such
as `AGENTS.md` and `CLAUDE.md` should not be edited directly.

```bash
npx ruler apply
npm run test:claude
```

## Status and Boundaries

The checked-out branch implements Airweave, PostgreSQL, and Velocity-managed
vector database sources. The `external` project source type is reserved in the
contract but is not implemented. Deployment infrastructure is managed outside
this frontend repository.
