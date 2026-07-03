import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, PieChart, TrendingUp, Landmark,
  LineChart, Briefcase, Boxes, Shield, Receipt, FileBarChart,
  ArrowLeftRight, Coins, Timer, ClipboardCheck, Upload, Settings, Globe2, BarChart2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const overview = [
  { title: "Dashboard",        url: "/",           icon: LayoutDashboard },
  { title: "Analytics",        url: "/analytics",  icon: BarChart2       },
  { title: "Family Overview",  url: "/family",     icon: Users           },
  { title: "Entities",         url: "/entities",   icon: Building2       },
  { title: "Asset Allocation", url: "/allocation", icon: PieChart        },
];

const products = [
  { title: "Direct Equity",  url: "/equity",       icon: TrendingUp },
  { title: "Mutual Funds",   url: "/mutual-funds", icon: LineChart  },
  { title: "ETFs",           url: "/etfs",         icon: Boxes      },
  { title: "PMS",            url: "/pms",          icon: Briefcase  },
  { title: "AIFs",           url: "/aifs",         icon: Landmark   },
  { title: "ULIPs",          url: "/ulips",        icon: Shield     },
  { title: "Bonds & FDs",    url: "/bonds-fds",    icon: Coins      },
  { title: "International",  url: "/international",icon: Globe2     },
];

const ops = [
  { title: "Transactions",       url: "/transactions",   icon: ArrowLeftRight },
  { title: "Capital Gains",      url: "/capital-gains",  icon: Receipt        },
  { title: "Exit Load Tracker",  url: "/exit-load",      icon: Timer          },
  { title: "Advisor Review",     url: "/advisor-review", icon: ClipboardCheck },
  { title: "Reports",            url: "/reports",        icon: FileBarChart   },
  { title: "Data Import",        url: "/data-import",    icon: Upload         },
  { title: "Settings",           url: "/settings",       icon: Settings       },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));
  const { user } = useAuth();

  const renderGroup = (label: string, items: typeof overview) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/50 px-3">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
              >
                <Link to={item.url}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="text-[13px] font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
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
            <span className="text-[13px] font-semibold text-sidebar-foreground truncate">SG Family Wealth</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Command Centre</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {renderGroup("Overview", overview)}
        <Separator className="bg-sidebar-border mx-3 my-1 w-auto" />
        {renderGroup("Products", products)}
        <Separator className="bg-sidebar-border mx-3 my-1 w-auto" />
        {renderGroup("Operations", [
          ...ops,
          ...(user?.role === "admin"
            ? [{ title: "Admin", url: "/admin", icon: ShieldCheck }]
            : []),
        ])}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 text-[10px] text-sidebar-foreground/55 tracking-wider uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse shrink-0" />
          <span className="truncate">NSE/BSE live · {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })} IST</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
