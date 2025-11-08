import { supabase } from '../lib/supabaseClient';
import { CollaborationSession, Message } from '../types';

class CollaborationService {
  private sessionId: string | null = null;
  private projectId: string | null = null;
  private channel: any = null;
  private onMessageReceived: ((message: Message) => void) | null = null;
  private onUserJoined: ((userId: string, userName: string) => void) | null = null;
  private onUserLeft: ((userId: string) => void) | null = null;
  private onCursorUpdate: ((userId: string, cursor: any) => void) | null = null;

  async joinSession(projectId: string, userName: string): Promise<void> {
    this.projectId = projectId;

    // Create or join collaboration session
    const { data: session, error } = await supabase
      .from('collaboration_sessions')
      .upsert({
        project_id: projectId,
        last_activity: Date.now()
      }, {
        onConflict: 'project_id'
      })
      .select()
      .single();

    if (error) throw error;
    this.sessionId = session.id;

    // Join the realtime channel
    this.channel = supabase.channel(`project-${projectId}`)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        if (this.onMessageReceived) {
          this.onMessageReceived(payload.message);
        }
      })
      .on('broadcast', { event: 'user-joined' }, ({ payload }) => {
        if (this.onUserJoined) {
          this.onUserJoined(payload.userId, payload.userName);
        }
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        if (this.onUserLeft) {
          this.onUserLeft(payload.userId);
        }
      })
      .on('broadcast', { event: 'cursor-update' }, ({ payload }) => {
        if (this.onCursorUpdate) {
          this.onCursorUpdate(payload.userId, payload.cursor);
        }
      })
      .subscribe();

    // Announce user joined
    await this.channel.send({
      type: 'broadcast',
      event: 'user-joined',
      payload: { userId: supabase.auth.user()?.id, userName }
    });
  }

  async leaveSession(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.sessionId = null;
    this.projectId = null;
  }

  async sendMessage(message: Message): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'message',
      payload: { message }
    });
  }

  async updateCursor(cursor: { line: number; column: number; file: string }): Promise<void> {
    if (!this.channel) return;

    await this.channel.send({
      type: 'broadcast',
      event: 'cursor-update',
      payload: {
        userId: supabase.auth.user()?.id,
        cursor
      }
    });
  }

  // Event listeners
  setMessageHandler(handler: (message: Message) => void) {
    this.onMessageReceived = handler;
  }

  setUserJoinedHandler(handler: (userId: string, userName: string) => void) {
    this.onUserJoined = handler;
  }

  setUserLeftHandler(handler: (userId: string) => void) {
    this.onUserLeft = handler;
  }

  setCursorUpdateHandler(handler: (userId: string, cursor: any) => void) {
    this.onCursorUpdate = handler;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getProjectId(): string | null {
    return this.projectId;
  }
}

export const collaborationService = new CollaborationService();