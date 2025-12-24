import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';

interface FonepayQRProps {
  amount: number;
  orderId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Test/Demo Fonepay Merchant Configuration
const FONEPAY_CONFIG = {
  merchantCode: 'DEMO-MERCHANT-001',
  merchantName: 'Chiyadani Tea House',
  terminalId: 'TERM-001',
  baseUrl: 'https://fonepay.com/pay', // Demo URL
};

export default function FonepayQR({ amount, orderId, onSuccess, onCancel }: FonepayQRProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'checking' | 'success' | 'failed'>('loading');
  const [qrData, setQrData] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [countdown, setCountdown] = useState(180); // 3 minutes timeout

  // Generate QR code data
  useEffect(() => {
    generateQR();
  }, [amount, orderId]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'ready' && status !== 'checking') return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStatus('failed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  // Poll for payment status (simulated)
  useEffect(() => {
    if (status !== 'ready') return;

    const pollInterval = setInterval(() => {
      checkPaymentStatus();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [status]);

  const generateQR = async () => {
    setStatus('loading');
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate transaction ID
    const txnId = `FP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setTransactionId(txnId);

    // Build QR data string (Fonepay format simulation)
    // Real Fonepay uses specific format with merchant details
    const qrPayload = {
      merchantCode: FONEPAY_CONFIG.merchantCode,
      merchantName: FONEPAY_CONFIG.merchantName,
      amount: amount,
      transactionId: txnId,
      orderId: orderId,
      timestamp: new Date().toISOString(),
    };

    // Create base64 encoded QR data
    const qrString = JSON.stringify(qrPayload);
    const encodedData = btoa(qrString);
    
    // Store the fonepay URL for QR code generation
    setQrData(`fonepay://pay?data=${encodedData}`);
    setStatus('ready');
    setCountdown(180);
  };

  const checkPaymentStatus = async () => {
    // In real implementation, this would call Fonepay's status check API
    // For demo, we'll simulate a random success after a few checks
    
    // Simulate 10% chance of success on each check for demo
    if (Math.random() < 0.1) {
      setStatus('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRefresh = () => {
    generateQR();
  };

  const handleSimulatePayment = () => {
    setStatus('checking');
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center p-6">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Smartphone className="h-8 w-8 text-[#E31837]" />
          <span className="text-xl font-bold text-[#E31837]">Fonepay</span>
        </div>
        <p className="text-sm text-muted-foreground">Scan QR to pay securely</p>
      </div>

      {/* QR Section */}
      <div className="bg-white border-2 border-[#eee] rounded-xl p-4 mb-4 relative">
        {status === 'loading' && (
          <div className="w-[250px] h-[250px] flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#E31837]" />
          </div>
        )}

        {status === 'ready' && qrData && (
          <>
            <div className="w-[250px] h-[250px] flex items-center justify-center">
              <QRCodeSVG 
                value={qrData} 
                size={250}
                level="M"
                includeMargin={true}
              />
            </div>
            <div className="absolute top-2 right-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {status === 'checking' && (
          <div className="w-[250px] h-[250px] flex flex-col items-center justify-center bg-[#f8f9fa]">
            <Loader2 className="w-12 h-12 animate-spin text-[#E31837] mb-3" />
            <span className="text-sm font-medium">Verifying payment...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="w-[250px] h-[250px] flex flex-col items-center justify-center bg-[#f0fdf4]">
            <CheckCircle2 className="w-16 h-16 text-[#27ae60] mb-3 animate-[popIn_0.5s]" />
            <span className="text-lg font-bold text-[#27ae60]">Payment Successful!</span>
          </div>
        )}

        {status === 'failed' && (
          <div className="w-[250px] h-[250px] flex flex-col items-center justify-center bg-[#fef2f2]">
            <XCircle className="w-16 h-16 text-[#e74c3c] mb-3" />
            <span className="text-lg font-bold text-[#e74c3c]">Payment Timeout</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="mt-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Amount Display */}
      <div className="bg-[#FFF5F5] border border-[#E31837]/20 rounded-lg px-6 py-3 mb-4">
        <span className="text-sm text-[#666]">Amount to pay:</span>
        <div className="text-2xl font-bold text-[#E31837]">रू {amount}</div>
      </div>

      {/* Timer and Transaction ID */}
      {(status === 'ready' || status === 'checking') && (
        <div className="text-center mb-4">
          <div className={`text-lg font-mono font-bold ${countdown < 60 ? 'text-[#e74c3c]' : 'text-[#333]'}`}>
            {formatTime(countdown)}
          </div>
          <div className="text-xs text-[#999] mt-1">
            TXN: {transactionId}
          </div>
        </div>
      )}

      {/* Instructions */}
      {status === 'ready' && (
        <div className="text-center text-sm text-[#666] mb-4 max-w-[280px]">
          <p>Open your banking app and scan this QR code to complete payment</p>
        </div>
      )}

      {/* Demo Button - Remove in production */}
      {status === 'ready' && (
        <Button 
          variant="outline"
          onClick={handleSimulatePayment}
          className="mb-4 border-dashed border-[#E31837] text-[#E31837] hover:bg-[#E31837]/5"
        >
          🧪 Simulate Payment (Demo)
        </Button>
      )}

      {/* Cancel Button */}
      {status !== 'success' && (
        <Button 
          variant="ghost" 
          onClick={onCancel}
          className="text-[#666]"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
