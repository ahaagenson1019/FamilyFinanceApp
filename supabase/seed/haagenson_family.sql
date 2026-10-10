-- One-time setup for the Haagenson family. Real data, not test data:
-- stars start at zero and no PINs are set (each parent sets theirs in the app).
do $seed$
declare
  fam uuid;
  andy uuid; jess uuid; foster uuid; ira uuid; rita uuid; enid uuid;
  kid record;
  rid uuid;
  steps jsonb;
  w text;
  i int;
  big_morning jsonb := '[["Make bed","🛏️"],["Get dressed","👕"],["Eat breakfast","🥣"],["Brush teeth","🪥"],["Brush hair","💇"],["Shoes on","👟"],["Backpack ready","🎒"]]';
  little_morning jsonb := '[["Get dressed","👕"],["Eat breakfast","🥣"],["Brush teeth","🪥"],["Shoes on","👟"]]';
  big_after jsonb := '[["Unpack backpack","🎒"],["Shoes away","👟"],["Wash hands","🧼"],["Clean up snack","🍎"],["Read 15 minutes","📖"]]';
  little_after jsonb := '[["Shoes away","👟"],["Wash hands","🧼"],["Clean up snack","🍎"]]';
  big_bed jsonb := '[["Toys away","🧸"],["Bath or shower","🛁"],["Pajamas on","🌙"],["Brush teeth","🪥"],["Pick tomorrow''s clothes","👚"],["Story time","📚"]]';
  little_bed jsonb := '[["Toys away","🧸"],["Pajamas on","🌙"],["Brush teeth","🪥"],["Story time","📚"]]';
begin
  if exists (select 1 from public.families where name = 'Haagie Headquarters') then
    raise notice 'Already seeded';
    return;
  end if;

  insert into public.families (name) values ('Haagie Headquarters') returning id into fam;
  insert into public.family_settings (family_id, dinner_today) values (fam, null);

  insert into public.members (family_id, role, display_name, color, email, auth_user_id, sort)
    values (fam, 'owner', 'Andy', '#1E3A8A', 'andy.haagenson@gmail.com',
            (select id from auth.users where lower(email) = 'andy.haagenson@gmail.com'), 0)
    returning id into andy;
  insert into public.members (family_id, role, display_name, color, email, sort)
    values (fam, 'parent', 'Jess', '#7E22CE', null, 1) returning id into jess;
  insert into public.members (family_id, role, display_name, color, sort) values (fam, 'kid', 'Foster', '#2563EB', 2) returning id into foster;
  insert into public.members (family_id, role, display_name, color, sort) values (fam, 'kid', 'Ira', '#16A34A', 3) returning id into ira;
  insert into public.members (family_id, role, display_name, color, sort) values (fam, 'kid', 'Rita', '#EA580C', 4) returning id into rita;
  insert into public.members (family_id, role, display_name, color, sort) values (fam, 'kid', 'Enid', '#DB2777', 5) returning id into enid;
  update public.families set owner_member_id = andy where id = fam;

  for kid in select * from (values (foster, false), (ira, false), (rita, true), (enid, true)) as k(id, little) loop
    foreach w in array array['morning', 'after_school', 'bedtime'] loop
      steps := case
        when w = 'morning' then case when kid.little then little_morning else big_morning end
        when w = 'after_school' then case when kid.little then little_after else big_after end
        else case when kid.little then little_bed else big_bed end
      end;
      insert into public.routines (family_id, member_id, name, time_window, star_reward)
        values (fam, kid.id,
                case w when 'morning' then 'Morning' when 'after_school' then 'After school' else 'Bedtime' end,
                w, case when kid.little then 2 else 3 end)
        returning id into rid;
      for i in 0 .. jsonb_array_length(steps) - 1 loop
        insert into public.routine_steps (routine_id, position, title, icon)
          values (rid, i, steps -> i ->> 0, steps -> i ->> 1);
      end loop;
    end loop;
  end loop;
end
$seed$;
