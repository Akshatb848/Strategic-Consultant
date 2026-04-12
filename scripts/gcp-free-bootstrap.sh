#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_TEMPLATE="${ROOT_DIR}/.env.gcp.example"
ENV_FILE="${ROOT_DIR}/.env.gcp"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.gcp-free.yml"
DEFAULT_DATA_DIR=""

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

if command -v sudo >/dev/null 2>&1 && [[ "${EUID}" -ne 0 ]] && sudo -n true >/dev/null 2>&1; then
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
  if [[ -z "${SUDO}" ]]; then
    log "Skipping OS package installation because passwordless sudo is not available."
    return
  fi

  log "Installing OS packages required for Docker and deployment."
  run_root apt-get update
  run_root apt-get install -y ca-certificates curl git gnupg lsb-release openssl
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker Engine and Compose plugin are already installed."
    return
  fi

  if [[ -z "${SUDO}" ]]; then
    echo "Docker Engine and the Compose plugin are required, but passwordless sudo is not available to install them automatically."
    exit 1
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
  if [[ -z "${SUDO}" ]]; then
    log "Skipping swapfile configuration because passwordless sudo is not available."
    return
  fi

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
    if [[ -n "${DEFAULT_DATA_DIR}" ]]; then
      data_dir="${DEFAULT_DATA_DIR}"
    else
      data_dir="${HOME}/.asis/data"
    fi
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

env_value() {
  local key="$1"
  awk -F= -v lookup="${key}" '$1==lookup { print substr($0, index($0, "=") + 1) }' "${ENV_FILE}" | tail -n 1
}

legacy_conflicts_for_port() {
  local port="$1"
  docker_cmd ps --filter "publish=${port}" --format '{{.ID}} {{.Names}} {{.Label "com.docker.compose.project"}}'
}

ensure_required_ports() {
  local backend_port frontend_port
  backend_port="$(env_value "BACKEND_PORT")"
  frontend_port="$(env_value "FRONTEND_PORT")"

  for port in "${backend_port}" "${frontend_port}"; do
    [[ -z "${port}" ]] && continue

    local matches
    matches="$(legacy_conflicts_for_port "${port}")"
    [[ -z "${matches}" ]] && continue

    while IFS= read -r match; do
      [[ -z "${match}" ]] && continue

      local container_id container_name compose_project
      container_id="$(awk '{print $1}' <<<"${match}")"
      container_name="$(awk '{print $2}' <<<"${match}")"
      compose_project="$(awk '{print $3}' <<<"${match}")"

      if [[ "${compose_project}" == "strategic-decision-maker" || "${container_name}" == strategic-decision-maker-* ]]; then
        log "Removing legacy strategic-decision-maker container ${container_name} to free port ${port}."
        docker_cmd rm -f "${container_id}"
      else
        echo "Port ${port} is already in use by container ${container_name}."
        echo "Stop that container manually or change BACKEND_PORT/FRONTEND_PORT in ${ENV_FILE}, then rerun the deployment."
        exit 1
      fi
    done <<<"${matches}"
  done
}

clear_stale_pull_processes() {
  local compose_pull_pattern
  compose_pull_pattern="${COMPOSE_FILE} --env-file ${ENV_FILE} pull backend frontend"

  if pgrep -f "${compose_pull_pattern}" >/dev/null 2>&1; then
    log "Stopping stale docker compose pull processes from earlier deployment attempts."
    while IFS= read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill "${pid}" 2>/dev/null || true
    done < <(pgrep -f "${compose_pull_pattern}")
  fi
}

docker_login_if_configured() {
  local backend_image frontend_image ghcr_username ghcr_read_token
  backend_image="$(env_value "BACKEND_IMAGE")"
  frontend_image="$(env_value "FRONTEND_IMAGE")"
  ghcr_username="${GHCR_USERNAME:-}"
  ghcr_read_token="${GHCR_READ_TOKEN:-}"

  if [[ -z "${ghcr_username}" || -z "${ghcr_read_token}" ]]; then
    return
  fi

  if [[ "${backend_image}" != ghcr.io/* && "${frontend_image}" != ghcr.io/* ]]; then
    return
  fi

  log "Logging in to GHCR for prebuilt image pulls."
  printf "%s\n" "${ghcr_read_token}" | docker_cmd login ghcr.io -u "${ghcr_username}" --password-stdin
}

local_image_exists() {
  local image_ref="$1"
  docker_cmd image inspect "${image_ref}" >/dev/null 2>&1
}

is_registry_image() {
  local image_ref="$1"

  if [[ "${image_ref}" == *"/"* ]]; then
    return 0
  fi

  return 1
}

launch_stack() {
  local backend_image frontend_image
  backend_image="$(env_value "BACKEND_IMAGE")"
  frontend_image="$(env_value "FRONTEND_IMAGE")"

  if [[ -n "${backend_image}" && -n "${frontend_image}" ]]; then
    log "Using prebuilt images from .env.gcp."

    if local_image_exists "${backend_image}" && local_image_exists "${frontend_image}"; then
      log "Found both prebuilt images locally on the VM. Starting containers without rebuilding."
      docker_cmd compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans --no-build backend frontend
      return
    fi

    if is_registry_image "${backend_image}" && is_registry_image "${frontend_image}"; then
      log "Prebuilt images are not present locally. Pulling them from the configured registry."
      docker_cmd pull "${backend_image}"
      docker_cmd pull "${frontend_image}"
      docker_cmd compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans --no-build backend frontend
      return
    fi

    echo "Configured prebuilt images were not found locally:"
    echo "  BACKEND_IMAGE=${backend_image}"
    echo "  FRONTEND_IMAGE=${frontend_image}"
    echo "These tags are not registry-backed image names, so they must already be loaded on the VM."
    echo "If you are using the GitHub Actions VM deploy workflow, rerun it so the images are streamed onto the VM."
    echo "Otherwise unset BACKEND_IMAGE/FRONTEND_IMAGE in ${ENV_FILE} to fall back to a local VM build."
    return
  fi

  log "Building and launching the free-tier Docker stack on the VM."
  docker_cmd compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --build
}

print_summary() {
  local frontend_url backend_url
  frontend_url="$(awk -F= '$1=="FRONTEND_URL" { print $2 }' "${ENV_FILE}" | tail -n 1)"
  backend_url="$(awk -F= '$1=="NEXT_PUBLIC_API_URL" { print $2 }' "${ENV_FILE}" | tail -n 1)"

  docker_cmd compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

  log "Deployment complete."
  echo "Frontend: ${frontend_url}"
  echo "Backend health: ${backend_url}/v1/health"
  echo "Backend docs: ${backend_url}/docs"
}

if [[ -z "${SUDO}" ]]; then
  DEFAULT_DATA_DIR="${HOME}/.asis/data"
else
  DEFAULT_DATA_DIR="/opt/asis/data"
fi

install_base_packages
install_docker
ensure_swap
prepare_env_file
validate_env_file
docker_login_if_configured
ensure_required_ports
clear_stale_pull_processes
launch_stack
print_summary
