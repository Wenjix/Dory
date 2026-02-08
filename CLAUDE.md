# Dory - AI Gaming Companion System

Dory is an AI gaming companion platform built for the Supercell hackathon. It lets users create custom AI personas and play games with them via voice.

## Architecture

Four-service pipeline:

```
Gatekeeper (4002) → Persona Builder (4003) → Voice Agent (4001) → Game Agent (3000)
```

- **Gatekeeper Agent** — Entry point. Routes users to create personas or play games. Stone golem personality.
- **Persona Builder Agent** — Interactive persona creation: species → visual details → name → avatar generation → personality → gaming style → voice selection → save.
- **Voice Agent** — LiveKit voice pipeline (VAD → STT → LLM → TTS). Loads persona personality + custom voiceId from persona-builder. Controls game agent via HTTP tools.
- **Game Agent** — Minecraft bot powered by AI. Uses persona data for in-character behavior.

Shared package `@dory/shared` provides conversation summarizer and common types.

## No Auth

All auth is stripped for hackathon speed. `user-123` is hardcoded everywhere. No JWT, no JWKS, no Redis.

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Gatekeeper | 4002 | `ws://localhost:4002/ws` |
| Persona Builder | 4003 | `ws://localhost:4003/ws` + `http://localhost:4003/api/personas/` |
| Voice Agent | 4001 | `http://localhost:4001` (LiveKit + Express) |
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
pnpm dev:voice
pnpm dev:game
```

## Voice Agent — Persona Integration

The voice agent supports custom personas via the `/api/room-token` endpoint:

- `POST /api/room-token {}` — Default Dory personality
- `POST /api/room-token { "personaId": "<id>" }` — Loads persona prompt + custom ElevenLabs voiceId
- `POST /api/room-token { "personaId": "<id>", "conversationSummary": "..." }` — Also injects prior conversation context

Persona loading flow:
1. `room-token.ts` passes `personaId` as dispatch metadata to LiveKit
2. `conversational-agent.ts` reads metadata, calls `personaClient.getPersonaSystemPrompt()`
3. persona-client fetches from persona-builder: first tries `/api/personas/:id/conversational-prompt` (pre-generated), falls back to `/api/personas/public/:id` (raw data → `persona-prompt-builder.ts` builds prompt)
4. If persona has a `voiceId`, TTS is updated via `tts.updateOptions({ voiceId })`
5. Memory context from game agent is appended regardless of persona

Key files:
- `src/clients/persona-client.ts` — HTTP client for persona-builder service
- `src/agent/persona-prompt-builder.ts` — Builds prompt from raw persona data (fallback). Uses Dory's full technical prompt as BASE, injects persona personality on top.
- `src/agent/prompt.ts` — Default Dory personality (used when no persona loaded)
- `src/agent/conversational-agent.ts` — Main agent with `buildSystemPrompt()` that orchestrates persona + memory + conversation summary

## Key Design Decisions

- **Groq LLM** via Vercel AI SDK (llama-3.3-70b-versatile for main, llama-3.1-8b-instant for fast tasks)
- **Gemini** for avatar image generation
- **Cloudflare R2** for image storage
- **ElevenLabs** for TTS with per-persona voice selection
- **MongoDB** via Prisma for persistence
- **WebSocket** for real-time agent communication (gatekeeper/persona-builder)
- **HTTP A2A** for voice-agent → game-agent communication (direct tool calls, not A2A SDK)
- All personas get `supercell` art style automatically (no style selection step)

## Monorepo Structure

```
packages/shared/                   @dory/shared (types, utils, conversation summarizer)
services/gatekeeper-agent/         @dory/gatekeeper-agent
services/persona-builder-agent/    @dory/persona-builder-agent
services/voice-agent/              @dory/voice-agent
services/game-agent/               @dory/game-agent
```

Uses pnpm workspaces + Turbo for builds.
