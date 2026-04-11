terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_artifact_registry_repository" "asis" {
  location      = var.region
  repository_id = var.artifact_registry_repository
  description   = "ASIS container images"
  format        = "DOCKER"
}

resource "google_sql_database_instance" "postgres" {
  name             = var.database_instance_name
  region           = var.region
  database_version = "POSTGRES_16"

  settings {
    tier = "db-custom-2-7680"
    ip_configuration {
      ipv4_enabled = true
    }
    backup_configuration {
      enabled = true
    }
  }
}

resource "google_redis_instance" "cache" {
  name           = var.redis_instance_name
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region
}

resource "google_cloud_run_v2_service" "backend" {
  name     = var.backend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository}/asis-backend:latest"
      ports {
        container_port = 8000
      }
    }
  }
}

resource "google_cloud_run_v2_service" "frontend" {
  name     = var.frontend_service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository}/asis-frontend:latest"
      ports {
        container_port = 3000
      }
    }
  }
}

