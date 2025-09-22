import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Linkedin, Instagram, Copy, Download, ExternalLink } from 'lucide-react';
import { useSharing } from '../lib/stores/useSharing';
import { createShareLink, recordShareEvent } from '../lib/api/sharing';

interface ShareButtonProps {
  contentUrl: string;
  contentType: 'image' | 'video';
  title?: string;
  description?: string;
  onShare?: (platform: string) => void;
}

interface SocialPlatform {
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  shareUrl: (url: string, text: string) => string;
  supportsVideo: boolean;
}

const socialPlatforms: SocialPlatform[] = [
  {
    name: 'Twitter',
    icon: Twitter,
    color: '#1DA1F2',
    shareUrl: (url, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    supportsVideo: true,
  },
  {
    name: 'Facebook',
    icon: Facebook, 
    color: '#4267B2',
    shareUrl: (url, text) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    supportsVideo: true,
  },
  {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0077B5',
    shareUrl: (url, text) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    supportsVideo: true,
  },
  {
    name: 'Instagram',
    icon: Instagram,
    color: '#E4405F',
    shareUrl: (url, text) => `https://www.instagram.com/`, // Instagram doesn't support direct URL sharing
    supportsVideo: false, // Instagram requires app-based sharing
  },
];

export function ShareButton({ contentUrl, contentType, title = 'Check out my AI-generated content!', description = 'Created with Portrait Studio', onShare }: ShareButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const { addShareEvent } = useSharing();

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(contentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      
      // Record the share event on the server
      try {
        await recordShareEvent({
          contentUrl,
          contentType,
          platform: 'clipboard',
          title,
          description,
        });
      } catch (error) {
        console.error('Error recording share event:', error);
      }

      // Track sharing event locally
      addShareEvent({
        contentUrl,
        contentType,
        platform: 'clipboard',
        title,
        description,
      });
      
      onShare?.('clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = contentUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(contentUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `portrait-studio-${contentType}-${Date.now()}.${contentType === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // Record the share event on the server
      try {
        await recordShareEvent({
          contentUrl,
          contentType,
          platform: 'download',
          title,
          description,
        });
      } catch (error) {
        console.error('Error recording share event:', error);
      }

      // Track sharing event locally
      addShareEvent({
        contentUrl,
        contentType,
        platform: 'download',
        title,
        description,
      });
      
      onShare?.('download');
    } catch (err) {
      console.error('Failed to download:', err);
      // Fallback: open in new tab
      window.open(contentUrl, '_blank');
    }
  };

  const handleSocialShare = async (platform: SocialPlatform) => {
    const shareText = `${title} ${description} #AIGenerated #PortraitStudio`;
    
    if (platform.name === 'Instagram') {
      // Instagram doesn't support direct URL sharing, so copy URL and notify user
      try {
        // Create a public share link for Instagram
        const shareResponse = await createShareLink({
          contentUrl,
          contentType,
          title,
          description,
        });

        if (shareResponse.success) {
          await navigator.clipboard.writeText(shareResponse.shareUrl);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
          
          // Record the share event
          await recordShareEvent({
            contentUrl,
            contentType,
            platform: 'instagram',
            title,
            description,
          });

          addShareEvent({
            contentUrl,
            contentType,
            platform: 'instagram',
            title,
            description,
          });
          
          onShare?.('instagram');
        } else {
          // Fallback to original URL
          await navigator.clipboard.writeText(contentUrl);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        }
      } catch (error) {
        console.error('Error sharing to Instagram:', error);
      }
      return;
    }

    try {
      // Create a public share link for social media
      const shareResponse = await createShareLink({
        contentUrl,
        contentType,
        title,
        description,
      });

      if (shareResponse.success) {
        const socialShareUrl = platform.shareUrl(shareResponse.shareUrl, shareText);
        window.open(socialShareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
        
        // Record the share event on the server
        await recordShareEvent({
          contentUrl,
          contentType,
          platform: platform.name.toLowerCase(),
          title,
          description,
        });

        // Track locally as well
        addShareEvent({
          contentUrl,
          contentType,
          platform: platform.name.toLowerCase(),
          title,
          description,
        });
        
        onShare?.(platform.name.toLowerCase());
      } else {
        console.error('Failed to create share link:', shareResponse.error);
        // Fallback to direct URL sharing
        const fallbackUrl = platform.shareUrl(contentUrl, shareText);
        window.open(fallbackUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      // Fallback to direct URL sharing
      const fallbackUrl = platform.shareUrl(contentUrl, shareText);
      window.open(fallbackUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
    }
  };

  const filteredPlatforms = socialPlatforms.filter(platform => 
    contentType === 'image' || platform.supportsVideo
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 bg-[#c6c2e6] text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {showDropdown && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          
          <div className="absolute top-full right-0 mt-2 bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_#000000] p-2 z-20 min-w-48">
            <div className="space-y-1">
              {/* Social Media Platforms */}
              {filteredPlatforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => {
                    handleSocialShare(platform);
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
                >
                  <platform.icon 
                    className="w-5 h-5" 
                    style={{ color: platform.color }}
                  />
                  <span className="font-medium">{platform.name}</span>
                </button>
              ))}

              <hr className="border-gray-200 my-2" />

              {/* Copy to Clipboard */}
              <button
                onClick={() => {
                  handleCopyToClipboard();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
              >
                <Copy className="w-5 h-5 text-gray-600" />
                <span className="font-medium">
                  {copySuccess ? 'Copied!' : 'Copy Link'}
                </span>
              </button>

              {/* Download */}
              <button
                onClick={() => {
                  handleDownload();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
              >
                <Download className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Download</span>
              </button>

              {/* Open in New Tab */}
              <button
                onClick={async () => {
                  window.open(contentUrl, '_blank');
                  setShowDropdown(false);
                  
                  // Record the share event on the server
                  try {
                    await recordShareEvent({
                      contentUrl,
                      contentType,
                      platform: 'external',
                      title,
                      description,
                    });
                  } catch (error) {
                    console.error('Error recording share event:', error);
                  }

                  // Track sharing event locally
                  addShareEvent({
                    contentUrl,
                    contentType,
                    platform: 'external',
                    title,
                    description,
                  });
                  
                  onShare?.('external');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Open in New Tab</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}