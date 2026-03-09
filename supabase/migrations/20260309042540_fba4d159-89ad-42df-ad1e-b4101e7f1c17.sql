
-- Create tournament_admin_requests table
CREATE TABLE public.tournament_admin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.tournament_admin_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own request
CREATE POLICY "Users can request tournament admin"
ON public.tournament_admin_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can read their own request
CREATE POLICY "Users can view own request"
ON public.tournament_admin_requests
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- App admins can read all requests
CREATE POLICY "Admins can view all requests"
ON public.tournament_admin_requests
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- App admins can update requests (approve/deny)
CREATE POLICY "Admins can update requests"
ON public.tournament_admin_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- App admins can delete requests
CREATE POLICY "Admins can delete requests"
ON public.tournament_admin_requests
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
