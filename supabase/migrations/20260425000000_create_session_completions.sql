create table if not exists public.session_completions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  month_key text not null generated always as (to_char(completed_at, 'YYYY-MM')) stored,
  completion_count integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists session_completions_session_user_idx
  on public.session_completions (session_id, user_id, completed_at desc);

create index if not exists session_completions_month_idx
  on public.session_completions (session_id, user_id, month_key);

alter table public.session_completions enable row level security;

drop policy if exists "Students can view own session completions" on public.session_completions;
create policy "Students can view own session completions"
on public.session_completions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Students can insert own session completions" on public.session_completions;
create policy "Students can insert own session completions"
on public.session_completions
for insert
to authenticated
with check (user_id = auth.uid());

-- Admin/teacher visibility should be enabled when user_roles and classroom relations exist:
-- using (public.has_role(auth.uid(), 'admin'))
-- using (exists (select 1 from public.teacher_students ts where ts.teacher_id = auth.uid() and ts.student_id = user_id))
