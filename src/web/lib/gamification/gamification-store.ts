import { collections } from "@/lib/db/firestore";
import { getDocument, setDocument, updateDocument } from "@/lib/db/firestore-helpers";
import { arrayUnion } from "firebase/firestore";

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
  { id: "first-lesson", name: "Bước đầu", emoji: "👣", color: "#b497ff", description: "Hoàn thành bài học đầu tiên", locked: true },
  { id: "quiz-ace", name: "Chọn chuẩn", emoji: "🎯", color: "#ff914d", description: "Đạt 100% ở một bài kiểm tra", locked: true },
  { id: "streak-3", name: "3 ngày liền", emoji: "🔥", color: "#ff914d", description: "Học 3 ngày liên tiếp", locked: true },
  { id: "xp-500", name: "Leo XP", emoji: "🚀", color: "#38b6ff", description: "Đạt 500 XP", xpThreshold: 500, locked: true },
  { id: "xp-1000", name: "Bậc thầy XP", emoji: "⭐", color: "#ffde59", description: "Đạt 1000 XP", xpThreshold: 1000, locked: true },
  { id: "fractions", name: "Anh hùng phân số", emoji: "🍉", color: "#ff914d", description: "Hoàn thành 3 bài phân số", locked: true },
  { id: "word-problem", name: "Đọc đề giỏi", emoji: "🔎", color: "#22c55e", description: "Hoàn thành bài toán có lời văn", locked: true },
  { id: "geometry", name: "Bạn của hình học", emoji: "📐", color: "#38b6ff", description: "Hoàn thành bài hình học", locked: true },
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
  async getData(uid: string): Promise<GamificationData> {
    const doc = await getDocument(collections.gamification, uid);
    if (doc) return doc;
    return { totalXp: 0, level: 1, xpToNextLevel: 200, entries: [], earnedBadgeIds: [] };
  },

  async addXp(uid: string, amount: number, reason: string, lessonId?: string): Promise<GamificationData> {
    const data = await this.getData(uid);
    const newEntry: XpEntry = {
      amount,
      reason,
      lessonId,
      timestamp: new Date().toISOString(),
    };

    const newTotal = data.totalXp + amount;
    const { level, xpToNextLevel } = computeLevel(newTotal);
    const toUnlock = ALL_BADGES.filter(
      (badge) => badge.xpThreshold && badge.xpThreshold <= newTotal && !data.earnedBadgeIds.includes(badge.id)
    );
    const newBadges = toUnlock.map((badge) => badge.id);
    const allBadges = [...data.earnedBadgeIds, ...newBadges];

    await setDocument(collections.gamification, uid, {
      totalXp: newTotal,
      level,
      xpToNextLevel,
      entries: arrayUnion(newEntry),
      earnedBadgeIds: arrayUnion(...newBadges),
    }, true);

    return {
      ...data,
      totalXp: newTotal,
      level,
      xpToNextLevel,
      entries: [...data.entries, newEntry],
      earnedBadgeIds: allBadges,
    };
  },

  async unlockBadge(uid: string, badgeId: string): Promise<void> {
    await updateDocument(collections.gamification, uid, {
      earnedBadgeIds: arrayUnion(badgeId),
    });
  },

  async getBadges(uid: string): Promise<Badge[]> {
    const data = await this.getData(uid);
    return ALL_BADGES.map((badge) => ({
      ...badge,
      locked: !data.earnedBadgeIds.includes(badge.id),
      earnedAt: data.earnedBadgeIds.includes(badge.id)
        ? new Date().toISOString()
        : undefined,
    }));
  },

  async seedDemoData(uid: string): Promise<void> {
    const data = await this.getData(uid);
    if (data.totalXp > 0) return;

    const entries: XpEntry[] = [
      {
        amount: 110,
        reason: "Hoàn thành: Phân số cơ bản",
        lessonId: "math-g4-fractions-foundation",
        timestamp: "2026-04-20T09:00:00Z",
      },
      {
        amount: 50,
        reason: "Thưởng kiểm tra nhanh",
        timestamp: "2026-04-20T09:15:00Z",
      },
      {
        amount: 150,
        reason: "Hoàn thành: Quy đồng mẫu số",
        lessonId: "math-g4-common-denominator",
        timestamp: "2026-04-21T10:00:00Z",
      },
      {
        amount: 140,
        reason: "Hoàn thành: Toán có lời văn",
        lessonId: "math-g4-word-problem-reading",
        timestamp: "2026-04-22T08:30:00Z",
      },
    ];

    const totalXp = entries.reduce((sum, entry) => sum + entry.amount, 0);
    const { level, xpToNextLevel } = computeLevel(totalXp);

    await setDocument(collections.gamification, uid, {
      totalXp,
      level,
      xpToNextLevel,
      entries,
      earnedBadgeIds: ["first-lesson", "fractions"],
    });
  },
};
