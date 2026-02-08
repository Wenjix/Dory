/**
 * Room Token Route
 *
 * Generate LiveKit room tokens for clients to connect.
 * Simplified: no auth required (hackathon mode).
 * Future: add JWT auth when integrating with frontend.
 */

import { Router, Request, Response } from 'express';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { v4 as uuidv4 } from 'uuid';

export function createRoomTokenRouter(): Router {
  const router = Router();

  /**
   * POST /api/room-token
   *
   * Body:
   *   - roomName: string (optional, auto-generated if missing)
   *   - identity: string (optional, defaults to "user-123")
   *   - personaId: string (optional, persona to load for the voice agent)
   *   - conversationSummary: string (optional, summary from previous agent)
   *
   * Response:
   *   - token: string (LiveKit access token)
   *   - roomName: string
   *   - wsUrl: string (LiveKit WebSocket URL)
   *   - identity: string
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const roomName = req.body.roomName || `dory-${uuidv4().slice(0, 8)}`;
      const identity = req.body.identity || 'user-123';
      const { personaId, conversationSummary } = req.body;

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const wsUrl = process.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret || !wsUrl) {
        return res.status(500).json({
          error: 'LiveKit credentials not configured',
        });
      }

      const at = new AccessToken(apiKey, apiSecret, {
        identity,
        name: identity,
      });
      at.ttl = '10m';

      const grant: VideoGrant = {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
      };
      at.addGrant(grant);

      // Build dispatch metadata with persona and conversation context
      const dispatchMetadata: Record<string, string> = {};
      if (personaId && typeof personaId === 'string') {
        dispatchMetadata.personaId = personaId;
      }
      if (conversationSummary && typeof conversationSummary === 'string') {
        dispatchMetadata.conversationSummary = conversationSummary;
      }

      // Explicit agent dispatch — when this participant connects,
      // LiveKit will dispatch the 'dory-voice' agent to the room.
      // This is more reliable than automatic dispatch (avoids race conditions).
      at.roomConfig = new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: 'dory-voice',
            metadata: Object.keys(dispatchMetadata).length > 0
              ? JSON.stringify(dispatchMetadata)
              : '',
          }),
        ],
      });

      const token = await at.toJwt();

      console.log(`[RoomToken] Generated token for ${identity} in room ${roomName}${personaId ? `, persona: ${personaId}` : ''}`);

      return res.json({
        token,
        roomName,
        wsUrl,
        identity,
      });
    } catch (error) {
      console.error('[RoomToken] Failed to generate token:', error);
      return res.status(500).json({
        error: 'Failed to generate room token',
      });
    }
  });

  return router;
}
