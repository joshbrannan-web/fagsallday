-- Create profiles table for user data including handicap
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  handicap_index NUMERIC(4,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved_players table for additional players
CREATE TABLE public.saved_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handicap_index NUMERIC(4,1) DEFAULT 0,
  tee TEXT DEFAULT 'White',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved_courses table
CREATE TABLE public.saved_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rounds table for game history
CREATE TABLE public.rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_data JSONB NOT NULL,
  players_data JSONB NOT NULL,
  games_data JSONB NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  game_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'SETUP',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Saved players policies
CREATE POLICY "Users can view their own saved players"
ON public.saved_players FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved players"
ON public.saved_players FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved players"
ON public.saved_players FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved players"
ON public.saved_players FOR DELETE
USING (auth.uid() = user_id);

-- Saved courses policies
CREATE POLICY "Users can view their own saved courses"
ON public.saved_courses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved courses"
ON public.saved_courses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved courses"
ON public.saved_courses FOR DELETE
USING (auth.uid() = user_id);

-- Rounds policies
CREATE POLICY "Users can view their own rounds"
ON public.rounds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rounds"
ON public.rounds FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rounds"
ON public.rounds FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rounds"
ON public.rounds FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_players_updated_at
BEFORE UPDATE ON public.saved_players
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rounds_updated_at
BEFORE UPDATE ON public.rounds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handicap_index)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'handicap_index')::numeric, 0)
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();