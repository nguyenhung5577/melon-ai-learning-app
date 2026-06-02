"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  FileQuestion,
  Flag,
  BarChart2,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { href: "/admin", label: "Tổng quan", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/lessons", label: "Bài học", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/admin/pdf-upload", label: "PDF / RAG", icon: <FileText className="w-4 h-4" /> },
  { href: "/admin/question-bank", label: "Kho đề", icon: <FileQuestion className="w-4 h-4" /> },
  { href: "/admin/flagged", label: "Bị báo cáo", icon: <Flag className="w-4 h-4" /> },
  { href: "/admin/analytics", label: "Thống kê", icon: <BarChart2 className="w-4 h-4" /> },
];

interface AdminShellProps {
  children: React.ReactNode;
  userName?: string;
  onLogout?: () => void;
}

export function AdminShell({ children, userName, onLogout }: AdminShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh flex bg-nb-bg">
      {/* Sidebar */}
      <aside
        className={cn(
          "w-56 flex-shrink-0 bg-nb-black flex flex-col",
          "sticky top-0 h-screen overflow-y-auto",
          "[border-right:var(--nb-border)]"
        )}
      >
        {/* Logo */}
        <div className="px-5 py-5 [border-bottom:var(--nb-border-3)_solid_rgba(255,255,255,0.2)]">
          <span className="font-display text-sm text-nb-yellow">🍈 Melon</span>
          <div className="text-[0.6rem] text-white/40 font-bold uppercase mt-0.5 tracking-wider">
            Bảng quản trị
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {adminNav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg",
                  "font-bold text-sm no-underline transition-all duration-150",
                  active
                    ? "bg-nb-yellow text-nb-black"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 [border-top:2px_solid_rgba(255,255,255,0.1)]">
          <button
            onClick={onLogout}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg cursor-pointer",
              "font-bold text-sm text-white/50 hover:text-white hover:bg-white/10",
              "transition-colors duration-150 bg-transparent border-none"
            )}
          >
            <LogOut className="w-4 h-4" />
            {userName ?? "Admin"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
