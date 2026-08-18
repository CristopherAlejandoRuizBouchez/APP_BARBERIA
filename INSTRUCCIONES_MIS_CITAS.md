# Mis citas automáticas — Barbería OS

Este paquete es acumulativo: conserva las mejoras anteriores de agenda de 7 días,
cobro desde la cita, varios servicios y cargos por reservación; además agrega la
nueva experiencia de **Mis citas** para el cliente.

## Qué cambia

- La cita se guarda automáticamente en el navegador donde fue creada.
- Al volver a **Mis citas**, se abre la cita más reciente sin cuenta ni contraseña.
- La navegación pública incluye un botón visible de **Mis citas**.
- Ya no se pide al cliente enviarse el enlace por WhatsApp.
- La tarjeta muestra cuenta regresiva, servicios, barbero, total y acceso a Google Calendar.
- Desde otro teléfono se puede recuperar con el folio y el WhatsApp completo usado al reservar.
- La recuperación no envía mensajes y está protegida con límite de intentos.

## Instalación

1. Cierra `pnpm dev` si está ejecutándose.
2. Copia las carpetas `src` y `supabase` de este paquete dentro de la raíz de
   `APP_BARBERIA`. Acepta combinar carpetas y reemplazar archivos.
3. Abre la terminal de Visual Studio Code en `APP_BARBERIA`.
4. Comprueba la aplicación:

   ```powershell
   pnpm build
   ```

5. Revisa la migración pendiente:

   ```powershell
   pnpm dlx supabase@beta db push --dry-run
   ```

   Debe aparecer, entre las pendientes, esta migración:

   ```text
   20260818200000_recuperacion_cita_cliente.sql
   ```

6. Aplícala:

   ```powershell
   pnpm dlx supabase@beta db push
   ```

7. Sube los cambios a GitHub:

   ```powershell
   git add src supabase
   git commit -m "Agregar consulta automatica de citas para clientes"
   git push origin main
   ```

Vercel iniciará un nuevo despliegue automáticamente.

## Prueba rápida

1. Abre el sitio público de una barbería en una ventana normal.
2. Crea una cita de prueba.
3. Pulsa **Ver mi cita** y confirma los datos.
4. Cierra la pestaña y vuelve a entrar al sitio.
5. Pulsa **Mis citas**: la cita debe abrirse automáticamente.
6. En una ventana de incógnito, abre **Mis citas** y prueba el acceso con el
   folio y el número completo registrado.

No hace falta configurar WhatsApp Cloud API, Twilio ni un servicio adicional.
