
-- Add RLS policy to allow authenticated users to create chat rooms
CREATE POLICY "Authenticated users can create chat rooms" 
ON public.chat_rooms 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Add RLS policy to allow authenticated users to update chat rooms they can access
CREATE POLICY "Users can update accessible chat rooms" 
ON public.chat_rooms 
FOR UPDATE 
USING (
  NOT is_private OR EXISTS (
    SELECT 1 FROM topics 
    WHERE topics.id = chat_rooms.topic_id 
    AND get_user_security_level() >= topics.security_level
  )
);
