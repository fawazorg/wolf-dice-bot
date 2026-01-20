#!/bin/bash
# MongoDB Initialization Script
# This script runs automatically when the MongoDB container starts for the first time.
# It creates the application database user with readWrite permissions.
#
# Environment variables required (from .env file):
#   - MONGO_DB_NAME: Database name for the application
#   - MONGO_USER: Application database username
#   - MONGO_PWD: Application database password

# Exit immediately if a command exits with a non-zero status
set -e

echo "======================= Creating MongoDB User ======================="

# Execute MongoDB shell commands to create the application user
mongosh --quiet <<EOF
use $MONGO_DB_NAME

db.createUser({
  user: "$MONGO_USER",
  pwd: "$MONGO_PWD",
  roles: [
    {
      role: "readWrite",
      db: "$MONGO_DB_NAME"
    }
  ]
})
EOF

echo "======================= User Created Successfully ======================="
