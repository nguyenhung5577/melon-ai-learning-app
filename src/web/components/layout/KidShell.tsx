"use client";

import { NavHeader } from "./NavHeader";
import { useAuthContext } from "@/lib/auth/auth-context";

interface KidShellProps {
  children: React.ReactNode;
  userName?: string;
  photoURL?: string | null;
  onLogout?: () => void;
  onLogin?: () => void;
  hideNav?: boolean;
}

export function KidShell({ children, userName, photoURL, onLogout, onLogin, hideNav = false }: KidShellProps) {
  const { user } = useAuthContext();
  const role = user?.role ?? (userName ? "kid" : "guest");

  return (
    <div className="min-h-dvh flex flex-col bg-nb-bg">
      <div className="app-container flex flex-col flex-1">
        {!hideNav && (
          <NavHeader
            role={role}
            userName={userName}
            photoURL={photoURL}
            onLogoutClick={onLogout}
            onLoginClick={onLogin}
          />
        )}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
