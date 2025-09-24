import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Gift } from 'lucide-react';
import type { CreditPack } from '@/lib/stores/useBilling';

interface CreditPackCardProps {
  pack: CreditPack;
  onSelect: (packName: string) => void;
  isLoading?: boolean;
}

export function CreditPackCard({ pack, onSelect, isLoading }: CreditPackCardProps) {
  const pricePerCredit = pack.price / pack.credits;
  const hasBonus = pack.bonus > 0;

  return (
    <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
      <CardHeader className="text-center pb-4">
        {hasBonus && (
          <Badge className="w-fit mx-auto mb-2 bg-green-100 text-green-800 border border-green-300">
            <Gift className="w-3 h-3 mr-1" />
            +{pack.bonus}% Bonus
          </Badge>
        )}
        
        <CardTitle className="text-xl font-black text-black">
          {pack.displayName}
        </CardTitle>
        
        <div className="mt-2">
          <div className="text-3xl font-black text-black">
            ${pack.price}
          </div>
          <div className="text-sm text-gray-600">
            ${pricePerCredit.toFixed(3)} per credit
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-lg font-semibold">
            <Coins className="w-5 h-5 text-yellow-600" />
            {pack.credits.toLocaleString()} Credits
          </div>
          {hasBonus && (
            <div className="text-sm text-green-600 font-medium">
              ({(pack.credits / (1 + pack.bonus / 100)).toFixed(0)} base + {Math.floor(pack.credits * pack.bonus / 100)} bonus)
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600 space-y-1">
          <div>💫 Transform ~{Math.floor(pack.credits / 4)} images</div>
          <div>🎬 Create ~{Math.floor(pack.credits / 10)}s of video</div>
          <div>♾️ Credits never expire</div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => onSelect(pack.name)}
          disabled={isLoading}
          className="w-full font-semibold border-2 border-black bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Processing...
            </div>
          ) : (
            'Buy Credits'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}