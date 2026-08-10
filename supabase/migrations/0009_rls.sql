-- ============================================================================
-- 0009 · Row Level Security
-- ============================================================================
-- Postura por defecto: DENEGAR. Una tabla con RLS activo y sin políticas no
-- devuelve nada. Cada política se escribe para conceder lo mínimo.
--
-- Cuatro reglas transversales:
--
--  1. AISLAMIENTO. Toda política filtra por `organization_id` contra las
--     membresías de la sesión. Es imposible leer datos de otra barbería.
--  2. SUSPENSIÓN REAL. Las políticas de escritura de tablas operativas exigen
--     `fn_org_operativa()`. Una barbería suspendida no puede crear citas,
--     ventas ni pedidos ni siquiera llamando a la API con un token válido.
--  3. EL PÚBLICO NO ESCRIBE. La llave anónima no puede insertar en `appointments`
--     ni en `orders`. Las reservas públicas pasan por funciones
--     `security definer` con limitador de peticiones.
--  4. INMUTABLES. `audit_log`, `inventory_movements` y `appointment_events` no
--     tienen políticas de UPDATE ni DELETE para NINGÚN rol.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'platform_settings', 'platform_superadmins', 'plans',
    'organizations', 'locations', 'profiles', 'organization_members',
    'organization_invitations', 'organization_settings', 'organization_themes',
    'organization_domains', 'organization_plan_assignments', 'organization_feature_flags',
    'billing_accounts', 'manual_payments', 'payment_proofs',
    'barbers', 'barber_locations', 'barber_services', 'barber_schedules', 'barber_blocks',
    'non_working_days', 'service_categories', 'services', 'service_locations',
    'customers', 'appointments', 'appointment_services', 'appointment_events',
    'appointment_access_tokens', 'gallery_items', 'testimonials', 'faqs',
    'suppliers', 'product_categories', 'products', 'product_stock',
    'inventory_movements', 'purchases', 'purchase_items',
    'stock_transfers', 'stock_transfer_items',
    'orders', 'order_items', 'inventory_reservations',
    'cash_registers', 'sales', 'sale_items', 'sale_payments',
    'sale_returns', 'sale_return_items',
    'expense_categories', 'expenses', 'commissions', 'commission_payouts',
    'audit_log', 'whatsapp_messages', 'public_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ── Plataforma ──────────────────────────────────────────────────────────────
create policy plataforma_lee on platform_settings for select to authenticated using (true);
create policy plataforma_escribe on platform_settings for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

create policy superadmins_lee on platform_superadmins for select to authenticated
  using (fn_es_superadmin() or usuario_id = (select auth.uid()));

create policy planes_lee on plans for select to authenticated using (activo or fn_es_superadmin());
create policy planes_escribe on plans for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

-- ── Organizaciones ──────────────────────────────────────────────────────────
-- El público puede resolver /b/<slug> solo si la barbería está activa.
create policy org_publica on organizations for select to anon
  using (estado = 'active');

create policy org_miembros_lee on organizations for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(id));

-- Crear una barbería es exclusivo del superadministrador: no hay registro
-- público libre de propietarios en esta versión.
create policy org_superadmin_escribe on organizations for insert to authenticated
  with check (fn_es_superadmin());

create policy org_actualiza on organizations for update to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(id))
  with check (fn_es_superadmin() or fn_es_admin_org(id));

-- ── Sucursales ──────────────────────────────────────────────────────────────
create policy sucursal_publica on locations for select to anon
  using (activa and fn_org_publica(organization_id));

create policy sucursal_lee on locations for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));

create policy sucursal_escribe on locations for all to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id))
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

-- ── Perfiles ────────────────────────────────────────────────────────────────
create policy perfil_propio on profiles for select to authenticated
  using (id = (select auth.uid()) or fn_es_superadmin()
         or exists (select 1 from organization_members m1
                    join organization_members m2 on m1.organization_id = m2.organization_id
                    where m1.usuario_id = (select auth.uid()) and m1.estado = 'activa'
                      and m2.usuario_id = profiles.id));

create policy perfil_edita on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── Membresías e invitaciones ───────────────────────────────────────────────
create policy membresia_lee on organization_members for select to authenticated
  using (fn_es_superadmin() or usuario_id = (select auth.uid()) or fn_es_miembro(organization_id));

create policy membresia_escribe on organization_members for all to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id))
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

create policy invitacion_lee on organization_invitations for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));

create policy invitacion_escribe on organization_invitations for all to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id))
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

-- ── Configuración y apariencia ──────────────────────────────────────────────
create policy ajustes_lee on organization_settings for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy ajustes_publico on organization_settings for select to anon
  using (fn_org_publica(organization_id));
create policy ajustes_escribe on organization_settings for all to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id))
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

create policy tema_publico on organization_themes for select to anon
  using (fn_org_publica(organization_id));
create policy tema_lee on organization_themes for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy tema_escribe on organization_themes for all to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id))
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

create policy dominio_publico on organization_domains for select to anon using (true);
create policy dominio_lee on organization_domains for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy dominio_escribe on organization_domains for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

create policy plan_asig_lee on organization_plan_assignments for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));
create policy plan_asig_escribe on organization_plan_assignments for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

create policy flags_publico on organization_feature_flags for select to anon
  using (fn_org_publica(organization_id));
create policy flags_lee on organization_feature_flags for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy flags_escribe on organization_feature_flags for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

-- ── Cobro de la plataforma ──────────────────────────────────────────────────
-- El propietario ve su adeudo (lo necesita para pagar), pero solo el
-- superadministrador puede modificarlo.
create policy cobro_lee on billing_accounts for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));
create policy cobro_escribe on billing_accounts for all to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

create policy pagos_lee on manual_payments for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));
-- El propietario puede REPORTAR un pago; solo el superadministrador lo verifica.
create policy pagos_reporta on manual_payments for insert to authenticated
  with check (
    (fn_es_admin_org(organization_id) and estado = 'pendiente')
    or fn_es_superadmin()
  );
create policy pagos_verifica on manual_payments for update to authenticated
  using (fn_es_superadmin()) with check (fn_es_superadmin());

create policy comprobante_lee on payment_proofs for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));
create policy comprobante_sube on payment_proofs for insert to authenticated
  with check (fn_es_superadmin() or fn_es_admin_org(organization_id));

-- ══════════════════════════════════════════════════════════════════════════
--  CATÁLOGO PÚBLICO Y OPERACIÓN
-- ══════════════════════════════════════════════════════════════════════════

-- Lectura pública del catálogo de una barbería ACTIVA.
create policy barbero_publico on barbers for select to anon
  using (activo and fn_org_publica(organization_id));
create policy servicio_publico on services for select to anon
  using (activo and fn_org_publica(organization_id));
create policy cat_servicio_publico on service_categories for select to anon
  using (activa and fn_org_publica(organization_id));
create policy servicio_sucursal_publico on service_locations for select to anon
  using (activo and fn_org_publica(organization_id));
create policy producto_publico on products for select to anon
  using (activo and visible_en_tienda and fn_org_publica(organization_id));
create policy cat_producto_publico on product_categories for select to anon
  using (activa and fn_org_publica(organization_id));
create policy galeria_publica on gallery_items for select to anon
  using (activo and fn_org_publica(organization_id));
create policy testimonio_publico on testimonials for select to anon
  using (aprobado and fn_org_publica(organization_id));
create policy faq_publica on faqs for select to anon
  using (activa and fn_org_publica(organization_id));
create policy horario_publico on barber_schedules for select to anon
  using (activo and fn_org_publica(organization_id));
create policy barbero_sucursal_publico on barber_locations for select to anon
  using (fn_org_publica(organization_id));
create policy barbero_servicio_publico on barber_services for select to anon
  using (fn_org_publica(organization_id));
create policy dia_no_laborable_publico on non_working_days for select to anon
  using (fn_org_publica(organization_id));

-- El público NO ve existencias exactas; la aplicación expone un semáforo.
create policy stock_publico on product_stock for select to anon
  using (fn_org_publica(organization_id));

-- ── Lectura y escritura del personal ────────────────────────────────────────
-- Tablas de catálogo: lee cualquier miembro, escribe la gestión.
do $$
declare t text;
begin
  foreach t in array array[
    'barbers', 'barber_locations', 'barber_services', 'barber_schedules', 'barber_blocks',
    'non_working_days', 'service_categories', 'services', 'service_locations',
    'suppliers', 'product_categories', 'products', 'product_stock',
    'gallery_items', 'testimonials', 'faqs'
  ] loop
    execute format($f$
      create policy %1$s_lee on public.%1$I for select to authenticated
        using (public.fn_es_superadmin() or public.fn_es_miembro(organization_id));
      create policy %1$s_escribe on public.%1$I for all to authenticated
        using (public.fn_es_gestion(organization_id))
        with check (public.fn_es_gestion(organization_id)
                    and public.fn_org_operativa(organization_id));
    $f$, t);
  end loop;
end $$;

-- ── Clientes ────────────────────────────────────────────────────────────────
-- El público NO puede leer la lista de clientes bajo ninguna circunstancia.
create policy cliente_lee on customers for select to authenticated
  using (
    fn_es_superadmin()
    or fn_es_operativo(organization_id)
    -- Un barbero ve solo a los clientes que ha atendido.
    or (fn_rol_en_org(organization_id) = 'barber' and exists (
          select 1 from appointments a
           where a.cliente_id = customers.id
             and a.barbero_id = fn_mi_barbero_id(organization_id)
        ))
  );

create policy cliente_escribe on customers for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

-- ── Citas ───────────────────────────────────────────────────────────────────
create policy cita_lee on appointments for select to authenticated
  using (
    fn_es_superadmin()
    or fn_es_operativo(organization_id)
    or barbero_id = fn_mi_barbero_id(organization_id)
  );

create policy cita_escribe on appointments for insert to authenticated
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

create policy cita_actualiza on appointments for update to authenticated
  using (fn_es_operativo(organization_id) or barbero_id = fn_mi_barbero_id(organization_id))
  with check (fn_org_operativa(organization_id));

create policy cita_servicio_lee on appointment_services for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy cita_servicio_escribe on appointment_services for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

-- Historial: solo lectura y solo inserción. Nunca UPDATE ni DELETE.
create policy evento_cita_lee on appointment_events for select to authenticated
  using (fn_es_superadmin() or fn_es_miembro(organization_id));
create policy evento_cita_inserta on appointment_events for insert to authenticated
  with check (fn_es_miembro(organization_id));

create policy token_cita_lee on appointment_access_tokens for select to authenticated
  using (fn_es_operativo(organization_id));

-- ── Inventario ──────────────────────────────────────────────────────────────
-- Movimientos: insertar y leer. Sin UPDATE ni DELETE para nadie.
create policy movimiento_lee on inventory_movements for select to authenticated
  using (fn_es_superadmin() or fn_es_gestion(organization_id));
create policy movimiento_inserta on inventory_movements for insert to authenticated
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

do $$
declare t text;
begin
  foreach t in array array[
    'purchases', 'purchase_items', 'stock_transfers', 'stock_transfer_items',
    'expense_categories', 'expenses'
  ] loop
    execute format($f$
      create policy %1$s_lee on public.%1$I for select to authenticated
        using (public.fn_es_superadmin() or public.fn_es_gestion(organization_id));
      create policy %1$s_escribe on public.%1$I for all to authenticated
        using (public.fn_es_gestion(organization_id))
        with check (public.fn_es_gestion(organization_id)
                    and public.fn_org_operativa(organization_id));
    $f$, t);
  end loop;
end $$;

-- ── Pedidos y reservas ──────────────────────────────────────────────────────
create policy pedido_lee on orders for select to authenticated
  using (fn_es_superadmin() or fn_es_operativo(organization_id));
create policy pedido_escribe on orders for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

create policy pedido_item_lee on order_items for select to authenticated
  using (fn_es_superadmin() or fn_es_operativo(organization_id));
create policy pedido_item_escribe on order_items for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

create policy reserva_lee on inventory_reservations for select to authenticated
  using (fn_es_superadmin() or fn_es_operativo(organization_id));
create policy reserva_escribe on inventory_reservations for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

-- ── Ventas ──────────────────────────────────────────────────────────────────
create policy venta_lee on sales for select to authenticated
  using (
    fn_es_superadmin()
    or fn_es_operativo(organization_id)
    or barbero_id = fn_mi_barbero_id(organization_id)
  );
create policy venta_escribe on sales for insert to authenticated
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));
create policy venta_actualiza on sales for update to authenticated
  using (fn_es_gestion(organization_id)) with check (fn_es_gestion(organization_id));

do $$
declare t text;
begin
  foreach t in array array['sale_items', 'sale_payments', 'sale_returns', 'sale_return_items', 'cash_registers'] loop
    execute format($f$
      create policy %1$s_lee on public.%1$I for select to authenticated
        using (public.fn_es_superadmin() or public.fn_es_operativo(organization_id));
      create policy %1$s_escribe on public.%1$I for all to authenticated
        using (public.fn_es_operativo(organization_id))
        with check (public.fn_es_operativo(organization_id)
                    and public.fn_org_operativa(organization_id));
    $f$, t);
  end loop;
end $$;

-- ── Comisiones ──────────────────────────────────────────────────────────────
-- Un barbero ve SOLO las suyas.
create policy comision_lee on commissions for select to authenticated
  using (
    fn_es_superadmin()
    or fn_es_gestion(organization_id)
    or barbero_id = fn_mi_barbero_id(organization_id)
  );
create policy comision_escribe on commissions for all to authenticated
  using (fn_es_gestion(organization_id))
  with check (fn_es_gestion(organization_id) and fn_org_operativa(organization_id));

create policy payout_lee on commission_payouts for select to authenticated
  using (fn_es_superadmin() or fn_es_gestion(organization_id)
         or barbero_id = fn_mi_barbero_id(organization_id));
-- Marcar una comisión como pagada es exclusivo de la administración.
create policy payout_escribe on commission_payouts for all to authenticated
  using (fn_es_admin_org(organization_id))
  with check (fn_es_admin_org(organization_id) and fn_org_operativa(organization_id));

-- ── Sistema ─────────────────────────────────────────────────────────────────
-- Auditoría: SOLO lectura por la administración. Sin INSERT desde la API
-- (la escriben los triggers), sin UPDATE, sin DELETE. Ni para el superadmin.
create policy auditoria_lee on audit_log for select to authenticated
  using (fn_es_superadmin() or fn_es_admin_org(organization_id));

create policy wa_lee on whatsapp_messages for select to authenticated
  using (fn_es_superadmin() or fn_es_operativo(organization_id));
create policy wa_escribe on whatsapp_messages for all to authenticated
  using (fn_es_operativo(organization_id))
  with check (fn_es_operativo(organization_id) and fn_org_operativa(organization_id));

-- El limitador se gestiona solo con la clave de servicio.
create policy intentos_ninguno on public_attempts for select to authenticated using (false);

-- ── Permisos de las funciones de negocio ────────────────────────────────────
revoke all on function
  public.fn_crear_cita(uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text),
  public.fn_crear_pedido_con_reserva(uuid, uuid, jsonb, text, text, text),
  public.fn_crear_venta(uuid, uuid, jsonb, jsonb, uuid, uuid, uuid, uuid, integer, text),
  public.fn_convertir_pedido_en_venta(uuid, uuid, jsonb),
  public.fn_suspender_organizacion(uuid, text),
  public.fn_reactivar_organizacion(uuid, text),
  public.fn_registrar_pago_manual(uuid, integer, date, text, date, date, text, boolean)
from public;

grant execute on function
  public.fn_crear_venta(uuid, uuid, jsonb, jsonb, uuid, uuid, uuid, uuid, integer, text),
  public.fn_convertir_pedido_en_venta(uuid, uuid, jsonb),
  public.fn_cancelar_venta(uuid, uuid, text),
  public.fn_cerrar_caja(uuid, uuid, integer, text),
  public.fn_mover_cita(uuid, uuid, timestamptz, uuid, text),
  public.fn_cancelar_pedido(uuid, uuid, text),
  public.fn_suspender_organizacion(uuid, text),
  public.fn_reactivar_organizacion(uuid, text),
  public.fn_registrar_pago_manual(uuid, integer, date, text, date, date, text, boolean)
to authenticated;

-- Reservar y pedir SÍ están al alcance del público, pero solo a través de
-- estas funciones controladas: la llave anónima no puede insertar en las
-- tablas directamente.
grant execute on function
  public.fn_crear_cita(uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text),
  public.fn_crear_pedido_con_reserva(uuid, uuid, jsonb, text, text, text),
  public.fn_slots_disponibles(uuid, uuid, uuid, date, integer, timestamptz),
  public.fn_barberos_disponibles(uuid, uuid, timestamptz, integer),
  public.fn_stock_disponible(uuid, uuid, timestamptz),
  public.fn_cancelar_cita(uuid, uuid, text, public.canal_cita)
to anon, authenticated;
