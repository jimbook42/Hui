-- HUI-012A: Prefer OAuth provider name metadata on initial profile creation.

create or replace function public.initial_profile_display_name(
  raw_meta jsonb,
  email text
)
returns text
language sql
immutable
set search_path = public
as $$
  select left(
    coalesce(
      nullif(btrim(coalesce(raw_meta, '{}'::jsonb) ->> 'full_name'), ''),
      nullif(btrim(coalesce(raw_meta, '{}'::jsonb) ->> 'name'), ''),
      nullif(btrim(coalesce(raw_meta, '{}'::jsonb) ->> 'display_name'), ''),
      nullif(split_part(email, '@', 1), ''),
      'Member'
    ),
    80
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    public.initial_profile_display_name(new.raw_user_meta_data, new.email)
  );

  return new;
end;
$function$;

grant execute on function public.initial_profile_display_name(jsonb, text) to authenticated, service_role;
