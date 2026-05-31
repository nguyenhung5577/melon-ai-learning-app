"use client";

import { useEffect, useState } from "react";
import { KeyRound, UserPlus, Users } from "lucide-react";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { ChildAvatarPicker } from "@/components/shared/ChildAvatarPicker";
import { useAuthContext } from "@/lib/auth/auth-context";
import {
  GRADE_OPTIONS,
  userStore,
  type ChildProfile,
  type CreateChildAccountInput,
} from "@/lib/user/user-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const defaultForm: CreateChildAccountInput & { confirmSecret: string } = {
  loginId: "",
  displayName: "",
  passwordOrPin: "",
  confirmSecret: "",
  grade: GRADE_OPTIONS[0],
  avatarEmoji: "🦊",
};

export default function FamilyPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  useEffect(() => {
    if (!user || user.role !== "parent") return;
    userStore.getChildrenForParent(user.uid).then(setChildren);
  }, [user]);

  async function handleCreateChild() {
    setFormError("");
    setMessage("");

    const loginId = form.loginId.trim().toLowerCase();
    const displayName = form.displayName.trim();
    if (!/^[a-z0-9_]{3,24}$/.test(loginId)) {
      setFormError("Child ID must be 3-24 lowercase letters, numbers, or underscores.");
      return;
    }
    if (displayName.length < 2) {
      setFormError("Display name must be at least 2 characters.");
      return;
    }
    if (form.passwordOrPin.length < 4) {
      setFormError("PIN/password must be at least 4 characters.");
      return;
    }
    if (form.passwordOrPin !== form.confirmSecret) {
      setFormError("PIN/password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const child = await userStore.createChildAccount({
        loginId,
        displayName,
        passwordOrPin: form.passwordOrPin,
        grade: form.grade,
        avatarEmoji: form.avatarEmoji,
      });
      setChildren((items) => [child, ...items.filter((item) => item.uid !== child.uid)]);
      setForm(defaultForm);
      setMessage(`Created child account ${child.loginId ?? child.uid}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create child account.");
    } finally {
      setSaving(false);
    }
  }

  if (!user || user.role !== "parent") {
    return (
      <ParentShell>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Parent account required</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>
              Continue with Google
            </NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ParentShell>
    );
  }

  return (
    <ParentShell userName={user.displayName ?? undefined} onLogout={handleLogout}>
      <SectionContainer>
        <SectionHeader
          title="Family"
          subtitle="Create and manage child accounts"
          badge={
            <NbPill color="blue" icon={<Users className="w-3 h-3" />}>
              {children.length} kids
            </NbPill>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8 items-start">
          <div className="nb-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-nb-yellow [border:var(--nb-border)] rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm">Create Child Account</h3>
                <p className="text-xs font-semibold text-[#666]">No Gmail required for children</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Child ID</label>
                <input
                  value={form.loginId}
                  onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                  placeholder="melon_hero"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Minh Khoi"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Grade</label>
                <select
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  className="nb-input cursor-pointer"
                >
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <ChildAvatarPicker
                selected={form.avatarEmoji}
                onSelect={(avatarEmoji) => setForm({ ...form, avatarEmoji })}
              />

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">PIN or Password</label>
                <input
                  type="password"
                  value={form.passwordOrPin}
                  onChange={(e) => setForm({ ...form, passwordOrPin: e.target.value })}
                  placeholder="••••••"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Confirm PIN or Password</label>
                <input
                  type="password"
                  value={form.confirmSecret}
                  onChange={(e) => setForm({ ...form, confirmSecret: e.target.value })}
                  placeholder="••••••"
                  className="nb-input"
                />
              </div>

              {formError && (
                <div className="bg-nb-pink/30 [border:var(--nb-border-3)_solid_var(--nb-red)] px-4 py-3 text-sm font-semibold text-nb-black">
                  {formError}
                </div>
              )}
              {message && (
                <div className="bg-nb-green/20 [border:var(--nb-border-3)_solid_var(--nb-green)] px-4 py-3 text-sm font-semibold text-nb-black">
                  {message}
                </div>
              )}

              <NbButton
                variant="primary"
                loading={saving}
                onClick={handleCreateChild}
                icon={<KeyRound className="w-4 h-4" />}
              >
                Create Child
              </NbButton>
            </div>
          </div>

          {children.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-nb-black/20 rounded-2xl">
              <div className="text-5xl mb-4">👨‍👧</div>
              <p className="font-display text-sm text-[#666]">No children created yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {children.map((child) => (
                <ChildCard key={child.uid} child={child} />
              ))}
            </div>
          )}
        </div>
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
        <div className="text-xs font-semibold text-[#666] mb-1">{child.grade}</div>
        <div className="text-[0.7rem] font-bold text-[#666] truncate">
          ID: {child.loginId ?? child.uid}
        </div>
        <div className="text-[0.65rem] font-semibold text-[#999] truncate">
          UID: {child.uid}
        </div>
      </div>
    </div>
  );
}
