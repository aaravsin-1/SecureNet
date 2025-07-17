-- Allow topic deletion by authenticated users (with admin check in application layer)
CREATE POLICY "Authenticated users can delete topics" 
ON public.topics 
FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL);