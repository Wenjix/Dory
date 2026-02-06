export interface Personality {
  id: string;
  name: string;
  traits: string[];
  communicationStyle: string;
  playStyle: string;
  systemPrompt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}
