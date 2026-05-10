"use client";

import { useEffect, useState } from "react";
import { KidShell } from "@/components/layout/KidShell";
import { AdminShell } from "@/components/layout/AdminShell";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { ChildAvatarPicker } from "@/components/shared/ChildAvatarPicker";
import { NbButton } from "@/components/shared/NbButton";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { useAuthContext } from "@/lib/auth/auth-context";
import { userStore, GRADE_OPTIONS, type ChildProfile } from "@/lib/user/user-store";
import { collections } from "@/lib/db/firestore";
import { updateDocument } from "@/lib/db/firestore-helpers";
import { uploadAvatar } from "@/lib/storage/upload";
import { toast } from "sonner";
import { Upload, Cloud, AlertCircle } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const profileSchema = z.object({
  displayName: z.string()
    .min(2, "Name is too short")
    .max(25, "Name is too long (max 25 chars)")
    .regex(/^[a-zA-Z0-9À-ỹ\s]+$/, "Name contains invalid characters"),
});

export default function ProfilePage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [localName, setLocalName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLocalName(user.displayName || "");
    
    if (user.role === "kid") {
      userStore.getChild(user.uid).then((existing) => {
        if (existing) {
          setProfile(existing);
          setLocalName(existing.displayName);
        } else {
          const newProfile = {
            uid: user.uid,
            displayName: user.displayName ?? "Learner",
            avatarEmoji: "🦊",
            grade: "Grade 1",
            createdAt: new Date().toISOString(),
          };
          setProfile(newProfile);
          setLocalName(newProfile.displayName);
        }
      });
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

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

  const isKid = user.role === "kid";

  async function handleSave() {
    const result = profileSchema.safeParse({ displayName: localName });
    if (!result.success) {
      setError(result.error.issues[0].message);
      toast.error(result.error.issues[0].message);
      return;
    }

    setError(null);
    setSaving(true);
    
    try {
      if (isKid && profile) {
        await userStore.upsertChild({ ...profile, displayName: localName });
      }
      
      await updateDocument(collections.users, user.uid, {
        displayName: localName
      });
      
      toast.success("Profile saved!");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    setAvatarProgress(0);
    try {
      const url = await uploadAvatar(file, setAvatarProgress);
      await updateDocument(collections.users, user.uid, { avatarUrl: url });
      toast.success("Avatar updated! Refresh to see changes.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  }

  const content = (
    <SectionContainer>
      <SectionHeader title="My Profile" subtitle="Customise how you appear on Melon" />

      <div className="max-w-lg flex flex-col gap-8">
        <div className="nb-card rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div
            className="w-20 h-20 rounded-full text-4xl flex items-center justify-center overflow-hidden
                       bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow-sm)] flex-shrink-0"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profile?.avatarEmoji || "👤"
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="font-display text-lg truncate w-full max-w-[250px]">{localName || user.displayName}</div>
            {isKid && <div className="text-sm font-semibold text-[#666]">{profile?.grade}</div>}
            <div className="text-xs text-[#999] mt-0.5 mb-3">{user.email}</div>
            
            <label className="inline-flex items-center gap-2 cursor-pointer bg-nb-bg px-3 py-1.5 rounded-lg [border:var(--nb-border)] font-bold text-[0.7rem] uppercase hover:bg-white transition-colors">
              {uploadingAvatar ? (
                <span>Uploading {avatarProgress}%...</span>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
          </div>
        </div>

        <div>
          <label className="block font-bold text-[0.8rem] uppercase mb-2">Display Name</label>
          <input
            type="text"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={30}
            className={cn("nb-input", error && "border-nb-red focus:ring-nb-red")}
          />
          {error && (
            <div className="mt-2 flex items-center gap-1 text-nb-red text-xs font-bold">
              <AlertCircle className="w-3 h-3" /> {error}
            </div>
          )}
        </div>

        {isKid && profile && (
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
        )}

        {isKid && profile && (
          <ChildAvatarPicker
            selected={profile.avatarEmoji}
            onSelect={(emoji) => setProfile({ ...profile, avatarEmoji: emoji })}
          />
        )}

        <NbButton variant="primary" size="lg" loading={saving} onClick={handleSave}>
          Save Profile
        </NbButton>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </SectionContainer>
  );

  if (user.role === "admin") {
    return <AdminShell userName={user.displayName ?? "Admin"} onLogout={handleLogout}>{content}</AdminShell>;
  }
  if (user.role === "parent") {
    return <ParentShell userName={user.displayName ?? "Parent"} photoURL={user.avatarUrl ?? user.photoURL} onLogout={handleLogout}>{content}</ParentShell>;
  }
  return (
    <KidShell
      userName={user.displayName ?? undefined}
      photoURL={user.avatarUrl ?? user.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={handleLogout}
    >
      {content}
    </KidShell>
  );
}
