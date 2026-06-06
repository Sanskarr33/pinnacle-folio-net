import { Card } from "./Card";
import { actionItems } from "@/lib/dummy-data";
import { CheckCircle2, Clock } from "lucide-react";

export function ActionRequired() {
  return (
    <Card
      title="Action required"
      subtitle="Upcoming approvals, capital calls & calendar items"
      right={<button className="text-[11.5px] text-muted-foreground hover:text-foreground font-medium">Calendar →</button>}
    >
      <ul className="space-y-1.5">
        {actionItems.map((a, i) => (
          <li key={i} className="group flex items-center gap-3 p-2.5 -mx-1 rounded-lg hover:bg-secondary/60 transition-colors cursor-pointer">
            <div className="h-9 w-12 shrink-0 rounded-md bg-navy text-navy-foreground flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase tracking-wider opacity-70 leading-none">{a.due.split(" ")[1]}</span>
              <span className="text-[14px] font-semibold tabular leading-none mt-0.5">{a.due.split(" ")[0]}</span>
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
        ))}
      </ul>
    </Card>
  );
}
