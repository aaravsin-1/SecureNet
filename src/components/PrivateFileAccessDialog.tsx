import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PrivateFileAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  expectedCode: string;
  onAccessGranted: () => void;
}

export const PrivateFileAccessDialog = ({ 
  open, 
  onOpenChange, 
  fileName,
  expectedCode,
  onAccessGranted 
}: PrivateFileAccessDialogProps) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    
    try {
      if (code.trim() === expectedCode) {
        toast({
          title: "Access Granted",
          description: "File access verified successfully",
        });
        onAccessGranted();
        handleClose();
      } else {
        toast({
          title: "Access Denied",
          description: "Invalid access code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Access Error",
        description: "Could not verify access code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setShowCode(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Private File Access
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-muted-foreground">
            The file "{fileName}" is private and requires an access code to view.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter access code"
                className="bg-input border-primary/30 pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-auto"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {loading ? 'Verifying...' : 'Access File'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};