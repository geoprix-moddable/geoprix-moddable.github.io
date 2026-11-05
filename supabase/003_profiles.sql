-- GeoPrix Moddable forum: profiles + Modder badge.
-- Run once in Supabase: SQL Editor > New query (+) > paste > Run. Safe to run again.
--
-- Everyone gets a public profile page. Only Modders and Admins ("Modder+") can customize it:
-- picture, bio, name colour and one link. Admins give or remove the Modder badge.

-- ---------- new profile fields ----------
alter table public.profiles add column if not exists is_modder boolean not null default false;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists name_color text;
alter table public.profiles add column if not exists link text;

alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 300);
alter table public.profiles drop constraint if exists profiles_color_fmt;
alter table public.profiles add constraint profiles_color_fmt check (name_color is null or name_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.profiles drop constraint if exists profiles_link_fmt;
alter table public.profiles add constraint profiles_link_fmt check (link is null or (link ~ '^https://' and char_length(link) <= 200));

-- ---------- who may customize ----------
create or replace function public.can_customize()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin or is_modder from public.profiles where id = auth.uid()), false);
$$;

-- ---------- edit your own profile (Modder+ only) ----------
create or replace function public.update_my_profile(
  new_bio text,
  new_avatar_url text,
  new_name_color text,
  new_link text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  avatar_prefix text := 'https://zqyhweugbcidjqdprejh.supabase.co/storage/v1/object/public/avatars/' || auth.uid()::text || '/';
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not public.can_customize() then raise exception 'Only Modders can customize their profile.'; end if;

  new_bio := nullif(btrim(new_bio), '');
  new_avatar_url := nullif(btrim(new_avatar_url), '');
  new_name_color := nullif(btrim(new_name_color), '');
  new_link := nullif(btrim(new_link), '');

  if new_avatar_url is not null and left(new_avatar_url, char_length(avatar_prefix)) <> avatar_prefix then
    raise exception 'Profile pictures must be uploaded on the forum.';
  end if;

  update public.profiles
    set bio = new_bio, avatar_url = new_avatar_url, name_color = new_name_color, link = new_link
    where id = auth.uid();
end;
$$;

-- ---------- admin tools ----------
create or replace function public.set_modder(target_username text, make_modder boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only admins can do that.'; end if;
  update public.profiles set is_modder = make_modder where username = target_username;
  if not found then raise exception 'No user with that name.'; end if;
end;
$$;

create or replace function public.admin_clear_profile(target_username text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Only admins can do that.'; end if;
  update public.profiles
    set bio = null, avatar_url = null, name_color = null, link = null
    where username = target_username;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text) from public, anon;
revoke all on function public.set_modder(text, boolean) from public, anon;
revoke all on function public.admin_clear_profile(text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;
grant execute on function public.set_modder(text, boolean) to authenticated;
grant execute on function public.admin_clear_profile(text) to authenticated;

-- ---------- picture storage ----------
-- Public bucket "avatars": max 1 MB, images only. Each user writes only to avatars/<their id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

drop policy if exists "modders upload own avatar" on storage.objects;
create policy "modders upload own avatar" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_customize()
  );

drop policy if exists "modders replace own avatar" on storage.objects;
create policy "modders replace own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.can_customize());

drop policy if exists "owners and admins delete avatars" on storage.objects;
create policy "owners and admins delete avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
