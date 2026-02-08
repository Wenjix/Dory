/**
 * Game Agent Tools
 *
 * LLM-callable tools that let the voice agent (Dory)
 * communicate with the game agent to perform Minecraft actions.
 *
 * Uses simple HTTP calls to the game agent's A2A endpoints.
 */

import { llm } from '@livekit/agents';
import { z } from 'zod';

// ── Configuration ─────────────────────────────────────────────────────────

const GAME_AGENT_URL = process.env.GAME_AGENT_URL || 'http://localhost:3000';

console.log('[GameTools] Module loaded', { GAME_AGENT_URL });

// ── Helper: HTTP call with full logging ───────────────────────────────────

async function callGameAgent(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = `${GAME_AGENT_URL}${path}`;
  console.log(`[GameTools] → ${method} ${url}`, body ? JSON.stringify(body) : '');

  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log(`[GameTools] ← ${response.status}`, JSON.stringify(data).substring(0, 300));

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const msg = (error as Error).message;
    console.error(`[GameTools] NETWORK ERROR:`, msg);

    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Game agent is not running. Make sure the game agent service is started on port 3000.',
      };
    }
    return { ok: false, status: 0, data: null, error: `Network error: ${msg}` };
  }
}

// ── Tool: Connect Bot ─────────────────────────────────────────────────────

const connectBot = llm.tool({
  description:
    'Connect a Minecraft bot to a server. Use this when the player asks to join or connect to a game. ' +
    'If no server details are given, defaults to localhost:25565.',
  parameters: z.object({
    botName: z
      .string()
      .nullish()
      .describe('Name for the bot. Defaults to "DoryBot".'),
    serverHost: z
      .string()
      .nullish()
      .describe('Minecraft server host. Defaults to "localhost".'),
    serverPort: z
      .number()
      .nullish()
      .describe('Minecraft server port. Defaults to 25565.'),
  }),
  execute: async ({ botName, serverHost, serverPort }) => {
    const name = botName || 'DoryBot';
    const host = serverHost || 'localhost';
    const port = serverPort || 25565;

    console.log(`[GameTools] connectBot: "${name}" → ${host}:${port}`);

    const { ok, data, error } = await callGameAgent('POST', '/api/sessions', {
      serverHost: host,
      serverPort: port,
      botName: name,
    });

    if (error) return error;

    if (ok && data?.success) {
      return `Bot "${name}" connected to ${host}:${port} successfully! Session: ${data.sessionId}`;
    } else {
      return `Failed to connect bot: ${data?.error || data?.message || JSON.stringify(data)}`;
    }
  },
});

// ── Tool: Disconnect Bot ──────────────────────────────────────────────────

const disconnectBot = llm.tool({
  description:
    'Disconnect the Minecraft bot from the server. Use when the player wants the bot to leave the game.',
  parameters: z.object({}),
  execute: async () => {
    console.log(`[GameTools] disconnectBot: finding active session...`);

    const { ok: sessOk, data: sessData, error: sessError } = await callGameAgent(
      'GET',
      '/api/a2a/sessions'
    );

    if (sessError) return sessError;
    if (!sessOk || !sessData?.sessions?.length) {
      return 'No bot is currently connected.';
    }

    const sessionId = sessData.sessions[0].sessionId;
    const botName = sessData.sessions[0].botName;

    console.log(`[GameTools] disconnectBot: disconnecting "${botName}" (${sessionId})`);

    const { ok, data, error } = await callGameAgent('DELETE', `/api/sessions/${sessionId}`);

    if (error) return error;

    if (ok && data?.success) {
      return `Bot "${botName}" has been disconnected from the server.`;
    } else {
      return `Failed to disconnect: ${data?.error || JSON.stringify(data)}`;
    }
  },
});

// ── Tool: Send Game Command ───────────────────────────────────────────────

const sendGameCommand = llm.tool({
  description:
    'Send a command to the Minecraft game agent to perform an in-game action. ' +
    'IMPORTANT: Pass the player\'s FULL request with ALL details — quantities, materials, dimensions, locations, and any other specifics. ' +
    'Do NOT shorten, summarize, or paraphrase. The game agent needs every detail to act correctly. ' +
    'Examples: "collect 5 oak wood", "build a 3-block tall pillar using cobblestone where I am looking", ' +
    '"craft 4 wooden planks", "follow me", "drop all the dirt"',
  parameters: z.object({
    command: z
      .string()
      .describe(
        'The COMPLETE, detailed command for the game agent. Include ALL specifics the player mentioned: ' +
        'block types, quantities, heights, materials, directions, positions. Never omit details.'
      ),
  }),
  execute: async ({ command }) => {
    console.log(`[GameTools] sendGameCommand: "${command}"`);

    const { ok, data, error } = await callGameAgent('POST', '/api/a2a/message', {
      message: command,
    });

    if (error) return error;

    if (ok && data?.success) {
      const tools = data.toolsExecuted?.length
        ? ` (actions: ${data.toolsExecuted.map((t: any) => t.name).join(', ')})`
        : '';
      console.log(`[GameTools] sendGameCommand result: "${data.response?.substring(0, 150)}"${tools}`);
      return data.response || 'Command executed successfully.';
    } else {
      return `Failed: ${data?.error || JSON.stringify(data)}`;
    }
  },
});

// ── Tool: Get Game Status ─────────────────────────────────────────────────

const getGameStatus = llm.tool({
  description:
    'Check if the game agent is running and list active Minecraft bot sessions. ' +
    'Use this to verify connectivity or see what bots are online.',
  parameters: z.object({}),
  execute: async () => {
    console.log(`[GameTools] getGameStatus`);

    const { ok, data, error } = await callGameAgent('GET', '/api/a2a/sessions');

    if (error) return error;
    if (!ok) return `Game agent returned an error`;

    if (data.count === 0) {
      return 'Game agent is running but no Minecraft bots are connected. Tell the player to say "join the game" to connect a bot.';
    }

    const sessionList = data.sessions
      .map(
        (s: any) =>
          `- ${s.botName || 'Bot'} (session: ${s.sessionId?.substring(0, 8) || '?'}...)`
      )
      .join('\n');

    return `Game agent is online with ${data.count} active bot(s):\n${sessionList}`;
  },
});

// ── Tool: Get Agent Capabilities ──────────────────────────────────────────

const getGameCapabilities = llm.tool({
  description:
    'Discover what the Minecraft game agent can do. Returns a list of skills and example commands.',
  parameters: z.object({}),
  execute: async () => {
    console.log(`[GameTools] getGameCapabilities`);

    const { ok, data, error } = await callGameAgent(
      'GET',
      '/.well-known/agent-card.json'
    );

    if (error) return error;
    if (!ok) return 'Could not fetch game agent capabilities.';

    const skills = data.skills || [];
    const desc = skills
      .map(
        (s: any) =>
          `${s.name}: ${s.description} (examples: ${(s.examples || []).join(', ')})`
      )
      .join('\n');

    return `Game Agent: ${data.description}\n\nSkills:\n${desc}`;
  },
});

// ── Tool: Drop Item ───────────────────────────────────────────────────────

const dropItem = llm.tool({
  description:
    'Drop/throw items from the bot\'s inventory onto the ground. Useful for giving items to a player, clearing inventory, or discarding unwanted items.',
  parameters: z.object({
    item_name: z
      .string()
      .describe('The Minecraft item name to drop (e.g. "cobblestone", "oak_log", "diamond")'),
    count: z
      .number()
      .describe('How many to drop. Use -1 to drop all of that item.')
      .default(-1),
  }),
  execute: async ({ item_name, count = -1 }) => {
    console.log(`[GameTools] dropItem: ${item_name} x${count}`);

    const { ok, data, error } = await callGameAgent('POST', '/api/a2a/message', {
      message: `drop ${count === -1 ? 'all' : count} ${item_name}`,
    });

    if (error) return error;

    if (ok && data?.success) {
      return data.response || `Dropped ${item_name}`;
    } else {
      return `Failed to drop items: ${data?.error || JSON.stringify(data)}`;
    }
  },
});

// ── Export as ToolContext (name → tool dictionary) ─────────────────────────

export const gameTools: llm.ToolContext = {
  connectBot,
  disconnectBot,
  sendGameCommand,
  getGameStatus,
  getGameCapabilities,
  dropItem,
};

console.log('[GameTools] Tools registered:', Object.keys(gameTools));
