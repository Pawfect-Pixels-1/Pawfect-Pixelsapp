import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Coins, Clock, Zap, Crown, Settings } from "lucide-react";
import type { UsageInfo, PlanConfig } from "@/lib/stores/useBilling";
import { useBilling } from "@/lib/stores/useBilling";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface UsageWidgetProps {
  usage: UsageInfo;
  currentPlan?: PlanConfig | null;
  onUpgrade: () => void;
  onBuyCredits: () => void;
  /** Optional smaller visual density */
  compact?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────────────────────
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const fmtInt = (n: number | null | undefined) => (Number.isFinite(n as number) ? Math.trunc(n as number) : 0);

function planDisplayName(plan: string | undefined) {
  switch (plan) {
    case "trial":
      return "Free Trial";
    case "basic":
      return "Basic Plan";
    case "advanced":
      return "Advanced Plan";
    case "premium":
      return "Premium Plan";
    default:
      return plan ?? "Unknown";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function UsageWidget({
  usage,
  currentPlan,
  onUpgrade,
  onBuyCredits,
  compact = false,
  className = "",
}: UsageWidgetProps) {
  const { openCustomerPortal, isOpeningPortal } = useBilling();

  const isTrial = usage?.plan === "trial";
  const dailyLimit = useMemo(() => {
    const limit = currentPlan?.daily_credits ?? (isTrial ? 10 : 0);
    return Math.max(0, limit);
  }, [currentPlan?.daily_credits, isTrial]);

  const dailyCreditsRemaining = fmtInt(usage?.dailyCreditsRemaining);
  const creditsBalance = fmtInt(usage?.creditsBalance);
  const includedCredits = fmtInt(currentPlan?.included_credits);
  const includedCreditsRemaining = fmtInt(usage?.includedCreditsThisCycle);

  const lowCredits = creditsBalance < 10;
  const lowDaily = isTrial && dailyLimit > 0 && dailyCreditsRemaining < Math.ceil(dailyLimit * 0.2);

  const trialDaysLeft = useMemo(() => {
    if (!isTrial || !usage?.trialEndsAt) return 0;
    const ms = new Date(usage.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [isTrial, usage?.trialEndsAt]);

  const dailyProgress = useMemo(() => {
    if (!isTrial || dailyLimit <= 0) return 0;
    const used = Math.max(0, dailyLimit - dailyCreditsRemaining);
    return clamp((used / dailyLimit) * 100);
  }, [isTrial, dailyLimit, dailyCreditsRemaining]);

  const monthlyUsed = useMemo(() => {
    if (isTrial || !includedCredits) return null;
    // includedCreditsRemaining is remaining included credits this cycle
    const used = Math.max(0, includedCredits - includedCreditsRemaining);
    return {
      used,
      total: includedCredits,
      pct: clamp((used / Math.max(1, includedCredits)) * 100),
    } as const;
  }, [isTrial, includedCredits, includedCreditsRemaining]);

  return (
    <Card
      className={[
        "border-2 border-black shadow-[4px_4px_0_#000]",
        compact ? "p-2" : "",
        className,
      ].join(" ")}
      aria-label="Usage and plan overview"
    >
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Crown className="w-5 h-5" aria-hidden />
            {planDisplayName(usage?.plan)}
          </CardTitle>
          {usage?.isPriorityQueue && (
            <Badge
              className="bg-yellow-100 text-yellow-800 border border-yellow-300"
              aria-label="Priority processing enabled"
            >
              <Zap className="w-3 h-3 mr-1" aria-hidden />
              Priority
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credits Balance */}
        <section className="space-y-2" aria-labelledby="credits-balance-h">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-600" aria-hidden />
              <span id="credits-balance-h" className="font-semibold">Credits Balance</span>
            </div>
            <span className={`font-bold ${lowCredits ? "text-red-600" : "text-green-700"}`}>
              {creditsBalance}
            </span>
          </div>
          {lowCredits && (
            <p className="text-xs text-red-600 font-medium">⚠️ Running low on credits</p>
          )}
        </section>

        {/* Daily Credits (Trial) */}
        {isTrial && (
          <section className="space-y-2" aria-labelledby="daily-credits-h">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" aria-hidden />
                <span id="daily-credits-h" className="font-semibold">Daily Credits</span>
              </div>
              <span className={`font-bold ${lowDaily ? "text-red-600" : "text-green-700"}`}>
                {dailyCreditsRemaining}/{dailyLimit}
              </span>
            </div>
            <Progress value={dailyProgress} className="h-2" />
            {lowDaily && (
              <p className="text-xs text-red-600 font-medium">⚠️ Daily limit almost reached</p>
            )}
          </section>
        )}

        {/* Trial Info */}
        {isTrial && usage?.trialEndsAt && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200" aria-live="polite">
            <div className="text-sm font-semibold text-blue-800">🎁 Free Trial</div>
            <div className="text-xs text-blue-700">
              {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining` : "Trial expired"}
            </div>
          </div>
        )}

        {/* Monthly credits (Paid plans) */}
        {!isTrial && monthlyUsed && (
          <section className="space-y-1" aria-labelledby="monthly-credits-h">
            <div id="monthly-credits-h" className="text-xs text-gray-700">
              💰 {monthlyUsed.used}/{monthlyUsed.total} monthly credits used
            </div>
            <Progress value={monthlyUsed.pct} className="h-2" />
          </section>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {(isTrial || lowCredits) && (
            <Button
              onClick={onUpgrade}
              className="w-full bg-[#c6c2e6] text-black font-semibold border-2 border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              aria-label="Upgrade plan"
            >
              {isTrial ? "✨ Upgrade Plan" : "📈 Upgrade Plan"}
            </Button>
          )}

          <Button
            onClick={onBuyCredits}
            variant="outline"
            className="w-full border-2 border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            aria-label="Buy additional credits"
          >
            🪙 Buy Credits
          </Button>

          {/* Manage Subscription (paid only) */}
          {!isTrial && (
            <Button
              onClick={openCustomerPortal}
              disabled={isOpeningPortal}
              variant="outline"
              className="w-full border-2 border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              aria-label="Open customer portal"
            >
              {isOpeningPortal ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                  Opening...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" aria-hidden />
                  Manage Subscription
                </span>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default UsageWidget;
