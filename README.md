# Dory — AI Gaming Companion for Minecraft

> **Let AI companions superpower your players' experience.**
> Integrate an AI game companion with voice, memory, and in-game agency — in just a few steps.

Built for **Global AI Game Hack 2026**.

---

## What is Dory?

Dory is an open-source AI companion that lives inside your Minecraft world. Players talk to Dory with their voice, and she listens, thinks, remembers, and acts — collecting resources, crafting items, building structures, and holding a natural conversation the whole time.

Under the hood, Dory is a **two-agent system** connected by a lightweight Agent-to-Agent (A2A) protocol. This architecture cleanly separates *how the player communicates* (voice) from *what happens in the game* (bot actions), making it straightforward to swap out components, add new games, or integrate into existing projects.

### Key Features

- **Voice Conversation** — Talk naturally using your microphone. Dory listens (Deepgram STT), thinks (LLM), and speaks back (ElevenLabs TTS) in real time via LiveKit.
- **In-Game Actions** — Follow players, collect resources, craft items, manage inventory, fight mobs, and navigate the world using 30+ tool-calling capabilities.
- **Multi-Step Planning** — Complex requests like *"gather wood, craft planks, and make me a crafting table"* are automatically broken into a plan and executed step by step.
- **AI Structure Generation** — Say *"build me a medieval castle"* and watch it materialize block by block. An LLM generates JavaScript build code, a sandbox executes it, and blocks are placed progressively in the live world.
- **Persistent Memory** — Dory remembers your preferences, past conversations, and goals across sessions using MongoDB-backed episodic, semantic, and procedural memory.
- **Event-Driven Awareness** — Game events (damage, player joins, task completion) are prioritized and forwarded to the voice agent. Dory reacts to critical events immediately — if she takes fatal damage, she'll tell you about it mid-sentence.
- **A2A Protocol** — Voice and game agents communicate over simple HTTP REST. Clean separation means you can replace either agent, add new ones, or integrate the game agent with a different interface (text chat, Discord bot, web UI).

---

## Architecture

```
                     Voice (WebRTC / LiveKit)
  Player  <───────────────────────────────────>  Voice Agent
  (Mic + Speaker)                                  (Port 4001)
                                                      │
                                                      │  HTTP / A2A Protocol
                                                      ▼
                                                  Game Agent
                                                  (Port 3000)
                                                      │
                                              ┌───────┼───────┐
                                              ▼       ▼       ▼
                                           Tools   Planning   Memory
                                              │                 │
                                              ▼                 ▼
                                       Minecraft Server      MongoDB
```

| Service | Port | Role |
|---------|------|------|
| **Voice Agent** | 4001 | LiveKit voice pipeline (VAD → STT → LLM → TTS), game-event narration, conversation memory sync |
| **Game Agent** | 3000 | Minecraft bot control via mineflayer, LLM reasoning with tool calling, multi-step planning, AI structure generation, persistent memory |
| **Shared** | — | Common types, logger, utilities (`@dory/shared`) |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js 20+** | Runtime for both services |
| **pnpm 8+** | `npm install -g pnpm` |
| **Docker** | For local MongoDB (memory system) |
| **Minecraft Java Edition** | Server running locally or remotely (1.20+) |
| **LiveKit Cloud** | Free account at [livekit.io](https://livekit.io) |
| **API Keys** | LLM provider, Deepgram (STT), ElevenLabs (TTS) |

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/dory.git
cd dory
pnpm install
```

### 2. Configure environment

Each service has its own `.env`. Copy the examples:

```bash
cp services/game-agent/.env.example services/game-agent/.env
cp services/voice-agent/.env.example services/voice-agent/.env
```

#### Game Agent (`services/game-agent/.env`)

```bash
GAME_AGENT_PORT=3000

# Minecraft server
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
MINECRAFT_AUTH_MODE=offline

# LLM — pick one provider: mistral, openai, or anthropic
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# MongoDB (memory system)
MONGODB_URI=mongodb://localhost:27017/dory

# AI Structure Builder (optional but recommended)
# Uses a separate, more capable model for generating build code
BUILDER_LLM_PROVIDER=openai
BUILDER_LLM_MODEL=gpt-4o
```

#### Voice Agent (`services/voice-agent/.env`)

```bash
PORT=4001

# LiveKit (required)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

# Deepgram STT
DEEPGRAM_API_KEY=...

# ElevenLabs TTS
ELEVEN_API_KEY=...

# LLM for voice conversation (must support OpenAI-compatible function calling)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# Game Agent URL (A2A connection)
GAME_AGENT_URL=http://localhost:3000
```

> **Tip — Budget-friendly voice LLM:** You can use Groq with Qwen for the voice agent's LLM at no cost:
> ```bash
> LLM_API_KEY=gsk_...
> LLM_BASE_URL=https://api.groq.com/openai/v1
> LLM_MODEL=qwen/qwen3-32b
> ```
> Avoid llama models on Groq — they don't call tools reliably.

### 3. Start MongoDB

Make sure **Docker Desktop** is running:

```bash
docker compose up -d
```

Verify it's running:

```bash
docker ps   # should show "dory-mongo" container
```

> Memory is optional — the bot works without it, but you won't get session summaries or player profiles.

### 4. Start everything

```bash
pnpm dev
```

This builds the shared package, then starts both services with hot-reload via Turborepo.

Or start services individually:

```bash
pnpm dev:game    # Game agent only (port 3000)
pnpm dev:voice   # Voice agent only (port 4001)
```

### 5. Connect and play

1. **Start your Minecraft server** — Java Edition, offline mode recommended for local testing.

2. **Open the voice test page** at `services/voice-agent/test-voice.html` in your browser and click Connect.

3. **Talk to Dory:**
   - *"Join the game"* — connects the bot to Minecraft
   - *"Follow me"* — bot follows your player
   - *"Collect some oak wood"* — gathers resources
   - *"Craft a crafting table"* — crafts items
   - *"Build a pillar where I'm looking"* — places blocks at your crosshair
   - *"Build me a medieval castle"* — AI generates and places the structure block by block

4. **Alternative interfaces:**
   - **Text console** — open `services/game-agent/test-console.html` for a browser-based chat
   - **WebSocket** — connect to `ws://localhost:3000/ws` for a raw command interface
   - **Memory dashboard** — open `services/game-agent/test-memory.html` to inspect stored memories, summaries, and player profile in real time

> **Important for AI structure generation:** The bot must have operator permissions in the Minecraft server. Run `/op <bot_username>` in the server console before asking Dory to generate structures.

---

## Capabilities

### Voice Agent

| Capability | Description |
|------------|-------------|
| Voice pipeline | Silero VAD → Deepgram Nova 3 STT → LLM → ElevenLabs TTS |
| Real-time events | Critical game events (death, low health) interrupt Dory mid-sentence |
| Event narration | High/medium events injected into LLM context before each turn |
| Memory sync | Conversation history sent to game agent every 60s for preference extraction |
| Tool calling | LLM uses function calling to control the game agent over HTTP |

### Game Agent

| Category | Tools |
|----------|-------|
| **Movement** | `follow_player`, `come_to_me`, `go_to_position`, `stop` |
| **Collection** | `collect_resource`, `break_block` |
| **Inventory** | `get_inventory`, `has_item`, `equip_item`, `craft_item`, `drop_item`, `eat_food` |
| **Storage** | `store_in_chest`, `get_from_chest`, `list_chest_contents` |
| **Building** | `place_block`, `build_pillar`, `build_wall`, `build_floor` |
| **Player POV** | `place_block_where_player_looking`, `build_pillar_where_player_looking`, `build_wall_where_player_looking` |
| **AI Generation** | `generate_structure`, `cancel_structure` |
| **Vision** | `what_am_i_looking_at`, `what_is_player_looking_at`, `scan_area` |
| **Social** | `get_position`, `get_nearby_players`, `send_chat` |

### Memory System

| Type | What it stores |
|------|---------------|
| **Episodic** | Events — deaths, tasks, structures built, combat encounters |
| **Semantic** | Knowledge — player preferences, personality traits, goals |
| **Procedural** | Patterns — success rates, common actions |
| **Summaries** | LLM-generated session summaries and player profiles |

### AI Structure Generation

The builder module generates Minecraft structures from natural language:

1. Player says *"build me a house"*
2. Voice agent forwards the command to the game agent
3. Game agent calculates a build position (in front of the player, snapped to ground)
4. A dedicated LLM generates JavaScript build code using `safeSetBlock` / `safeFill` helpers
5. Code executes in a Node.js `vm` sandbox — no world modifications, just a list of block placements
6. Blocks are placed progressively via `/setblock` commands with configurable delays
7. On completion, a critical event fires and Dory announces *"Your structure is finished!"*

Supports cancellation mid-build (*"stop building"*), hollow/walkable interiors, and validates all blocks against a comprehensive block ID list.

---

## Project Structure

```
dory/
├── package.json                # Root scripts (pnpm dev, build, etc.)
├── turbo.json                  # Turborepo task configuration
├── pnpm-workspace.yaml         # Workspace definition
├── docker-compose.yml          # MongoDB service
│
├── packages/
│   └── shared/                 # @dory/shared — types, logger, utilities
│       └── src/
│           ├── types/          # Session, Minecraft, Agent interfaces
│           └── utils/          # Logger, sleep, retry helpers
│
└── services/
    ├── game-agent/             # @dory/game-agent
    │   └── src/
    │       ├── a2a/            # Agent card + A2A message handler
    │       ├── actions/        # Building, vision, movement, helpers
    │       ├── agent/          # Message handler + system prompt
    │       ├── bot/            # Mineflayer bot wrapper + session manager
    │       ├── builder/        # AI structure generation (LLM → sandbox → placer)
    │       ├── events/         # Event bus, Minecraft listener, A2A forwarder
    │       ├── llm/            # Multi-provider LLM client (OpenAI/Anthropic/Mistral)
    │       ├── memory/         # MongoDB memory system (episodic/semantic/procedural)
    │       ├── planning/       # Multi-step plan engine
    │       └── tools/          # Tool registry (30+ tools) + executor
    │
    └── voice-agent/            # @dory/voice-agent
        └── src/
            ├── agent/          # LiveKit conversational agent + personality prompt
            ├── events/         # Event store + fetcher (polls game events)
            ├── routes/         # Room token generation
            ├── services/       # Context service (memory sync)
            ├── tools/          # HTTP tools for game agent control
            └── utils/          # Logger
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services with hot-reload |
| `pnpm dev:game` | Start game agent only |
| `pnpm dev:voice` | Start voice agent only |
| `pnpm build` | Build all packages |
| `pnpm build:shared` | Build shared package only |
| `pnpm typecheck` | Run TypeScript type checks |
| `pnpm clean` | Remove all dist/ and node_modules |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Runtime | Node.js 20+ / TypeScript |
| Minecraft bot | mineflayer + pathfinder + collectblock + pvp |
| LLM (game reasoning) | OpenAI / Anthropic / Mistral (switchable) |
| LLM (voice) | Any OpenAI-compatible API (GPT-4o-mini, Groq, etc.) |
| LLM (builder) | Configurable — recommended: GPT-4o or higher for spatial code generation |
| Voice framework | LiveKit Agents SDK |
| Speech-to-Text | Deepgram Nova 3 |
| Text-to-Speech | ElevenLabs Flash v2.5 |
| Voice Activity | Silero VAD |
| Agent protocol | HTTP REST (A2A with agent cards) |
| Memory | MongoDB 7 (Docker) |
| Code sandbox | Node.js `vm` module |

---

## API Reference

### Game Agent — `http://localhost:3000`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/.well-known/agent-card.json` | Agent card (A2A discovery) |
| `POST` | `/api/sessions` | Create bot session |
| `GET` | `/api/sessions` | List active sessions |
| `GET` | `/api/sessions/:id` | Get session info |
| `DELETE` | `/api/sessions/:id` | Disconnect bot |
| `POST` | `/api/sessions/:id/message` | Send message (triggers LLM reasoning) |
| `POST` | `/api/a2a/message` | A2A: receive command from voice agent |
| `GET` | `/api/a2a/sessions` | A2A: list sessions with details |
| `GET` | `/api/memory/stats/:userId` | Memory stats (counts by type) |
| `GET` | `/api/memory/profile/:userId` | Player profile |
| `GET` | `/api/memory/system-context/:userId` | Full text context for prompt enrichment |
| `GET` | `/api/memory/memories?userId=X` | List memories (filter by type, tags) |
| `GET` | `/api/memory/summaries?userId=X` | List summaries (filter by type) |
| `POST` | `/api/memory/context` | Receive conversation context from voice agent |
| `POST` | `/api/memory/session-end` | Trigger session-end summary generation |
| `WS` | `/ws` | WebSocket interactive console |

### Voice Agent — `http://localhost:4001`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/room-token` | Generate LiveKit room token |
| `POST` | `/api/events` | Receive game events from game agent |
| `GET` | `/api/events` | Poll unannounced events (used by agent worker) |
| `POST` | `/api/events/ack` | Mark events as announced |

---

## Troubleshooting

### `pnpm dev` fails with build errors

```bash
pnpm build:shared   # Rebuild shared package first
pnpm dev             # Then retry
```

### Bot can't connect to Minecraft

- Verify your Minecraft server is running and set to **offline mode** (`online-mode=false` in `server.properties`)
- Default config is `localhost:25565` — adjust in the session creation call if different
- Make sure the bot username isn't already online

### Voice agent connects but doesn't hear me

- Verify `DEEPGRAM_API_KEY` and `ELEVEN_API_KEY` are set in `services/voice-agent/.env`
- Make sure your browser has granted microphone permissions
- Check the browser console for WebRTC errors

### Game commands from voice return "no active bot session"

- Create a bot session first — say *"join the game"* or use the test console
- Verify game agent is running on port 3000
- Check `GAME_AGENT_URL=http://localhost:3000` in voice agent `.env`

### AI structure generation fails

- Make sure the bot has operator permissions: run `/op <bot_username>` in the Minecraft server console
- If using GPT-5 or o-series models, the provider automatically uses `max_completion_tokens` instead of `max_tokens`
- Check that `OPENAI_API_KEY` is set (required even if your main LLM provider is Mistral/Anthropic, if you use OpenAI for the builder)

### MongoDB / memory not working

- Make sure Docker Desktop is running, then `docker compose up -d`
- Check with `docker ps` — you should see `dory-mongo`
- Verify `MONGODB_URI=mongodb://localhost:27017/dory` in `services/game-agent/.env`
- Memory is **optional** — the bot works without it, you just won't get session summaries or player profiles

### Voice agent crashes with "mutex lock failed"

- Known issue with Silero VAD native runtime during worker shutdown
- Usually harmless — the worker restarts automatically
- If it persists, restart with `pnpm dev:voice`

---

## For Game Developers

Dory's architecture is designed to be modular and extensible:

- **Add new tools** — Define a tool in `tools/registry.ts`, implement it in `tools/executor.ts`. The LLM discovers tools automatically via function calling.
- **Swap LLM providers** — Change `LLM_PROVIDER` in `.env`. OpenAI, Anthropic, and Mistral work out of the box. Add new providers by implementing the `LLMProvider` interface.
- **Change the voice** — Swap `TTS_VOICE_ID` in the voice agent config, or replace ElevenLabs with another TTS provider.
- **Replace the game** — The A2A protocol is game-agnostic. Replace the mineflayer bot with any game's API and the voice agent still works.
- **Add memory types** — Extend the memory system with new document types in `memory/types.ts`.

The A2A protocol between agents is simple HTTP JSON — no proprietary SDKs or complex integrations required.

---

## License

MIT

---

Built for **Global AI Game Hack 2026**
