# @dory/game-agent

Minecraft bot service with AI reasoning and tool execution.

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

## Endpoints

- `GET /health` - Health check
- `GET /api` - Service info
- `POST /api/sessions` - Create bot session (coming soon)

## Configuration

See `.env.example` for available environment variables.
