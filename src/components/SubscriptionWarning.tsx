import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { SubscriptionStatus } from '@/lib/centralSupabase';

interface SubscriptionWarningProps {
  status: SubscriptionStatus;
}

export function SubscriptionWarning({ status }: SubscriptionWarningProps) {
  const [dismissed, setDismissed] = useState(false);

  const daysRemainingKnown = typeof status?.daysRemaining === 'number';

  if (dismissed || !status || !daysRemainingKnown || status.daysRemaining > 7) {
    return null;
  }

  const isUrgent = status.daysRemaining <= 3;
  
  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between gap-2 text-sm ${
        isUrgent 
          ? 'bg-destructive text-destructive-foreground' 
          : 'bg-warning text-warning-foreground'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 justify-center">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-medium">
          {status.isTrial ? 'Trial' : 'Subscription'} expires in {status.daysRemaining} day{status.daysRemaining !== 1 ? 's' : ''}
          {' '}- Contact admin to {status.isTrial ? 'subscribe' : 'renew'}
        </span>
      </div>
      <button 
        onClick={() => setDismissed(true)}
        className="p-1 hover:opacity-70 transition-opacity shrink-0"
        aria-label="Dismiss warning"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
