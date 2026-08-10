-- ============================================================================
-- 0001 · Extensiones y tipos base
-- ============================================================================
-- Barbería OS es multiempresa: una sola base de datos, un solo despliegue, y
-- aislamiento absoluto entre barberías garantizado por `organization_id` +
-- Row Level Security. Ningún dato de una organización puede alcanzarse desde
-- otra, ni por la aplicación, ni por la API, ni por un cliente SQL directo.
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";        -- texto insensible a mayúsculas
create extension if not exists "btree_gist";    -- constraints de exclusión
create extension if not exists "unaccent";      -- búsquedas sin acentos

-- ── Plataforma ──────────────────────────────────────────────────────────────

-- Estado del ciclo de vida de una barbería dentro de la plataforma.
-- NUNCA cambia solo: `suspended` siempre lo decide una persona.
create type estado_organizacion as enum (
  'onboarding',   -- creada, propietario invitado, aún sin operar
  'active',        -- operando con normalidad
  'suspended',     -- suspendida MANUALMENTE por el superadministrador
  'cancelled'      -- baja definitiva; los datos se conservan
);

-- Situación de cobro. Es informativa y dispara alertas, pero jamás suspende.
create type estado_pago_plataforma as enum (
  'current',       -- al corriente
  'due_soon',      -- vence pronto
  'past_due'       -- vencido: se avisa, NO se suspende automáticamente
);

create type estado_pago_manual as enum (
  'pendiente',     -- la barbería dice que pagó, falta verificar
  'verificado',    -- el superadministrador confirmó la transferencia
  'rechazado'      -- comprobante inválido
);

create type rol_organizacion as enum (
  'organization_owner',
  'organization_admin',
  'location_manager',
  'receptionist',
  'barber'
);

create type estado_membresia as enum ('activa', 'suspendida', 'revocada');
create type estado_invitacion as enum ('pendiente', 'aceptada', 'expirada', 'revocada');

-- Las cinco plantillas visuales. Cambian composición, no solo colores.
create type plantilla_visual as enum (
  'urban_premium',   -- oscura, moderna, callejera (la de la fase 0)
  'classic_gold',    -- elegante, clásica, negra y dorada
  'clean_studio',    -- clara, limpia, minimalista
  'vintage_barber',  -- retro, tradicional
  'modern_luxury'    -- premium, editorial, sofisticada
);

-- ── Operación ───────────────────────────────────────────────────────────────

create type estado_cita as enum (
  'pendiente', 'confirmada', 'en_proceso', 'completada', 'cancelada', 'no_asistio'
);

create type canal_cita as enum (
  'web', 'express_web', 'mostrador', 'telefono', 'whatsapp', 'sistema'
);

create type tipo_evento_cita as enum (
  'creada', 'confirmada', 'reprogramada', 'barbero_cambiado', 'servicios_cambiados',
  'iniciada', 'completada', 'cancelada', 'no_asistio', 'nota_agregada'
);

create type metodo_pago as enum (
  'efectivo', 'tarjeta_fisica', 'transferencia', 'otro'
);

create type estado_venta as enum ('completada', 'cancelada', 'devuelta_parcial', 'devuelta_total');

create type tipo_movimiento_inventario as enum (
  'inventario_inicial', 'entrada_compra', 'salida_venta', 'ajuste', 'merma',
  'devolucion_cliente', 'devolucion_proveedor', 'uso_interno',
  'traspaso_salida', 'traspaso_entrada'
);

create type estado_pedido as enum (
  'nuevo', 'confirmado', 'listo', 'entregado', 'cancelado', 'vencido'
);

create type estado_reserva_inventario as enum ('activa', 'convertida', 'liberada', 'cancelada');

create type estado_mensaje_wa as enum (
  'pendiente',          -- encolado, aún no le toca
  'listo_para_envio',   -- llegó su hora
  'manual_pendiente',   -- Cloud API apagada: va a la bandeja del personal
  'manual_enviado',
  'enviado',
  'fallido',
  'cancelado'
);

create type tipo_comision as enum ('porcentaje', 'monto_fijo');

create type estado_comision as enum ('pendiente', 'pagada', 'cancelada');

create type estado_caja as enum ('abierta', 'cerrada');

create type accion_auditoria as enum ('insert', 'update', 'delete', 'accion');

comment on type estado_organizacion is
  'La transición a suspended SIEMPRE es manual. Ninguna función automática la produce.';
