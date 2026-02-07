# Testing the Game Event System

## Overview

The event system flows: **Minecraft → Event Bus → A2A Forwarder → Voice Agent → Dory speaks**

Priority levels:
| Priority | Behavior | Example |
|----------|----------|---------|
| **critical** | Interrupts Dory mid-speech, speaks immediately | Bot died, health critical |
| **high** | Injected into next LLM call when player speaks | Task completed, structure built |
| **medium** | Same as high, bundled as context | Player joined, hostile mob nearby |
| **low** | Stored silently (resource collection batched) | Collected 3x oak_log |

---

## 1. Manual Testing (curl to voice agent)

No game agent needed — POST directly to the voice agent's event endpoint.

### Prerequisites
- Voice agent running on `http://localhost:4001`
- A voice call active with Dory (open `test-voice.html`)

### Critical Event (should interrupt immediately)
```bash
curl -X POST http://localhost:4001/api/events \
  -H "Content-Type: application/json" \
  -d '{"priority": "critical", "message": "The bot died at (100, 64, -50)!"}'
```
**Expected:** Dory interrupts within ~2 seconds and says something urgent like "Oh no, I just died!"

### High Priority Event (acknowledged on next turn)
```bash
curl -X POST http://localhost:4001/api/events \
  -H "Content-Type: application/json" \
  -d '{"priority": "high", "message": "Task completed: collected 5 oak logs"}'
```
**Expected:** Next time you speak to Dory, she mentions the oak logs before answering your question.

### Medium Priority Event
```bash
curl -X POST http://localhost:4001/api/events \
  -H "Content-Type: application/json" \
  -d '{"priority": "medium", "message": "Player Steve joined the game"}'
```
**Expected:** Same as high — mentioned in next response.

### Low Priority Event
```bash
curl -X POST http://localhost:4001/api/events \
  -H "Content-Type: application/json" \
  -d '{"priority": "low", "message": "Collected 3x oak_log, 2x dirt"}'
```
**Expected:** Stored silently. Dory won't mention it unless asked.

### Check Pending Events
```bash
curl -s http://localhost:4001/api/events | python3 -m json.tool
```

### Acknowledge All Events
```bash
curl -X POST http://localhost:4001/api/events/ack \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Acknowledge by Priority
```bash
curl -X POST http://localhost:4001/api/events/ack \
  -H "Content-Type: application/json" \
  -d '{"priorities": ["high", "medium"]}'
```

---

## 2. End-to-End Testing (both services)

### Prerequisites
- Both services running (`pnpm dev` from monorepo root)
- Minecraft server running on `localhost:25565`
- Voice call active with Dory

### Test Steps

1. **Connect the bot** — say "Join the game" to Dory
2. **Trigger damage** — hit the bot in Minecraft
   - Medium damage → injected at next turn
   - Low health (≤ 3 hearts) → critical, interrupts Dory
3. **Kill the bot** — critical event, Dory should interrupt immediately
4. **Player join/leave** — have another player join the server
5. **Collect resources** — say "collect 5 oak wood"
   - Resource events are batched (5-second window) and sent as summary
6. **Build something** — say "build a 3 block pillar"
   - Structure built event fires as high priority

### What to Look For in Logs

**Game agent logs:**
```
[EventBus] minecraft:damage [session-id]
[A2AEventForwarder] [CRITICAL] → voice-agent: Bot took 5.0 damage! Health: 3.0/20
[A2AEventForwarder] [RESOURCE BATCH] Collected 5x oak_log (over 4s)
```

**Voice agent logs:**
```
[Events] Received [CRITICAL]: Bot took 5.0 damage! Health: 3.0/20
[Agent] 🚨 CRITICAL EVENT — interrupting: Bot took 5.0 damage!
[Agent] 📢 Injected 2 game events. LLM will see: "[IMPORTANT GAME UPDATE..."
```
