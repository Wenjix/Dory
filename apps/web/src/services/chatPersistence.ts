/**
 * Chat Persistence Service
 * 
 * Handles storage and retrieval of chat history in localStorage
 */

export interface PersistedMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

export interface ChatSession {
  sessionId: string
  messages: PersistedMessage[]
  lastUpdated: number
}

const STORAGE_KEY_PREFIX = 'dory_chat_'
const MAX_AGE_DAYS = 7
const MAX_SESSIONS = 10

/**
 * Generates a unique session ID based on the device/user
 */
export function generateSessionId(): string {
  const stored = localStorage.getItem('dory_session_id')
  if (stored) {
    return stored
  }
  
  const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  localStorage.setItem('dory_session_id', newId)
  return newId
}

/**
 * Gets the storage key for a session
 */
function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`
}

/**
 * Saves chat history to localStorage
 */
export function saveChatHistory(sessionId: string, messages: PersistedMessage[]): void {
  try {
    const session: ChatSession = {
      sessionId,
      messages,
      lastUpdated: Date.now()
    }
    
    localStorage.setItem(getStorageKey(sessionId), JSON.stringify(session))
    
    // Clean up old sessions
    cleanupOldSessions()
  } catch (error) {
    console.error('Error saving chat history:', error)
  }
}

/**
 * Loads chat history from localStorage
 */
export function loadChatHistory(sessionId: string): PersistedMessage[] {
  try {
    const stored = localStorage.getItem(getStorageKey(sessionId))
    if (!stored) {
      return []
    }
    
    const session: ChatSession = JSON.parse(stored)
    return session.messages || []
  } catch (error) {
    console.error('Error loading chat history:', error)
    return []
  }
}

/**
 * Deletes chat history from a session
 */
export function clearChatHistory(sessionId: string): void {
  try {
    localStorage.removeItem(getStorageKey(sessionId))
  } catch (error) {
    console.error('Error clearing chat history:', error)
  }
}

/**
 * Gets all stored sessions
 */
export function getAllSessions(): ChatSession[] {
  const sessions: ChatSession[] = []
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const stored = localStorage.getItem(key)
        if (stored) {
          sessions.push(JSON.parse(stored))
        }
      }
    }
  } catch (error) {
    console.error('Error getting all sessions:', error)
  }
  
  return sessions
}

/**
 * Cleans up old sessions and keeps only the most recent ones
 */
export function cleanupOldSessions(): void {
  try {
    const sessions = getAllSessions()
    const now = Date.now()
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    
    // Filter sessions by age
    const validSessions = sessions.filter(session => {
      const age = now - session.lastUpdated
      return age < maxAge
    })
    
    // If there are too many sessions, keep only the most recent ones
    if (validSessions.length > MAX_SESSIONS) {
      validSessions.sort((a, b) => b.lastUpdated - a.lastUpdated)
      const toRemove = validSessions.slice(MAX_SESSIONS)
      
      toRemove.forEach(session => {
        localStorage.removeItem(getStorageKey(session.sessionId))
      })
    }
    
    // Remove old sessions
    sessions.forEach(session => {
      const age = now - session.lastUpdated
      if (age >= maxAge) {
        localStorage.removeItem(getStorageKey(session.sessionId))
      }
    })
  } catch (error) {
    console.error('Error cleaning up old sessions:', error)
  }
}

/**
 * Saves the expansion state of the panel
 */
export function saveExpandedState(isExpanded: boolean): void {
  try {
    localStorage.setItem('dory_chat_expanded', String(isExpanded))
  } catch (error) {
    console.error('Error saving expanded state:', error)
  }
}

/**
 * Loads the expansion state of the panel
 */
export function loadExpandedState(): boolean {
  try {
    const stored = localStorage.getItem('dory_chat_expanded')
    return stored === 'true'
  } catch (error) {
    console.error('Error loading expanded state:', error)
    return false
  }
}


