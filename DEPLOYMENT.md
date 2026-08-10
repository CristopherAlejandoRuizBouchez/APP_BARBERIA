# Despliegue en Vercel

## Antes de nada: el costo

> Barbería OS está pensada para uso comercial. Revisa los términos y límites
> vigentes de Vercel antes de vender el servicio y elige un plan que permita tu
> tipo de uso. Mover los crons a `pg_cron` reduce ejecuciones en Vercel, pero no
> sustituye esa revisión.
>
> La aplicación es Next.js estándar sobre Node 22 y no usa nada exclusivo de Vercel: puede desplegarse en otro hosting si el costo resulta un problema.

## Configuración del proyecto

| Ajuste                       | Valor                            |
| ---------------------------- | -------------------------------- |
| Framework                    | Next.js (detección automática)   |
| Node                         | **22.x**                         |
| Install                      | `pnpm install --frozen-lockfile` |
| Build                        | `next build`                     |
| Región                       | `iad1` — la misma que Supabase   |
| Rama de producción           | `main`, protegida                |
| Protección de vistas previas | Activada                         |

## Variables de entorno

Cárgalas separadas por entorno y marca como **Sensitive** todo lo que no lleve `NEXT_PUBLIC_`.

| Variable                    | Local | Vista previa | Producción                  |
| --------------------------- | ----- | ------------ | --------------------------- |
| `NEXT_PUBLIC_APP_URL`       | sí    | auto         | sí                          |
| `NEXT_PUBLIC_PLATFORM_NAME` | sí    | sí           | sí                          |
| `NEXT_PUBLIC_BASE_DOMAIN`   | sí    | sí           | sí                          |
| `NEXT_PUBLIC_SUPABASE_*`    | sí    | staging      | producción                  |
| `SUPABASE_SERVICE_ROLE_KEY` | sí    | staging      | producción · **Sensitive**  |
| `SUPABASE_DATABASE_URL`     | sí    | no           | no — vive en GitHub Secrets |
| `PLATFORM_SUPERADMIN_EMAIL` | sí    | no           | sí                          |
| `PLATFORM_SUPPORT_WHATSAPP` | opc.  | no           | sí                          |
| `CRON_SECRET`               | no    | no           | sí                          |
| `WHATSAPP_*`                | opc.  | no           | fase posterior              |

**El nombre, el WhatsApp y el diseño de cada barbería NO son variables de entorno.** Viven en Supabase y se resuelven por petición.

## Migraciones

Nunca desde el build de Vercel: si el build aplicara una migración y luego fallara el despliegue, esquema y código quedarían desincronizados.

Corren en `.github/workflows/` después de que CI pase, con `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` como secretos de repositorio.

**Migraciones aditivas** (expandir → contraer): primero se añade la columna nueva y se despliega el código que escribe en ambas; solo cuando esa versión lleva días estable se elimina la vieja. Así revertir el código nunca lo deja frente a un esquema que no entiende.

## Dominios

Hoy: `tudominio.com/b/<slug>`.

Con `NEXT_PUBLIC_FLAG_CUSTOM_DOMAINS=true` se habilitan subdominios (`barberia.barberiaos.com`) y dominios propios. La tabla `organization_domains` ya los modela; la bandera viene apagada porque no es necesario para lanzar.

## Tareas programadas

`vercel.json` **no declara ningún cron**. Todo lo crítico corre en `pg_cron` de Supabase:

| Tarea                                      | Frecuencia  |
| ------------------------------------------ | ----------- |
| Liberar reservas de inventario vencidas    | cada 5 min  |
| Encolar recordatorios de las próximas 48 h | cada hora   |
| Marcar recordatorios listos                | cada 10 min |
| Mantenimiento diario                       | 03:00 CDMX  |
| Recalcular estados de cobro                | 04:00 CDMX  |

Los horarios de `pg_cron` son **UTC**. CDMX = UTC−6 todo el año.

## Reversión

| Qué falla                      | Cómo                                      | Tiempo          |
| ------------------------------ | ----------------------------------------- | --------------- |
| Código desplegado              | Instant Rollback de Vercel                | segundos        |
| Función SQL                    | `CREATE OR REPLACE` con la versión previa | un minuto       |
| Migración destructiva          | Migración compensatoria                   | minutos         |
| Datos corruptos                | Restauración a un punto en el tiempo      | minutos a horas |
| Una funcionalidad se porta mal | Apagar su bandera                         | inmediato       |

## Lista de verificación antes de abrir

- [ ] CI en verde: install, lint, typecheck, test, format, build, e2e, audit
- [ ] `pnpm-lock.yaml` generado y estable con `--frozen-lockfile`
- [ ] Primer superadministrador dado de alta
- [ ] SMTP propio conectado
- [ ] Redirect URLs de Auth registradas
- [ ] Restauración de respaldo **probada**
- [ ] Plan de Vercel adecuado para uso comercial
