output "backend_service_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "frontend_service_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "database_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  value = google_redis_instance.cache.host
}
