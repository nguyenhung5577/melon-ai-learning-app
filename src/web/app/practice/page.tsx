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

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogout={logout}
      onLogin={() => setAuthOpen(true)}
    >
      <KidOnlyGuard>
        <SectionContainer>
          <SectionHeader
            title="Gửi Đề Toán"
            subtitle="Upload ảnh, PDF hoặc paste đề để Melon đọc câu hỏi và đáp án"
            badge={<NbPill color="green">Lớp 4-5</NbPill>}
          />
          <div className="mt-8">
            <ProblemParserPanel mode="student" uid={user?.uid} />
          </div>
          <SavedProblemLists mode="student" uid={user?.uid} />
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
