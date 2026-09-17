# Deployment

Production runs as containers on one GCP VM, deployed by GitHub Actions on
every push to `main`.

```text
push to main
  → Backend tests (real PostgreSQL)
  → Build api + web images → ghcr.io/<owner>/routine-{api,web}:<commit sha>
  → SSH to the VM → docker compose pull && up --wait → check https://<domain>
```

On the VM:

```text
internet ─▶ Caddy :80/:443 (automatic HTTPS) ─▶ web :3000 ─▶ api :8080 ─▶ postgres
```

Only Caddy is published. The web app, the API and PostgreSQL are reachable
only on the compose network.

| File | Role |
| --- | --- |
| [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) | Test, build, push, deploy |
| [infrastructure/docker/docker-compose.prod.yml](../../infrastructure/docker/docker-compose.prod.yml) | The production stack |
| [infrastructure/docker/Caddyfile](../../infrastructure/docker/Caddyfile) | TLS and reverse proxy |
| [infrastructure/deployment/deploy.sh](../../infrastructure/deployment/deploy.sh) | Runs on the VM: pull, restart, wait for healthy |
| [infrastructure/deployment/setup-vm.sh](../../infrastructure/deployment/setup-vm.sh) | One-time VM preparation |

---

## One-time setup

Do these once, in order. Replace `routine-vm`, `ZONE` and `routine.example.com`
with your own values.

### 1. Check the VM

- **OS:** Debian 12 or Ubuntu 22.04/24.04. `setup-vm.sh` supports only these.
- **Size:** `e2-medium` (4 GB) is recommended. The JVM, Node and PostgreSQL fit
  in 2 GB only with swap, which the setup script adds automatically.
- **Static IP:** reserve one so a restart does not change the address your
  DNS points to:

  ```sh
  gcloud compute addresses create routine-ip --region=REGION
  # then attach it under VM instances → routine-vm → Edit → Network interfaces
  ```

### 2. Open ports 80 and 443

Caddy needs both: port 80 for the Let's Encrypt challenge and the HTTPS
redirect, 443 for the site.

```sh
gcloud compute instances add-tags routine-vm --zone=ZONE --tags=http-server,https-server

# Only needed if your project has no default-allow-http / default-allow-https rules:
gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443,udp:443 --target-tags=http-server,https-server
```

SSH (port 22) must be reachable from GitHub's runners. The default
`default-allow-ssh` rule allows it.

### 3. Point your domain at the VM

Create a DNS **A record**, for example `routine.example.com`, pointing to the
VM's external IP. Check it before continuing:

```sh
dig +short routine.example.com   # must print the VM's IP
```

Caddy cannot get a certificate until this resolves.

### 4. Create the deploy SSH key

On your own machine. Leave the passphrase empty, because GitHub Actions cannot
type one:

```sh
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/routine_deploy -N ""
```

This creates `~/.ssh/routine_deploy` (private, for GitHub) and
`~/.ssh/routine_deploy.pub` (public, for the VM).

### 5. Prepare the VM

Copy the setup script to the VM and run it with the **public** key:

```sh
gcloud compute scp infrastructure/deployment/setup-vm.sh routine-vm:~ --zone=ZONE
gcloud compute ssh routine-vm --zone=ZONE -- \
  "sudo bash ~/setup-vm.sh '$(cat ~/.ssh/routine_deploy.pub)'"
```

The script installs Docker, creates a `deploy` user that can run Docker, and
creates `/opt/routine`. Check the key works:

```sh
ssh -i ~/.ssh/routine_deploy deploy@VM_EXTERNAL_IP "docker compose version"
```

### 6. Add the GitHub secrets

In the repository: **Settings → Secrets and variables → Actions → New
repository secret**.

| Secret | Value |
| --- | --- |
| `VM_HOST` | The VM's external IP (or a DNS name that resolves to it) |
| `VM_USER` | `deploy` |
| `VM_SSH_KEY` | The whole **private** key: `cat ~/.ssh/routine_deploy` |
| `VM_SSH_KNOWN_HOSTS` | The VM's host keys: `ssh-keyscan -t ed25519,rsa VM_EXTERNAL_IP` |
| `DOMAIN` | `routine.example.com` (no `https://`) |
| `ACME_EMAIL` | Your email, for Let's Encrypt expiry notices |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `ROUTINE_JWT_SECRET` | `openssl rand -base64 48` |

Generate `POSTGRES_PASSWORD` and `ROUTINE_JWT_SECRET` with the commands shown.
Values must not contain a single quote (`'`).

`POSTGRES_PASSWORD` is used only when the database is **first** created.
Changing the secret later does not change the database's password, so the API
would stop connecting. See [Rotating secrets](#rotating-secrets).

`GITHUB_TOKEN` is provided automatically; there is nothing to add for the
container registry.

### 7. Deploy

Push to `main`, or run it by hand: **Actions → Deploy → Run workflow**. The
first run takes longer, because nothing is cached yet and Caddy requests the
certificate. Then open `https://routine.example.com`.

---

## Everyday use

Every push to `main` deploys. The workflow fails, and leaves the site as it was
as far as possible, if:

- a backend test fails
- either image fails to build (including a TypeScript error in `next build`)
- the new containers do not become healthy within 5 minutes
- the site does not answer over HTTPS afterwards

Deployments run one at a time. A push made during a deploy waits for it to
finish.

### Rolling back

Every build is kept in GHCR under its commit SHA. To go back:

1. Find the last good commit's full SHA (the commit list, or a previous
   successful run of the workflow).
2. **Actions → Deploy → Run workflow**, paste the SHA into `image_tag`, run.

That skips the tests and the build and deploys the existing images.

**Database migrations do not roll back.** If the release you are leaving added
a Flyway migration, the older API may refuse to start against the newer schema.
Roll forward with a fix instead.

### On the VM

```sh
ssh -i ~/.ssh/routine_deploy deploy@VM_EXTERNAL_IP
cd /opt/routine

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml exec postgres psql -U routine -d routine
bash deploy.sh    # re-run the last deployment
```

---

## Backups

Nothing backs up the database automatically yet. All data lives in the
`routine_postgres-data` Docker volume on the VM's disk.

At a minimum, take regular snapshots of the VM's boot disk:

```sh
gcloud compute resource-policies create snapshot-schedule routine-daily \
  --region=REGION --max-retention-days=14 --daily-schedule --start-time=03:00
gcloud compute disks add-resource-policies routine-vm \
  --zone=ZONE --resource-policies=routine-daily
```

For a logical dump you can restore anywhere:

```sh
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U routine -d routine --format=custom > routine-$(date +%F).dump
```

---

## Rotating secrets

- **`ROUTINE_JWT_SECRET`:** update the secret and redeploy. Everyone is signed
  out, because existing tokens no longer verify.
- **`POSTGRES_PASSWORD`:** change it in the database first, then update the
  secret and redeploy:

  ```sh
  docker compose -f docker-compose.prod.yml exec postgres \
    psql -U routine -d routine -c "ALTER USER routine PASSWORD 'new-password';"
  ```

- **`VM_SSH_KEY`:** generate a new key, add its public half to
  `/home/deploy/.ssh/authorized_keys`, update the secret, then remove the old
  public key.

---

## Troubleshooting

**`Host key verification failed`.** `VM_SSH_KNOWN_HOSTS` does not match the VM,
usually because the IP changed or the VM was recreated. Run `ssh-keyscan` again
and update the secret.

**`Permission denied (publickey)`.** `VM_SSH_KEY` must be the whole private key,
including the `BEGIN` and `END` lines. Check that the public half is in
`/home/deploy/.ssh/authorized_keys`. If the project enforces OS Login, also add
the key to the `deploy` user through OS Login, or disable OS Login for this VM.

**Deploy step fails with "Stack did not become healthy".** The workflow log
prints the last lines from `api`, `web` and `caddy`. The usual causes:

- The API cannot reach the database because `POSTGRES_PASSWORD` changed after
  the first deploy (see above).
- The API is killed for memory on a small VM. Look for `OOMKilled` in
  `docker inspect routine-api-1`.

**The site check fails but the containers are healthy.** Caddy has no
certificate yet. Check `docker compose -f docker-compose.prod.yml logs caddy`:

- DNS for `DOMAIN` must resolve to the VM.
- Ports 80 and 443 must be open in the GCP firewall.

**Login appears to work, then bounces back to the login page.** The session
cookies are `Secure` and are only sent over HTTPS. Use `https://`, not `http://`
or the bare IP.
