#!/bin/bash
# ==============================================================================
# MongoDB User Initialization Script
# ==============================================================================
# This script runs automatically when the MongoDB container starts for the
# first time. It creates the application database user with readWrite permissions.
#
# Environment variables (passed from docker-compose.yml):
#   - MONGO_APP_DATABASE: Database name for the application
#   - MONGO_APP_USERNAME: Application database username
#   - MONGO_APP_PASSWORD: Application database password
#
# Exit codes:
#   0: Success
#   1: Error (missing environment variables or mongosh command failed)
# ==============================================================================

set -e  # Exit immediately if a command exits with a non-zero status
set -u  # Treat unset variables as an error

# ==============================================================================
# Validation
# ==============================================================================
if [ -z "${MONGO_APP_DATABASE:-}" ] || \
   [ -z "${MONGO_APP_USERNAME:-}" ] || \
   [ -z "${MONGO_APP_PASSWORD:-}" ]; then
    echo "ERROR: Required environment variables not set"
    echo "Required: MONGO_APP_DATABASE, MONGO_APP_USERNAME, MONGO_APP_PASSWORD"
    exit 1
fi

# ==============================================================================
# User Creation
# ==============================================================================
echo "==================== MongoDB User Initialization ===================="
echo "Database: $MONGO_APP_DATABASE"
echo "Username: $MONGO_APP_USERNAME"
echo "===================================================================="

# Execute MongoDB shell commands to create the application user
mongosh --quiet --eval "
  // Switch to the application database
  db = db.getSiblingDB('${MONGO_APP_DATABASE}');

  // Check if user already exists
  const existingUser = db.getUser('${MONGO_APP_USERNAME}');
  if (existingUser) {
    print('User ${MONGO_APP_USERNAME} already exists. Skipping creation.');
  } else {
    // Create the application user with readWrite role
    db.createUser({
      user: '${MONGO_APP_USERNAME}',
      pwd: '${MONGO_APP_PASSWORD}',
      roles: [
        {
          role: 'readWrite',
          db: '${MONGO_APP_DATABASE}'
        }
      ]
    });
    print('User ${MONGO_APP_USERNAME} created successfully.');
  }
"

echo "==================== Initialization Complete ======================="
