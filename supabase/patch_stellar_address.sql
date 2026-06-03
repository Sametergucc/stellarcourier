-- Kullanıcıların Stellar public key'ini sakla (kuryeler için görünür)
alter table public.users add column if not exists stellar_address text;

-- Kuryeler için realtime (kurye paneli anlık paket görür)
alter publication supabase_realtime add table public.deliveries;
