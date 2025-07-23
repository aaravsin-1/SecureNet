-- Add delete policy for posts to allow authors and admin to delete
CREATE POLICY "Authors and admin can delete posts" 
ON public.posts 
FOR DELETE 
TO authenticated
USING (
  -- Post author can delete their own posts
  (auth.uid() = author_id)
  OR
  -- Admin can delete any post
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND display_name = 'aaravsinghal2005@gmail.com'
  ))
);