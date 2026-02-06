# @dory/shared

Shared types and utilities used across all Dory services.

## Contents

- **types/** - TypeScript interfaces and types
  - `session.ts` - Session and configuration types
  - `minecraft.ts` - Minecraft-related types
  - `agent.ts` - Agent and personality types

- **utils/** - Common utilities
  - `logger.ts` - Winston logger factory
  - `sleep.ts` - Async sleep helper
  - `retry.ts` - Retry logic with exponential backoff

## Usage

```typescript
import { createLogger, Session, BotState } from '@dory/shared';

const logger = createLogger('my-service');
logger.info('Hello from shared package!');
```
