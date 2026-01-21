# ==============================================================================
# Makefile - Wolf Dice Bot
# ==============================================================================
# Convenience commands for Docker operations
# ==============================================================================

.PHONY: help up down restart logs ps health backup restore clean update

# Default target
help:
	@echo "Wolf Dice Bot - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  up          - Start all services"
	@echo "  down        - Stop all services"
	@echo "  restart     - Restart all services"
	@echo "  logs        - View logs (Ctrl+C to exit)"
	@echo "  ps          - Show running containers"
	@echo "  health      - Check service health"
	@echo "  backup      - Backup MongoDB"
	@echo "  restore     - Restore MongoDB (requires BACKUP_FILE=path)"
	@echo "  clean       - Stop and remove everything"
	@echo "  update      - Update images and restart"
	@echo "  shell-mongo - Open MongoDB shell"
	@echo "  shell-redis - Open Redis CLI"

# Start services
up:
	docker compose up -d
	@echo "Services started. Run 'make logs' to view logs."

# Stop services
down:
	docker compose down

# Restart services
restart:
	docker compose restart

# View logs
logs:
	docker compose logs -f

# Show running containers
ps:
	docker compose ps

# Health check
health:
	@./docker/scripts/docker-utils.sh health

# Backup MongoDB
backup:
	@./docker/scripts/docker-utils.sh backup

# Restore MongoDB
restore:
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "Error: BACKUP_FILE not specified"; \
		echo "Usage: make restore BACKUP_FILE=./backups/mongodb-backup.gz"; \
		exit 1; \
	fi
	@./docker/scripts/docker-utils.sh restore $(BACKUP_FILE)

# Clean everything
clean:
	docker compose down -v
	@echo "All services and volumes removed."

# Update images
update:
	docker compose pull
	docker compose up -d --force-recreate
	@echo "Services updated and restarted."

# MongoDB shell
shell-mongo:
	docker compose exec mongodb mongosh -u admin -p

# Redis CLI
shell-redis:
	docker compose exec redis redis-cli
