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
import { agentLog, agentError } from '../utils/logger.js';

// ── Configuration ─────────────────────────────────────────────────────────

const GAME_AGENT_URL = process.env.GAME_AGENT_URL || 'http://localhost:3000';

agentLog('[GameTools] Module loaded', { GAME_AGENT_URL });

// ── Helper: HTTP call with full logging ───────────────────────────────────

async function callGameAgent(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = `${GAME_AGENT_URL}${path}`;
  agentLog(`[GameTools] → ${method} ${url}`, body);

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

    agentLog(`[GameTools] ← ${response.status}`, { preview: JSON.stringify(data).substring(0, 300) });

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const msg = (error as Error).message;
    agentError(`[GameTools] NETWORK ERROR`, error);

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
      .optional()
      .describe('Name for the bot. Defaults to "DoryBot".'),
    serverHost: z
      .string()
      .optional()
      .describe('Minecraft server host. Defaults to "localhost".'),
    serverPort: z
      .number()
      .optional()
      .describe('Minecraft server port. Defaults to 25565.'),
  }),
  execute: async ({ botName, serverHost, serverPort }) => {
    const name = botName || 'DoryBot';
    const host = serverHost || 'localhost';
    const port = serverPort || 25565;

    agentLog(`[GameTools] connectBot: "${name}" → ${host}:${port}`);

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
    agentLog(`[GameTools] disconnectBot: finding active session...`);

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

    agentLog(`[GameTools] disconnectBot: disconnecting "${botName}" (${sessionId})`);

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
    'Use natural language describing what you want the bot to do. ' +
    'Examples: "follow the player", "collect 5 wood", "craft a crafting table", ' +
    '"build a wall where the player is looking", "what is in the inventory?"',
  parameters: z.object({
    command: z
      .string()
      .describe(
        'The natural language command for the game agent. Be specific about what to do.'
      ),
  }),
  execute: async ({ command }) => {
    agentLog(`[GameTools] sendGameCommand: "${command}"`);

    const { ok, data, error } = await callGameAgent('POST', '/api/a2a/message', {
      message: command,
    });

    if (error) return error;

    if (ok && data?.success) {
      const tools = data.toolsExecuted?.length
        ? ` (actions: ${data.toolsExecuted.map((t: any) => t.name).join(', ')})`
        : '';
      agentLog(`[GameTools] sendGameCommand result: "${data.response?.substring(0, 150)}"${tools}`);
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
    agentLog(`[GameTools] getGameStatus`);

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
    agentLog(`[GameTools] getGameCapabilities`);

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

// ── Export as ToolContext (name → tool dictionary) ─────────────────────────

export const gameTools: llm.ToolContext = {
  connectBot,
  disconnectBot,
  sendGameCommand,
  getGameStatus,
  getGameCapabilities,
};

agentLog('[GameTools] Tools registered', { tools: Object.keys(gameTools) });
