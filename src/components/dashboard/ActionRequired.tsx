import { Card } from "./Card";
import { useQuery } from "@tanstack/react-query";
import { getActionItems } from "@/lib/data-service";
import { actionItems as fallback } from "@/lib/dummy-data";
import { CheckCircle2, Clock } from "lucide-react";

function parseDueDate(due: string): Date {
  const [day, mon] = due.split(" ");
  return new Date(`${mon} ${day} 2026`);
}

function urgencyClass(due: string): { badge: string; border: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseDueDate(due);
  const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0)  return { badge: "bg-destructive text-destructive-foreground",   border: "" };
  if (diffDays <= 3) return { badge: "bg-warning text-warning-foreground",            border: "" };
  return               { badge: "bg-navy text-navy-foreground",                       border: "" };
}

export function ActionRequired() {
  const { data: items = fallback } = useQuery({
    queryKey: ["actionItems"],
    queryFn: getActionItems,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card
      title="Action required"
      subtitle="Upcoming approvals, capital calls & calendar items"
      right={<button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">Calendar →</button>}
    >
      <ul className="space-y-1.5">
        {items.map((a, i) => {
          const { badge } = urgencyClass(a.due);
          const [day, mon] = a.due.split(" ");
          return (
            <li key={i} className="group flex items-center gap-3 p-2.5 -mx-1 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer">
              <div className={`h-9 w-12 shrink-0 rounded-md ${badge} flex flex-col items-center justify-center`}>
                <span className="text-[9px] uppercase tracking-wider opacity-80 leading-none">{mon}</span>
                <span className="text-[14px] font-semibold tabular leading-none mt-0.5">{day}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-foreground truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Owner · {a.owner}
                </p>
              </div>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
