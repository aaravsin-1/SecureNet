import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Plus, 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Reply, 
  Users, 
  Shield, 
  Lock,
  Send,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { encryptObject, decryptObject, generateSharedKey } from '@/utils/encryption';
import { isAdmin } from '@/utils/adminAuth';

interface Topic {
  id: string;
  title: string;
  description: string | null;
  security_level: number | null;
  member_count: number | null;
  created_at: string | null;
}

interface Post {
  id: string;
  title: string;
  content: string | null;
  author_id: string | null;
  vote_score: number | null;
  comment_count: number | null;
  created_at: string | null;
  profiles?: {
    hacker_id: string;
    display_name: string | null;
  };
}

interface Comment {
  id: string;
  content: string;
  parent_id: string | null;
  author_id: string | null;
  vote_score: number | null;
  created_at: string | null;
  profiles?: {
    hacker_id: string;
    display_name: string | null;
  };
}

interface TopicDetailProps {
  topic: Topic;
  onBack: () => void;
}

export const TopicDetail = ({ topic, onBack }: TopicDetailProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { user, encryptionKey } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && encryptionKey) {
      fetchPosts();
    }
  }, [user, encryptionKey, topic.id]);

  const fetchPosts = async () => {
    if (!encryptionKey) return;
    
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            hacker_id,
            display_name
          )
        `)
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Posts fetch error:', error);
        throw error;
      }

      // Calculate vote scores and decrypt posts using topic-specific key
      const topicKey = await generateSharedKey(`topic_${topic.id}`);
      const postsWithVotes = await Promise.all(
        (data || []).map(async (post) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('vote_type')
            .eq('post_id', post.id);
          
          const voteScore = votes?.reduce((sum, vote) => sum + (vote.vote_type || 0), 0) || 0;
          
          const { data: commentCount } = await supabase
            .from('comments')
            .select('id', { count: 'exact' })
            .eq('post_id', post.id);
          
          // Decrypt post content
          const decryptedPost = await decryptObject(post, ['title', 'content'], topicKey);
          
          return {
            ...decryptedPost,
            vote_score: voteScore,
            comment_count: commentCount?.length || 0
          };
        })
      );

      setPosts(postsWithVotes);
    } catch (error) {
      toast({
        title: "Access Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    if (!encryptionKey) return;
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            hacker_id,
            display_name
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate vote scores and decrypt comments using topic-specific key
      const topicKey = await generateSharedKey(`topic_${topic.id}`);
      const commentsWithVotes = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: votes } = await supabase
            .from('votes')
            .select('vote_type')
            .eq('comment_id', comment.id);
          
          const voteScore = votes?.reduce((sum, vote) => sum + (vote.vote_type || 0), 0) || 0;
          
          // Decrypt comment content
          const decryptedComment = await decryptObject(comment, ['content'], topicKey);
          
          return {
            ...decryptedComment,
            vote_score: voteScore
          };
        })
      );

      setComments(prev => ({ ...prev, [postId]: commentsWithVotes }));
    } catch (error) {
      toast({
        title: "Load Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    }
  };

  const createPost = async () => {
    if (!newPost.title.trim() || !user || !encryptionKey) return;

    try {
      // Encrypt post content using topic-specific key
      const topicKey = await generateSharedKey(`topic_${topic.id}`);
      const encryptedData = await encryptObject(
        {
          title: newPost.title.trim(),
          content: newPost.content.trim() || null,
        },
        ['title', 'content'],
        topicKey
      );
      
      const { error } = await supabase
        .from('posts')
        .insert({
          ...encryptedData,
          topic_id: topic.id,
          author_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Post Created",
        description: "Your post has been published",
      });

      setNewPost({ title: '', content: '' });
      setIsCreatePostOpen(false);
      // Refresh posts immediately
      await fetchPosts();
    } catch (error) {
      toast({
        title: "Post Failed",
        description: "Could not create post",
        variant: "destructive",
      });
    }
  };

  const createComment = async (postId: string, parentId?: string) => {
    if (!newComment.trim() || !user || !encryptionKey) return;

    try {
      // Encrypt comment content using topic-specific key
      const topicKey = await generateSharedKey(`topic_${topic.id}`);
      const encryptedData = await encryptObject(
        { content: newComment.trim() },
        ['content'],
        topicKey
      );
      
      const { error } = await supabase
        .from('comments')
        .insert({
          content: encryptedData.content,
          post_id: postId,
          parent_id: parentId || null,
          author_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Comment Posted",
        description: "Your comment has been added",
      });

      setNewComment('');
      setReplyTo(null);
      fetchComments(postId);
    } catch (error) {
      toast({
        title: "Comment Failed",
        description: "Could not post comment",
        variant: "destructive",
      });
    }
  };

  const deletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Post Deleted",
        description: "The post has been permanently removed",
      });

      fetchPosts();
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the post",
        variant: "destructive",
      });
    }
  };

  const vote = async (type: 'post' | 'comment', id: string, voteType: number) => {
    if (!user) return;

    try {
      // Check if user already voted
      const { data: existingVote, error: voteError } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', user.id)
        .eq(type === 'post' ? 'post_id' : 'comment_id', id)
        .maybeSingle();

      if (voteError && voteError.code !== 'PGRST116') {
        throw voteError;
      }

      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote if clicking same button
          const { error: deleteError } = await supabase
            .from('votes')
            .delete()
            .eq('id', existingVote.id);
          
          if (deleteError) throw deleteError;
        } else {
          // Update vote type
          const { error: updateError } = await supabase
            .from('votes')
            .update({ vote_type: voteType })
            .eq('id', existingVote.id);
            
          if (updateError) throw updateError;
        }
      } else {
        // Create new vote
        const { error: insertError } = await supabase
          .from('votes')
          .insert({
            user_id: user.id,
            [type === 'post' ? 'post_id' : 'comment_id']: id,
            vote_type: voteType
          });
          
        if (insertError) throw insertError;
      }

      // Refresh data
      if (type === 'post') {
        fetchPosts();
      } else if (selectedPost) {
        fetchComments(selectedPost);
      }
      
      toast({
        title: "Vote Registered",
        description: `Your ${voteType === 1 ? 'upvote' : 'downvote'} has been recorded`,
      });
    } catch (error) {
      console.error('Vote error:', error);
      toast({
        title: "Vote Failed",
        description: "Could not register vote",
        variant: "destructive",
      });
    }
  };

  const getSecurityBadge = (level: number) => {
    const levels = {
      1: { label: "PUBLIC", color: "bg-primary", icon: Users },
      2: { label: "RESTRICTED", color: "bg-secondary", icon: Shield },
      3: { label: "CLASSIFIED", color: "bg-destructive", icon: Lock },
    };
    
    const config = levels[level as keyof typeof levels] || levels[1];
    const IconComponent = config.icon;
    
    return (
      <Badge className={`${config.color} text-white`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const toggleComments = (postId: string) => {
    if (selectedPost === postId) {
      setSelectedPost(null);
    } else {
      setSelectedPost(postId);
      if (!comments[postId]) {
        fetchComments(postId);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-primary terminal-glow">Loading secure content...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <Button variant="outline" onClick={onBack} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Topics
          </Button>
          <div className="min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <h2 className="text-xl sm:text-2xl font-bold text-primary terminal-glow truncate">{topic.title}</h2>
              {getSecurityBadge(topic.security_level || 1)}
            </div>
            {topic.description && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{topic.description}</p>
            )}
          </div>
        </div>
        
        <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-background border-primary/30 mx-4 max-w-md">{/* Made responsive */}
            <DialogHeader>
              <DialogTitle className="text-primary">Create New Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={newPost.title}
                  onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter post title"
                  className="bg-input border-primary/30"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Content</label>
                <Textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter post content (optional)"
                  className="bg-input border-primary/30 min-h-20"
                />
              </div>
              <Button onClick={createPost} className="w-full bg-primary hover:bg-primary/90">
                Create Post
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="bg-card/50 border-primary/30">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-primary text-base sm:text-lg break-words">{post.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                    <span>{post.profiles?.hacker_id || 'Anonymous'}</span>
                    <span>•</span>
                    <span>{post.created_at ? new Date(post.created_at).toLocaleString() : 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">{/* Made responsive voting */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => vote('post', post.id, 1)}
                    className="text-muted-foreground hover:text-primary h-8 w-8 p-0"
                  >
                    <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground min-w-6 text-center">{post.vote_score || 0}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => vote('post', post.id, -1)}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  {(user?.id === post.author_id || isAdmin(user)) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deletePost(post.id)}
                      className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {post.content && (
                <p className="text-foreground mb-4 text-sm sm:text-base break-words">{post.content}</p>
              )}
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleComments(post.id)}
                  className="text-muted-foreground w-full sm:w-auto text-xs sm:text-sm"
                >
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  {selectedPost === post.id ? 'Hide' : 'Show'} Comments ({post.comment_count || 0})
                </Button>
              </div>

              {/* Comments Section */}
              {selectedPost === post.id && (
                <div className="mt-4 space-y-4 border-t border-primary/20 pt-4">
                  {/* New Comment */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 bg-input border-primary/30 text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && createComment(post.id)}
                    />
                    <Button
                      onClick={() => createComment(post.id)}
                      disabled={!newComment.trim()}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                    >
                      <Send className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Send</span>
                    </Button>
                  </div>

                  {/* Comments List */}
                  <ScrollArea className="max-h-64">{/* Kept max height */}
                    <div className="space-y-3">
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="bg-muted/30 p-3 rounded border-l-2 border-primary/30">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-1">
                                <span className="font-medium text-primary">
                                  {comment.profiles?.hacker_id || 'Anonymous'}
                                </span>
                                <span>•</span>
                                <span>{comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown'}</span>
                              </div>
                              <p className="text-foreground text-sm">{comment.content}</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => vote('comment', comment.id, 1)}
                                className="text-muted-foreground hover:text-primary h-6 w-6 p-0"
                              >
                                <ThumbsUp className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground">{comment.vote_score || 0}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => vote('comment', comment.id, -1)}
                                className="text-muted-foreground hover:text-destructive h-6 w-6 p-0"
                              >
                                <ThumbsDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Posts Yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to start a discussion in this topic</p>
          <Button onClick={() => setIsCreatePostOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Create First Post
          </Button>
        </div>
      )}
    </div>
  );
};