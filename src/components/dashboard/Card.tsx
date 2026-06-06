import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  title, subtitle, right, children, className,
}: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface shadow-elegant", className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
          <div>
            {title && <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>}
            {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
