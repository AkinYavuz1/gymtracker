-- Add DELETE RLS policy to profiles table to allow account deletion
CREATE POLICY "Users delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);
