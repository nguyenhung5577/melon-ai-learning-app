"use client";

import { useEffect, useState } from "react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { ChildAvatarPicker } from "@/components/shared/ChildAvatarPicker";
import { NbButton } from "@/components/shared/NbButton";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { useAuthContext } from "@/lib/auth/auth-context";
import { userStore, GRADE_OPTIONS, type ChildProfile } from "@/lib/user/user-store";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const existing = userStore.getChild(user.uid);
    if (existing) {
      setProfile(existing);
    } else {
      setProfile({
        uid: user.uid,
        displayName: user.displayName ?? "Learner",
        avatarEmoji: "🦊",
        grade: "Grade 1",
        createdAt: new Date().toISOString(),
      });
    }
  }, [user]);

  if (!user) {
    return (
      <KidShell onLogin={() => setAuthOpen(true)}>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Login to view your profile</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>Login</NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </KidShell>
    );
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    userStore.upsertChild(profile);
    await new Promise((r) => setTimeout(r, 300));
    setSaving(false);
    toast.success("Profile saved!");
  }

  return (
    <KidShell
      userName={user.displayName ?? undefined}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <SectionContainer>
        <SectionHeader title="My Profile" subtitle="Customise how you appear on Melon" />

        {profile && (
          <div className="max-w-lg flex flex-col gap-8">
            {/* Avatar display */}
            <div className="nb-card rounded-2xl p-6 flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-full text-4xl flex items-center justify-center
                           bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow-sm)]"
              >
                {profile.avatarEmoji}
              </div>
              <div>
                <div className="font-display text-lg">{profile.displayName}</div>
                <div className="text-sm font-semibold text-[#666]">{profile.grade}</div>
                <div className="text-xs text-[#999] mt-0.5">{user.email}</div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block font-bold text-[0.8rem] uppercase mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                className="nb-input"
              />
            </div>

            {/* Grade */}
            <div>
              <label className="block font-bold text-[0.8rem] uppercase mb-2">Grade</label>
              <select
                value={profile.grade}
                onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
                className="nb-input cursor-pointer"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Avatar picker */}
            <ChildAvatarPicker
              selected={profile.avatarEmoji}
              onSelect={(emoji) => setProfile({ ...profile, avatarEmoji: emoji })}
            />

            <NbButton
              variant="primary"
              size="lg"
              loading={saving}
              onClick={handleSave}
            >
              Save Profile
            </NbButton>
          </div>
        )}
      </SectionContainer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
