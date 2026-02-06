/**
 * Room Token Route
 *
 * Generate LiveKit room tokens for clients to connect.
 * Simplified: no auth required (hackathon mode).
 * Future: add JWT auth when integrating with frontend.
 */

import { Router, Request, Response } from 'express';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';

export function createRoomTokenRouter(): Router {
  const router = Router();

  /**
   * POST /api/room-token
   *
   * Body:
   *   - roomName: string (optional, auto-generated if missing)
   *   - identity: string (optional, defaults to "user-<uuid>")
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
      const identity = req.body.identity || `user-${uuidv4().slice(0, 8)}`;

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

      const token = await at.toJwt();

      console.log(`[RoomToken] Generated token for ${identity} in room ${roomName}`);

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
