
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user profiles table with unique hacker IDs
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  hacker_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  reputation INTEGER DEFAULT 0,
  security_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create topics table (like subreddits)
CREATE TABLE public.topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  security_level INTEGER DEFAULT 1,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'file', 'link')),
  file_url TEXT,
  vote_score INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  vote_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat rooms table
CREATE TABLE public.chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table
CREATE TABLE public.votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  vote_type INTEGER CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id),
  CHECK ((post_id IS NULL) != (comment_id IS NULL))
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to check user security level
CREATE OR REPLACE FUNCTION public.get_user_security_level()
RETURNS INTEGER AS $$
  SELECT COALESCE(security_level, 0) FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for topics
CREATE POLICY "Users can view topics based on security level" ON public.topics 
  FOR SELECT USING (public.get_user_security_level() >= security_level);
CREATE POLICY "Authenticated users can create topics" ON public.topics 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Topic creators can update their topics" ON public.topics 
  FOR UPDATE USING (auth.uid() = creator_id);

-- RLS Policies for posts
CREATE POLICY "Users can view posts in accessible topics" ON public.posts 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.topics 
      WHERE topics.id = posts.topic_id 
      AND public.get_user_security_level() >= topics.security_level
    )
  );
CREATE POLICY "Authenticated users can create posts" ON public.posts 
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their posts" ON public.posts 
  FOR UPDATE USING (auth.uid() = author_id);

-- RLS Policies for comments
CREATE POLICY "Users can view comments on accessible posts" ON public.comments 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.topics t ON p.topic_id = t.id
      WHERE p.id = comments.post_id 
      AND public.get_user_security_level() >= t.security_level
    )
  );
CREATE POLICY "Authenticated users can create comments" ON public.comments 
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update their comments" ON public.comments 
  FOR UPDATE USING (auth.uid() = author_id);

-- RLS Policies for chat rooms
CREATE POLICY "Users can view chat rooms based on topic access" ON public.chat_rooms 
  FOR SELECT USING (
    NOT is_private OR EXISTS (
      SELECT 1 FROM public.topics 
      WHERE topics.id = chat_rooms.topic_id 
      AND public.get_user_security_level() >= topics.security_level
    )
  );

-- RLS Policies for chat messages
CREATE POLICY "Users can view messages in accessible rooms" ON public.chat_messages 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms cr
      LEFT JOIN public.topics t ON cr.topic_id = t.id
      WHERE cr.id = chat_messages.room_id 
      AND (NOT cr.is_private OR public.get_user_security_level() >= COALESCE(t.security_level, 1))
    )
  );
CREATE POLICY "Authenticated users can send messages" ON public.chat_messages 
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- RLS Policies for votes
CREATE POLICY "Users can view all votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Users can create their own votes" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own votes" ON public.votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own votes" ON public.votes FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, hacker_id, display_name)
  VALUES (
    NEW.id,
    'hckr_' || LOWER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Anonymous Hacker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for secure file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('secure-files', 'secure-files', false);

-- Storage policies for secure file access
CREATE POLICY "Authenticated users can upload files" ON storage.objects 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND bucket_id = 'secure-files');

CREATE POLICY "Users can view files they uploaded" ON storage.objects 
  FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'secure-files');

CREATE POLICY "Users can update their own files" ON storage.objects 
  FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'secure-files');

CREATE POLICY "Users can delete their own files" ON storage.objects 
  FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'secure-files');

-- Enable realtime for chat
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.comments REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
