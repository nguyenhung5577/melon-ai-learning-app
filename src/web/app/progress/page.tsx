"use client";

import { useEffect, useState } from "react";
import { Trophy, BookOpen, Zap, TrendingUp } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { XPBar } from "@/components/shared/XPBar";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { NbButton } from "@/components/shared/NbButton";
import { useAuthContext } from "@/lib/auth/auth-context";
import {
  gamificationStore,
  ALL_BADGES,
  type GamificationData,
  type Badge,
} from "@/lib/gamification/gamification-store";
import { cn } from "@/lib/utils";

export default function ProgressPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [data, setData] = useState<GamificationData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (!user) return;
    gamificationStore.seedDemoData(user.uid);
    setData(gamificationStore.getData(user.uid));
    setBadges(gamificationStore.getBadges(user.uid));
  }, [user]);

  if (!user) {
    return (
      <KidShell onLogin={() => setAuthOpen(true)}>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Login to track your progress</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>Login</NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </KidShell>
    );
  }

  return (
    <KidShell
      userName={user.displayName ?? undefined}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      {/* Hero / XP section */}
      <section className="px-6 py-10 [border-bottom:var(--nb-border)] bg-gradient-to-br from-nb-purple via-nb-pink to-nb-yellow">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div
            className="w-20 h-20 rounded-full bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow)] text-4xl flex items-center justify-center"
          >
            {user.displayName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-bold opacity-80">Welcome back,</p>
            <h1 className="font-display text-h1 text-nb-black">
              {user.displayName ?? "Learner"}
            </h1>
            {data && (
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-nb-black text-nb-yellow font-display text-[0.7rem] uppercase px-2 py-0.5 rounded">
                  Level {data.level}
                </span>
                <NbPill color="yellow" icon={<Zap className="w-3 h-3" />}>
                  {data.totalXp.toLocaleString()} xp
                </NbPill>
              </div>
            )}
          </div>
        </div>

        {data && (
          <XPBar
            totalXp={data.totalXp}
            level={data.level}
            xpToNextLevel={data.xpToNextLevel}
          />
        )}
      </section>

      {/* Stats */}
      {data && (
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-[4px] [background:var(--nb-black)] [border-bottom:var(--nb-border)]"
        >
          {[
            { icon: <BookOpen className="w-4 h-4" />, value: data.entries.filter((e) => e.lessonId).length, label: "Lessons Done", color: "text-nb-green" },
            { icon: <Zap className="w-4 h-4" />, value: data.totalXp, label: "Total XP", color: "text-nb-orange" },
            { icon: <Trophy className="w-4 h-4" />, value: data.earnedBadgeIds.length, label: "Badges", color: "text-nb-yellow" },
            { icon: <TrendingUp className="w-4 h-4" />, value: data.level, label: "Level", color: "text-nb-blue" },
          ].map((s) => (
            <div key={s.label} className="bg-white flex flex-col items-center justify-center p-6 gap-1">
              <div className={cn("w-6 h-6 flex items-center justify-center", s.color)}>
                {s.icon}
              </div>
              <div className={cn("font-display text-3xl leading-none", s.color)}>
                {s.value}
              </div>
              <div className="font-bold text-sm uppercase text-center text-nb-black">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badges section */}
      <SectionContainer>
        <SectionHeader
          title="Badges"
          subtitle="Earn badges by completing challenges"
          badge={
            <NbPill color="yellow" icon={<Trophy className="w-3 h-3" />}>
              {badges.filter((b) => !b.locked).length}/{ALL_BADGES.length}
            </NbPill>
          }
        />

        <div className="flex gap-4 overflow-x-auto nb-scrollbar-hide pb-2">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} />
          ))}
        </div>
      </SectionContainer>

      {/* XP History */}
      {data && data.entries.length > 0 && (
        <SectionContainer>
          <SectionHeader title="Recent Activity" />
          <div className="flex flex-col gap-2">
            {[...data.entries]
              .reverse()
              .slice(0, 6)
              .map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white [border:var(--nb-border-thin)] px-4 py-3 rounded-xl"
                >
                  <span className="text-sm font-semibold text-nb-black">{entry.reason}</span>
                  <NbPill color="orange" icon={<Zap className="w-3 h-3" />}>
                    +{entry.amount}
                  </NbPill>
                </div>
              ))}
          </div>
        </SectionContainer>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}

function BadgeItem({ badge }: { badge: Badge }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer",
        "transition-transform duration-150",
        !badge.locked && "hover:-translate-y-1"
      )}
    >
      <div
        className={cn(
          "w-16 h-16 rounded-full [border:3px_solid_var(--nb-black)] flex items-center justify-center text-3xl",
          "[box-shadow:4px_4px_0_var(--nb-black)]",
          badge.locked && "grayscale opacity-50"
        )}
        style={{ background: badge.locked ? "#ddd" : badge.color }}
      >
        {badge.emoji}
      </div>
      <span className="text-[0.65rem] font-black text-center uppercase max-w-[64px] leading-snug">
        {badge.name}
      </span>
    </div>
  );
}
