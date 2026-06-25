"use client";

import { Shield } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { NbButton } from "@/components/shared/NbButton";
import { useAuthContext } from "@/lib/auth/auth-context";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  if (!user || user.role !== "admin") {
    return (
      <AdminShell userName={user?.displayName ?? "Guest"} onLogout={handleLogout}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <Shield className="w-16 h-16 text-nb-purple" />
          <h1 className="font-display text-2xl">Cần quyền quản trị</h1>
          <p className="max-w-sm text-sm font-semibold text-[#555]">
            Tài khoản hiện tại không có quyền truy cập khu vực quản trị.
          </p>
          <NbButton variant="secondary" onClick={() => { window.location.href = "/"; }}>
            Về trang chủ
          </NbButton>
        </div>
      </AdminShell>
    );
  }

  return <>{children}</>;
}
