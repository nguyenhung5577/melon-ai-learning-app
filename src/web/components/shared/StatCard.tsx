import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  color?: "orange" | "green" | "blue" | "purple" | "pink" | "yellow";
  className?: string;
}

const colorMap = {
  orange: "text-nb-orange",
  green: "text-nb-green",
  blue: "text-nb-blue",
  purple: "text-nb-purple",
  pink: "text-nb-pink",
  yellow: "text-nb-yellow",
};

export function StatCard({
  value,
  label,
  icon,
  color = "orange",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white flex flex-col items-center justify-center gap-1 p-8",
        className
      )}
    >
      {icon && (
        <div className={cn("w-8 h-8 flex items-center justify-center", colorMap[color])}>
          {icon}
        </div>
      )}
      <div
        className={cn(
          "font-display text-4xl leading-none",
          colorMap[color]
        )}
      >
        {value}
      </div>
      <div className="font-bold text-sm uppercase text-nb-black text-center">
        {label}
      </div>
    </div>
  );
}

interface StatStripProps {
  stats: Array<{ value: string | number; label: string; color?: StatCardProps["color"] }>;
  className?: string;
}

export function StatStrip({ stats, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid [background:var(--nb-black)] gap-[4px] [border-bottom:var(--nb-border)]",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
    >
      {stats.map((s, i) => (
        <StatCard key={i} value={s.value} label={s.label} color={s.color} />
      ))}
    </div>
  );
}
