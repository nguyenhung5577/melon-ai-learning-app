"use client";

import { Users, BookOpen, Zap, Flag, TrendingUp } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const AI_SPEND = [
  { date: "Apr 17", cost: 0.12 },
  { date: "Apr 18", cost: 0.28 },
  { date: "Apr 19", cost: 0.19 },
  { date: "Apr 20", cost: 0.35 },
  { date: "Apr 21", cost: 0.41 },
  { date: "Apr 22", cost: 0.52 },
  { date: "Apr 23", cost: 0.38 },
];

const DAILY_ACTIVES = [
  { date: "Apr 17", users: 12 },
  { date: "Apr 18", users: 28 },
  { date: "Apr 19", users: 19 },
  { date: "Apr 20", users: 35 },
  { date: "Apr 21", users: 41 },
  { date: "Apr 22", users: 52 },
  { date: "Apr 23", users: 38 },
];

const STATS = [
  { icon: <Users className="w-5 h-5" />, value: "124", label: "Total Users",   color: "text-nb-blue" },
  { icon: <BookOpen className="w-5 h-5" />, value: "5",  label: "Lessons",     color: "text-nb-green" },
  { icon: <Zap className="w-5 h-5" />, value: "$2.25",  label: "AI Spend",    color: "text-nb-orange" },
  { icon: <Flag className="w-5 h-5" />, value: "3",     label: "Flagged",     color: "text-nb-red" },
];

export default function AdminDashboard() {
  const { user, logout } = useAuthContext();

  return (
    <AdminShell userName={user?.displayName ?? "Admin"} onLogout={logout}>
      <SectionHeader
        title="Admin Dashboard"
        subtitle="Melon App overview"
        badge={<NbPill color="purple">Phase 1</NbPill>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 mb-8">
        {STATS.map((s) => (
          <div key={s.label} className="nb-card rounded-2xl p-5 bg-white flex flex-col gap-2">
            <div className={cn("w-5 h-5", s.color)}>{s.icon}</div>
            <div className={cn("font-display text-2xl", s.color)}>{s.value}</div>
            <div className="text-xs font-bold uppercase text-[#666]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Spend */}
        <div className="nb-card rounded-2xl p-5 bg-white">
          <h3 className="font-display text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-nb-orange" />
            AI API Spend (USD/day)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={AI_SPEND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff914d" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ff914d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v}`, "Cost"]} contentStyle={{ border: "4px solid #0e0e0e", borderRadius: 0, fontFamily: "Space Grotesk", fontWeight: 700 }} />
              <Area type="monotone" dataKey="cost" stroke="#ff914d" strokeWidth={3} fill="url(#spendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Actives */}
        <div className="nb-card rounded-2xl p-5 bg-white">
          <h3 className="font-display text-sm mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-nb-blue" />
            Daily Active Users
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DAILY_ACTIVES} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ border: "4px solid #0e0e0e", borderRadius: 0, fontFamily: "Space Grotesk", fontWeight: 700 }} />
              <Bar dataKey="users" fill="#38b6ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminShell>
  );
}
