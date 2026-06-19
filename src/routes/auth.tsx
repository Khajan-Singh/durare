import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchFoodBanks, fetchStores, type FoodBank, type Store } from "@/lib/data";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Durare" },
      { name: "description", content: "Sign in or create a Durare account." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(["retailer", "coordinator"]),
  store_id: z.string().uuid().optional().nullable(),
  food_bank_id: z.string().uuid().optional().nullable(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [stores, setStores] = useState<Store[]>([]);
  const [foodBanks, setFoodBanks] = useState<FoodBank[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"retailer" | "coordinator">("coordinator");
  const [storeId, setStoreId] = useState<string>("");
  const [foodBankId, setFoodBankId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => {});
    fetchFoodBanks().then(setFoodBanks).catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      navigate({ to: profile.role === "retailer" ? "/retailer" : "/coordinator" });
    }
  }, [user, profile, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const parsed = signupSchema.safeParse({
          email,
          password,
          displayName,
          role,
          store_id: role === "retailer" ? storeId || null : null,
          food_bank_id: role === "coordinator" ? foodBankId || null : null,
        });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
        }
        if (role === "retailer" && !storeId) throw new Error("Pick a store");
        if (role === "coordinator" && !foodBankId) throw new Error("Pick a food bank");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        const uid = data.user?.id;
        if (uid) {
          const { error: pErr } = await supabase.from("profiles").insert({
            id: uid,
            email,
            display_name: displayName,
            role,
            store_id: role === "retailer" ? storeId : null,
            food_bank_id: role === "coordinator" ? foodBankId : null,
          });
          if (pErr) throw pErr;
        }
        toast.success("Account created");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="h-4 w-4" />
          </div>
          <div className="text-base font-semibold">Durare</div>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Welcome back. Sign in to coordinate today's pickups."
              : "Tell us where you work so we can route you to the right dashboard."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label>I am a…</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as "retailer" | "coordinator")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coordinator">Food-bank coordinator</SelectItem>
                      <SelectItem value="retailer">Grocery retailer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {role === "retailer" ? (
                  <div className="space-y-1.5">
                    <Label>Your store</Label>
                    <Select value={storeId} onValueChange={setStoreId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a store" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Your food bank</Label>
                    <Select value={foodBankId} onValueChange={setFoodBankId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a food bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {foodBanks.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to Durare?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}