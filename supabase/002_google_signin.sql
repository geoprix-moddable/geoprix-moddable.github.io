-- GeoPrix Moddable forum: update for "Continue with Google".
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
--
-- Google sign-ups don't send a username, so the new-user trigger now makes a temporary one
-- (from the Google name or email, plus 4 digits) and marks the profile "needs_username".
-- The forum then asks the person to pick their real username once, via set_username().

alter table public.profiles add column if not exists needs_username boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  wanted text := new.raw_user_meta_data ->> 'username';
  base text;
  candidate text;
begin
  -- email sign-up with a valid, free username: use it
  if wanted ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(wanted)) then
    insert into public.profiles (id, username) values (new.id, wanted);
    return new;
  end if;

  -- otherwise (Google etc.): temporary name, user picks a real one on the forum
  base := regexp_replace(
            coalesce(new.raw_user_meta_data ->> 'full_name',
                     new.raw_user_meta_data ->> 'name',
                     split_part(new.email, '@', 1), 'user'),
            '[^A-Za-z0-9_]', '', 'g');
  base := left(base, 15);
  if char_length(base) < 3 then base := 'user'; end if;
  loop
    candidate := base || '_' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.profiles where lower(username) = lower(candidate));
  end loop;
  insert into public.profiles (id, username, needs_username) values (new.id, candidate, true);
  return new;
end;
$$;

-- Pick your username (only while the profile still has a temporary one).
create or replace function public.set_username(new_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if new_name !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3 to 20 letters, numbers or _.';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(new_name) and id <> auth.uid()) then
    raise exception 'That username is taken.';
  end if;
  update public.profiles
    set username = new_name, needs_username = false
    where id = auth.uid() and needs_username;
  if not found then
    raise exception 'Your username is already set.';
  end if;
end;
$$;

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;
