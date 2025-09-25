import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Crown, Zap, Sparkles } from 'lucide-react';

interface PricingPlan {
  name: string;
  displayName: string;
  price: number;
  description: string;
  features: string[];
  included_credits: number;
  daily_credits: number;
  is_priority_queue: boolean;
}

interface WelcomePricingSectionProps {
  onGetStarted: () => void;
}

export function WelcomePricingSection({ onGetStarted }: WelcomePricingSectionProps) {
  const [plans, setPlans] = useState<Record<string, PricingPlan>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/billing/plans');
        if (response.ok) {
          const data = await response.json();
          // Ensure we have a valid plans object
          if (data.success && data.plans && typeof data.plans === 'object') {
            setPlans(data.plans);
          } else {
            console.log('Invalid plans data structure received');
          }
        }
      } catch (error) {
        console.log('Could not fetch plans for welcome page');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlans();
  }, []);

  // Fallback plans if API is not available
  const fallbackPlans: Record<string, PricingPlan> = {
    basic: {
      name: 'basic',
      displayName: 'Basic Plan',
      price: 9,
      description: 'Perfect for casual creators',
      features: [
        '100 monthly image transforms',
        'Basic AI styles',
        'HD downloads',
        'Email support'
      ],
      included_credits: 100,
      daily_credits: 20,
      is_priority_queue: false
    },
    advanced: {
      name: 'advanced',
      displayName: 'Advanced Plan',
      price: 29,
      description: 'For serious content creators',
      features: [
        '500 monthly image transforms',
        'Video generation (up to 10s)',
        'Premium AI styles',
        'HD & 4K downloads',
        'Priority support'
      ],
      included_credits: 500,
      daily_credits: 50,
      is_priority_queue: true
    },
    premium: {
      name: 'premium',
      displayName: 'Premium Plan',
      price: 79,
      description: 'For professionals & agencies',
      features: [
        'Unlimited image transforms',
        'Long-form video generation',
        'All AI styles & models',
        'Commercial license',
        'Priority processing',
        'Dedicated support'
      ],
      included_credits: 2000,
      daily_credits: 100,
      is_priority_queue: true
    }
  };

  const displayPlans = Object.keys(plans).length > 0 ? plans : fallbackPlans;
  const planArray = displayPlans ? Object.values(displayPlans).filter(Boolean).sort((a, b) => a.price - b.price) : [];

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'basic': return <Star className="w-5 h-5" />;
      case 'advanced': return <Crown className="w-5 h-5" />;
      case 'premium': return <Sparkles className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'basic': return 'from-blue-500 to-blue-600';
      case 'advanced': return 'from-purple-500 to-purple-600';
      case 'premium': return 'from-yellow-500 to-yellow-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">Loading pricing plans...</p>
      </div>
    );
  }

  return (
    <div className="mb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="text-center mb-12"
      >
        <h2 className="font-header text-4xl font-bold mb-4 text-gray-900">
          Choose Your <span className="text-purple-600">Creative Plan</span>
        </h2>
        <p className="text-xl text-gray-700 max-w-2xl mx-auto">
          Start with our free trial, then upgrade to unlock unlimited creativity
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Free Trial Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-2 border-black shadow-[6px_6px_0_#10b981] relative h-full">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-green-600" />
                <CardTitle className="text-2xl font-black text-gray-900">
                  Free Trial
                </CardTitle>
              </div>
              <p className="text-gray-600">Get started for free</p>
              <div className="mt-4">
                <div className="text-4xl font-black text-green-600">
                  FREE
                  <span className="text-lg font-normal text-gray-600">/7 days</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">10 daily image transforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Basic AI styles</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">HD downloads</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Community support</span>
                </li>
              </ul>

              <Button
                onClick={onGetStarted}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Start Free Trial
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Paid Plans */}
        {planArray && planArray.length > 0 && planArray.map((plan, index) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + index * 0.1 }}
          >
            <Card className={`border-2 border-black shadow-[6px_6px_0_#000] relative h-full ${
              plan.name === 'advanced' ? 'scale-105 z-10' : ''
            }`}>
              {plan.name === 'advanced' && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white border-2 border-black font-semibold">
                  <Crown className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {getPlanIcon(plan.name)}
                  <CardTitle className="text-2xl font-black text-gray-900">
                    {plan.displayName}
                  </CardTitle>
                </div>
                <p className="text-gray-600">{plan.description}</p>
                <div className="mt-4">
                  <div className="text-4xl font-black text-gray-900">
                    ${plan.price}
                    <span className="text-lg font-normal text-gray-600">/month</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features && plan.features.length > 0 && plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                  <div>💰 {plan.included_credits.toLocaleString()} credits/month</div>
                  <div>⚡ {plan.daily_credits} daily credits limit</div>
                  {plan.is_priority_queue && (
                    <div>🚀 Priority processing queue</div>
                  )}
                </div>

                <Button
                  onClick={onGetStarted}
                  className={`w-full mt-6 font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all ${
                    plan.name === 'advanced'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="text-center mt-8"
      >
        <p className="text-sm text-gray-600">
          💳 All plans include secure billing • 🔄 Cancel anytime • 💰 Upgrade or downgrade as needed
        </p>
      </motion.div>
    </div>
  );
}