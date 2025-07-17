
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Download, Eye, EyeOff } from 'lucide-react';
import { 
  generateTOTPSecret, 
  generateQRCode, 
  verifyTOTP, 
  generateBackupCodes,
  setup2FA,
  disable2FA,
  get2FAStatus 
} from '@/utils/twoFactorAuth';
import { auditAuth } from '@/utils/auditLogger';
import { useToast } from '@/hooks/use-toast';

export const TwoFactorSetup: React.FC = () => {
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasSetup, setHasSetup] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const status = await get2FAStatus();
    setIsEnabled(status.enabled);
    setHasSetup(status.hasSetup);
  };

  const generateSetup = async () => {
    try {
      const newSecret = generateTOTPSecret();
      const codes = generateBackupCodes();
      
      // Get user email for QR code
      const userEmail = 'user@example.com'; // Would get from auth context
      const qrCodeUrl = await generateQRCode(newSecret, userEmail);
      
      setSecret(newSecret);
      setQrCode(qrCodeUrl);
      setBackupCodes(codes);
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Failed to generate 2FA setup. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEnable2FA = async () => {
    if (!verificationCode || !verifyTOTP(verificationCode, secret)) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid verification code from your authenticator app.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const success = await setup2FA(secret, backupCodes);
      if (success) {
        setIsEnabled(true);
        setHasSetup(true);
        setShowBackupCodes(true);
        await auditAuth.enable2FA();
        toast({
          title: "2FA Enabled",
          description: "Two-factor authentication has been successfully enabled.",
        });
      } else {
        throw new Error('Setup failed');
      }
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: "Failed to enable 2FA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setLoading(true);
    try {
      const success = await disable2FA();
      if (success) {
        setIsEnabled(false);
        setHasSetup(false);
        setSecret('');
        setQrCode('');
        setBackupCodes([]);
        await auditAuth.disable2FA();
        toast({
          title: "2FA Disabled",
          description: "Two-factor authentication has been disabled.",
        });
      } else {
        throw new Error('Disable failed');
      }
    } catch (error) {
      toast({
        title: "Disable Failed",
        description: "Failed to disable 2FA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isEnabled) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription>
            Your account is protected with 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showBackupCodes && backupCodes.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">Backup Codes</h4>
              <p className="text-sm text-muted-foreground">
                Save these codes in a safe place. You can use them to access your account if you lose your authenticator device.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted p-4 rounded">
                {backupCodes.map((code, index) => (
                  <div key={index}>{code}</div>
                ))}
              </div>
              <Button onClick={downloadBackupCodes} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Codes
              </Button>
            </div>
          )}
          <Button 
            onClick={handleDisable2FA} 
            variant="destructive"
            disabled={loading}
          >
            Disable 2FA
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!secret ? (
          <Button onClick={generateSetup}>
            Set Up 2FA
          </Button>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1. Scan QR Code</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Use your authenticator app (Google Authenticator, Authy, etc.) to scan this QR code:
              </p>
              {qrCode && (
                <img src={qrCode} alt="2FA QR Code" className="mx-auto" />
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Enter Verification Code</h4>
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                maxLength={6}
              />
            </div>

            <Button 
              onClick={handleEnable2FA}
              disabled={!verificationCode || loading}
              className="w-full"
            >
              Enable 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
