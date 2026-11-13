-- W-9 tax IDs are encrypted with a random key kept in Supabase Vault. Only the database can read the key.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'w9_key', 'Encrypts tax IDs on W-9 forms');

create or replace function public.save_w9(p_legal_name text, p_business_name text, p_tax_class text, p_address text,
  p_city_state_zip text, p_tin_type text, p_tin text, p_signature_name text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare digits text := regexp_replace(coalesce(p_tin, ''), '\D', '', 'g'); k text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(digits) <> 9 then raise exception 'A tax ID has 9 digits'; end if;
  if p_tin_type not in ('ssn', 'ein') then raise exception 'Pick SSN or EIN'; end if;
  if coalesce(trim(p_legal_name), '') = '' or coalesce(trim(p_address), '') = '' or coalesce(trim(p_city_state_zip), '') = '' then
    raise exception 'Name and address are required';
  end if;
  if coalesce(trim(p_signature_name), '') = '' then raise exception 'Type your name to sign'; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'w9_key';
  insert into tax_forms (profile_id, legal_name, business_name, tax_class, address, city_state_zip, tin_type, tin_last4, tin_cipher, signature_name, signed_at)
  values (auth.uid(), trim(p_legal_name), nullif(trim(p_business_name), ''), p_tax_class, trim(p_address), trim(p_city_state_zip),
          p_tin_type, right(digits, 4), encode(pgp_sym_encrypt(digits, k, 'cipher-algo=aes256'), 'base64'), trim(p_signature_name), now())
  on conflict (profile_id) do update set legal_name = excluded.legal_name, business_name = excluded.business_name,
    tax_class = excluded.tax_class, address = excluded.address, city_state_zip = excluded.city_state_zip, tin_type = excluded.tin_type,
    tin_last4 = excluded.tin_last4, tin_cipher = excluded.tin_cipher, signature_name = excluded.signature_name, signed_at = now();
  return right(digits, 4);
end $$;
revoke execute on function public.save_w9(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_w9(text, text, text, text, text, text, text, text) to authenticated;

-- Admin only: full tax ID for 1099 filing.
create or replace function public.reveal_tin(p_profile uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare k text; c text;
begin
  if not is_admin() then raise exception 'Only an admin can see full tax IDs'; end if;
  select tin_cipher into c from tax_forms where profile_id = p_profile;
  if c is null then return null; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'w9_key';
  return pgp_sym_decrypt(decode(c, 'base64'), k);
end $$;
revoke execute on function public.reveal_tin(uuid) from public, anon;
grant execute on function public.reveal_tin(uuid) to authenticated;
