import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Crown,
  Star
} from 'lucide-react';
import { useBilling } from '@/lib/stores/useBilling';

export function BillingManagementModal() {
  const { 
    showBillingModal, 
    setShowBillingModal, 
    usage, 
    plans,
    isProcessing,
    cancelSubscription,
    createCheckoutSession 
  } = useBilling();

  if (!showBillingModal || !usage) return null;

  const currentPlan = usage.plan !== 'trial' ? plans[usage.plan] : null;
  const isActiveSubscription = usage.status && ['active', 'trialing'].includes(usage.status);
  const isPastDue = usage.status === 'past_due';

  const getStatusBadge = () => {
    switch (usage.status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-100 text-blue-800"><Zap className="w-3 h-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-gray-100 text-gray-800">Canceled</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'basic': return <Star className="w-4 h-4" />;
      case 'advanced': return <Crown className="w-4 h-4" />;
      case 'premium': return <Zap className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const handleUpgrade = async (planName: string) => {
    const checkoutUrl = await createCheckoutSession('subscription', planName);
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  };

  const handleCancel = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.'
    );
    
    if (confirmed) {
      const success = await cancelSubscription();
      if (success) {
        alert('Your subscription has been canceled. You will retain access until the end of your current billing period.');
      } else {
        alert('Failed to cancel subscription. Please contact support.');
      }
    }
  };

  return (
    <Dialog open={showBillingModal} onOpenChange={setShowBillingModal}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan Status */}
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentPlan ? getPlanIcon(currentPlan.name) : <Star className="w-4 h-4" />}
                  Current Plan: {currentPlan?.displayName || 'Free Trial'}
                </div>
                {getStatusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Credits Balance</div>
                  <div className="text-xl font-bold">{usage.creditsBalance.toLocaleString()}</div>
                </div>
                
                {usage.plan === 'trial' && (
                  <div>
                    <div className="text-sm text-gray-600">Daily Credits Remaining</div>
                    <div className="text-xl font-bold">{usage.dailyCreditsRemaining}</div>
                  </div>
                )}
                
                {currentPlan && (
                  <div>
                    <div className="text-sm text-gray-600">Monthly Allowance</div>
                    <div className="text-xl font-bold">{currentPlan.included_credits.toLocaleString()}</div>
                  </div>
                )}
              </div>

              {usage.currentPeriodEnd && (
                <div className="text-sm text-gray-600">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {isActiveSubscription ? 'Next billing date:' : 'Period ends:'} {new Date(usage.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}

              {usage.trialEndsAt && (
                <div className="text-sm text-blue-600">
                  <Zap className="w-4 h-4 inline mr-1" />
                  Trial ends: {new Date(usage.trialEndsAt).toLocaleDateString()}
                </div>
              )}

              {isPastDue && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    Your payment is past due. Please update your payment method to continue using premium features.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Plans */}
          {usage.plan === 'trial' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Upgrade to Premium</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.values(plans).map((plan) => (
                  <Card key={plan.name} className="border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
                    <CardHeader>
                      <CardTitle className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {getPlanIcon(plan.name)}
                          {plan.displayName}
                        </div>
                        <div className="text-2xl font-black">
                          ${plan.price}
                          <span className="text-sm font-normal text-gray-600">/month</span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm mb-4">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => handleUpgrade(plan.name)}
                        disabled={isProcessing}
                        className="w-full border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px]"
                      >
                        {isProcessing ? 'Processing...' : 'Upgrade Now'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Subscription Actions */}
          {isActiveSubscription && (
            <Card className="border-2 border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900">Subscription Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700 mb-4">
                  Need to make changes to your subscription? You can cancel anytime.
                </p>
                <Button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  {isProcessing ? 'Processing...' : 'Cancel Subscription'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}