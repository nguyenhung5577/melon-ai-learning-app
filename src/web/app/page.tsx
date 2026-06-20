"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    title: "Gia sư AI",
    desc: "Cosmo học theo nhịp của con, trả lời câu hỏi và mở gợi ý tức thì.",
    bg: "bg-nb-purple",
  },
  {
    icon: <BookOpen className="w-8 h-8" />,
    title: "Bài học thông minh",
    desc: "Bài học tương tác theo chương trình của con, có thể đọc tài liệu PDF.",
    bg: "bg-nb-blue",
  },
  {
    icon: <Trophy className="w-8 h-8" />,
    title: "Nhận phần thưởng",
    desc: "Tích lũy XP, huy hiệu và leo bảng xếp hạng sau mỗi bài học.",
    bg: "bg-nb-yellow",
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Khu vực phụ huynh",
    desc: "Theo dõi tiến độ, quản lý thời gian học và tài khoản gia đình.",
    bg: "bg-nb-green",
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: "Quiz AI",
    desc: "Câu hỏi được tạo từ nội dung bài học, mỗi lượt luyện đều mới.",
    bg: "bg-nb-orange",
  },
  {
    icon: <Star className="w-8 h-8" />,
    title: "Nhiệm vụ hằng ngày",
    desc: "Nhiệm vụ ngắn giúp con giữ thói quen học đều.",
    bg: "bg-nb-pink",
  },
];

const stats = [
  { value: "10K+", label: "Học sinh", color: "orange" as const },
  { value: "500+", label: "Bài học", color: "green" as const },
  { value: "98%", label: "Trẻ thích học", color: "blue" as const },
  { value: "4.9★", label: "Đánh giá", color: "purple" as const },
];

export default function HomePage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "kid") {
      router.replace("/progress");
    }
  }, [router, user?.role]);

  if (user?.role === "kid") {
    return (
      <KidShell
        userName={user.displayName ?? undefined}
        photoURL={user.avatarUrl ?? user.photoURL}
        onLogout={logout}
        hideNav
      >
        <div className="flex min-h-[60dvh] items-center justify-center px-6 text-center">
          <div className="font-display text-sm">Đang mở trang tiến độ...</div>
        </div>
      </KidShell>
    );
  }

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
            Nền tảng học tập cùng AI
          </div>

          <h1
            className={cn(
              "font-display leading-none mb-6",
              "text-[clamp(2.5rem,6vw,4rem)]"
            )}
          >
            Học thông minh
            <br />
            <span className="bg-white px-2 [box-shadow:4px_4px_0_var(--nb-black)] inline-block">
              Vui hơn
            </span>
            <br />
            Tiến bộ hơn
          </h1>

          <p className="text-xl font-medium leading-snug mb-8 max-w-md text-nb-black">
            Melon giúp trẻ học vui hơn, cá nhân hóa hơn và thấy rõ tiến bộ mỗi ngày.
          </p>

          <div className="flex flex-wrap gap-3">
            {user ? (
              user.role === "parent" ? (
                <>
                  <Link href="/parent">
                    <NbButton variant="primary" size="lg" icon={<Users className="w-4 h-4" />}>
                      Bảng phụ huynh
                    </NbButton>
                  </Link>
                  <Link href="/family">
                    <NbButton variant="ghost" size="lg">
                      Quản lý gia đình
                    </NbButton>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/lessons">
                    <NbButton variant="primary" size="lg" icon={<BookOpen className="w-4 h-4" />}>
                      Bắt đầu học
                    </NbButton>
                  </Link>
                  <Link href="/progress">
                    <NbButton variant="ghost" size="lg">
                      Tiến độ của con
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
                Bắt đầu miễn phí
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
              Chào con, mình là Cosmo
              <br />
              gia sư AI của con!
            </div>
            <div
              className={cn(
                "bg-white [border:var(--nb-border)] px-4 py-3 w-full",
                "[box-shadow:4px_4px_0_var(--nb-black)] text-sm font-semibold"
              )}
            >
              💡 &quot;Phân số là gì?&quot;
              <br />
              <span className="text-[#666]">Hỏi mình bất cứ điều gì trong bài học nhé!</span>
            </div>
            <NbPill color="purple">
              <Brain className="w-3 h-3" />
              Học cùng AI
            </NbPill>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <StatStrip stats={stats} className="grid-cols-2 md:grid-cols-4" />

      {/* ── FEATURES ── */}
      <SectionContainer>
        <SectionHeader
          title="Mọi thứ con cần để học tốt"
          subtitle="Bài học, quiz và trò chơi đều được AI hỗ trợ"
          badge={<NbPill color="orange" icon={<Zap className="w-3 h-3" />}>6 tính năng</NbPill>}
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
          Sẵn sàng học chưa?
        </h2>
        <p className="text-white/70 font-semibold max-w-sm">
          Cùng hàng nghìn bạn nhỏ tiến bộ mỗi ngày với Melon.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {user ? (
            <Link href={user.role === "parent" ? "/parent" : "/lessons"}>
              <NbButton
                variant="secondary"
                size="lg"
                icon={user.role === "parent" ? <Users className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              >
                {user.role === "parent" ? "Mở bảng phụ huynh" : "Vào bài học"}
              </NbButton>
            </Link>
          ) : (
            <NbButton
              variant="secondary"
              size="lg"
              onClick={() => setAuthOpen(true)}
              icon={<Zap className="w-4 h-4" />}
            >
              Bắt đầu miễn phí
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
              Học tập cá nhân hóa cùng AI cho những bạn nhỏ ham khám phá.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/lessons" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Bài học</Link>
            <Link href="/leaderboard" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Xếp hạng</Link>
            <Link href="/parent" className="text-sm font-bold text-nb-black hover:text-nb-orange transition-colors no-underline">Phụ huynh</Link>
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
