"use client";

import { NavHeader } from "./NavHeader";

interface KidShellProps {
  children: React.ReactNode;
  userName?: string;
  onLogout?: () => void;
  onLogin?: () => void;
}

export function KidShell({ children, userName, onLogout, onLogin }: KidShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-nb-bg">
      <div className="app-container flex flex-col flex-1">
        <NavHeader
          role={userName ? "kid" : "guest"}
          userName={userName}
          onLogoutClick={onLogout}
          onLoginClick={onLogin}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
