"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, KeyRound, Target, UserPlus, Users } from "lucide-react";
import { ParentShell } from "@/components/layout/ParentShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { ChildAvatarPicker } from "@/components/shared/ChildAvatarPicker";
import { useAuthContext } from "@/lib/auth/auth-context";
import { useSubscription } from "@/lib/subscription/use-subscription";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import {
  userStore,
  type ChildProfile,
  type CreateChildAccountInput,
  type GradeLevel,
  type WeakTopic,
} from "@/lib/user/user-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const gradeOptions: Array<{ label: string; value: GradeLevel; grade: string }> = [
  { label: "Grade 4", value: "grade_4", grade: "Grade 4" },
  { label: "Grade 5", value: "grade_5", grade: "Grade 5" },
];

const goalOptions = [
  { value: "improve_math_score", label: "Cải thiện điểm Toán" },
  { value: "specialized_school_exam", label: "Ôn thi trường chuyên" },
  { value: "strengthen_current_grade", label: "Học chắc kiến thức hiện tại" },
] as const;

const weakTopicOptions: Array<{ value: WeakTopic; label: string }> = [
  { value: "arithmetic", label: "Số học" },
  { value: "fractions", label: "Phân số" },
  { value: "geometry", label: "Hình học" },
  { value: "word_problems", label: "Toán lời văn" },
  { value: "logic", label: "Tư duy logic" },
  { value: "mixed_exams", label: "Đề tổng hợp" },
];

const practiceSourceOptions = [
  { value: "school_lessons", label: "Bài học trên lớp" },
  { value: "past_exams", label: "Đề thi các năm" },
  { value: "both", label: "Cả hai" },
] as const;

const reminderOptions = [
  { value: "after_school", label: "Sau giờ học" },
  { value: "evening", label: "Buổi tối" },
  { value: "weekend", label: "Cuối tuần" },
  { value: "none", label: "Không nhắc" },
] as const;

const reportOptions = [
  { value: "after_each_lesson", label: "Sau mỗi bài học" },
  { value: "weekly", label: "Hàng tuần" },
  { value: "struggling_only", label: "Chỉ khi con gặp khó" },
  { value: "none", label: "Không gửi" },
] as const;

const defaultForm: CreateChildAccountInput & { confirmSecret: string } = {
  loginId: "",
  displayName: "",
  passwordOrPin: "",
  confirmSecret: "",
  grade: "Grade 4",
  avatarEmoji: "🦊",
  learningPreferences: {
    primaryGoal: "improve_math_score",
    domain: "math",
    gradeLevel: "grade_4",
    currentScore: 7,
    targetScore: 9,
    targetSchool: "",
    weakTopics: ["fractions"],
    practiceSource: "both",
    sessionMinutes: 30,
    sessionsPerWeek: 5,
    reminderPreference: "evening",
    parentReportPreference: "weekly",
  },
};

function optionLabel<T extends string>(
  options: ReadonlyArray<{ value: T; label: string }>,
  value: T
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function FamilyPage() {
  const { user, logout } = useAuthContext();
  const { entitlements } = useSubscription();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  useEffect(() => {
    if (!user || user.role !== "parent") return;
    userStore.getChildrenForParent(user.uid).then(setChildren);
  }, [user]);

  async function handleCreateChild() {
    setFormError("");
    setMessage("");

    const loginId = form.loginId.trim().toLowerCase();
    const displayName = form.displayName.trim();
    if (!/^[a-z0-9_]{3,24}$/.test(loginId)) {
      setFormError("Child ID must be 3-24 lowercase letters, numbers, or underscores.");
      return;
    }
    if (displayName.length < 2) {
      setFormError("Display name must be at least 2 characters.");
      return;
    }
    if (form.passwordOrPin.length < 4) {
      setFormError("PIN/password must be at least 4 characters.");
      return;
    }
    if (form.passwordOrPin !== form.confirmSecret) {
      setFormError("PIN/password and confirmation do not match.");
      return;
    }
    if (
      form.learningPreferences.currentScore < 0 ||
      form.learningPreferences.currentScore > 10 ||
      form.learningPreferences.targetScore < 0 ||
      form.learningPreferences.targetScore > 10
    ) {
      setFormError("Math scores must be between 0 and 10.");
      return;
    }
    if (form.learningPreferences.weakTopics.length === 0) {
      setFormError("Choose at least one weak topic.");
      return;
    }

    if (entitlements && children.length >= entitlements.maxChildren) {
      setPaywallOpen(true);
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const child = await userStore.createChildAccount({
        loginId,
        displayName,
        passwordOrPin: form.passwordOrPin,
        grade: form.grade,
        avatarEmoji: form.avatarEmoji,
        learningPreferences: {
          ...form.learningPreferences,
          targetSchool: form.learningPreferences.targetSchool?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        },
      });
      setChildren((items) => [child, ...items.filter((item) => item.uid !== child.uid)]);
      setForm(defaultForm);
      setMessage(`Created child account ${child.loginId ?? child.uid}.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create child account.");
    } finally {
      setSaving(false);
    }
  }

  function updateLearningPreferences(
    patch: Partial<CreateChildAccountInput["learningPreferences"]>
  ) {
    setForm({
      ...form,
      learningPreferences: {
        ...form.learningPreferences,
        ...patch,
      },
    });
  }

  function toggleWeakTopic(topic: WeakTopic) {
    const current = form.learningPreferences.weakTopics;
    updateLearningPreferences({
      weakTopics: current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    });
  }

  if (!user || user.role !== "parent") {
    return (
      <ParentShell>
        <SectionContainer>
          <div className="text-center py-12">
            <p className="font-display text-lg mb-4">Parent account required</p>
            <NbButton variant="primary" onClick={() => setAuthOpen(true)}>
              Continue with Google
            </NbButton>
          </div>
        </SectionContainer>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      </ParentShell>
    );
  }

  return (
    <ParentShell userName={user.displayName ?? undefined} onLogout={handleLogout}>
      <SectionContainer>
        <SectionHeader
          title="Family"
          subtitle="Create and manage child accounts"
          badge={
            <NbPill color="blue" icon={<Users className="w-3 h-3" />}>
              {children.length} kids
            </NbPill>
          }
        />

        <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} featureName="Tạo thêm tài khoản con" />

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8 items-start">
          <div className="nb-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-nb-yellow [border:var(--nb-border)] rounded-full flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-sm">Create Child Account</h3>
                <p className="text-xs font-semibold text-[#666]">No Gmail required for children</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 pt-1">
                <KeyRound className="w-4 h-4 text-nb-orange" />
                <h4 className="font-display text-[0.75rem]">Account</h4>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Child ID</label>
                <input
                  value={form.loginId}
                  onChange={(e) => setForm({ ...form, loginId: e.target.value })}
                  placeholder="melon_hero"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Minh Khoi"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Grade</label>
                <select
                  value={form.grade}
                  onChange={(e) => {
                    const selected = gradeOptions.find((grade) => grade.grade === e.target.value) ?? gradeOptions[0];
                    setForm({
                      ...form,
                      grade: selected.grade,
                      learningPreferences: {
                        ...form.learningPreferences,
                        gradeLevel: selected.value,
                      },
                    });
                  }}
                  className="nb-input cursor-pointer"
                >
                  {gradeOptions.map((grade) => (
                    <option key={grade.grade} value={grade.grade}>{grade.label}</option>
                  ))}
                </select>
              </div>

              <ChildAvatarPicker
                selected={form.avatarEmoji}
                onSelect={(avatarEmoji) => setForm({ ...form, avatarEmoji })}
              />

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">PIN or Password</label>
                <input
                  type="password"
                  value={form.passwordOrPin}
                  onChange={(e) => setForm({ ...form, passwordOrPin: e.target.value })}
                  placeholder="••••••"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Confirm PIN or Password</label>
                <input
                  type="password"
                  value={form.confirmSecret}
                  onChange={(e) => setForm({ ...form, confirmSecret: e.target.value })}
                  placeholder="••••••"
                  className="nb-input"
                />
              </div>

              <div className="flex items-center gap-2 pt-4 [border-top:var(--nb-border-thin)]">
                <Target className="w-4 h-4 text-nb-green" />
                <h4 className="font-display text-[0.75rem]">Learning Setup</h4>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Mục tiêu chính của con là gì?</label>
                <select
                  value={form.learningPreferences.primaryGoal}
                  onChange={(e) => updateLearningPreferences({
                    primaryGoal: e.target.value as CreateChildAccountInput["learningPreferences"]["primaryGoal"],
                  })}
                  className="nb-input cursor-pointer"
                >
                  {goalOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Điểm Toán hiện tại?</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={form.learningPreferences.currentScore}
                    onChange={(e) => updateLearningPreferences({ currentScore: Number(e.target.value) })}
                    className="nb-input"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Mục tiêu điểm số?</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={form.learningPreferences.targetScore}
                    onChange={(e) => updateLearningPreferences({ targetScore: Number(e.target.value) })}
                    className="nb-input"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Trường mục tiêu</label>
                <input
                  value={form.learningPreferences.targetSchool ?? ""}
                  onChange={(e) => updateLearningPreferences({ targetSchool: e.target.value })}
                  placeholder="Optional"
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-2">Con yếu phần nào nhất?</label>
                <div className="flex flex-wrap gap-2">
                  {weakTopicOptions.map((topic) => {
                    const selected = form.learningPreferences.weakTopics.includes(topic.value);
                    return (
                      <button
                        key={topic.value}
                        type="button"
                        onClick={() => toggleWeakTopic(topic.value)}
                        className={cn(
                          "px-3 py-2 rounded-xl [border:var(--nb-border-thin)] text-xs font-bold cursor-pointer",
                          selected ? "bg-nb-yellow [box-shadow:2px_2px_0_var(--nb-black)]" : "bg-white"
                        )}
                      >
                        {topic.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Con muốn luyện theo nguồn nào?</label>
                <select
                  value={form.learningPreferences.practiceSource}
                  onChange={(e) => updateLearningPreferences({
                    practiceSource: e.target.value as CreateChildAccountInput["learningPreferences"]["practiceSource"],
                  })}
                  className="nb-input cursor-pointer"
                >
                  {practiceSourceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Mỗi buổi học bao lâu?</label>
                  <select
                    value={form.learningPreferences.sessionMinutes}
                    onChange={(e) => updateLearningPreferences({
                      sessionMinutes: Number(e.target.value) as CreateChildAccountInput["learningPreferences"]["sessionMinutes"],
                    })}
                    className="nb-input cursor-pointer"
                  >
                    {[15, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} phút</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Mấy buổi mỗi tuần?</label>
                  <select
                    value={form.learningPreferences.sessionsPerWeek}
                    onChange={(e) => updateLearningPreferences({
                      sessionsPerWeek: Number(e.target.value) as CreateChildAccountInput["learningPreferences"]["sessionsPerWeek"],
                    })}
                    className="nb-input cursor-pointer"
                  >
                    {[2, 3, 5, 7].map((count) => (
                      <option key={count} value={count}>{count} buổi</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Muốn nhận nhắc học khi nào?</label>
                <select
                  value={form.learningPreferences.reminderPreference}
                  onChange={(e) => updateLearningPreferences({
                    reminderPreference: e.target.value as CreateChildAccountInput["learningPreferences"]["reminderPreference"],
                  })}
                  className="nb-input cursor-pointer"
                >
                  {reminderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">Phụ huynh muốn nhận báo cáo thế nào?</label>
                <select
                  value={form.learningPreferences.parentReportPreference}
                  onChange={(e) => updateLearningPreferences({
                    parentReportPreference: e.target.value as CreateChildAccountInput["learningPreferences"]["parentReportPreference"],
                  })}
                  className="nb-input cursor-pointer"
                >
                  {reportOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="bg-nb-pink/30 [border:var(--nb-border-3)_solid_var(--nb-red)] px-4 py-3 text-sm font-semibold text-nb-black">
                  {formError}
                </div>
              )}
              {message && (
                <div className="bg-nb-green/20 [border:var(--nb-border-3)_solid_var(--nb-green)] px-4 py-3 text-sm font-semibold text-nb-black">
                  {message}
                </div>
              )}

              <NbButton
                variant="primary"
                loading={saving}
                onClick={handleCreateChild}
                icon={<KeyRound className="w-4 h-4" />}
              >
                Create Child
              </NbButton>
            </div>
          </div>

          {children.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-nb-black/20 rounded-2xl">
              <div className="text-5xl mb-4">👨‍👧</div>
              <p className="font-display text-sm text-[#666]">No children created yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {children.map((child) => (
                <ChildCard key={child.uid} child={child} />
              ))}
            </div>
          )}
        </div>
      </SectionContainer>
    </ParentShell>
  );
}

function ChildCard({ child }: { child: ChildProfile }) {
  const prefs = child.learningPreferences;

  return (
    <div className={cn("nb-card rounded-2xl p-5 flex items-start gap-4")}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0
                   bg-nb-yellow [border:var(--nb-border)] [box-shadow:var(--nb-shadow-sm)]"
      >
        {child.avatarEmoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm truncate">{child.displayName}</div>
        <div className="text-xs font-semibold text-[#666] mb-1">{child.grade}</div>
        <div className="text-[0.7rem] font-bold text-[#666] truncate">
          ID: {child.loginId ?? child.uid}
        </div>
        <div className="text-[0.65rem] font-semibold text-[#999] truncate">
          UID: {child.uid}
        </div>
        {prefs && (
          <div className="mt-3 pt-3 [border-top:var(--nb-border-thin)] flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[0.7rem] font-bold text-nb-black">
              <BookOpenCheck className="w-3.5 h-3.5 text-nb-green" />
              {optionLabel(goalOptions, prefs.primaryGoal)}
            </div>
            <div className="text-[0.7rem] font-semibold text-[#666]">
              Target {prefs.targetScore}/10 · {prefs.sessionMinutes}m x {prefs.sessionsPerWeek}/week
            </div>
            <div className="text-[0.65rem] font-semibold text-[#777] line-clamp-2">
              Weak: {prefs.weakTopics.map((topic) => optionLabel(weakTopicOptions, topic)).join(", ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
