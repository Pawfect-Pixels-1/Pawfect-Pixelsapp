import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Coins, Clock, Zap, Crown } from 'lucide-react';
import type { UsageInfo } from '@/lib/stores/useBilling';

interface UsageWidgetProps {
  usage: UsageInfo;
  onUpgrade: () => void;
  onBuyCredits: () => void;
}

export function UsageWidget({ usage, onUpgrade, onBuyCredits }: UsageWidgetProps) {
  const isTrialUser = usage.plan === 'trial';
  const isLowCredits = usage.creditsBalance < 10;
  const isLowDailyCredits = usage.dailyCreditsRemaining < 5;
  
  const trialDaysLeft = usage.trialEndsAt ? 
    Math.max(0, Math.ceil((new Date(usage.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  const getDailyProgress = () => {
    if (usage.plan === 'trial') {
      const trialLimit = 10; // From billing config
      return ((trialLimit - usage.dailyCreditsRemaining) / trialLimit) * 100;
    }
    // For paid plans, we don't have a fixed daily limit in the UI
    return 0;
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'trial': return 'Free Trial';
      case 'basic': return 'Basic Plan';
      case 'advanced': return 'Advanced Plan';
      case 'premium': return 'Premium Plan';
      default: return plan;
    }
  };

  return (
    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Crown className="w-5 h-5" />
            {getPlanDisplayName(usage.plan)}
          </CardTitle>
          {usage.isPriorityQueue && (
            <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">
              <Zap className="w-3 h-3 mr-1" />
              Priority
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Credits Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-600" />
              <span className="font-semibold">Credits Balance</span>
            </div>
            <span className={`font-bold ${isLowCredits ? 'text-red-600' : 'text-green-600'}`}>
              {usage.creditsBalance}
            </span>
          </div>
          {isLowCredits && (
            <div className="text-xs text-red-600 font-medium">
              ⚠️ Running low on credits
            </div>
          )}
        </div>

        {/* Daily Credits (for trial) */}
        {isTrialUser && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">Daily Credits</span>
              </div>
              <span className={`font-bold ${isLowDailyCredits ? 'text-red-600' : 'text-green-600'}`}>
                {usage.dailyCreditsRemaining}/10
              </span>
            </div>
            <Progress value={getDailyProgress()} className="h-2" />
            {isLowDailyCredits && (
              <div className="text-xs text-red-600 font-medium">
                ⚠️ Daily limit almost reached
              </div>
            )}
          </div>
        )}

        {/* Trial Info */}
        {isTrialUser && usage.trialEndsAt && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800">
              🎁 Free Trial
            </div>
            <div className="text-xs text-blue-600">
              {trialDaysLeft > 0 ? (
                `${trialDaysLeft} days remaining`
              ) : (
                'Trial expired'
              )}
            </div>
          </div>
        )}

        {/* Monthly Credits (for paid plans) */}
        {!isTrialUser && (
          <div className="text-xs text-gray-600">
            💰 {usage.includedCreditsThisCycle}/{usage.includedCreditsThisCycle} monthly credits used
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {isTrialUser || isLowCredits ? (
            <Button
              onClick={onUpgrade}
              className="w-full bg-[#c6c2e6] text-black font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              {isTrialUser ? '✨ Upgrade Plan' : '📈 Upgrade Plan'}
            </Button>
          ) : null}
          
          <Button
            onClick={onBuyCredits}
            variant="outline"
            className="w-full border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            🪙 Buy Credits
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}