# Operación de la plataforma

Guía para quien administra Barbería OS: cobros, suspensiones y mantenimiento.

## Los dos flujos de dinero, que no se mezclan

|                | Clientes → barbería                           | Barbería → Barbería OS                |
| -------------- | --------------------------------------------- | ------------------------------------- |
| Tablas         | `sales`, `sale_payments`                      | `billing_accounts`, `manual_payments` |
| Métodos        | efectivo, tarjeta física, transferencia, otro | **solo transferencia**                |
| Quién registra | el personal de la barbería                    | **solo el superadministrador**        |
| Automático     | sí, al cobrar en el POS                       | no, siempre a mano                    |

No comparten tablas ni funciones. Un pago de cliente jamás afecta la cuenta de la barbería.

## Alta de una barbería

1. `/superadmin` → **Nueva barbería**: nombre, slug, plantilla inicial.
2. Crea la **primera sucursal** (dirección, WhatsApp, zona horaria).
3. Asigna **plan y mensualidad**, y la fecha de primer vencimiento.
4. **Invita al propietario** por correo. El enlace lleva un token del que solo se guarda el hash: si se filtra la base, los enlaces emitidos no sirven.
5. El propietario acepta, entra a `/panel/<slug>` y configura su apariencia.

No hay registro público de barberías. La bandera `NEXT_PUBLIC_FLAG_PUBLIC_SIGNUP` lo deja preparado para más adelante.

## Cobro mensual

### Registrar un pago

`/superadmin/cobros` → la barbería → **Registrar pago**: importe, fecha, referencia y comprobante.

Queda en `manual_payments` con `estado = 'verificado'`, tu usuario, la fecha de verificación y una entrada en auditoría. La próxima fecha avanza un mes respetando el día de corte.

### Estados de pago

| Estado     | Cuándo                                | Qué provoca |
| ---------- | ------------------------------------- | ----------- |
| `current`  | al corriente                          | nada        |
| `due_soon` | faltan ≤ 5 días o dentro de la gracia | aviso ámbar |
| `past_due` | pasó el vencimiento + días de gracia  | alerta roja |

> **Un pago vencido NUNCA suspende solo.** `fn_recalcular_estados_pago()` mueve `billing_accounts.estado_pago` y nada más; no toca `organizations.estado`. Hay pruebas que lo verifican con un año de retraso simulado.

## Suspender una barbería

Siempre manual, siempre con motivo escrito.

`/superadmin` → la barbería → **Suspender** → escribe el motivo → confirma.

Ejecuta `fn_suspender_organizacion(org, motivo)`, que exige ser superadministrador y deja registro de quién y cuándo.

### Qué pasa entonces

| Quién                         | Qué puede hacer                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Propietario / administrador   | Entrar **solo** a `/plan`: ver adeudo, datos de transferencia, contacto y subir comprobante |
| Encargado, recepción, barbero | Nada. El panel queda bloqueado                                                              |
| Público                       | «Sitio temporalmente no disponible». **Sin mencionar el adeudo**                            |
| Datos                         | **Se conservan íntegros.** No se borra nada                                                 |

La suspensión se comprueba en la base, no ocultando botones: las políticas de escritura exigen `fn_org_operativa()`. Una barbería suspendida no puede crear citas, ventas ni pedidos ni llamando a la API con un token válido.

### Reactivar

`/superadmin` → **Reactivar**. Toda la información y la funcionalidad vuelven de inmediato.

## Recordatorios de WhatsApp

Con `NEXT_PUBLIC_FLAG_WHATSAPP_CLOUD=false` (el estado inicial):

1. `pg_cron` encola los recordatorios de las próximas 48 h.
2. Cada mensaje se guarda con el texto **ya redactado** y `clave_idempotencia` única.
3. Aparecen en la **bandeja** del panel de cada barbería.
4. El personal pulsa y se abre `wa.me` con el mensaje cargado.
5. Al volver, lo marca como enviado.

Sin costo y sin depender de Meta. Cuando se active la Cloud API, la cola es la misma; solo cambia quién la despacha.

**Un recordatorio nunca se manda dos veces:** la clave es `UNIQUE` y el encolado usa `ON CONFLICT DO NOTHING`.

Por defecto: uno a 24 h activo, otro a 2 h apagado. Ambos configurables por barbería.

## Mantenimiento

`fn_mantenimiento_diario()` corre a las 03:00 CDMX y:

- purga `public_attempts` de más de 2 días
- marca invitaciones caducadas
- revoca tokens de cita vencidos
- recalcula estados de cobro

Todo idempotente y sin efectos destructivos.

## Recuperación ante errores

| Síntoma                                       | Qué mirar                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Una barbería no carga                         | `organizations.estado` — ¿está `suspended`?                                          |
| «ORGANIZACION_NO_OPERATIVA» al guardar        | La misma causa. Reactívala                                                           |
| «STOCK_INSUFICIENTE» con existencias visibles | Hay reservas activas. `fn_stock_disponible()` descuenta las de pedidos abiertos      |
| «PAGOS_NO_CUADRAN»                            | La suma de `sale_payments` no coincide con el total                                  |
| «HORARIO_OCUPADO»                             | El constraint de exclusión hizo su trabajo. Ofrece otro hueco                        |
| Recordatorios sin salir                       | Revisa `whatsapp_messages.estado`: `manual_pendiente` espera envío humano            |
| Stock descuadrado                             | No debería poder pasar. Compara `product_stock` con la suma de `inventory_movements` |

## Auditoría

`audit_log` registra altas, cambios y bajas de organizaciones, sucursales, membresías, temas, cobros, productos, servicios, barberos, ventas, citas, gastos y comisiones, con el antes y el después en `jsonb`.

**Es inmutable.** No existen políticas de `UPDATE` ni `DELETE` para ningún rol, ni siquiera para el superadministrador. Una bitácora que se puede editar no sirve como evidencia.
