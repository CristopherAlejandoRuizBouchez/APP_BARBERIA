# Barbería OS — Correcciones al plan · v1.1

**Fecha:** 7 de agosto de 2026
**Estado:** aprobado. Sustituye a las secciones equivalentes del plan v1.0.
**Alcance confirmado:** una sucursal · clientes sin cuenta (identificados por teléfono/WhatsApp) · sin pagos en línea en v1 · pedidos por enlaces `wa.me` · WhatsApp Cloud API y Mercado Pago como fase posterior · arquitectura preparada para multi-sucursal, sin implementarla.

**Resumen de impacto en el modelo:** 32 → **35 tablas**. Tres nuevas (`reservas_inventario`, `pagos_venta`, `eventos_cita`), cuatro modificadas (`ventas`, `cortes_caja`, `mensajes_whatsapp`, `configuracion`), dos enums nuevos y tres ampliados.

---

## 1 · Reservación temporal de inventario

**Problema corregido:** los pedidos web se registraban sin comprometer existencias, así que dos clientes podían pedir la última pieza.

**Regla nueva:** el stock deja de tener un solo número. Ahora hay dos:

```
stock_disponible = stock_actual − Σ(reservas activas no vencidas)
```

`stock_actual` sigue siendo el físico en el local y solo cambia al entregarse el pedido (conversión a venta). La reserva es un compromiso temporal que no toca el físico.

### Tabla nueva: `reservas_inventario`

| Columna                  | Tipo                    | Notas                                                 |
| ------------------------ | ----------------------- | ----------------------------------------------------- |
| `id`                     | `uuid` PK               | `gen_random_uuid()`                                   |
| `pedido_id`              | `uuid` FK → `pedidos`   | `on delete cascade`                                   |
| `producto_id`            | `uuid` FK → `productos` |                                                       |
| `cantidad`               | `integer`               | `check (cantidad > 0)`                                |
| `estado`                 | `estado_reserva`        | `activa` · `convertida` · `liberada` · `cancelada`    |
| `reservada_en`           | `timestamptz`           | `default now()`                                       |
| `expira_en`              | `timestamptz`           | `reservada_en + configuracion.reserva_pedido_minutos` |
| `liberada_en`            | `timestamptz`           | nulo hasta liberarse por vencimiento                  |
| `convertida_en_venta_en` | `timestamptz`           | nulo hasta convertirse                                |
| `venta_id`               | `uuid` FK → `ventas`    | trazabilidad de la conversión                         |
| `creado_por`             | `uuid`                  | nulo si vino del sitio público                        |

```sql
create type estado_reserva as enum ('activa','convertida','liberada','cancelada');

-- Una sola reserva ACTIVA por (pedido, producto). Es lo que impide
-- reservar dos veces y, sobre todo, descontar dos veces al convertir.
create unique index reservas_una_activa
  on reservas_inventario (pedido_id, producto_id)
  where estado = 'activa';

create index reservas_vencimiento
  on reservas_inventario (expira_en)
  where estado = 'activa';

create index reservas_producto_activas
  on reservas_inventario (producto_id)
  where estado = 'activa';

-- Coherencia de marcas de tiempo con el estado
alter table reservas_inventario add constraint reservas_estado_coherente check (
     (estado = 'activa'     and liberada_en is null and convertida_en_venta_en is null)
  or (estado = 'liberada'   and liberada_en is not null)
  or (estado = 'convertida' and convertida_en_venta_en is not null and venta_id is not null)
  or (estado = 'cancelada'  and liberada_en is not null)
);
```

### Funciones transaccionales

| Función                                                                     | Qué hace                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fn_stock_disponible(p_producto_id, p_ahora)`                               | `stock_actual − Σ(cantidad)` de reservas `activa` con `expira_en > p_ahora`. `STABLE`.                                                                                                                                                                                                                                                               |
| `fn_crear_pedido_con_reserva(p_items jsonb, p_nombre, p_telefono, p_notas)` | Bloquea los productos con `for update`, valida disponible ≥ solicitado para **cada** línea, relee precios de la tabla, inserta `pedidos` + `pedido_items` + una `reservas_inventario` por línea con `expira_en` desde configuración, devuelve folio y minutos de vigencia. Si una sola línea no alcanza, revierte todo y lanza `STOCK_INSUFICIENTE`. |
| `fn_liberar_reservas_vencidas()`                                            | `update ... set estado='liberada', liberada_en=now() where estado='activa' and expira_en <= now()`. Si un pedido se queda sin reservas activas y sigue en `nuevo`, pasa a `cancelado` con motivo _reserva vencida_. Devuelve el conteo. Idempotente.                                                                                                 |
| `fn_cancelar_pedido(p_pedido_id, p_motivo)`                                 | Marca el pedido `cancelado` y sus reservas `cancelada` con `liberada_en = now()`.                                                                                                                                                                                                                                                                    |
| `fn_convertir_pedido_en_venta(p_pedido_id, p_pagos jsonb, p_cajero)`        | **El único punto donde baja el stock.** Vuelve a validar disponibilidad (por si la reserva venció entre medias), crea la venta, inserta `movimientos_inventario` tipo `salida_venta`, y pasa las reservas a `convertida`.                                                                                                                            |

### Cómo se garantiza el descuento único

La conversión no pregunta "¿ya se convirtió?"; lo hace en la propia escritura:

```sql
update reservas_inventario
   set estado = 'convertida',
       convertida_en_venta_en = now(),
       venta_id = v_venta_id
 where pedido_id = p_pedido_id
   and estado = 'activa'          -- ← si ya se convirtió, afecta 0 filas
returning producto_id, cantidad
into strict ...;                  -- ← y aquí falla, no descuenta dos veces
```

Dos llamadas simultáneas: la primera toma el bloqueo de fila y convierte; la segunda encuentra `estado <> 'activa'` y aborta sin tocar inventario.

### Configuración

`configuracion.reserva_pedido_minutos integer not null default 60` — editable desde el panel, sin desplegar. Se añade también `reserva_pedido_activa boolean default true` por si algún día se prefiere no comprometer stock.

---

## 2 · Pagos divididos

**Problema corregido:** `ventas.metodo_pago` era una sola columna, así que $200 en efectivo + $300 por transferencia no se podía registrar.

### Cambios en `ventas`

| Acción         | Columna                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Se elimina** | `metodo_pago`, `referencia_pago`                                                                                                                                 |
| **Se añade**   | `es_pago_mixto boolean not null default false` (mantenida por trigger)                                                                                           |
| **Se añade**   | `metodos_resumen text` — cadena legible para listados y filtros, p. ej. `efectivo+transferencia`. Denormalizada por trigger; **nunca** se usa para sumar dinero. |

### Tabla nueva: `pagos_venta`

| Columna             | Tipo                   | Notas                                                                          |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `id`                | `uuid` PK              |                                                                                |
| `venta_id`          | `uuid` FK → `ventas`   | `on delete cascade`                                                            |
| `metodo_pago`       | `metodo_pago`          | efectivo · tarjeta_fisica · transferencia · otro · mercado_pago (tras bandera) |
| `monto_centavos`    | `integer`              | `check (monto_centavos > 0)`                                                   |
| `referencia`        | `text`                 | Últimos 4 del voucher, folio de transferencia. **Nunca PAN ni CVV.**           |
| `recibido_centavos` | `integer`              | Solo efectivo                                                                  |
| `cambio_centavos`   | `integer`              | Solo efectivo                                                                  |
| `creado_en`         | `timestamptz`          | `default now()`                                                                |
| `registrado_por`    | `uuid` FK → `perfiles` |                                                                                |

```sql
-- Recibido y cambio solo tienen sentido en efectivo, y deben cuadrar.
alter table pagos_venta add constraint pagos_efectivo_coherente check (
  case when metodo_pago = 'efectivo'
       then recibido_centavos is not null
        and recibido_centavos >= monto_centavos
        and cambio_centavos = recibido_centavos - monto_centavos
       else recibido_centavos is null and cambio_centavos is null
  end
);

create index pagos_venta_por_venta  on pagos_venta (venta_id);
create index pagos_venta_por_metodo on pagos_venta (metodo_pago, creado_en);
```

### La suma debe cuadrar exactamente, verificado por la base

Se usa un **constraint trigger diferido**: la comprobación ocurre al hacer `commit`, no línea por línea, de modo que una venta puede insertar sus pagos en varias sentencias dentro de la misma transacción y aun así no puede confirmarse descuadrada.

```sql
create function fn_validar_pagos_venta() returns trigger
language plpgsql as $$
declare v_total int; v_pagado int; v_estado estado_venta;
begin
  select total_centavos, estado into v_total, v_estado
    from ventas where id = coalesce(new.venta_id, old.venta_id);

  if v_estado <> 'completada' then return null; end if;   -- borradores exentos

  select coalesce(sum(monto_centavos),0) into v_pagado
    from pagos_venta where venta_id = coalesce(new.venta_id, old.venta_id);

  if v_pagado <> v_total then
    raise exception 'PAGOS_NO_CUADRAN'
      using detail = format('total=%s pagado=%s diferencia=%s',
                            v_total, v_pagado, v_total - v_pagado);
  end if;
  return null;
end $$;

create constraint trigger trg_pagos_cuadran
  after insert or update or delete on pagos_venta
  deferrable initially deferred
  for each row execute function fn_validar_pagos_venta();

-- Y el mismo control al pasar la venta a 'completada'.
create constraint trigger trg_venta_completada_cuadra
  after insert or update of estado, total_centavos on ventas
  deferrable initially deferred
  for each row when (new.estado = 'completada')
  execute function fn_validar_venta_completada();
```

`fn_crear_venta` cambia de firma: en lugar de `p_metodo_pago` recibe `p_pagos jsonb`, un arreglo de `{metodo, monto_centavos, referencia?, recibido_centavos?}`. Para el caso común de un solo método, el POS manda un arreglo de un elemento; la interfaz no se complica.

### Cambios en `cortes_caja`

Los totales dejan de leerse de `ventas` y se agregan desde `pagos_venta`:

```sql
select p.metodo_pago, sum(p.monto_centavos) as total
  from pagos_venta p
  join ventas v on v.id = p.venta_id
 where v.corte_caja_id = $1
   and v.estado = 'completada'
 group by p.metodo_pago;
```

Columnas actualizadas: `efectivo_sistema_centavos`, `tarjeta_centavos`, `transferencia_centavos` y **nueva** `otro_centavos`. El arqueo sigue comparando `efectivo_contado_centavos` contra `efectivo_sistema_centavos + fondo_inicial_centavos`.

Vista nueva: `v_pagos_por_corte`.

---

## 3 · Historial de citas

### Tabla nueva: `eventos_cita`

```sql
create type tipo_evento_cita as enum (
  'creada', 'confirmada', 'reprogramada', 'barbero_cambiado',
  'servicios_cambiados', 'iniciada', 'completada',
  'cancelada', 'no_asistio', 'nota_agregada'
);
```

| Columna                                    | Tipo                   | Notas                                                                    |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `id`                                       | `uuid` PK              |                                                                          |
| `cita_id`                                  | `uuid` FK → `citas`    |                                                                          |
| `tipo`                                     | `tipo_evento_cita`     |                                                                          |
| `estado_anterior` / `estado_nuevo`         | `estado_cita`          | nulos en `creada`                                                        |
| `fecha_anterior` / `fecha_nueva`           | `timestamptz`          | inicio de la cita antes y después                                        |
| `barbero_anterior_id` / `barbero_nuevo_id` | `uuid`                 |                                                                          |
| `servicios_anterior` / `servicios_nuevo`   | `jsonb`                | instantánea `[{servicio_id, nombre, precio_centavos, duracion_minutos}]` |
| `motivo`                                   | `text`                 | obligatorio en `cancelada` y `no_asistio`                                |
| `canal`                                    | `canal_cita`           | web · express_web · mostrador · telefono · whatsapp · **sistema**        |
| `usuario_id`                               | `uuid` FK → `perfiles` | nulo si lo hizo el cliente desde el sitio                                |
| `actor`                                    | `text`                 | `staff` · `cliente` · `sistema` — quién actuó cuando no hay usuario      |
| `creado_en`                                | `timestamptz`          | `default now()`                                                          |

```sql
create index eventos_cita_por_cita on eventos_cita (cita_id, creado_en);
create index eventos_cita_por_tipo on eventos_cita (tipo, creado_en);
```

**Inmutable**, igual que `auditoria`: sin políticas de `update` ni `delete` para ningún rol.

**Confirmado: no se añade `reprogramada` como estado.** La cita conserva `confirmada` en su fecha nueva y el evento `reprogramada` guarda `fecha_anterior` → `fecha_nueva`. El estado describe la situación actual; el historial describe el camino.

Se escribe desde las funciones (`fn_crear_cita`, `fn_mover_cita`, `fn_cancelar_cita`…), que reciben el canal y el motivo, más un trigger de respaldo sobre `citas` que registra cualquier cambio de estado que llegue por otra vía. Así el historial no depende de que alguien se acuerde de escribirlo.

Vista nueva: `v_linea_tiempo_cita` — eventos legibles listos para la ficha de la cita.

---

## 4 · Recordatorios de WhatsApp

**Contradicción corregida.** Queda así:

| Recordatorio | Predeterminado              | Configurable      |
| ------------ | --------------------------- | ----------------- |
| Primero      | **24 h antes · activo**     | horas y encendido |
| Segundo      | **2 h antes · desactivado** | horas y encendido |

### Cambios en `configuracion`

```sql
recordatorio_1_activo       boolean not null default true,
recordatorio_1_horas_antes  integer not null default 24 check (between 1 and 168),
recordatorio_2_activo       boolean not null default false,
recordatorio_2_horas_antes  integer not null default 2  check (between 1 and 168),
recordatorio_ventana_minutos integer not null default 30,  -- tolerancia del cron
reserva_pedido_minutos      integer not null default 60,
reserva_pedido_activa       boolean not null default true
```

### Cambios en `mensajes_whatsapp`

```sql
create type estado_mensaje_wa as enum (
  'pendiente',        -- en cola, esperando su momento
  'listo_para_envio', -- llegó su hora, la Edge Function lo tomará
  'enviado',
  'fallido',
  'cancelado',        -- la cita se canceló antes de enviarse
  'manual_pendiente', -- Cloud API apagada → bandeja para envío manual
  'manual_enviado'
);
```

Columnas añadidas:

| Columna                                           | Notas                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `clave_idempotencia` `text` **`unique not null`** | Formato: `cita:<cita_id>:recordatorio:<1\|2>`. Es la garantía de que nunca se manda dos veces. |
| `ranura` `smallint`                               | 1 o 2, según el recordatorio                                                                   |
| `programado_para` `timestamptz`                   | `cita.fecha_hora_inicio − horas_antes`                                                         |
| `texto_renderizado` `text`                        | Mensaje ya armado, para copiar y pegar en el envío manual                                      |
| `intentos` `smallint default 0`                   |                                                                                                |
| `ultimo_error` `text`                             |                                                                                                |
| `enviado_manual_por` `uuid`                       |                                                                                                |

```sql
-- La misma clave no puede existir dos veces. Punto.
alter table mensajes_whatsapp
  add constraint mensajes_wa_idempotencia unique (clave_idempotencia);

-- Encolar es un no-op si ya existe.
insert into mensajes_whatsapp (...) values (...)
on conflict (clave_idempotencia) do nothing;
```

**Cancelación:** si la cita se cancela o se reprograma, los mensajes `pendiente` / `listo_para_envio` de esa cita pasan a `cancelado` y, si se reprogramó, se encolan de nuevo con la clave que incluye la fecha nueva.

**Con la Cloud API apagada** (bandera `whatsapp_cloud_api = false`, el estado inicial): el mensaje se crea igual, con el texto ya renderizado, en estado `manual_pendiente`. Aparece en la **bandeja de pendientes** del panel con un botón que abre `wa.me` con el mensaje precargado; al volver, el encargado lo marca como enviado. El sistema es útil desde el primer día sin pagar nada.

---

## 5 · Tareas programadas — Supabase Cron en lugar de Vercel

**Corregido:** ya no se depende de un cron de Vercel cada 15 minutos, incompatible con el plan Hobby.

### `pg_cron` — todo lo que solo toca la base

```sql
create extension if not exists pg_cron;

select cron.schedule('liberar-reservas',   '*/5 * * * *',
  $$ select fn_liberar_reservas_vencidas() $$);

select cron.schedule('marcar-recordatorios','*/10 * * * *',
  $$ select fn_marcar_recordatorios_listos() $$);   -- pendiente → listo_para_envio

select cron.schedule('encolar-recordatorios','0 * * * *',
  $$ select fn_encolar_recordatorios_proximos() $$); -- crea los mensajes de las próximas 48 h

select cron.schedule('resumen-semanal',    '0 14 * * 1',      -- lunes 08:00 CDMX
  $$ select fn_generar_resumen_semanal() $$);

select cron.schedule('mantenimiento',      '0 9 * * *',       -- diario 03:00 CDMX
  $$ select fn_mantenimiento_diario() $$);
  -- purga intentos_publicos, verifica stock vs movimientos, analyze
```

Los horarios de `pg_cron` son **UTC**, igual que los de Vercel. CDMX = UTC−6 todo el año.

### Envíos externos — Edge Function protegida

`pg_cron` no debe hacer peticiones HTTP a Meta directamente. El patrón es:

```
pg_cron ──▶ pg_net.http_post ──▶ Edge Function `enviar-whatsapp` ──▶ Meta Cloud API
             (cabecera Authorization con secreto leído de Vault)
```

```sql
select cron.schedule('despachar-whatsapp', '*/5 * * * *', $$
  select net.http_post(
    url     := (select valor from vault.decrypted_secrets where name = 'edge_url_whatsapp'),
    headers := jsonb_build_object(
                 'Content-Type','application/json',
                 'Authorization','Bearer ' ||
                   (select decrypted_secret from vault.decrypted_secrets
                     where name = 'edge_shared_secret')),
    body    := '{}'::jsonb
  )
$$);
```

**Los secretos nunca van en las migraciones.** Se cargan con `supabase secrets set` y se leen desde `vault`. Las migraciones referencian el nombre del secreto, jamás su valor. El repositorio queda limpio incluso si se hace público.

La Edge Function toma un lote de `listo_para_envio`, envía, y marca `enviado` o `fallido` con reintento exponencial (máximo 3). Si la bandera `whatsapp_cloud_api` está apagada, la función no hace nada y los mensajes se quedan en la bandeja manual.

### Vercel Cron

Se conserva únicamente para **una tarea diaria** compatible con cualquier plan (verificación de salud y aviso de respaldo), o como alternativa si algún día se contrata Pro. Ninguna función crítica depende de él.

---

## 6 · Costos y planes — nueva sección del README

Se añade `README.md` → _Costos, planes y qué funciona gratis_, con esta tabla:

### Lo primero: el plan Hobby de Vercel es para uso personal no comercial

Una barbería que cobra a sus clientes con este sistema es uso comercial, aunque el tráfico sea bajo. **Para operar de verdad en Vercel hay que contar con un plan de pago.** Mover los crons a `pg_cron` evita pagar por tareas programadas frecuentes, pero **no cambia** esa condición: son dos cosas distintas.

La aplicación no depende de nada exclusivo de Vercel —es Next.js estándar sobre Node 22— así que puede desplegarse en otro hosting si el costo resulta un problema.

### Funciona sin costo para desarrollo y demostraciones

Con los planes gratuitos se puede construir, probar y enseñar el sistema completo: sitio público · reservas · citas exprés · agenda · punto de venta · inventario y compras · clientes · gastos · comisiones · corte de caja · reportes · pedidos por `wa.me` · reservación temporal de inventario · historial de citas · bandeja manual de recordatorios · `pg_cron` y Edge Functions dentro de las cuotas gratuitas.

Ninguna funcionalidad queda detrás de un muro de pago: **la restricción es de licencia de uso, no de capacidad técnica.**

### Puede requerir **Vercel Pro**

| Situación                             | Por qué                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Operar comercialmente**             | El plan Hobby es para uso personal no comercial. **No hay mitigación técnica**: es una condición de los términos. |
| Crons frecuentes                      | Ya resuelto con `pg_cron`. `vercel.json` no declara ningún cron.                                                  |
| Protección de despliegues y roles     | Solo si trabaja más de una persona.                                                                               |
| Límites de ejecución y ancho de banda | Topes mensuales del plan gratuito; se cuentan también vistas previas y rastreos.                                  |

### Costos externos — WhatsApp Cloud API (fase 12)

- Desde julio de 2025 el cobro es **por mensaje entregado**, no por conversación de 24 h.
- Las plantillas de **utilidad** (confirmación y recordatorio) son **gratuitas dentro de la ventana de 24 h** abierta por el propio cliente; fuera de ella se cobran una por una.
- Las de **autenticación** siempre se cobran; **no las usamos**.
- Las de **marketing** son las más caras; **no están en el alcance**.
- La tarifa varía por país. Con un recordatorio de 24 h y volumen de barbería, el costo mensual es bajo, pero **no es cero**. Por eso el segundo recordatorio viene apagado.
- **Alternativa sin costo, activa desde el día uno:** enlaces `wa.me` y bandeja de envío manual.

### Mercado Pago

Fase posterior, tras bandera. Comisión por transacción según su tarifario vigente. No se almacena ningún dato bancario en ningún escenario.

---

## 7 · Resumen de cambios en el modelo

| Tabla                 | Cambio                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `reservas_inventario` | **Nueva**                                                                                                                        |
| `pagos_venta`         | **Nueva**                                                                                                                        |
| `eventos_cita`        | **Nueva**                                                                                                                        |
| `ventas`              | −`metodo_pago`, −`referencia_pago`, +`es_pago_mixto`, +`metodos_resumen`                                                         |
| `cortes_caja`         | +`otro_centavos`; totales agregados desde `pagos_venta`                                                                          |
| `mensajes_whatsapp`   | +`clave_idempotencia` (unique), +`ranura`, +`texto_renderizado`, +`enviado_manual_por`, +`ultimo_error`; enum de estado ampliado |
| `configuracion`       | +7 columnas (reservas y recordatorios)                                                                                           |
| `pedidos`             | Ciclo de vida ligado a las reservas; `cancelado` automático al vencer                                                            |

**Enums nuevos:** `estado_reserva`, `tipo_evento_cita`, `estado_mensaje_wa`.
**Enums ampliados:** `canal_cita` (+`sistema`), `metodo_pago` (sin cambios, `mercado_pago` sigue tras bandera), `estado_venta` (sin cambios).

**Funciones nuevas:** `fn_stock_disponible`, `fn_crear_pedido_con_reserva`, `fn_liberar_reservas_vencidas`, `fn_cancelar_pedido`, `fn_convertir_pedido_en_venta`, `fn_validar_pagos_venta`, `fn_validar_venta_completada`, `fn_registrar_evento_cita`, `fn_encolar_recordatorios_proximos`, `fn_marcar_recordatorios_listos`, `fn_generar_resumen_semanal`, `fn_mantenimiento_diario`.

**Funciones modificadas:** `fn_crear_venta` (recibe `p_pagos jsonb`), `fn_crear_cita` · `fn_mover_cita` · `fn_cancelar_cita` (registran evento y gestionan la cola de recordatorios).

**Vistas nuevas:** `v_stock_disponible`, `v_pagos_por_corte`, `v_linea_tiempo_cita`, `v_bandeja_whatsapp`.

Todo esto se implementa en la **Fase 1**, que sigue sin comenzar.
