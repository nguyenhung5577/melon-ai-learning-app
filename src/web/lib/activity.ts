/**
 * Kid activity types and localStorage-backed store for parental dashboard.
 * Events can be pushed from VideoCard, ExperiencePlayer, etc. when we wire them.
 */

export type ActivityType = "video_view" | "experience_start" | "experience_complete" | "experience_checkpoint"

export type ActivityEvent = {
  id: string
  type: ActivityType
  at: string // ISO date
  /** Video or experience title */
  title: string
  /** For videos: duration in seconds; for experiences: optional */
  durationSeconds?: number
  /** Watch time in seconds (how long they actually watched) */
  watchTimeSeconds?: number
  /** Category or channel */
  category?: string
  /** Episode id for experiences */
  episodeId?: string
  /** Skills/concepts practised (from interactive experiences) */
  skills?: string[]
}

const STORAGE_KEY = "coco-activity"

function getEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function setEvents(events: ActivityEvent[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {}
}

/** Append an activity event (call from player/cards when we add tracking). */
export function pushActivity(event: Omit<ActivityEvent, "id" | "at">) {
  const events = getEvents()
  events.unshift({
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    at: new Date().toISOString(),
  })
  setEvents(events.slice(0, 500))
}

export function getActivityEvents(): ActivityEvent[] {
  return getEvents()
}

/** Seed demo data if storage is empty. */
export function seedDemoActivityIfEmpty() {
  const events = getEvents()
  if (events.length > 0) return
  const now = new Date()
  const demo: ActivityEvent[] = [
    {
      id: "1",
      type: "experience_complete",
      at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      title: "Teddy's Garden: Fruit Quest",
      watchTimeSeconds: 420,
      category: "Learning",
      episodeId: "teddy_garden_fruit_quest",
      skills: ["Counting", "Fruits", "Nature"],
    },
    {
      id: "2",
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      title: "Amazing Space Facts for Kids - Journey Through the Solar System",
      durationSeconds: 754,
      watchTimeSeconds: 320,
      category: "Space",
    },
    {
      id: "3",
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      title: "Learn to Draw Cute Animals - Easy Step by Step Tutorial",
      durationSeconds: 1100,
      watchTimeSeconds: 600,
      category: "Art",
    },
    {
      id: "4",
      type: "experience_start",
      at: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      title: "Lumi's Nature Lab: How Plants Make Food!",
      category: "Learning",
      episodeId: "lumi_nature_lab",
      skills: ["Plants", "Science"],
    },
    {
      id: "5",
      type: "video_view",
      at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      title: "Dinosaur Documentary - T-Rex and Friends",
      durationSeconds: 1330,
      watchTimeSeconds: 900,
      category: "Dinosaurs",
    },
  ]
  setEvents(demo)
}

/** Aggregate watch time in seconds for a given day (ISO date string YYYY-MM-DD). */
export function getWatchTimeByDay(events: ActivityEvent[], days: number): { date: string; minutes: number }[] {
  const byDay: Record<string, number> = {}
  const today = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    byDay[d.toISOString().slice(0, 10)] = 0
  }
  for (const e of events) {
    const day = e.at.slice(0, 10)
    if (!(day in byDay)) continue
    const sec = e.watchTimeSeconds ?? e.durationSeconds ?? 0
    byDay[day] += sec
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sec]) => ({ date, minutes: Math.round(sec / 60) }))
}

/** Total watch time today (seconds). */
export function getTodayWatchTimeSeconds(events: ActivityEvent[]): number {
  const today = new Date().toISOString().slice(0, 10)
  return events
    .filter((e) => e.at.startsWith(today))
    .reduce((sum, e) => sum + (e.watchTimeSeconds ?? e.durationSeconds ?? 0), 0)
}

/** Count experiences completed (any day). */
export function getExperiencesCompletedCount(events: ActivityEvent[]): number {
  return events.filter((e) => e.type === "experience_complete").length
}

/** Concept/skill with episodes that practised it, for parent recall. */
export type ConceptToReinforce = {
  /** Skill or category name */
  concept: string
  /** Episode titles that practised this concept (most recent first) */
  titles: string[]
  /** When they last did something with this concept (ISO) */
  lastAt: string
}

/**
 * From completed experiences, derive concepts/skills to reinforce.
 * Parents can use this to help kids recall and solidify what they learnt.
 */
export function getConceptsToReinforce(events: ActivityEvent[]): ConceptToReinforce[] {
  const completed = events.filter((e) => e.type === "experience_complete")
  const byConcept = new Map<string, { titles: string[]; lastAt: string }>()
  for (const e of completed) {
    const concepts = e.skills?.length ? e.skills : e.category ? [e.category] : []
    if (concepts.length === 0) continue
    for (const c of concepts) {
      const key = c.trim()
      if (!key) continue
      const existing = byConcept.get(key)
      if (!existing) {
        byConcept.set(key, { titles: [e.title], lastAt: e.at })
      } else {
        if (!existing.titles.includes(e.title)) existing.titles.unshift(e.title)
        if (e.at > existing.lastAt) existing.lastAt = e.at
      }
    }
  }
  return Array.from(byConcept.entries())
    .map(([concept, { titles, lastAt }]) => ({ concept, titles, lastAt }))
    .sort((a, b) => (b.lastAt > a.lastAt ? 1 : -1))
}
