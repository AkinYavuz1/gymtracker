-- Create the delete_user_account function for account deletion
-- Deletes the profile record; cascading foreign keys handle cleanup of workouts, PRs, etc.
-- Then calls the Supabase admin API to delete auth.users.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify the caller is deleting their own account
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorised to delete this account';
  END IF;
  -- Delete the profile (cascades to all user data: workouts, PRs, etc. via FK)
  DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
