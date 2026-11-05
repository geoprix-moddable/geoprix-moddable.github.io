-- GeoPrix Moddable forum: database setup for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run again: it only creates what is missing and replaces functions/policies.

-- ---------- profiles (one per signed-up user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (char_length(username) between 3 and 20 and username ~ '^[A-Za-z0-9_]+$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- usernames are unique ignoring case ("Bob" and "bob" can't both exist)
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ---------- threads ----------
create table if not exists public.threads (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  category text not null default 'general'
    check (category in ('announcements', 'general', 'help', 'ideas', 'show')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  pinned boolean not null default false,
  locked boolean not null default false,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists threads_activity_idx on public.threads (pinned desc, last_activity_at desc);
create index if not exists threads_category_idx on public.threads (category);

-- ---------- replies ----------
create table if not exists public.replies (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index if not exists replies_thread_idx on public.replies (thread_id, created_at);

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Make a profile when someone signs up (username comes from the sign-up form).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep reply_count / last_activity_at up to date.
create or replace function public.bump_thread()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.threads
      set reply_count = reply_count + 1, last_activity_at = now()
      where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.threads
      set reply_count = greatest(reply_count - 1, 0)
      where id = old.thread_id;
  end if;
  return null;
end;
$$;
drop trigger if exists replies_bump on public.replies;
create trigger replies_bump
  after insert or delete on public.replies
  for each row execute function public.bump_thread();

-- Simple spam brake: at most 5 posts (threads + replies) per user per minute.
create or replace function public.rate_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  recent integer;
begin
  select
    (select count(*) from public.threads where author_id = auth.uid() and created_at > now() - interval '1 minute')
  + (select count(*) from public.replies where author_id = auth.uid() and created_at > now() - interval '1 minute')
  into recent;
  if recent >= 5 then
    raise exception 'Slow down: you can post 5 times a minute.';
  end if;
  return new;
end;
$$;
drop trigger if exists threads_rate_limit on public.threads;
create trigger threads_rate_limit before insert on public.threads
  for each row execute function public.rate_limit();
drop trigger if exists replies_rate_limit on public.replies;
create trigger replies_rate_limit before insert on public.replies
  for each row execute function public.rate_limit();

-- Normal users can't change counters, pin or lock (admins can).
create or replace function public.protect_thread_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.pinned := old.pinned;
    new.locked := old.locked;
    new.reply_count := old.reply_count;
    new.last_activity_at := old.last_activity_at;
    new.author_id := old.author_id;
    new.category := old.category;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists threads_protect on public.threads;
create trigger threads_protect before update on public.threads
  for each row execute function public.protect_thread_fields();

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.threads  enable row level security;
alter table public.replies  enable row level security;

-- profiles: everyone can read usernames; nobody edits them from the site
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

-- threads
drop policy if exists "threads are public" on public.threads;
create policy "threads are public" on public.threads for select using (true);

drop policy if exists "signed-in users start threads" on public.threads;
create policy "signed-in users start threads" on public.threads for insert to authenticated
  with check (
    author_id = auth.uid()
    and (category <> 'announcements' or public.is_admin())
  );

drop policy if exists "authors and admins edit threads" on public.threads;
create policy "authors and admins edit threads" on public.threads for update to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists "authors and admins delete threads" on public.threads;
create policy "authors and admins delete threads" on public.threads for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- replies
drop policy if exists "replies are public" on public.replies;
create policy "replies are public" on public.replies for select using (true);

drop policy if exists "signed-in users reply to open threads" on public.replies;
create policy "signed-in users reply to open threads" on public.replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.threads t where t.id = thread_id and (not t.locked or public.is_admin()))
  );

drop policy if exists "authors and admins delete replies" on public.replies;
create policy "authors and admins delete replies" on public.replies for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------- make yourself admin ----------
-- After you sign up on the site, run this once with your username:
--   update public.profiles set is_admin = true where username = 'YOUR_USERNAME';
