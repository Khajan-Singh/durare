import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Leaf, Store as StoreIcon, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createFoodBank, createStore } from "@/lib/data";
import { LocationPicker, type PickedLocation } from "@/components/location-picker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Durare" },
      { name: "description", content: "Sign in or create a Durare account." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "role" | "signup";

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(["retailer", "coordinator"]),
  orgName: z.string().trim().min(1).max(120),
});

async function reverseGeocodeState(lat: number, lng: number): Promise<string | null> {
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      results?: Array<{ address_components?: Array<{ short_name: string; types: string[] }> }>;
    };
    for (const result of body.results ?? []) {
      for (const comp of result.address_components ?? []) {
        if (comp.types.includes("administrative_area_level_1")) return comp.short_name;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"retailer" | "coordinator">("coordinator");
  const [orgName, setOrgName] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      navigate({ to: profile.role === "retailer" ? "/retailer" : "/coordinator" });
    }
  }, [user, profile, loading, navigate]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsed = signupSchema.safeParse({
        email,
        password,
        displayName,
        role,
        orgName,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      if (!location) throw new Error("Pick a location from the map");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Signup did not return a user");

      let newStoreId: string | null = null;
      let newFoodBankId: string | null = null;
      const stateCode = await reverseGeocodeState(location.lat, location.lng);
      if (role === "retailer") {
        const s = await createStore({
          name: orgName,
          lat: location.lat,
          lng: location.lng,
          state: stateCode,
        });
        newStoreId = s.id;
      } else {
        const f = await createFoodBank({
          name: orgName,
          lat: location.lat,
          lng: location.lng,
        });
        newFoodBankId = f.id;
      }

      const { error: pErr } = await supabase.from("profiles").insert({
        id: uid,
        email,
        display_name: displayName,
        role,
        store_id: newStoreId,
        food_bank_id: newFoodBankId,
      });
      if (pErr) throw pErr;
      toast.success("Account created");
      navigate({ to: role === "retailer" ? "/retailer" : "/coordinator" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none fixed inset-0 opacity-40">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary-soft blur-[100px]" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-warning/40 blur-[100px]" />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <Link to="/" className="mb-4 inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-primary">Durare</span>
          </Link>
          <p className="px-6 text-sm text-muted-foreground">
            Forecasting food rescue to eliminate waste before it happens.
          </p>
        </div>

        <div className="card-elevated p-6 md:p-8">
          {mode === "signin" && (
            <section>
              <h1 className="text-2xl font-extrabold text-primary">Welcome back</h1>
              <form onSubmit={onSignIn} className="mt-6 space-y-4">
                <Field label="Email Address">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    placeholder="name@organization.com"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    placeholder="••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Button type="submit" disabled={submitting} className="h-12 w-full rounded-lg text-base font-bold">
                  {submitting ? "Please wait…" : "Sign In"}
                </Button>
              </form>
              <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
                New to food rescue?{" "}
                <button
                  type="button"
                  className="ml-1 font-bold text-primary hover:underline"
                  onClick={() => setMode("role")}
                >
                  Create an account
                </button>
              </div>
            </section>
          )}

          {mode === "role" && (
            <section>
              <div className="mb-6 flex items-center">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="mr-2 rounded-full p-2 text-muted-foreground transition hover:bg-secondary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-extrabold text-primary">Join Durare</h1>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">
                Choose your role to get started with forecasting.
              </p>
              <div className="space-y-3">
                <RoleCard
                  icon={<StoreIcon className="h-5 w-5" />}
                  iconBg="bg-primary-soft text-primary-soft-foreground"
                  title="I am a Retailer"
                  body="I have surplus food and want to supply it for rescue."
                  onClick={() => {
                    setRole("retailer");
                    setMode("signup");
                  }}
                />
                <RoleCard
                  icon={<RouteIcon className="h-5 w-5" />}
                  iconBg="bg-warning/30 text-warning-foreground"
                  title="I am a Coordinator"
                  body="I plan rescues and need foresight to manage logistics."
                  onClick={() => {
                    setRole("coordinator");
                    setMode("signup");
                  }}
                />
              </div>
              <div className="mt-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="ml-1 font-bold text-primary hover:underline"
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </div>
            </section>
          )}

          {mode === "signup" && (
            <section>
              <div className="mb-6 flex items-center">
                <button
                  type="button"
                  onClick={() => setMode("role")}
                  className="mr-2 rounded-full p-2 text-muted-foreground transition hover:bg-secondary"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-extrabold text-primary">
                  {role === "retailer" ? "Retailer signup" : "Coordinator signup"}
                </h1>
              </div>
              <form onSubmit={onSignUp} className="space-y-4">
                <Field label="Your name">
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Field label={role === "retailer" ? "Store name" : "Food bank name"}>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder={
                      role === "retailer"
                        ? "e.g. Whole Foods – Mission St"
                        : "e.g. SF-Marin Food Bank"
                    }
                    required
                    className="h-12 rounded-lg"
                  />
                </Field>
                <Field label={role === "retailer" ? "Store location" : "Food bank location"}>
                  <LocationPicker
                    value={location}
                    onChange={(loc) => {
                      setLocation(loc);
                      if (loc && !orgName) setOrgName(loc.name);
                    }}
                    placeholder="Search address or place name…"
                  />
                </Field>
                <Button type="submit" disabled={submitting} className="h-12 w-full rounded-lg text-base font-bold">
                  {submitting ? "Creating…" : "Create account"}
                </Button>
              </form>
            </section>
          )}
        </div>


        <footer className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Durare Rescue Systems. Foresight &amp; Stewardship.
        </footer>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RoleCard({
  icon,
  iconBg,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-xl border border-border p-5 text-left transition active:scale-[0.98] hover:border-primary hover:bg-primary-soft/30"
    >
      <div className="flex items-start gap-4">
        <div className={cn("rounded-lg p-3 transition-transform group-hover:scale-110", iconBg)}>
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-primary">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </button>
  );
}