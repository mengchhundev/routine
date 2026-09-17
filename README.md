# Routine

A personal improvement and productivity platform. Routine connects what you are
trying to become to what you actually do today, then shows you whether it is
working.

```text
Goal → Plan → Routine → Daily Task → Completion → Reflection → Progress
```

## Contents

- [Quick start](#quick-start)
- [Status](#status)
- [Everyday development](#everyday-development)
- [Configuration](#configuration)
- [Testing](#testing)
- [Layout](#layout)
- [Deployment](#deployment)
- [Architecture decisions](#architecture-decisions)
- [Documentation](#documentation)
- [Product philosophy](#product-philosophy)

## Quick start

The only requirement is Docker. No JDK, Maven, Node or PostgreSQL install is
needed — everything builds and runs in containers.

```sh
cp .env.example .env      # optional; every value has a working default
docker compose up --build # or: make up (same, detached)
```

Then open http://localhost:3000 and create an account at `/register`. There is
no seed data; a new account starts with an empty dashboard and a short guide to
what it will show once you add goals, routines and tasks.

| Service | URL | Notes |
| --- | --- | --- |
| Web | http://localhost:3000 | Next.js dev server, hot reload |
| API | http://localhost:8080 | Spring Boot; rebuild after Java changes |
| Health | http://localhost:8080/actuator/health | |
| Postgres | `localhost:5432` | user, password and database all `routine` |
| Redis | `localhost:6379` | Not used yet; reserved for queues and caching |

The API waits for the Postgres healthcheck, so the first Flyway migration never
races the database.

## Status

**Milestone 1 — Foundation. Complete.**
**Milestone 2 — Core productivity. Complete.**

Every section in the navigation is built, and every item in the MVP's
[definition of done](ROUTINE-PROPOSAL.md#17-mvp-definition-of-done) has a screen
behind it.

| Delivered | Not yet built |
| --- | --- |
| Repository, module structure, Docker development environment | Password reset, email verification |
| Full database schema (Flyway) | Email delivery for reminders |
| Registration, login, refresh, logout; profile and settings | Staging environment, automated database backups |
| Task CRUD, complete / skip / reopen / reschedule | Habit tracking, templates, import/export |
| Routines, schedules, and daily task generation | Calendar integration; AI features |
| Goals with a detail page; nested milestones, spans, derived progress | |
| Notes with full-text search; daily review | |
| Reminders, with a background dispatcher and delivery log | |
| Planner: day, week and month | |
| Dashboard and analytics, both derived on read | |
| CI/CD: GitHub Actions deploys containers to a GCP VM | |
| Today, Tasks, Routines, Planner, Goals, Notes, Reminders, Analytics, Settings | |

The two remaining account features — password reset and email verification —
need an email provider chosen first. Reminders ship without one because the
in-app channel counts as delivered once it is recorded (see
[docs/api/planner-and-analytics.md](docs/api/planner-and-analytics.md)).

Every metric in the product is derived on read, and the page that shows it
states how it is calculated — see
[docs/api/tasks-and-dashboard.md](docs/api/tasks-and-dashboard.md).

## Everyday development

`make help` lists every shortcut. All of them wrap `docker compose`.

```sh
make up          # build and start everything (detached)
make logs        # follow all logs
make api-logs    # follow the backend only
make psql        # psql shell against the dev database
make test        # backend test suite
make down        # stop, keep the data
make reset       # stop and delete the database volume
make secret      # generate a production JWT secret
```

What to do after a change:

| Changed | Do |
| --- | --- |
| A `.ts` / `.tsx` file | Nothing — hot reload picks it up |
| `frontend/package.json` | `docker compose rm -sfv web && docker compose up -d --build web` |
| Any Java file | `docker compose up -d --build api` |
| A new Flyway migration | Add `backend/src/main/resources/db/migration/V<n>__<description>.sql`; it applies on the next API start |
| An existing migration (pre-release only) | `make reset && make up` |

Never edit a migration that has run anywhere except your own machine. Flyway
checksums applied migrations and will refuse to start; write a new one instead.

Frontend type checking runs inside the container:

```sh
docker compose exec web npm run typecheck
```

## Configuration

Compose reads `.env` automatically; [.env.example](.env.example) lists every
value. The ones that matter:

| Variable | Default | Notes |
| --- | --- | --- |
| `ROUTINE_JWT_SECRET` | dev key (compose only) | **Required outside development.** Base64, at least 256 bits. Generate with `make secret`. |
| `ROUTINE_ACCESS_TOKEN_TTL` | `PT15M` | ISO-8601 duration |
| `ROUTINE_REFRESH_TOKEN_TTL` | `P30D` | ISO-8601 duration |
| `ROUTINE_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `POSTGRES_*`, `*_PORT` | `routine`, standard ports | Change the ports if they clash with local services |
| `LOG_LEVEL` | `INFO` | Applies to `com.routine` |

Outside compose there is no default secret: a blank `ROUTINE_JWT_SECRET` stops
the API at startup.

## Testing

```sh
make test
```

This starts a throwaway PostgreSQL on a tmpfs (the `postgres-test` compose
service), runs the backend suite against it, and removes it afterwards, so every
run migrates a genuinely empty database. A real server is required rather than
an in-memory stand-in: the schema uses partial unique indexes, array columns and
GIN full-text indexes that only PostgreSQL provides.

Tests live in [backend/src/test/java/com/routine/](backend/src/test/java/com/routine/)
and use the `test` profile from
[application-test.yml](backend/src/test/resources/application-test.yml).

## Layout

```text
routine/
├── backend/            Spring Boot 3.5 · Java 21 · PostgreSQL 16 · Flyway
│   └── src/main/java/com/routine/
│       ├── auth/       registration, login, JWT, refresh-token rotation
│       ├── user/       profile and settings
│       ├── task/       tasks, completions, and the Tasks screen's scopes
│       ├── routine/    routines, schedules, recurrence maths, generation
│       ├── goal/       goals, milestones, derived progress
│       ├── note/       notes, full-text search, daily reviews
│       ├── planner/    a day, a week and a month, assembled for the screens
│       ├── reminder/   reminders, the delivery poll, notification log
│       ├── analytics/  read-only; owns no tables
│       ├── common/     error shape, auditing, ownership-scoped repository base
│       └── config/     security, CORS, configuration properties
├── frontend/           Next.js 15 · React 19 · TypeScript · Tailwind 4
│   ├── app/(auth)/     login and registration
│   ├── app/(app)/      the signed-in screens: today, tasks, goals, planner, …
│   ├── app/api/        route handlers: auth cookies and the API proxy
│   ├── components/     UI, grouped by screen
│   └── lib/            API client, session, dates, per-feature helpers
├── .github/workflows/  CI/CD: test, build images, deploy to the VM
├── infrastructure/     production compose file, Caddyfile, VM scripts
├── docs/               architecture, api, operations, product
├── docker-compose.yml  the whole development stack
└── Makefile            shortcuts over docker compose
```

## Deployment

Every push to `main` runs the backend tests, builds the `api` and `web` images
into GitHub Container Registry, and deploys them to a GCP VM over SSH. On the VM,
Caddy serves the site over HTTPS in front of the web app, the API and
PostgreSQL. A failed test, build or health check stops the deploy.

First-time setup (VM, DNS, SSH key, GitHub secrets), rollback and backups are in
[docs/operations/deployment.md](docs/operations/deployment.md).

## Architecture decisions

Written up in [docs/architecture/decisions.md](docs/architecture/decisions.md).
The short version:

- **Modular monolith.** One deployable, one database, packages drawn on the
  module boundaries so a service can be extracted later if usage justifies it.
- **Flyway owns the schema.** Hibernate runs with `ddl-auto: validate` and fails
  at startup on drift.
- **Ownership is structural.** User-owned repositories extend
  `UserOwnedRepository`, which only offers `findByIdAndUserId`, so a lookup that
  skips the ownership check cannot compile.
- **Tokens never reach page JavaScript.** The browser talks to Next route
  handlers (`frontend/app/api/`), which keep the access and refresh tokens in
  httpOnly cookies and proxy requests to the API.
- **No secret has a committed default.** A blank `ROUTINE_JWT_SECRET` stops the
  application rather than falling back to a published key.
- **Generation happens on read, never backwards.** Opening a day creates its
  routine tasks in the reader's own timezone. Days already past are left alone,
  so browsing last month cannot rewrite its numbers.

## Documentation

| Document | Covers |
| --- | --- |
| [ROUTINE-PROPOSAL.md](ROUTINE-PROPOSAL.md) | Problem, users, features, MVP scope, roadmap |
| [docs/operations/local-development.md](docs/operations/local-development.md) | Setup, commands, configuration, troubleshooting |
| [docs/operations/deployment.md](docs/operations/deployment.md) | Production on a GCP VM: setup, secrets, rollback, backups |
| [docs/architecture/decisions.md](docs/architecture/decisions.md) | Why the code is shaped the way it is |
| [docs/api/auth.md](docs/api/auth.md) | Token model, auth and user endpoints, error shape |
| [docs/api/tasks-and-dashboard.md](docs/api/tasks-and-dashboard.md) | Tasks, goals, milestones, notes, daily review, dashboard |
| [docs/api/routines.md](docs/api/routines.md) | Routines, schedules, steps, generation |
| [docs/api/planner-and-analytics.md](docs/api/planner-and-analytics.md) | Week and month planner, analytics, reminders |
| [infrastructure/README.md](infrastructure/README.md) | What each infrastructure directory holds |

## Product philosophy

Routine should let a person answer five questions:

1. What am I trying to become?
2. What should I do today?
3. Did I do it?
4. What did I learn?
5. Am I becoming better over time?
