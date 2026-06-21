import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Sparkles,
  Truck,
  Gauge,
  ClipboardList,
  Brain,
  CheckCircle2,
  Store,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logoAsset from "@/assets/durare-logo.png.asset.json";
import heroProduce from "@/assets/hero-produce.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Durare - Predict surplus, rescue food" },
      {
        name: "description",
        content: "Forecast donatable grocery surplus and help food banks plan pickups before food is wasted.",
      },
      { property: "og:title", content: "Durare - Predict surplus, rescue food" },
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
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 opacity-50">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary-soft blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-warning/40 blur-[120px]" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <img src={logoAsset.url} alt="Durare" className="h-9 w-9 rounded-xl object-cover" />
          <div>
            <div className="text-base font-bold leading-none text-primary">Durare</div>
          </div>
        </div>
        <Link to="/auth">
          <Button variant="ghost" className="rounded-full">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pt-12 pb-12 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-primary sm:text-6xl">
          See the surplus <span className="italic font-serif text-warning-foreground">before</span> it's discarded.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Durare forecasts donatable grocery surplus days in advance, so food-bank coordinators can plan pickups with
          confidence and rescue food that would otherwise be thrown away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="gap-2 rounded-xl">
              Get started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="outline" className="rounded-xl">
              How it works
            </Button>
          </a>
        </div>

        <p className="mx-auto mt-8 max-w-4xl rounded-2xl border border-success/30 bg-success/10 px-5 py-3 text-lg italic font-serif text-foreground">
          Wasted food is one of the biggest sources of landfill methane. Every <strong>~1.2 lbs rescued is one meal</strong>, and keeping
          organic food out of a landfill avoids roughly <strong>half a ton of CO₂ per ton</strong>. A single week's surplus at one
          store can provide [X] meals and [Y] kg of avoided emissions.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
            <Store className="h-3.5 w-3.5" /> For retailers
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
            <HeartHandshake className="h-3.5 w-3.5" /> For food banks
          </span>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-10">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent" />
          <img
            alt="Volunteers sorting fresh produce at a food bank"
            className="h-72 w-full object-cover sm:h-96"
            src={heroProduce.url}
          />
        </div>
      </section>

      <section id="how" className="relative mx-auto max-w-5xl px-6 pb-16">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How it works</div>
          <h2 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">From shelf to rescue, in three steps</h2>
        </div>
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Step
            n="1"
            kind="Input"
            icon={<ClipboardList className="h-5 w-5" />}
            title="Retailers log inventory"
            body="Stores record what's on hand and when it expires — the raw signal of upcoming surplus."
          />
          <Step
            n="2"
            kind="AI"
            icon={<Brain className="h-5 w-5" />}
            title="Durare forecasts surplus"
            body="An XGBoost model predicts donatable units days ahead, with a confidence range and plain-language drivers."
          />
          <Step
            n="3"
            kind="Action"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Coordinators confirm pickups"
            body="Food-bank coordinators triage forecasts, plan routes, and confirm rescues before food is wasted."
          />
        </div>
      </section>

      <section className="relative mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
        <Feature
          icon={<Gauge className="h-5 w-5" />}
          title="Forecast, not guesswork"
          body="Every prediction ships with a confidence range so you know how far to trust the number."
        />
        <Feature
          icon={<Sparkles className="h-5 w-5" />}
          title="Explainable AI"
          body="See the model's drivers in plain language. The reasoning is never a black box."
        />
        <Feature
          icon={<Truck className="h-5 w-5" />}
          title="Human in the loop"
          body="Durare recommends. You confirm food safety, capacity, and dispatch."
        />
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-12 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Durare. Foresight &amp; Stewardship.
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card-elevated p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        {icon}
      </div>
      <div className="font-bold text-primary">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({
  n,
  kind,
  icon,
  title,
  body,
}: {
  n: string;
  kind: "Input" | "AI" | "Action";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card-elevated relative p-5">
      <div className="flex items-center justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {n} · {kind}
        </span>
      </div>
      <div className="mt-4 font-bold text-primary">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
