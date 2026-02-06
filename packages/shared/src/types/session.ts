export type SessionId = string;

export interface Session {
  id: SessionId;
  userId: string;
  botName: string;
  personality: string;
  serverHost: string;
  serverPort: number;
  createdAt: Date;
  lastActive: Date;
  status: 'connecting' | 'active' | 'disconnected' | 'error';
}

export interface SessionConfig {
  serverHost: string;
  serverPort: number;
  botName: string;
  personality: string;
  authMode?: 'offline' | 'microsoft';
}
