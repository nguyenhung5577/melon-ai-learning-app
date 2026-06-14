"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminGuard } from "@/components/shared/AdminGuard";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ProblemParserPanel } from "@/components/problems/ProblemParserPanel";
import { SavedProblemLists } from "@/components/problems/SavedProblemLists";
import { useAuthContext } from "@/lib/auth/auth-context";

export default function QuestionBankPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"parse" | "manage">("parse");

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Admin"} onLogout={handleLogout}>
        <SectionHeader
          title="Kho Đề Toán"
          subtitle="Đọc đề Toán lớp 4-5 từ text, PDF hoặc ảnh nhiều trang"
          badge={<NbPill color="orange">AI đọc đề</NbPill>}
        />

        <div className="mt-8 flex flex-wrap gap-3">
          <NbButton
            variant={activeTab === "parse" ? "secondary" : "ghost"}
            onClick={() => setActiveTab("parse")}
          >
            Đọc đề
          </NbButton>
          <NbButton
            variant={activeTab === "manage" ? "secondary" : "ghost"}
            onClick={() => setActiveTab("manage")}
          >
            Quản lý kho
          </NbButton>
        </div>

        {activeTab === "parse" ? (
          <div className="mt-8">
            <ProblemParserPanel mode="admin" uid={user?.uid} />
          </div>
        ) : (
          <SavedProblemLists mode="admin" uid={user?.uid} />
        )}
      </AdminShell>
    </AdminGuard>
  );
}
