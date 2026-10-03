-- Migration 27: Add sort_order to files table
-- Allows admins to reorder files within a folder (just like folders use sort_order)

alter table files
  add column if not exists sort_order int not null default 0;

-- Seed initial sort_order from upload time so existing files keep their natural order
-- Each file gets a rank within its folder based on uploaded_at
with ranked as (
  select id,
         row_number() over (partition by folder_id order by uploaded_at asc) as rn
  from files
  where is_deleted = false
)
update files
set sort_order = ranked.rn
from ranked
where files.id = ranked.id;

-- Index for fast ordered fetches by folder
create index if not exists idx_files_folder_sort on files(folder_id, sort_order);
