"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Trophy, Brain, Zap, Users, Star } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { NbButton } from "@/components/shared/NbButton";
import { StatStrip } from "@/components/shared/StatCard";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: <Brain className="w-8 h-8" />,
    title: "AI Tutor",
    desc: "Cosmo adapts to your pace, answers questions, and gives instant hints.",
    bg: "bg-nb-purple",
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: "Smart Lessons",
    desc: "Interactive lessons built from your curriculum — upload any PDF.",
    bg: "bg-nb-blue",
  },
  {
    icon: <Trophy className="w-8 h-8" />,
    title: "Earn Rewards",
    desc: "Collect XP, badges, and climb the leaderboard with every lesson.",
    bg: "bg-nb-yellow",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Parent Portal",
    desc: "Real-time progress reports, screen time controls, and family links.",
    bg: "bg-nb-green",
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "AI Quiz",
    desc: "Quiz questions generated from lesson content — never the same twice.",
    bg: "bg-nb-orange",
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Daily Quests",
    desc: "Short daily missions keep the learning streak alive.",
    bg: "bg-nb-pink",
  },
];

const stats = [
  { value: "10K+", label: "Students", color: "orange" as const },
  { value: "500+", label: "Lessons", color: "green" as const },
  { value: "98%", label: "Happy kids", color: "blue" as const },
  { value: "4.9★", label: "Rating", color: "purple" as const },
];

export default function HomePage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.avatarUrl ?? user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      {/* ── HERO ── */}
      <section
        className={cn(
          "px-6 py-12 md:py-20 [border-bottom:var(--nb-border)]",
          "bg-nb-yellow relative overflow-hidden",
          "grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-10"
        )}
      >
        <div className="z-[2]">
          <div
            className={cn(
              "inline-block bg-nb-pink px-3 py-1.5 mb-6",
              "[border:var(--nb-border)] font-bold text-sm",
              "-rotate-2"
            )}
          >
            🚀 AI-Powered Learning Platform
          </div>

          <h1
            className={cn(
              "font-display leading-none mb-6",
              "text-[clamp(2.5rem,6vw,4rem)]"
            )}
          >
            Learn Smarter
            <br />
            <span className="bg-white px-2 [box-shadow:4px_4px_0_var(--nb-black)] inline-block">
              Have Fun
            </span>
            <br />
            Level Up
          </h1>

          <p className="text-xl font-medium leading-snug mb-8 max-w-md text-nb-black">
            Melon is an AI-powered learning platform that makes studying fun,
            personalised, and rewarding for kids.
          </p>

          <div className="flex flex-wrap gap-3">
            {user ? (
              user.role === "parent" ? (
                <>
                  <Link href="/parent">
                    <NbButton variant="primary" size="lg" icon={<Users className="w-4 h-4" />}>
                      Parent Dashboard
                    </NbButton>
                  </Link>
                  <Link href="/family">
                    <NbButton variant="ghost" size="lg">
                      Manage Family
                    </NbButton>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/lessons">
                    <NbButton variant="primary" size="lg" icon={<BookOpen className="w-4 h-4" />}>
                      Start Learning
                    </NbButton>
                  </Link>
                  <Link href="/progress">
                    <NbButton variant="ghost" size="lg">
                      My Progress
                    </NbButton>
                  </Link>
                </>
              )
            ) : (
              <NbButton
                variant="primary"
                size="lg"
                onClick={() => setAuthOpen(true)}
                icon={<Zap className="w-4 h-4" />}
              >
                Get Started Free
              </NbButton>
            )}
          </div>
        </div>

        {/* Hero visual */}
        <div className="flex items-center justify-center">
          <div
            className={cn(
              "w-full max-w-sm bg-nb-blue [border:var(--nb-border)]",
              "[box-shadow:12px_12px_0_var(--nb-black)] p-6 rotate-2",
              "flex flex-col items-center gap-4 text-nb-black"
            )}
          >
            <div className="text-6xl ai-float">🍈</div>
            <div className="font-display text-sm text-center">
              Hi! I&apos;m Cosmo
              <br />
              your AI tutor!
            </div>
            <div
              className={cn(
                "bg-white [border:var(--nb-border)] px-4 py-3 w-full",
                "[box-shadow:4px_4px_0_var(--nb-black)] text-sm font-semibold"
              )}
            >
              💡 &quot;What is photosynthesis?&quot;
              <br />
              <span className="text-[#666]">Ask me anything about your lessons!</span>
            </div>
            <NbPill color="purple">
              <Brain className="w-3 h-3" />
              AI-Powered
            </NbPill>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <StatStrip stats={stats} className="grid-cols-2 md:grid-cols-4" />

      {/* ── FEATURES ── */}
      <SectionContainer>
        <SectionHeader
          title="Everything you need to learn"
          subtitle="Lessons, quizzes, games — all powered by AI"
          badge={<NbPill color="orange" icon={<Zap className="w-3 h-3" />}>6 Features</NbPill>}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className={cn(
                "nb-card p-6 rounded-2xl",
                "flex flex-col gap-4 cursor-default"
              )}
            >
              <div
                className={cn(
                  "w-14 h-14 rounded-xl [border:var(--nb-border)] flex items-center justify-center",
                  f.bg
                )}
              >
                {f.icon}
              </div>
              <div>
                <h3 className="font-display text-sm mb-1">{f.title}</h3>
                <p className="text-sm font-medium text-[#555] leading-snug">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* ── CTA ── */}
      <section
        className={cn(
          "px-6 py-16 [border-bottom:var(--nb-border)]",
          "bg-nb-black text-white text-center",
          "flex flex-col items-center gap-6"
        )}
      >
        <h2 className="font-display text-[clamp(1.5rem,4vw,2.5rem)] text-nb-yellow">
          Ready to learn?
        </h2>
        <p className="text-white/70 font-semibold max-w-sm">
          Join thousands of kids already levelling up with Melon.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {user ? (
            <Link href={user.role === "parent" ? "/parent" : "/lessons"}>
              <NbButton
                variant="secondary"
                size="lg"
                icon={user.role === "parent" ? <Users className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              >
                {user.role === "parent" ? "Go to Dashboard" : "Go to Lessons"}
              </NbButton>
            </Link>
          ) : (
            <NbButton
              variant="secondary"
              size="lg"
              onClick={() => setAuthOpen(true)}
              icon={<Zap className="w-4 h-4" />}
            >
              Start for free
            </NbButton>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-10 bg-white [border-bottom:var(--nb-border)]">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <div className="font-display text-sm mb-2">🍈 Melon</div>
            <p className="text-sm text-[#666] font-medium max-w-xs">
              AI-powered adaptive learning for curious kids everywhere.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/lessons" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Lessons</Link>
            <Link href="/leaderboard" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Leaderboard</Link>
            <Link href="/parent" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Parent Portal</Link>
          </div>
        </div>
        <div className="mt-8 pt-5 [border-top:var(--nb-border)] text-center text-xs font-bold uppercase text-[#888]">
          © 2026 Melon App · CSC10011 PA2
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
