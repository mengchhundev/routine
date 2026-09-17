# Local development

## Requirements

Docker, and nothing else. The backend builds inside a Maven/Temurin 21 image and
the frontend inside a Node 22 image, so no JDK, Maven, Node or PostgreSQL
installation is needed on the host.

## Start

```sh
cp .env.example .env      # optional; every value has a working default
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| Web | http://localhost:3000 | `next dev`, hot reload via a bind mount |
| API | http://localhost:8080 | Rebuild required after Java changes |
| Postgres | `localhost:5432` | user/db `routine`, password `routine` |
| Redis | `localhost:6379` | Unused by the MVP; reserved for reminder queues |

`api` waits on the Postgres healthcheck, so it never races the first migration.

## Everyday commands

```sh
make up          # build and start everything
make logs        # follow all logs
make api-logs    # follow the backend only
make psql        # psql shell against the dev database
make test        # backend test suite
make reset       # stop and delete the database volume
make down        # stop, keep the data
make secret      # generate a production JWT secret
```

## After a change

| Changed | Do |
| --- | --- |
| A `.tsx` / `.ts` file | Nothing — hot reload picks it up |
| `frontend/package.json` | `docker compose rm -sfv web && docker compose up -d --build web` |
| Any Java file | `docker compose up -d --build api` |
| A Flyway migration | `make reset && make up` while pre-release |

The `web` service keeps `node_modules` in an anonymous volume so the bind mount
does not shadow it. That volume survives a plain rebuild, which is why a
dependency change needs `rm -sfv` to discard it.

## Migrations

Add `backend/src/main/resources/db/migration/V<n>__<description>.sql`. Flyway
applies it on the next API start and records it in `flyway_schema_history`.

Never edit a migration that has been applied anywhere but your own machine —
Flyway checksums them and will refuse to start. Write a new one instead.

Hibernate runs with `ddl-auto: validate`, so a mapping that disagrees with the
migrated schema fails at startup rather than at the first request.

## Tests

```sh
make test
```

This starts a throwaway `postgres:16-alpine` on a tmpfs (the `postgres-test`
compose service, in the `test` profile), runs the suite against it, and removes
it afterwards. Every run therefore migrates a genuinely empty database.

A real PostgreSQL is required rather than an in-memory stand-in: the schema uses
partial unique indexes, array columns and GIN full-text indexes that nothing
else implements.

Integration tests carry `@ActiveProfiles("test")`, which supplies the datasource
and a throwaway signing key from
`backend/src/test/resources/application-test.yml`. That file is profile-specific
on purpose — a plain `application.yml` under `src/test/resources` would shadow
the main one and silently drop every other setting.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `ROUTINE_JWT_SECRET` | none | **Required.** Base64, ≥256 bits. Blank stops startup. |
| `ROUTINE_ACCESS_TOKEN_TTL` | `PT15M` | ISO-8601 duration |
| `ROUTINE_REFRESH_TOKEN_TTL` | `P30D` | ISO-8601 duration |
| `ROUTINE_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | localhost dev values | Set by compose |
| `LOG_LEVEL` | `INFO` | Applies to `com.routine` |

`docker-compose.yml` supplies a throwaway development key. Generate a real one
for anything else:

```sh
openssl rand -base64 48
```

## Troubleshooting

**API exits with "Property: routine.auth.jwtSecret … must not be blank".**
Working as intended: no secret, no startup. Either unset `ROUTINE_JWT_SECRET` in
`.env` so compose's development default applies, or set a real value.

**Web returns 500 with a PostCSS or Tailwind error.** `tailwindcss` and
`@tailwindcss/postcss` have drifted apart in the container's `node_modules`.
Both are pinned to the same exact version in `package.json`; discard the stale
volume with `docker compose rm -sfv web && docker compose up -d --build web`.

**`make reset` after a migration change.** Flyway will not re-run an applied
migration and will refuse to start if its checksum changed. Dropping the volume
is the right move before release; afterwards, write a new migration.
