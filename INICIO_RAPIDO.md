# Inicio rápido: de ZIP a producción

Esta guía deja Barbería OS funcionando con Supabase y Vercel. Haz los pasos en orden.

## 1. Preparar el proyecto

Instala Node 22 y habilita pnpm:

```bash
corepack enable
corepack prepare pnpm@10.28.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
```

## 2. Crear Supabase

1. Crea un proyecto en Supabase.
2. En **Project Settings → API Keys**, copia:
   - Project URL.
   - Publishable key; si tu proyecto solo muestra `anon`, también es compatible.
   - `service_role`; es secreta y nunca debe llevar `NEXT_PUBLIC_`.
3. En `.env.local` llena:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SERVICE_ROLE
```

Conserva las demás variables de `.env.example`.

## 3. Crear la base

Instala o ejecuta la CLI de Supabase, inicia sesión y enlaza el proyecto:

```bash
pnpm dlx supabase@latest login
pnpm dlx supabase@latest link --project-ref TU_PROJECT_REF
pnpm dlx supabase@latest db push
```

Esto aplica, en orden, los archivos de `supabase/migrations/`. No pegues migraciones por partes ni cambies su orden.

Opcionalmente, para probar datos de ejemplo en un entorno desechable:

```bash
pnpm dlx supabase@latest db reset
```

`db reset` borra la base local. No lo ejecutes contra producción.

## 4. Crear tu superadministrador

1. En Supabase abre **Authentication → Users → Add user**.
2. Crea tu usuario con correo y contraseña; marca el correo como confirmado.
3. Copia su UUID.
4. En **SQL Editor** ejecuta, sustituyendo los valores:

```sql
insert into public.profiles (id, nombre)
values ('UUID_DEL_USUARIO', 'Tu nombre')
on conflict (id) do update set nombre = excluded.nombre;

insert into public.platform_superadmins (usuario_id, nombre, activo)
values ('UUID_DEL_USUARIO', 'Tu nombre', true)
on conflict (usuario_id) do update set activo = true, nombre = excluded.nombre;

insert into public.platform_settings (id, nombre_plataforma)
values (true, 'Barbería OS')
on conflict (id) do nothing;
```

No existe registro público de superadministradores.

## 5. Configurar correos de acceso

En **Authentication → URL Configuration**:

- Site URL local: `http://localhost:3000`.
- Redirect URL local: `http://localhost:3000/auth/confirm`.
- Después del despliegue agrega `https://TU-DOMINIO/auth/confirm`.
- Para previews agrega el patrón de Vercel que corresponda a tu cuenta.

Configura SMTP propio antes de invitar negocios reales. El correo de cortesía de Supabase tiene límites bajos.

## 6. Probar en local

```bash
pnpm dev
```

Abre `http://localhost:3000/iniciar-sesion`, entra con tu superadministrador y visita `/superadmin`.

Desde ahí:

1. Llena tus datos bancarios.
2. Crea una barbería, propietario y mensualidad.
3. El propietario recibe el correo, establece su contraseña y entra.
4. Activa la barbería cuando su catálogo esté listo.

Un negocio en `onboarding` no aparece al público. Uno `suspended` conserva sus datos, pero solo el propietario puede consultar el pago.

## 7. Flujo mínimo de una barbería

Antes de publicar, entra a `/panel/<slug>` y configura:

1. **Sucursales**: dirección y WhatsApp.
2. **Barberos**: al crear uno recibe horario inicial de lunes a sábado, 09:00–19:00.
3. **Servicios**: duración y precio.
4. **Productos**: precio y costo.
5. **Inventario**: registra una entrada inicial por sucursal.
6. **Apariencia**: plantilla, colores e imágenes alojadas en el bucket público de Supabase.
7. **Configuración**: anticipación, intervalos y recordatorios.

Prueba una reserva, un pedido y una venta antes de abrir al público.

## 8. Subir a GitHub y Vercel

1. Crea un repositorio privado en GitHub y sube el contenido de esta carpeta, no el ZIP exterior.
2. En Vercel selecciona **New Project → Import Git Repository**.
3. Vercel detecta Next.js. Usa:
   - Node 22.x.
   - Install: `pnpm install --frozen-lockfile`.
   - Build: `next build`.
4. Copia a Vercel todas las variables de `.env.example` y cambia:

```dotenv
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO
NEXT_PUBLIC_BASE_DOMAIN=TU-DOMINIO
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Marca `SUPABASE_SERVICE_ROLE_KEY` como **Sensitive**. No necesitas `SUPABASE_DATABASE_URL` en Vercel.

5. Despliega.
6. Regresa a Supabase Auth y agrega el dominio final a Site URL y Redirect URLs.

## 9. Cobrar y bloquear

- En `/superadmin` registra cada transferencia recibida.
- La próxima fecha de pago avanza un mes.
- Un vencimiento cambia el semáforo a `past_due`, pero no bloquea.
- Para bloquear, escribe un motivo y pulsa **Suspender**.
- Para devolver acceso, pulsa **Reactivar**.

El sistema no ejecuta suspensión automática ni procesa tarjetas para la mensualidad.

## 10. Verificación antes de vender

```bash
pnpm verificar
```

Comprueba también:

- Reserva simultánea del mismo horario: una debe rechazarse.
- Venta de producto sin stock: debe rechazarse.
- Usuario de una barbería cambiando el slug de la URL: no debe ver otra.
- Suspensión y reactivación manual.
- Correo de invitación y recuperación.
- Recordatorios en la bandeja de WhatsApp.
- Restauración de un respaldo de Supabase.

Las plantillas legales incluidas son un punto de partida, no asesoría jurídica.
