import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, MessageSquare, Shield, Lock, Terminal, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TopicDetail } from './TopicDetail';
import { AccessCodeDialog } from './AccessCodeDialog';
import { isAdmin } from '@/utils/adminAuth';
import { encryptObject, decryptObject, generateSharedKey } from '@/utils/encryption';
interface Topic {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  creator_id: string | null;
  security_level: number | null;
  member_count: number | null;
  created_at: string | null;
  access_code: string | null;
}
export const TopicsTab = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [pendingTopic, setPendingTopic] = useState<Topic | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({
    title: '',
    description: '',
    securityLevel: '1',
    accessCode: ''
  });
  const { user, encryptionKey } = useAuth();
  const {
    toast
  } = useToast();
  useEffect(() => {
    if (user && encryptionKey) {
      fetchTopics();
    }
  }, [user, encryptionKey]);
  const fetchTopics = async () => {
    if (!encryptionKey) return;
    
    try {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Decrypt sensitive data using topic-specific keys
      const decryptedTopics = await Promise.all(
        (data || []).map(async (topic) => {
          const topicKey = await generateSharedKey(`topic_${topic.id}`);
          return await decryptObject(topic, ['title', 'description'], topicKey);
        })
      );
      
      setTopics(decryptedTopics);
    } catch (error) {
      toast({
        title: "Access Error",
        description: "Failed to load topics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const createTopic = async () => {
    if (!newTopic.title.trim() || !user || !encryptionKey) return;
    
    try {
      const slug = newTopic.title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const securityLevel = parseInt(newTopic.securityLevel);
      
      // First create the topic to get its ID
      const { data: createdTopic, error: createError } = await supabase.from('topics').insert({
        slug: `${slug}-${Date.now()}`,
        creator_id: user.id,
        security_level: securityLevel,
        access_code: securityLevel > 1 ? newTopic.accessCode.trim() || null : null,
        title: 'temp', // temporary placeholder
        description: 'temp' // temporary placeholder
      }).select().single();
      
      if (createError) throw createError;
      
      // Now encrypt and update with the topic-specific key
      const topicKey = await generateSharedKey(`topic_${createdTopic.id}`);
      const encryptedData = await encryptObject(
        {
          title: newTopic.title.trim(),
          description: newTopic.description.trim() || null,
        },
        ['title', 'description'],
        topicKey
      );
      
      const { error: updateError } = await supabase.from('topics')
        .update(encryptedData)
        .eq('id', createdTopic.id);
      
      if (updateError) throw updateError;
      
      toast({
        title: "Topic Created",
        description: "New discussion topic has been created"
      });
      
      setNewTopic({
        title: '',
        description: '',
        securityLevel: '1',
        accessCode: ''
      });
      setIsCreateDialogOpen(false);
      fetchTopics();
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: "Could not create topic",
        variant: "destructive"
      });
    }
  };
  const joinTopic = (topic: Topic) => {
    if (topic.security_level && topic.security_level > 1 && topic.access_code) {
      setPendingTopic(topic);
      setIsAccessDialogOpen(true);
    } else {
      setSelectedTopic(topic);
    }
  };
  const handleAccessGranted = () => {
    if (pendingTopic) {
      setSelectedTopic(pendingTopic);
      setPendingTopic(null);
    }
  };

  const deleteTopic = async (topicId: string) => {
    if (!user || !isAdmin(user)) {
      toast({
        title: "Access Denied",
        description: "Only administrators can delete topics",
        variant: "destructive"
      });
      return;
    }

    setDeletingTopicId(topicId);
    try {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;

      toast({
        title: "Topic Deleted",
        description: "Discussion topic has been permanently removed"
      });
      
      fetchTopics();
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: "Could not delete topic",
        variant: "destructive"
      });
    } finally {
      setDeletingTopicId(null);
    }
  };
  const getSecurityBadge = (level: number) => {
    const levels = {
      1: {
        label: "PUBLIC",
        color: "bg-primary",
        icon: Users
      },
      2: {
        label: "RESTRICTED",
        color: "bg-secondary",
        icon: Shield
      },
      3: {
        label: "CLASSIFIED",
        color: "bg-destructive",
        icon: Lock
      }
    };
    const config = levels[level as keyof typeof levels] || levels[1];
    const IconComponent = config.icon;
    return <Badge className={`${config.color} text-white`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>;
  };
  if (selectedTopic) {
    return <TopicDetail topic={selectedTopic} onBack={() => setSelectedTopic(null)} />;
  }
  if (loading) {
    return <div className="flex justify-center items-center h-64">
        <div className="text-primary terminal-glow">Loading secure channels...</div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-primary terminal-glow">Discussion Topics</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Topic
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border-primary/30 mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-primary">Create New Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input value={newTopic.title} onChange={e => setNewTopic(prev => ({
                ...prev,
                title: e.target.value
              }))} placeholder="Enter topic title" className="bg-input border-primary/30" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea value={newTopic.description} onChange={e => setNewTopic(prev => ({
                ...prev,
                description: e.target.value
              }))} placeholder="Enter topic description (optional)" className="bg-input border-primary/30 min-h-20" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Security Level</label>
                <Select value={newTopic.securityLevel} onValueChange={value => setNewTopic(prev => ({
                ...prev,
                securityLevel: value
              }))}>
                  <SelectTrigger className="bg-input border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-primary/30">
                    <SelectItem value="1">PUBLIC - Anyone can access</SelectItem>
                    <SelectItem value="2">RESTRICTED - Limited access</SelectItem>
                    <SelectItem value="3">CLASSIFIED - Highest security</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {parseInt(newTopic.securityLevel) > 1 && <div>
                  <label className="text-sm font-medium text-foreground">Access Code</label>
                  <Input type="password" value={newTopic.accessCode} onChange={e => setNewTopic(prev => ({
                ...prev,
                accessCode: e.target.value
              }))} placeholder="Set access code for this topic" className="bg-input border-primary/30" />
                </div>}
              <Button onClick={createTopic} className="w-full bg-primary hover:bg-primary/90">
                Create Topic
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {topics.map(topic => <Card key={topic.id} className="bg-card/50 border-primary/30 hover:border-primary/50 transition-colors security-indicator">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-primary text-base sm:text-lg truncate">
                    {topic.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getSecurityBadge(topic.security_level || 1)}
                  {isAdmin(user) && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTopic(topic.id);
                      }}
                      size="sm"
                      variant="destructive"
                      disabled={deletingTopicId === topic.id}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription className="text-muted-foreground text-sm line-clamp-2">
                {topic.description || "No description available"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{topic.member_count || 0}</span>
                  </div>
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    <span>0 posts</span>
                  </div>
                  <div className="text-xs">
                    {topic.created_at ? new Date(topic.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
                <Button onClick={() => joinTopic(topic)} size="sm" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-xs sm:text-sm">
                  {topic.security_level && topic.security_level > 1 && topic.access_code ? 'Enter Code' : 'Join'}
                </Button>
              </div>
            </CardContent>
          </Card>)}
      </div>

      {topics.length === 0 && <div className="text-center py-12">
          <Terminal className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Topics Found</h3>
          <p className="text-muted-foreground mb-4">Be the first to create a discussion topic</p>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Create First Topic
          </Button>
        </div>}

      <AccessCodeDialog isOpen={isAccessDialogOpen} onClose={() => {
      setIsAccessDialogOpen(false);
      setPendingTopic(null);
    }} onSuccess={handleAccessGranted} title="Access Required" description={`This ${pendingTopic?.security_level === 3 ? 'classified' : 'restricted'} topic requires an access code.`} expectedCode={pendingTopic?.access_code || ''} isPrivate={pendingTopic?.security_level === 2} />
    </div>;
};