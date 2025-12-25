import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export function useRateLimiter({ maxRequests, windowMs, message }: RateLimiterOptions) {
  const requestTimestamps = useRef<number[]>([]);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Remove old timestamps outside the window
    requestTimestamps.current = requestTimestamps.current.filter(ts => ts > windowStart);
    
    // Check if we've exceeded the limit
    if (requestTimestamps.current.length >= maxRequests) {
      const oldestRequest = requestTimestamps.current[0];
      const waitTime = Math.ceil((oldestRequest + windowMs - now) / 1000);
      toast.error(message || `Too many requests. Please wait ${waitTime}s.`);
      return false;
    }
    
    // Add current timestamp
    requestTimestamps.current.push(now);
    return true;
  }, [maxRequests, windowMs, message]);

  const resetLimit = useCallback(() => {
    requestTimestamps.current = [];
  }, []);

  return { checkRateLimit, resetLimit };
}
