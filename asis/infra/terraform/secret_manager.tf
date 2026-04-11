resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "asis-jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "litellm_master_key" {
  secret_id = "asis-litellm-master-key"

  replication {
    auto {}
  }
}

