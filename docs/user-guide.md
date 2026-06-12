# Velocity User Guide

## 1. Sign In and Select an Organization

Open the SPA and sign in with your organization account. Depending on the
account lifecycle, Velocity may require:

- email verification;
- administrator approval;
- invitation acceptance;
- selection of an active organization.

The organization switcher in the sidebar controls the organization context for
most pages. Permissions are recalculated when that context changes.

## 2. Understand the Navigation

Navigation is permission-driven. Users only see areas their effective role can
read.

### Main

- **Chat**: ask questions in project-scoped conversations.
- **Projects**: group conversations and data sources.
- **Collections**: manage Airweave collections and their source connections.
- **SQL Connections**: manage PostgreSQL connections available to projects.
- **Vector Databases**: upload and index documents for grounded chat.

### Admin

- **Dashboard**: organization or platform metrics.
- **Users**: user lifecycle, approval, roles, bans, passwords, and
  impersonation.
- **Sessions**: inspect and revoke sessions.
- **Organizations**: memberships, invitations, and organization settings.
- **Roles & Permissions**: permission assignment and custom role management.

## 3. Configure a Knowledge Source

Choose one or more source types before creating a project.

### Airweave

1. Open **Collections**.
2. Create a collection for the intended organization.
3. Open the collection.
4. Add source connections through the catalog or supported direct
   authentication flow.
5. Wait for Airweave indexing to complete.

Only collections owned by the active organization are visible to regular
organization users.

### PostgreSQL

1. Open **SQL Connections**.
2. Create a connection with host, port, database, username, password, SSL, and
   optional schema settings.
3. Restrict `allowedTables` where practical.
4. Test the connection and wait for `ready` status.

Production connections must use a dedicated SELECT-only role. Do not use an
application role that can write or read secrets. The backend also blocks
private/reserved hosts, dangerous SQL forms, multiple statements, and
write-capable operations.

### Velocity Vector Database

1. Open **Vector Databases**.
2. Create a named vector database.
3. Upload one or more supported files.
4. Wait for the status to move from `processing` to `ready`.

Supported files:

- PDF
- DOCX
- TXT
- Markdown
- CSV
- JSON

The maximum upload size is 50 MB. Unsupported, corrupt, or text-empty binary
documents fail permanently; transient infrastructure failures are retried by
the ingestion queue.

Deleting a vector database or one of its files requires `vector-db:delete`.
Managers can upload by default but do not have that delete permission. The
current document dialog may still display a file-delete control to a manager;
the API rejects the operation. This is a known interface-permission mismatch,
not an authorization bypass.

## 4. Create a Project

1. Open **Projects**.
2. Select **New project**.
3. Choose the owning organization.
4. Enter a name and optional description.
5. Attach one or more available sources.
6. Save the project.

Projects can combine Airweave, SQL, and vector database sources. Chat only uses
attachments whose status is `ready`.

Use projects to enforce context boundaries. For example:

- a Finance project can expose approved finance documents and reporting tables;
- an Engineering project can expose design docs and operational databases;
- a Customer Support project can expose product knowledge and ticket content.

## 5. Start a Conversation

1. Open **Chat**.
2. Select **New**.
3. Choose a project.
4. Ask a concrete question.

Every conversation belongs to one project. Conversation history is private to
the current user and organization.

Good prompts name the business concept and desired result:

```text
Summarize the incident response process and list the owners for each stage.
```

```text
How many active customers were created by month during the last 12 months?
```

```text
Compare the documented cancellation policy with the cancellation reasons in
the reporting database.
```

The final example may use the general agent lane because it can require both
retrieval and SQL.

## 6. Read the Response

During generation, the UI can show:

- thinking;
- knowledge-base search;
- database search/execution completion;
- streamed answer text.

Completed answers may include:

- **Sources**: retrieved documents or indexed entities used by the answer.
- **SQL calls**: the connection, executed statement, row count, truncation
  state, and duration.

SQL rows are used to synthesize the answer but are not persisted in conversation
metadata. The SQL statement and execution summary are retained.

## 7. Organization and Role Behavior

Effective access is based on:

- the user's platform role;
- the user's membership role in the active organization;
- permissions assigned to that role;
- the organization ownership of the requested resource.

Default roles are:

| Role | Typical scope |
|---|---|
| `superadmin` | Platform-wide access and cross-organization support |
| `admin` | Full organization administration |
| `manager` | Day-to-day user, project, and source management; can upload vector documents but cannot delete vector databases or their files by default |
| `member` | Read and chat access to approved organization resources |

The permission model is action-based, so custom roles can differ from these
defaults.

## 8. Superadmin Views and Impersonation

Superadmins can switch between:

- a specific organization context;
- supported all-organization system views.

Impersonation is intended for support and diagnosis. The SPA displays an
impersonation banner and uses the effective impersonated session. Stop
impersonation as soon as the support task is complete.

## 9. Troubleshooting

### A page is missing

Your effective role probably lacks the corresponding `resource:action`
permission. Ask an administrator to inspect your active organization membership
and role.

### Chat cannot start

Confirm:

- an active organization is selected;
- you have `chat:create` and `chat:stream`;
- the selected project exists in the active organization;
- the project has at least one ready source.

### The answer says there is not enough information

The source may not contain the requested material, indexing may be incomplete,
or the query may be too broad. Try a more specific question and inspect the
project's attached sources.

### A SQL question fails

Check the connection status, allowlisted tables, network reachability,
SELECT-only role grants, and SQL agent limits. Operators should use the backend
[SQL operations runbook](https://github.com/TierOne-Studio/api-velocity/blob/master/docs/sql-connections-operations.md).

### A vector database remains in error

Open its file list and inspect the failed job. Common causes are unsupported or
corrupt documents, no extractable text, missing S3/Qdrant/OpenAI configuration,
or an embedding/vector-store mismatch.
