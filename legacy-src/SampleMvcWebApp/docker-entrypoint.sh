#!/bin/bash
set -e

# If DB_CONNECTION_STRING env var is set, patch Web.config connection string
if [ -n "$DB_CONNECTION_STRING" ]; then
  echo "Patching Web.config connection string..."
  sed -i "s|connectionString=\"[^\"]*\"|connectionString=\"${DB_CONNECTION_STRING}\"|g" \
    /app/SampleWebApp/Web.config
fi

# Start XSP4
exec xsp4 --port 8080 --address 0.0.0.0 --nonstop --applications "/:/app/SampleWebApp"
