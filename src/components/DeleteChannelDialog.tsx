import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DeleteChannelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  channelId: string;
  channelName: string;
  deleteCode: string;
}

export const DeleteChannelDialog = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  channelId, 
  channelName,
  deleteCode 
}: DeleteChannelDialogProps) => {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (code.trim() !== deleteCode) {
        toast({
          title: "Deletion Failed",
          description: "Invalid delete code",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', channelId);

      if (error) throw error;

      toast({
        title: "Channel Deleted",
        description: `${channelName} has been permanently deleted`,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Deletion Error",
        description: "Could not delete channel",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setShowCode(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center">
            <Trash2 className="h-5 w-5 mr-2" />
            Delete Channel
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-destructive/10 rounded border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Warning</p>
              <p className="text-sm text-destructive/90">
                This will permanently delete "{channelName}" and all its messages.
              </p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showCode ? 'text' : 'password'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter delete code"
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
                variant="destructive"
                className="flex-1"
              >
                {loading ? 'Deleting...' : 'Delete Channel'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};