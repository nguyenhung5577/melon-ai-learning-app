"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface XPBarProps {
  totalXp: number;
  level: number;
  xpToNextLevel: number;
  className?: string;
}

export function XPBar({ totalXp, level, xpToNextLevel, className }: XPBarProps) {
  const levelXpBase = (level - 1) * 200;
  const currentLevelXp = totalXp - levelXpBase;
  const pct = Math.min(Math.round((currentLevelXp / 200) * 100), 100);

  return (
    <div
      className={cn(
        "bg-white [border:var(--nb-border)] [box-shadow:var(--nb-shadow)] rounded-2xl p-5",
        className
      )}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-display text-[0.75rem] uppercase">XP Progress</span>
        <span className="font-black text-[0.8rem] text-nb-orange flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" />
          {totalXp.toLocaleString()} xp
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "bg-nb-black text-nb-yellow font-display text-[0.7rem] uppercase",
            "px-3 py-1 rounded"
          )}
        >
          Lv.{level}
        </div>
        <div className="flex-1 text-[0.7rem] font-bold text-[#666]">
          {xpToNextLevel} xp to Level {level + 1}
        </div>
      </div>

      <div className="nb-progress-track h-[22px]">
        <motion.div
          className="nb-progress-fill h-full"
          style={{
            background: "linear-gradient(90deg, var(--nb-orange) 0%, var(--nb-pink) 100%)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      <div className="flex justify-between mt-1 text-[0.65rem] font-black text-[#666]">
        <span>0</span>
        <span>{pct}%</span>
        <span>200</span>
      </div>
    </div>
  );
}
