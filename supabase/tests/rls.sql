-- Access-rule tests, run by scripts/test-db.sh after auth_stub.sql and the
-- migrations. Any failed check raises, and the script stops with an error.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- ---------- user A saves, conflicts and finishes ----------
set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';

do $$
declare r jsonb;
begin
  r := public.save_current_tournament('t1', 'league', '{"mode":"league","n":1}', false, 0);
  assert r = '{"conflict": false, "version": 1}', format('first save: %s', r);

  r := public.save_current_tournament('t1', 'league', '{"mode":"league","n":2}', false, 1);
  assert r = '{"conflict": false, "version": 2}', format('second save: %s', r);

  -- a device that last saw version 1 is behind: it gets the newer state back
  r := public.save_current_tournament('t1', 'league', '{"mode":"league","n":99}', false, 1);
  assert (r ->> 'conflict')::boolean and (r ->> 'version')::int = 2 and r -> 'state' ->> 'n' = '2',
    format('stale save should conflict: %s', r);

  -- a new tournament archives the old one; exactly one stays active
  r := public.save_current_tournament('t2', 'knockout', '{"mode":"knockout"}', false, 0);
  assert r = '{"conflict": false, "version": 1}', format('new tournament: %s', r);
  assert (select count(*) from public.tournaments where status = 'active') = 1, 'one active tournament';
  assert (select client_id from public.tournaments where status = 'active') = 't2', 't2 is active';

  insert into public.tournament_history (client_id, mode, played_at, record)
    values ('h1', 'league', now(), '{"id":"h1"}');
  -- the same record again is ignored, not an error and not a duplicate
  insert into public.tournament_history (client_id, mode, played_at, record)
    values ('h1', 'league', now(), '{"id":"h1"}') on conflict (user_id, client_id) do nothing;
  assert (select count(*) from public.tournament_history) = 1, 'history is idempotent';
end $$;

-- ---------- user B sees none of it and can't touch it ----------
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';

do $$
declare r jsonb; n int;
begin
  assert (select count(*) from public.tournaments) = 0, 'B must not see A''s tournaments';
  assert (select count(*) from public.tournament_history) = 0, 'B must not see A''s history';

  update public.tournaments set state = '{"hacked":true}';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A''s rows';
  delete from public.tournament_history;
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A''s rows';

  begin
    insert into public.tournaments (user_id, client_id, mode, state)
      values ('00000000-0000-0000-0000-00000000000a', 'evil', 'league', '{}');
    assert false, 'B must not insert a row owned by A';
  exception when insufficient_privilege then null;
  end;

  -- B saving a tournament with A's client id gets their own row, not A's
  r := public.save_current_tournament('t2', 'league', '{"mode":"league","b":true}', false, 0);
  assert r = '{"conflict": false, "version": 1}', format('B''s own t2: %s', r);
end $$;

-- ---------- signed out: no access at all ----------
reset role;
reset request.jwt.claims;
set role anon;
do $$
begin
  begin
    perform 1 from public.tournaments;
    assert false, 'anon must not read tournaments';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_current_tournament('t9', 'league', '{}', false, 0);
    assert false, 'anon must not call save_current_tournament';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---------- deleting an account deletes its data ----------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select count(*) from public.tournaments where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'cascade tournaments';
  assert (select count(*) from public.tournament_history where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'cascade history';
end $$;

-- ---------- rate limits ----------
set role anon;
do $$
declare r jsonb; b text := repeat('a', 64);
begin
  r := public.rate_limit_hit(b, 2, 60);
  assert (r ->> 'allowed')::boolean, format('1st hit allowed: %s', r);
  r := public.rate_limit_hit(b, 2, 60);
  assert (r ->> 'allowed')::boolean, format('2nd hit allowed: %s', r);
  r := public.rate_limit_hit(b, 2, 60);
  assert not (r ->> 'allowed')::boolean, format('3rd hit refused: %s', r);
  assert (r ->> 'retry_after')::int between 1 and 60, format('retry_after in the window: %s', r);

  -- a different bucket has its own count
  r := public.rate_limit_hit(repeat('b', 64), 2, 60);
  assert (r ->> 'allowed')::boolean, 'separate buckets';

  begin
    perform public.rate_limit_hit('not-a-hash', 2, 60);
    assert false, 'a bucket must be a sha256 hex';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.rate_limits;
    assert false, 'anon must not read rate_limits';
  exception when insufficient_privilege then null;
  end;
end $$;

set role authenticated;
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
do $$
begin
  begin
    delete from public.rate_limits;
    assert false, 'a signed-in user must not reset rate limits';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo 'rls.sql: all checks passed'
