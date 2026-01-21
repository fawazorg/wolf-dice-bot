#!/bin/bash
# ==============================================================================
# Docker Setup Validation Script
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass=0
fail=0
warn=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((pass++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((fail++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((warn++))
}

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Docker Setup Validation${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check Docker
echo "Checking Docker installation..."
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    docker --version
else
    check_fail "Docker is not installed"
fi

# Check Docker Compose
echo ""
echo "Checking Docker Compose..."
if docker compose version &> /dev/null; then
    check_pass "Docker Compose V2 is installed"
    docker compose version
else
    check_fail "Docker Compose V2 is not installed"
fi

# Check .env file
echo ""
echo "Checking configuration..."
if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check required variables
    required_vars=("MONGO_ROOT_USERNAME" "MONGO_ROOT_PASSWORD" "MONGO_USER" "MONGO_PWD" "MONGO_DB_NAME")
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .env && ! grep -q "^${var}=$" .env; then
            check_pass "$var is set"
        else
            check_fail "$var is not set in .env"
        fi
    done
else
    check_fail ".env file not found (copy from .env.example)"
fi

# Check init script permissions
echo ""
echo "Checking file permissions..."
if [ -x "docker/mongodb/init-db.sh" ]; then
    check_pass "init-db.sh is executable"
else
    check_warn "init-db.sh is not executable (will fix automatically)"
    chmod +x docker/mongodb/init-db.sh
fi

# Check for port conflicts
echo ""
echo "Checking for port conflicts..."
source .env 2>/dev/null || true
MONGO_PORT=${MONGO_HOST_PORT:-27017}
REDIS_PORT=${REDIS_HOST_PORT:-6379}

if lsof -i :$MONGO_PORT &> /dev/null; then
    check_warn "Port $MONGO_PORT is in use (change MONGO_HOST_PORT in .env)"
else
    check_pass "MongoDB port $MONGO_PORT is available"
fi

if lsof -i :$REDIS_PORT &> /dev/null; then
    check_warn "Port $REDIS_PORT is in use (change REDIS_HOST_PORT in .env)"
else
    check_pass "Redis port $REDIS_PORT is available"
fi

# Check disk space
echo ""
echo "Checking disk space..."
available=$(df . | tail -1 | awk '{print $4}')
if [ "$available" -gt 1048576 ]; then  # > 1GB
    check_pass "Sufficient disk space available"
else
    check_warn "Low disk space (less than 1GB available)"
fi

# Summary
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "  Results:"
echo -e "  ${GREEN}Passed: $pass${NC}"
echo -e "  ${RED}Failed: $fail${NC}"
echo -e "  ${YELLOW}Warnings: $warn${NC}"
echo -e "${BLUE}================================================${NC}"

if [ $fail -eq 0 ]; then
    echo -e "${GREEN}✓ Setup is valid! Ready to run 'docker compose up -d'${NC}"
    exit 0
else
    echo -e "${RED}✗ Please fix the failed checks before proceeding${NC}"
    exit 1
fi
