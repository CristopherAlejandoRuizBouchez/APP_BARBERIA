# Corrección de citas ocultas en Agenda

La cita se guardaba correctamente, pero la API encontraba dos relaciones posibles con la sucursal y la consulta del panel fallaba silenciosamente.

La migración `0013_relaciones_postgrest.sql` elimina únicamente las relaciones antiguas duplicadas. Conserva las relaciones compuestas que protegen el aislamiento entre barberías y no elimina citas ni información.

## Instalación

1. Extrae este ZIP en la carpeta principal del proyecto.
2. Acepta agregar el archivo nuevo.
3. Ejecuta `supabase db push` con el procedimiento de conexión utilizado anteriormente.
4. Actualiza la página **Agenda**.

