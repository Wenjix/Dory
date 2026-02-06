# Updated Plan Based on Your Feedback

## ✅ Changes Made

### 1. File Structure - Reorganized ✓
**Before:**
```
packages/
├── game-agent/
├── voice-agent/
├── shared/
└── dashboard/
tools/
└── structure-gen/
```

**After:**
```
services/           # Each service in its own folder
├── game-agent/
├── voice-agent/
├── structure-gen/
└── dashboard/
packages/           # Only shared code
└── shared/
```

**Rationale:** Cleaner separation - services are deployable units, packages are libraries.

---

### 2. Mistral AI - VERIFIED ✓

**Research Results:**
- ✅ **Mistral Large 3** (Dec 2025, 41B active / 675B total params)
- ✅ **Function calling support** - OpenAI-compatible format
- ✅ Endpoint: `mistral-large-latest`
- ✅ Free $15 credits via hackathon
- ✅ Built-in tools: web search, code interpreter, image gen

**API Usage:**
```javascript
// Just like OpenAI
const response = await mistral.chat.completions.create({
  model: "mistral-large-latest",
  messages: [...],
  tools: [{ type: "function", function: {...} }]
});
```

**Verdict:** Perfect for your use case. Can fall back to OpenAI/Claude if needed.

---

### 3. Neocortex - VERIFIED ✓

**Research Results:**
- ✅ **YES, provides full voice services!**
- ✅ **STT:** `POST /api/v2/audio/transcribe` - Speech-to-Text
- ✅ **TTS:** `POST /api/v2/audio/generate` - Text-to-Speech
- ✅ Uses **ElevenLabs backend** (they got a startup grant)
- ✅ Also provides: emotion tracking, action-based interactions, context awareness
- ✅ Cross-platform Web API (works with any stack)

**API Endpoints:**
```javascript
// Speech to Text
POST /api/v2/audio/transcribe
Body: { audio: base64 }

// Text to Speech
POST /api/v2/audio/generate
Body: { text: "Hello player!", characterId: "..." }

// Chat with emotion/actions
POST /api/v2/chat
Body: { message: "...", sessionId: "..." }
Response: { 
  response: "...", 
  emotion: "NEUTRAL",
  actions: ["wave", "smile"]
}
```

**Verdict:** Perfect! Provides STT + TTS + emotion system. Better than ElevenLabs alone because it's purpose-built for NPCs.

---

### 4. 3D Generation - MineGenAI Approach ✓

**Updated Plan:**
- ✅ Use **LLM code generation** (your MineGenAI approach)
- ✅ Mistral generates JavaScript → execute → place blocks
- ✅ Fast, reliable, you already know the pattern
- ✅ Optional bonus: Reactor/Hyper3D if time permits

**Voxelization Challenge:**
If you want to use external 3D services (Reactor WorldCore, Hyper3D):
- They output 3D meshes (GLB, OBJ, etc.)
- Need voxelization (triangle-to-voxel conversion)
- Color mapping to Minecraft blocks (CIE-LAB color space)
- **Complexity:** High, might be too much for hackathon
- **Recommendation:** Bonus feature only if core is done early

---

### 5. Database - MongoDB ✓

**Updated to MongoDB!**

**Rationale:**
- ✅ Better concurrency (no database locking like SQLite)
- ✅ Flexible schema (perfect for evolving game data)
- ✅ You're already familiar with it
- ✅ Natural fit for conversation history (documents)
- ✅ Easy to add vector embeddings for memory system
- ✅ MongoDB Atlas has free tier (no local install needed)

**Schema Design:**
```javascript
// sessions collection
{
  _id: ObjectId,
  sessionId: String,
  userId: String,
  botName: String,
  personality: String,
  serverInfo: { host, port },
  createdAt: Date,
  lastActive: Date,
  metadata: Object
}

// messages collection
{
  _id: ObjectId,
  sessionId: String,
  role: "user" | "assistant" | "system",
  content: String,
  timestamp: Date,
  embedding: [Float],  // Optional: for semantic search
  metadata: Object
}

// memory collection (for advanced memory system)
{
  _id: ObjectId,
  sessionId: String,
  type: "preference" | "fact" | "relationship",
  content: String,
  importance: Number,
  timestamp: Date,
  relatedMessages: [ObjectId]
}
```

**Indexes:**
```javascript
// Fast session lookup
db.messages.createIndex({ sessionId: 1, timestamp: -1 });

// Recent messages
db.messages.createIndex({ timestamp: -1 });

// Memory search (if using embeddings)
db.memory.createIndex({ sessionId: 1, importance: -1 });
```

---

### 6. Minecraft Integration - Enhanced ✓

**Added to Phase 2:**

#### Vision System (Manual Raycast)
```typescript
// actions/vision.ts
- getBlockLookingAt() - manual raycast from bot's view
- getEntityLookingAt() - find entity in crosshair
- describeTarget() - describe what bot is looking at
- scanArea() - scan visible blocks in view cone
```

**Tool:**
```
what_am_i_looking_at
→ "You're looking at a stone block at X:123, Y:64, Z:-45"
```

#### Building Helpers (Walls & Pillars)
```typescript
// actions/building.ts
- buildPillar(height, material) - vertical pillar
- buildWall(start, end, height, material) - wall between points
- buildFloor(corner1, corner2, material) - fill floor
- buildRoof(corner1, corner2, height, material) - roof structure
```

**From readyplayerx reference:**
- Handle insufficient materials
- Check for obstructions
- Height limits (avoid going above world limit)
- Progress reporting (block by block)

---

## Updated Timeline

### Phase 2: Game Agent Core (3-4h now, was 2-3h)
- 2.1 Package setup
- 2.2 Bot manager
- 2.3 Bot wrapper
- 2.4 Core action helpers (10 functions)
- **2.5 Vision helpers (manual raycast)** ← NEW
- **2.6 Building helpers (walls & pillars)** ← NEW
- 2.7 Event system

**Test:** Bot can connect, move, collect, build walls/pillars, report what it's looking at

**Commits:** 7 (was 5)

---

## Simplified Approach

Based on "don't get ahead of myself":

### Focus Areas (Priority Order)
1. ✅ **Minecraft Integration** (Phase 2) - Get bot working solidly
2. ✅ **Tool Registry** (Phase 3) - LLM can control bot
3. ✅ **Voice** (Phase 5) - Voice commands work
4. ✅ **Personality** (Phase 4) - Bot has character
5. 🔶 **Structure Gen** (Phase 7) - Only if time permits
6. 🔶 **Advanced Planning** (Phase 8) - Nice to have
7. 🔶 **MCP Tools** (Phase 6) - Future-proofing

### What to Skip Initially
- ❌ Multi-agent coordination
- ❌ Partner API integrations (Reactor, etc.)
- ❌ Complex memory/learning system (start simple)
- ❌ Advanced error recovery

### Minimum Viable Demo
```
1. Voice: "Hey bot, follow me"
   → Bot follows player

2. Voice: "Collect some wood"
   → Bot finds trees, collects oak logs

3. Voice: "Build a wall here"
   → Bot builds wall at current location

4. Voice: "What are you looking at?"
   → Bot: "I'm looking at a stone block"

5. Dashboard: Shows bot position, inventory, activity
```

This alone would be impressive!

---

## Key Technical Notes

### Mistral AI Usage
```javascript
// Install
npm install @mistralai/mistralai

// Usage (same as OpenAI)
import Mistral from '@mistralai/mistralai';

const client = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY
});

const response = await client.chat.completions.create({
  model: "mistral-large-latest",
  messages: [
    { role: "system", content: "You are a Minecraft bot..." },
    { role: "user", content: "Follow the player named Steve" }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "follow_player",
        description: "Follow a player",
        parameters: {
          type: "object",
          properties: {
            username: { type: "string" }
          },
          required: ["username"]
        }
      }
    }
  ]
});
```

### Neocortex Usage
```javascript
// Install (if they have SDK)
npm install @neocortex/sdk

// Or use HTTP directly
const response = await fetch('https://api.neocortex.link/api/v2/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${NEOCORTEX_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Follow me",
    characterId: "your-character-id",
    sessionId: "session-123"
  })
});

const data = await response.json();
// data.response - text response
// data.emotion - NEUTRAL, HAPPY, etc.
// data.actions - array of actions to trigger
```

### MongoDB Usage
```javascript
// Install
npm install mongodb

// Connect
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db('dory');

// Insert message
await db.collection('messages').insertOne({
  sessionId: 'session-123',
  role: 'user',
  content: 'Follow me',
  timestamp: new Date()
});

// Get recent messages
const messages = await db.collection('messages')
  .find({ sessionId: 'session-123' })
  .sort({ timestamp: -1 })
  .limit(20)
  .toArray();
```

---

## Next Steps

1. **Review updated HACKATHON_PLAN.md** - Reflects all changes
2. **Setup MongoDB** - Local install or Atlas free tier
3. **Redeem credits**:
   - Mistral: https://mistral-credits-app-production.up.railway.app/h/supercell-game-hack/
   - Neocortex: Settings > Redeem Code > `AIGAMEHACK2026`
4. **Start Phase 1** - Monorepo foundation
5. **Focus on Phase 2** - Get Minecraft integration solid first

---

## Risk Assessment Update

### Lower Risk Now
- ✅ MongoDB (you're familiar with it)
- ✅ Neocortex (confirmed voice services)
- ✅ Mistral AI (proven function calling)

### Still Some Risk
- 🔶 Structure generation quality (LLM code can be buggy)
- 🔶 Voice latency (network-dependent)
- 🔶 Time management (lots to build!)

### Mitigation
- Start with core features (Phases 1-3)
- Test incrementally
- Voice and structure gen are enhancements (bot works without them)
- Dashboard can be simpler (just show status)

---

## Questions?

- MongoDB setup: Local or Atlas?
- Structure gen: Node.js or Python?
- Frontend: Your colleague's preference on framework?
- Demo environment: Local Minecraft server or cloud?

Let me know if you want any other adjustments!
