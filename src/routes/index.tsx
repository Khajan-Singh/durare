import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Sparkles, Truck, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logoAsset from "@/assets/durare-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Durare - Predict surplus, rescue food" },
      { name: "description", content: "Forecast donatable grocery surplus and help food banks plan pickups before food is wasted." },
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
          <Button variant="ghost" className="rounded-full">Sign in</Button>
        </Link>
      </header>

      <section className="relative mx-auto max-w-4xl px-6 pt-12 pb-12 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-primary sm:text-6xl">
          See the surplus <span className="italic font-serif text-warning-foreground">before</span> it's discarded.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Durare forecasts donatable grocery surplus days in advance, so food-bank
          coordinators can plan pickups with confidence and rescue food that would
          otherwise be thrown away.
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
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-10">
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-primary/60 via-primary/10 to-transparent" />
          <img
            alt="Crates of fresh produce in warm morning light"
            className="h-72 w-full object-cover sm:h-96"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjtcsyno2EElynUaCpJN0pAqVXh_qlo3Rd7H_0bw3KXUVI_r4slCt6vQ97TCC_qyJMA1k_u6SrkqpI2ddJusCrGIYCeMBtdWe3LNiC8aXylQUWGdWbYN53eDVlmRObkB6_GPVMPQ7dEgZuvFXIWKSZ9LYRocJRvwLJJSyprAW0DW6rnCz3kGxBM4-qpxqijv2L6Tl2gdeYlqnX9q1ysE-bJWEAx4qzrLMPqH0FNBNVzI1HulelWZu5sHx2I_krj-jMsoH5XwqfM7A"
          />
        </div>
      </section>

      <section id="how" className="relative mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
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