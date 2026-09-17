# Infrastructure

Production runs as containers on a single GCP VM, deployed by
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml). Setup,
secrets, rollback and backups are in
[docs/operations/deployment.md](../docs/operations/deployment.md).

| Directory | Holds |
| --- | --- |
| `docker/` | `docker-compose.prod.yml` (Caddy, web, api, PostgreSQL) and the `Caddyfile` |
| `deployment/` | `setup-vm.sh` (one-time VM preparation) and `deploy.sh` (run on the VM by each deploy) |
| `monitoring/` | Empty: dashboards, alert rules, log pipeline config |
| `database/` | Empty: backup, restore and retention scripts |

Local development does not use anything here; it runs from the
`docker-compose.yml` at the repository root.

The topology is deliberately small: Caddy → Next.js → Spring Boot → PostgreSQL
on one machine. Redis, managed databases and Kubernetes arrive only when usage
justifies them.
