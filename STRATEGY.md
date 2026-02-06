# Strategic Overview & Key Decisions

Quick reference for strategic decisions and integration approach for the hackathon.

---

## Core Strategy

### 🎯 Main Goal
Build an AI gaming companion that:
1. **Works reliably** - Core features solid, not buggy
2. **Impresses visually** - Voice + real-time dashboard + live building
3. **Shows intelligence** - Multi-step planning, personality, learning
4. **Uses partner tech** - Mistral AI + Neocortex integration
5. **Tells a story** - Companion that grows with you

### 🏆 Winning Angle
**"AI that plays WITH you, not FOR you"**
- Not automation (boring)
- Not just voice chat (limited)
- **Collaborative companion** with personality (emotional connection!)

---

## Strategic Technical Decisions

### 1. Monorepo Architecture ✅
**Decision:** Use monorepo (pnpm workspaces + Turborepo)

**Why:**
- Shared types prevent API mismatches
- Faster development (no publishing packages)
- Easier refactoring
- Consistent tooling
- Single repo = easier to demo

**Alternative Rejected:** Multi-repo (too much overhead for hackathon)

---

### 2. Mistral AI Large 3 for LLM ✅
**Decision:** Use Mistral Large 3 as primary LLM

**Why:**
- Free $15 credits via hackathon
- **41B active params, 675B total** (Dec 2025 release)
- **Function calling support** - OpenAI-compatible format
- Fast and capable
- Multimodal (text + vision)
- Cost-effective if credits run out
- Hackathon partner (good for presentation)

**Endpoint:** `mistral-large-latest`

**Alternative:** OpenAI GPT-4 or Claude (backup if Mistral fails)

**Usage:**
- **Mistral Large 3** - Complex reasoning, planning, structure generation
- **Mistral Small** - Simple commands, cheap fallback (if needed)

---

### 3. Neocortex for Voice ✅
**Decision:** Use Neocortex for voice interaction

**Why:**
- Purpose-built for game NPCs (fits perfectly)
- **Full voice services:** STT + TTS + emotion tracking
- **Uses ElevenLabs backend** (they got a startup grant)
- Free 2000 credits via hackathon code
- Cross-platform Web API (works with any stack)
- Hackathon partner (brownie points)
- Action-based interactions built-in

**API Endpoints:**
- `POST /api/v2/audio/transcribe` - Speech-to-Text
- `POST /api/v2/audio/generate` - Text-to-Speech
- `POST /api/v2/chat` - Chat with emotion/action data

**Alternative:** ElevenLabs + Deepgram directly
- More control, more complex
- Use if Neocortex doesn't meet specific needs

**Risk Mitigation:**
- Build text interface first (works without voice)
- Voice as enhancement layer
- Dashboard provides fallback control

---

### 4. LLM Code Generation for Structures ✅
**Decision:** Use LLM to generate JavaScript → execute → place blocks

**Why:**
- Fast development (no 3D pipeline needed)
- More control over output
- Works with Mistral (already integrated)
- Can generate complex logic (redstone)
- Cheaper than image-to-3D APIs

**Approach (from MineGenAI):**
```javascript
// LLM generates code like:
function buildTower(origin) {
  safeSetBlock(origin.x, origin.y, origin.z, 'stone');
  safeSetBlock(origin.x, origin.y+1, origin.z, 'stone');
  // ...
}
```

**Alternative:** Partner APIs (Reactor, Hyper3D)
- Use as bonus features if time permits
- Adds "wow factor" for presentation
- More risky (new APIs to learn)

---

### 5. MongoDB for Persistence ✅
**Decision:** Use MongoDB

**Why:**
- Better concurrency (no database locking like SQLite)
- Flexible schema (perfect for evolving game data)
- Team familiarity (faster development)
- Natural fit for conversation history (documents)
- Easy to add vector embeddings for memory system
- Atlas free tier available (no local install needed)
- Horizontal scaling for multi-session support

**Patterns:**
- Connection pooling for performance
- In-memory cache for recent messages
- Indexes for fast session/message lookups
- TTL indexes for auto-cleanup of old data

---

### 6. Planning Engine for Complex Tasks ✅
**Decision:** Build planning/execution engine

**Why:**
- Handles multi-step requests naturally
- Impressive demo ("gather wood and build a house")
- Shows intelligence beyond simple commands
- Re-planning demonstrates error recovery
- Based on proven architecture (readyplayerx)

**When to use:**
- Complex requests with multiple verbs
- Conjunctions ("and", "then", "while")
- Long descriptions (>30 chars)

**When NOT to use:**
- Simple commands ("follow me", "stop")
- Direct tool calling faster for simple cases

**Classification Example:**
```
"Follow me" → Simple → Direct tool call
"Gather wood and craft a table" → Complex → Planning engine
```

---

## Integration Strategy

### Phase Prioritization

**Critical Path (Must Complete):**
1. ✅ Phase 1: Foundation (monorepo, types, env)
2. ✅ Phase 2: Game Agent Core (bot, actions, events)
3. ✅ Phase 3: Tool Registry & AI (LLM, tools, API)
4. ✅ Phase 5: Voice Integration (Neocortex)
5. ✅ Phase 10: Polish & Demo Prep

**High Value (Strong Effort):**
- ✅ Phase 4: Personality & Memory (differentiation!)
- ✅ Phase 7: Structure Generation (wow factor!)
- ✅ Phase 9: Dashboard (visual impact!)

**Nice to Have (If Time):**
- Phase 6: MCP Tools (future-proofing)
- Phase 8: Advanced Planning (enhancement)
- Phase 11: Bonus Features (partner APIs)

---

## Risk Management

### Top Risks & Mitigations

#### Risk 1: API Credits Run Out
**Mitigation:**
- Use cheaper models for simple tasks (Mistral Small)
- Implement caching (block data, recipes)
- Rate limiting
- Have backup OpenAI account

#### Risk 2: Voice Integration Complex
**Mitigation:**
- Build text interface first (works standalone)
- Use Neocortex (easier than LiveKit)
- Voice as enhancement, not requirement
- Dashboard provides control fallback

#### Risk 3: Minecraft Server Issues
**Mitigation:**
- Local server on laptop (full control)
- Cloud server as backup (Railway/Fly.io)
- Test connectivity early (Phase 2)
- Offline mode authentication

#### Risk 4: Structure Generation Quality
**Mitigation:**
- Provide good examples in LLM prompt
- Validate output (block types, size limits)
- Allow regeneration (user approval)
- Fallback to simple shapes if complex fails

#### Risk 5: Frontend-Backend Integration
**Mitigation:**
- Define API contracts early (OpenAPI/types)
- Use TypeScript for type safety
- WebSocket for real-time (test early)
- Mock data for parallel development

#### Risk 6: Demo Day Issues
**Mitigation:**
- Record backup video (play if live fails)
- Test demo flow multiple times
- Have local setup (no internet needed)
- Printed slides as backup
- Test projector/screen share beforehand

---

## Differentiation Strategy

### What Makes Dory Unique?

**1. Collaborative, Not Automated**
- Bot works WITH player, not instead of player
- Asks questions, provides suggestions
- Adapts to player's style

**2. Personality-Driven**
- Multiple distinct personalities
- Natural conversation
- Emotional connection (name it Dory!)

**3. Intelligent Planning**
- Multi-step task execution
- Error recovery and re-planning
- Shows reasoning process

**4. Generative Structures**
- Text-to-building in real-time
- Live placement feedback
- User approval workflow

**5. Learning System**
- Remembers preferences
- Personalizes suggestions
- Relationship progression

**6. Polished Experience**
- Voice interaction (hands-free)
- Real-time dashboard
- Visual feedback
- Professional UI

---

## Presentation Strategy

### Demo Flow (5 minutes)

**Hook (30s):**
- "Gaming is social, but solo play is lonely"
- "What if your AI companion could actually play WITH you?"
- "Meet Dory - your AI gaming buddy"

**Demo 1: Voice & Personality (1m):**
- Show natural voice interaction
- Switch personalities (Builder Bob → Combat Carl)
- Highlight tone/behavior changes

**Demo 2: Intelligence (1.5m):**
- Complex command: "Gather wood and build me a house"
- Show dashboard: planning steps appear
- Real-time: bot executes plan
- Highlight error recovery (interrupt, re-plan)

**Demo 3: Structure Generation (1.5m):**
- Voice: "Create a medieval tower and build it here"
- Show structure generation in action
- Real-time placement layer-by-layer
- Finished structure appears

**Demo 4: Learning & Adaptation (30s):**
- Show conversation history
- Bot remembers previous context
- Personalized suggestions based on play style

**Closing (30s):**
- Technical stack: Mistral AI, Neocortex, Minecraft
- Built in 48 hours
- Extensible architecture (MCP tools)
- "AI that plays with you, not for you"

### Key Messages

1. **Emotional Connection** - "Your gaming buddy" (not "automation tool")
2. **Intelligence** - Multi-step planning, error recovery
3. **Polish** - Voice, real-time updates, visual feedback
4. **Technology** - Mistral AI, Neocortex (partner tech)
5. **Future-Ready** - Extensible, learning system, multi-agent potential

---

## Competitive Advantages

### vs. Simple Chatbots
- ✅ We execute actions in-game (not just talk)
- ✅ Multi-step planning (complex tasks)
- ✅ Visual feedback (dashboard)

### vs. Automation Mods
- ✅ Natural language control (no commands to memorize)
- ✅ Personality and emotion (engaging)
- ✅ Adaptive behavior (learns preferences)

### vs. Other Hackathon Projects
- ✅ Voice interaction (hands-free, immersive)
- ✅ Structure generation (creative wow-factor)
- ✅ Real-time dashboard (visual polish)
- ✅ Partner tech integration (Mistral + Neocortex)
- ✅ Polished UX (not just backend demo)

---

## Partner API Strategy

### Priority 1: Core (Use Immediately)
- **Mistral AI** - LLM reasoning (critical path)
- **Neocortex** - Voice interaction (high impact)

### Priority 2: Enhancement (If Time in Core Phases)
- **Structure Generation** - Use Mistral (LLM code gen)

### Priority 3: Wow Factor (Bonus Phase)
- **Reactor WorldCore** - World generation, explorable environments
- **X&Immersion** - Animated avatars with lip-sync
- **Hyper3D** - 3D model generation → voxelization

### Priority 4: Nice to Have (If Abundant Time)
- **Decart** - Real-time video restyling
- **Rosebud** - Vibe coding platform
- **Nimble Fox** - Unity editor tool (not applicable to Minecraft)

---

## Technical Excellence Focus Areas

### Code Quality
- TypeScript for type safety
- Consistent error handling patterns
- Graceful degradation
- Logging for debugging
- Comments for complex logic

### Architecture
- Clean separation of concerns
- Reusable components
- Extensible design (easy to add tools/personalities)
- Follow patterns from readyplayerx

### Performance
- Cache frequently used data
- Debounce/throttle events
- Stream LLM responses
- Connection pooling

### User Experience
- Fast response times (<2s for simple commands)
- Progress indicators (multi-step tasks)
- Error messages that guide users
- Natural conversation flow

---

## Post-Hackathon Potential

### Immediate Next Steps (If Winning)
1. Add more personalities (community submissions?)
2. Multi-agent coordination (teams of bots)
3. Better structure generation (image input, editing)
4. Learning system v2 (long-term memory)
5. Voice cloning (user's own voice for bot)

### Productization (If Serious)
1. Minecraft mod (no server needed)
2. Support other games (Terraria, Valheim, etc.)
3. Marketplace for personalities
4. Marketplace for custom tools
5. SaaS platform (hosted bots)
6. Mobile app for remote control

### Monetization Options
1. Freemium (basic free, premium personalities)
2. API access for developers
3. White-label for game studios
4. Enterprise (gaming communities, servers)

---

## Success Metrics

### Judging Criteria (Likely)
- **Innovation** (30%) - Novel approach, creative use of tech
- **Technical Excellence** (25%) - Code quality, architecture
- **User Experience** (25%) - Polish, usability, design
- **Impact** (20%) - Potential value, scalability

### Our Strengths
- ✅ Innovation: AI companion that plays WITH you (emotional angle)
- ✅ Technical: Solid architecture, partner tech integration
- ✅ UX: Voice + dashboard + real-time = polished
- ✅ Impact: Applicable to any game, extensible platform

### Story to Tell
"Gaming is better with friends, but solo play is lonely. Dory is your AI gaming companion that plays with you through natural conversation, helps you build, and adapts to your style. Built in 48 hours using Mistral AI and Neocortex, Dory shows how AI can enhance gaming without replacing the human experience."

---

## Day-of-Demo Checklist

### Setup (30 min before)
- [ ] All services running locally
- [ ] Minecraft server up
- [ ] Bot connected and responsive
- [ ] Dashboard accessible
- [ ] Voice working
- [ ] Demo world prepared (clean area for building)
- [ ] Backup video ready
- [ ] Laptop charged
- [ ] Screen sharing tested

### Contingency Plans
- **Voice fails?** → Use text chat in dashboard
- **Minecraft server crashes?** → Show backup video + live dashboard
- **Internet down?** → All local (plan for this!)
- **Projector issues?** → Show on laptop screen
- **Code bug discovered?** → Have rollback commit ready

---

## Final Thoughts

### What Matters Most
1. **Working demo** > perfect code
2. **Visual polish** > feature completeness
3. **Story** > technical details
4. **Emotional impact** > raw capability

### Remember
- Judges see LOTS of projects (stand out!)
- First 30 seconds matter (hook them!)
- Show, don't tell (live demo > slides)
- Enthusiasm is contagious (be excited!)
- Have fun! (you're building something cool!)

---

**You've got this! Now go build something amazing! 🚀**
