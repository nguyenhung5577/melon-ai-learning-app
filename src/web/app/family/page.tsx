"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users, Trophy, BookOpen } from "lucide-react";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { useAuthContext } from "@/lib/auth/auth-context";
import { userStore, type ChildProfile } from "@/lib/user/user-store";
import { cn } from "@/lib/utils";

export default function FamilyPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [linkCode, setLinkCode] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "parent") return;
    setChildren(userStore.getChildrenForParent(user.uid));
  }, [user]);

  async function handleLink() {
    if (!user || !linkCode.trim()) return;
    setLinking(true);
    await new Promise((r) => setTimeout(r, 500));
    userStore.linkChildToParent(user.uid, linkCode.trim());
    setChildren(userStore.getChildrenForParent(user.uid));
    setLinkCode("");
    setLinking(false);
  }

  if (!user || user.role !== "parent") {
    return (
      <ParentShell>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Parent account required</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>Login as Parent</NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ParentShell>
    );
  }

  return (
    <ParentShell userName={user.displayName ?? undefined} onLogout={logout}>
      <SectionContainer>
        <SectionHeader
          title="Family"
          subtitle="Manage your linked children"
          badge={
            <NbPill color="blue" icon={<Users className="w-3 h-3" />}>
              {children.length} kids
            </NbPill>
          }
        />

        {/* Link child */}
        <div className="nb-card rounded-2xl p-6 mb-8 max-w-md">
          <h3 className="font-display text-sm mb-4">Link a Child Account</h3>
          <p className="text-sm font-medium text-[#666] mb-4">
            Enter your child&apos;s account UID (found in their Profile page).
          </p>
          <div className="flex gap-3">
            <input
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value)}
              placeholder="Child UID..."
              className="nb-input flex-1"
            />
            <NbButton
              variant="primary"
              loading={linking}
              onClick={handleLink}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Link
            </NbButton>
          </div>
        </div>

        {/* Children list */}
        {children.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-nb-black/20 rounded-2xl">
            <div className="text-5xl mb-4">👨‍👧</div>
            <p className="font-display text-sm text-[#666]">No children linked yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {children.map((child) => (
              <ChildCard key={child.uid} child={child} />
            ))}
          </div>
        )}
      </SectionContainer>
    </ParentShell>
  );
}

function ChildCard({ child }: { child: ChildProfile }) {
  return (
    <div className={cn("nb-card rounded-2xl p-5 flex items-start gap-4")}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0
                   bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow-sm)]"
      >
        {child.avatarEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm truncate">{child.displayName}</div>
        <div className="text-xs font-semibold text-[#666] mb-3">{child.grade}</div>
        <div className="flex gap-2">
          <NbPill color="purple" icon={<Trophy className="w-3 h-3" />}>XP</NbPill>
          <NbPill color="green" icon={<BookOpen className="w-3 h-3" />}>Lessons</NbPill>
        </div>
      </div>
    </div>
  );
}
