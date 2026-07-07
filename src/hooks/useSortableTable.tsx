import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

function getValue(obj: unknown, key: string): unknown {
  if (key === "display_name") {
    const o = obj as Record<string, unknown>;
    return (o.security_name as string) || (o.scheme_name as string) || "";
  }
  return (obj as Record<string, unknown>)[key];
}

export function useSortableTable<T>(
  data: T[],
  defaultKey = "current_value",
  defaultDir: "asc" | "desc" = "desc",
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultKey,
    direction: defaultDir,
  });

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = getValue(a, sortConfig.key);
      const bv = getValue(b, sortConfig.key);
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  return { sorted, sortConfig, handleSort };
}

export function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = sortConfig.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn("cursor-pointer select-none group", className)}
    >
      <span className="inline-flex items-center gap-1 group-hover:text-foreground transition-colors">
        {label}
        <span
          className={cn(
            "text-[9px] transition-opacity",
            isActive ? "opacity-70" : "opacity-0 group-hover:opacity-50",
          )}
        >
          {isActive ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}
