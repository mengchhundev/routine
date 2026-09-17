#!/usr/bin/env bash
# One-time preparation of a Debian or Ubuntu GCP VM for deployment.
#
#   - installs Docker Engine and the compose plugin
#   - creates a `deploy` user in the docker group, allowed in by one SSH key
#   - creates /opt/routine, where the workflow puts the stack
#   - adds a 2 GB swap file on small machines, so the JVM, Node and PostgreSQL
#     are not OOM-killed during a restart
#
# Usage, on the VM:
#   sudo bash setup-vm.sh "ssh-ed25519 AAAA... github-actions-deploy"

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

PUBLIC_KEY="${1:-}"
if [[ -z "$PUBLIC_KEY" ]]; then
  echo "Usage: sudo bash setup-vm.sh \"<deploy public key>\"" >&2
  exit 1
fi

DEPLOY_USER=deploy
DEPLOY_DIR=/opt/routine

. /etc/os-release
if [[ "$ID" != "debian" && "$ID" != "ubuntu" ]]; then
  echo "This script supports Debian and Ubuntu; found $ID." >&2
  exit 1
fi

echo "==> Installing Docker Engine"
if ! command -v docker >/dev/null; then
  apt-get update -q
  apt-get install -yq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Creating the $DEPLOY_USER user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTHORIZED="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTHORIZED"
grep -qxF "$PUBLIC_KEY" "$AUTHORIZED" || echo "$PUBLIC_KEY" >> "$AUTHORIZED"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTHORIZED"
chmod 600 "$AUTHORIZED"

echo "==> Creating $DEPLOY_DIR"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_DIR"

echo "==> Checking memory"
TOTAL_MB=$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)
if [[ $TOTAL_MB -lt 3500 ]] && ! swapon --show | grep -q .; then
  echo "    ${TOTAL_MB} MB RAM and no swap: adding a 2 GB swap file"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo
echo "Done. Docker $(docker --version | cut -d' ' -f3 | tr -d ,) with $(docker compose version --short) is ready."
echo "Deploy user: $DEPLOY_USER, stack directory: $DEPLOY_DIR"
