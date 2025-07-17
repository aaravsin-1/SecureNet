
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, File, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileUploaded: (file: any) => void;
}

export const FileUploadDialog = ({ open, onOpenChange, onFileUploaded }: FileUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    if (isPrivate && !accessCode.trim()) {
      toast({
        title: "Access Code Required",
        description: "Please provide an access code for private files",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('secure-files')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('secure-files')
        .getPublicUrl(fileName);

      // Save file metadata to database
      const { data: dbData, error: dbError } = await supabase
        .from('files')
        .insert({
          user_id: user.id,
          name: selectedFile.name,
          size: selectedFile.size,
          url: data.publicUrl,
          is_private: isPrivate,
          access_code: isPrivate ? accessCode : null,
          description: description || null
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const newFile = {
        id: dbData.id,
        name: dbData.name,
        size: dbData.size,
        url: dbData.url,
        isPrivate: dbData.is_private,
        description: dbData.description,
        accessCode: dbData.access_code,
        created_at: dbData.created_at,
        lastModified: new Date(dbData.created_at).getTime()
      };

      onFileUploaded(newFile);

      toast({
        title: "File Uploaded Successfully",
        description: `${selectedFile.name} has been uploaded with ${isPrivate ? 'private' : 'public'} access`,
      });

      // Reset form
      setSelectedFile(null);
      setDescription('');
      setIsPrivate(false);
      setAccessCode('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${selectedFile.name}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Upload File</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            {!selectedFile ? (
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Click to select a file or drag and drop
                </p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="*/*"
                />
                <Button 
                  variant="outline" 
                  className="cursor-pointer"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Choose File
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 p-3 bg-card/50 rounded-lg border">
                <File className="h-6 w-6 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeSelectedFile}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this file..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Privacy Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="privacy">File Access</Label>
              <p className="text-xs text-muted-foreground">
                {isPrivate ? 'Only you can access this file' : 'Anyone can access this file'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="privacy" className="text-sm">
                {isPrivate ? 'Private' : 'Public'}
              </Label>
              <Switch
                id="privacy"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>

          {/* Access Code for Private Files */}
          {isPrivate && (
            <div className="space-y-2">
              <Label htmlFor="accessCode">Access Code *</Label>
              <Input
                id="accessCode"
                type="password"
                placeholder="Enter a secure access code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This code will be required to download the file
              </p>
            </div>
          )}

          {/* Upload Button */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
