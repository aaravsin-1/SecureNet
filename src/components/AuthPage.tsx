
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Terminal, Lock, AlertTriangle } from 'lucide-react';
import { PasswordStrength } from '@/components/PasswordStrength';
import { Captcha } from '@/components/Captcha';
import { validatePassword } from '@/utils/passwordValidator';
import { checkRateLimit, getRateLimitStatus } from '@/utils/rateLimiter';
import { auditAuth } from '@/utils/auditLogger';
import { useToast } from '@/hooks/use-toast';

export const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining: number; resetTime: Date | null }>({ remaining: 5, resetTime: null });
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const getClientIdentifier = () => {
    // In production, this would ideally be the user's IP address
    // For now, we'll use a combination of user agent and localStorage
    return btoa(navigator.userAgent + (localStorage.getItem('client_id') || Math.random().toString()));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaVerified) {
      toast({
        title: "Verification Required",
        description: "Please complete the security check.",
        variant: "destructive",
      });
      return;
    }

    const identifier = getClientIdentifier();
    
    // Check rate limit
    const canProceed = await checkRateLimit('login', identifier);
    if (!canProceed) {
      const status = await getRateLimitStatus('login', identifier);
      toast({
        title: "Too Many Attempts",
        description: `Please try again in ${status.resetTime ? Math.ceil((status.resetTime.getTime() - Date.now()) / 60000) : 15} minutes.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (!error) {
        await auditAuth.login('email_password');
      }
    } finally {
      setIsLoading(false);
      // Update rate limit info
      const status = await getRateLimitStatus('login', identifier);
      setRateLimitInfo(status);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaVerified) {
      toast({
        title: "Verification Required",
        description: "Please complete the security check.",
        variant: "destructive",
      });
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      toast({
        title: "Password Too Weak",
        description: "Please choose a stronger password.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }

    const identifier = getClientIdentifier();
    
    // Check rate limit
    const canProceed = await checkRateLimit('signup', identifier);
    if (!canProceed) {
      const status = await getRateLimitStatus('signup', identifier);
      toast({
        title: "Too Many Attempts",
        description: `Please try again in ${status.resetTime ? Math.ceil((status.resetTime.getTime() - Date.now()) / 60000) : 60} minutes.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(email, password);
      if (!error) {
        await auditAuth.signup(email);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background matrix-bg p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-50"></div>
      
      <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-primary/30 security-indicator">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Terminal className="h-12 w-12 text-primary terminal-glow" />
              <Shield className="h-6 w-6 text-secondary absolute -top-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary glitch">
            SECURE ACCESS
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            <Lock className="inline h-4 w-4 mr-1" />
            Underground Network Authentication
          </CardDescription>
          
          {rateLimitInfo.remaining < 3 && (
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {rateLimitInfo.remaining} attempts remaining
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Register
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4 mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hacker@secure.net"
                    className="bg-input border-primary/30 focus:border-primary text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-primary/30 focus:border-primary text-foreground"
                    required
                  />
                </div>
                
                <Captcha onVerify={setCaptchaVerified} />
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  disabled={isLoading || !captchaVerified}
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  {isLoading ? 'CONNECTING...' : 'ACCESS NETWORK'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="newuser@secure.net"
                    className="bg-input border-primary/30 focus:border-primary text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-primary/30 focus:border-primary text-foreground"
                    required
                  />
                  <PasswordStrength password={password} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-input border-primary/30 focus:border-primary text-foreground"
                    required
                  />
                </div>
                
                <Captcha onVerify={setCaptchaVerified} />
                
                <Button 
                  type="submit" 
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
                  disabled={isLoading || !captchaVerified || password !== confirmPassword}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {isLoading ? 'CREATING...' : 'CREATE ACCOUNT'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
