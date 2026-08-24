-- Rode no SQL Editor do Supabase uma única vez.
alter table public.products
  add column if not exists stock_available bigint not null default 0;

update public.products
set price_brl = case id
  when 42 then 238.19
  when 45 then 181.49
  else price_brl end,
    stock_available = case id
  when 42 then 200
  when 45 then 200
  else stock_available end
where id in (42,45);

-- Confirme:
select id, "nameName", price_brl, stock_available
from public.products
where id in (42,45);
