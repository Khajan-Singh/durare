import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LogOut,
  Settings,
  LayoutDashboard,
  Truck,
  Boxes,
  PackageCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/durare-logo.png.asset.json";
import { SettingsDialog } from "@/components/settings-dialog";

export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: Profile | null;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isCoordinator = profile?.role === "coordinator";
  const [settingsOpen, setSettingsOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const links = isCoordinator
    ? [
        { to: "/coordinator", label: "Dashboard", icon: LayoutDashboard },
        { to: "/pickups", label: "Pickups", icon: Truck },
      ]
    : [
        { to: "/retailer", label: "Inventory", icon: Boxes },
        { to: "/deliveries", label: "Deliveries", icon: PackageCheck },
      ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 h-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={logoAsset.url}
                alt="Durare"
                className="h-9 w-9 rounded-xl object-cover"
              />
              <span className="text-xl font-bold tracking-tight text-primary">Durare</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {links.map(({ to, label }) => {
                const active = path === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "pb-1 text-sm font-semibold transition-colors",
                      active
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold leading-tight text-primary">
                  {profile.display_name ?? profile.email}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {profile.role}
                </div>
              </div>
            )}
            {profile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                aria-label="Account settings"
                className="rounded-full"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Sign out"
              className="rounded-full"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-8 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur md:hidden">
        {links.map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-xs transition",
                active
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      <footer className="mx-auto max-w-7xl px-4 pb-28 pt-8 text-center text-xs text-muted-foreground sm:px-8 md:pb-12 md:pt-12">
        © {new Date().getFullYear()} Durare. Foresight &amp; Stewardship.
      </footer>

      {profile && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          profile={profile}
        />
      )}
    </div>
  );
}