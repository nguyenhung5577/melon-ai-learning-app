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
import { Upload, AlertCircle, Copy } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const profileSchema = z.object({
  displayName: z.string()
    .min(2, "Tên quá ngắn")
    .max(25, "Tên quá dài, tối đa 25 ký tự")
    .regex(/^[a-zA-Z0-9À-ỹ\s]+$/, "Tên có ký tự không hợp lệ"),
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
    if (user.role !== "kid") {
      Promise.resolve().then(() => setLocalName(user.displayName || ""));
      return;
    }
    
    userStore.getChild(user.uid).then((existing) => {
      if (existing) {
        setProfile(existing);
        setLocalName(existing.displayName);
      } else {
        const newProfile = {
          uid: user.uid,
          loginId: user.loginId,
          displayName: user.displayName ?? "Học sinh",
          avatarEmoji: "🦊",
          grade: "Grade 1",
          createdAt: new Date().toISOString(),
        };
        setProfile(newProfile);
        setLocalName(newProfile.displayName);
      }
    });
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
            <p className="font-display text-lg mb-4">Đăng nhập để xem hồ sơ</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>Đăng nhập</NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </KidShell>
    );
  }

  const currentUser = user;
  const isKid = user.role === "kid";
  const profileHeader = isKid
    ? { title: "Hồ sơ của con", subtitle: "Chỉnh cách con hiển thị trong Melon" }
    : user.role === "parent"
      ? { title: "Hồ sơ phụ huynh", subtitle: "Chỉnh thông tin hiển thị của phụ huynh" }
      : { title: "Hồ sơ quản trị viên", subtitle: "Chỉnh thông tin hiển thị của quản trị viên" };

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
      
      await updateDocument(collections.users, currentUser.uid, {
        displayName: localName
      });
      
      toast.success("Đã lưu hồ sơ.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error("Không lưu được: " + message);
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
      toast.success("Đã cập nhật ảnh đại diện.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không tải được ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  }

  const content = (
    <SectionContainer>
      <SectionHeader title={profileHeader.title} subtitle={profileHeader.subtitle} />

      <div className="max-w-lg flex flex-col gap-8">
        <div className="nb-card rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div
            className="w-20 h-20 rounded-full text-4xl flex items-center justify-center overflow-hidden
                       bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow-sm)] flex-shrink-0"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Ảnh đại diện" className="w-full h-full object-cover" />
            ) : (
              profile?.avatarEmoji || "👤"
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="font-display text-lg truncate w-full max-w-[250px]">{localName || user.displayName}</div>
            {isKid && <div className="text-sm font-semibold text-[#666]">{profile?.grade}</div>}
            <div className="text-xs text-[#999] mt-0.5 mb-3">
              {isKid ? (user.loginId ?? profile?.loginId ?? "Tài khoản học sinh") : user.email}
            </div>
            
            <label className="inline-flex items-center gap-2 cursor-pointer bg-nb-bg px-3 py-1.5 rounded-lg [border:var(--nb-border)] font-bold text-[0.7rem] uppercase hover:bg-white transition-colors">
              {uploadingAvatar ? (
                <span>Đang tải {avatarProgress}%...</span>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Tải ảnh lên
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
          </div>
        </div>

        <div>
          <label className="block font-bold text-[0.8rem] uppercase mb-2">Tên hiển thị</label>
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

        {isKid ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <IdentityField label="Mã học sinh" value={user.loginId ?? profile?.loginId ?? "Chưa có"} />
            <IdentityField label="UID" value={user.uid} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <IdentityField label="Email" value={user.email ?? "Chưa có"} />
            <IdentityField label="UID phụ huynh" value={user.uid} />
          </div>
        )}

        {isKid && profile && (
          <div>
            <label className="block font-bold text-[0.8rem] uppercase mb-2">Lớp</label>
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
          Lưu hồ sơ
        </NbButton>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </SectionContainer>
  );

  if (user.role === "admin") {
    return <AdminShell userName={user.displayName ?? "Quản trị viên"} onLogout={handleLogout}>{content}</AdminShell>;
  }
  if (user.role === "parent") {
    return <ParentShell userName={user.displayName ?? "Phụ huynh"} photoURL={user.avatarUrl ?? user.photoURL} onLogout={handleLogout}>{content}</ParentShell>;
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

function IdentityField({ label, value }: { label: string; value: string }) {
  async function copyValue() {
    if (!navigator.clipboard || value === "Chưa có") return;
    await navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
  }

  return (
    <div className="bg-white [border:var(--nb-border-thin)] rounded-xl p-3">
      <div className="text-[0.65rem] font-black uppercase text-[#777] mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code className="text-xs font-bold break-all flex-1">{value}</code>
        <button
          type="button"
          onClick={copyValue}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-nb-bg [border:var(--nb-border-thin)] cursor-pointer"
          aria-label={`Sao chép ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
