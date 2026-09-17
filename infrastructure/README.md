# Infrastructure

Empty for now by design — Milestone 1 runs entirely from `docker-compose.yml` at
the repository root, and the project plan is explicit that operational
complexity should arrive only when it is justified.

| Directory | Holds | Arrives with |
| --- | --- | --- |
| `docker/` | Production compose file, image build config | Milestone 6 |
| `deployment/` | Staging and production deployment config | Milestone 6 |
| `monitoring/` | Dashboards, alert rules, log pipeline config | Milestone 6 |
| `database/` | Backup, restore and retention scripts | Milestone 6 |

The target initial production topology is Cloudflare → load balancer → Next.js
and Spring Boot → PostgreSQL and Redis. Kubernetes is explicitly *not* the
starting point.
