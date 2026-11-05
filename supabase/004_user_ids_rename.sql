-- GeoPrix Moddable forum: user ID numbers + renaming.
-- Run once in Supabase: SQL Editor > New query (+) > paste > Run. Safe to run again.
--
-- Every user gets a number (first user = 1, next = 2, ...). Profile links use it: forum.html#/u/1
-- Anyone signed in can change their own username. Roles and badges stay, because they belong
-- to the account, not the name.

-- ---------- user numbers ----------
alter table public.profiles add column if not exists num bigint;

-- number existing users in sign-up order
with ordered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.profiles where num is null
)
update public.profiles p
  set num = o.rn + coalesce((select max(num) from public.profiles), 0)
  from ordered o where p.id = o.id;

create sequence if not exists public.profiles_num_seq owned by public.profiles.num;
select setval('public.profiles_num_seq', greatest(coalesce((select max(num) from public.profiles), 0), 1),
              (select max(num) from public.profiles) is not null);
alter table public.profiles alter column num set default nextval('public.profiles_num_seq');
alter table public.profiles alter column num set not null;
create unique index if not exists profiles_num_idx on public.profiles (num);

-- ---------- rename yourself ----------
create or replace function public.rename_me(new_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  new_name := btrim(new_name);
  if new_name !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3 to 20 letters, numbers or _.';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(new_name) and id <> auth.uid()) then
    raise exception 'That username is taken.';
  end if;
  update public.profiles set username = new_name, needs_username = false where id = auth.uid();
end;
$$;

revoke all on function public.rename_me(text) from public, anon;
grant execute on function public.rename_me(text) to authenticated;
