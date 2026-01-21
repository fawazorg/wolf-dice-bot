# Docker Quick Reference Card

## 🚀 Getting Started (5 Minutes)

```bash
# 1. Configure
cp .env.example .env
nano .env  # Set passwords

# 2. Validate
./docker/scripts/validate-setup.sh

# 3. Start
make up

# 4. Verify
make health
```

## 📋 Common Commands

```bash
make up          # Start services
make down        # Stop services
make restart     # Restart all
make logs        # View logs
make ps          # Show status
make health      # Check health
```

## 🔧 Database Operations

```bash
# MongoDB
make shell-mongo              # Open shell
make backup                   # Backup database
make restore BACKUP_FILE=...  # Restore database

# Redis
make shell-redis              # Open CLI
```

## 🐛 Troubleshooting

```bash
# Check health
make health

# View logs
make logs

# Resource usage
docker stats

# Restart service
docker compose restart mongodb
```

## ⚙️ Configuration

Edit `.env` file:

```bash
# Change ports
MONGO_HOST_PORT=27018
REDIS_HOST_PORT=6380

# Change resources
MONGO_MEMORY_LIMIT=1G
REDIS_MEMORY_LIMIT=512M
```

## 📚 Full Documentation

- **DOCKER.md** - Complete guide
- **REFACTOR_SUMMARY.md** - What changed
- **BEFORE_AFTER_COMPARISON.md** - Detailed comparison

## 🆘 Emergency Commands

```bash
# Stop everything
make down

# Remove everything (INCLUDING DATA)
make clean

# Update and restart
make update
```

## 🔗 Connection Strings

**From Host**:
```javascript
// MongoDB
mongodb://user:pass@localhost:27017/dbname

// Redis  
redis://localhost:6379
```

**From Container**:
```javascript
// MongoDB
mongodb://user:pass@mongodb:27017/dbname

// Redis
redis://redis:6379
```

## ✅ Health Check

```bash
# Quick check
docker compose ps

# Detailed check
make health

# Manual check
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
docker compose exec redis redis-cli ping
```
