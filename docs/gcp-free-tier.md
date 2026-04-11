# GCP Free-Tier VM Deployment

This deployment path is the low-cost GCP option for the canonical `asis/` stack. It runs only:

- `asis/backend`
- `asis/frontend`

It does **not** use the paid managed infrastructure in `asis/infra` such as Cloud SQL, Memorystore, Artifact Registry, or Cloud Run. The backend uses SQLite on the VM and runs analyses in demo mode with inline execution.

## Included Repo Assets

- [`docker-compose.gcp-free.yml`](../docker-compose.gcp-free.yml)
- [`.env.gcp.example`](../.env.gcp.example)
- [`scripts/gcp-free-bootstrap.sh`](../scripts/gcp-free-bootstrap.sh)

## 1. Create The VM

Use an always-free `e2-micro` VM in `us-central1`, `us-west1`, or `us-east1`. The plan below assumes `us-central1`.

Example with `gcloud`:

```bash
PROJECT_ID="<your-project-id>"
ZONE="us-central1-a"
VM_NAME="asis-free"

gcloud config set project "${PROJECT_ID}"

gcloud compute instances create "${VM_NAME}" \
  --zone "${ZONE}" \
  --machine-type "e2-micro" \
  --image-family "ubuntu-2204-lts" \
  --image-project "ubuntu-os-cloud" \
  --boot-disk-size "30GB" \
  --boot-disk-type "pd-standard" \
  --tags "asis-free"

gcloud compute firewall-rules create "asis-free-frontend" \
  --allow "tcp:3001" \
  --direction "INGRESS" \
  --source-ranges "0.0.0.0/0" \
  --target-tags "asis-free"

gcloud compute firewall-rules create "asis-free-backend" \
  --allow "tcp:8000" \
  --direction "INGRESS" \
  --source-ranges "0.0.0.0/0" \
  --target-tags "asis-free"
```

If you prefer the console, create the VM with the same settings:

- region: `us-central1`
- machine type: `e2-micro`
- image: Ubuntu 22.04 LTS or Debian 12
- boot disk: `pd-standard`, `30 GB`
- external IP: ephemeral
- firewall: open `tcp:22`, `tcp:3001`, and `tcp:8000`

## 2. SSH And Clone The Repo

```bash
gcloud compute ssh "${VM_NAME}" --zone "${ZONE}"

sudo mkdir -p /opt/asis
sudo chown "$USER":"$USER" /opt/asis

git clone https://github.com/Akshatb848/Strategic-Consultant.git /opt/asis/app
cd /opt/asis/app
```

## 3. Prepare `.env.gcp`

```bash
cp .env.gcp.example .env.gcp
```

Edit `.env.gcp` before the first launch. At minimum set:

- `JWT_SECRET` to a strong random value
- `FRONTEND_URL` to `http://<VM_IP>:3001`
- `ALLOWED_ORIGINS` to `http://<VM_IP>:3001`
- `NEXT_PUBLIC_API_URL` to `http://<VM_IP>:8000`

The rest of the free-tier defaults are already set:

- SQLite persistence via `/data/asis_v4.db`
- `ASIS_DEMO_MODE=true`
- `RUN_ANALYSES_INLINE=true`
- `ENABLE_AUTO_SCHEMA=true`
- `SECURE_COOKIES=false`

## 4. Bootstrap And Launch

```bash
chmod +x scripts/gcp-free-bootstrap.sh
./scripts/gcp-free-bootstrap.sh
```

The bootstrap helper will:

- install Docker Engine and the Compose plugin if missing
- install Git and required packages
- add a 2 GB swapfile for the `e2-micro` VM
- create the SQLite data directory
- fill in the VM IP automatically if `.env.gcp` still contains the placeholder token
- generate `JWT_SECRET` automatically if the placeholder is still present
- run `docker compose -f docker-compose.gcp-free.yml --env-file .env.gcp up -d --build`

## 5. Verify The Deployment

Replace `<VM_IP>` with the VM external IP:

```bash
curl "http://<VM_IP>:8000/v1/health"
```

Open these URLs in a browser:

- frontend: `http://<VM_IP>:3001`
- backend docs: `http://<VM_IP>:8000/docs`

Expected checks:

- the landing page loads on port `3001`
- registration and login work end-to-end
- a new analysis completes in demo mode
- reports and detail pages render

## 6. Update Or Rebuild Later

```bash
cd /opt/asis/app
git pull
docker compose -f docker-compose.gcp-free.yml --env-file .env.gcp up -d --build
```

Rebuild the stack if the VM external IP changes, because the frontend bakes `NEXT_PUBLIC_API_URL` into the production build.

## Notes

- This path is optimized for the lowest ongoing cost, not for production-grade resilience.
- Data persists on the VM under `/opt/asis/data`.
- The current Terraform and Cloud Build files in `asis/infra` remain the paid managed-path assets for a future upgrade.
