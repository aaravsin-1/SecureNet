
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Hash, Users, Shield, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AccessCodeDialog } from './AccessCodeDialog';
import { DeleteChannelDialog } from './DeleteChannelDialog';
import { isAdmin } from '@/utils/adminAuth';

interface ChatRoom {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean | null;
  access_code: string | null;
  delete_code: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  created_at: string | null;
  author_id: string | null;
  profiles?: {
    hacker_id: string;
    display_name: string | null;
  };
}

export const ChatTab = () => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<ChatRoom | null>(null);
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [deleteChannelData, setDeleteChannelData] = useState<{room: ChatRoom} | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState({
    name: '',
    description: '',
    isPrivate: false,
    accessCode: '',
    deleteCode: ''
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  useEffect(() => {
    if (activeRoom) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [activeRoom]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
      if (data && data.length > 0) {
        setActiveRoom(data[0].id);
      }
    } catch (error) {
      toast({
        title: "Access Error",
        description: "Failed to load chat rooms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!activeRoom) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          profiles (
            hacker_id,
            display_name
          )
        `)
        .eq('room_id', activeRoom)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      toast({
        title: "Message Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const subscribeToMessages = () => {
    if (!activeRoom) return;

    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoom}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createChannel = async () => {
    if (!newChannel.name.trim() || !user) return;

    try {
      const { error } = await supabase
        .from('chat_rooms')
        .insert({
          name: newChannel.name.trim(),
          description: newChannel.description.trim() || null,
          is_private: newChannel.isPrivate,
          access_code: newChannel.isPrivate ? newChannel.accessCode.trim() || null : null,
          delete_code: newChannel.deleteCode.trim() || null
        });

      if (error) throw error;

      toast({
        title: "Channel Created",
        description: "New chat channel has been created",
      });

      setNewChannel({ name: '', description: '', isPrivate: false, accessCode: '', deleteCode: '' });
      setIsCreateChannelOpen(false);
      fetchRooms();
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: "Could not create channel",
        variant: "destructive",
      });
    }
  };

  const joinRoom = (room: ChatRoom) => {
    if (room.is_private && room.access_code) {
      setPendingRoom(room);
      setIsAccessDialogOpen(true);
    } else {
      setActiveRoom(room.id);
    }
  };

  const handleAccessGranted = () => {
    if (pendingRoom) {
      setActiveRoom(pendingRoom.id);
      setPendingRoom(null);
    }
  };

  const adminDeleteChannel = async (channelId: string) => {
    if (!user || !isAdmin(user)) {
      toast({
        title: "Access Denied",
        description: "Only administrators can delete channels",
        variant: "destructive"
      });
      return;
    }

    setDeletingChannelId(channelId);
    try {
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', channelId);

      if (error) throw error;

      toast({
        title: "Channel Deleted",
        description: "Chat channel has been permanently removed"
      });
      
      fetchRooms();
      if (activeRoom === channelId) {
        setActiveRoom(null);
      }
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description: "Could not delete channel",
        variant: "destructive"
      });
    } finally {
      setDeletingChannelId(null);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || !user) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: activeRoom,
          author_id: user.id,
          content: newMessage.trim()
        });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Could not send message",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-primary terminal-glow">Connecting to secure channels...</div>
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="grid grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
=======
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-6 h-[calc(100vh-12rem)]">
>>>>>>> parent of 67d0b4a (Visual edit in Lovable)
      {/* Room List */}
      <Card className="col-span-1 bg-card/50 border-primary/30">
        <CardHeader>
          <CardTitle className="text-primary flex items-center justify-between">
            <div className="flex items-center">
              <Hash className="h-5 w-5 mr-2" />
              Channels
            </div>
            <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-background border-primary/30">
                <DialogHeader>
                  <DialogTitle className="text-primary">Create New Channel</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground">Channel Name</label>
                    <Input
                      value={newChannel.name}
                      onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter channel name"
                      className="bg-input border-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <Input
                      value={newChannel.description}
                      onChange={(e) => setNewChannel(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter channel description (optional)"
                      className="bg-input border-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Privacy</label>
                    <Select value={newChannel.isPrivate.toString()} onValueChange={(value) => setNewChannel(prev => ({ ...prev, isPrivate: value === 'true' }))}>
                      <SelectTrigger className="bg-input border-primary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Public Channel</SelectItem>
                        <SelectItem value="true">Private Channel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newChannel.isPrivate && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Access Code</label>
                      <Input
                        type="password"
                        value={newChannel.accessCode}
                        onChange={(e) => setNewChannel(prev => ({ ...prev, accessCode: e.target.value }))}
                        placeholder="Set access code for this channel"
                        className="bg-input border-primary/30"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-foreground">Delete Code</label>
                    <Input
                      type="password"
                      value={newChannel.deleteCode}
                      onChange={(e) => setNewChannel(prev => ({ ...prev, deleteCode: e.target.value }))}
                      placeholder="Set delete code for this channel"
                      className="bg-input border-primary/30"
                    />
                  </div>
                  <Button onClick={createChannel} className="w-full bg-primary hover:bg-primary/90">
                    Create Channel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-full">
            {rooms.map((room) => (
              <div
                key={room.id}
                className={`p-3 border-b border-primary/20 hover:bg-primary/10 transition-colors ${
                  activeRoom === room.id ? 'bg-primary/20' : ''
                }`}
              >
<<<<<<< HEAD
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center space-x-2 cursor-pointer flex-1"
                    onClick={() => joinRoom(room)}
                  >
                    {room.is_private ? (
                      <Shield className="h-4 w-4 text-secondary" />
                    ) : (
                      <Hash className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm font-medium text-foreground">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
=======
                <div className="flex items-center justify-between gap-2">
                  <div 
                    className="flex items-center space-x-2 cursor-pointer flex-1 min-w-0"
                    onClick={() => joinRoom(room)}
                  >
                    {room.is_private ? (
                      <Shield className="h-4 w-4 text-secondary flex-shrink-0" />
                    ) : (
                      <Hash className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-foreground truncate">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
>>>>>>> parent of 67d0b4a (Visual edit in Lovable)
                    {isAdmin(user) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          adminDeleteChannel(room.id);
                        }}
                        disabled={deletingChannelId === room.id}
                        className="p-1 h-auto text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {room.delete_code && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteChannelData({ room });
                        }}
                        className="p-1 h-auto text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {room.description && (
<<<<<<< HEAD
                  <p className="text-xs text-muted-foreground mt-1">{room.description}</p>
=======
                  <p className="text-xs text-muted-foreground mt-1 truncate">{room.description}</p>
>>>>>>> parent of 67d0b4a (Visual edit in Lovable)
                )}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="col-span-3 bg-card/50 border-primary/30 flex flex-col">
        <CardHeader>
          <CardTitle className="text-primary flex items-center">
            <Hash className="h-5 w-5 mr-2" />
            {rooms.find(r => r.id === activeRoom)?.name || 'Select a channel'}
            <Users className="h-4 w-4 ml-auto text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
<<<<<<< HEAD
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex space-x-3">
                  <div className="flex-1">
=======
          <ScrollArea className="flex-1 p-2 lg:p-4">
            <div className="space-y-3 lg:space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="flex space-x-2 lg:space-x-3">
                  <div className="flex-1 min-w-0">
>>>>>>> parent of 67d0b4a (Visual edit in Lovable)
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-primary">
                        {message.profiles?.hacker_id || 'Anonymous'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-primary/30">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a secure message..."
<<<<<<< HEAD
                className="flex-1 bg-input border-primary/30 focus:border-primary"
              />
              <Button type="submit" className="bg-primary hover:bg-primary/90">
=======
                className="flex-1 bg-input border-primary/30 focus:border-primary text-sm"
              />
              <Button type="submit" className="bg-primary hover:bg-primary/90 px-3">
>>>>>>> parent of 67d0b4a (Visual edit in Lovable)
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <AccessCodeDialog
        isOpen={isAccessDialogOpen}
        onClose={() => {
          setIsAccessDialogOpen(false);
          setPendingRoom(null);
        }}
        onSuccess={handleAccessGranted}
        title="Channel Access Required"
        description="This private channel requires an access code."
        expectedCode={pendingRoom?.access_code || ''}
        isPrivate={true}
      />

      {deleteChannelData && (
        <DeleteChannelDialog
          isOpen={true}
          onClose={() => setDeleteChannelData(null)}
          onSuccess={() => {
            fetchRooms();
            if (activeRoom === deleteChannelData.room.id) {
              setActiveRoom(null);
            }
          }}
          channelId={deleteChannelData.room.id}
          channelName={deleteChannelData.room.name}
          deleteCode={deleteChannelData.room.delete_code || ''}
        />
      )}
    </div>
  );
};
