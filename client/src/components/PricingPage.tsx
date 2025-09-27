import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { StripePricingTable } from "@/components/StripePricingTable";

// Prefer env vars (swap to your LIVE values when ready)
const PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51S4jZjD1OI5Pfwv2w3DDrXf0JNSjTI65NzWqIBDHO6LoyoEJfyk7JQSl6H2ILCo0489ZEUmkQnRtXISSNLlOOg0x00iO0qz1rQ";

// Your two Pricing Table IDs (test)
const SUBSCRIPTIONS_TABLE_ID =
  import.meta.env.VITE_STRIPE_PRICING_TABLE_SUBSCRIPTION_ID ||
  "prctbl_1SBq9SD1OI5Pfwv29Uv3LFKh"; // (1) 3 subscription products

const CREDIT_PACKS_TABLE_ID =
  import.meta.env.VITE_STRIPE_PRICING_TABLE_CREDITPACKS_ID ||
  "prctbl_1SBpwQD1OI5Pfwv2G0FBN9pw"; // (2) one-time credit packs

const CUSTOMER_PORTAL_URL =
  import.meta.env.VITE_STRIPE_CUSTOMER_PORTAL_URL ||
  "https://billing.stripe.com/p/login/test_6oU28qbHn92y3yQ1Iw1RC00";

interface PricingPageProps {
  onBack: () => void;
}

export default function PricingPage({ onBack }: PricingPageProps) {
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

          <Button asChild variant="outline" className="gap-2 border-2 border-black">
            <a href={CUSTOMER_PORTAL_URL} target="_blank" rel="noreferrer">
              Manage Billing <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <Card className="border-2 border-black shadow-[6px_6px_0_#000]">
          <CardHeader>
            <CardTitle className="text-2xl">Choose what fits you</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="subscriptions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                <TabsTrigger value="credits">Credit Packs</TabsTrigger>
              </TabsList>

              <TabsContent value="subscriptions" className="mt-6">
                <StripePricingTable
                  pricingTableId={SUBSCRIPTIONS_TABLE_ID}
                  publishableKey={PUBLISHABLE_KEY}
                />
              </TabsContent>

              <TabsContent value="credits" className="mt-6">
                <StripePricingTable
                  pricingTableId={CREDIT_PACKS_TABLE_ID}
                  publishableKey={PUBLISHABLE_KEY}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}