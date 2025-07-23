-- Update the posts RLS policy to allow authors to see their own posts
DROP POLICY IF EXISTS "Users can view posts in accessible topics" ON public.posts;

CREATE POLICY "Users can view posts in accessible topics or their own posts" 
ON public.posts 
FOR SELECT 
TO authenticated
USING (
  -- User can see posts in topics they have access to
  (EXISTS ( 
    SELECT 1
    FROM topics
    WHERE ((topics.id = posts.topic_id) AND (get_user_security_level() >= topics.security_level))
  ))
  OR
  -- OR user can see their own posts regardless of topic security level
  (auth.uid() = author_id)
);