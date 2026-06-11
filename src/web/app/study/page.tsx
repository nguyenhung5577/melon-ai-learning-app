"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { PersonalizedExercisePanel } from "@/components/problems/PersonalizedExercisePanel";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { collections } from "@/lib/db/firestore";
import { queryDocuments } from "@/lib/db/firestore-helpers";
import type { QuestionBankQuestion } from "@/lib/problems/types";
import { useAuthContext } from "@/lib/auth/auth-context";
import { useSearchParams } from "next/navigation";

export default function StudyPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [exerciseActive, setExerciseActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const searchParams = useSearchParams();
  const preferredCourseRunId = searchParams.get("courseRunId") ?? undefined;

  useEffect(() => {
    let mounted = true;

    async function loadQuestions() {
      setLoading(true);
      try {
        const savedQuestions = await queryDocuments(collections.questionBank);
        if (!mounted) return;
        setQuestions(savedQuestions.sort((a, b) => a.questionNumber - b.questionNumber));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadQuestions();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
      hideNav={exerciseActive}
    >
      <KidOnlyGuard>
        <SectionContainer className={exerciseActive ? "px-0 py-0 [border-bottom:0]" : undefined}>
          {!exerciseActive && (
            <SectionHeader
              title="Học theo lộ trình"
              subtitle="Melon chọn chặng học tiếp theo theo đúng khóa con đang theo và kết quả làm bài gần đây."
              badge={<NbPill color="green">Cá nhân hóa</NbPill>}
            />
          )}

          <PersonalizedExercisePanel
            uid={user?.uid}
            questions={questions}
            loadingQuestions={loading}
            onSessionChange={setExerciseActive}
            preferredCourseRunId={preferredCourseRunId}
          />
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
