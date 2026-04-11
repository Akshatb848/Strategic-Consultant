#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_TEMPLATE="${ROOT_DIR}/.env.gcp.example"
ENV_FILE="${ROOT_DIR}/.env.gcp"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.gcp-free.yml"
DEFAULT_DATA_DIR="/opt/asis/data"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This bootstrap script is intended for a Debian or Ubuntu VM on GCP."
  exit 1
fi

if [[ ! -f "${ENV_TEMPLATE}" ]]; then
  echo "Missing ${ENV_TEMPLATE}"
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing ${COMPOSE_FILE}"
  exit 1
fi

if command -v sudo >/dev/null 2>&1 && [[ "${EUID}" -ne 0 ]]; then
  SUDO="sudo"
else
  SUDO=""
fi

log() {
  echo "[gcp-free-bootstrap] $*"
}

run_root() {
  if [[ -n "${SUDO}" ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

docker_cmd() {
  if [[ -n "${SUDO}" ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

install_base_packages() {
  log "Installing OS packages required for Docker and deployment."
  run_root apt-get update
  run_root apt-get install -y ca-certificates curl git gnupg lsb-release openssl
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker Engine and Compose plugin are already installed."
    return
  fi

  local distro arch codename
  distro="$(. /etc/os-release && echo "${ID}")"
  codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
  arch="$(dpkg --print-architecture)"

  log "Installing Docker Engine and Compose plugin."
  run_root install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL "https://download.docker.com/linux/${distro}/gpg" | run_root gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  fi
  run_root chmod a+r /etc/apt/keyrings/docker.gpg
  printf "deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/%s %s stable\n" "${arch}" "${distro}" "${codename}" | run_root tee /etc/apt/sources.list.d/docker.list >/dev/null
  run_root apt-get update
  run_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  run_root systemctl enable --now docker

  if [[ -n "${SUDO}" ]] && ! id -nG "${USER}" | grep -qw docker; then
    run_root usermod -aG docker "${USER}"
    log "Added ${USER} to the docker group. New shells will pick this up automatically."
  fi
}

ensure_swap() {
  if swapon --show | grep -q "/swapfile"; then
    log "Swapfile already configured."
    return
  fi

  log "Creating a 2 GB swapfile for the e2-micro VM."
  if [[ ! -f /swapfile ]]; then
    run_root fallocate -l 2G /swapfile || run_root dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    run_root chmod 600 /swapfile
    run_root mkswap /swapfile
  fi
  run_root swapon /swapfile

  if ! grep -q "^/swapfile " /etc/fstab; then
    printf "/swapfile none swap sw 0 0\n" | run_root tee -a /etc/fstab >/dev/null
  fi
}

detect_external_ip() {
  curl -fsS -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" 2>/dev/null || true
}

replace_env_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s#^${key}=.*#${key}=${value}#" "${ENV_FILE}"
  else
    printf "%s=%s\n" "${key}" "${value}" >>"${ENV_FILE}"
  fi
}

prepare_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log "Creating ${ENV_FILE} from the checked-in template."
    cp "${ENV_TEMPLATE}" "${ENV_FILE}"
  fi

  local external_ip
  external_ip="$(detect_external_ip)"
  if [[ -n "${external_ip}" ]] && grep -q "REPLACE_WITH_VM_EXTERNAL_IP" "${ENV_FILE}"; then
    log "Injecting the detected VM external IP into ${ENV_FILE}."
    sed -i "s/REPLACE_WITH_VM_EXTERNAL_IP/${external_ip}/g" "${ENV_FILE}"
  fi

  if grep -q "^JWT_SECRET=REPLACE_WITH_STRONG_SECRET" "${ENV_FILE}"; then
    log "Generating a strong JWT secret."
    replace_env_value "JWT_SECRET" "$(openssl rand -hex 32)"
  fi

  local data_dir
  data_dir="$(awk -F= '$1=="ASIS_DATA_DIR" { print $2 }' "${ENV_FILE}" | tail -n 1)"
  if [[ -z "${data_dir}" ]]; then
    data_dir="${DEFAULT_DATA_DIR}"
    replace_env_value "ASIS_DATA_DIR" "${data_dir}"
  fi

  run_root mkdir -p "${data_dir}"
}

validate_env_file() {
  if grep -q "REPLACE_WITH_" "${ENV_FILE}"; then
    log "The environment file still contains placeholder values."
    echo "Edit ${ENV_FILE}, replace the remaining REPLACE_WITH_* values, then rerun the script."
    exit 1
  fi
}

launch_stack() {
  log "Building and launching the free-tier Docker stack."
  docker_cmd compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build
}

print_summary() {
  local frontend_url backend_url
  frontend_url="$(awk -F= '$1=="FRONTEND_URL" { print $2 }' "${ENV_FILE}" | tail -n 1)"
  backend_url="$(awk -F= '$1=="NEXT_PUBLIC_API_URL" { print $2 }' "${ENV_FILE}" | tail -n 1)"

  log "Deployment complete."
  echo "Frontend: ${frontend_url}"
  echo "Backend health: ${backend_url}/v1/health"
  echo "Backend docs: ${backend_url}/docs"
}

install_base_packages
install_docker
ensure_swap
prepare_env_file
validate_env_file
launch_stack
print_summary
