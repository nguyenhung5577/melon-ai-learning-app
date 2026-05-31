"use client";

import { useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, KeyRound, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NbButton } from "@/components/shared/NbButton";
import { useAuthContext } from "@/lib/auth/auth-context";

type AuthView = "parent" | "child";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
  defaultView?: AuthView;
}

export function AuthModal({
  open,
  onClose,
  defaultView = "parent",
}: AuthModalProps) {
  const { signInWithGoogle, signInChild, loading, error } = useAuthContext();
  const [view, setView] = useState<AuthView>(defaultView);
  const [loginId, setLoginId] = useState("");
  const [passwordOrPin, setPasswordOrPin] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [formError, setFormError] = useState("");

  if (!open) return null;

  async function handleParentGoogle() {
    setFormError("");
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  async function handleChildLogin(e: FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!loginId.trim()) {
      setFormError("Enter your Child ID.");
      return;
    }
    if (!passwordOrPin.trim()) {
      setFormError("Enter your PIN or password.");
      return;
    }

    try {
      await signInChild(loginId, passwordOrPin);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Child login failed");
    }
  }

  const errorMessage = formError || error;

  return (
    <div
      className="fixed inset-0 bg-nb-black/75 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "bg-nb-bg [border:var(--nb-border)] [box-shadow:16px_16px_0_var(--nb-black)]",
          "w-full max-w-[540px] max-h-[90vh] overflow-y-auto relative modal-enter"
        )}
      >
        <div className="flex items-center justify-between px-8 py-5 bg-white [border-bottom:var(--nb-border)]">
          <span className="font-display text-base flex items-center gap-2">
            Melon Account
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

        <div className="px-8 py-7">
          <div className="grid grid-cols-2 [border:var(--nb-border)] mb-7 overflow-hidden">
            {([
              { id: "parent" as const, label: "Parent" },
              { id: "child" as const, label: "Child" },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setFormError("");
                }}
                className={cn(
                  "py-3.5 font-display text-[0.75rem] cursor-pointer transition-all duration-150",
                  "bg-transparent border-none",
                  view === item.id
                    ? "bg-nb-black text-white"
                    : "text-nb-black hover:bg-white"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {view === "parent" ? (
            <div className="flex flex-col gap-5">
              <div className="bg-white [border:var(--nb-border)] p-5 [box-shadow:5px_5px_0_var(--nb-black)]">
                <div className="w-12 h-12 bg-nb-blue [border:var(--nb-border)] rounded-full flex items-center justify-center mb-4">
                  <UserRound className="w-6 h-6" />
                </div>
                <h2 className="font-display text-base mb-2">Parent Access</h2>
                <p className="text-sm font-semibold text-[#555] leading-snug">
                  Parents use Google to create and manage the family account.
                </p>
              </div>

              <button
                type="button"
                onClick={handleParentGoogle}
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-3 py-3.5",
                  "[border:var(--nb-border)] bg-white font-body font-bold text-sm",
                  "[box-shadow:4px_4px_0_var(--nb-black)] cursor-pointer disabled:opacity-60",
                  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:6px_6px_0_var(--nb-black)]",
                  "transition-all duration-150"
                )}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => setView("child")}
                className="text-sm font-bold underline bg-transparent border-none cursor-pointer text-nb-black"
              >
                Child login with ID instead
              </button>
            </div>
          ) : (
            <form onSubmit={handleChildLogin} className="flex flex-col gap-4">
              <div className="bg-white [border:var(--nb-border)] p-5 [box-shadow:5px_5px_0_var(--nb-black)] mb-1">
                <div className="w-12 h-12 bg-nb-yellow [border:var(--nb-border)] rounded-full flex items-center justify-center mb-4">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="font-display text-base mb-2">Child Login</h2>
                <p className="text-sm font-semibold text-[#555] leading-snug">
                  Use the Child ID and PIN/password created by your parent.
                </p>
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">
                  Child ID
                </label>
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="melon_hero"
                  autoComplete="username"
                  required
                  className="nb-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[0.8rem] uppercase mb-1.5">
                  PIN or Password
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={passwordOrPin}
                    onChange={(e) => setPasswordOrPin(e.target.value)}
                    placeholder="••••••"
                    autoComplete="current-password"
                    required
                    className="nb-input pr-12"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888] cursor-pointer bg-transparent border-none"
                    aria-label="Toggle PIN visibility"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <NbButton
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full mt-2"
                icon={<Check className="w-4 h-4" />}
              >
                Login as Child
              </NbButton>
            </form>
          )}

          {errorMessage && (
            <div className="mt-5 bg-nb-pink/30 [border:var(--nb-border-3)_solid_var(--nb-red)] px-4 py-3 text-sm font-semibold text-nb-black">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
