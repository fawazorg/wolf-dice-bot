# Docker Infrastructure Guide

## Overview

This project uses Docker Compose to manage MongoDB and Redis services with production-ready configurations following 2025 best practices.

## Quick Start

### 1. Initial Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Start services
docker compose up -d

# Check service health
docker compose ps
docker compose logs -f
```

### 2. Verify Installation

```bash
# Check MongoDB
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis
docker compose exec redis redis-cli ping

# View resource usage
docker stats
```

## Architecture

### Network Topology

```
┌─────────────────────────────────────────┐
│  Docker Network: wolf-dice-network      │
│  Subnet: 172.28.0.0/16                  │
│                                          │
│  ┌────────────┐      ┌────────────┐    │
│  │  MongoDB   │      │   Redis    │    │
│  │  Port:     │      │   Port:    │    │
│  │  27017     │      │   6379     │    │
│  └────────────┘      └────────────┘    │
└─────────────────────────────────────────┘
```

### Services

| Service  | Image          | Port (Host) | Port (Container) | Purpose              |
|----------|----------------|-------------|------------------|----------------------|
| MongoDB  | mongo:8.0      | 27017*      | 27017            | Primary database     |
| Redis    | redis:7-alpine | 6379*       | 6379             | Cache & sessions     |

*Configurable via `.env` to avoid port conflicts

## Configuration

### Environment Variables

All configuration is done via `.env` file. Key variables:

```bash
# Project naming (prevents conflicts)
COMPOSE_PROJECT_NAME=wolf-dice

# Port mapping (change if ports are in use)
MONGO_HOST_PORT=27017
REDIS_HOST_PORT=6379

# Credentials (use strong passwords!)
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_USER=wolf_dice_user
MONGO_PWD=your_app_password

# Resource limits
MONGO_MEMORY_LIMIT=512M
REDIS_MEMORY_LIMIT=256M
```

### Running Multiple Projects

To run multiple instances on the same host:

```bash
# Project 1
COMPOSE_PROJECT_NAME=wolf-dice-prod
MONGO_HOST_PORT=27017
REDIS_HOST_PORT=6379

# Project 2
COMPOSE_PROJECT_NAME=wolf-dice-dev
MONGO_HOST_PORT=27018
REDIS_HOST_PORT=6380

# Project 3
COMPOSE_PROJECT_NAME=wolf-dice-staging
MONGO_HOST_PORT=27019
REDIS_HOST_PORT=6381
```

## Common Operations

### Starting & Stopping

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart mongodb

# Stop and remove everything (including volumes)
docker compose down -v
```

### Logs & Monitoring

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f mongodb
docker compose logs -f redis

# View last 100 lines
docker compose logs --tail=100

# Resource usage
docker stats
```

### Database Operations

#### MongoDB

```bash
# Connect to MongoDB shell
docker compose exec mongodb mongosh -u admin -p

# Backup database
docker compose exec mongodb mongodump --archive=/data/backup.gz --gzip

# Restore database
docker compose exec -T mongodb mongorestore --archive=/data/backup.gz --gzip

# Export to host
docker compose cp mongodb:/data/backup.gz ./backups/

# Import from host
docker compose cp ./backups/backup.gz mongodb:/data/backup.gz
```

#### Redis

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli -a your_redis_password

# Monitor Redis commands
docker compose exec redis redis-cli -a your_redis_password monitor

# Get Redis info
docker compose exec redis redis-cli -a your_redis_password INFO

# Flush all data (be careful!)
docker compose exec redis redis-cli -a your_redis_password FLUSHALL
```

### Health Checks

```bash
# Check MongoDB health
docker compose exec mongodb mongosh --quiet --eval "db.adminCommand('ping')"

# Check Redis health
docker compose exec redis redis-cli ping

# Use utility script
./docker/scripts/docker-utils.sh health
```

### Utility Script

The project includes a utility script for common operations:

```bash
# Health check
./docker/scripts/docker-utils.sh health

# Backup MongoDB
./docker/scripts/docker-utils.sh backup

# Restore MongoDB
./docker/scripts/docker-utils.sh restore ./backups/mongodb-backup-20250121-120000.gz

# Show resource usage
./docker/scripts/docker-utils.sh resources

# Clean up logs
./docker/scripts/docker-utils.sh cleanup

# Show connection strings
./docker/scripts/docker-utils.sh connections
```

## Production Deployment

### Using Production Configuration

```bash
# Start with production overrides
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Production changes:
- Ports not exposed to host (internal only)
- Stricter restart policy (`always` instead of `unless-stopped`)
- Increased resource limits
- Enhanced security settings

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong random passwords (32+ characters)
- [ ] Enable Redis password authentication
- [ ] Don't expose database ports in production
- [ ] Use firewall rules to restrict access
- [ ] Enable MongoDB authentication
- [ ] Regular security updates: `docker compose pull`
- [ ] Regular backups
- [ ] Monitor logs for suspicious activity

### Backup Strategy

```bash
# Automated backup script (add to crontab)
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/wolf-dice"
mkdir -p "$BACKUP_DIR"

# Backup MongoDB
docker compose exec -T mongodb mongodump --archive --gzip > \
    "$BACKUP_DIR/mongodb-$DATE.gz"

# Backup Redis
docker compose exec -T redis redis-cli --rdb /data/dump.rdb SAVE
docker compose cp redis:/data/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"

# Keep only last 7 days
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
```

### Monitoring

```bash
# Resource usage monitoring
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Container status
docker compose ps

# Health status
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

## Troubleshooting

### Port Already in Use

**Problem**: Port conflict error

**Solution**:
```bash
# Find what's using the port
sudo lsof -i :27017
sudo netstat -tulpn | grep 27017

# Change port in .env
MONGO_HOST_PORT=27018
```

### Container Won't Start

**Problem**: Service fails to start

**Solution**:
```bash
# Check logs
docker compose logs mongodb

# Check disk space
df -h

# Check permissions
ls -la docker/mongodb/init-db.sh

# Rebuild with no cache
docker compose up -d --force-recreate
```

### Cannot Connect to Database

**Problem**: Connection refused

**Solution**:
```bash
# Check if container is running
docker compose ps

# Check health
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check network
docker network ls
docker network inspect wolf-dice-network

# Verify credentials in .env
cat .env | grep MONGO
```

### Out of Memory

**Problem**: Container killed due to OOM

**Solution**:
```bash
# Check current limits
docker compose config

# Increase limits in .env
MONGO_MEMORY_LIMIT=1G
REDIS_MEMORY_LIMIT=512M

# Restart
docker compose down && docker compose up -d
```

### Database Connection from Application

**From Host Machine**:
```javascript
// MongoDB
const uri = `mongodb://${MONGO_USER}:${MONGO_PWD}@localhost:27017/${MONGO_DB_NAME}`;

// Redis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: REDIS_PASSWORD
});
```

**From Docker Container**:
```javascript
// MongoDB (use service name as hostname)
const uri = `mongodb://${MONGO_USER}:${MONGO_PWD}@mongodb:27017/${MONGO_DB_NAME}`;

// Redis (use service name as hostname)
const redis = new Redis({
  host: 'redis',
  port: 6379,
  password: REDIS_PASSWORD
});
```

## Maintenance

### Updating Images

```bash
# Pull latest images
docker compose pull

# Recreate containers with new images
docker compose up -d --force-recreate

# Remove old images
docker image prune -a
```

### Volume Management

```bash
# List volumes
docker volume ls | grep wolf-dice

# Inspect volume
docker volume inspect wolf-dice-mongodb-data

# Backup volume
docker run --rm -v wolf-dice-mongodb-data:/data -v $(pwd):/backup \
    alpine tar czf /backup/mongodb-data-backup.tar.gz /data

# Restore volume
docker run --rm -v wolf-dice-mongodb-data:/data -v $(pwd):/backup \
    alpine tar xzf /backup/mongodb-data-backup.tar.gz -C /

# Remove unused volumes
docker volume prune
```

### Log Management

```bash
# View log sizes
docker ps -q | xargs docker inspect --format='{{.LogPath}}' | xargs ls -lh

# Truncate logs
docker compose down
find /var/lib/docker/containers/ -name "*.log" -exec truncate -s 0 {} \;
docker compose up -d

# Configure log rotation (in docker-compose.yml)
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Performance Tuning

### MongoDB Optimization

```bash
# Increase WiredTiger cache (in .env)
MONGO_WIREDTIGER_CACHE_SIZE_GB=1

# Enable compression
docker compose exec mongodb mongosh --eval "
  db.adminCommand({
    setParameter: 1,
    wiredTigerEngineRuntimeConfig: 'cache_size=1GB'
  })
"
```

### Redis Optimization

```bash
# Tune memory policy (in docker-compose.yml)
--maxmemory-policy allkeys-lru

# Disable persistence for caching
--save ''
--appendonly no
```

## FAQ

**Q: Can I run this on Windows/Mac?**  
A: Yes, Docker Desktop supports all platforms.

**Q: How do I migrate data to a new host?**  
A: Use the backup/restore scripts or copy volume directories.

**Q: Should I expose database ports in production?**  
A: No, use `docker-compose.prod.yml` which doesn't expose ports.

**Q: How do I scale Redis?**  
A: Use Redis Sentinel or Redis Cluster (requires additional configuration).

**Q: Can I use Docker Swarm?**  
A: Yes, but you'll need to convert to stack deploy format.

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Hub](https://hub.docker.com/_/mongo)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
