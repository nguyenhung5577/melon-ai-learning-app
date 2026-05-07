"use client";

import { cn } from "@/lib/utils";
import { AVATAR_EMOJIS } from "@/lib/user/user-store";

interface ChildAvatarPickerProps {
  selected: string;
  onSelect: (emoji: string) => void;
}

export function ChildAvatarPicker({ selected, onSelect }: ChildAvatarPickerProps) {
  return (
    <div>
      <p className="font-bold text-[0.8rem] uppercase mb-3 text-[#555]">Choose Avatar</p>
      <div className="grid grid-cols-8 gap-2">
        {AVATAR_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className={cn(
              "w-10 h-10 text-xl rounded-xl [border:var(--nb-border-thin)] cursor-pointer",
              "flex items-center justify-center transition-all duration-150",
              "hover:[border:var(--nb-border)] hover:[box-shadow:3px_3px_0_var(--nb-black)]",
              selected === emoji
                ? "bg-nb-yellow [border:var(--nb-border)] [box-shadow:3px_3px_0_var(--nb-black)] -translate-x-0.5 -translate-y-0.5"
                : "bg-white"
            )}
            aria-label={`Select avatar ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
