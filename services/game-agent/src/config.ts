import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.GAME_AGENT_PORT || '3000', 10),
  
  minecraft: {
    defaultHost: process.env.MINECRAFT_HOST || 'localhost',
    defaultPort: parseInt(process.env.MINECRAFT_PORT || '25565', 10),
    authMode: (process.env.MINECRAFT_AUTH_MODE as 'offline' | 'microsoft') || 'offline',
  },
  
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
} as const;
