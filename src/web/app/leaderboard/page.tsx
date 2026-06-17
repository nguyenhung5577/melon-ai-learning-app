"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer } from "@/components/shared/SectionHeader";
import { useAuthContext } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

interface LeaderEntry {
  rank: number;
  uid: string;
  name: string;
  emoji: string;
  level: number;
  xp: number;
  isYou?: boolean;
}

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
      return;
    }

    let mounted = true;

    async function loadBoard() {
      try {
        const res = await fetch("/api/v1/leaderboard", { cache: "no-store" });
        const payload = (await res.json()) as { entries?: LeaderEntry[] };
        if (!res.ok || !payload.entries || !mounted) return;
        setBoard(
          payload.entries.map((entry) => ({
            ...entry,
            isYou: entry.uid === user.uid,
          }))
        );
      } catch {
        if (!mounted) return;
        setBoard([]);
      }
    }

    void loadBoard();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.avatarUrl ?? user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={handleLogout}
    >
      <KidOnlyGuard>
        <section className="bg-nb-black px-6 py-8 [border-bottom:var(--nb-border)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-h1 text-nb-yellow">🏆 Xếp hạng</h1>
            </div>
            <NbPill color="yellow" icon={<Trophy className="h-3 w-3" />}>
              {board.length} người chơi
            </NbPill>
          </div>

          {board.length >= 3 ? (
            <div className="mb-2 mt-8 flex items-end justify-center gap-4">
              <PodiumItem entry={board[1]} />
              <PodiumItem entry={board[0]} crown />
              <PodiumItem entry={board[2]} />
            </div>
          ) : null}
        </section>

        <SectionContainer background="black">
          {board.length > 0 ? (
            <div className="flex flex-col gap-3">
              {board.map((entry) => (
                <LeaderRow key={entry.uid} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-white/20 py-16 text-center text-sm font-semibold text-white/60">
              Chưa có dữ liệu xếp hạng.
            </div>
          )}
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}

function PodiumItem({
  entry,
  crown,
}: {
  entry: LeaderEntry;
  crown?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {crown ? <div className="text-2xl">👑</div> : null}
      <div
        className="relative h-14 w-14 overflow-hidden rounded-full text-3xl [border:3px_solid_rgba(255,255,255,0.4)]"
        style={{ background: entry.isYou ? "#ffde59" : "rgba(255,255,255,0.1)" }}
      >
        {entry.emoji.startsWith("http") ? (
          <Image src={entry.emoji} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">{entry.emoji}</div>
        )}
      </div>
      <div className="max-w-[70px] truncate text-center text-xs font-black text-white">
        {entry.name.split(" ")[0]}
      </div>
      <div className="rounded bg-nb-orange px-2 py-0.5 font-display text-[0.6rem] text-nb-black">
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
        "relative flex items-center gap-4 rounded-2xl px-5 py-4 [border:3px_solid_rgba(255,255,255,0.15)] transition-all duration-150",
        entry.isYou
          ? "pulse-you bg-[rgba(255,222,89,0.15)] [border-color:var(--nb-yellow)]"
          : "bg-[rgba(255,255,255,0.06)] hover:translate-x-1 hover:bg-[rgba(255,255,255,0.1)]"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl font-display text-base [border:3px_solid_rgba(255,255,255,0.3)]",
          rankColors[entry.rank] ?? "bg-transparent text-white"
        )}
      >
        {entry.rank <= 3 ? entry.rank : entry.isYou ? "YOU" : entry.rank}
      </div>

      <div
        className={cn(
          "relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl [border:3px_solid_rgba(255,255,255,0.4)]",
          entry.isYou && "[border-color:var(--nb-yellow)] [box-shadow:0_0_0_3px_rgba(255,222,89,0.4)]"
        )}
      >
        {entry.emoji.startsWith("http") ? (
          <Image src={entry.emoji} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          entry.emoji
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-base font-black", entry.isYou ? "text-nb-yellow" : "text-white")}>
          {entry.name}
        </div>
        <div className="text-[0.65rem] font-bold uppercase text-white/50">
          Level {entry.level}
        </div>
      </div>

      <div className="flex flex-shrink-0 flex-col items-end">
        <div className={cn("font-display text-base", entry.isYou ? "text-nb-yellow" : "text-nb-orange")}>
          {entry.xp.toLocaleString()}
        </div>
        <div className="text-[0.6rem] font-bold uppercase text-white/40">XP</div>
      </div>

      {entry.rank === 1 ? <div className="absolute -top-1 right-3 text-xl">👑</div> : null}
    </div>
  );
}
