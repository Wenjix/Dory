/**
 * MongoDB Database Connection
 *
 * Handles connection to local MongoDB (Docker) and provides
 * typed collection accessors.
 */

import { MongoClient, Db, Collection } from 'mongodb';
import type { Memory, MemorySummary } from './types.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dory';

let client: MongoClient | null = null;
let db: Db | null = null;

// ---------------------------------------------------------------------------
// Connect / Disconnect
// ---------------------------------------------------------------------------

export async function connectDatabase(): Promise<Db> {
  if (db) {
    console.log('[Memory DB] Already connected to MongoDB');
    return db;
  }

  try {
    const safeUri = MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Memory DB] Connecting to MongoDB...`);
    console.log(`[Memory DB] URI: ${safeUri}`);

    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB isn't running
      connectTimeoutMS: 5000,
    });
    await client.connect();

    // Extract DB name from URI or default to 'dory'
    db = client.db();
    console.log(`[Memory DB] Connected to MongoDB (database: ${db.databaseName})`);

    await createIndexes();
    return db;
  } catch (error) {
    console.error('[Memory DB] Failed to connect to MongoDB:', error);
    throw error;
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[Memory DB] Connection closed');
  }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export function getMemoriesCollection(): Collection<Memory> {
  return getDatabase().collection<Memory>('memories');
}

export function getSummariesCollection(): Collection<MemorySummary> {
  return getDatabase().collection<MemorySummary>('memory_summaries');
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

async function createIndexes(): Promise<void> {
  if (!db) return;

  try {
    console.log('[Memory DB] Creating indexes...');

    const memories = getMemoriesCollection();
    await memories.createIndex({ sessionId: 1, type: 1, timestamp: -1 });
    await memories.createIndex({ userId: 1, type: 1 });
    await memories.createIndex({ tags: 1 });
    await memories.createIndex({ importance: -1, lastAccessed: -1 });

    const summaries = getSummariesCollection();
    await summaries.createIndex({ userId: 1, summaryType: 1, 'period.end': -1 });
    await summaries.createIndex({ 'period.sessionId': 1, summaryType: 1 });

    console.log('[Memory DB] Indexes created');
  } catch (error) {
    console.error('[Memory DB] Error creating indexes (may already exist):', error);
    // Don't throw — indexes might already exist
  }
}
