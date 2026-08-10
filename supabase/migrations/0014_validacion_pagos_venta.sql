-- ============================================================================
-- 0014 · Validación final de pagos de una venta
-- ============================================================================
-- El trigger es diferido. Por eso NEW conserva la fotografía de cada evento:
-- el INSERT inicial de fn_crear_venta tiene total 0 y un UPDATE posterior fija
-- el total real. Al ejecutarse al final de la transacción, siempre debemos leer
-- el estado ACTUAL de la venta y no la fotografía antigua guardada en NEW.

create or replace function public.fn_validar_venta_completada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_estado public.estado_venta;
  v_pagado integer;
begin
  select s.total_centavos, s.estado
    into v_total, v_estado
    from public.sales s
   where s.id = new.id;

  if not found or v_estado <> 'completada' then
    return null;
  end if;

  select coalesce(sum(p.monto_centavos), 0)
    into v_pagado
    from public.sale_payments p
   where p.venta_id = new.id;

  if v_pagado <> v_total then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format(
        'venta=%s total=%s pagado=%s diferencia=%s',
        new.id,
        v_total,
        v_pagado,
        v_total - v_pagado
      );
  end if;

  return null;
end;
$$;
