"use client";

import { useEffect, useState } from "react";
import { Trophy, Zap } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { gamificationStore } from "@/lib/gamification/gamification-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface LeaderEntry {
  rank: number;
  uid: string;
  name: string;
  emoji: string;
  level: number;
  xp: number;
  isYou?: boolean;
}

const DEMO_BOARD: Omit<LeaderEntry, "isYou">[] = [
  { rank: 1, uid: "u1", name: "Minh Khôi",    emoji: "🦁", level: 8,  xp: 1540 },
  { rank: 2, uid: "u2", name: "Hà Linh",      emoji: "🦊", level: 7,  xp: 1380 },
  { rank: 3, uid: "u3", name: "Thanh Tùng",   emoji: "🐼", level: 6,  xp: 1200 },
  { rank: 4, uid: "u4", name: "Ngọc Mai",     emoji: "🦋", level: 5,  xp: 1050 },
  { rank: 5, uid: "u5", name: "Bảo Long",     emoji: "🐬", level: 4,  xp: 870  },
  { rank: 6, uid: "u6", name: "Hoàng Anh",    emoji: "🦝", level: 3,  xp: 700  },
  { rank: 7, uid: "u7", name: "Thu Hà",       emoji: "🐧", level: 3,  xp: 620  },
  { rank: 8, uid: "u8", name: "Đức Duy",      emoji: "🐸", level: 2,  xp: 500  },
];

export default function LeaderboardPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [board, setBoard] = useState<LeaderEntry[]>([]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  useEffect(() => {
    if (!user) {
      setBoard(DEMO_BOARD.map((e) => ({ ...e, isYou: false })));
      return;
    }
    gamificationStore.seedDemoData(user.uid).then(async () => {
      const data = await gamificationStore.getData(user.uid);

      const myEntry: Omit<LeaderEntry, "isYou"> = {
        rank: 0, // Will be calculated
        uid: user.uid,
        name: user.displayName ?? "You",
        // Prefer custom avatarUrl, then photoURL, then star emoji
        emoji: user.avatarUrl || user.photoURL || "⭐",
        level: data.level,
        xp: data.totalXp,
      };

      // Combine real user with demo bots and sort by XP descending
      const allEntries = [...DEMO_BOARD, myEntry]
        .sort((a, b) => b.xp - a.xp)
        .map((e, i) => ({ 
          ...e, 
          rank: i + 1, 
          isYou: e.uid === user.uid 
        }));

      setBoard(allEntries);
    });
  }, [user]);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.avatarUrl ?? user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={handleLogout}
    >
      {/* Dark header */}
      <section className="px-6 py-8 bg-nb-black [border-bottom:var(--nb-border)]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-h1 text-nb-yellow">🏆 Leaderboard</h1>
            <p className="text-white/60 text-sm font-semibold mt-1">
              Top learners this week
            </p>
          </div>
          <NbPill color="yellow" icon={<Trophy className="w-3 h-3" />}>
            {board.length} players
          </NbPill>
        </div>

        {/* Top 3 podium */}
        {board.length >= 3 && (
          <div className="flex items-end justify-center gap-4 mt-8 mb-2">
            <PodiumItem entry={board[1]} height={80} />
            <PodiumItem entry={board[0]} height={110} crown />
            <PodiumItem entry={board[2]} height={60} />
          </div>
        )}
      </section>

      {/* Full list */}
      <SectionContainer background="black">
        <div className="flex flex-col gap-3">
          {board.map((entry) => (
            <LeaderRow key={entry.uid} entry={entry} />
          ))}
        </div>
      </SectionContainer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}

function PodiumItem({
  entry,
  height,
  crown,
}: {
  entry: LeaderEntry;
  height: number;
  crown?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {crown && <div className="text-2xl">👑</div>}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-3xl [border:3px_solid_rgba(255,255,255,0.4)] [box-shadow:0_0_0_0] overflow-hidden"
        style={{ background: entry.isYou ? "#ffde59" : "rgba(255,255,255,0.1)" }}
      >
        {entry.emoji.startsWith("http") ? (
          <img src={entry.emoji} alt="" className="w-full h-full object-cover" />
        ) : (
          entry.emoji
        )}
      </div>
      <div className="text-xs font-black text-white text-center max-w-[70px] truncate">
        {entry.name.split(" ")[0]}
      </div>
      <div
        className="font-display text-[0.6rem] bg-nb-orange text-nb-black px-2 py-0.5 rounded"
      >
        #{entry.rank}
      </div>
    </div>
  );
}

function LeaderRow({ entry }: { entry: LeaderEntry }) {
  const rankColors: Record<number, string> = {
    1: "bg-gradient-to-br from-[#FFD700] to-[#FFA500] border-[#FFD700] text-nb-black",
    2: "bg-gradient-to-br from-[#C0C0C0] to-[#A9A9A9] border-[#C0C0C0] text-nb-black",
    3: "bg-gradient-to-br from-[#CD7F32] to-[#A0522D] border-[#CD7F32] text-white",
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 px-5 py-4 rounded-2xl [border:3px_solid_rgba(255,255,255,0.15)]",
        "transition-all duration-150",
        entry.isYou
          ? "bg-[rgba(255,222,89,0.15)] [border-color:var(--nb-yellow)] pulse-you"
          : "bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] hover:translate-x-1"
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          "w-11 h-11 rounded-xl [border:3px_solid_rgba(255,255,255,0.3)] flex items-center justify-center flex-shrink-0",
          "font-display text-base",
          rankColors[entry.rank] ?? "bg-transparent text-white"
        )}
      >
        {entry.rank <= 3 ? entry.rank : entry.isYou ? "YOU" : entry.rank}
      </div>

      {/* Avatar */}
      <div
        className={cn(
          "w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden",
          "[border:3px_solid_rgba(255,255,255,0.4)]",
          entry.isYou && "[border-color:var(--nb-yellow)] [box-shadow:0_0_0_3px_rgba(255,222,89,0.4)]"
        )}
      >
        {entry.emoji.startsWith("http") ? (
          <img src={entry.emoji} alt="" className="w-full h-full object-cover" />
        ) : (
          entry.emoji
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "font-black text-base truncate",
            entry.isYou ? "text-nb-yellow" : "text-white"
          )}
        >
          {entry.name}
        </div>
        <div className="text-[0.65rem] font-bold text-white/50 uppercase">
          Level {entry.level}
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end flex-shrink-0">
        <div
          className={cn(
            "font-display text-base",
            entry.isYou ? "text-nb-yellow" : "text-nb-orange"
          )}
        >
          {entry.xp.toLocaleString()}
        </div>
        <div className="text-[0.6rem] font-bold text-white/40 uppercase">XP</div>
      </div>

      {entry.rank === 1 && (
        <div className="absolute right-3 -top-1 text-xl">👑</div>
      )}
    </div>
  );
}
