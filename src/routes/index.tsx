import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Leaf, ArrowRight, ShieldCheck, BarChart3, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Durare — Predict surplus, rescue food" },
      { name: "description", content: "Forecast donatable grocery surplus and help food banks plan pickups before food is wasted." },
      { property: "og:title", content: "Durare — Predict surplus, rescue food" },
      { property: "og:description", content: "AI forecasts. Human decisions. Less waste." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      navigate({ to: profile.role === "retailer" ? "/retailer" : "/coordinator" });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-semibold leading-none">Durare</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Forecast → Rescue
            </div>
          </div>
        </div>
        <Link to="/auth">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          AI forecasts. Human decisions.
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          See the surplus <span className="text-primary">before it's discarded.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
          Durare forecasts donatable grocery surplus days in advance so food-bank
          coordinators can plan pickups with confidence — and rescue food that would
          otherwise be thrown away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-3">
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Forecast, not guesswork"
          body="Every prediction comes with a confidence range so you know how much to trust the number."
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Explainable AI"
          body="See the model's drivers in plain language. The reasoning is never a black box."
        />
        <Feature
          icon={<Truck className="h-5 w-5" />}
          title="Human in the loop"
          body="Durare recommends. You confirm food safety, capacity, and dispatch."
        />
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
