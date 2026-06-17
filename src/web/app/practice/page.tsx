"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { ProblemParserPanel } from "@/components/problems/ProblemParserPanel";
import { SavedProblemLists } from "@/components/problems/SavedProblemLists";
import { useAuthContext } from "@/lib/auth/auth-context";

export default function PracticePage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [exerciseActive, setExerciseActive] = useState(false);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogout={logout}
      onLogin={() => setAuthOpen(true)}
      hideNav={exerciseActive}
    >
      <KidOnlyGuard>
        <SectionContainer className={exerciseActive ? "px-0 py-0 [border-bottom:0]" : undefined}>
          {!exerciseActive && (
            <SectionHeader
              title="Luyện đề Toán"
              badge={<NbPill color="green">Lớp 4-5</NbPill>}
            />
          )}

          <SavedProblemLists
            mode="student"
            uid={user?.uid}
            onExerciseSessionChange={setExerciseActive}
          />

          {!exerciseActive && (
            <div className="mt-10">
              <SectionHeader
                title="Gửi đề riêng"
                badge={<NbPill color="orange">Tùy chọn</NbPill>}
              />
              <ProblemParserPanel mode="student" uid={user?.uid} />
            </div>
          )}
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
