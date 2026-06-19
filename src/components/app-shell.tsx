import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Leaf, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  profile,
}: {
  children: ReactNode;
  profile: Profile | null;
}) {
  const navigate = useNavigate();
  const isCoordinator = profile?.role === "coordinator";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-semibold leading-none">Durare</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Forecast → Rescue
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {isCoordinator && (
              <>
                <NavLink to="/coordinator">Forecast</NavLink>
                <NavLink to="/pickups">Pickups</NavLink>
              </>
            )}
            {profile?.role === "retailer" && <NavLink to="/retailer">Inventory</NavLink>}
          </nav>

          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium leading-tight">
                  {profile.display_name ?? profile.email}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {profile.role}
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-full px-3 py-1.5 text-muted-foreground transition hover:text-foreground",
      )}
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {children}
    </Link>
  );
}