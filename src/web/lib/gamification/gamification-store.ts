/**
 * GamificationModule — Phase 1 mock using localStorage.
 * Mirrors SAD Section 3.6 GamificationModule.
 */

const XP_KEY  = "melon:xp";
const BADGE_KEY = "melon:badges";

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  xpThreshold?: number;
  earnedAt?: string;
  locked: boolean;
}

export const ALL_BADGES: Badge[] = [
  { id: "first-lesson", name: "First Step",   emoji: "👣", color: "#b497ff", description: "Complete your first lesson",         locked: true },
  { id: "quiz-ace",     name: "Quiz Ace",      emoji: "🎯", color: "#ff914d", description: "Score 100% on any quiz",             locked: true },
  { id: "streak-3",     name: "3-Day Streak",  emoji: "🔥", color: "#ff914d", description: "Learn 3 days in a row",             locked: true },
  { id: "xp-500",       name: "XP Climber",    emoji: "🚀", color: "#38b6ff", description: "Earn 500 XP",   xpThreshold: 500,  locked: true },
  { id: "xp-1000",      name: "XP Master",     emoji: "⭐", color: "#ffde59", description: "Earn 1000 XP",  xpThreshold: 1000, locked: true },
  { id: "science",      name: "Science Nerd",  emoji: "🔬", color: "#22c55e", description: "Complete all science lessons",       locked: true },
  { id: "coder",        name: "Code Wizard",   emoji: "💻", color: "#ffde59", description: "Complete a coding lesson",           locked: true },
  { id: "reader",       name: "Book Worm",     emoji: "📚", color: "#b497ff", description: "Complete 3 English lessons",        locked: true },
];

export interface XpEntry {
  amount: number;
  reason: string;
  lessonId?: string;
  timestamp: string;
}

export interface GamificationData {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  entries: XpEntry[];
  earnedBadgeIds: string[];
}

function computeLevel(xp: number): { level: number; xpToNextLevel: number } {
  const level = Math.floor(xp / 200) + 1;
  const xpToNextLevel = (level * 200) - xp;
  return { level, xpToNextLevel };
}

export const gamificationStore = {
  getData(uid: string): GamificationData {
    try {
      const xpRaw    = localStorage.getItem(`${XP_KEY}:${uid}`);
      const badgeRaw = localStorage.getItem(`${BADGE_KEY}:${uid}`);
      const entries: XpEntry[] = xpRaw ? JSON.parse(xpRaw) : [];
      const earnedBadgeIds: string[] = badgeRaw ? JSON.parse(badgeRaw) : [];
      const totalXp = entries.reduce((s, e) => s + e.amount, 0);
      const { level, xpToNextLevel } = computeLevel(totalXp);
      return { totalXp, level, xpToNextLevel, entries, earnedBadgeIds };
    } catch {
      return { totalXp: 0, level: 1, xpToNextLevel: 200, entries: [], earnedBadgeIds: [] };
    }
  },

  addXp(uid: string, amount: number, reason: string, lessonId?: string): GamificationData {
    const data = this.getData(uid);
    const newEntry: XpEntry = {
      amount, reason, lessonId,
      timestamp: new Date().toISOString(),
    };
    data.entries.push(newEntry);
    localStorage.setItem(`${XP_KEY}:${uid}`, JSON.stringify(data.entries));

    const newTotal = data.totalXp + amount;
    const { level, xpToNextLevel } = computeLevel(newTotal);

    // Auto-unlock XP-threshold badges
    const toUnlock = ALL_BADGES.filter(
      (b) => b.xpThreshold && b.xpThreshold <= newTotal && !data.earnedBadgeIds.includes(b.id)
    );
    toUnlock.forEach((b) => this.unlockBadge(uid, b.id));

    return { ...data, totalXp: newTotal, level, xpToNextLevel };
  },

  unlockBadge(uid: string, badgeId: string): void {
    const raw = localStorage.getItem(`${BADGE_KEY}:${uid}`);
    const earned: string[] = raw ? JSON.parse(raw) : [];
    if (!earned.includes(badgeId)) {
      earned.push(badgeId);
      localStorage.setItem(`${BADGE_KEY}:${uid}`, JSON.stringify(earned));
    }
  },

  getBadges(uid: string): Badge[] {
    const data = this.getData(uid);
    return ALL_BADGES.map((b) => ({
      ...b,
      locked: !data.earnedBadgeIds.includes(b.id),
      earnedAt: data.earnedBadgeIds.includes(b.id)
        ? new Date().toISOString()
        : undefined,
    }));
  },

  seedDemoData(uid: string): void {
    if (this.getData(uid).totalXp > 0) return;
    const entries: XpEntry[] = [
      { amount: 150, reason: "Completed: What is Photosynthesis?", lessonId: "lesson-001", timestamp: "2026-04-20T09:00:00Z" },
      { amount: 50,  reason: "Quiz bonus",                         timestamp: "2026-04-20T09:15:00Z" },
      { amount: 180, reason: "Completed: Fractions Made Easy",     lessonId: "lesson-002", timestamp: "2026-04-21T10:00:00Z" },
      { amount: 120, reason: "Completed: The Water Cycle",         lessonId: "lesson-003", timestamp: "2026-04-22T08:30:00Z" },
    ];
    localStorage.setItem(`${XP_KEY}:${uid}`, JSON.stringify(entries));
    localStorage.setItem(`${BADGE_KEY}:${uid}`, JSON.stringify(["first-lesson", "science"]));
  },
};
