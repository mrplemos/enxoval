create table if not exists public.inventory (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.benchmarks (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.inventory enable row level security;
alter table public.benchmarks enable row level security;

grant select on table public.inventory, public.benchmarks to anon;
grant select, insert, update, delete on table public.inventory, public.benchmarks to authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.inventory, public.benchmarks from anon;

create policy "public can read inventory" on public.inventory for select to anon using (true);
create policy "public can read benchmarks" on public.benchmarks for select to anon using (true);

create policy "owner can read inventory" on public.inventory for select to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can insert inventory" on public.inventory for insert to authenticated
  with check ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can update inventory" on public.inventory for update to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com')
  with check ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can delete inventory" on public.inventory for delete to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');

create policy "owner can read benchmarks" on public.benchmarks for select to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can insert benchmarks" on public.benchmarks for insert to authenticated
  with check ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can update benchmarks" on public.benchmarks for update to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com')
  with check ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');
create policy "owner can delete benchmarks" on public.benchmarks for delete to authenticated
  using ((select auth.jwt()->>'email') = 'mrplemos@gmail.com');

create or replace function public.replace_enxoval(p_items jsonb, p_benchmarks jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.inventory;
  insert into public.inventory (id, data)
    select value->>'id', value from jsonb_array_elements(p_items);
  delete from public.benchmarks;
  insert into public.benchmarks (id, data)
    select value->>'id', value from jsonb_array_elements(p_benchmarks);
end;
$$;
revoke all on function public.replace_enxoval(jsonb,jsonb) from public, anon;
grant execute on function public.replace_enxoval(jsonb,jsonb) to authenticated;
