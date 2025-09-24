import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import type { PlanConfig } from '@/lib/stores/useBilling';

interface PricingCardProps {
  plan: PlanConfig;
  currentPlan?: string;
  isPopular?: boolean;
  onSelect: (planName: string) => void;
  isLoading?: boolean;
}

export function PricingCard({ plan, currentPlan, isPopular, onSelect, isLoading }: PricingCardProps) {
  const isCurrentPlan = currentPlan === plan.name;
  const isTrialPlan = plan.name === 'trial';

  return (
    <Card className={`relative ${isPopular ? 'border-[#c6c2e6] border-2 shadow-[8px_8px_0px_0px_#c6c2e6]' : 'border-2 border-black shadow-[4px_4px_0px_0px_#000000]'}`}>
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#c6c2e6] text-black border-2 border-black font-semibold">
          <Sparkles className="w-3 h-3 mr-1" />
          Most Popular
        </Badge>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-2xl font-black text-black">
          {plan.displayName}
        </CardTitle>
        <CardDescription className="text-lg font-semibold">
          {plan.description}
        </CardDescription>
        <div className="mt-4">
          {!isTrialPlan ? (
            <div className="text-4xl font-black text-black">
              ${plan.price}
              <span className="text-lg font-normal text-gray-600">/month</span>
            </div>
          ) : (
            <div className="text-4xl font-black text-[#c6c2e6]">
              FREE
              <span className="text-lg font-normal text-gray-600">/7 days</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-black">What's included:</div>
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            <div>💰 {plan.included_credits.toLocaleString()} credits/month included</div>
            <div>⚡ {plan.daily_credits} daily credits limit</div>
            {plan.video_models.length > 0 && (
              <div>🎬 Video generation available</div>
            )}
            {plan.is_priority_queue && (
              <div>⚡ Priority processing queue</div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => onSelect(plan.name)}
          disabled={isCurrentPlan || isLoading}
          className={`w-full font-semibold border-2 border-black transition-all ${
            isCurrentPlan 
              ? 'bg-gray-200 text-gray-600 cursor-not-allowed' 
              : isPopular
                ? 'bg-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
                : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Processing...
            </div>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : isTrialPlan ? (
            'Start Free Trial'
          ) : (
            'Upgrade Now'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}