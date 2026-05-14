import { subcollections } from "@/lib/db/firestore";
import { addDocument, queryDocuments } from "@/lib/db/firestore-helpers";
import { orderBy } from "firebase/firestore";

export type ActivityType = "video_view" | "experience_start" | "experience_complete" | "experience_checkpoint";

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  at: string; // ISO date
  title: string;
  durationSeconds?: number;
  watchTimeSeconds?: number;
  category?: string;
  episodeId?: string;
  skills?: string[];
};

export async function pushActivity(uid: string, event: Omit<ActivityEvent, "id" | "at">): Promise<void> {
  const newEvent = {
    ...event,
    at: new Date().toISOString(),
  };
  await addDocument(subcollections.activityEvents(uid), newEvent);
}

/**
 * Log a lesson completion event (maps lesson data to ActivityEvent shape).
 */
export async function logActivityEvent(
  uid: string,
  payload: { type: string; lessonId: string; subject: string; score: number; xpEarned: number }
): Promise<void> {
  await pushActivity(uid, {
    type: "experience_complete",
    title: payload.lessonId,
    category: payload.subject,
    skills: [payload.subject],
    episodeId: payload.lessonId,
    watchTimeSeconds: 0,
  });
}

export async function getActivityEvents(uid: string): Promise<ActivityEvent[]> {
  try {
    return await queryDocuments(subcollections.activityEvents(uid), orderBy("at", "desc"));
  } catch {
    return [];
  }
}

export async function seedDemoActivityIfEmpty(uid: string): Promise<void> {
  const events = await getActivityEvents(uid);
  if (events.length > 0) return;
  const now = new Date();
  const demo: Omit<ActivityEvent, "id">[] = [
    {
      type: "experience_complete",
      at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      title: "Teddy's Garden: Fruit Quest",
      watchTimeSeconds: 420,
      category: "Learning",
      episodeId: "teddy_garden_fruit_quest",
      skills: ["Counting", "Fruits", "Nature"],
    },
    {
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      title: "Amazing Space Facts for Kids - Journey Through the Solar System",
      durationSeconds: 754,
      watchTimeSeconds: 320,
      category: "Space",
    },
    {
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      title: "Learn to Draw Cute Animals - Easy Step by Step Tutorial",
      durationSeconds: 1100,
      watchTimeSeconds: 600,
      category: "Art",
    },
    {
      type: "experience_start",
      at: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      title: "Lumi's Nature Lab: How Plants Make Food!",
      category: "Learning",
      episodeId: "lumi_nature_lab",
      skills: ["Plants", "Science"],
    },
    {
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      title: "Dinosaur Documentary - T-Rex and Friends",
      durationSeconds: 1330,
      watchTimeSeconds: 900,
      category: "Dinosaurs",
    },
  ];
  for (const event of demo) {
    await addDocument(subcollections.activityEvents(uid), event);
  }
}

export function getWatchTimeByDay(events: ActivityEvent[], days: number): { date: string; minutes: number }[] {
  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const e of events) {
    const day = e.at.slice(0, 10);
    if (!(day in byDay)) continue;
    const sec = e.watchTimeSeconds ?? e.durationSeconds ?? 0;
    byDay[day] += sec;
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sec]) => ({ date, minutes: Math.round(sec / 60) }));
}

export function getTodayWatchTimeSeconds(events: ActivityEvent[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((e) => e.at.startsWith(today))
    .reduce((sum, e) => sum + (e.watchTimeSeconds ?? e.durationSeconds ?? 0), 0);
}

export function getExperiencesCompletedCount(events: ActivityEvent[]): number {
  return events.filter((e) => e.type === "experience_complete").length;
}

export type ConceptToReinforce = {
  concept: string;
  titles: string[];
  lastAt: string;
};

export function getConceptsToReinforce(events: ActivityEvent[]): ConceptToReinforce[] {
  const completed = events.filter((e) => e.type === "experience_complete");
  const byConcept = new Map<string, { titles: string[]; lastAt: string }>();
  for (const e of completed) {
    const concepts = e.skills?.length ? e.skills : e.category ? [e.category] : [];
    if (concepts.length === 0) continue;
    for (const c of concepts) {
      const key = c.trim();
      if (!key) continue;
      const existing = byConcept.get(key);
      if (!existing) {
        byConcept.set(key, { titles: [e.title], lastAt: e.at });
      } else {
        if (!existing.titles.includes(e.title)) existing.titles.unshift(e.title);
        if (e.at > existing.lastAt) existing.lastAt = e.at;
      }
    }
  }
  return Array.from(byConcept.entries())
    .map(([concept, { titles, lastAt }]) => ({ concept, titles, lastAt }))
    .sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1));
}
