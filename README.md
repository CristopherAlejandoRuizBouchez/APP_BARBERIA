# Barbería OS

Aplicación SaaS multiempresa para administrar varias barberías desde un solo despliegue. Cada negocio tiene propietario, personal, sucursales, datos, logo, colores y sitio público propios.

La versión entregada usa **Next.js 16 + React 19 + Supabase + PostgreSQL + Vercel**. Está pensada para México: moneda MXN, teléfonos +52 y zona horaria configurable por sucursal.

## Qué funciona

### Para clientes

- Sitio distinto por barbería en `/b/<slug>` con cinco plantillas visuales.
- Servicios, barberos, galería, sucursales y contacto.
- Reserva con horarios libres reales y protección contra citas traslapadas.
- Consulta y cancelación mediante token privado; la base solo conserva su hash.
- Tienda con carrito, reserva temporal de inventario y confirmación por WhatsApp.
- Sin cobro en línea por decisión de producto: la barbería acuerda el pago con el cliente.
- Aviso de privacidad y términos editables como punto de partida.

### Para cada barbería

- Tablero con ventas, citas, pedidos y alertas de stock.
- Agenda general y agenda personal del barbero.
- Punto de venta para servicios y productos, efectivo, tarjeta física o transferencia.
- Catálogos de servicios y productos.
- Clientes, proveedores, barberos, equipo y sucursales.
- Inventario por sucursal con libro de movimientos inmutable y stock nunca negativo.
- Ventas, pedidos, compras, gastos, comisiones, caja y reportes.
- Editor de plantilla, colores, logo, portada, eslogan y descripción.
- Configuración de agenda, pedidos, cita exprés y recordatorios.
- Pantalla de mensualidad y datos para transferencia.

### Para quien opera Barbería OS

- Alta de barberías e invitación por correo al propietario.
- Mensualidad y día de corte por negocio.
- Registro manual de transferencias.
- Activación, suspensión y reactivación **solo manual**, siempre con trazabilidad.
- El vencimiento solo genera un estado informativo; jamás bloquea automáticamente.
- Datos bancarios de la plataforma visibles para los propietarios.

## Arquitectura de seguridad

- Las 58 tablas operativas llevan `organization_id` y Row Level Security.
- Las referencias a sucursales usan claves foráneas compuestas con la organización.
- Los precios se recalculan dentro de PostgreSQL; el navegador no decide importes.
- Venta, reserva, pedido, stock y cierre de caja usan funciones transaccionales.
- El constraint `appointments.citas_sin_traslape` evita dobles reservas aun con solicitudes simultáneas.
- La llave `SUPABASE_SERVICE_ROLE_KEY` solo se importa desde módulos `server-only`.
- Los formularios públicos tienen límite transaccional de intentos.
- El editor visual no acepta CSS, HTML, JavaScript ni imágenes fuera del Storage configurado.
- Ninguna función automática puede poner una organización en `suspended`.

## Empezar

La guía completa y ordenada está en [INICIO_RAPIDO.md](./INICIO_RAPIDO.md).

```bash
cp .env.example .env.local
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Requisitos: Node 22.x, pnpm 10.28.x y un proyecto de Supabase.

## Comandos

```bash
pnpm dev          # desarrollo
pnpm build        # build de producción
pnpm start        # servidor de producción
pnpm lint         # ESLint
pnpm typecheck    # TypeScript estricto
pnpm test         # 192 pruebas unitarias y de contratos SQL
pnpm test:e2e     # humo con Playwright
pnpm verificar    # lint + tipos + pruebas + formato + build
```

## Rutas principales

| Ruta                 | Uso                               |
| -------------------- | --------------------------------- |
| `/`                  | Directorio de barberías activas   |
| `/b/<slug>`          | Sitio de una barbería             |
| `/b/<slug>/reservar` | Reserva pública                   |
| `/b/<slug>/tienda`   | Catálogo y pedido por WhatsApp    |
| `/b/<slug>/mi-cita`  | Autogestión con token privado     |
| `/iniciar-sesion`    | Acceso de propietarios y personal |
| `/panel/<slug>`      | Administración de una barbería    |
| `/superadmin`        | Control de toda la plataforma     |
| `/api/health`        | Sonda de salud                    |

## Decisiones de la primera versión

- Pagos de clientes en línea: apagados. El POS registra pagos presenciales y la tienda confirma por WhatsApp.
- Cobro de Barbería OS: transferencia y registro manual.
- Suspensión: únicamente una acción humana del superadministrador.
- WhatsApp Cloud API: opcional; sin ella se usa bandeja manual y enlaces `wa.me`.
- Dominios personalizados: modelados, pero apagados; la versión inicial usa `/b/<slug>`.

## Documentación

- [INICIO_RAPIDO.md](./INICIO_RAPIDO.md): instalación, Supabase y Vercel de principio a fin.
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md): esquema, Auth, Storage y primer superadministrador.
- [OPERATIONS.md](./OPERATIONS.md): cobros, suspensión, recuperación y operación diaria.
- [DEPLOYMENT.md](./DEPLOYMENT.md): despliegue, variables y reversión.

No subas `.env.local`, contraseñas, tokens ni llaves de servicio al repositorio.
