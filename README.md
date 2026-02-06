# Dory - AI Gaming Companion

> **Global AI Game Hack 2026** — An AI companion that plays Minecraft with you through voice, performs in-game actions, plans multi-step tasks, and builds structures.

## What It Does

Talk to Dory through voice and she will control a Minecraft bot for you:

- **Voice conversation** — speak naturally, Dory listens and responds via speech
- **In-game actions** — follow, collect resources, craft items, build structures
- **Multi-step planning** — "gather wood and craft me a crafting table" just works
- **Building** — walls, pillars, floors placed where you're looking
- **A2A architecture** — voice agent talks to game agent over HTTP for clean separation

## Architecture

```
                    Voice (WebRTC)
  Player ◄───────────────────────────► Voice Agent (LiveKit)
                                            │
                                            │ HTTP / A2A
                                            ▼
                                       Game Agent
                                       (Express + LLM)
                                            │
                                      ┌─────┼─────┐
                                      ▼     ▼     ▼
                                   Tools  Planning  Bot
                                            │
                                            ▼
                                     Minecraft Server
```

| Service | Port | Description |
|---------|------|-------------|
| `game-agent` | 3000 | Minecraft bot control, LLM reasoning, tool execution |
| `voice-agent` | 4001 | LiveKit voice pipeline (STT → LLM → TTS), A2A tools |

## Prerequisites

- **Node.js 20+**
- **pnpm 8+** — `npm install -g pnpm`
- **Minecraft Java Edition** server running (1.20+)
- **LiveKit Cloud** account (free) — [livekit.io](https://livekit.io)
- **API keys** for: LLM provider, Deepgram (STT), ElevenLabs (TTS)

## Quick Start

### 1. Install dependencies

```bash
git clone <repo-url>
cd dory
pnpm install
```

### 2. Configure environment

Each service has its own `.env`. Copy the examples and fill in your keys:

```bash
cp services/game-agent/.env.example services/game-agent/.env
cp services/voice-agent/.env.example services/voice-agent/.env
```

**Game Agent** (`services/game-agent/.env`):
```bash
GAME_AGENT_PORT=3000

# LLM — pick one provider: mistral, openai, or anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-...

# Optional: set a specific model
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
# OPENAI_MODEL=gpt-4o
# MISTRAL_MODEL=mistral-large-latest
```

**Voice Agent** (`services/voice-agent/.env`):
```bash
PORT=4001

# LiveKit (required)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# STT — Deepgram
DEEPGRAM_API_KEY=...

# TTS — ElevenLabs
ELEVEN_API_KEY=...

# LLM for voice conversation (OpenAI-compatible)
LLM_API_KEY=...
LLM_BASE_URL=https://api.groq.com/openai/v1  # or https://api.openai.com/v1
LLM_MODEL=llama-3.3-70b-versatile

# Game Agent URL (A2A)
GAME_AGENT_URL=http://localhost:3000
```

### 3. Start everything

```bash
# Start all services (builds shared package, then starts game-agent + voice-agent)
pnpm dev
```

Or start services individually:

```bash
pnpm dev:game    # Game agent only (port 3000)
pnpm dev:voice   # Voice agent only (port 4001)
```

### 4. Connect & play

1. **Start your Minecraft server** (Java Edition, offline mode recommended for testing)

2. **Create a bot session** — either via the test console or voice:
   - Open `http://localhost:3000/` and use the test console (`services/game-agent/test-console.html`)
   - Or open the voice test page (`services/voice-agent/test-voice.html`) and say "join the game"

3. **Talk to Dory** — open `services/voice-agent/test-voice.html`, connect, and start speaking:
   - "Follow me"
   - "Collect some wood"
   - "Craft a crafting table"
   - "Build a pillar where I'm looking"

4. **Text commands** — you can also use the WebSocket console at `ws://localhost:3000/ws`:
   ```
   ask <sessionId> collect 5 oak logs
   ask <sessionId> build a cobblestone wall here
   ```

## Project Structure

```
dory/
├── services/
│   ├── game-agent/          # Minecraft bot + LLM reasoning
│   │   ├── src/
│   │   │   ├── a2a/         # Agent card + A2A message handler
│   │   │   ├── actions/     # Building, vision, helpers
│   │   │   ├── agent/       # Message handler, system prompt
│   │   │   ├── bot/         # Bot wrapper + manager
│   │   │   ├── llm/         # Provider-agnostic LLM client
│   │   │   ├── planning/    # Multi-step plan engine
│   │   │   └── tools/       # Tool registry + executor
│   │   └── test-console.html
│   └── voice-agent/         # Voice conversation + A2A bridge
│       ├── src/
│       │   ├── agent/       # LiveKit conversational agent
│       │   ├── routes/      # Room token endpoint
│       │   └── tools/       # Game agent HTTP tools
│       └── test-voice.html
├── packages/
│   └── shared/              # Common types, logger, utilities
├── turbo.json               # Turborepo task config
├── pnpm-workspace.yaml      # Workspace definition
└── package.json             # Root scripts
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services (game-agent + voice-agent) |
| `pnpm dev:game` | Start game agent only |
| `pnpm dev:voice` | Start voice agent only |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm clean` | Remove all dist/ and node_modules |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Runtime | Node.js 20+ / TypeScript |
| Game bot | mineflayer + pathfinder + collectblock |
| LLM (game) | Anthropic Claude / OpenAI / Mistral (switchable) |
| LLM (voice) | Any OpenAI-compatible API (Groq, OpenAI, etc.) |
| Voice | LiveKit Agents SDK |
| STT | Deepgram Nova 3 |
| TTS | ElevenLabs |
| VAD | Silero |
| A2A | HTTP REST (agent cards + JSON) |

## API Endpoints

### Game Agent (port 3000)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/.well-known/agent-card.json` | Agent card (A2A discovery) |
| POST | `/api/sessions` | Create bot session |
| GET | `/api/sessions` | List active sessions |
| GET | `/api/sessions/:id` | Get session info |
| DELETE | `/api/sessions/:id` | Disconnect bot |
| POST | `/api/sessions/:id/message` | Send message (LLM reasoning) |
| POST | `/api/a2a/message` | A2A: receive command from voice agent |
| GET | `/api/a2a/sessions` | A2A: list sessions with details |
| WS | `/ws` | WebSocket interactive console |

### Voice Agent (port 4001)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/room-token` | Generate LiveKit room token |

## Troubleshooting

### "pnpm dev" fails with build errors
```bash
# Rebuild the shared package first
pnpm build:shared
# Then retry
pnpm dev
```

### Bot can't connect to Minecraft
- Make sure your Minecraft server is running and set to offline mode
- Default config is `localhost:25565` — adjust in the create session call if different
- Check the bot username isn't already online

### Voice agent connects but doesn't hear me
- Verify `DEEPGRAM_API_KEY` and `ELEVEN_API_KEY` are set
- Make sure your browser has microphone permissions
- Check browser console for WebRTC errors

### Game commands from voice return "no active bot session"
- Create a bot session first (via test console or say "join the game")
- Verify game-agent is running on port 3000
- Check `GAME_AGENT_URL` in voice-agent `.env`

## License

MIT

---

Built for Global AI Game Hack 2026
