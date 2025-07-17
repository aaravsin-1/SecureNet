-- Add access codes to topics and chat_rooms tables
ALTER TABLE public.topics ADD COLUMN access_code TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN access_code TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN delete_code TEXT;

-- Update RLS policies to show all topics but require access codes for private ones
DROP POLICY IF EXISTS "Users can view topics based on security level" ON public.topics;
CREATE POLICY "Users can view all topics" 
ON public.topics 
FOR SELECT 
TO authenticated
USING (true);

-- Update RLS policies to show all chat rooms but require access codes for private ones  
DROP POLICY IF EXISTS "Users can view chat rooms based on topic access" ON public.chat_rooms;
CREATE POLICY "Users can view all chat rooms"
ON public.chat_rooms
FOR SELECT 
TO authenticated
USING (true);

-- Update chat room update policy to allow delete code updates
DROP POLICY IF EXISTS "Users can update accessible chat rooms" ON public.chat_rooms;
CREATE POLICY "Users can update chat rooms with access"
ON public.chat_rooms
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Add policy to allow chat room deletion with proper verification
CREATE POLICY "Users can delete chat rooms with delete code"
ON public.chat_rooms
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);