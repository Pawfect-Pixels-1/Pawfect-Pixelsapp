import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Info, Sparkles } from 'lucide-react';
import { PricingCard } from './PricingCard';
import { CreditPackCard } from './CreditPackCard';
import { UsageWidget } from './UsageWidget';
import { useBilling } from '@/lib/stores/useBilling';

interface PricingPageProps {
  onBack: () => void;
}

export function PricingPage({ onBack }: PricingPageProps) {
  const { 
    usage, 
    plans, 
    creditPacks, 
    isLoadingUsage, 
    isLoadingPlans,
    isCreatingCheckout,
    fetchUsage, 
    fetchPlans, 
    createCheckoutSession 
  } = useBilling();

  const [activeTab, setActiveTab] = useState<'plans' | 'credits'>('plans');

  useEffect(() => {
    fetchUsage();
    fetchPlans();
  }, [fetchUsage, fetchPlans]);

  const handlePlanSelect = async (planName: string) => {
    if (planName === 'trial') return; // Can't "upgrade" to trial
    
    const checkoutUrl = await createCheckoutSession('subscription', planName);
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

  const handleCreditPackSelect = async (packName: string) => {
    const checkoutUrl = await createCheckoutSession('credits', packName);
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

  // Sort plans by price for consistent ordering
  const planArray = Object.values(plans).sort((a, b) => a.price - b.price);
  const isTrialUser = usage?.plan === 'trial';

  return (
    <div className="min-h-screen bg-[#fffdf5] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={onBack}
            variant="outline"
            className="border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
          </Button>
          
          <div className="flex-1">
            <h1 className="text-4xl font-black text-black mb-2">
              Pricing & Billing
            </h1>
            <p className="text-gray-600">
              Choose the perfect plan for your creative needs
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Usage Widget - Sidebar */}
          <div className="lg:col-span-1">
            {usage ? (
              <UsageWidget
                usage={usage}
                currentPlan={usage.plan !== 'trial' ? plans[usage.plan] : undefined}
                onUpgrade={() => setActiveTab('plans')}
                onBuyCredits={() => setActiveTab('credits')}
              />
            ) : (
              <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                <CardContent className="p-6 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Loading usage data...</p>
                </CardContent>
              </Card>
            )}

            {/* Credit Usage Info */}
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000] mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  How Credits Work
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-gray-600 space-y-2">
                <div>🖼️ <strong>Image Transform:</strong> 4 credits</div>
                <div>🎬 <strong>Video Generation:</strong> 5-18 credits/second</div>
                <div>💰 <strong>1 credit</strong> ≈ $0.01</div>
                <div className="pt-2 border-t border-gray-200">
                  <div>✨ Monthly plans include credits</div>
                  <div>🛒 Buy extra credits anytime</div>
                  <div>♾️ Credits never expire</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'plans' | 'credits')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="plans" className="font-semibold">
                  📊 Subscription Plans
                </TabsTrigger>
                <TabsTrigger value="credits" className="font-semibold">
                  🪙 Credit Packs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plans" className="space-y-6">
                {isTrialUser && (
                  <Card className="border-2 border-blue-300 bg-blue-50 shadow-[4px_4px_0px_0px_#3b82f6]">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <div className="font-semibold text-blue-900">Free Trial Active</div>
                          <div className="text-sm text-blue-700">
                            You're currently on a free trial. Upgrade to unlock unlimited features and remove daily limits.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isLoadingPlans ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600">Loading subscription plans...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {planArray
                      .filter(plan => plan.name !== 'trial')
                      .map((plan) => (
                        <PricingCard
                          key={plan.name}
                          plan={plan}
                          currentPlan={usage?.plan}
                          isPopular={plan.name === 'advanced'} // Mark Advanced plan as popular
                          onSelect={handlePlanSelect}
                          isLoading={isCreatingCheckout}
                        />
                      ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="credits" className="space-y-6">
                <Card className="border-2 border-green-300 bg-green-50 shadow-[4px_4px_0px_0px_#10b981]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-green-900">One-Time Purchases</div>
                        <div className="text-sm text-green-700">
                          Buy credits without a subscription. Perfect for occasional use or topping up your balance.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isLoadingPlans ? (
                  <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-600">Loading credit packs...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {creditPacks.map((pack) => (
                      <CreditPackCard
                        key={pack.name}
                        pack={pack}
                        onSelect={handleCreditPackSelect}
                        isLoading={isCreatingCheckout}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}