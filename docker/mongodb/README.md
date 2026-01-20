# MongoDB Docker Configuration

This directory contains MongoDB initialization scripts for the Docker container.

## Files

- **init-db.sh**: Initialization script that runs when the MongoDB container starts for the first time. Creates the application database user with readWrite permissions.

## How It Works

When you run `docker-compose up`, the MongoDB container will:

1. Start with the root credentials specified in `.env` (ROOT_USERNAME, ROOT_PASSWORD)
2. Execute `init-db.sh` automatically (mounted via docker-compose.yml)
3. Create the application user with credentials from `.env` (MONGO_USER, MONGO_PWD)
4. Grant readWrite permissions to the application database (MONGO_DB_NAME)

## Environment Variables Required

The initialization script requires these variables from your `.env` file:

- `MONGO_DB_NAME`: Database name for the application
- `MONGO_USER`: Application database username
- `MONGO_PWD`: Application database password

These are configured in `docker-compose.yml` and passed to the container.

## Notes

- The init script only runs on the **first container start** when the MongoDB data volume is empty
- If you need to re-initialize, remove the Docker volume: `docker-compose down -v`
- The script uses `mongosh` (MongoDB Shell) to execute database commands
