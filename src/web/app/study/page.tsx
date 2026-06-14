"use client";

import { Suspense, useEffect, useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { PersonalizedExercisePanel } from "@/components/problems/PersonalizedExercisePanel";
import { SectionContainer } from "@/components/shared/SectionHeader";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { collections } from "@/lib/db/firestore";
import { queryDocuments } from "@/lib/db/firestore-helpers";
import type { QuestionBankQuestion } from "@/lib/problems/types";
import { useAuthContext } from "@/lib/auth/auth-context";
import { useSearchParams } from "next/navigation";

function StudyPageContent() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
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
      hideNav
    >
      <KidOnlyGuard>
        <SectionContainer className="px-0 py-0 [border-bottom:0]">
          <PersonalizedExercisePanel
            uid={user?.uid}
            questions={questions}
            loadingQuestions={loading}
            preferredCourseRunId={preferredCourseRunId}
            autoStart
          />
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyPageContent />
    </Suspense>
  );
}
