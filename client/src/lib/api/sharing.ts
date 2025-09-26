// API functions for sharing functionality

export interface CreateShareLinkRequest {
  contentUrl: string;
  contentType: 'image' | 'video';
  title?: string;
  description?: string;
}

export interface CreateShareLinkResponse {
  success: boolean;
  shareId: string;
  shareUrl: string;
  error?: string;
}

export interface RecordShareEventRequest {
  contentUrl: string;
  contentType: 'image' | 'video';
  platform: string;
  title?: string;
  description?: string;
}

export interface ShareAnalyticsResponse {
  success: boolean;
  analytics: {
    totalShares: number;
    sharesByPlatform: Record<string, number>;
    sharesByContentType: Record<string, number>;
  };
  error?: string;
}

export async function createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
  const response = await fetch('/api/share/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  return await response.json();
}

export async function recordShareEvent(request: RecordShareEventRequest): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/analytics/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  return await response.json();
}

export async function getShareAnalytics(): Promise<ShareAnalyticsResponse> {
  const response = await fetch('/api/analytics/shares', {
    credentials: 'include',
  });
  return await response.json();
}