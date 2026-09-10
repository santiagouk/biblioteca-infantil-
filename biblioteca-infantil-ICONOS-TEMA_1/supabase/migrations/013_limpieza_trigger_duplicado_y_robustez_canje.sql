/* ============================================================================
   MIGRACIÓN 013 — LIMPIEZA DE TRIGGER DUPLICADO Y ROBUSTEZ DEL CANJE VIP
   ============================================================================
   Encontrados durante una auditoría completa de RLS/triggers/funciones del
   Foro de Poemas y del sistema de créditos, pedida por Santiago para dejar
   todo funcionando correctamente.

   1) `profiles` tenía DOS triggers idénticos ejecutando la misma función
      proteger_cambio_rol() en cada UPDATE (trg_proteger_cambio_rol de una
      migración antigua y trigger_proteger_cambio_rol de una posterior que
      no se dio cuenta de que ya existía). No causaba ningún error —ambos
      hacen exactamente lo mismo—, pero ejecutaba la misma validación dos
      veces en cada actualización de perfil. Se elimina el duplicado más
      reciente y se deja el original.

   2) canjear_libro_vip() valida "¿ya lo tenía desbloqueado?" y luego
      inserta en unlocked_vip_books. Si el mismo usuario hace doble clic
      muy rápido en "Canjear", dos solicitudes casi simultáneas podrían
      pasar esa validación antes de que la primera termine, y la segunda
      chocaría con la restricción UNIQUE (usuario_id, libro_id) — sin datos
      corruptos (todo se revierte solo, por ser una función transaccional),
      pero el usuario vería un error crudo de Postgres en vez de un mensaje
      claro. Se agrega manejo de esa excepción para devolver un mensaje
      amigable y no gastar créditos en ese caso.
   ========================================================================= */

-- 1) Eliminar el trigger duplicado (se conserva trg_proteger_cambio_rol)
drop trigger if exists trigger_proteger_cambio_rol on public.profiles;

-- 2) Manejo de la condición de carrera en el canje de libros VIP
create or replace function public.canjear_libro_vip(p_libro_id uuid)
returns table(exito boolean, mensaje text, creditos_restantes integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario_id uuid := auth.uid();
  v_costo integer;
  v_es_vip boolean;
  v_creditos_actuales integer;
  v_ya_desbloqueado boolean;
begin
  if v_usuario_id is null then
    return query select false, 'Debes iniciar sesión.', 0;
    return;
  end if;

  select es_vip, costo_creditos into v_es_vip, v_costo from public.books where id = p_libro_id;

  if v_es_vip is null then
    return query select false, 'El libro no existe.', 0;
    return;
  end if;

  if not v_es_vip then
    return query select false, 'Este libro no requiere créditos.', 0;
    return;
  end if;

  select exists(
    select 1 from public.unlocked_vip_books where usuario_id = v_usuario_id and libro_id = p_libro_id
  ) into v_ya_desbloqueado;

  select creditos into v_creditos_actuales from public.profiles where id = v_usuario_id;

  if v_ya_desbloqueado then
    return query select true, 'Ya tenías este libro desbloqueado.', v_creditos_actuales;
    return;
  end if;

  if v_creditos_actuales < v_costo then
    return query select false, 'No tienes créditos suficientes.', v_creditos_actuales;
    return;
  end if;

  begin
    perform public.registrar_credito(v_usuario_id, -v_costo, 'Canje de libro VIP', 'books', p_libro_id);
    insert into public.unlocked_vip_books (usuario_id, libro_id, creditos_pagados) values (v_usuario_id, p_libro_id, v_costo);
  exception when unique_violation then
    -- Dos clics casi simultáneos: la otra solicitud ya lo desbloqueó primero.
    -- Al lanzar la excepción, Postgres deshace automáticamente el descuento
    -- de créditos hecho arriba en esta misma función, así que no se pierden.
    select creditos into v_creditos_actuales from public.profiles where id = v_usuario_id;
    return query select true, 'Ya tenías este libro desbloqueado.', v_creditos_actuales;
    return;
  end;

  select creditos into v_creditos_actuales from public.profiles where id = v_usuario_id;
  return query select true, '¡Libro desbloqueado!', v_creditos_actuales;
end;
$function$;
