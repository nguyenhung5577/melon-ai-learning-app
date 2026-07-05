"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { PersonalizedExercisePanel } from "@/components/problems/PersonalizedExercisePanel";
import { SectionContainer } from "@/components/shared/SectionHeader";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { collections } from "@/lib/db/firestore";
import { queryDocuments } from "@/lib/db/firestore-helpers";
import { useAuthContext } from "@/lib/auth/auth-context";
import { useSearchParams } from "next/navigation";

function StudyPageContent() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const searchParams = useSearchParams();
  const preferredCourseRunId = searchParams.get("courseRunId") ?? undefined;
  const canLoadKidData = user?.role === "kid";

  const questionsQuery = useQuery({
    queryKey: ["questionBank", "study"],
    queryFn: () => queryDocuments(collections.questionBank),
    enabled: canLoadKidData,
    staleTime: 5 * 60 * 1000,
  });

  const questions = useMemo(
    () => [...(questionsQuery.data ?? [])].sort((a, b) => a.questionNumber - b.questionNumber),
    [questionsQuery.data]
  );

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
            loadingQuestions={questionsQuery.isLoading || questionsQuery.isFetching}
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
