#!/usr/bin/env bash
#
# One-shot deploy of The Document onto a fresh Ubuntu 22.04 / 24.04 server.
#
#   sudo bash deploy/setup-vps.sh thedocument.example.com you@example.com
#
# Installs Node 22, PostgreSQL, nginx and a TLS certificate, creates the
# database, builds the app and runs it as a systemd service on port 3300 with
# nginx in front. Safe to re-run: every step checks before it acts.
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_USER="${APP_USER:-document}"
APP_DIR="${APP_DIR:-/srv/the-document}"
REPO="${REPO:-https://github.com/anirudhatalmale6-alt/contributor-news-portal.git}"
DB_NAME="${DB_NAME:-newsportal}"
DB_USER="${DB_USER:-newsportal}"
PORT="${PORT:-3300}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash deploy/setup-vps.sh <domain> [email-for-tls]" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo." >&2
  exit 1
fi

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git nginx postgresql postgresql-contrib ufw

if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 22 ]]; then
  echo "==> Node 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

echo "==> Database"
DB_PASS="$(openssl rand -hex 16)"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -qc "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "==> Application user and code"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
else
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 "$REPO" "$APP_DIR"
  chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
fi

echo "==> Environment"
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="https://${DOMAIN}"
NEXTAUTH_URL="https://${DOMAIN}"
SITE_URL="https://${DOMAIN}"
# Uploads on a real disk here; /srv keeps them outside the build directory.
STORAGE_DRIVER="disk"
UPLOAD_DIR="${APP_DIR}/storage/uploads"
# Fill these in to switch on social login, then: systemctl restart the-document
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
AUTH_FACEBOOK_ID=""
AUTH_FACEBOOK_SECRET=""
EOF
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "    wrote $ENV_FILE (database password generated)"
else
  echo "    keeping the existing $ENV_FILE"
fi
mkdir -p "$APP_DIR/storage/uploads"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR/storage"

echo "==> Build"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npx prisma migrate deploy && npm run build"

echo "==> Service"
cat > /etc/systemd/system/the-document.service <<EOF
[Unit]
Description=The Document - contributor news portal
After=network.target postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=/usr/bin/npx next start -p ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now the-document
systemctl restart the-document

echo "==> nginx"
cat > /etc/nginx/sites-available/the-document <<EOF
server {
  listen 80;
  server_name ${DOMAIN} www.${DOMAIN};

  # Uploads go through the app, so allow a video-sized body.
  client_max_body_size 150M;

  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF
ln -sf /etc/nginx/sites-available/the-document /etc/nginx/sites-enabled/the-document
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

if [[ -n "$EMAIL" ]]; then
  echo "==> TLS"
  apt-get install -y -qq certbot python3-certbot-nginx
  # www is included only if it resolves, otherwise the whole run would fail.
  CERT_DOMAINS="-d ${DOMAIN}"
  if getent hosts "www.${DOMAIN}" >/dev/null; then CERT_DOMAINS="${CERT_DOMAINS} -d www.${DOMAIN}"; fi
  certbot --nginx ${CERT_DOMAINS} --non-interactive --agree-tos -m "$EMAIL" --redirect || \
    echo "    certbot failed - check that ${DOMAIN} points at this server, then re-run certbot"
fi

echo
echo "Done. https://${DOMAIN}"
echo "Seed demo content (optional): sudo -u ${APP_USER} bash -lc \"cd ${APP_DIR} && npx tsx prisma/seed.ts\""
echo "Logs:    journalctl -u the-document -f"
echo "Restart: systemctl restart the-document"
