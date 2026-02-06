/**
 * Global LLM client instance.
 * Separated to avoid circular imports between index.ts and server.ts/websocket.ts.
 */

import { LLMProvider } from './types';

let llmClient: LLMProvider | null = null;

export function setLLMClient(client: LLMProvider): void {
  llmClient = client;
}

export function getLLMClient(): LLMProvider | null {
  return llmClient;
}
