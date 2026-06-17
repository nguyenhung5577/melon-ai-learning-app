import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

type LeaderboardEntry = {
  uid: string;
  name: string;
  emoji: string;
  level: number;
  xp: number;
};

export async function GET() {
  const db = adminDb();
  const progressSnap = await db
    .collection("studentProgress")
    .orderBy("totalXpEarned", "desc")
    .limit(50)
    .get();

  const entries = await Promise.all(
    progressSnap.docs.map(async (doc) => {
      const progress = doc.data();
      const uid = String(progress.childUid ?? doc.id);
      const [childSnap, userSnap] = await Promise.all([
        db.collection("children").doc(uid).get(),
        db.collection("users").doc(uid).get(),
      ]);

      const child = childSnap.data();
      const user = userSnap.data();
      const name =
        String(child?.displayName ?? user?.displayName ?? "").trim() || "Người học";
      const emoji =
        String(user?.avatarUrl ?? user?.photoURL ?? child?.avatarEmoji ?? "⭐").trim() || "⭐";

      return {
        uid,
        name,
        emoji,
        level: Number(progress.level ?? 1),
        xp: Number(progress.totalXpEarned ?? 0),
      } satisfies LeaderboardEntry;
    })
  );

  entries.sort((left, right) => {
    if (right.xp !== left.xp) return right.xp - left.xp;
    if (right.level !== left.level) return right.level - left.level;
    return left.name.localeCompare(right.name, "vi");
  });

  return NextResponse.json({
    entries: entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    })),
  });
}
