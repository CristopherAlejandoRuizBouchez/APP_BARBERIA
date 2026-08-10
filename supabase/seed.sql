-- ============================================================================
-- SEED DE DEMOSTRACIÓN
-- ============================================================================
-- Dos barberías INDEPENDIENTES, con plantillas y datos completamente
-- separados. Sirve para comprobar a simple vista que ni los diseños ni la
-- información se mezclan.
--
--   /b/navaja-negra   → Urban Premium  · oscura y callejera  · 2 sucursales
--   /b/don-genaro     → Classic Gold   · clásica y elegante  · 1 sucursal
--
-- ⚠ NO SE EJECUTA EN PRODUCCIÓN.
--   `supabase db reset` lo aplica solo en local. Para el proyecto remoto se
--   corre a mano y a conciencia. No crea contraseñas: los usuarios se invitan
--   desde el panel del superadministrador.
-- ============================================================================

do $$
declare
  v_org_a uuid := '11111111-1111-4111-8111-111111111111';
  v_org_b uuid := '22222222-2222-4222-8222-222222222222';
  v_suc_a1 uuid := 'a1a1a1a1-1111-4111-8111-111111111111';
  v_suc_a2 uuid := 'a2a2a2a2-2222-4222-8222-222222222222';
  v_suc_b1 uuid := 'b1b1b1b1-1111-4111-8111-111111111111';
  v_plan_basico uuid := '99999999-1111-4111-8111-111111111111';
  v_plan_pro    uuid := '99999999-2222-4222-8222-222222222222';
  v_barbero uuid;
  v_servicio uuid;
  v_producto uuid;
  v_cliente uuid;
  i int;
begin

-- ── Configuración de la plataforma ──────────────────────────────────────────
insert into platform_settings (id, nombre_plataforma, correo_soporte, whatsapp_soporte,
                               banco_nombre, banco_titular, banco_clabe, instrucciones_pago, dominio_base)
values (true, 'Barbería OS', 'soporte@barberiaos.com', '525500000000',
        'Banco de ejemplo', 'Barbería OS SA de CV', '000000000000000000',
        'Transfiere el importe y sube el comprobante desde tu panel, en Plan y pagos.',
        'barberiaos.com')
on conflict (id) do nothing;

-- ── Planes ──────────────────────────────────────────────────────────────────
insert into plans (id, clave, nombre, descripcion, precio_mensual_centavos, max_sucursales, max_usuarios, max_barberos, orden)
values
  (v_plan_basico, 'basico', 'Básico', 'Una sucursal, hasta 5 barberos.', 89900, 1, 8, 5, 1),
  (v_plan_pro,    'pro',    'Pro',    'Hasta 3 sucursales y 15 barberos.', 149900, 3, 20, 15, 2)
on conflict (clave) do nothing;

-- ══════════════════════════════════════════════════════════════════════════
--  BARBERÍA A · Navaja Negra — urbana, oscura, dos sucursales
-- ══════════════════════════════════════════════════════════════════════════
insert into organizations (id, slug, nombre_comercial, razon_social, estado,
                           telefono_whatsapp, correo_contacto, zona_horaria)
values (v_org_a, 'navaja-negra', 'Navaja Negra', 'Navaja Negra SA de CV', 'active',
        '525511111111', 'hola@navajanegra.mx', 'America/Mexico_City')
on conflict (id) do nothing;

insert into locations (id, organization_id, slug, nombre, es_principal, calle, numero, colonia,
                       ciudad, estado_pais, codigo_postal, telefono_whatsapp, orden)
values
  (v_suc_a1, v_org_a, 'centro', 'Navaja Negra Centro', true,
   'Av. Álvaro Obregón', '128', 'Roma Norte', 'Ciudad de México', 'CDMX', '06700', '525511111111', 1),
  (v_suc_a2, v_org_a, 'sur', 'Navaja Negra Sur', false,
   'Av. Universidad', '940', 'Del Valle', 'Ciudad de México', 'CDMX', '03100', '525511111112', 2)
on conflict (id) do nothing;

insert into organization_settings (organization_id, express_multiplicador, reserva_pedido_minutos)
values (v_org_a, 2.00, 60) on conflict (organization_id) do nothing;

insert into organization_themes (organization_id, plantilla, eslogan, descripcion,
                                 color_primario, color_secundario, color_fondo, color_superficie, color_texto,
                                 fuente_titulos, fuente_cuerpo, estilo_botones, radio_bordes,
                                 estilo_tarjetas, textura_fondo, publicado_en)
values (v_org_a, 'urban_premium',
        'El corte no se improvisa.',
        'Corte, barba y ritual clásico en el corazón de la Roma. Reserva en línea y confirma por WhatsApp.',
        '#B88942', '#5B1E2D', '#0B0B0D', '#17181C', '#EFE7DA',
        'instrument-serif', 'instrument-sans', 'solido', 'recto', 'filete', 'grano', now())
on conflict (organization_id) do nothing;

insert into organization_domains (organization_id, tipo, valor, verificado, es_principal)
values (v_org_a, 'ruta', 'navaja-negra', true, true) on conflict (valor) do nothing;

insert into organization_plan_assignments (organization_id, plan_id) values (v_org_a, v_plan_pro);

insert into billing_accounts (organization_id, mensualidad_centavos, dia_corte, proxima_fecha_pago,
                              ultimo_pago_en, dias_gracia, estado_pago, referencia)
values (v_org_a, 149900, 10, current_date + 12, current_date - 18, 5, 'current', 'NAVAJA-001')
on conflict (organization_id) do nothing;

insert into organization_feature_flags (organization_id, clave, activo) values
  (v_org_a, 'tienda_online', true),
  (v_org_a, 'citas_express', true),
  (v_org_a, 'whatsapp_cloud_api', false),
  (v_org_a, 'mercado_pago', false)
on conflict do nothing;

-- Servicios
insert into service_categories (id, organization_id, slug, nombre, orden) values
  ('c1000000-0000-4000-8000-000000000001', v_org_a, 'cortes', 'Cortes', 1),
  ('c1000000-0000-4000-8000-000000000002', v_org_a, 'barba', 'Barba y afeitado', 2);

insert into services (organization_id, categoria_id, slug, nombre, descripcion,
                      duracion_minutos, precio_centavos, destacado, orden) values
  (v_org_a, 'c1000000-0000-4000-8000-000000000001', 'corte-clasico', 'Corte clásico',
   'Tijera, máquina y navaja. Lavado incluido.', 45, 35000, true, 1),
  (v_org_a, 'c1000000-0000-4000-8000-000000000001', 'fade', 'Fade a la piel',
   'Degradado limpio, acabado con navaja.', 50, 40000, true, 2),
  (v_org_a, 'c1000000-0000-4000-8000-000000000002', 'corte-y-barba', 'Corte y barba',
   'El servicio completo, con toalla caliente.', 75, 52000, true, 3),
  (v_org_a, 'c1000000-0000-4000-8000-000000000002', 'afeitado-navaja', 'Afeitado con navaja',
   'Ritual tradicional, tres pasadas.', 40, 30000, false, 4);

-- Barberos
insert into barbers (organization_id, slug, nombre, apodo, especialidades,
                     comision_servicio_valor, comision_producto_valor, color_agenda, orden) values
  (v_org_a, 'ruben-salas', 'Rubén Salas', 'El Maestro', array['Fades', 'Degradados'], 45, 10, '#B88942', 1),
  (v_org_a, 'ismael-ortega', 'Ismael Ortega', 'Isma', array['Barba', 'Afeitado clásico'], 40, 10, '#8A6B3A', 2),
  (v_org_a, 'diego-arreola', 'Diego Arreola', 'Yeyo', array['Corte texturizado'], 40, 8, '#5B1E2D', 3);

-- Cada barbero atiende en ambas sucursales, con horario de martes a sábado.
for v_barbero in select id from barbers where organization_id = v_org_a loop
  insert into barber_locations (barbero_id, location_id, organization_id)
  values (v_barbero, v_suc_a1, v_org_a), (v_barbero, v_suc_a2, v_org_a);

  for i in 2..6 loop  -- martes(2) a sábado(6)
    insert into barber_schedules (organization_id, barbero_id, location_id, dia_semana, hora_inicio, hora_fin)
    values (v_org_a, v_barbero, v_suc_a1, i, '10:00', '14:00'),
           (v_org_a, v_barbero, v_suc_a1, i, '15:00', '20:00');
  end loop;

  insert into barber_services (barbero_id, servicio_id, organization_id)
  select v_barbero, s.id, v_org_a from services s where s.organization_id = v_org_a;
end loop;

-- Productos
insert into product_categories (id, organization_id, slug, nombre, orden) values
  ('d1000000-0000-4000-8000-000000000001', v_org_a, 'cuidado', 'Cuidado', 1);

insert into suppliers (id, organization_id, nombre, contacto, telefono) values
  ('e1000000-0000-4000-8000-000000000001', v_org_a, 'Distribuidora Norte', 'Laura Méndez', '+525599990001');

insert into products (organization_id, categoria_id, proveedor_id, sku, codigo_barras, slug, nombre,
                      marca, descripcion, precio_venta_centavos, costo_centavos, destacado) values
  (v_org_a, 'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'NN-POM-100', '7500000000011', 'pomada-mate', 'Pomada mate 100 ml', 'Navaja Negra',
   'Fijación media, acabado seco.', 26000, 12000, true),
  (v_org_a, 'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'NN-ACE-30', '7500000000028', 'aceite-barba', 'Aceite para barba 30 ml', 'Navaja Negra',
   'Argán y jojoba.', 34000, 15000, true),
  (v_org_a, 'd1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'NN-SHA-250', '7500000000035', 'shampoo-solido', 'Shampoo sólido 250 g', 'Navaja Negra',
   'Sin sulfatos.', 22000, 9000, false);

-- Inventario inicial, distinto por sucursal.
for v_producto in select id from products where organization_id = v_org_a loop
  insert into product_stock (producto_id, location_id, organization_id, stock_actual, stock_minimo)
  values (v_producto, v_suc_a1, v_org_a, 0, 5), (v_producto, v_suc_a2, v_org_a, 0, 3);

  insert into inventory_movements (organization_id, location_id, producto_id, tipo, cantidad, motivo)
  values (v_org_a, v_suc_a1, v_producto, 'inventario_inicial', 24, 'Carga inicial de demostración'),
         (v_org_a, v_suc_a2, v_producto, 'inventario_inicial', 12, 'Carga inicial de demostración');
end loop;

-- Clientes
insert into customers (organization_id, telefono, nombre, whatsapp) values
  (v_org_a, '+525512340001', 'Cristopher Ruiz', '+525512340001'),
  (v_org_a, '+525512340002', 'Alejandro Beltrán', '+525512340002'),
  (v_org_a, '+525512340003', 'Marco Ibarra', '+525512340003'),
  (v_org_a, '+525512340004', 'Emilio Cárdenas', '+525512340004');

insert into testimonials (organization_id, cliente_nombre, texto, calificacion, aprobado, orden) values
  (v_org_a, 'Alejandro B.', 'Llevo dos años yendo. Nunca me han fallado con la hora.', 5, true, 1),
  (v_org_a, 'Marco I.', 'El fade queda perfecto y el ambiente es de otro nivel.', 5, true, 2);

insert into faqs (organization_id, pregunta, respuesta, orden) values
  (v_org_a, '¿Necesito crear una cuenta para reservar?',
   'No. Solo tu nombre y tu WhatsApp; con eso confirmamos la cita.', 1),
  (v_org_a, '¿Qué es una cita exprés?',
   'Es un lugar del mismo día con prioridad inmediata. Cuesta más porque te saltas la cola.', 2);

insert into expense_categories (organization_id, nombre, tipo) values
  (v_org_a, 'Renta', 'fijo'), (v_org_a, 'Insumos', 'variable'), (v_org_a, 'Publicidad', 'variable');

-- ══════════════════════════════════════════════════════════════════════════
--  BARBERÍA B · Don Genaro — clásica, dorada, una sucursal
--  Datos, diseño y precios completamente distintos.
-- ══════════════════════════════════════════════════════════════════════════
insert into organizations (id, slug, nombre_comercial, razon_social, estado,
                           telefono_whatsapp, correo_contacto, zona_horaria)
values (v_org_b, 'don-genaro', 'Barbería Don Genaro', 'Genaro y Asociados SC', 'active',
        '525522222222', 'contacto@dongenaro.mx', 'America/Mexico_City')
on conflict (id) do nothing;

insert into locations (id, organization_id, slug, nombre, es_principal, calle, numero, colonia,
                       ciudad, estado_pais, codigo_postal, telefono_whatsapp, orden)
values (v_suc_b1, v_org_b, 'centro', 'Don Genaro Centro', true,
        'Enríquez', '45', 'Centro', 'Xalapa', 'Veracruz', '91000', '525522222222', 1)
on conflict (id) do nothing;

insert into organization_settings (organization_id, express_multiplicador, express_activa,
                                   reserva_pedido_minutos, recordatorio_2_activo)
values (v_org_b, 1.50, false, 90, true) on conflict (organization_id) do nothing;

-- Plantilla, colores y tipografía DISTINTOS: es lo que demuestra que el diseño
-- no se comparte entre barberías.
insert into organization_themes (organization_id, plantilla, eslogan, descripcion,
                                 color_primario, color_secundario, color_fondo, color_superficie, color_texto,
                                 fuente_titulos, fuente_cuerpo, estilo_botones, radio_bordes,
                                 estilo_tarjetas, textura_fondo, publicado_en)
values (v_org_b, 'classic_gold',
        'Tradición desde 1978.',
        'Tres generaciones de barberos en el centro de Xalapa. Afeitado clásico y atención de siempre.',
        '#C9A227', '#7A5C1E', '#0A0908', '#141210', '#F2E9D8',
        'instrument-serif', 'instrument-sans', 'contorno', 'recto', 'marco', 'lineas', now())
on conflict (organization_id) do nothing;

insert into organization_domains (organization_id, tipo, valor, verificado, es_principal)
values (v_org_b, 'ruta', 'don-genaro', true, true) on conflict (valor) do nothing;

insert into organization_plan_assignments (organization_id, plan_id) values (v_org_b, v_plan_basico);

-- Esta cuenta está VENCIDA a propósito: sirve para comprobar que el sistema
-- alerta pero NO suspende sola. La organización sigue en 'active'.
insert into billing_accounts (organization_id, mensualidad_centavos, dia_corte, proxima_fecha_pago,
                              ultimo_pago_en, dias_gracia, estado_pago, referencia, notas_privadas)
values (v_org_b, 89900, 1, current_date - 20, current_date - 50, 5, 'past_due', 'GENARO-001',
        'Vencida a propósito en el seed: demuestra que la alerta no suspende automáticamente.')
on conflict (organization_id) do nothing;

insert into organization_feature_flags (organization_id, clave, activo) values
  (v_org_b, 'tienda_online', true),
  (v_org_b, 'citas_express', false),
  (v_org_b, 'whatsapp_cloud_api', false)
on conflict do nothing;

insert into service_categories (id, organization_id, slug, nombre, orden) values
  ('c2000000-0000-4000-8000-000000000001', v_org_b, 'clasicos', 'Clásicos', 1);

insert into services (organization_id, categoria_id, slug, nombre, descripcion,
                      duracion_minutos, precio_centavos, destacado, orden) values
  (v_org_b, 'c2000000-0000-4000-8000-000000000001', 'corte-caballero', 'Corte caballero',
   'Tijera y peine, como se ha hecho siempre.', 40, 18000, true, 1),
  (v_org_b, 'c2000000-0000-4000-8000-000000000001', 'afeitado-tradicional', 'Afeitado tradicional',
   'Navaja, toalla caliente y bálsamo.', 35, 15000, true, 2),
  (v_org_b, 'c2000000-0000-4000-8000-000000000001', 'corte-nino', 'Corte para niño',
   'Paciencia incluida.', 30, 12000, false, 3);

insert into barbers (organization_id, slug, nombre, apodo, especialidades,
                     comision_servicio_valor, comision_producto_valor, color_agenda, orden) values
  (v_org_b, 'genaro-lopez', 'Genaro López', 'Don Genaro', array['Afeitado clásico'], 50, 12, '#C9A227', 1),
  (v_org_b, 'genaro-lopez-jr', 'Genaro López Jr.', 'Junior', array['Corte caballero'], 40, 10, '#7A5C1E', 2);

for v_barbero in select id from barbers where organization_id = v_org_b loop
  insert into barber_locations (barbero_id, location_id, organization_id) values (v_barbero, v_suc_b1, v_org_b);

  for i in 1..6 loop  -- lunes a sábado, jornada continua
    insert into barber_schedules (organization_id, barbero_id, location_id, dia_semana, hora_inicio, hora_fin)
    values (v_org_b, v_barbero, v_suc_b1, i, '09:00', '19:00');
  end loop;

  insert into barber_services (barbero_id, servicio_id, organization_id)
  select v_barbero, s.id, v_org_b from services s where s.organization_id = v_org_b;
end loop;

insert into product_categories (id, organization_id, slug, nombre, orden) values
  ('d2000000-0000-4000-8000-000000000001', v_org_b, 'tradicional', 'Tradicional', 1);

insert into products (organization_id, categoria_id, sku, codigo_barras, slug, nombre, marca,
                      descripcion, precio_venta_centavos, costo_centavos, destacado) values
  (v_org_b, 'd2000000-0000-4000-8000-000000000001', 'DG-LOC-200', '7500000000042',
   'locion-despues-afeitar', 'Loción después de afeitar 200 ml', 'Don Genaro',
   'Fórmula de la casa, sin alcohol.', 16000, 7000, true),
  (v_org_b, 'd2000000-0000-4000-8000-000000000001', 'DG-JAB-100', '7500000000059',
   'jabon-afeitar', 'Jabón de afeitar en pastilla', 'Don Genaro',
   'Espuma densa, aroma a sándalo.', 14000, 6000, true);

for v_producto in select id from products where organization_id = v_org_b loop
  insert into product_stock (producto_id, location_id, organization_id, stock_actual, stock_minimo)
  values (v_producto, v_suc_b1, v_org_b, 0, 4);

  insert into inventory_movements (organization_id, location_id, producto_id, tipo, cantidad, motivo)
  values (v_org_b, v_suc_b1, v_producto, 'inventario_inicial', 18, 'Carga inicial de demostración');
end loop;

insert into customers (organization_id, telefono, nombre, whatsapp) values
  -- El mismo teléfono que un cliente de Navaja Negra: son personas distintas
  -- para el sistema, y sus historiales NO se mezclan.
  (v_org_b, '+525512340001', 'Cristopher R.', '+525512340001'),
  (v_org_b, '+522281110001', 'Rodrigo Solís', '+522281110001'),
  (v_org_b, '+522281110002', 'Fernando Aguilar', '+522281110002');

insert into testimonials (organization_id, cliente_nombre, texto, calificacion, aprobado, orden) values
  (v_org_b, 'Rodrigo S.', 'Mi papá venía aquí. Ahora vengo yo con mi hijo.', 5, true, 1);

insert into faqs (organization_id, pregunta, respuesta, orden) values
  (v_org_b, '¿Atienden sin cita?',
   'Sí, pero con cita no esperas. Puedes reservar desde el sitio.', 1);

insert into expense_categories (organization_id, nombre, tipo) values
  (v_org_b, 'Renta', 'fijo'), (v_org_b, 'Insumos', 'variable');

-- ── Citas de demostración, repartidas en los próximos días ──────────────────
for i in 1..14 loop
  select id into v_barbero from barbers where organization_id = v_org_a order by random() limit 1;
  select id into v_cliente from customers where organization_id = v_org_a order by random() limit 1;
  select id into v_servicio from services where organization_id = v_org_a order by random() limit 1;

  begin
    insert into appointments (organization_id, location_id, folio, cliente_id, barbero_id,
                              fecha_hora_inicio, fecha_hora_fin, estado, canal, subtotal_centavos, total_centavos)
    values (v_org_a, v_suc_a1, fn_generar_folio('BQ'), v_cliente, v_barbero,
            (current_date + (i / 3))::timestamptz + make_interval(hours => 10 + (i % 8)),
            (current_date + (i / 3))::timestamptz + make_interval(hours => 10 + (i % 8), mins => 45),
            case when i % 4 = 0 then 'confirmada' else 'pendiente' end::estado_cita,
            'web', 35000, 35000);
  exception when others then
    -- El constraint de exclusión rechazó un traslape generado al azar.
    -- Es exactamente lo que debe pasar; se ignora y se sigue.
    null;
  end;
end loop;

raise notice 'Seed aplicado: 2 barberías, 3 sucursales, 7 servicios, 5 barberos, 5 productos.';
raise notice 'Navaja Negra  → /b/navaja-negra  (Urban Premium, al corriente)';
raise notice 'Don Genaro    → /b/don-genaro    (Classic Gold, pago VENCIDO pero ACTIVA)';

end $$;
