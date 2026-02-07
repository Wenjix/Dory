/**
 * Memory API Routes
 *
 * Express router exposing the memory system via HTTP.
 * Mounted at /api/memory in server.ts.
 *
 * Endpoints:
 *   POST   /api/memory/context          — Receive conversation context (voice agent)
 *   POST   /api/memory/session-end      — Trigger session-end summaries
 *   GET    /api/memory/profile/:userId  — User profile summary
 *   GET    /api/memory/system-context/:userId — Full text context for prompt enrichment
 *   GET    /api/memory/summaries        — List summaries (query: userId, type, sessionId)
 *   GET    /api/memory/memories         — List memories  (query: userId, type, tags, session)
 *   GET    /api/memory/stats/:userId    — Quick stats for dashboard
 */

import { Router, Request, Response } from 'express';
import { processConversationContext } from './memory-processor.js';
import { onSessionEnd, updateSessionSummary, updateUserProfile } from './summary-manager.js';
import {
  getMemories,
  getSummaries,
  getUserProfile,
  getSystemContext,
  getMemoryStats,
} from './retrieval-service.js';
import type { ConversationContextPayload, MemoryType, SummaryType } from './types.js';

export function createMemoryRouter(): Router {
  const router = Router();

  // ── Receive conversation context from voice agent ───────────────────────
  router.post('/context', async (req: Request, res: Response) => {
    try {
      const payload = req.body as ConversationContextPayload;

      if (!payload.userId || !payload.conversationHistory) {
        res.status(400).json({ error: 'Missing userId or conversationHistory' });
        return;
      }

      console.log(
        `[Memory API] Received conversation context: ${payload.conversationHistory.length} messages for user ${payload.userId}`
      );

      const result = await processConversationContext(payload);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[Memory API] Error processing context:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── Trigger session-end summaries ───────────────────────────────────────
  router.post('/session-end', async (req: Request, res: Response) => {
    try {
      const { userId, sessionId } = req.body;

      if (!userId || !sessionId) {
        res.status(400).json({ error: 'Missing userId or sessionId' });
        return;
      }

      console.log(
        `[Memory API] Session end triggered for user ${userId}, session ${sessionId}`
      );

      await onSessionEnd(userId, sessionId);
      res.json({ success: true, message: 'Session-end summaries generated' });
    } catch (error) {
      console.error('[Memory API] Error on session end:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── Manually trigger summary updates ────────────────────────────────────
  router.post('/update-summary', async (req: Request, res: Response) => {
    try {
      const { userId, sessionId, type } = req.body;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }

      if (type === 'profile' || !type) {
        await updateUserProfile(userId);
      }
      if ((type === 'session' || !type) && sessionId) {
        await updateSessionSummary(userId, sessionId);
      }

      res.json({ success: true, message: 'Summary updated' });
    } catch (error) {
      console.error('[Memory API] Error updating summary:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── Get user profile ────────────────────────────────────────────────────
  router.get('/profile/:userId', async (req: Request, res: Response) => {
    try {
      const profile = await getUserProfile(req.params.userId);
      res.json({ success: true, profile: profile || null });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── Get full system context (text for prompt enrichment) ────────────────
  router.get('/system-context/:userId', async (req: Request, res: Response) => {
    try {
      const context = await getSystemContext(req.params.userId);
      res.json({ success: true, context });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── List summaries ──────────────────────────────────────────────────────
  router.get('/summaries', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId query param' });
        return;
      }

      const summaries = await getSummaries({
        userId,
        summaryType: req.query.type as SummaryType | undefined,
        sessionId: req.query.sessionId as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });

      res.json({ success: true, count: summaries.length, summaries });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── List memories ───────────────────────────────────────────────────────
  router.get('/memories', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(400).json({ error: 'Missing userId query param' });
        return;
      }

      const tags = req.query.tags
        ? (req.query.tags as string).split(',')
        : undefined;

      const memories = await getMemories({
        userId,
        sessionId: req.query.sessionId as string | undefined,
        type: req.query.type as MemoryType | undefined,
        tags,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
      });

      res.json({ success: true, count: memories.length, memories });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ── Stats (for dashboard) ──────────────────────────────────────────────
  router.get('/stats/:userId', async (req: Request, res: Response) => {
    try {
      const stats = await getMemoryStats(req.params.userId);
      res.json({ success: true, ...stats });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
