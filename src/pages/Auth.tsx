import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { 
  usernameSchema, 
  passwordSchema, 
  validateInput, 
  checkLoginRateLimit, 
  recordLoginAttempt 
} from '@/lib/validation';

export default function Auth() {
  const navigate = useNavigate();
  const { login, isAuthenticated, currentUser, settings } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      // Counter users go to admin if counterAsAdmin is enabled
      if (currentUser.role === 'admin' || settings.counterAsAdmin) {
        navigate('/admin');
      } else {
        navigate('/counter');
      }
    }
  }, [isAuthenticated, currentUser, settings.counterAsAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const usernameValidation = validateInput(usernameSchema, username);
    if (!usernameValidation.success) {
      toast.error(usernameValidation.error);
      return;
    }

    const passwordValidation = validateInput(passwordSchema, password);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error);
      return;
    }

    // Check rate limit
    const rateLimit = checkLoginRateLimit(username);
    if (!rateLimit.allowed) {
      toast.error(`Too many login attempts. Please try again in ${rateLimit.remainingTime} seconds.`);
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const success = login(username, password);
    recordLoginAttempt(username, success);
    
    if (success) {
      toast.success('Login successful!');
      const user = useStore.getState().currentUser;
      const currentSettings = useStore.getState().settings;
      // Counter users go to admin if counterAsAdmin is enabled
      if (user?.role === 'admin' || currentSettings.counterAsAdmin) {
        navigate('/admin');
      } else {
        navigate('/counter');
      }
    } else {
      const attemptsLeft = rateLimit.attemptsLeft ? rateLimit.attemptsLeft - 1 : 0;
      if (attemptsLeft > 0) {
        toast.error(`Invalid credentials. ${attemptsLeft} attempts remaining.`);
      } else {
        toast.error('Account temporarily locked. Please try again in 5 minutes.');
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-6">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-card p-10 rounded-3xl shadow-xl w-full max-w-md border border-border">
        {/* Logo */}
        <div className="w-16 h-16 gradient-primary rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-warm">
          <Coffee className="w-8 h-8 text-primary-foreground" />
        </div>
        
        <h1 className="font-serif text-3xl font-bold text-center mb-2">Welcome Back</h1>
        <p className="text-muted-foreground text-center mb-8">
          Sign in to {settings.restaurantName}
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 20))}
              className="pl-12 h-14 bg-muted/50 border-border rounded-xl text-base"
              required
              maxLength={20}
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 50))}
              className="pl-12 h-14 bg-muted/50 border-border rounded-xl text-base"
              required
              maxLength={50}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 gradient-primary text-primary-foreground font-bold rounded-xl shadow-warm hover:opacity-90 transition-opacity text-base"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Contact your administrator for login credentials
        </p>
      </div>
    </div>
  );
}
