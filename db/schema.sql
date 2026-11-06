create extension if not exists pgcrypto;

create table users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  phone text,
  password_hash text,
  google_sub text unique,
  role text not null default 'student' check (role in ('student','care','admin')),
  care_status text check (care_status in ('pending','approved','rejected')),
  license_no text, license_body text,
  care_contact_consent boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table consent_events(
  id bigserial primary key,
  user_id uuid not null references users on delete cascade,
  kind text not null, granted boolean not null,
  created_at timestamptz not null default now()
);
create table checkins(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  mood smallint not null check (mood between 1 and 5),
  stress smallint not null check (stress between 1 and 5),
  cause text, created_at timestamptz not null default now()
);
create index on checkins(user_id, created_at desc);
create table alerts(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  checkin_id uuid references checkins on delete set null,
  level text not null check (level in ('High','Medium')),
  status text not null default 'New' check (status in ('New','Replied','Escalated','Closed')),
  created_at timestamptz not null default now()
);
create table messages(
  id bigserial primary key,
  alert_id uuid not null references alerts on delete cascade,
  sender_role text not null check (sender_role in ('student','care')),
  sender_id uuid references users on delete set null,
  body text not null check (length(body) <= 2000),
  created_at timestamptz not null default now()
);
create table counselors(
  id uuid primary key default gen_random_uuid(),name
  text not null, specialty text not null
);
create table bookings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  counselor_id uuid not null references counselors,
  starts_at timestamptz not null,
  kind text not null check (kind in ('In person','Video','Chat')),
  share_summary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (counselor_id, starts_at)
);
create table audit_log(
  id bigserial primary key,
  actor_id uuid references users on delete set null,
  action text not null, target text,
  created_at timestamptz not null default now()
);
create table auth_failures(
  id bigserial primary key, email text not null,
  created_at timestamptz not null default now()
);
create index on auth_failures(email, created_at);
create table reset_tokens(
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null
);
create table chat_usage(
  id bigserial primary key,
  user_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now()
);
create index on chat_usage(user_id, created_at);
