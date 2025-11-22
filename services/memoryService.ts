import { supabase } from '../lib/supabaseClient';
import { MemoryEntry } from '../types';

class MemoryService {
  private cache = new Map<string, MemoryEntry>();

  async storeMemory(projectId: string, type: MemoryEntry['type'], key: string, value: any, ttlMinutes?: number): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('User not authenticated');

    const memoryEntry: Omit<MemoryEntry, 'id'> = {
      projectId,
      userId,
      type,
      key,
      value,
      timestamp: Date.now(),
      expiresAt: ttlMinutes ? Date.now() + (ttlMinutes * 60 * 1000) : undefined
    };

    const { error } = await supabase
      .from('ai_memory')
      .upsert({
        project_id: projectId,
        user_id: userId,
        type,
        key,
        value: JSON.stringify(value),
        timestamp: memoryEntry.timestamp,
        expires_at: memoryEntry.expiresAt
      }, {
        onConflict: 'project_id,user_id,type,key'
      });

    if (error) throw error;

    // Update local cache
    const cacheKey = `${projectId}-${userId}-${type}-${key}`;
    this.cache.set(cacheKey, { ...memoryEntry, id: cacheKey });
  }

  async retrieveMemory(projectId: string, type: MemoryEntry['type'], key: string): Promise<any | null> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return null;

    const cacheKey = `${projectId}-${userId}-${type}-${key}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (!cached.expiresAt || cached.expiresAt > Date.now())) {
      return cached.value;
    }

    const { data, error } = await supabase
      .from('ai_memory')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('type', type)
      .eq('key', key)
      .gt('expires_at', Date.now())
      .single();

    if (error || !data) return null;

    const value = JSON.parse(data.value);
    const memoryEntry: MemoryEntry = {
      id: data.id,
      projectId: data.project_id,
      userId: data.user_id,
      type: data.type,
      key: data.key,
      value,
      timestamp: data.timestamp,
      expiresAt: data.expires_at
    };

    this.cache.set(cacheKey, memoryEntry);
    return value;
  }

  async getMemoriesByType(projectId: string, type: MemoryEntry['type']): Promise<MemoryEntry[]> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('ai_memory')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('type', type)
      .gt('expires_at', Date.now())
      .order('timestamp', { ascending: false });

    if (error) return [];

    return data.map(item => ({
      id: item.id,
      projectId: item.project_id,
      userId: item.user_id,
      type: item.type,
      key: item.key,
      value: JSON.parse(item.value),
      timestamp: item.timestamp,
      expiresAt: item.expires_at
    }));
  }

  async cleanupExpiredMemories(): Promise<void> {
    const { error } = await supabase
      .from('ai_memory')
      .delete()
      .lt('expires_at', Date.now());

    if (error) console.error('Failed to cleanup expired memories:', error);
  }

  async getConversationContext(projectId: string): Promise<any[]> {
    const memories = await this.getMemoriesByType(projectId, 'conversation_context');
    return memories
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10) // Keep only last 10 conversation contexts
      .map(m => m.value);
  }

  async storeUserPreference(projectId: string, key: string, value: any): Promise<void> {
    await this.storeMemory(projectId, 'user_preference', key, value);
  }

  async getUserPreference(projectId: string, key: string): Promise<any | null> {
    return await this.retrieveMemory(projectId, 'user_preference', key);
  }

  async storeCodePattern(projectId: string, pattern: string, context: any): Promise<void> {
    await this.storeMemory(projectId, 'code_pattern', pattern, context, 60 * 24 * 7); // 7 days TTL
  }

  async getCodePatterns(projectId: string): Promise<any[]> {
    const memories = await this.getMemoriesByType(projectId, 'code_pattern');
    return memories.map(m => m.value);
  }

  async storeErrorContext(projectId: string, error: string, context: any): Promise<void> {
    await this.storeMemory(projectId, 'error_context', error, context, 60 * 24); // 24 hours TTL
  }

  async getErrorContexts(projectId: string): Promise<any[]> {
    const memories = await this.getMemoriesByType(projectId, 'error_context');
    return memories.map(m => m.value);
  }
}

export const memoryService = new MemoryService();