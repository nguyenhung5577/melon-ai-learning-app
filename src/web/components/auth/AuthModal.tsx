"use client";

import { useState, type FormEvent } from "react";
import { X, Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { NbButton } from "@/components/shared/NbButton";
import { useAuthContext } from "@/lib/auth/auth-context";
import type { UserRole } from "@/lib/auth/types";

type Mode = "login" | "signup";
type Step = "role" | "form";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
}

const roleOptions: Array<{
  id: UserRole;
  label: string;
  sub: string;
  emoji: string;
  bg: string;
  selectedBg: string;
}> = [
  {
    id: "kid",
    label: "Student",
    sub: "Ages 6–14 · Learning journey",
    emoji: "🧒",
    bg: "bg-white",
    selectedBg: "bg-nb-yellow",
  },
  {
    id: "parent",
    label: "Parent",
    sub: "Monitor progress · Manage family",
    emoji: "👩",
    bg: "bg-white",
    selectedBg: "bg-nb-blue",
  },
];

export function AuthModal({ open, onClose, defaultMode = "login" }: AuthModalProps) {
  const { signIn, signUp, signInWithGoogle, loading, error } = useAuthContext();

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [step, setStep] = useState<Step>(mode === "signup" ? "role" : "form");
  const [role, setRole] = useState<UserRole>("kid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [coppa, setCoppa] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState("");

  if (!open) return null;

  function reset() {
    setEmail(""); setPassword(""); setName("");
    setCoppa(false); setShowPass(false); setFormError("");
    setStep(mode === "signup" ? "role" : "form");
  }

  function switchMode(m: Mode) {
    setMode(m);
    setStep(m === "signup" ? "role" : "form");
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (mode === "signup") {
      if (!name.trim()) { setFormError("Please enter your name."); return; }
      if (role === "kid" && !coppa) {
        setFormError("Parent/guardian consent is required for children under 13.");
        return;
      }
      try {
        await signUp(email, password, role, name.trim());
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Sign up failed");
      }
    } else {
      try {
        await signIn(email, password);
        onClose();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Login failed");
      }
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle(role);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <div
      className="fixed inset-0 bg-nb-black/75 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "bg-nb-bg [border:var(--nb-border)] [box-shadow:16px_16px_0_var(--nb-black)]",
          "w-full max-w-[560px] max-h-[90vh] overflow-y-auto relative modal-enter"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 bg-white [border-bottom:var(--nb-border)]">
          <span className="font-display text-base flex items-center gap-2">
            🍈 Melon
          </span>
          <button
            onClick={onClose}
            className={cn(
              "w-10 h-10 flex items-center justify-center cursor-pointer",
              "[border:var(--nb-border)] bg-nb-pink",
              "[box-shadow:3px_3px_0_var(--nb-black)]",
              "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:5px_5px_0_var(--nb-black)]",
              "transition-all duration-150"
            )}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-7">
          {/* Mode toggle */}
          <div className="flex [border:var(--nb-border)] mb-7 overflow-hidden">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 py-3.5 font-display text-[0.75rem] cursor-pointer transition-all duration-150",
                  "bg-transparent border-none",
                  mode === m
                    ? "bg-nb-black text-white"
                    : "text-nb-black hover:bg-nb-bg"
                )}
              >
                {m === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* STEP 1: Role picker (signup only) */}
          {mode === "signup" && step === "role" && (
            <div>
              <p className="font-display text-xs text-[#555] mb-4 tracking-widest">
                I am a...
              </p>
              <div className="grid grid-cols-2 gap-3 mb-7">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRole(opt.id)}
                    className={cn(
                      "relative [border:var(--nb-border)] p-5 flex flex-col items-center gap-2",
                      "cursor-pointer transition-all duration-150",
                      "[box-shadow:5px_5px_0_var(--nb-black)]",
                      "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:8px_8px_0_var(--nb-black)]",
                      role === opt.id
                        ? `${opt.selectedBg} -translate-x-0.5 -translate-y-0.5 [box-shadow:8px_8px_0_var(--nb-black)]`
                        : opt.bg
                    )}
                  >
                    {role === opt.id && (
                      <div className="absolute -top-3 -right-3 w-7 h-7 bg-nb-green [border:3px_solid_var(--nb-black)] rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className="text-4xl">{opt.emoji}</div>
                    <div className="font-display text-[0.75rem]">{opt.label}</div>
                    <div className="text-[0.65rem] font-semibold text-[#555] text-center leading-snug">
                      {opt.sub}
                    </div>
                  </button>
                ))}
              </div>
              <NbButton
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setStep("form")}
              >
                Continue as {role === "kid" ? "Student" : "Parent"} →
              </NbButton>
            </div>
          )}

          {/* STEP 2: Form */}
          {(mode === "login" || step === "form") && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === "signup" && (
                <div>
                  <label className="block font-bold text-[0.8rem] uppercase mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. Minh Khôi"
                    required
                    className="nb-input"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  required
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="nb-input pr-12"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888] cursor-pointer bg-transparent border-none"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "login" && (
                  <div className="text-right mt-1">
                    <a href="#" className="text-[0.8rem] font-bold text-nb-black underline">
                      Forgot password?
                    </a>
                  </div>
                )}
              </div>

              {/* COPPA consent (kid signup only) */}
              {mode === "signup" && role === "kid" && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <div
                    onClick={() => setCoppa((v) => !v)}
                    className={cn(
                      "mt-0.5 w-5 h-5 flex-shrink-0 [border:var(--nb-border-3)] flex items-center justify-center cursor-pointer",
                      coppa ? "bg-nb-green" : "bg-white"
                    )}
                  >
                    {coppa && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[0.8rem] font-semibold text-[#444] leading-snug">
                    I confirm that I am a parent or guardian providing consent for
                    a child under 13 to use Melon (COPPA compliance).
                  </span>
                </label>
              )}

              {(formError || error) && (
                <div className="bg-nb-pink/30 [border:var(--nb-border-3)_solid_var(--nb-red)] px-4 py-3 text-sm font-semibold text-nb-black">
                  {formError || error}
                </div>
              )}

              <NbButton
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full mt-2"
              >
                {mode === "login" ? "Login" : "Create Account"}
              </NbButton>
            </form>
          )}

          {/* Divider + social */}
          {(mode === "login" || step === "form") && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-[3px] bg-nb-black" />
                <span className="font-bold text-[0.75rem] uppercase whitespace-nowrap">
                  Or continue with
                </span>
                <div className="flex-1 h-[3px] bg-nb-black" />
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                className={cn(
                  "w-full flex items-center justify-center gap-3 py-3.5",
                  "[border:var(--nb-border)] bg-white font-body font-bold text-sm",
                  "[box-shadow:4px_4px_0_var(--nb-black)] cursor-pointer",
                  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:6px_6px_0_var(--nb-black)]",
                  "transition-all duration-150"
                )}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {/* Switch mode link */}
          <p className="text-center mt-5 text-sm font-semibold text-[#555]">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => { switchMode(mode === "login" ? "signup" : "login"); reset(); }}
              className="text-nb-black font-bold underline cursor-pointer bg-transparent border-none"
            >
              {mode === "login" ? "Sign up" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
