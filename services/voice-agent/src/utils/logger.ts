/**
 * File-based Logger for Voice Agent
 *
 * LiveKit's agent worker runs in a forked child process whose
 * stdout/stderr don't appear in the parent terminal.
 * This logger writes to a file so we can always see what's happening.
 *
 * Usage:
 *   import { agentLog } from '../utils/logger.js';
 *   agentLog('Tool called', { name: 'connectBot' });
 *
 * View logs:
 *   tail -f services/voice-agent/agent.log
 */

import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Single shared log file (append only — never cleared)
const LOG_FILE = join(__dirname, '../../agent.log');

// Write a startup separator (not a clear)
try {
  appendFileSync(LOG_FILE, `\n${'━'.repeat(60)}\n[${new Date().toISOString()}] Agent process started (pid=${process.pid})\n${'━'.repeat(60)}\n`);
} catch {
  // ignore
}

export function agentLog(message: string, data?: Record<string, any>): void {
  const ts = new Date().toISOString().substring(11, 23);
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  try {
    appendFileSync(LOG_FILE, `[${ts}] ${message}${extra}\n`);
  } catch {
    // silently ignore
  }
}

export function agentError(message: string, error?: unknown): void {
  const ts = new Date().toISOString().substring(11, 23);
  const errStr = error instanceof Error
    ? `${error.message}\n  ${error.stack?.split('\n').slice(1, 3).join('\n  ')}`
    : String(error || '');
  try {
    appendFileSync(LOG_FILE, `[${ts}] ❌ ${message}${errStr ? ': ' + errStr : ''}\n`);
  } catch {
    // silently ignore
  }
}
