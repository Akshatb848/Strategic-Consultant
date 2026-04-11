variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "artifact_registry_repository" {
  type    = string
  default = "asis"
}

variable "backend_service_name" {
  type    = string
  default = "asis-backend"
}

variable "frontend_service_name" {
  type    = string
  default = "asis-frontend"
}

variable "database_instance_name" {
  type    = string
  default = "asis-sql"
}

variable "redis_instance_name" {
  type    = string
  default = "asis-redis"
}

