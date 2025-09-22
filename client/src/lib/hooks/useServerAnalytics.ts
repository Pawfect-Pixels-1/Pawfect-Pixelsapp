import { useQuery } from '@tanstack/react-query';
import { getShareAnalytics } from '../api/sharing';

export function useServerAnalytics() {
  return useQuery({
    queryKey: ['shareAnalytics'],
    queryFn: getShareAnalytics,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Data is considered stale after 15 seconds
  });
}