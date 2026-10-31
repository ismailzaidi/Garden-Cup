-- Garden Cup — initial Supabase schema.
--
-- The browser never talks to Supabase directly: every request goes through
-- the api/ functions, which act as the signed-in user (their session, not the
-- service key). Row-level security is therefore a second wall, not the only
-- one: each row belongs to one auth user and is invisible to everyone else.
--
-- Tournaments and history are stored as jsonb documents in exactly the shape
-- the client saves (validated by api/_lib/state.js and
-- api/_lib/historyRecord.js before they get here).

-- ---------- the tournament in progress (one active row per user) ----------
create table public.tournaments (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  client_id     text        not null check (char_length(client_id) between 1 and 24),  -- the app's tournamentId
  mode          text        not null check (char_length(mode) between 1 and 24),       -- allow-listed in api/_lib/modes.js
  state         jsonb       not null check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 1048576),
  history_saved boolean     not null default false,
  status        text        not null default 'active' check (status in ('active', 'archived')),
  version       integer     not null default 1 check (version >= 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, client_id)
);

-- GET /api/tournaments/current must always resolve to at most one row.
create unique index tournaments_one_active_per_user on public.tournaments (user_id) where status = 'active';

-- ---------- finished tournaments ----------
create table public.tournament_history (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  client_id  text        not null check (char_length(client_id) between 1 and 24),     -- the record's own id
  mode       text        not null check (char_length(mode) between 1 and 24),
  played_at  timestamptz not null,
  record     jsonb       not null check (jsonb_typeof(record) = 'object' and octet_length(record::text) <= 65536),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index tournament_history_user_played on public.tournament_history (user_id, played_at desc);

-- ---------- row-level security: owner only ----------
alter table public.tournaments enable row level security;
alter table public.tournament_history enable row level security;

create policy "own tournaments" on public.tournaments
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own history" on public.tournament_history
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Nobody signed out reaches these tables at all, whatever the policies say.
revoke all on public.tournaments, public.tournament_history from anon;
revoke all on public.tournaments, public.tournament_history from authenticated;
grant select, insert, update, delete on public.tournaments, public.tournament_history to authenticated;

-- ---------- save the tournament in progress ----------
-- One transaction: check the version the client last saw, write the new
-- state, and archive whatever else was active, so two devices can never
-- both "win" a save. Runs as the caller (security invoker), so the policies
-- above still apply inside it.
--
-- Returns {conflict:false, version} on success, or
-- {conflict:true, version, state} with the row the client was behind on.
create function public.save_current_tournament(
  p_client_id        text,
  p_mode             text,
  p_state            jsonb,
  p_history_saved    boolean,
  p_expected_version integer
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.tournaments%rowtype;
  next_version integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into existing
  from public.tournaments
  where user_id = uid and client_id = p_client_id
  for update;

  if found then
    if existing.version <> p_expected_version then
      return jsonb_build_object('conflict', true, 'version', existing.version, 'state', existing.state);
    end if;
    next_version := existing.version + 1;
    update public.tournaments set status = 'archived', updated_at = now()
      where user_id = uid and status = 'active' and id <> existing.id;
    update public.tournaments
      set mode = p_mode, state = p_state, history_saved = p_history_saved,
          status = 'active', version = next_version, updated_at = now()
      where id = existing.id;
  else
    next_version := 1;
    update public.tournaments set status = 'archived', updated_at = now()
      where user_id = uid and status = 'active';
    insert into public.tournaments (user_id, client_id, mode, state, history_saved, version)
      values (uid, p_client_id, p_mode, p_state, p_history_saved, next_version);
  end if;

  return jsonb_build_object('conflict', false, 'version', next_version);
exception
  -- Two devices raced to create the same tournament (or two different ones
  -- at once): whoever lost sees the row that won, as an ordinary conflict.
  when unique_violation then
    select * into existing
    from public.tournaments
    where user_id = uid and client_id = p_client_id;
    if found then
      return jsonb_build_object('conflict', true, 'version', existing.version, 'state', existing.state);
    end if;
    raise;
end;
$$;

revoke execute on function public.save_current_tournament(text, text, jsonb, boolean, integer) from public, anon;
grant execute on function public.save_current_tournament(text, text, jsonb, boolean, integer) to authenticated;
