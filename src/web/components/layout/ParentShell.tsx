"use client";

import { NavHeader } from "./NavHeader";

interface ParentShellProps {
  children: React.ReactNode;
  userName?: string;
  photoURL?: string | null;
  onLogout?: () => void;
}

export function ParentShell({ children, userName, photoURL, onLogout }: ParentShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-nb-bg">
      <div className="app-container flex flex-col flex-1">
        <NavHeader
          role="parent"
          userName={userName}
          photoURL={photoURL}
          onLogoutClick={onLogout}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
