-- Stand-in rows until something creates real analyses. Two organizations with
-- different repositories, so the dashboard shows which one it's scoped to.
-- Organization ids are real Clerk ids from the development instance.
-- Re-running is safe: it clears and rewrites the seeded organizations only.

delete from public.organizations
where id in ('org_3JwtW0HcpRZgNX7GbutuxdXoVJS');

insert into public.organizations (id) values
  ('org_3JwtW0HcpRZgNX7GbutuxdXoVJS');

with p as (
  insert into public.projects (organization_id, repo_owner, repo_name) values
    ('org_3JwtW0HcpRZgNX7GbutuxdXoVJS', 'vercel', 'next.js'),
    ('org_3JwtW0HcpRZgNX7GbutuxdXoVJS', 'shadcn-ui', 'ui'),
    ('org_3JwtW0HcpRZgNX7GbutuxdXoVJS', 'tailwindlabs', 'tailwindcss')
  returning id, organization_id, repo_name
)
insert into public.analyses (organization_id, project_id, status, commit_sha, error, created_at, finished_at)
select p.organization_id, p.id, a.status::public.analysis_status, a.commit_sha, a.error,
       now() - a.age, case when a.status in ('complete', 'failed') then now() - a.age + interval '40 seconds' end
from p
join (values
  ('next.js',     'complete', '4f1c2a9e0b7d3c5a8e6f1b2d9c0a7e3f5b8d1c4a', null::text,                              interval '3 days'),
  ('next.js',     'parsing',  'a93be01d7c24f5e8b6a0c3d9f1e2b7a4c8d5e0f6', null,                                    interval '2 minutes'),
  ('ui',          'complete', '0c7d9e2f4a1b8c3d6e5f0a9b2c7d4e1f8a3b6c5d', null,                                    interval '1 day'),
  ('ui',          'failed',   null,                                        'Repository archive download timed out', interval '5 hours'),
  ('tailwindcss', 'queued',   null,                                        null,                                    interval '30 seconds')
) as a (repo_name, status, commit_sha, error, age) on a.repo_name = p.repo_name;

-- Second organization: different repositories, so a switch is unmistakable.
delete from public.organizations
where id in ('org_3JwxWAXSGXdXZzBg3adiwuaibgC');

insert into public.organizations (id) values
  ('org_3JwxWAXSGXdXZzBg3adiwuaibgC');

with p as (
  insert into public.projects (organization_id, repo_owner, repo_name) values
    ('org_3JwxWAXSGXdXZzBg3adiwuaibgC', 'supabase', 'supabase-js'),
    ('org_3JwxWAXSGXdXZzBg3adiwuaibgC', 'clerk', 'javascript')
  returning id, organization_id, repo_name
)
insert into public.analyses (organization_id, project_id, status, commit_sha, error, created_at, finished_at)
select p.organization_id, p.id, a.status::public.analysis_status, a.commit_sha, a.error,
       now() - a.age, case when a.status in ('complete', 'failed') then now() - a.age + interval '40 seconds' end
from p
join (values
  ('supabase-js', 'complete', '7e2b4d1a9c0f3e6b8d5a2c7f1e4b9d0a3c6f8e2b', null::text, interval '6 hours'),
  ('javascript',  'queued',   null,                                        null,       interval '1 minute')
) as a (repo_name, status, commit_sha, error, age) on a.repo_name = p.repo_name;
