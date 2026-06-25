"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { NbButton } from "@/components/shared/NbButton";
import { useAuthContext } from "@/lib/auth/auth-context";
import { updateDocument } from "@/lib/db/firestore-helpers";
import { collections } from "@/lib/db/firestore";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, logout } = useAuthContext();
  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);

  async function handlePromoteSelf() {
    if (!user) return;
    setPromoting(true);
    await updateDocument(collections.users, user.uid, { role: "admin" });
    setPromoted(true);
    setPromoting(false);
  }

  const handleLogout = async () => {
    await logout();
  };

  if (!user || user.role !== "admin") {
    return (
      <AdminShell userName={user?.displayName ?? "Guest"} onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <Shield className="w-16 h-16 text-nb-purple" />
          <h1 className="font-display text-2xl">Admin Access Required</h1>
          {promoted ? (
            <div className="nb-card rounded-2xl p-6 bg-nb-green/20 max-w-sm">
              <p className="font-bold text-nb-green mb-2">✅ Role set to Admin!</p>
              <p className="text-sm text-[#555]">Please log out and log back in (or reload) for the role to take effect.</p>
            </div>
          ) : (
            <div className="nb-card rounded-2xl p-6 bg-nb-yellow max-w-sm flex flex-col gap-4">
              <p className="font-bold text-sm">🛠️ Dev Helper: Promote yourself to Admin</p>
              <p className="text-xs text-[#555]">This writes <code>role: &quot;admin&quot;</code> to your Firestore user document. After this, log out and log back in.</p>
              <NbButton variant="primary" loading={promoting} onClick={handlePromoteSelf} icon={<Shield className="w-4 h-4" />}>
                Set My Role to Admin
              </NbButton>
            </div>
          )}
        </div>
      </AdminShell>
    );
  }

  return <>{children}</>;
}
