import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Building2,
  PieChart,
  BarChart3,
  ShieldCheck,
  PlusCircle,
  FlaskConical,
  Scale,
  TrendingUp,
  Landmark,
  LineChart,
  Briefcase,
  Boxes,
  Shield,
  Receipt,
  FileBarChart,
  ArrowLeftRight,
  Coins,
  Timer,
  ClipboardCheck,
  NotebookPen,
  Database,
  Settings,
  Globe2,
  Table2,
  CalendarClock,
  Target,
  SquarePen,
  Gauge,
  Compass,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useTotals, useExitLoads, useAlerts } from "@/hooks/use-book";
import { formatDate } from "@/lib/format";
import { useUnits } from "@/lib/units";

type Item = { title: string; url: string; icon: typeof LayoutDashboard };

const overview: Item[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Family Overview", url: "/family", icon: Users },
  { title: "Entities", url: "/entities", icon: Building2 },
  { title: "Asset Allocation", url: "/allocation", icon: PieChart },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Pivot", url: "/pivot", icon: Table2 },
  { title: "Benchmark", url: "/benchmark", icon: Target },
  { title: "Returns (XIRR)", url: "/returns", icon: Gauge },
  { title: "Strategy", url: "/strategy", icon: Compass },
  { title: "Rebalancing", url: "/rebalancing", icon: Scale },
  { title: "Simulator", url: "/simulator", icon: FlaskConical },
];

const products: Item[] = [
  { title: "Direct Equity", url: "/equity", icon: TrendingUp },
  { title: "Mutual Funds", url: "/mutual-funds", icon: LineChart },
  { title: "ETFs", url: "/etfs", icon: Boxes },
  { title: "Gold & Silver", url: "/bullion", icon: Coins },
  { title: "PMS", url: "/pms", icon: Briefcase },
  { title: "AIFs", url: "/aifs", icon: Landmark },
  { title: "ULIPs", url: "/ulips", icon: Shield },
  { title: "Bonds & Fixed Income", url: "/bonds-fds", icon: Receipt },
  { title: "International", url: "/international", icon: Globe2 },
];

const ops: Item[] = [
  { title: "Data Entry", url: "/data-entry", icon: SquarePen },
  { title: "Acquisitions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Add Transaction", url: "/add-transaction", icon: PlusCircle },
  { title: "Capital Gains", url: "/capital-gains", icon: Receipt },
  { title: "Exit Load Tracker", url: "/exit-load", icon: Timer },
  { title: "Liquidity Calendar", url: "/calendar", icon: CalendarClock },
  { title: "Advisor Meetings", url: "/meetings", icon: NotebookPen },
  { title: "Custodian Review", url: "/advisor-review", icon: ClipboardCheck },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Data Source", url: "/data-import", icon: Database },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Admin", url: "/admin", icon: ShieldCheck },
];

export function AppSidebar() {
  const { money } = useUnits();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { totals } = useTotals();
  const { summary: exitLoads } = useExitLoads();
  const { alerts } = useAlerts();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  // Counts that make a nav item worth clicking.
  const badges: Record<string, number> = {
    "/exit-load": exitLoads.locked.length,
    "/": alerts.length,
  };

  const renderGroup = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/50 px-3">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const badge = badges[item.url];
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                  className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
                >
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="text-[13px] font-medium">{item.title}</span>
                    {badge > 0 && (
                      <span className="ml-auto text-[10px] tabular font-semibold rounded px-1.5 py-0.5 bg-sidebar-primary/20 text-sidebar-primary group-data-[collapsible=icon]:hidden">
                        {badge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm tracking-tight shrink-0">
            SG
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[13px] font-semibold text-sidebar-foreground truncate">
              SG Family Wealth
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">
              Command Centre
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {renderGroup("Overview", overview)}
        <Separator className="bg-sidebar-border mx-3 my-1 w-auto" />
        {renderGroup("Products", products)}
        <Separator className="bg-sidebar-border mx-3 my-1 w-auto" />
        {renderGroup("Operations", ops)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {/* Was a fake "NSE/BSE live" pulse. This is the book's actual valuation date. */}
        <div className="flex flex-col gap-0.5 text-[10px] text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
          <span className="tabular font-medium text-sidebar-foreground/80">
            {money(totals.currentValue)}
          </span>
          <span className="tracking-wider uppercase">As on {formatDate(totals.asOnDate)}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
