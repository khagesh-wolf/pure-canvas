import { useState, useEffect, useCallback } from 'react';
import { checkSubscription, SubscriptionStatus } from '@/lib/centralSupabase';

const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const subscriptionStatus = await checkSubscription();
      setStatus(subscriptionStatus);
      setLastChecked(new Date());
    } catch (error) {
      console.error('[useSubscription] Error:', error);
      // On error (network/CORS), assume valid and do NOT infer expiry
      setStatus({
        isValid: true,
        isTrial: false,
        daysRemaining: null,
        expiresAt: null,
        plan: null,
        message: 'Could not verify subscription - temporary access granted',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Set up periodic check
    const interval = setInterval(refresh, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  // Block only when we positively know it is expired/invalid
  const daysRemainingKnown = typeof status?.daysRemaining === 'number';
  const isExpired = daysRemainingKnown && (status!.daysRemaining as number) <= 0;
  const isValid = (status?.isValid ?? true) && !isExpired;

  return {
    status,
    isLoading,
    lastChecked,
    refresh,
    isValid,
    showWarning:
      isValid &&
      daysRemainingKnown &&
      (status!.daysRemaining as number) <= 7 &&
      (status!.daysRemaining as number) > 0,
  };
}
