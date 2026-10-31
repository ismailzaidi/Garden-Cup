-- The bits of a Supabase database the migrations rely on, for running them
-- against a plain Postgres in tests (scripts/test-db.sh). A real Supabase
-- project already has all of this; never apply this file to one.
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create schema auth;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Same contract as Supabase's: the "sub" claim of the request's JWT.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
