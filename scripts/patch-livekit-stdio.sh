#!/bin/bash
# Patch @livekit/agents to show console.log from agent worker in terminal.
# LiveKit forks child processes with piped (hidden) stdio by default.
# This changes it to 'inherit' so logs show in the terminal.

FILE=$(find node_modules/.pnpm -path "*/@livekit/agents/dist/ipc/job_proc_executor.js" 2>/dev/null | head -1)
FILE2=$(find node_modules/.pnpm -path "*/@livekit/agents/dist/ipc/inference_proc_executor.js" 2>/dev/null | head -1)

if [ -z "$FILE" ]; then
  echo "[patch] @livekit/agents not found, skipping"
  exit 0
fi

if grep -q "stdio.*inherit" "$FILE" 2>/dev/null; then
  echo "[patch] Already patched"
  exit 0
fi

sed -i '' "s/const forkOptions = isTypeScript ? { execArgv: process.execArgv } : void 0;/const forkOptions = isTypeScript ? { execArgv: process.execArgv, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] } : { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] };/g" "$FILE" "$FILE2" 2>/dev/null

echo "[patch] ✅ @livekit/agents stdio patched"
