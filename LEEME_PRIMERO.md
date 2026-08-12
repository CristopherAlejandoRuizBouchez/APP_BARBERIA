# Actualización de ubicación — Barbería OS

Este paquete agrega:

- Dirección editable desde **Apariencia → Ubicación**.
- Mapa automático de Google Maps en la portada pública.
- Botón **Cómo llegar**.
- Página de contacto con dirección, mapa y ruta.
- Uso de la ubicación principal existente, sin volver a mostrar “Sucursales”.
- Respaldo automático de todos los archivos modificados.

No agrega una API de pago y no requiere una migración nueva.

## Instalación

1. Extrae los dos archivos de este ZIP dentro de:

   `C:\Users\crist\OneDrive\Desktop\APP_BARBERIA`

2. Abre la terminal de Visual Studio Code en esa carpeta.

3. Ejecuta:

   ```powershell
   node .\instalar-ubicacion.mjs
   ```

4. Si aparece **Actualización instalada correctamente**, inicia el proyecto:

   ```powershell
   pnpm dev
   ```

5. Entra con la cuenta del propietario y abre **Apariencia**.

6. Completa el nuevo **Paso 5 — Ubicación** y pulsa **Publicar cambios**.

7. Revisa la portada pública y la página `/contacto` de la barbería.

## Seguridad

Antes de modificar el código, el instalador comprueba todos los archivos y prepara los cambios en memoria. También crea una carpeta llamada `respaldo-antes-ubicacion-FECHA` con las versiones anteriores.

Si el proyecto no coincide con la versión esperada, el instalador se detiene sin modificar archivos.
