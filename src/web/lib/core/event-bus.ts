type EventMap = {
  "xp:earned":        { amount: number; reason: string };
  "badge:unlocked":   { badgeId: string; name: string };
  "lesson:completed": { lessonId: string; score: number };
  "quiz:completed":   { lessonId: string; score: number; total: number };
  "auth:signedIn":    { uid: string; role: "kid" | "parent" | "admin" };
  "auth:signedOut":   Record<string, never>;
  "tts:played":       { text: string };
};

type EventHandler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

class EventBus {
  private listeners: Partial<{
    [K in keyof EventMap]: EventHandler<K>[];
  }> = {};

  on<K extends keyof EventMap>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners[event]) {
      (this.listeners as Record<K, EventHandler<K>[]>)[event] = [];
    }
    (this.listeners[event] as EventHandler<K>[]).push(handler);

    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<K>): void {
    const list = this.listeners[event] as EventHandler<K>[] | undefined;
    if (!list) return;
    (this.listeners as Record<K, EventHandler<K>[]>)[event] = list.filter(
      (h) => h !== handler
    );
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const list = this.listeners[event] as EventHandler<K>[] | undefined;
    list?.forEach((h) => h(payload));
  }
}

export const bus = new EventBus();
