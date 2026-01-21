#!/bin/bash
# ==============================================================================
# Docker Utilities Script - Wolf Dice Bot
# ==============================================================================
# Collection of utility functions for managing Docker containers
# ==============================================================================

set -e

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-wolf-dice}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==============================================================================
# Helper Functions
# ==============================================================================

print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ==============================================================================
# Main Functions
# ==============================================================================

# Health check for all services
health_check() {
    print_header "Health Check"

    echo "MongoDB:"
    docker compose exec mongodb mongosh --quiet --eval "db.adminCommand('ping')" && \
        print_success "MongoDB is healthy" || \
        print_error "MongoDB is not responding"

    echo ""
    echo "Redis:"
    docker compose exec redis redis-cli ping && \
        print_success "Redis is healthy" || \
        print_error "Redis is not responding"
}

# Backup MongoDB
backup_mongodb() {
    print_header "MongoDB Backup"

    # Load environment variables
    source .env 2>/dev/null || true

    BACKUP_DIR="./backups/mongodb"
    BACKUP_FILE="mongodb-backup-$(date +%Y%m%d-%H%M%S).gz"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

    mkdir -p "$BACKUP_DIR" || {
        print_error "Failed to create backup directory"
        return 1
    }

    # Check required environment variables
    if [ -z "$MONGO_ROOT_USERNAME" ] || [ -z "$MONGO_ROOT_PASSWORD" ] || [ -z "$MONGO_DB_NAME" ]; then
        print_error "Missing required environment variables (MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD, MONGO_DB_NAME)"
        return 1
    fi

    echo "→ Starting MongoDB dump..."

    if ! docker compose exec -T mongodb \
        mongodump \
          --username "$MONGO_ROOT_USERNAME" \
          --password "$MONGO_ROOT_PASSWORD" \
          --authenticationDatabase "admin" \
          --db "$MONGO_DB_NAME" \
          --archive \
          --gzip \
          > "$BACKUP_PATH"; then

        print_error "MongoDB backup failed (mongodump error)"
        rm -f "$BACKUP_PATH"
        return 1
    fi

    # Validate backup file
    if [[ ! -s "$BACKUP_PATH" ]]; then
        print_error "Backup file is empty or corrupted"
        rm -f "$BACKUP_PATH"
        return 1
    fi

    print_success "Backup saved successfully:"
    echo "  $BACKUP_PATH"
}


# Restore MongoDB
restore_mongodb() {
    if [ -z "$1" ]; then
        print_error "Usage: $0 restore <backup-file>"
        exit 1
    fi

    # Load environment variables
    source .env 2>/dev/null || true

    # Get absolute path of backup file
    local BACKUP_FILE="$1"
    if [[ ! "$BACKUP_FILE" = /* ]]; then
        # Convert relative path to absolute path
        BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" 2>/dev/null && pwd)/$(basename "$BACKUP_FILE")"
    fi

    # Check if backup file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi

    # Validate it's a gzip file
    if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
        print_error "Backup file is corrupted or not a valid gzip archive"
        exit 1
    fi

    print_header "MongoDB Restore"
    echo "Backup file: $BACKUP_FILE"
    print_warning "This will replace all data in the database!"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi

    echo "→ Starting MongoDB restore..."

    if ! docker compose exec -T mongodb \
        mongorestore \
          --username "$MONGO_ROOT_USERNAME" \
          --password "$MONGO_ROOT_PASSWORD" \
          --authenticationDatabase "admin" \
          --archive \
          --gzip < "$BACKUP_FILE"; then
        print_error "MongoDB restore failed"
        exit 1
    fi

    print_success "Restore completed"
}

# Show resource usage
resource_usage() {
    print_header "Resource Usage"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" \
        $(docker compose ps -q)
}

# Clean up old logs
cleanup_logs() {
    print_header "Log Cleanup"

    echo "Truncating container logs..."
    for container in $(docker compose ps -q); do
        truncate -s 0 $(docker inspect --format='{{.LogPath}}' $container) 2>/dev/null || true
    done

    print_success "Logs cleaned"
}

# Show connection strings
show_connections() {
    print_header "Connection Strings"

    echo "MongoDB (from host):"
    echo "  mongodb://${MONGO_USER}:${MONGO_PWD}@localhost:${MONGO_HOST_PORT:-27017}/${MONGO_DB_NAME}"
    echo ""
    echo "MongoDB (from container):"
    echo "  mongodb://${MONGO_USER}:${MONGO_PWD}@mongodb:27017/${MONGO_DB_NAME}"
    echo ""
    echo "Redis (from host):"
    echo "  redis://localhost:${REDIS_HOST_PORT:-6379}"
    echo ""
    echo "Redis (from container):"
    echo "  redis://redis:6379"
}

# ==============================================================================
# Main Script
# ==============================================================================

case "${1:-}" in
    health)
        health_check
        ;;
    backup)
        backup_mongodb
        ;;
    restore)
        restore_mongodb "$2"
        ;;
    resources)
        resource_usage
        ;;
    cleanup)
        cleanup_logs
        ;;
    connections)
        source .env 2>/dev/null || true
        show_connections
        ;;
    *)
        echo "Usage: $0 {health|backup|restore|resources|cleanup|connections}"
        echo ""
        echo "Commands:"
        echo "  health       - Check health of all services"
        echo "  backup       - Backup MongoDB database"
        echo "  restore      - Restore MongoDB from backup"
        echo "  resources    - Show resource usage"
        echo "  cleanup      - Clean up container logs"
        echo "  connections  - Show connection strings"
        exit 1
        ;;
esac
