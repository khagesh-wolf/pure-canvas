// Central subscription verification via edge function API
// This calls the dashboard's subscription check endpoint

const DASHBOARD_PROJECT_ID = 'bttirwdxislcsdpshgdj';
const DASHBOARD_ANON_KEY = 'sb_publishable_7hgtR3bkXIJ2fXMapgOzqw_48s17mJe';
const RESTAURANT_PROJECT_ID = 'tzmxbgplkjwgsayjesxf';

const SUBSCRIPTION_API_URL = `https://${DASHBOARD_PROJECT_ID}.supabase.co/functions/v1/check-subscription`;

export interface SubscriptionStatus {
  isValid: boolean;
  isTrial: boolean;
  /**
   * Days remaining until expiration when known.
   * Null means "unknown" (e.g. network/CORS error) and should not block access.
   */
  daysRemaining: number | null;
  expiresAt: Date | null;
  plan: string | null;
  message: string;
}

interface ApiResponse {
  valid: boolean;
  status: 'active' | 'trial' | 'expired' | 'deactivated';
  days_remaining?: number;
  message?: string;
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  try {
    console.log('[Subscription] Checking subscription status...');
    
    const response = await fetch(SUBSCRIPTION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': DASHBOARD_ANON_KEY,
        'Authorization': `Bearer ${DASHBOARD_ANON_KEY}`,
      },
      body: JSON.stringify({
        project_id: RESTAURANT_PROJECT_ID,
      }),
    });

    if (!response.ok) {
      console.error('[Subscription] API error:', response.status, response.statusText);
      // On API error, allow access to prevent blocking due to network issues
      return {
        isValid: true,
        isTrial: false,
        daysRemaining: null,
        expiresAt: null,
        plan: null,
        message: 'Could not verify subscription - temporary access granted',
      };
    }

    const data: ApiResponse = await response.json();
    console.log('[Subscription] API response:', data);

    // Handle invalid subscription
    if (!data.valid) {
      return {
        isValid: false,
        isTrial: false,
        daysRemaining: 0,
        expiresAt: null,
        plan: data.status,
        message: data.message || 'Your subscription is not valid. Please contact administrator.',
      };
    }

    // Calculate expiry date based on days remaining
    const expiresAt = data.days_remaining 
      ? new Date(Date.now() + data.days_remaining * 24 * 60 * 60 * 1000)
      : null;

    // Handle trial status
    if (data.status === 'trial') {
      return {
        isValid: true,
        isTrial: true,
        daysRemaining: data.days_remaining ?? null,
        expiresAt,
        plan: 'trial',
        message: data.days_remaining !== undefined && data.days_remaining <= 5
          ? `Trial expires in ${data.days_remaining} days. Subscribe to continue using.`
          : `Trial period - ${data.days_remaining ?? 0} days remaining`,
      };
    }

    // Handle active subscription
    return {
      isValid: true,
      isTrial: false,
      daysRemaining: data.days_remaining ?? null,
      expiresAt,
      plan: data.status,
      message: data.days_remaining !== undefined && data.days_remaining <= 7
        ? `Subscription expires in ${data.days_remaining} days. Renew to continue.`
        : `Active subscription - ${data.days_remaining ?? 0} days remaining`,
    };
  } catch (err) {
    console.error('[Subscription] Unexpected error:', err);
    // On error, allow access to prevent blocking due to network issues
    return {
      isValid: true,
      isTrial: false,
      daysRemaining: null,
      expiresAt: null,
      plan: null,
      message: 'Could not verify subscription - temporary access granted',
    };
  }
}
