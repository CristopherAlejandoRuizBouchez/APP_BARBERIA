# Actualización de privacidad y sitio público

Este parche separa los tres espacios de Barbería OS:

- **Superadministrador de plataforma:** altas, mensualidades, pagos, activación y suspensión.
- **Panel privado de cada barbería:** citas, clientes, ventas, caja, inventario, gastos y estadísticas, únicamente para sus miembros.
- **Sitio público:** `/b/<slug>` para clientes, sin iniciar sesión.

## Cómo instalarlo

1. Cierra el servidor con `Ctrl + C`.
2. Extrae este ZIP dentro de la carpeta principal del proyecto y acepta **reemplazar** los archivos.
3. Abre una terminal nueva de VS Code en esa carpeta.
4. Ejecuta la migración `0012_privacidad_operativa.sql` con `supabase db push`, usando el mismo procedimiento de conexión que ya utilizaste.
5. Inicia de nuevo con `pnpm dev`.

La barbería de prueba todavía puede abrirse con tu cuenta porque esa cuenta fue agregada explícitamente como `organization_owner`. En las barberías reales, tu superadministrador no debe aparecer en `organization_members`.

Sitio público de la demo: `http://localhost:3000/b/barberia-demo-xalapa`

