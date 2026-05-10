"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Trophy,
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Shield,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NbButton } from "@/components/shared/NbButton";
import { useState } from "react";

type Role = "kid" | "parent" | "admin" | "guest";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const kidLinks: NavLink[] = [
  { href: "/lessons", label: "Learn", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/leaderboard", label: "Ranks", icon: <Trophy className="w-4 h-4" /> },
  { href: "/progress", label: "Progress", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/profile", label: "Profile", icon: <User className="w-4 h-4" /> },
];

const parentLinks: NavLink[] = [
  { href: "/parent", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/family", label: "Family", icon: <Users className="w-4 h-4" /> },
];

const adminLinks: NavLink[] = [
  { href: "/admin", label: "Admin Home", icon: <Settings className="w-4 h-4" /> },
  { href: "/admin/lessons", label: "Lessons", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/admin/pdf-upload", label: "PDF Upload", icon: <Shield className="w-4 h-4" /> },
];

const linksMap: Record<Exclude<Role, "guest">, NavLink[]> = {
  kid: kidLinks,
  parent: parentLinks,
  admin: adminLinks,
};

interface NavHeaderProps {
  role?: Role;
  userName?: string;
  photoURL?: string | null;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
}

export function NavHeader({
  role = "guest",
  userName,
  photoURL,
  onLoginClick,
  onLogoutClick,
}: NavHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const links = role !== "guest" ? linksMap[role] : [];

  return (
    <header
      className={cn(
        "sticky top-0 z-[400]",
        "flex justify-between items-center px-6 py-4",
        "[border-bottom:var(--nb-border)] bg-white"
      )}
    >
      {/* Logo */}
      <Link
        href="/"
        className={cn(
          "font-display text-sm uppercase",
          "bg-nb-orange px-4 py-2",
          "[border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)]",
          "text-nb-black no-underline flex items-center gap-2",
          "hover:[box-shadow:6px_6px_0_var(--nb-black)] hover:-translate-x-0.5 hover:-translate-y-0.5",
          "transition-all duration-150"
        )}
      >
        🍈 Melon
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-1.5 font-bold text-sm text-nb-black no-underline",
              "px-2 py-1 border-2 border-transparent transition-all duration-150",
              pathname.startsWith(link.href)
                ? "bg-nb-yellow border-nb-black"
                : "hover:bg-nb-yellow hover:border-nb-black"
            )}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {role === "guest" ? (
          <NbButton
            variant="secondary"
            size="sm"
            onClick={onLoginClick}
            className="hidden md:inline-flex"
          >
            Login
          </NbButton>
        ) : (
          <div className="relative hidden md:block">
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2",
                "[border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)]",
                "bg-nb-purple cursor-pointer",
                "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:6px_6px_0_var(--nb-black)]",
                "transition-all duration-150"
              )}
              onClick={() => setUserMenuOpen((v) => !v)}
            >
              <div className="w-7 h-7 rounded-full bg-nb-yellow [border:2px_solid_var(--nb-black)] flex items-center justify-center font-display text-xs overflow-hidden">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  userName?.[0]?.toUpperCase() ?? "?"
                )}
              </div>
              <span className="font-bold text-sm text-nb-black">{userName ?? "User"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-nb-black opacity-60" />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 bg-white [border:var(--nb-border)] [box-shadow:6px_6px_0_var(--nb-black)] z-50 flex flex-col"
                onMouseLeave={() => setUserMenuOpen(false)}
              >
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-3 font-bold text-sm text-nb-black no-underline hover:bg-nb-yellow transition-colors"
                >
                  <User className="w-4 h-4" /> My Profile
                </Link>
                {role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 font-bold text-sm text-nb-black no-underline hover:bg-nb-orange transition-colors"
                  >
                    <Shield className="w-4 h-4" /> Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => { setUserMenuOpen(false); onLogoutClick?.(); }}
                  className="flex items-center gap-2.5 px-4 py-3 font-bold text-sm text-nb-black hover:bg-nb-pink/30 transition-colors cursor-pointer bg-transparent border-none border-t-2 border-nb-black/10 text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 [border:var(--nb-border)] bg-white cursor-pointer"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className={cn(
            "md:hidden absolute top-full left-0 right-0",
            "bg-white [border-bottom:var(--nb-border)]",
            "flex flex-col"
          )}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-6 py-4 font-bold text-sm",
                "[border-bottom:2px_solid_#eee] no-underline text-nb-black",
                pathname.startsWith(link.href)
                  ? "bg-nb-yellow"
                  : "hover:bg-nb-bg"
              )}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
          {role === "guest" && (
            <button
              className="mx-6 my-4 nb-btn nb-btn-secondary"
              onClick={() => { setMobileOpen(false); onLoginClick?.(); }}
            >
              Login
            </button>
          )}
        </div>
      )}
    </header>
  );
}
