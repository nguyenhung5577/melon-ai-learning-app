"use client";

import { useState } from "react";
import { 
  Users, 
  BookOpen, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpRight,
  Shield,
  Activity
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { updateDocument } from "@/lib/db/firestore-helpers";
import { collections } from "@/lib/db/firestore";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/shared/AdminGuard";

const AI_SPEND = [
  { date: "Apr 17", cost: 0.12 },
  { date: "Apr 18", cost: 0.45 },
  { date: "Apr 19", cost: 0.88 },
  { date: "Apr 20", cost: 1.20 },
  { date: "Apr 21", cost: 1.05 },
  { date: "Apr 22", cost: 1.55 },
  { date: "Apr 23", cost: 2.10 },
];

export default function AdminDashboard() {
  const { user, logout } = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Admin"} onLogout={handleLogout}>
        <SectionHeader
          title="Admin Dashboard"
          subtitle="Melon App overview"
          badge={<NbPill color="purple">Phase 1</NbPill>}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
          {[
            { label: "Total Students", value: "1,284", icon: <Users className="w-4 h-4" />, color: "bg-nb-blue/20 text-nb-blue" },
            { label: "Active Lessons", value: "42", icon: <BookOpen className="w-4 h-4" />, color: "bg-nb-green/20 text-nb-green" },
            { label: "Flagged Content", value: "3", icon: <AlertCircle className="w-4 h-4" />, color: "bg-nb-red/20 text-nb-red" },
            { label: "AI Quiz Usage", value: "8.2k", icon: <Activity className="w-4 h-4" />, color: "bg-nb-orange/20 text-nb-orange" },
          ].map((s) => (
            <div key={s.label} className="nb-card rounded-2xl p-5 flex flex-col gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", s.color)}>
                {s.icon}
              </div>
              <div className="text-2xl font-display">{s.value}</div>
              <div className="text-xs font-bold text-[#666] uppercase">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Spend Table */}
          <div className="nb-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-sm">AI API Spend (Last 7 Days)</h3>
              <NbPill color="purple">$6.35 Total</NbPill>
            </div>
            <div className="flex flex-col gap-3">
              {AI_SPEND.map((row) => (
                <div key={row.date} className="flex items-center justify-between text-sm font-bold">
                  <span className="text-[#666]">{row.date}</span>
                  <div className="flex-1 mx-4 h-2 bg-nb-bg rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-nb-purple" 
                      style={{ width: `${(row.cost / 2.5) * 100}%` }}
                    />
                  </div>
                  <span>${row.cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-6">
            <div className="nb-card rounded-2xl p-6 bg-nb-purple/10 border-nb-purple">
              <h3 className="font-display text-sm mb-4">Cấp quyền Melon Pro</h3>
              <form 
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const targetUid = (e.target as any).targetUid.value;
                  if (!targetUid) return;
                  try {
                    const token = await user?.getIdToken();
                    const res = await fetch("/api/v1/admin/subscription", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ targetUid, plan: "pro" })
                    });
                    if (res.ok) {
                      alert(`Đã nâng cấp thành công tài khoản (UID: ${targetUid}) lên gói Pro!`);
                      (e.target as any).reset();
                    } else {
                      alert("Lỗi khi nâng cấp. Có thể bạn không đủ quyền Admin.");
                    }
                  } catch (err) {
                    alert("Lỗi mạng kết nối.");
                  }
                }}
              >
                <input 
                  name="targetUid" 
                  placeholder="Nhập Parent UID..." 
                  className="nb-input text-sm" 
                  required 
                />
                <NbButton type="submit" variant="primary" size="sm" className="w-full bg-nb-purple text-white">
                  Nâng cấp ngay
                </NbButton>
              </form>
            </div>

            <div className="nb-card rounded-2xl p-6">
              <h3 className="font-display text-sm mb-2">System Health</h3>
              <div className="flex items-center gap-2 mb-4">
                <NbPill color="green">Operational</NbPill>
                <span className="text-xs font-bold text-[#888]">Uptime: 99.9%</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span>Pinecone Index</span>
                  <span className="text-nb-green">Connected</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span>OpenAI API</span>
                  <span className="text-nb-green">Active</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span>Cloudinary Storage</span>
                  <span className="text-nb-green">Healthy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
