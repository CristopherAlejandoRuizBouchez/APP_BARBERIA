# Estado de la migración a multiempresa

**Fecha:** 7 de agosto de 2026

Este documento dice, sin adornos, qué está terminado y qué no. Se actualiza en cada entrega.

---

## Limitación del entorno de generación

El entorno donde se produjo esta entrega **tiene bloqueado el registro de npm** (`registry.npmjs.org` responde 403, directo y a través del proxy; yarn, npmmirror, unpkg y jsdelivr no tienen conexión).

Consecuencias, todas comprobadas:

| Comando                          | Estado                                                        |
| -------------------------------- | ------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | **No ejecutable.** Sin registro no hay resolución             |
| `pnpm-lock.yaml`                 | **No generable.** Un lockfile a mano tendría hashes falsos    |
| `pnpm lint`                      | No ejecutable (falta `typescript-eslint` y el plugin de Next) |
| `pnpm test`                      | No ejecutable con Vitest                                      |
| `pnpm build`                     | No ejecutable (falta Next)                                    |
| `pnpm test:e2e`                  | No ejecutable (Playwright necesita el build)                  |
| `pnpm audit`                     | No ejecutable                                                 |

Lo que **sí** se ejecutó, con la salida real más abajo: `tsc --strict`, las pruebas unitarias con el runner nativo de Node, `prettier --check` y análisis del árbol sintáctico de todos los archivos.

**No se afirma que ningún comando bloqueado haya pasado.**

---

## Terminado y verificado

### Base de datos multiempresa — completa

10 migraciones, ~3 900 líneas de SQL.

| Migración                       | Contenido                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0001_base.sql`                 | Extensiones y 16 tipos enum                                                                                                                                                                                                          |
| `0002_plataforma.sql`           | 15 tablas: organizaciones, sucursales, membresías, invitaciones, ajustes, temas, dominios, planes, banderas, cobro, pagos, comprobantes                                                                                              |
| `0003_seguridad.sql`            | 12 funciones de autorización, todas `security definer` con `search_path` fijado                                                                                                                                                      |
| `0004_catalogo_agenda.sql`      | Barberos, horarios, bloqueos, servicios, clientes, citas, historial, tokens de acceso                                                                                                                                                |
| `0005_inventario_ventas.sql`    | Productos, stock por sucursal, movimientos, compras, traspasos, pedidos, reservas, ventas, pagos divididos, devoluciones, gastos, comisiones, caja                                                                                   |
| `0006_funciones_core.sql`       | Triggers de stock, validación de pagos divididos, auditoría, métricas de cliente                                                                                                                                                     |
| `0007_funciones_negocio.sql`    | `fn_slots_disponibles`, `fn_crear_cita`, `fn_mover_cita`, `fn_cancelar_cita`, `fn_crear_pedido_con_reserva`, `fn_liberar_reservas_vencidas`, `fn_crear_venta`, `fn_convertir_pedido_en_venta`, `fn_cancelar_venta`, `fn_cerrar_caja` |
| `0008_plataforma_funciones.sql` | Suspender, reactivar, pagos manuales, recordatorios, 25 índices, 10 vistas                                                                                                                                                           |
| `0009_rls.sql`                  | **RLS en las 57 tablas**, con `force row level security`                                                                                                                                                                             |
| `0010_storage_cron.sql`         | 3 buckets con políticas por organización y 5 tareas de `pg_cron`                                                                                                                                                                     |

Invariantes que la base garantiza por sí sola:

- **Aislamiento.** `organization_id` en toda tabla operativa, con claves foráneas compuestas `(id, organization_id)`: es imposible enlazar una fila de una barbería con la de otra aunque la aplicación se equivoque.
- **Sin citas traslapadas.** `EXCLUDE USING gist (organization_id, barbero_id, rango)` con `btree_gist`, evaluado dentro de la transacción.
- **Stock nunca negativo.** `CHECK (stock_actual >= 0)` y saldo modificable solo por trigger sobre `inventory_movements`, con `FOR UPDATE`.
- **Pagos divididos exactos.** Constraint trigger **diferido**: la suma se comprueba al hacer commit.
- **Descuento único al convertir un pedido.** `UPDATE ... WHERE estado = 'activa'`: si otra transacción se adelantó, afecta cero filas y aborta.
- **Suspensión real.** Las políticas de escritura exigen `fn_org_operativa()`. Una barbería suspendida no puede crear citas, ventas ni pedidos ni llamando a la API con token válido.
- **Inmutables.** `audit_log`, `inventory_movements` y `appointment_events` no tienen políticas de `UPDATE` ni `DELETE` para ningún rol.

### Dominio en TypeScript — completo, con 188 pruebas

| Módulo                                  | Pruebas | Cubre                                                                                                                                                |
| --------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenant/roles.ts`                       | 28      | 6 roles, 38 permisos, aislamiento por sucursal, acceso durante suspensión, topes de descuento                                                        |
| `tenant/facturacion.ts`                 | 30      | Estados de cobro, **que una cuenta vencida nunca suspende sola**, transiciones válidas, quién puede suspender, mensaje público sin revelar el adeudo |
| `temas/plantillas.ts` + `validacion.ts` | 26      | Las 5 plantillas con composiciones distintas, variables CSS, **rechazo de inyección de CSS/HTML/JS**, contraste WCAG                                 |
| `env-parseo.ts`                         | 27      | Booleanos literales, cadenas vacías, que la identidad de barbería ya no viene del entorno                                                            |
| `dinero.ts`                             | 26      | Centavos, redondeo, factor exprés, comisiones, pagos divididos                                                                                       |
| `fechas.ts`                             | 22      | Zona por sucursal, hora de pared ↔ UTC, rejilla de slots, traslape                                                                                   |
| `telefono.ts`                           | 18      | E.164, formato antiguo `521`, rechazo de números no mexicanos                                                                                        |
| `folios.ts`                             | 11      | Alfabeto sin ambigüedades, no correlativos                                                                                                           |

### Otros elementos completos

- **Cinco plantillas visuales** con hero, navegación, tarjetas, servicios y productos **estructuralmente distintos** — no el mismo diseño recoloreado. Verificado por prueba: los 5 heros son diferentes, los 5 fondos son diferentes, y todas pasan contraste AA.
- **Resolución de tenant** (`tenant/resolver.ts`): busca por slug, deriva la sesión de `auth.uid()` y nunca confía en un `organization_id` del navegador.
- **Tres clientes de Supabase** con `import 'server-only'` en el administrativo.
- **Sitio público** `/b/[slug]`: layout con tema inyectado en servidor (sin parpadeo), metadatos y Open Graph por barbería, datos estructurados `HairSalon`, cabecera y pie que cambian de forma según la plantilla, portada con servicios, equipo y sucursales reales desde Supabase.
- **Seed** con dos barberías independientes: `navaja-negra` (Urban Premium, al corriente) y `don-genaro` (Classic Gold, **vencida a propósito pero activa**, para demostrar que la alerta no suspende).
- **Variables de entorno migradas a nivel plataforma.** Nombre, ciudad, WhatsApp y diseño ya no son variables globales.
- **Documentación**: `SUPABASE_SETUP.md`, `DEPLOYMENT.md`, `OPERATIONS.md`, `.env.example`.

---

## No terminado

Lo siguiente **no está implementado**. No hay maquetas ni botones decorativos: sencillamente no existen todavía.

| Módulo                             | Estado                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Resto de rutas `/b/[slug]/*`       | `servicios`, `barberos`, `reservar`, `tienda`, `producto`, `carrito`, `pedido`, `galeria`, `contacto`, `privacidad`, `terminos`, `mi-cita` |
| Autenticación e invitaciones       | Login, aceptación de invitación, `proxy.ts`                                                                                                |
| Panel `/panel/[organizationSlug]`  | Sigue siendo el esqueleto de una sola barbería                                                                                             |
| Editor visual de apariencia        | La validación y los temas existen; falta la interfaz                                                                                       |
| Punto de venta                     | La función `fn_crear_venta` existe; falta la pantalla                                                                                      |
| Agenda operativa                   | El motor de slots existe; falta la interfaz                                                                                                |
| Inventario, compras, traspasos     | Falta la interfaz                                                                                                                          |
| Clientes, gastos, comisiones, caja | Falta la interfaz                                                                                                                          |
| Reportes y gráficas                | Las vistas SQL existen; falta la interfaz                                                                                                  |
| Panel `/superadmin`                | Las funciones existen; falta la interfaz                                                                                                   |
| Pruebas pgTAP                      | No escritas                                                                                                                                |
| Pruebas E2E multiempresa           | No escritas                                                                                                                                |

---

## Salida real de la verificación

```
node   v22.22.2 · tsc 6.0.3 · prettier 3.8.1

tsc --strict sobre los módulos puros      → código de salida 0
pruebas unitarias                          → 188 tests · 188 pass · 0 fail
sintaxis de todos los archivos             → 55 archivos · 6 980 líneas · 0 errores
fugas de process.env fuera de env.ts       → 0
imports declarados en package.json         → todos
prettier --check .                         → limpio
```

---

## Para cerrar la migración

En una copia limpia, con Node 22 y pnpm 10.28.0:

```bash
corepack prepare pnpm@10.28.0 --activate
cp .env.example .env.local

pnpm install                     # genera pnpm-lock.yaml
rm -rf node_modules
pnpm install --frozen-lockfile
git diff --exit-code pnpm-lock.yaml

pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build
pnpm exec playwright install --with-deps chromium && pnpm test:e2e
pnpm audit --audit-level high
```

`.github/workflows/ci.yml` ejecuta esa secuencia en cada push.
