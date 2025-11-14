import { useMemo, useState } from "react";
import { Check, Lock, Sparkles, Zap } from "lucide-react";
import { useAuth, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuery } from "convex/react";
import { api } from "@backend/convex";
import { PLAN_CONFIG } from "@backend/convex/convex/utils/constants/plans";
import { getRevenueCatEnvironmentLabel, getRevenueCatPaywallUrl } from "@/utils/revenueCatPaywall";

type BillingCycle = "weekly" | "monthly" | "yearly";

const BILLING_OPTIONS: Array<{ key: BillingCycle; label: string; helper: string }> = [
  { key: "weekly", label: "Weekly", helper: "Quick boost" },
  { key: "monthly", label: "Monthly", helper: "Most flexible" },
  { key: "yearly", label: "Yearly", helper: "2 months free" },
] as const;

const CREDIT_STATS = [
  { value: "5", label: "Free credits" },
  { value: "20", label: "Weekly credits" },
  { value: "90", label: "Monthly credits" },
  { value: "1,200", label: "Yearly credits" },
];

const FREE_BENEFITS = [
  "Limited journal entries to get started",
  "5 generation credits every month",
  "Basic music generation",
  "Access to core features",
];

const PREMIUM_BENEFITS = [
  "20 credits every week to keep the ideas flowing",
  "90 credits every month for bigger creative drops",
  "1,200 credits per year for long-haul storytelling",
  "Faster generation queue so songs land sooner",
  "Quick support response when you need a hand",
];

const MEMORY_COLLECTOR_PERKS = [
  "Auto-save every sonic memory",
  "Recall past moods & motifs instantly",
  "Coming soon—get notified when it drops",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  weekly: "/week",
  monthly: "/month",
  yearly: "/year",
};

const CYCLE_SUBTEXT: Record<BillingCycle, string> = {
  weekly: "Billed weekly. Cancel anytime.",
  monthly: "Billed monthly. Cancel anytime.",
  yearly: `Billed yearly. Works out to ${currencyFormatter.format(
    PLAN_CONFIG.yearly.price / 12,
  )}/month.`,
};

export default function Pricing() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const profile = useQuery(api.users.getUserProfile);
  const backendUserId = profile?.user._id;

  const selectedPlan = PLAN_CONFIG[billingCycle];

  const priceLabel = useMemo(() => currencyFormatter.format(selectedPlan.price), [selectedPlan.price]);

  const handleUpgradeClick = () => {
    if (!isLoaded) {
      toast.error("Hold on a sec—loading your account.");
      return;
    }

    if (!isSignedIn) {
      navigate("/sign-in?redirect=/pricing");
      return;
    }

    if (profile === undefined) {
      toast.error("Still loading your eveokee profile. Try again in a moment.");
      return;
    }

    if (!profile || !backendUserId) {
      toast.error("We couldn't find your eveokee account. Please refresh or contact support.");
      return;
    }

    const url = getRevenueCatPaywallUrl(backendUserId, billingCycle);
    if (!url) {
      toast.error("Unable to open checkout right now. Please try again.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ctaLabel = isSignedIn ? "Upgrade now" : "Sign in to upgrade";
  
  // Check if user is on free tier
  const isFreeTier = profile?.subscription?.tier === "free" || !profile?.subscription;
  const freePriceLabel = currencyFormatter.format(PLAN_CONFIG.free.price);
  
  // Check if user has an active subscription matching the selected billing cycle
  const hasActiveSubscription = profile?.subscription?.isActive === true;
  const currentTierMatches = profile?.subscription?.tier === billingCycle;
  const isCurrentPlan = hasActiveSubscription && currentTierMatches;

  return (
    <div className="bg-gradient-to-b from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-900/95 dark:to-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-mint/10 text-accent-mint text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            Get 2 months free on yearly plans
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">Choose your creative fuel</h1>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {BILLING_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setBillingCycle(option.key)}
              className={`px-4 sm:px-6 py-2 rounded-full border text-sm font-medium transition-colors ${
                billingCycle === option.key
                  ? "bg-accent-mint text-white border-accent-mint shadow-lg shadow-accent-mint/40"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-accent-mint/60"
              }`}
            >
              <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-2">
                <span>{option.label}</span>
                <span className="text-xs opacity-70">{option.helper}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {/* Free Tier */}
          <div className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase tracking-wide">
                Free
              </span>
              {isFreeTier && (
                <span className="px-3 py-1 rounded-full bg-accent-mint/10 text-accent-mint text-xs font-semibold">
                  Current plan
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">{freePriceLabel}</span>
              <span className="text-gray-500 dark:text-gray-400">/month</span>
            </div>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Perfect for getting started</p>

            <ul className="mt-8 space-y-4">
              {FREE_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-sm sm:text-base text-gray-700 dark:text-gray-200">{benefit}</span>
                </li>
              ))}
            </ul>

            {isFreeTier ? (
              <button
                disabled
                className="mt-10 w-full rounded-xl bg-gray-200 dark:bg-gray-800 py-3 text-base font-semibold text-gray-500 dark:text-gray-400 cursor-not-allowed"
              >
                Current plan
              </button>
            ) : (
              <>
                <SignedIn>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="mt-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 py-3 text-base font-semibold hover:border-accent-mint/60 transition-colors"
                  >
                    Get started
                  </button>
                </SignedIn>
                <SignedOut>
                  <button
                    onClick={() => navigate("/sign-up")}
                    className="mt-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 py-3 text-base font-semibold hover:border-accent-mint/60 transition-colors"
                  >
                    Get started
                  </button>
                </SignedOut>
              </>
            )}
          </div>

          {/* Premium Tier */}
          <div className="relative overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl shadow-accent-mint/10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-mint via-accent-mint/60 to-accent-mint"></div>
            <div className="p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-accent-mint/10 text-accent-mint text-xs font-semibold uppercase tracking-wide">
                  Premium
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">Most popular</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight text-gray-900 dark:text-white">{priceLabel}</span>
                <span className="text-gray-500 dark:text-gray-400">{CYCLE_SUFFIX[billingCycle]}</span>
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{CYCLE_SUBTEXT[billingCycle]}</p>

              <ul className="mt-8 space-y-4">
                {PREMIUM_BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent-mint/15 text-accent-mint">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-200">{benefit}</span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <button
                  disabled
                  className="mt-10 w-full inline-flex justify-center items-center gap-2 rounded-xl bg-accent-mint text-white py-3 text-base font-semibold shadow-lg shadow-accent-mint/40 opacity-60 cursor-not-allowed"
                >
                  <Zap className="w-5 h-5" />
                  Your current plan
                </button>
              ) : (
                <button
                  onClick={handleUpgradeClick}
                  disabled={profile === undefined}
                  className="mt-10 w-full inline-flex justify-center items-center gap-2 rounded-xl bg-accent-mint text-white py-3 text-base font-semibold shadow-lg shadow-accent-mint/40 hover:bg-accent-mint/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-accent-mint"
                >
                  <Zap className="w-5 h-5" />
                  {ctaLabel}
                </button>
              )}

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                {getRevenueCatEnvironmentLabel()}
              </p>
            </div>
          </div>

          {/* Memory Collector Tier */}
          <div className="rounded-3xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(82,199,160,0.08),_transparent_55%)] pointer-events-none" />
            <div className="relative">
              <span className="px-3 py-1 rounded-full bg-gray-200/70 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase tracking-wide">
                Memory Collector
              </span>
              <h2 className="mt-4 text-2xl font-semibold">Coming soon</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                A vault for your deepest sonic journals with AI recall and long-term context.
              </p>

              <ul className="mt-8 space-y-3">
                {MEMORY_COLLECTOR_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-3 text-gray-600 dark:text-gray-300">
                    <Sparkles className="w-5 h-5 text-accent-mint shrink-0" />
                    <span className="text-sm">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center shadow-sm"
            >
              <p className="text-3xl font-semibold text-accent-mint">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold">Need to see the product first?</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Watch the live demo, then hop back to this page anytime. Checkout stays public.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="/#demo"
              className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:border-accent-mint/60 transition-colors"
            >
              Watch demo
            </a>
            <SignedOut>
              <button
                onClick={() => navigate("/sign-in")}
                className="px-5 py-3 rounded-xl bg-accent-mint text-white text-sm font-semibold hover:bg-accent-mint/90 transition-colors"
              >
                Log in
              </button>
            </SignedOut>
            <SignedIn>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-5 py-3 rounded-xl bg-accent-mint text-white text-sm font-semibold hover:bg-accent-mint/90 transition-colors"
              >
                Go to Dashboard
              </button>
            </SignedIn>
          </div>
        </div>
      </div>
    </div>
  );
}

