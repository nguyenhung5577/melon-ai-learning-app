import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("section-header", className)}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="section-title">{title}</h2>
          {badge && badge}
        </div>
        {subtitle && (
          <p className="text-sm font-semibold text-[#555]">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface SectionContainerProps {
  children: React.ReactNode;
  className?: string;
  background?: "default" | "black" | "purple" | "yellow";
}

export function SectionContainer({
  children,
  className,
  background = "default",
}: SectionContainerProps) {
  const bgMap = {
    default: "bg-nb-bg",
    black: "bg-nb-black",
    purple: "bg-nb-purple",
    yellow: "bg-nb-yellow",
  };

  return (
    <section
      className={cn(
        "px-6 py-10",
        "[border-bottom:var(--nb-border)]",
        bgMap[background],
        className
      )}
    >
      {children}
    </section>
  );
}
