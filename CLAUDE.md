# Dory - AI Gaming Companion System

Dory is an AI gaming companion platform built for the Supercell hackathon. It lets users create custom AI personas and play games with them.

## Architecture

Three-service pipeline connected via WebSocket:

```
Gatekeeper (4002) → Persona Builder (4003) → Game Agent (3000)
```

- **Gatekeeper Agent** — Entry point. Routes users to create personas or play games. Stone golem personality.
- **Persona Builder Agent** — Interactive persona creation: species → visual details → name → avatar generation → personality → gaming style → save.
- **Game Agent** — Minecraft bot powered by AI. Uses persona data for in-character behavior.

Shared package `@dory/shared` provides conversation summarizer and common types.

## No Auth

All auth is stripped for hackathon speed. `user-123` is hardcoded everywhere. No JWT, no JWKS, no Redis.

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Gatekeeper | 4002 | `ws://localhost:4002/ws` |
| Persona Builder | 4003 | `ws://localhost:4003/ws` |
| Game Agent | 3000 | `http://localhost:3000` |
| MongoDB | 27017 | `mongodb://localhost:27017/dory` |

## How to Run

```bash
# Install dependencies
pnpm install

# Start MongoDB
docker-compose up -d

# Push Prisma schema
cd services/persona-builder-agent && npx prisma db push && cd ../..

# Run individual services
pnpm dev:gatekeeper
pnpm dev:persona
pnpm dev:game
```

## Key Design Decisions

- **Groq LLM** via Vercel AI SDK (llama-3.3-70b-versatile for main, llama-3.1-8b-instant for fast tasks)
- **Gemini** for avatar image generation
- **Cloudflare R2** for image storage
- **ElevenLabs** for voice matching (optional)
- **MongoDB** via Prisma for persistence
- **WebSocket** for real-time agent communication
- All personas get `supercell` art style automatically (no style selection step)

## Monorepo Structure

```
packages/shared/        @dory/shared (types, utils, conversation summarizer)
services/gatekeeper-agent/    @dory/gatekeeper-agent
services/persona-builder-agent/  @dory/persona-builder-agent
services/game-agent/    @dory/game-agent
```

Uses pnpm workspaces + Turbo for builds.
