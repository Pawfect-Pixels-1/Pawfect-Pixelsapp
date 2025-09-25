import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Twitter, Facebook, Linkedin, Instagram, Copy, Download, X, Sparkles, Heart } from 'lucide-react';
import { ShareButton } from './ShareButton';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentUrl: string;
  contentType: 'image' | 'video';
  title?: string;
  description?: string;
  onShare?: (platform: string) => void;
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  contentUrl, 
  contentType, 
  title = 'Check out my AI creation!', 
  description = 'Created with Portrait Studio',
  onShare 
}: ShareModalProps) {
  const [hasShared, setHasShared] = useState(false);

  const handleShare = (platform: string) => {
    setHasShared(true);
    onShare?.(platform);
    
    // Auto-close after successful share
    setTimeout(() => {
      onClose();
      setHasShared(false);
    }, 1500);
  };

  const suggestions = [
    { 
      text: "Share your creation with friends!", 
      emoji: "👥",
      platforms: ['twitter', 'facebook'] 
    },
    { 
      text: "Show off your AI art skills!", 
      emoji: "🎨",
      platforms: ['instagram', 'linkedin'] 
    },
    { 
      text: "Inspire others with AI creativity!", 
      emoji: "✨",
      platforms: ['twitter', 'linkedin'] 
    }
  ];

  const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-2 border-black shadow-[8px_8px_0px_0px_#c6c2e6]">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-black flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Your Creation is Ready!
          </DialogTitle>
          <DialogDescription>
            Share your AI-generated creation with the world or save it to your device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <Card className="border-2 border-black shadow-[4px_4px_0px_0px_#000000]">
            <CardContent className="p-3">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                {contentType === 'image' ? (
                  <img 
                    src={contentUrl} 
                    alt="Generated content" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video 
                    src={contentUrl} 
                    className="w-full h-full object-cover"
                    controls
                    loop
                    muted
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success State */}
          <AnimatePresence>
            {hasShared && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4 mb-4">
                  <Heart className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">Shared successfully!</p>
                  <p className="text-sm text-green-600">Thank you for spreading the AI creativity! 🎉</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Share Suggestion */}
          {!hasShared && (
            <div className="text-center">
              <Badge className="bg-purple-100 text-purple-800 border border-purple-300 mb-3">
                <span className="mr-1">{randomSuggestion.emoji}</span>
                {randomSuggestion.text}
              </Badge>
            </div>
          )}

          {/* Actions */}
          {!hasShared && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <ShareButton
                  contentUrl={contentUrl}
                  contentType={contentType}
                  title={title}
                  description={description}
                  onShare={handleShare}
                />
              </div>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Maybe later
                </Button>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700 text-center">
              💡 <strong>Pro tip:</strong> Sharing your AI creations helps inspire others and showcases the amazing possibilities of AI art!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}