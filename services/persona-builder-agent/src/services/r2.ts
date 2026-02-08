/**
 * Cloudflare R2 Storage Service
 *
 * Handles uploading and managing persona images in Cloudflare R2.
 * Uses AWS S3-compatible SDK.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getConfig } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

// Lazy-initialized R2 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    const config = getConfig();
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });
    console.log('✅ R2 client initialized');
  }
  return r2Client;
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload an image to R2
 *
 * @param base64Data - Base64 encoded image data
 * @param mimeType - Image MIME type (e.g., 'image/png')
 * @param folder - Folder path in bucket (e.g., 'avatars', 'skins')
 * @returns Public URL and storage key
 */
export async function uploadImage(
  base64Data: string,
  mimeType: string,
  folder: string = 'avatars'
): Promise<UploadResult> {
  const config = getConfig();
  const client = getR2Client();

  // Generate unique filename
  const extension = mimeType.split('/')[1] || 'png';
  const filename = `${uuidv4()}.${extension}`;
  const key = `${folder}/${filename}`;

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  console.log(`\n☁️  [R2] ========== UPLOADING TO R2 ==========`);
  console.log(`[R2] Folder: ${folder}`);
  console.log(`[R2] Filename: ${filename}`);
  console.log(`[R2] Key: ${key}`);
  console.log(`[R2] Size: ${Math.round(buffer.length / 1024)}KB`);
  console.log(`[R2] Content-Type: ${mimeType}`);
  console.log(`[R2] Bucket: ${config.R2_BUCKET_NAME}`);

  const startTime = Date.now();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // Make publicly readable
        ACL: 'public-read',
      })
    );

    const duration = Date.now() - startTime;
    const url = `${config.R2_PUBLIC_URL}/${key}`;

    console.log(`[R2] ✅ Upload successful in ${duration}ms!`);
    console.log(`[R2] 🔗 PUBLIC URL: ${url}`);
    console.log(`[R2] =========================================\n`);

    return { url, key };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[R2] ❌ Upload failed after ${duration}ms:`, error);
    console.log(`[R2] =========================================\n`);
    throw new Error(`Failed to upload image: ${error}`);
  }
}

/**
 * Options for avatar upload with user organization
 */
export interface AvatarUploadOptions {
  /** User ID if logged in (for organizing by user) */
  userId?: string | null;
  /** Persona ID if editing existing persona */
  personaId?: string | null;
  /** Session ID for anonymous users (keeps all session images together) */
  sessionId?: string;
}

/**
 * Upload an avatar image organized by user
 *
 * Path structure:
 * - Logged in: /avatars/<userId>/<personaId>/<filename>.png
 * - Not logged in: /avatars/session-<sessionId>/<filename>.png
 *
 * @param base64Data - Base64 encoded image data
 * @param mimeType - Image MIME type
 * @param options - Upload options including userId, personaId, and sessionId
 * @returns Public URL
 */
export async function uploadAvatar(
  base64Data: string,
  mimeType: string,
  options: AvatarUploadOptions = {}
): Promise<string> {
  const { userId, personaId, sessionId } = options;

  let folder: string;

  if (userId) {
    // Logged in user: /avatars/<userId>/<personaId>/
    const personaFolder = personaId || `draft-${uuidv4()}`;
    folder = `avatars/${userId}/${personaFolder}`;
    console.log(`[R2] Organizing avatar for logged user: ${userId}`);
  } else {
    // Not logged in: use sessionId to keep all edits together
    const anonymousId = sessionId ? `session-${sessionId}` : `anon-${uuidv4()}`;
    folder = `avatars/${anonymousId}`;
    console.log(`[R2] Organizing avatar for anonymous session: ${anonymousId}`);
  }

  const result = await uploadImage(base64Data, mimeType, folder);
  return result.url;
}

/**
 * Options for skin upload with user organization
 */
export interface SkinUploadOptions {
  /** User ID if logged in */
  userId?: string | null;
  /** Persona ID if editing existing persona */
  personaId?: string | null;
  /** Session ID for anonymous users (keeps all session images together) */
  sessionId?: string;
}

/**
 * Upload a Minecraft skin organized by user
 *
 * Path structure:
 * - Logged in: /skins/<userId>/<personaId>/<filename>.png
 * - Not logged in: /skins/session-<sessionId>/<filename>.png
 *
 * @param base64Data - Base64 encoded skin image
 * @param mimeType - Image MIME type
 * @param options - Upload options including userId, personaId, and sessionId
 * @returns Public URL
 */
export async function uploadMinecraftSkin(
  base64Data: string,
  mimeType: string,
  options: SkinUploadOptions = {}
): Promise<string> {
  const { userId, personaId, sessionId } = options;

  let folder: string;

  if (userId) {
    // Logged in user: /skins/<userId>/<personaId>/
    const personaFolder = personaId || `draft-${uuidv4()}`;
    folder = `skins/${userId}/${personaFolder}`;
    console.log(`[R2] Organizing skin for logged user: ${userId}`);
  } else {
    // Not logged in: use sessionId to keep all edits together
    const anonymousId = sessionId ? `session-${sessionId}` : `anon-${uuidv4()}`;
    folder = `skins/${anonymousId}`;
    console.log(`[R2] Organizing skin for anonymous session: ${anonymousId}`);
  }

  const result = await uploadImage(base64Data, mimeType, folder);
  return result.url;
}

/**
 * Delete an image from R2
 *
 * @param key - Storage key (e.g., 'avatars/uuid.png')
 */
export async function deleteImage(key: string): Promise<void> {
  const config = getConfig();
  const client = getR2Client();

  console.log(`[R2] Deleting ${key}`);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: key,
      })
    );
    console.log(`[R2] Delete successful: ${key}`);
  } catch (error) {
    console.error('[R2] Delete failed:', error);
    throw new Error(`Failed to delete image: ${error}`);
  }
}

/**
 * Extract storage key from public URL
 *
 * @param url - Public R2 URL
 * @returns Storage key or null if not a valid R2 URL
 */
export function extractKeyFromUrl(url: string): string | null {
  const config = getConfig();
  const prefix = config.R2_PUBLIC_URL + '/';

  if (url.startsWith(prefix)) {
    return url.substring(prefix.length);
  }

  return null;
}
