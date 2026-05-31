"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { NbButton } from "@/components/shared/NbButton";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { useAuthContext } from "@/lib/auth/auth-context";
import { gamificationStore, ALL_BADGES, type Badge } from "@/lib/gamification/gamification-store";
import { cn } from "@/lib/utils";

export default function BadgesPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [badges, setBadges] = useState<Badge[]>(
    ALL_BADGES.map((b) => ({ ...b, locked: true }))
  );

  useEffect(() => {
    if (!user) return;
    gamificationStore.seedDemoData(user.uid).then(async () => {
      const bs = await gamificationStore.getBadges(user.uid);
      setBadges(bs);
    });
  }, [user]);

  const earned = badges.filter((b) => !b.locked);
  const locked = badges.filter((b) => b.locked);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <KidOnlyGuard>
      <SectionContainer>
        <SectionHeader
          title="Badge Cabinet"
          subtitle="Collect badges by completing challenges and levelling up"
          badge={
            <NbPill color="yellow" icon={<Trophy className="w-3 h-3" />}>
              {earned.length}/{ALL_BADGES.length} earned
            </NbPill>
          }
          action={
            !user ? (
              <NbButton variant="secondary" size="sm" onClick={() => setAuthOpen(true)}>
                Login to earn
              </NbButton>
            ) : undefined
          }
        />

        {/* Earned */}
        {earned.length > 0 && (
          <>
            <h3 className="font-display text-sm mb-4 text-nb-green">
              ✅ Earned ({earned.length})
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 mb-10">
              {earned.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          </>
        )}

        {/* Locked */}
        <h3 className="font-display text-sm mb-4 text-[#888]">
          🔒 Locked ({locked.length})
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {locked.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}

function BadgeCard({ badge }: { badge: Badge }) {
  const [tooltip, setTooltip] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center gap-2 cursor-pointer"
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      <div
        className={cn(
          "w-16 h-16 rounded-full [border:3px_solid_var(--nb-black)] flex items-center justify-center text-3xl",
          "[box-shadow:4px_4px_0_var(--nb-black)] transition-transform duration-150",
          badge.locked ? "grayscale opacity-50" : "hover:-translate-y-1"
        )}
        style={{ background: badge.locked ? "#ddd" : badge.color }}
      >
        {badge.emoji}
      </div>
      <span className="text-[0.65rem] font-black text-center uppercase max-w-[72px] leading-tight">
        {badge.name}
      </span>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={cn(
            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50",
            "bg-nb-black text-white text-[0.7rem] font-semibold px-3 py-2 rounded-lg",
            "w-36 text-center leading-snug whitespace-normal",
            "[box-shadow:3px_3px_0_var(--nb-orange)]"
          )}
        >
          {badge.description}
        </div>
      )}
    </div>
  );
}
