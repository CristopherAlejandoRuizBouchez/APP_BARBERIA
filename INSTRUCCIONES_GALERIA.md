# Galería administrable — Barbería OS

## Funciones incluidas

- Nuevo apartado **Galería** en el panel del propietario.
- Subida de fotografías JPG, PNG, WEBP o AVIF de hasta 5 MB.
- Vista previa antes de publicar.
- Descripción breve de hasta 180 caracteres.
- Edición de la descripción.
- Opción para publicar u ocultar cada fotografía.
- Eliminación de la fotografía y de su registro.
- Presentación pública tipo portafolio, adaptable a celular y computadora.
- Fotografías ajustadas a cajas uniformes en proporción 4:3, sin deformarse.

La galería utiliza la tabla `gallery_items` y el bucket `publico` que Barbería OS
ya tiene configurados. **No necesita una migración nueva de Supabase.**

## Instalación

1. Cierra `pnpm dev` si está abierto.
2. Copia la carpeta `src` de este paquete dentro de la raíz de `APP_BARBERIA`.
3. Acepta combinar las carpetas y reemplazar los archivos existentes.
4. Desde la terminal de Visual Studio Code ejecuta:

   ```powershell
   pnpm build
   ```

5. Si la compilación termina correctamente, sube los cambios:

   ```powershell
   git add src
   git commit -m "Agregar galeria administrable"
   git push origin main
   ```

Vercel desplegará automáticamente la actualización.

## Prueba rápida

1. Entra como propietario.
2. Abre **Administración → Galería**.
3. Elige una fotografía, escribe una descripción y pulsa **Publicar fotografía**.
4. Pulsa **Ver sitio público** y confirma que aparezca.
5. Prueba **Ocultar**, **Publicar**, **Guardar** y **Eliminar**.
