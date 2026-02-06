# Testing Guide

## WebSocket Test Console

We've created an interactive WebSocket console for easy testing!

### Setup

1. **Start the game agent:**
   ```bash
   pnpm --filter @dory/game-agent dev
   ```

2. **Start a Minecraft server** (if not already running)

3. **Open the test console:**
   - Open `test-console.html` in your browser
   - Or just open: `file:///path/to/Dory/services/game-agent/test-console.html`

### Quick Start

1. **Create a bot session first** (using curl or Postman):
   ```bash
   curl -X POST http://localhost:3000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{
       "serverHost": "localhost",
       "serverPort": 25565,
       "botName": "TestBot"
     }'
   ```
   
   This will return a `sessionId`. Copy it!

2. **In the test console**, you can now run commands:
   ```
   sessions                        # List all active sessions
   position YOUR_SESSION_ID        # Get bot position
   inventory YOUR_SESSION_ID       # Show inventory
   looking YOUR_SESSION_ID         # What is bot looking at?
   ```

## Available Commands

### Session Management
- `sessions` - List all active bot sessions

### Movement
- `follow <sessionId>` - Follow the nearest player
- `stop <sessionId>` - Stop all actions
- `goto <sessionId> <x> <y> <z>` - Navigate to coordinates

### Collection & Crafting
- `collect <sessionId> <blockType> <count>` - Collect blocks
  - Example: `collect abc123 oak_log 10`
- `craft <sessionId> <itemName> <count>` - Craft items
  - Example: `craft abc123 stick 4`

### Building
- `place <sessionId> <blockType> <x> <y> <z>` - Place a block
- `break <sessionId> <x> <y> <z>` - Break a block
- `pillar <sessionId> <height> <blockType>` - Build a pillar
  - Example: `pillar abc123 5 stone`
- `wall <sessionId> <length> <height> <blockType>` - Build a wall
  - Example: `wall abc123 10 3 cobblestone`
- `floor <sessionId> <width> <length> <blockType>` - Build a floor
  - Example: `floor abc123 5 5 planks`

### Vision & Information
- `looking <sessionId>` - Describe what bot is looking at
- `scan <sessionId> <range>` - Scan area (default 16 blocks)
- `inventory <sessionId>` - Show bot's inventory
- `position <sessionId>` - Show bot's position, health, and food

### Help
- `help` - Show all available commands

## Example Test Session

```bash
# 1. Create a session (in terminal)
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"serverHost": "localhost", "serverPort": 25565, "botName": "TestBot"}'

# Output: {"success": true, "sessionId": "abc-123-def", ...}

# 2. In test console:
sessions                    # Verify bot is connected
position abc-123-def        # Check bot position
inventory abc-123-def       # Check inventory
looking abc-123-def         # What am I looking at?

# 3. Test movement:
follow abc-123-def          # Bot follows you
stop abc-123-def            # Bot stops

# 4. Test collection:
collect abc-123-def oak_log 5    # Collect 5 oak logs

# 5. Test building:
pillar abc-123-def 5 dirt   # Build 5-high dirt pillar

# 6. Test vision:
scan abc-123-def 32         # Scan 32 block radius
```

## Testing Checklist

### Basic Functionality
- [ ] Bot connects to server
- [ ] Bot appears in game
- [ ] Bot sends welcome message in chat
- [ ] WebSocket console connects

### Movement
- [ ] `follow` - Bot follows player
- [ ] `stop` - Bot stops following
- [ ] `goto` - Bot navigates to coordinates
- [ ] Bot opens doors when stuck

### Actions
- [ ] `collect` - Bot mines and collects blocks
- [ ] `craft` - Bot crafts items
- [ ] `place` - Bot places blocks
- [ ] `break` - Bot breaks blocks

### Building
- [ ] `pillar` - Builds vertical pillar
- [ ] `wall` - Builds wall in correct direction
- [ ] `floor` - Builds horizontal platform
- [ ] Checks for sufficient materials

### Vision
- [ ] `looking` - Correctly identifies blocks
- [ ] `looking` - Correctly identifies entities
- [ ] `scan` - Lists nearby blocks
- [ ] `scan` - Lists nearby entities

### Inventory
- [ ] `inventory` - Shows items
- [ ] Items appear after collection
- [ ] Items disappear after placement

### Edge Cases
- [ ] Bot handles connection errors
- [ ] Bot handles insufficient materials
- [ ] Bot handles unreachable locations
- [ ] Bot handles invalid commands

## Common Issues

### Bot won't connect
- Check Minecraft server is running
- Verify host/port in session creation
- Check firewall settings
- Try `authMode: "offline"` for local servers

### WebSocket won't connect
- Check game agent is running on port 3000
- Verify `ws://localhost:3000/ws` is accessible
- Check browser console for errors

### Bot gets stuck
- Use `stop <sessionId>` command
- Bot should auto-open doors
- May need to manually teleport bot

### Commands not working
- Verify sessionId is correct (use `sessions` command)
- Check bot is still connected to server
- Look at game agent logs for errors

## Advanced Testing

### Multiple Bots
```bash
# Create multiple sessions
curl -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" \
  -d '{"botName": "Bot1"}'
  
curl -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" \
  -d '{"botName": "Bot2"}'

# Control them separately
follow session1-id
follow session2-id
```

### Stress Testing
```bash
# Have bot collect large amounts
collect sessionId oak_log 64

# Build large structures
wall sessionId 20 5 stone
floor sessionId 10 10 planks

# Rapid commands
# (Send multiple commands quickly to test queueing)
```

## Next Steps

Once basic features are tested, you're ready to add:
- Tool registry for LLM integration
- Mistral AI for natural language commands
- Voice agent integration
- Personality system

Happy testing! 🚀
