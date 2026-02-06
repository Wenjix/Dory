# @dory/game-agent

Minecraft bot service with AI reasoning and tool execution.

## Features

- ✅ Bot connection management (session-based)
- ✅ Pathfinding and navigation
- ✅ Resource collection
- ✅ Crafting system
- ✅ Building (pillars, walls, floors, roofs)
- ✅ Vision system (raycast, "what am I looking at")
- ✅ Inventory management
- ✅ Chest interactions

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Edit .env with your Minecraft server details

# Run in development
pnpm dev
```

## API Endpoints

### Sessions
- `POST /api/sessions` - Create bot session and connect
- `GET /api/sessions` - List all active sessions
- `GET /api/sessions/:sessionId` - Get session info
- `DELETE /api/sessions/:sessionId` - Disconnect bot

### Health
- `GET /health` - Service health check
- `GET /api` - API information

## Action Helpers

Available in `src/actions/`:

**helpers.ts:**
- `goToPosition()` - Navigate to coordinates
- `equipItem()` - Equip item from inventory
- `craftItem()` - Craft items with recipes
- `placeBlock()` - Place block at position
- `breakBlock()` - Break block at position
- `storeItemInChest()` - Store items in nearby chest
- `getItemFromChest()` - Retrieve items from chest
- `eatFood()` - Eat food from inventory
- `hasItem()` - Check inventory for items

**vision.ts:**
- `getBlockLookingAt()` - Raycast to find target block
- `getEntityLookingAt()` - Find entity in crosshair
- `describeTarget()` - Describe what bot sees
- `scanArea()` - Scan visible blocks and entities
- `getVisiblePlayers()` - List nearby players

**building.ts:**
- `buildPillar()` - Build vertical pillar
- `buildWall()` - Build wall (length x height)
- `buildFloor()` - Build horizontal platform
- `buildRoof()` - Build roof at height

## Configuration

See `.env.example` for available environment variables.
