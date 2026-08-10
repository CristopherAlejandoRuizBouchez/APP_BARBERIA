# Configurar Supabase

## 1 · Proyectos

Crea **dos** proyectos en la región `us-east-1` (la misma que las funciones de Vercel en `iad1`, para que cada consulta del panel no cruce el continente):

- `barberia-os-prod` — datos reales
- `barberia-os-staging` — vistas previas de PR

Las vistas previas **jamás** apuntan a producción.

## 2 · Extensiones

Las crea la migración `0001_base.sql`, pero conviene comprobarlas en _Database → Extensions_:

| Extensión        | Para qué                                       |
| ---------------- | ---------------------------------------------- |
| `pgcrypto`       | `gen_random_uuid()`                            |
| `citext`         | slugs y correos insensibles a mayúsculas       |
| **`btree_gist`** | **el constraint que impide citas traslapadas** |
| `unaccent`       | búsqueda de clientes sin acentos               |
| `pg_cron`        | tareas programadas                             |
| `pg_net`         | llamadas a Edge Functions desde cron           |

Sin `btree_gist` no existe `citas_sin_traslape` y dos clientes pueden reservar el mismo hueco.

## 3 · Migraciones

```bash
supabase link --project-ref <id-del-proyecto>
supabase db push          # aplica solo lo pendiente
pnpm db:tipos             # regenera src/lib/supabase/tipos-db.ts
```

Orden de los archivos en `supabase/migrations/`:

| Archivo                           | Contenido                                                        |
| --------------------------------- | ---------------------------------------------------------------- |
| `0001_base.sql`                   | extensiones y tipos enum                                         |
| `0002_plataforma.sql`             | organizaciones, sucursales, membresías, planes, cobro            |
| `0003_seguridad.sql`              | funciones de autorización (`fn_es_superadmin`, `fn_es_miembro`…) |
| `0004_catalogo_agenda.sql`        | barberos, servicios, clientes, citas, **EXCLUDE anti-traslape**  |
| `0005_inventario_ventas.sql`      | productos, stock por sucursal, pedidos, ventas, finanzas         |
| `0006_funciones_core.sql`         | triggers de stock, pagos divididos, auditoría                    |
| `0007_funciones_negocio.sql`      | `fn_crear_cita`, `fn_crear_venta`, reservas, caja                |
| `0008_plataforma_funciones.sql`   | suspender, reactivar, cobros, recordatorios, índices, vistas     |
| `0009_rls.sql`                    | **Row Level Security de todas las tablas**                       |
| `0010_storage_cron.sql`           | buckets, políticas de archivos y `pg_cron`                       |
| `0011_integridad_multitenant.sql` | claves compuestas por organización y permisos RPC cerrados       |

Nunca se edita una migración ya aplicada: se añade una compensatoria.

## 4 · Primer superadministrador

No existe registro público de superadministradores. Se da de alta a mano:

```sql
-- 1. Crea el usuario desde Authentication → Users (o con la API de servicio).
-- 2. Con el UUID que te dé, ejecuta en el SQL Editor:
insert into platform_superadmins (usuario_id, nombre)
values ('<uuid-del-usuario>', 'Tu nombre');
```

A partir de ahí, ese usuario entra en `/superadmin`, crea barberías e invita propietarios.

## 5 · Autenticación

En _Authentication → URL Configuration_:

- **Site URL**: tu dominio de producción
- **Redirect URLs**: añade también el comodín de vistas previas
  `https://*-<tu-org>.vercel.app/**`

Sin esto, el correo de recuperación redirige a `localhost`.

Conecta un **SMTP propio** (Resend o similar). El servidor de cortesía de Supabase tiene límites muy bajos.

## 6 · Storage

Los buckets los crea `0010_storage_cron.sql`:

| Bucket         | Acceso                        | Contenido                                   |
| -------------- | ----------------------------- | ------------------------------------------- |
| `publico`      | lectura anónima               | logos, portadas, galería, fotos de producto |
| `comprobantes` | **privado, solo URL firmada** | comprobantes de transferencia               |
| `avatares`     | lectura anónima               | fotos de perfil                             |

Convención de rutas: `<organization_id>/<carpeta>/<archivo>`. El primer segmento es lo que permite aislar por organización en las políticas.

Los comprobantes **no tienen política de DELETE**: son evidencia de un pago.

## 7 · Secretos

```bash
supabase secrets set edge_shared_secret="$(openssl rand -base64 32)"
```

**Nunca dentro de una migración.** Las migraciones referencian el _nombre_ del secreto en Vault, jamás su valor: así el repositorio queda limpio aunque se haga público.

## 8 · Seed de demostración

```bash
supabase db reset     # SOLO EN LOCAL: borra y recrea con seed.sql
```

Crea dos barberías independientes con diseños distintos:

- `/b/navaja-negra` — Urban Premium, oscura, 2 sucursales, al corriente
- `/b/don-genaro` — Classic Gold, dorada, 1 sucursal, **pago vencido pero ACTIVA**

La segunda está vencida a propósito: demuestra que el sistema alerta pero no suspende solo.

## 9 · Respaldos

- Activa **PITR** en producción (requiere plan de pago).
- `pg_cron` no hace respaldos: programa el volcado desde el panel de Supabase.
- **Prueba la restauración antes de lanzar.** Un respaldo no verificado no es un respaldo.
