# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dice game bot for wolf.live (a chat platform). The bot manages multiplayer dice games where players guess numbers, pick opponents, place bets, and roll dice in a turn-based format. The bot supports multiple accounts, MongoDB persistence, and multi-language (English/Arabic) support.

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Start infrastructure (MongoDB + Redis)
docker-compose up -d
```

## Architecture

The codebase follows a clean layered architecture:

### Core Layer (`src/core/`)
Pure game logic without external dependencies (stateless):
- **Player.js**: Player balance and status tracking
- **Channel.js**: Game channel management (language, player list)
- **Dice.js**: Dice rolling mechanics with configurable ranges
- **GameState.js**: Game phase constants (JOINING, GUESSING, PICKING, BETTING, ROLLING, FINISHED)
- **Round.js**: Round state entity

### Game Layer (`src/game/`)
Stateful game engine with Redis persistence:
- **GameEngine.js**: Main game orchestration with Redis persistence, handles all game phases and events
- **GameStore.js**: Redis-backed game state storage
- **Validator.js**: Input validation for guesses, bets, and picks

### Platform Layer (`src/platform/`)
WOLF platform integration:
- **DiceClient.js**: WOLF client wrapper with command registration
- **GameManager.js**: Bridges GameEngine with MessageService and WOLF client
- **MessageService.js**: Centralized message handling with phrase lookup and multi-language support

### Storage Layer (`src/storage/`)
All data persistence:
- **redis/**: Redis connection management
- **mongo/**: MongoDB connection, Mongoose models, and database helpers

### Utils Layer (`src/utils/`)
- **Random.js**: Random number generation for dice rolls
- **config.js**: Configuration helpers
- **logger.js**: Logging utilities
- **authorization.js**: Admin/user authorization

### Command Layer (`src/commands/`)
User-facing command handlers organized by function:
- **game/**: Game control commands (create, join, cancel, show)
- **info/**: Player information commands (balance, rank, status, leaderboard, help)
- **admin/**: Admin-specific commands (count, help, join, refresh, update)
- **main.js**: Default `!dice` command handler

### Jobs Layer (`src/jobs/`)
- **group.js**: Timer creation for game phases
- **active.js**: Inactive group cleanup

## Game Flow

1. **Joining Phase**: `!dice new [balance]` starts a game, players join with `!dice join`
2. **Guessing Phase**: Players guess dice rolls (1-50)
3. **Picking Phase**: Players pick opponents for PvP rounds
4. **Betting Phase**: Players place bets (multiples of 500, max 5000)
5. **Rolling Phase**: Players use roll command (localized), winners are determined
6. **Scoring**: Winners receive points, game ends when one player remains

## Key Design Patterns

### Multi-Account Support
The bot runs multiple accounts simultaneously:
- Accounts configured via `ACCOUNTS` env var (format: `email:password|email:password`)
- Each account gets its own DiceClient instance stored in a Map
- 500ms delay between account logins to prevent rate limiting

### Message Pattern
- All user-facing messages stored in `src/phrases/en.json` and `src/phrases/ar.json`
- MessageService handles phrase lookup and placeholder replacement
- Commands use `command.language` for proper localization

### Timer Integration
Uses WOLF client's timer system (`client.utility.timer`):
- Timers registered with unique IDs (`game-${channelId}`)
- `UpdateTimer` created in `jobs/group.js` and registered in `DiceClient.js`
- Phase timeouts handled via `node-schedule` for recurring tasks

## Environment Configuration

Required environment variables (`.env`):
```
ACCOUNTS=email1:password|email2:password  # Bot accounts (pipe-separated)
ROOT_USERNAME=                             # MongoDB root user
ROOT_PASSWORD=                             # MongoDB root password
ROOT_DATABASE=                             # MongoDB auth database
MONGO_USER=                                # MongoDB app user
MONGO_PWD=                                 # MongoDB app password
MONGO_DB_NAME=                             # Database name
```

## Code Conventions

- **ES Modules**: All files use `.js` extension with `import/export`
- **JSDoc**: Comprehensive documentation on all public methods with parameter types
- **Private Fields**: Use `#fieldName` for private class fields
- **Error Handling**: Methods return `{success: boolean, error?: string}` objects
- **Async/Await**: All database and I/O operations use async/await

## Important Files

- `src/config/default.yaml`: Bot configuration (keyword, language, developer ID, retry settings)
- `src/phrases/*.json`: Localized message templates with placeholder support
- `src/jobs/*.js`: Scheduled tasks (group cleanup, update timers)
- `src/index.js`: Module exports
- `src/main.js`: Application entry point

## WOLF.js Integration Notes

- Bot keyword: "dice" (configured in `src/config/default.yaml`)
- Commands registered hierarchically: `dice_default_command` → subcommands
- Command context provides: `sourceSubscriberId`, `targetChannelId`, `language`, `argument`
- Use `client.channel.sendMessage()` for group messages
- Use `client.messaging.subscription.nextMessage()` for polling private messages
