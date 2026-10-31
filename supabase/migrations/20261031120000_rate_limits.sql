-- Rate limiting for api/ (api/_lib/rateLimit.js).
--
-- Counts requests per bucket in fixed time windows. A bucket is a SHA-256
-- of something like "login:ip:<address>" or "data:user:<id>", made by the
-- API, so no email address or IP address is ever stored here, only hashes.
-- Rows are pruned after a day.

create table public.rate_limits (
  bucket       text        not null check (bucket ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (bucket, window_start)
);

-- No policies: nobody reads or writes the table directly, only through the
-- function below.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit and says whether it's within the limit:
-- {"allowed": true|false, "retry_after": seconds until the window resets}.
-- security definer, because sign-in and sign-up are rate limited before
-- anyone is signed in. It can only ever add to a counter.
create function public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  win timestamptz;
  n integer;
begin
  if p_bucket !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 100000 or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  win := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (bucket, window_start, hits)
    values (p_bucket, win, 1)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning r.hits into n;

  -- occasional tidy-up, so the table never grows past about a day of rows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return jsonb_build_object(
    'allowed', n <= p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from (win + make_interval(secs => p_window_seconds) - now())))::integer)
  );
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public;
grant execute on function public.rate_limit_hit(text, integer, integer) to anon, authenticated;
