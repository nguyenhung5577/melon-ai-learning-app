import { cn } from "@/lib/utils";

type PillColor = "purple" | "green" | "yellow" | "blue" | "orange" | "pink" | "black";

interface NbPillProps {
  children: React.ReactNode;
  color?: PillColor;
  icon?: React.ReactNode;
  className?: string;
}

const pillBg: Record<PillColor, string> = {
  purple: "bg-nb-purple",
  green:  "bg-nb-green text-white",
  yellow: "bg-nb-yellow",
  blue:   "bg-nb-blue",
  orange: "bg-nb-orange",
  pink:   "bg-nb-pink",
  black:  "bg-nb-black text-white",
};

export function NbPill({ children, color = "purple", icon, className }: NbPillProps) {
  return (
    <span
      className={cn(
        "nb-pill",
        pillBg[color],
        "text-nb-black",
        color === "green" || color === "black" ? "text-white" : "text-nb-black",
        className
      )}
    >
      {icon && icon}
      {children}
    </span>
  );
}
