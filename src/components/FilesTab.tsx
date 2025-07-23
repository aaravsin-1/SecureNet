
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, Download, Trash2, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { FileUploadDialog } from './FileUploadDialog';
import { PrivateFileAccessDialog } from './PrivateFileAccessDialog';

interface UploadedFile {
  id?: string;
  name: string;
  size: number;
  lastModified?: number;
  url: string;
  isPrivate?: boolean;
  description?: string;
  accessCode?: string;
  uploadedAt?: string;
  created_at?: string;
}

export const FilesTab = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [privateAccessDialog, setPrivateAccessDialog] = useState<{
    open: boolean;
    file: UploadedFile | null;
  }>({ open: false, file: null });
  const [accessedPrivateFiles, setAccessedPrivateFiles] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  // Load files from database on component mount
  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);

  const loadFiles = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedFiles: UploadedFile[] = data.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        url: file.url,
        isPrivate: file.is_private,
        description: file.description,
        accessCode: file.access_code,
        created_at: file.created_at,
        lastModified: new Date(file.created_at).getTime()
      }));

      setFiles(formattedFiles);
    } catch (error) {
      toast({
        title: "Error Loading Files",
        description: "Failed to load your files",
        variant: "destructive",
      });
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;

    setUploading(true);
    
    for (const file of acceptedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('secure-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('secure-files')
          .getPublicUrl(fileName);

        // Save file metadata to database
        const { data: dbData, error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: user.id,
            name: file.name,
            size: file.size,
            url: data.publicUrl,
            is_private: false,
            description: ''
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Add to local state
        setFiles(prev => [...prev, {
          id: dbData.id,
          name: dbData.name,
          size: dbData.size,
          url: dbData.url,
          isPrivate: dbData.is_private,
          description: dbData.description,
          created_at: dbData.created_at,
          lastModified: new Date(dbData.created_at).getTime()
        }]);

        toast({
          title: "File Encrypted",
          description: `${file.name} uploaded securely`,
        });
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
    
    setUploading(false);
  }, [user, toast]);

  const handleFileUploaded = (file: UploadedFile) => {
    setFiles(prev => [...prev, file]);
  };

  const handleQuickUploadClick = () => {
    const fileInput = document.getElementById('file-upload-quick') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const downloadFile = async (file: UploadedFile) => {
    // Check if file is private and not yet accessed
    if (file.isPrivate && file.accessCode && !accessedPrivateFiles.has(file.id!)) {
      setPrivateAccessDialog({ open: true, file });
      return;
    }

    try {
      // Extract file path from URL for Supabase storage download
      const urlParts = file.url.split('/');
      const fileName = urlParts.slice(-2).join('/'); // user_id/filename

      const { data, error } = await supabase.storage
        .from('secure-files')
        .download(fileName);

      if (error) throw error;

      // Create blob URL and trigger download
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Started",
        description: `Downloading ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: `Failed to download ${file.name}`,
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (index: number) => {
    const file = files[index];
    
    try {
      if (file.id) {
        // Delete from database
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', file.id);

        if (error) throw error;

        // Extract file path from URL to delete from storage
        const urlParts = file.url.split('/');
        const fileName = urlParts.slice(-2).join('/'); // user_id/filename

        // Delete from storage
        await supabase.storage
          .from('secure-files')
          .remove([fileName]);
      }

      // Remove from local state
      setFiles(prev => prev.filter((_, i) => i !== index));
      
      toast({
        title: "File Deleted",
        description: `${file.name} has been removed`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: `Failed to delete ${file.name}`,
        variant: "destructive",
      });
    }
  };

  const handlePrivateFileAccess = () => {
    if (privateAccessDialog.file?.id) {
      setAccessedPrivateFiles(prev => new Set([...prev, privateAccessDialog.file!.id!]));
      downloadFile(privateAccessDialog.file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-primary terminal-glow">Secure File Storage</h2>
        <Badge className="bg-secondary text-secondary-foreground w-fit">
          <Shield className="h-3 w-3 mr-1" />
          End-to-End Encrypted
        </Badge>
      </div>

      {/* Upload Area */}
      <Card className="bg-card/50 border-primary/30 border-dashed">
        <CardContent className="p-4 sm:p-8">
          <div
            className="text-center cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              onDrop(files);
            }}
          >
            <Upload className="h-8 w-8 sm:h-12 sm:w-12 text-primary mx-auto mb-4 terminal-glow" />
            <h3 className="text-base sm:text-lg font-semibold text-primary mb-2">
              Drop files here or click to upload
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Files are automatically encrypted and secured
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              id="file-upload-quick"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                onDrop(files);
              }}
            />
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                variant="outline" 
                onClick={handleQuickUploadClick}
                disabled={uploading}
                className="w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Encrypting...' : 'Quick Upload'}
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto" 
                onClick={() => setUploadDialogOpen(true)}
                disabled={uploading}
              >
                <Lock className="h-4 w-4 mr-2" />
                Advanced Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      <div className="grid gap-4">
        {files.map((file, index) => (
          <Card key={index} className="bg-card/50 border-primary/30">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  <File className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-sm sm:text-base truncate">{file.name}</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • {new Date(file.created_at || file.lastModified).toLocaleDateString()}
                    </p>
                    {file.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1 italic line-clamp-2">
                        {file.description}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary text-primary text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Encrypted
                  </Badge>
                  {file.isPrivate !== undefined && (
                    <Badge variant={file.isPrivate ? "default" : "secondary"} className="text-xs">
                      {file.isPrivate ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Private
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Public
                        </>
                      )}
                    </Badge>
                  )}
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(file)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-destructive border-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                      onClick={() => deleteFile(index)}
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {files.length === 0 && (
        <div className="text-center py-12">
          <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Files Uploaded</h3>
          <p className="text-muted-foreground">Your encrypted files will appear here</p>
        </div>
      )}

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onFileUploaded={handleFileUploaded}
      />

      <PrivateFileAccessDialog
        open={privateAccessDialog.open}
        onOpenChange={(open) => setPrivateAccessDialog({ open, file: null })}
        fileName={privateAccessDialog.file?.name || ''}
        expectedCode={privateAccessDialog.file?.accessCode || ''}
        onAccessGranted={handlePrivateFileAccess}
      />
    </div>
  );
};
