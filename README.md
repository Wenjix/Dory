# Dory - AI Gaming Companion System

> **Global AI Game Hack 2026** - An AI-powered gaming companion that plays with you through voice, performs in-game actions, has unique personalities, and generates structures in Minecraft.

## Work in Progress 🚧

Currently building the foundation...

## Overview

Dory is a multi-agent AI system that provides intelligent gaming companions with:
- 🎮 **In-game Actions** - Navigate, collect, craft, build, and more
- 🗣️ **Voice Interaction** - Natural conversation via speech-to-speech
- 🧠 **Personalities** - Distinct characters with unique traits and play styles
- 🏗️ **Structure Generation** - Create buildings from text descriptions
- 📊 **Dashboard** - Web interface for configuration and monitoring
- 🤖 **Multi-step Planning** - Execute complex tasks autonomously

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Dashboard     │◄────────┤   Voice Agent   │
│  (Frontend)     │         │   (Neocortex)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ WebSocket/HTTP            │ HTTP/A2A
         │                           │
         └───────────┬───────────────┘
                     ▼
            ┌────────────────┐
            │   Game Agent   │
            │  (Mineflayer)  │
            └───────┬────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌──────────────┐
    │ Tools  │ │Planning│ │Structure Gen │
    │Registry│ │ Engine │ │  (Mistral)   │
    └────────┘ └────────┘ └──────────────┘
```

## Monorepo Structure

```
dory/
├── services/
│   ├── game-agent/      # Minecraft bot + AI reasoning
│   ├── voice-agent/     # Voice interaction service
│   ├── structure-gen/   # Structure generation service
│   └── dashboard/       # React frontend
├── packages/
│   └── shared/          # Common types & utilities
└── package.json         # Root workspace config
```

## Tech Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Runtime:** Node.js 20+ with TypeScript
- **Game Bot:** mineflayer (Minecraft bot framework)
- **LLM:** Mistral AI Large 3 (reasoning & tool calling)
- **Voice:** Neocortex (STT + TTS via ElevenLabs backend)
- **Structure Gen:** LLM code generation → JavaScript → Block placement
- **Database:** MongoDB (sessions, messages, memory, embeddings)
- **Frontend:** Next.js 14 + React 18

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- MongoDB (local or Atlas free tier)
- Minecraft Java Edition server (1.20+)
- API keys (Mistral, Neocortex)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd dory

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
```

### Development

```bash
# Start all services
pnpm dev

# Start individual packages
pnpm --filter game-agent dev
pnpm --filter voice-agent dev
pnpm --filter dashboard dev
pnpm --filter structure-gen dev

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Configuration

### Environment Variables

```bash
# Minecraft Server
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565
MINECRAFT_USERNAME=DoryBot

# Mistral AI
MISTRAL_API_KEY=your-key-here

# Neocortex
NEOCORTEX_API_KEY=your-key-here
NEOCORTEX_CHARACTER_ID=your-character-id

# Database
DATABASE_PATH=./data/dory.db

# Ports
GAME_AGENT_PORT=3000
VOICE_AGENT_PORT=4001
DASHBOARD_PORT=5001
STRUCTURE_GEN_PORT=8000
```

### Redeem Hackathon Credits

1. **Mistral AI** ($15):
   - Visit: https://mistral-credits-app-production.up.railway.app/h/supercell-game-hack/
   - Password: `GamingHack`

2. **Neocortex** (2000 credits):
   - Go to Settings > Redeem Code
   - Enter code: `AIGAMEHACK2026`

## Usage

### API Endpoints (Game Agent)

```bash
# Create a new bot session
POST /api/sessions
{
  "serverHost": "localhost",
  "serverPort": 25565,
  "botName": "DoryBot",
  "personality": "builder"
}

# Send a message to the bot
POST /api/sessions/:id/message
{
  "message": "Follow me and collect some wood"
}

# Get session status
GET /api/sessions/:id

# Disconnect bot
DELETE /api/sessions/:id

# Subscribe to events (SSE)
GET /api/sessions/:id/events
```

### Example Interactions

```javascript
// Simple commands (direct tool calling)
"Follow me"
"Stop following"
"Collect 10 oak logs"
"Come to me"

// Complex tasks (planning engine)
"Gather wood and craft me a crafting table"
"Build a small wooden house here"
"Find some iron and make me a pickaxe"

// Structure generation
"Generate a medieval tower and build it here"
"Create a statue of a dragon"
"Build me a simple bridge across this gap"
```

## Personalities

Pre-configured personality types:

- **Builder Bob** 🏗️ - Methodical, patient, loves construction projects
- **Explorer Emma** 🧭 - Adventurous, curious, always moving
- **Combat Carl** ⚔️ - Aggressive, protective, tactical fighter
- **Helper Holly** 💖 - Supportive, cheerful, always encouraging

Custom personalities can be created via the dashboard.

## Features

### ✅ Core Features (MVP)
- [x] Minecraft bot connection and control
- [x] Natural language command processing
- [x] Basic actions (move, collect, craft, build)
- [x] Personality system
- [x] Voice interaction
- [x] Web dashboard

### 🚧 In Progress
- [ ] Multi-step task planning
- [ ] Structure generation
- [ ] Advanced error recovery
- [ ] Learning system

### 🎯 Planned
- [ ] Multi-agent coordination
- [ ] World generation (Reactor API)
- [ ] Animated avatars (X&Immersion)
- [ ] 3D asset generation (Hyper3D)
- [ ] User profiles and preferences

## Development

### Adding a New Tool

```typescript
// packages/game-agent/src/tools/registry.ts
{
  type: "function",
  function: {
    name: "your_tool_name",
    description: "What this tool does",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "Parameter description" }
      },
      required: ["param1"]
    }
  }
}

// packages/game-agent/src/tools/executor.ts
case 'your_tool_name':
  return await yourToolHandler(bot, params);
```

### Adding a New Personality

```typescript
// packages/game-agent/src/personalities/types.ts
export const personalities = {
  your_personality: {
    name: "Your Name",
    traits: ["trait1", "trait2"],
    communicationStyle: "How they speak",
    playStyle: "How they play",
    systemPrompt: "Additional LLM instructions"
  }
}
```

### Project Structure Patterns

Following patterns from readyplayerx:
- **Bot Wrapper**: High-level API around mineflayer
- **Action Helpers**: Reusable low-level utilities
- **Tool Registry**: LLM-discoverable function calling
- **Event Bus**: Pub/sub for game events
- **Planning Engine**: Multi-step task orchestration
- **Session Isolation**: One bot instance per session

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter game-agent test

# Integration tests
pnpm test:integration

# Watch mode
pnpm test:watch
```

## Deployment

```bash
# Build for production
pnpm build

# Start production services
pnpm start

# Docker (future)
docker-compose up
```

## Troubleshooting

### Bot can't connect to Minecraft server
- Check server is running and accessible
- Verify `MINECRAFT_HOST` and `MINECRAFT_PORT`
- Ensure bot username is not already online
- Check authentication mode (offline vs Microsoft)

### Voice commands not working
- Verify Neocortex API key is valid
- Check Neocortex character is configured
- Ensure voice-agent service is running
- Test with text commands first

### Structure generation fails
- Check Mistral API credits
- Verify prompt is clear and specific
- Ensure bot has sufficient materials
- Check for obstructions at placement location

### LLM not calling tools
- Verify tool registry format is correct
- Check LLM system prompt includes tool instructions
- Ensure tool descriptions are clear
- Try simpler commands first

## Contributing

1. Create a feature branch
2. Make changes with clear commits
3. Test thoroughly
4. Submit pull request

## License

MIT License - see LICENSE file

## Acknowledgments

- **Supercell** - Hosting Global AI Game Hack 2026
- **Mistral AI** - LLM API and hackathon credits
- **Neocortex** - Voice NPC platform and credits
- **PrismarineJS** - Mineflayer framework
- **readyplayerx** - Architecture inspiration

## Contact & Support

- Discord: Check hackathon channels (#neocortex, #mistral)
- Issues: GitHub Issues
- Docs: See `/docs` folder

---

Built with ❤️ for Global AI Game Hack 2026
