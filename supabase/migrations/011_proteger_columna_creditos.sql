/* ============================================================================
   MIGRACIÓN 011 — PROTECCIÓN DE LA COLUMNA "creditos" EN profiles
   ============================================================================
   Vulnerabilidad encontrada durante la revisión del sistema de créditos del
   Foro de Poemas (2026-09-06), del mismo tipo que la de auto-escalación de
   rol corregida en la migración 008: la política profiles_update_propio
   permite a cualquier usuario actualizar su propia fila
   (auth.uid() = id), y el trigger proteger_cambio_rol (migración 008) solo
   vigila la columna "rol". Nada impedía que un usuario llamara
   directamente a

     cliente.from('profiles').update({ creditos: 999999 }).eq('id', miId)

   desde la consola del navegador para inflar su propio saldo, sin pasar
   nunca por registrar_credito(). Se verificó el problema y la corrección
   con una prueba SQL explícita (UPDATE directo bloqueado; registrar_credito
   sigue funcionando con normalidad).

   Solución: igual que con el rol, un trigger BEFORE UPDATE revierte
   cualquier cambio directo a "creditos" que no venga acompañado de una
   bandera de sesión local (app.permitir_cambio_creditos), que solo
   registrar_credito() activa justo antes de su propio UPDATE. La bandera
   se establece con set_config(..., true) → "true" = local a la
   transacción actual, así que no puede quedar activada para otras
   operaciones ni para otras conexiones.
   ========================================================================= */

create or replace function public.proteger_cambio_creditos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.creditos is distinct from old.creditos then
    if coalesce(current_setting('app.permitir_cambio_creditos', true), '') <> 'true' then
      new.creditos := old.creditos;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_proteger_cambio_creditos on public.profiles;
create trigger trigger_proteger_cambio_creditos
  before update on public.profiles
  for each row
  execute function public.proteger_cambio_creditos();

comment on function public.proteger_cambio_creditos() is
  'Revierte cualquier cambio directo a profiles.creditos que no pase por registrar_credito() (protección análoga a proteger_cambio_rol).';

-- registrar_credito() es el único camino legítimo para cambiar el saldo:
-- activa la bandera (local a la transacción) justo antes de su propio
-- UPDATE, para que el trigger de arriba lo deje pasar.
create or replace function public.registrar_credito(
  p_usuario_id uuid,
  p_cantidad integer,
  p_motivo text,
  p_referencia_tabla text default null,
  p_referencia_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_cantidad = 0 or p_usuario_id is null then
    return;
  end if;

  perform set_config('app.permitir_cambio_creditos', 'true', true);

  -- El "greatest(0, ...)" es una red de seguridad para que el saldo nunca
  -- se vea negativo en pantalla; el ledger siempre queda con el monto real.
  update public.profiles
  set creditos = greatest(0, creditos + p_cantidad)
  where id = p_usuario_id;

  insert into public.credit_transactions (usuario_id, cantidad, motivo, referencia_tabla, referencia_id)
  values (p_usuario_id, p_cantidad, p_motivo, p_referencia_tabla, p_referencia_id);
end;
$$;
