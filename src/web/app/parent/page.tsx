"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock, Trophy, TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import {
  seedDemoActivityIfEmpty as seedDemoData,
  getExperiencesCompletedCount,
  getTodayWatchTimeSeconds,
  getConceptsToReinforce,
  getActivityEvents,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#b497ff", "#38b6ff", "#ff914d", "#22c55e", "#ffde59"];

const DEMO_WEEKLY = [
  { day: "Mon", xp: 150, minutes: 18 },
  { day: "Tue", xp: 220, minutes: 25 },
  { day: "Wed", xp: 80,  minutes: 10 },
  { day: "Thu", xp: 300, minutes: 35 },
  { day: "Fri", xp: 180, minutes: 22 },
  { day: "Sat", xp: 400, minutes: 48 },
  { day: "Sun", xp: 120, minutes: 15 },
];

const DEMO_SUBJECTS = [
  { name: "Science", value: 3 },
  { name: "Math",    value: 2 },
  { name: "English", value: 1 },
  { name: "Coding",  value: 1 },
];

export default function ParentDashboard() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    seedDemoData();
  }, []);

  const events = getActivityEvents();
  const metrics = {
    totalWatchMinutes: Math.round(getTodayWatchTimeSeconds(events) / 60),
    completedExperiences: getExperiencesCompletedCount(events),
    conceptsToReinforce: getConceptsToReinforce(events).map((c) => c.concept),
  };

  if (!user || user.role !== "parent") {
    return (
      <ParentShell>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Parent account required</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>
              Login as Parent
            </NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ParentShell>
    );
  }

  return (
    <ParentShell userName={user.displayName ?? undefined} onLogout={logout}>
      <SectionContainer>
        <SectionHeader
          title="Parent Dashboard"
          subtitle={`Tracking ${user.displayName ?? "your child"}'s progress`}
          badge={<NbPill color="blue">Week Overview</NbPill>}
        />

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: <Clock className="w-5 h-5" />, value: `${metrics.totalWatchMinutes}m`, label: "Time Learned", color: "text-nb-blue" },
            { icon: <BookOpen className="w-5 h-5" />, value: metrics.completedExperiences, label: "Lessons Done", color: "text-nb-green" },
            { icon: <Trophy className="w-5 h-5" />, value: "Lv.3", label: "Current Level", color: "text-nb-orange" },
            { icon: <TrendingUp className="w-5 h-5" />, value: "500", label: "Total XP", color: "text-nb-purple" },
          ].map((s) => (
            <div key={s.label} className="nb-card rounded-2xl p-5 flex flex-col gap-1">
              <div className={cn("w-5 h-5", s.color)}>{s.icon}</div>
              <div className={cn("font-display text-2xl leading-none", s.color)}>{s.value}</div>
              <div className="text-xs font-bold uppercase text-[#666]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* XP chart */}
        <div className="nb-card rounded-2xl p-5 mb-8">
          <h3 className="font-display text-sm mb-4">Daily XP (This Week)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={DEMO_WEEKLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff914d" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#ff914d" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  border: "4px solid #0e0e0e",
                  borderRadius: 0,
                  boxShadow: "4px 4px 0 #0e0e0e",
                  fontFamily: "Space Grotesk",
                  fontWeight: 700,
                }}
              />
              <Area
                type="monotone"
                dataKey="xp"
                stroke="#ff914d"
                strokeWidth={3}
                fill="url(#xpGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Time + Subject split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minutes per day */}
          <div className="nb-card rounded-2xl p-5">
            <h3 className="font-display text-sm mb-4">Study Time (min/day)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={DEMO_WEEKLY} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    border: "4px solid #0e0e0e",
                    borderRadius: 0,
                    boxShadow: "4px 4px 0 #0e0e0e",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="minutes" fill="#38b6ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Subjects pie */}
          <div className="nb-card rounded-2xl p-5">
            <h3 className="font-display text-sm mb-4">Subjects Studied</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={DEMO_SUBJECTS}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="#0e0e0e"
                  strokeWidth={2}
                >
                  {DEMO_SUBJECTS.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "4px solid #0e0e0e",
                    borderRadius: 0,
                    boxShadow: "4px 4px 0 #0e0e0e",
                    fontFamily: "Space Grotesk",
                    fontWeight: 700,
                  }}
                />
                <Legend
                  formatter={(v) => (
                    <span className="font-bold text-xs uppercase">{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Concepts to reinforce */}
        {metrics.conceptsToReinforce.length > 0 && (
          <div className="nb-card rounded-2xl p-5 mt-8">
            <h3 className="font-display text-sm mb-4">
              💡 Concepts to Reinforce
            </h3>
            <div className="flex flex-wrap gap-2">
              {metrics.conceptsToReinforce.map((concept) => (
                <NbPill key={concept} color="orange">{concept}</NbPill>
              ))}
            </div>
          </div>
        )}
      </SectionContainer>
    </ParentShell>
  );
}
