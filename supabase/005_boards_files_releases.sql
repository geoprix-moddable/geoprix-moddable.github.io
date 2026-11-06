-- GeoPrix Moddable forum: new boards, attachments and mod releases.
-- Run once in Supabase: SQL Editor > New query (+) > paste > Run. Safe to run again.
--
-- Boards:   general (anyone posts/replies), mods (Public Mods, with a Releases tab per mod),
--           announcements (Admin only; new announcements start with replies turned off).
-- Files:    stored in the public "forum-files" bucket under <user id>/<thread id>/...
--           Allowed for Modders/Admins, and for a thread's author inside their own thread.
-- Releases: only the thread author adds them; the 3 newest per mod are kept.

-- ---------- boards ----------
alter table public.threads drop constraint if exists threads_category_check;
update public.threads set category = 'general' where category not in ('general', 'mods', 'announcements');
alter table public.threads add constraint threads_category_check
  check (category in ('general', 'mods', 'announcements'));

-- New threads: normal users can't create pinned/locked threads; announcements start with replies off.
create or replace function public.thread_defaults()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    new.pinned := false;
    new.locked := false;
  end if;
  new.reply_count := 0;
  new.created_at := now();
  new.last_activity_at := now();
  if new.category = 'announcements' then
    new.locked := true;
  end if;
  return new;
end;
$$;
drop trigger if exists threads_defaults on public.threads;
create trigger threads_defaults before insert on public.threads
  for each row execute function public.thread_defaults();

-- ---------- who may attach files in a thread ----------
create or replace function public.can_attach(thread_ref text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  t record;
begin
  if auth.uid() is null or thread_ref is null or thread_ref !~ '^[0-9]{1,18}$' then return false; end if;
  select author_id, category into t from public.threads where id = thread_ref::bigint;
  if not found then return false; end if;
  if public.is_admin() then return true; end if;
  if t.category = 'announcements' then return false; end if;
  return t.author_id = auth.uid() or public.can_customize();
end;
$$;

create or replace function public.owns_thread(thread_ref text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or thread_ref is null or thread_ref !~ '^[0-9]{1,18}$' then return false; end if;
  return exists (select 1 from public.threads where id = thread_ref::bigint and author_id = auth.uid());
end;
$$;

-- ---------- attachments ----------
create table if not exists public.attachments (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  reply_id bigint references public.replies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  path text not null,
  name text not null check (char_length(name) between 1 and 120),
  size bigint not null check (size between 0 and 52428800),
  mime text check (mime is null or char_length(mime) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists attachments_thread_idx on public.attachments (thread_id);

alter table public.attachments enable row level security;

drop policy if exists "attachments are public" on public.attachments;
create policy "attachments are public" on public.attachments for select using (true);

drop policy if exists "allowed users attach files" on public.attachments;
create policy "allowed users attach files" on public.attachments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.can_attach(thread_id::text)
    and left(path, char_length(auth.uid()::text || '/' || thread_id::text || '/')) = auth.uid()::text || '/' || thread_id::text || '/'
    and (
      (attachments.reply_id is null
       and exists (select 1 from public.threads t where t.id = attachments.thread_id and t.author_id = auth.uid()))
      or exists (select 1 from public.replies r
                 where r.id = attachments.reply_id and r.thread_id = attachments.thread_id and r.author_id = auth.uid())
    )
  );

drop policy if exists "authors and admins delete attachments" on public.attachments;
create policy "authors and admins delete attachments" on public.attachments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- at most 5 files per post (admins: unlimited)
create or replace function public.attachment_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() and (
    select count(*) from public.attachments
    where thread_id = new.thread_id and reply_id is not distinct from new.reply_id
  ) >= 5 then
    raise exception 'You can attach up to 5 files per post.';
  end if;
  return new;
end;
$$;
drop trigger if exists attachments_limit on public.attachments;
create trigger attachments_limit before insert on public.attachments
  for each row execute function public.attachment_limit();

-- ---------- mod releases (Public Mods) ----------
create table if not exists public.mod_releases (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  mod_version text not null check (char_length(btrim(mod_version)) between 1 and 30),
  game_version text not null check (game_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$'),
  launcher_version text check (launcher_version is null or char_length(launcher_version) between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 2000),
  link text check (link is null or (link ~ '^https://' and char_length(link) <= 300)),
  file_path text,
  file_name text check (file_name is null or char_length(file_name) <= 120),
  file_size bigint check (file_size is null or file_size between 0 and 52428800),
  created_at timestamptz not null default now(),
  check (link is not null or file_path is not null)
);
create index if not exists mod_releases_thread_idx on public.mod_releases (thread_id, created_at desc);

alter table public.mod_releases enable row level security;

drop policy if exists "releases are public" on public.mod_releases;
create policy "releases are public" on public.mod_releases for select using (true);

drop policy if exists "mod authors add releases" on public.mod_releases;
create policy "mod authors add releases" on public.mod_releases for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.threads t
                where t.id = mod_releases.thread_id and t.author_id = auth.uid() and t.category = 'mods')
    and (file_path is null
         or left(file_path, char_length(auth.uid()::text || '/' || thread_id::text || '/')) = auth.uid()::text || '/' || thread_id::text || '/')
  );

drop policy if exists "authors and admins delete releases" on public.mod_releases;
create policy "authors and admins delete releases" on public.mod_releases for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- keep only the 3 newest releases per mod (the site removes the old files)
create or replace function public.prune_releases()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.mod_releases
  where thread_id = new.thread_id
    and id not in (
      select id from public.mod_releases where thread_id = new.thread_id
      order by created_at desc, id desc limit 3
    );
  return null;
end;
$$;
drop trigger if exists mod_releases_prune on public.mod_releases;
create trigger mod_releases_prune after insert on public.mod_releases
  for each row execute function public.prune_releases();

-- ---------- file storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-files', 'forum-files', true, 52428800, array[
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/zip', 'application/x-zip-compressed', 'application/vnd.android.package-archive',
  'application/x-7z-compressed', 'application/vnd.rar', 'application/x-rar-compressed',
  'application/octet-stream', 'text/plain', 'application/json'])
on conflict (id) do update
  set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "allowed users upload forum files" on storage.objects;
create policy "allowed users upload forum files" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'forum-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_attach((storage.foldername(name))[2])
  );

drop policy if exists "owners and admins delete forum files" on storage.objects;
create policy "owners and admins delete forum files" on storage.objects for delete to authenticated
  using (
    bucket_id = 'forum-files'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_admin()
         or public.owns_thread((storage.foldername(name))[2]))
  );
