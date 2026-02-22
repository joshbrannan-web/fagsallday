
ALTER TABLE public.profiles 
ADD COLUMN ghin_number TEXT NULL,
ADD COLUMN ghin_last_synced TIMESTAMPTZ NULL;
