"use client";

import { useState } from "react";
import { Flag, Check, X, AlertTriangle } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { AdminGuard } from "@/components/shared/AdminGuard";

interface FlaggedItem {
  id: string;
  content: string;
  uid: string;
  userName: string;
  categories: string[];
  score: number;
  timestamp: string;
  status: "pending" | "approved" | "removed";
}

const DEMO_FLAGGED: FlaggedItem[] = [
  {
    id: "f1",
    content: "Is there any way to hack the leaderboard?",
    uid: "u1", userName: "Minh Khôi",
    categories: ["violence"],
    score: 0.42,
    timestamp: "2026-04-23T08:30:00Z",
    status: "pending",
  },
  {
    id: "f2",
    content: "This lesson is really stupid and boring",
    uid: "u3", userName: "Thanh Tùng",
    categories: ["harassment"],
    score: 0.31,
    timestamp: "2026-04-22T15:12:00Z",
    status: "pending",
  },
  {
    id: "f3",
    content: "How do I make an explosive in chemistry?",
    uid: "u7", userName: "Thu Hà",
    categories: ["violence", "dangerous"],
    score: 0.89,
    timestamp: "2026-04-22T10:00:00Z",
    status: "removed",
  },
];

export default function FlaggedContentPage() {
  const { user, logout } = useAuthContext();
  const [items, setItems] = useState<FlaggedItem[]>(DEMO_FLAGGED);

  const handleLogout = async () => {
    await logout();
  };

  function handleApprove(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "approved" } : i))
    );
  }

  function handleRemove(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "removed" } : i))
    );
  }

  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Admin"} onLogout={handleLogout}>
        <SectionHeader
          title="Flagged Content"
          subtitle="Review messages flagged by OpenAI Moderation API"
          badge={
            pending > 0 ? (
              <NbPill color="orange" icon={<AlertTriangle className="w-3 h-3" />}>
                {pending} pending
              </NbPill>
            ) : (
              <NbPill color="green">All clear</NbPill>
            )
          }
        />

        <div className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "nb-card rounded-2xl p-5 flex flex-col gap-3 bg-white",
                item.status === "removed" && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-sm">{item.userName}</span>
                    <span className="text-xs text-[#888]">
                      {new Date(item.timestamp).toLocaleDateString("vi-VN")}
                    </span>
                    {item.categories.map((c) => (
                      <NbPill key={c} color="orange">{c}</NbPill>
                    ))}
                    <span
                      className={cn(
                        "font-display text-[0.6rem] px-2 py-0.5 rounded",
                        item.score > 0.7
                          ? "bg-nb-red text-white"
                          : item.score > 0.4
                          ? "bg-nb-orange text-nb-black"
                          : "bg-nb-yellow text-nb-black"
                      )}
                    >
                      Score: {(item.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <blockquote className="text-sm font-medium text-[#333] italic border-l-4 border-nb-orange pl-3">
                    &ldquo;{item.content}&rdquo;
                  </blockquote>
                </div>

                {/* Status / Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status === "pending" ? (
                    <>
                      <NbButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        icon={<Check className="w-3.5 h-3.5 text-nb-green" />}
                      >
                        Allow
                      </NbButton>
                      <NbButton
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemove(item.id)}
                        icon={<X className="w-3.5 h-3.5" />}
                      >
                        Remove
                      </NbButton>
                    </>
                  ) : (
                    <NbPill color={item.status === "approved" ? "green" : "black"}>
                      {item.status === "approved" ? "✓ Allowed" : "✗ Removed"}
                    </NbPill>
                  )}
                </div>
              </div>
            </div>
          ))}

          {items.every((i) => i.status !== "pending") && (
            <div className="text-center py-12 text-[#888]">
              <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-display text-sm">No pending flagged content</p>
            </div>
          )}
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
