-- ============================================================================
-- 0011 · Integridad multiempresa y permisos de funciones
-- ============================================================================

-- Una sucursal se referencia siempre junto con su organización. Esto impide
-- combinar organization_id de una barbería con location_id de otra.
alter table public.locations
  add constraint locations_id_organization_unique unique (id, organization_id);

alter table public.barber_locations
  add constraint barber_locations_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.service_locations
  add constraint service_locations_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.barber_schedules
  add constraint barber_schedules_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.barber_blocks
  add constraint barber_blocks_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.non_working_days
  add constraint non_working_days_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.appointments
  add constraint appointments_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.gallery_items
  add constraint gallery_items_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete set null (location_id);
alter table public.product_stock
  add constraint product_stock_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.inventory_movements
  add constraint inventory_movements_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.purchases
  add constraint purchases_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.stock_transfers
  add constraint stock_transfers_origin_org_fk foreign key (origen_location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict,
  add constraint stock_transfers_destination_org_fk foreign key (destino_location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.orders
  add constraint orders_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.inventory_reservations
  add constraint inventory_reservations_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete cascade;
alter table public.cash_registers
  add constraint cash_registers_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.sales
  add constraint sales_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.expenses
  add constraint expenses_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete set null (location_id);
alter table public.commissions
  add constraint commissions_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete restrict;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_location_org_fk foreign key (location_id, organization_id)
  references public.locations (id, organization_id) on delete set null (location_id);

-- Los arreglos de sucursales en membresías e invitaciones también se validan.
create or replace function public.trg_validar_sucursales_asignadas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(new.sucursales) > 0 and exists (
    select 1 from unnest(new.sucursales) s(id)
    where not exists (
      select 1 from public.locations l
      where l.id = s.id and l.organization_id = new.organization_id
    )
  ) then
    raise exception 'SUCURSAL_DE_OTRA_ORGANIZACION';
  end if;
  return new;
end;
$$;

create trigger validar_sucursales_membresia
  before insert or update of organization_id, sucursales on public.organization_members
  for each row execute function public.trg_validar_sucursales_asignadas();
create trigger validar_sucursales_invitacion
  before insert or update of organization_id, sucursales on public.organization_invitations
  for each row execute function public.trg_validar_sucursales_asignadas();

-- Postgres concede EXECUTE a PUBLIC por defecto. Cerramos todo el esquema y
-- reabrimos únicamente la superficie RPC que necesita la aplicación.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.fn_es_superadmin(),
  public.fn_es_miembro(uuid),
  public.fn_rol_en_org(uuid),
  public.fn_tiene_rol(uuid, public.rol_organizacion[]),
  public.fn_es_admin_org(uuid),
  public.fn_es_gestion(uuid),
  public.fn_es_operativo(uuid),
  public.fn_puede_ver_sucursal(uuid),
  public.fn_mi_barbero_id(uuid),
  public.fn_org_operativa(uuid),
  public.fn_org_publica(uuid),
  public.fn_mis_organizaciones()
to authenticated;

grant execute on function
  public.fn_org_publica(uuid),
  public.fn_org_operativa(uuid),
  public.fn_slots_disponibles(uuid, uuid, uuid, date, integer, timestamptz),
  public.fn_barberos_disponibles(uuid, uuid, timestamptz, integer),
  public.fn_stock_disponible(uuid, uuid, timestamptz),
  public.fn_crear_cita(uuid, uuid, uuid, uuid[], timestamptz, text, text, boolean, public.canal_cita, text),
  public.fn_crear_pedido_con_reserva(uuid, uuid, jsonb, text, text, text),
  public.fn_consultar_cita_publica(uuid, text),
  public.fn_cancelar_cita_publica(uuid, text, text)
to anon, authenticated;

grant execute on function
  public.fn_crear_venta(uuid, uuid, jsonb, jsonb, uuid, uuid, uuid, uuid, integer, text),
  public.fn_convertir_pedido_en_venta(uuid, uuid, jsonb),
  public.fn_cancelar_venta(uuid, uuid, text),
  public.fn_cerrar_caja(uuid, uuid, integer, text),
  public.fn_mover_cita(uuid, uuid, timestamptz, uuid, text),
  public.fn_cancelar_cita(uuid, uuid, text, public.canal_cita),
  public.fn_cancelar_pedido(uuid, uuid, text),
  public.fn_suspender_organizacion(uuid, text),
  public.fn_reactivar_organizacion(uuid, text),
  public.fn_registrar_pago_manual(uuid, integer, date, text, date, date, text, boolean)
to authenticated;

grant execute on function
  public.fn_liberar_reservas_vencidas(),
  public.fn_encolar_recordatorios(integer),
  public.fn_marcar_recordatorios_listos(),
  public.fn_mantenimiento_diario(),
  public.fn_recalcular_estados_pago()
to service_role;
