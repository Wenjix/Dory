# Dory - Agent Reference

For autonomous agents working on this codebase.

## Service Descriptions

### Gatekeeper Agent (`services/gatekeeper-agent/`)
- Entry point for users, routes to persona-builder or game-agent
- Personality: Ancient stone golem, brief and direct
- Tools: `fetchPopularPersonas`, `getPersonaDetails`, `changeMode`
- Uses conversation summarization on mode transitions

### Persona Builder Agent (`services/persona-builder-agent/`)
- Interactive persona creation through conversational flow
- Steps: Species → Visual Details → Name + Avatar → Personality → Gaming Style → Save
- All personas use `supercell` art style (no style selection step)
- Tools: `updateDraftPersona`, `generateAvatar`, `editAvatar`, `savePersona`, `playWithPersona`
- Persists conversations and drafts to MongoDB

### Game Agent (`services/game-agent/`)
- Minecraft bot with AI-driven behavior
- Uses persona data to play in-character
- A2A (Agent-to-Agent) communication

## Key Patterns

- **TypeScript ESM** — All services use `"type": "module"` with `.js` extensions in imports
- **Vercel AI SDK** — `streamText`/`generateText` with tool calling pattern
- **Groq** — Primary LLM via OpenAI-compatible API (`@ai-sdk/openai` with Groq base URL)
- **WebSocket** — Real-time communication, message types: `chat`, `persona_update`, `mode_change`, `error`
- **Session state** — In-memory Maps with periodic DB persistence
- **No auth** — `user-123` hardcoded everywhere, `isAuthenticated()` always returns `true`

## Coding Conventions

- Zod for environment validation
- Express for HTTP, `ws` for WebSocket
- Lazy-initialized clients (Groq, Gemini, R2)
- Fire-and-forget DB persistence (non-blocking)
- Console logging with `[Service]` prefixes

## Environment Variables

Each service has its own `.env`. See `.env.example` files.

Required across services:
- `GROQ_API_KEY` — All services
- `GEMINI_API_KEY` — Persona builder (image generation)
- `R2_*` — Persona builder (image storage)
- `DATABASE_URL` — Persona builder (MongoDB)
