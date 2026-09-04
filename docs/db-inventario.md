# Inventario de la base

Generado por `scripts/inventario-db.mjs` el 2026-09-04 00:48 UTC.

70 tablas en el esquema `public`.

## Resumen

| Tabla | Filas | Columnas |
|---|---:|---:|
| `acta_reports` | ? | 17 |
| `compromisos` | ? | 8 |
| `conocimiento_trozos` | ? | 11 |
| `contenido_emisores` | ? | 11 |
| `contenido_piezas` | ? | 18 |
| `contenido_publicaciones` | ? | 9 |
| `crm_accounts` | ? | 12 |
| `crm_activities` | ? | 11 |
| `crm_alerts` | ? | 12 |
| `crm_audiciones` | ? | 17 |
| `crm_campaigns` | ? | 9 |
| `crm_contacts` | ? | 21 |
| `crm_deal_items` | ? | 5 |
| `crm_deals` | ? | 18 |
| `crm_inventory` | ? | 6 |
| `crm_narraciones` | ? | 5 |
| `crm_order_items` | ? | 5 |
| `crm_orders` | ? | 17 |
| `crm_perfil_atributos` | ? | 11 |
| `crm_products` | ? | 11 |
| `crm_quote_items` | ? | 11 |
| `crm_quotes` | ? | 20 |
| `crm_salas` | ? | 8 |
| `crm_segments` | ? | 5 |
| `crm_senales` | ? | 14 |
| `crm_settings` | ? | 3 |
| `crm_showroom_visitas` | ? | 17 |
| `crm_touchpoints` | ? | 7 |
| `crm_users` | ? | 9 |
| `crm_wa_conversations` | ? | 12 |
| `crm_wa_messages` | ? | 11 |
| `crm_wa_templates` | ? | 5 |
| `d360_fuentes` | ? | 11 |
| `d360_informes` | ? | 8 |
| `d360_leads` | ? | 12 |
| `d360_mercado` | ? | 10 |
| `d360_metricas_diarias` | ? | 17 |
| `d360_users` | ? | 10 |
| `demo_settings` | ? | 3 |
| `field_reports` | ? | 21 |
| `incidencias` | ? | 20 |
| `lead_acciones` | ? | 17 |
| `lead_campanas` | ? | 9 |
| `lead_config` | ? | 3 |
| `lead_emisores` | ? | 12 |
| `lead_empresas` | ? | 17 |
| `lead_inscripciones` | ? | 12 |
| `lead_mensajes` | ? | 11 |
| `lead_personas` | ? | 20 |
| `lead_secuencias` | ? | 9 |
| `lead_senales` | ? | 11 |
| `leads` | ? | 8 |
| `memories` | ? | 4 |
| `messages` | ? | 5 |
| `mix_rooms` | ? | 6 |
| `ordenes_trabajo` | ? | 9 |
| `reunion_compromisos` | ? | 8 |
| `reunion_registros` | ? | 30 |
| `tuniche_agricultores` | ? | 14 |
| `tuniche_fotos` | ? | 6 |
| `tuniche_fotos_pendientes` | ? | 6 |
| `tuniche_informes` | ? | 21 |
| `tuniche_lotes` | ? | 18 |
| `tuniche_usuarios` | ? | 15 |
| `tuniche_visitas` | ? | 19 |
| `venta_actividades` | ? | 7 |
| `venta_contactos` | ? | 9 |
| `venta_empresas` | ? | 8 |
| `venta_oportunidades` | ? | 14 |
| `work_sheets` | ? | 10 |

## Detalle

### `acta_reports` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('acta_reports_id_seq'::regclass)` |
| `sender_phone` | character varying(40) | no | — |
| `sender_name` | character varying(160) | sí | — |
| `source` | character varying(10) | no | `'audio'::character varying` |
| `wa_message_id` | character varying(128) | sí | — |
| `audio_url` | text | sí | — |
| `transcript` | text | sí | — |
| `titulo` | character varying(200) | sí | — |
| `fecha` | character varying(120) | sí | — |
| `lugar` | character varying(160) | sí | — |
| `participantes` | jsonb | sí | — |
| `extraction` | jsonb | sí | — |
| `executive_summary` | text | sí | — |
| `decisiones` | jsonb | sí | — |
| `status` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |
| `validated_at` | timestamp without time zone | sí | — |

### `compromisos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('compromisos_id_seq'::regclass)` |
| `acta_id` | integer | no | — |
| `compromiso` | text | no | — |
| `responsable` | character varying(160) | sí | — |
| `prioridad` | character varying(10) | no | `'media'::character varying` |
| `plazo` | character varying(120) | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |

### `conocimiento_trozos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('conocimiento_trozos_id_seq'::re` |
| `cuenta` | character varying(40) | no | — |
| `origen` | character varying(200) | no | — |
| `ruta` | text | no | — |
| `titulo` | text | no | — |
| `texto` | text | no | — |
| `orden` | integer | no | `0` |
| `siempre` | smallint | no | `0` |
| `vector` | USER-DEFINED | sí | — |
| `tokens` | integer | sí | — |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `conocimiento_trozos_cuenta_idx`: INDEX conocimiento_trozos_cuenta_idx ON public.conocimiento_trozos USING btree (cuenta)
- `conocimiento_trozos_siempre_idx`: INDEX conocimiento_trozos_siempre_idx ON public.conocimiento_trozos USING btree (siempre)

### `contenido_emisores` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('contenido_emisores_id_seq'::reg` |
| `nombre` | character varying(200) | no | — |
| `tipo` | character varying(20) | no | `'persona'::character varying` |
| `rol` | character varying(60) | sí | — |
| `autor_urn` | character varying(120) | sí | — |
| `token` | text | sí | — |
| `scopes` | character varying(200) | sí | — |
| `token_vence_en` | timestamp without time zone | sí | — |
| `conectado_en` | timestamp without time zone | sí | — |
| `pausado` | smallint | no | `0` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `contenido_emisores_vence_idx`: INDEX contenido_emisores_vence_idx ON public.contenido_emisores USING btree (token_vence_en)

### `contenido_piezas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('contenido_piezas_id_seq'::regcl` |
| `emisor_id` | integer | sí | — |
| `slot` | smallint | sí | — |
| `fecha_objetivo` | date | sí | — |
| `formato` | character varying(20) | no | `'texto'::character varying` |
| `titulo` | character varying(200) | no | — |
| `cuerpo` | text | no | — |
| `medio_urn` | character varying(120) | sí | — |
| `medio_nombre` | character varying(200) | sí | — |
| `estado` | character varying(20) | no | `'borrador'::character varying` |
| `segmento` | character varying(120) | sí | — |
| `servicio` | character varying(120) | sí | — |
| `aprobada_por` | character varying(120) | sí | — |
| `aprobada_en` | timestamp without time zone | sí | — |
| `impresiones` | integer | sí | — |
| `interacciones` | integer | sí | — |
| `metricas_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `contenido_piezas_estado_idx`: INDEX contenido_piezas_estado_idx ON public.contenido_piezas USING btree (estado)
- `contenido_piezas_fecha_idx`: INDEX contenido_piezas_fecha_idx ON public.contenido_piezas USING btree (fecha_objetivo)

### `contenido_publicaciones` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('contenido_publicaciones_id_seq'` |
| `pieza_id` | integer | no | — |
| `emisor_id` | integer | sí | — |
| `urn` | character varying(120) | sí | — |
| `http` | smallint | sí | — |
| `error` | text | sí | — |
| `visibilidad` | character varying(20) | sí | — |
| `simulado` | smallint | no | `0` |
| `publicada_en` | timestamp without time zone | no | `now()` |

Índices:
- `contenido_publicaciones_pieza_idx`: INDEX contenido_publicaciones_pieza_idx ON public.contenido_publicaciones USING btree (pieza_id)

### `crm_accounts` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_accounts_id_seq'::regclass)` |
| `nombre` | character varying(160) | no | — |
| `rut` | character varying(20) | sí | — |
| `industria` | character varying(80) | sí | — |
| `tamano` | character varying(20) | sí | — |
| `ciudad` | character varying(80) | sí | — |
| `sitio_web` | character varying(200) | sí | — |
| `estado` | character varying(20) | no | `'prospecto'::character varying` |
| `fuente` | character varying(60) | sí | — |
| `owner_id` | integer | sí | — |
| `notas` | text | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `crm_accounts_estado_idx`: INDEX crm_accounts_estado_idx ON public.crm_accounts USING btree (estado)
- `crm_accounts_owner_idx`: INDEX crm_accounts_owner_idx ON public.crm_accounts USING btree (owner_id)

### `crm_activities` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_activities_id_seq'::regclas` |
| `account_id` | integer | sí | — |
| `deal_id` | integer | sí | — |
| `contact_id` | integer | sí | — |
| `tipo` | character varying(20) | no | — |
| `titulo` | character varying(200) | no | — |
| `detalle` | text | sí | — |
| `owner_id` | integer | sí | — |
| `ocurrido_en` | timestamp without time zone | no | `now()` |
| `vence_en` | timestamp without time zone | sí | — |
| `completada` | boolean | no | `true` |

Índices:
- `crm_activities_account_idx`: INDEX crm_activities_account_idx ON public.crm_activities USING btree (account_id)
- `crm_activities_deal_idx`: INDEX crm_activities_deal_idx ON public.crm_activities USING btree (deal_id)
- `crm_activities_fecha_idx`: INDEX crm_activities_fecha_idx ON public.crm_activities USING btree (ocurrido_en)

### `crm_alerts` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_alerts_id_seq'::regclass)` |
| `clave` | character varying(200) | no | — |
| `tipo` | character varying(40) | no | — |
| `severidad` | character varying(10) | no | `'media'::character varying` |
| `titulo` | character varying(250) | no | — |
| `detalle` | text | sí | — |
| `entidad_tipo` | character varying(20) | sí | — |
| `entidad_id` | integer | sí | — |
| `accion_sugerida` | jsonb | sí | — |
| `estado` | character varying(20) | no | `'abierta'::character varying` |
| `generada_en` | timestamp without time zone | no | `now()` |
| `resuelta_en` | timestamp without time zone | sí | — |

Índices:
- `crm_alerts_clave_idx`: UNIQUE INDEX crm_alerts_clave_idx ON public.crm_alerts USING btree (clave)
- `crm_alerts_estado_idx`: INDEX crm_alerts_estado_idx ON public.crm_alerts USING btree (estado)

### `crm_audiciones` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_audiciones_id_seq'::regclas` |
| `contact_id` | integer | sí | — |
| `visita_id` | integer | sí | — |
| `sala_id` | integer | sí | — |
| `con_cita` | boolean | no | `true` |
| `fecha` | timestamp without time zone | no | `now()` |
| `duracion_minutos` | smallint | sí | — |
| `acompanantes` | smallint | no | `0` |
| `equipo_escuchado` | text | sí | — |
| `que_dijo` | text | sí | — |
| `le_gusto` | text | sí | — |
| `descarto` | text | sí | — |
| `presupuesto_mencionado` | integer | sí | — |
| `atendido_por` | integer | sí | — |
| `proximo_paso` | text | sí | — |
| `proximo_paso_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `crm_audiciones_contacto_idx`: INDEX crm_audiciones_contacto_idx ON public.crm_audiciones USING btree (contact_id)
- `crm_audiciones_fecha_idx`: INDEX crm_audiciones_fecha_idx ON public.crm_audiciones USING btree (fecha)
- `crm_audiciones_sala_idx`: INDEX crm_audiciones_sala_idx ON public.crm_audiciones USING btree (sala_id)

### `crm_campaigns` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_campaigns_id_seq'::regclass` |
| `nombre` | character varying(160) | no | — |
| `canal` | character varying(30) | no | — |
| `inicio` | timestamp without time zone | no | — |
| `fin` | timestamp without time zone | sí | — |
| `costo` | integer | no | `0` |
| `objetivo` | text | sí | — |
| `activa` | boolean | no | `true` |
| `created_at` | timestamp without time zone | no | `now()` |

### `crm_contacts` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_contacts_id_seq'::regclass)` |
| `account_id` | integer | sí | — |
| `nombre` | character varying(120) | no | — |
| `cargo` | character varying(120) | sí | — |
| `email` | character varying(254) | sí | — |
| `telefono` | character varying(20) | sí | — |
| `es_decisor` | boolean | no | `false` |
| `opt_in_whatsapp` | boolean | no | `false` |
| `created_at` | timestamp without time zone | no | `now()` |
| `estado` | character varying(20) | no | `'prospecto'::character varying` |
| `fuente` | character varying(60) | sí | — |
| `owner_id` | integer | sí | — |
| `ciudad` | character varying(80) | sí | — |
| `etiquetas` | jsonb | sí | — |
| `notas` | text | sí | — |
| `preferencias` | text | sí | — |
| `rut` | character varying(20) | sí | — |
| `primera_compra_en` | timestamp without time zone | sí | — |
| `consentimiento` | boolean | no | `false` |
| `consentimiento_en` | timestamp without time zone | sí | — |
| `cumpleanos` | timestamp without time zone | sí | — |

Índices:
- `crm_contacts_account_idx`: INDEX crm_contacts_account_idx ON public.crm_contacts USING btree (account_id)
- `crm_contacts_email_idx`: INDEX crm_contacts_email_idx ON public.crm_contacts USING btree (email)
- `crm_contacts_estado_idx`: INDEX crm_contacts_estado_idx ON public.crm_contacts USING btree (estado)
- `crm_contacts_owner_idx`: INDEX crm_contacts_owner_idx ON public.crm_contacts USING btree (owner_id)
- `crm_contacts_rut_idx`: INDEX crm_contacts_rut_idx ON public.crm_contacts USING btree (rut)
- `crm_contacts_telefono_idx`: INDEX crm_contacts_telefono_idx ON public.crm_contacts USING btree (telefono)

### `crm_deal_items` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_deal_items_id_seq'::regclas` |
| `deal_id` | integer | no | — |
| `product_id` | integer | no | — |
| `cantidad` | integer | no | `1` |
| `precio_unitario` | integer | no | `0` |

Índices:
- `crm_deal_items_deal_idx`: INDEX crm_deal_items_deal_idx ON public.crm_deal_items USING btree (deal_id)

### `crm_deals` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_deals_id_seq'::regclass)` |
| `account_id` | integer | sí | — |
| `contact_id` | integer | sí | — |
| `titulo` | character varying(200) | no | — |
| `etapa` | character varying(20) | no | `'nuevo'::character varying` |
| `monto` | integer | no | `0` |
| `probabilidad` | integer | no | `10` |
| `owner_id` | integer | sí | — |
| `fuente` | character varying(60) | sí | — |
| `campaign_first_id` | integer | sí | — |
| `campaign_last_id` | integer | sí | — |
| `abierto_en` | timestamp without time zone | no | `now()` |
| `cierre_estimado` | timestamp without time zone | sí | — |
| `cerrado_en` | timestamp without time zone | sí | — |
| `motivo_perdida` | character varying(200) | sí | — |
| `ultima_actividad_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `categoria` | character varying(80) | sí | — |

Índices:
- `crm_deals_account_idx`: INDEX crm_deals_account_idx ON public.crm_deals USING btree (account_id)
- `crm_deals_categoria_idx`: INDEX crm_deals_categoria_idx ON public.crm_deals USING btree (categoria)
- `crm_deals_etapa_idx`: INDEX crm_deals_etapa_idx ON public.crm_deals USING btree (etapa)
- `crm_deals_owner_idx`: INDEX crm_deals_owner_idx ON public.crm_deals USING btree (owner_id)

### `crm_inventory` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `product_id` | integer | no | — |
| `stock` | integer | no | `0` |
| `reservado` | integer | no | `0` |
| `punto_reposicion` | integer | no | `0` |
| `lead_time_dias` | integer | no | `0` |
| `updated_at` | timestamp without time zone | no | `now()` |

### `crm_narraciones` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `clave` | character varying(40) | no | — |
| `huella` | character varying(64) | no | — |
| `texto` | text | no | — |
| `origen` | character varying(12) | no | — |
| `generada_en` | timestamp without time zone | no | `now()` |

### `crm_order_items` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_order_items_id_seq'::regcla` |
| `order_id` | integer | no | — |
| `product_id` | integer | no | — |
| `cantidad` | integer | no | `1` |
| `precio_unitario` | integer | no | `0` |

Índices:
- `crm_order_items_order_idx`: INDEX crm_order_items_order_idx ON public.crm_order_items USING btree (order_id)
- `crm_order_items_product_idx`: INDEX crm_order_items_product_idx ON public.crm_order_items USING btree (product_id)

### `crm_orders` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_orders_id_seq'::regclass)` |
| `account_id` | integer | sí | — |
| `deal_id` | integer | sí | — |
| `fecha` | timestamp without time zone | no | `now()` |
| `total` | integer | no | `0` |
| `canal` | character varying(40) | sí | — |
| `contact_id` | integer | sí | — |
| `quote_id` | integer | sí | — |
| `origen` | character varying(20) | no | `'pos'::character varying` |
| `external_id` | character varying(80) | sí | — |
| `documento` | character varying(30) | sí | — |
| `numero_documento` | character varying(40) | sí | — |
| `sucursal` | character varying(80) | sí | — |
| `identificado` | boolean | no | `true` |
| `metodo_identificacion` | character varying(20) | sí | — |
| `vendedor` | character varying(120) | sí | — |
| `medio_pago` | character varying(40) | sí | — |

Índices:
- `crm_orders_account_idx`: INDEX crm_orders_account_idx ON public.crm_orders USING btree (account_id)
- `crm_orders_contact_idx`: INDEX crm_orders_contact_idx ON public.crm_orders USING btree (contact_id)
- `crm_orders_external_idx`: UNIQUE INDEX crm_orders_external_idx ON public.crm_orders USING btree (origen, external_id)
- `crm_orders_fecha_idx`: INDEX crm_orders_fecha_idx ON public.crm_orders USING btree (fecha)
- `crm_orders_origen_idx`: INDEX crm_orders_origen_idx ON public.crm_orders USING btree (origen)

### `crm_perfil_atributos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_perfil_atributos_id_seq'::r` |
| `contact_id` | integer | no | — |
| `clave` | character varying(60) | no | — |
| `valor` | text | sí | — |
| `estado` | character varying(12) | no | `'conocido'::character varying` |
| `confianza` | smallint | no | `2` |
| `origen` | character varying(20) | no | `'vendedor'::character varying` |
| `origen_id` | integer | sí | — |
| `registrado_por` | integer | sí | — |
| `registrado_en` | timestamp without time zone | no | `now()` |
| `vigente_hasta` | timestamp without time zone | sí | — |

Índices:
- `crm_perfil_atributo_idx`: UNIQUE INDEX crm_perfil_atributo_idx ON public.crm_perfil_atributos USING btree (contact_id, clave)
- `crm_perfil_clave_idx`: INDEX crm_perfil_clave_idx ON public.crm_perfil_atributos USING btree (clave)
- `crm_perfil_estado_idx`: INDEX crm_perfil_estado_idx ON public.crm_perfil_atributos USING btree (estado)

### `crm_products` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_products_id_seq'::regclass)` |
| `sku` | character varying(40) | no | — |
| `nombre` | character varying(160) | no | — |
| `categoria` | character varying(80) | sí | — |
| `precio` | integer | no | `0` |
| `costo` | integer | no | `0` |
| `activo` | boolean | no | `true` |
| `descripcion` | text | sí | — |
| `marca` | character varying(80) | sí | — |
| `permite_descuento` | boolean | no | `true` |
| `tope_descuento_bp` | integer | sí | — |

Índices:
- `crm_products_sku_idx`: UNIQUE INDEX crm_products_sku_idx ON public.crm_products USING btree (sku)

### `crm_quote_items` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_quote_items_id_seq'::regcla` |
| `quote_id` | integer | no | — |
| `product_id` | integer | no | — |
| `producto_nombre` | character varying(160) | no | — |
| `sku` | character varying(40) | sí | — |
| `marca` | character varying(80) | sí | — |
| `cantidad` | integer | no | `1` |
| `precio_unitario` | integer | no | `0` |
| `descuento` | integer | no | `0` |
| `tope_descuento_bp` | integer | sí | — |
| `total` | integer | no | `0` |

Índices:
- `crm_quote_items_quote_idx`: INDEX crm_quote_items_quote_idx ON public.crm_quote_items USING btree (quote_id)

### `crm_quotes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_quotes_id_seq'::regclass)` |
| `contact_id` | integer | sí | — |
| `cotizante_nombre` | character varying(120) | no | — |
| `cotizante_telefono` | character varying(20) | no | — |
| `para_si_mismo` | boolean | no | `true` |
| `destinatario_nombre` | character varying(120) | sí | — |
| `boutique` | character varying(80) | sí | — |
| `created_by_id` | integer | sí | — |
| `subtotal` | integer | no | `0` |
| `descuento_global` | integer | no | `0` |
| `total` | integer | no | `0` |
| `estado` | character varying(20) | no | `'abierta'::character varying` |
| `conversation_id` | integer | sí | — |
| `order_id` | integer | sí | — |
| `deal_id` | integer | sí | — |
| `enviada_en` | timestamp without time zone | sí | — |
| `convertida_en` | timestamp without time zone | sí | — |
| `editada_tras_envio` | boolean | no | `false` |
| `editada_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `crm_quotes_contact_idx`: INDEX crm_quotes_contact_idx ON public.crm_quotes USING btree (contact_id)
- `crm_quotes_estado_idx`: INDEX crm_quotes_estado_idx ON public.crm_quotes USING btree (estado)
- `crm_quotes_fecha_idx`: INDEX crm_quotes_fecha_idx ON public.crm_quotes USING btree (created_at)
- `crm_quotes_telefono_idx`: INDEX crm_quotes_telefono_idx ON public.crm_quotes USING btree (cotizante_telefono)

### `crm_salas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_salas_id_seq'::regclass)` |
| `nombre` | character varying(60) | no | — |
| `descripcion` | text | sí | — |
| `capacidad_min` | smallint | no | `1` |
| `capacidad_max` | smallint | no | `4` |
| `nivel` | smallint | no | `3` |
| `orden` | smallint | no | `0` |
| `activa` | boolean | no | `true` |

Índices:
- `crm_salas_nombre_idx`: UNIQUE INDEX crm_salas_nombre_idx ON public.crm_salas USING btree (nombre)

### `crm_segments` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_segments_id_seq'::regclass)` |
| `nombre` | character varying(120) | no | — |
| `descripcion` | text | sí | — |
| `definicion` | jsonb | no | — |
| `created_at` | timestamp without time zone | no | `now()` |

### `crm_senales` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_senales_id_seq'::regclass)` |
| `clave` | character varying(200) | no | — |
| `contact_id` | integer | no | — |
| `tipo` | character varying(40) | no | — |
| `prioridad` | character varying(10) | no | `'media'::character varying` |
| `titulo` | character varying(250) | no | — |
| `evidencia` | text | sí | — |
| `borrador` | text | sí | — |
| `product_id` | integer | sí | — |
| `owner_id` | integer | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `vence_en` | timestamp without time zone | sí | — |
| `generada_en` | timestamp without time zone | no | `now()` |
| `resuelta_en` | timestamp without time zone | sí | — |

Índices:
- `crm_senales_clave_idx`: UNIQUE INDEX crm_senales_clave_idx ON public.crm_senales USING btree (clave)
- `crm_senales_contact_idx`: INDEX crm_senales_contact_idx ON public.crm_senales USING btree (contact_id)
- `crm_senales_estado_idx`: INDEX crm_senales_estado_idx ON public.crm_senales USING btree (estado)
- `crm_senales_owner_idx`: INDEX crm_senales_owner_idx ON public.crm_senales USING btree (owner_id)

### `crm_settings` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `clave` | character varying(80) | no | — |
| `valor` | text | no | — |
| `updated_at` | timestamp without time zone | no | `now()` |

### `crm_showroom_visitas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_showroom_visitas_id_seq'::r` |
| `nombre` | character varying(120) | no | — |
| `telefono` | character varying(20) | sí | — |
| `email` | character varying(254) | sí | — |
| `interes` | character varying(120) | sí | — |
| `detalle` | text | sí | — |
| `boutique` | character varying(80) | sí | — |
| `medio` | character varying(30) | no | `'qr'::character varying` |
| `evento` | character varying(120) | sí | — |
| `consentimiento` | boolean | no | `false` |
| `consentimiento_en` | timestamp without time zone | sí | — |
| `atendido_por` | integer | sí | — |
| `contact_id` | integer | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |
| `con_cita` | boolean | no | `false` |
| `sala_id` | integer | sí | — |

Índices:
- `crm_showroom_estado_idx`: INDEX crm_showroom_estado_idx ON public.crm_showroom_visitas USING btree (estado)
- `crm_showroom_fecha_idx`: INDEX crm_showroom_fecha_idx ON public.crm_showroom_visitas USING btree (created_at)
- `crm_showroom_telefono_idx`: INDEX crm_showroom_telefono_idx ON public.crm_showroom_visitas USING btree (telefono)

### `crm_touchpoints` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_touchpoints_id_seq'::regcla` |
| `contact_id` | integer | no | — |
| `account_id` | integer | sí | — |
| `campaign_id` | integer | sí | — |
| `tipo` | character varying(20) | no | — |
| `detalle` | text | sí | — |
| `ocurrido_en` | timestamp without time zone | no | `now()` |

Índices:
- `crm_touchpoints_account_idx`: INDEX crm_touchpoints_account_idx ON public.crm_touchpoints USING btree (account_id)
- `crm_touchpoints_campaign_idx`: INDEX crm_touchpoints_campaign_idx ON public.crm_touchpoints USING btree (campaign_id)
- `crm_touchpoints_fecha_idx`: INDEX crm_touchpoints_fecha_idx ON public.crm_touchpoints USING btree (ocurrido_en)

### `crm_users` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_users_id_seq'::regclass)` |
| `username` | character varying(60) | no | — |
| `nombre` | character varying(120) | no | — |
| `email` | character varying(254) | sí | — |
| `password_hash` | text | no | — |
| `rol` | character varying(20) | no | `'vendedor'::character varying` |
| `activo` | boolean | no | `true` |
| `ultimo_ingreso` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `crm_users_username_idx`: UNIQUE INDEX crm_users_username_idx ON public.crm_users USING btree (username)

### `crm_wa_conversations` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_wa_conversations_id_seq'::r` |
| `account_id` | integer | sí | — |
| `contact_id` | integer | sí | — |
| `deal_id` | integer | sí | — |
| `telefono` | character varying(20) | no | — |
| `nombre` | character varying(120) | sí | — |
| `estado` | character varying(20) | no | `'abierta'::character varying` |
| `baja` | boolean | no | `false` |
| `ultimo_mensaje_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `leido_en` | timestamp without time zone | sí | — |
| `destacada` | boolean | no | `false` |

Índices:
- `crm_wa_conv_destacada_idx`: INDEX crm_wa_conv_destacada_idx ON public.crm_wa_conversations USING btree (destacada)
- `crm_wa_conv_estado_idx`: INDEX crm_wa_conv_estado_idx ON public.crm_wa_conversations USING btree (estado)
- `crm_wa_conv_telefono_idx`: UNIQUE INDEX crm_wa_conv_telefono_idx ON public.crm_wa_conversations USING btree (telefono)

### `crm_wa_messages` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_wa_messages_id_seq'::regcla` |
| `conversation_id` | integer | no | — |
| `direccion` | character varying(4) | no | — |
| `cuerpo` | text | no | — |
| `estado` | character varying(20) | no | `'draft'::character varying` |
| `motivo` | text | sí | — |
| `automatico` | boolean | no | `false` |
| `autor_id` | integer | sí | — |
| `wa_message_id` | character varying(120) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `enviado_en` | timestamp without time zone | sí | — |

Índices:
- `crm_wa_msg_conv_idx`: INDEX crm_wa_msg_conv_idx ON public.crm_wa_messages USING btree (conversation_id)
- `crm_wa_msg_estado_idx`: INDEX crm_wa_msg_estado_idx ON public.crm_wa_messages USING btree (estado)

### `crm_wa_templates` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('crm_wa_templates_id_seq'::regcl` |
| `nombre` | character varying(120) | no | — |
| `cuerpo` | text | no | — |
| `proposito` | character varying(40) | sí | — |
| `activa` | boolean | no | `true` |

### `d360_fuentes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_fuentes_id_seq'::regclass)` |
| `slug` | character varying(40) | no | — |
| `nombre` | character varying(80) | no | — |
| `tipo` | character varying(20) | no | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `cuenta` | character varying(120) | sí | — |
| `ultima_sync` | timestamp without time zone | sí | — |
| `frecuencia_min` | integer | no | `1440` |
| `ultimo_error` | text | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `nota` | text | sí | — |

Índices:
- `d360_fuentes_slug_idx`: UNIQUE INDEX d360_fuentes_slug_idx ON public.d360_fuentes USING btree (slug)

### `d360_informes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_informes_id_seq'::regclass` |
| `titulo` | character varying(160) | no | — |
| `desde` | character varying(10) | no | — |
| `hasta` | character varying(10) | no | — |
| `cuerpo_md` | text | no | — |
| `estado` | character varying(20) | no | `'borrador'::character varying` |
| `autor_id` | integer | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `d360_informes_hasta_idx`: INDEX d360_informes_hasta_idx ON public.d360_informes USING btree (hasta)

### `d360_leads` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_leads_id_seq'::regclass)` |
| `fecha` | character varying(10) | no | — |
| `nombre` | character varying(120) | no | — |
| `empresa` | character varying(120) | sí | — |
| `email` | character varying(254) | sí | — |
| `fuente_primer_toque` | character varying(40) | no | — |
| `fuente_ultimo_toque` | character varying(40) | no | — |
| `campania` | character varying(160) | sí | — |
| `estado` | character varying(20) | no | `'nuevo'::character varying` |
| `valor_clp` | integer | sí | — |
| `en_crm` | boolean | no | `false` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `d360_leads_estado_idx`: INDEX d360_leads_estado_idx ON public.d360_leads USING btree (estado)
- `d360_leads_fecha_idx`: INDEX d360_leads_fecha_idx ON public.d360_leads USING btree (fecha)

### `d360_mercado` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_mercado_id_seq'::regclass)` |
| `ano_comercial` | smallint | no | — |
| `rubro` | character varying(120) | no | — |
| `region` | smallint | sí | — |
| `tramo` | smallint | sí | — |
| `empresas` | integer | no | — |
| `operativas` | integer | no | — |
| `inversion` | integer | no | — |
| `fuente` | character varying(20) | no | `'sii'::character varying` |
| `obtenido_en` | timestamp without time zone | no | `now()` |

Índices:
- `d360_mercado_celda_idx`: UNIQUE INDEX d360_mercado_celda_idx ON public.d360_mercado USING btree (ano_comercial, rubro, region, tramo)
- `d360_mercado_rubro_idx`: INDEX d360_mercado_rubro_idx ON public.d360_mercado USING btree (rubro)

### `d360_metricas_diarias` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_metricas_diarias_id_seq'::` |
| `fecha` | character varying(10) | no | — |
| `fuente_slug` | character varying(40) | no | — |
| `tipo` | character varying(20) | no | — |
| `campania` | character varying(160) | no | — |
| `impresiones` | integer | sí | — |
| `clics` | integer | sí | — |
| `costo_clp` | integer | sí | — |
| `envios` | integer | sí | — |
| `aperturas` | integer | sí | — |
| `interacciones` | integer | sí | — |
| `seguidores_nuevos` | integer | sí | — |
| `leads` | integer | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `cuota_impresiones` | integer | sí | — |
| `cuota_perdida_presupuesto` | integer | sí | — |
| `cuota_perdida_ranking` | integer | sí | — |

Índices:
- `d360_metricas_fecha_idx`: INDEX d360_metricas_fecha_idx ON public.d360_metricas_diarias USING btree (fecha)
- `d360_metricas_fuente_idx`: INDEX d360_metricas_fuente_idx ON public.d360_metricas_diarias USING btree (fuente_slug)

### `d360_users` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('d360_users_id_seq'::regclass)` |
| `username` | character varying(60) | no | — |
| `nombre` | character varying(120) | no | — |
| `email` | character varying(254) | sí | — |
| `password_hash` | text | no | — |
| `rol` | character varying(20) | no | `'analista'::character varying` |
| `activo` | boolean | no | `true` |
| `ultimo_ingreso` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `cuentas` | jsonb | sí | — |

Índices:
- `d360_users_username_idx`: UNIQUE INDEX d360_users_username_idx ON public.d360_users USING btree (username)

### `demo_settings` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('demo_settings_id_seq'::regclass` |
| `active_demo` | character varying(20) | no | `'terreno'::character varying` |
| `updated_at` | timestamp without time zone | no | `now()` |

### `field_reports` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('field_reports_id_seq'::regclass` |
| `sender_phone` | character varying(40) | no | — |
| `sender_name` | character varying(160) | sí | — |
| `source` | character varying(10) | no | `'audio'::character varying` |
| `wa_message_id` | character varying(128) | sí | — |
| `audio_url` | text | sí | — |
| `transcript` | text | sí | — |
| `cliente` | character varying(160) | sí | — |
| `sector` | character varying(120) | sí | — |
| `cuarteles` | text | sí | — |
| `responsable` | character varying(160) | sí | — |
| `equipo_personas` | integer | sí | — |
| `avance_pct` | integer | sí | — |
| `hectareas` | integer | sí | — |
| `estado_tarea` | character varying(20) | sí | — |
| `extraction` | jsonb | sí | — |
| `executive_summary` | text | sí | — |
| `incidencias` | jsonb | sí | — |
| `status` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |
| `validated_at` | timestamp without time zone | sí | — |

### `incidencias` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('incidencias_id_seq'::regclass)` |
| `sender_phone` | character varying(40) | no | — |
| `sender_name` | character varying(160) | sí | — |
| `source` | character varying(10) | no | `'audio'::character varying` |
| `wa_message_id` | character varying(128) | sí | — |
| `audio_url` | text | sí | — |
| `transcript` | text | sí | — |
| `equipo` | character varying(160) | sí | — |
| `codigo_activo` | character varying(80) | sí | — |
| `ubicacion` | character varying(160) | sí | — |
| `reportado_por` | character varying(160) | sí | — |
| `tipo_falla` | character varying(160) | sí | — |
| `severidad` | character varying(20) | sí | — |
| `estado_equipo` | character varying(30) | sí | — |
| `extraction` | jsonb | sí | — |
| `executive_summary` | text | sí | — |
| `alertas` | jsonb | sí | — |
| `status` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |
| `validated_at` | timestamp without time zone | sí | — |

### `lead_acciones` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_acciones_id_seq'::regclass` |
| `inscripcion_id` | integer | no | — |
| `tipo` | character varying(30) | no | — |
| `canal` | character varying(20) | no | — |
| `emisor_id` | integer | sí | — |
| `programada_en` | timestamp without time zone | no | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `intentos` | smallint | no | `0` |
| `cuerpo` | text | sí | — |
| `resultado` | text | sí | — |
| `aprobada_por` | integer | sí | — |
| `aprobada_en` | timestamp without time zone | sí | — |
| `ejecutada_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `persona_id` | integer | no | — |
| `fecha_chile` | date | no | — |
| `motivo` | character varying(60) | sí | — |

Índices:
- `lead_acciones_cola_idx`: INDEX lead_acciones_cola_idx ON public.lead_acciones USING btree (estado, programada_en)
- `lead_acciones_dia_idx`: INDEX lead_acciones_dia_idx ON public.lead_acciones USING btree (fecha_chile, estado)
- `lead_acciones_inscripcion_idx`: INDEX lead_acciones_inscripcion_idx ON public.lead_acciones USING btree (inscripcion_id)
- `lead_acciones_un_toque_dia_idx`: UNIQUE INDEX lead_acciones_un_toque_dia_idx ON public.lead_acciones USING btree (persona_id, fecha_chile) WHERE ((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobada'::character varying, 'enviada'::character varying])::text[]))

### `lead_campanas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_campanas_id_seq'::regclass` |
| `nombre` | character varying(160) | no | — |
| `icp` | jsonb | sí | — |
| `limites` | jsonb | sí | — |
| `canal_preferido` | character varying(20) | sí | — |
| `emisor_id` | integer | sí | — |
| `estado` | character varying(20) | no | `'borrador'::character varying` |
| `simulado` | boolean | no | `true` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_campanas_estado_idx`: INDEX lead_campanas_estado_idx ON public.lead_campanas USING btree (estado)

### `lead_config` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `clave` | character varying(60) | no | — |
| `valor` | text | no | — |
| `actualizado_en` | timestamp without time zone | no | `now()` |

### `lead_emisores` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_emisores_id_seq'::regclass` |
| `tipo` | character varying(20) | no | — |
| `identificador` | character varying(200) | no | — |
| `unipile_account_id` | character varying(120) | sí | — |
| `cuota_diaria` | smallint | no | `5` |
| `dia_warmup` | smallint | no | `1` |
| `ventana_inicio` | smallint | no | `9` |
| `ventana_fin` | smallint | no | `19` |
| `ip` | character varying(45) | sí | — |
| `tasa_aceptacion_7d` | smallint | sí | — |
| `estado` | character varying(20) | no | `'warmup'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_emisores_estado_idx`: INDEX lead_emisores_estado_idx ON public.lead_emisores USING btree (estado)

### `lead_empresas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_empresas_id_seq'::regclass` |
| `rut` | character varying(12) | sí | — |
| `razon_social` | character varying(200) | no | — |
| `acteco` | character varying(6) | sí | — |
| `rubro` | character varying(160) | sí | — |
| `tramo_ventas` | smallint | sí | — |
| `tramo_ventas_ano` | smallint | sí | — |
| `region` | smallint | sí | — |
| `comuna` | character varying(80) | sí | — |
| `dominio` | character varying(200) | sí | — |
| `dominio_origen` | character varying(20) | sí | — |
| `dominio_obtenido_en` | timestamp without time zone | sí | — |
| `origen` | character varying(20) | no | — |
| `obtenido_en` | timestamp without time zone | no | `now()` |
| `created_at` | timestamp without time zone | no | `now()` |
| `grupo` | character varying(80) | sí | — |
| `grupo_metodo` | character varying(20) | sí | — |

Índices:
- `lead_empresas_acteco_idx`: INDEX lead_empresas_acteco_idx ON public.lead_empresas USING btree (acteco)
- `lead_empresas_grupo_idx`: INDEX lead_empresas_grupo_idx ON public.lead_empresas USING btree (grupo)
- `lead_empresas_region_idx`: INDEX lead_empresas_region_idx ON public.lead_empresas USING btree (region)
- `lead_empresas_rut_idx`: UNIQUE INDEX lead_empresas_rut_idx ON public.lead_empresas USING btree (rut)

### `lead_inscripciones` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_inscripciones_id_seq'::reg` |
| `persona_id` | integer | no | — |
| `campana_id` | integer | no | — |
| `senal_id` | integer | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `paso_actual` | smallint | no | `0` |
| `proximo_paso_en` | timestamp without time zone | sí | — |
| `toques_totales` | smallint | no | `0` |
| `invitada_en` | timestamp without time zone | sí | — |
| `respondio_en` | timestamp without time zone | sí | — |
| `actualizado_en` | timestamp without time zone | no | `now()` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_inscripciones_estado_idx`: INDEX lead_inscripciones_estado_idx ON public.lead_inscripciones USING btree (estado)
- `lead_inscripciones_proximo_idx`: INDEX lead_inscripciones_proximo_idx ON public.lead_inscripciones USING btree (proximo_paso_en)
- `lead_inscripciones_unica_idx`: UNIQUE INDEX lead_inscripciones_unica_idx ON public.lead_inscripciones USING btree (persona_id, campana_id)

### `lead_mensajes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_mensajes_id_seq'::regclass` |
| `persona_id` | integer | no | — |
| `inscripcion_id` | integer | sí | — |
| `accion_id` | integer | sí | — |
| `emisor_id` | integer | sí | — |
| `canal` | character varying(20) | no | — |
| `direccion` | character varying(10) | no | — |
| `cuerpo` | text | no | — |
| `enviado_en` | timestamp without time zone | no | `now()` |
| `external_id` | character varying(200) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_mensajes_enviado_idx`: INDEX lead_mensajes_enviado_idx ON public.lead_mensajes USING btree (enviado_en)
- `lead_mensajes_external_idx`: UNIQUE INDEX lead_mensajes_external_idx ON public.lead_mensajes USING btree (canal, external_id)
- `lead_mensajes_persona_idx`: INDEX lead_mensajes_persona_idx ON public.lead_mensajes USING btree (persona_id)

### `lead_personas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_personas_id_seq'::regclass` |
| `member_urn` | character varying(64) | sí | — |
| `public_identifier` | character varying(160) | sí | — |
| `linkedin_origen` | character varying(20) | sí | — |
| `linkedin_obtenido_en` | timestamp without time zone | sí | — |
| `nombre` | character varying(160) | no | — |
| `cargo` | character varying(200) | sí | — |
| `empresa_id` | integer | sí | — |
| `email` | character varying(254) | sí | — |
| `email_origen` | character varying(20) | sí | — |
| `email_obtenido_en` | timestamp without time zone | sí | — |
| `email_verificado` | boolean | sí | — |
| `telefono` | character varying(20) | sí | — |
| `telefono_origen` | character varying(20) | sí | — |
| `telefono_obtenido_en` | timestamp without time zone | sí | — |
| `es_open_profile` | boolean | sí | — |
| `network_distance` | smallint | sí | — |
| `suprimido_en` | timestamp without time zone | sí | — |
| `suprimido_motivo` | character varying(60) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_personas_email_idx`: INDEX lead_personas_email_idx ON public.lead_personas USING btree (email)
- `lead_personas_empresa_idx`: INDEX lead_personas_empresa_idx ON public.lead_personas USING btree (empresa_id)
- `lead_personas_suprimido_idx`: INDEX lead_personas_suprimido_idx ON public.lead_personas USING btree (suprimido_en)
- `lead_personas_urn_idx`: UNIQUE INDEX lead_personas_urn_idx ON public.lead_personas USING btree (member_urn)

### `lead_secuencias` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_secuencias_id_seq'::regcla` |
| `campana_id` | integer | no | — |
| `orden` | smallint | no | — |
| `espera_dias` | smallint | no | `0` |
| `canal` | character varying(20) | no | — |
| `tipo` | character varying(30) | no | — |
| `asunto` | character varying(200) | sí | — |
| `plantilla` | text | no | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_secuencias_paso_idx`: UNIQUE INDEX lead_secuencias_paso_idx ON public.lead_secuencias USING btree (campana_id, orden)

### `lead_senales` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('lead_senales_id_seq'::regclass)` |
| `empresa_id` | integer | no | — |
| `tipo` | character varying(40) | no | — |
| `resumen` | text | no | — |
| `evidencia_url` | character varying(500) | sí | — |
| `fecha_hecho` | timestamp without time zone | no | — |
| `vence_en` | timestamp without time zone | no | — |
| `estado` | character varying(20) | no | `'vigente'::character varying` |
| `origen` | character varying(20) | no | — |
| `obtenido_en` | timestamp without time zone | no | `now()` |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `lead_senales_empresa_idx`: INDEX lead_senales_empresa_idx ON public.lead_senales USING btree (empresa_id)
- `lead_senales_estado_idx`: INDEX lead_senales_estado_idx ON public.lead_senales USING btree (estado)
- `lead_senales_vence_idx`: INDEX lead_senales_vence_idx ON public.lead_senales USING btree (vence_en)

### `leads` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('leads_id_seq'::regclass)` |
| `nombre` | character varying(120) | no | — |
| `email` | character varying(254) | no | — |
| `empresa` | character varying(120) | no | — |
| `rol` | character varying(120) | sí | — |
| `tipo` | character varying(40) | no | `'Assessment'::character varying` |
| `mensaje` | text | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

### `memories` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | bigint | no | `nextval('memories_id_seq'::regclass)` |
| `conversation_id` | text | no | `'family'::text` |
| `content` | text | no | — |
| `created_at` | timestamp with time zone | no | `now()` |

### `messages` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | bigint | no | `nextval('messages_id_seq'::regclass)` |
| `conversation_id` | text | no | `'family'::text` |
| `role` | text | no | — |
| `content` | text | no | — |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `idx_messages_conv`: INDEX idx_messages_conv ON public.messages USING btree (conversation_id, id)

### `mix_rooms` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `code` | character varying(12) | no | — |
| `state` | jsonb | no | — |
| `progress` | jsonb | sí | — |
| `version` | integer | no | `1` |
| `updated_at` | timestamp without time zone | no | `now()` |
| `rtc` | jsonb | sí | — |

### `ordenes_trabajo` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('ordenes_trabajo_id_seq'::regcla` |
| `incidencia_id` | integer | no | — |
| `tarea` | text | no | — |
| `responsable_sugerido` | character varying(160) | sí | — |
| `prioridad` | character varying(10) | no | `'media'::character varying` |
| `plazo` | character varying(120) | sí | — |
| `repuestos` | text | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |

### `reunion_compromisos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('reunion_compromisos_id_seq'::re` |
| `reunion_id` | integer | no | — |
| `compromiso` | text | no | — |
| `responsable` | character varying(160) | sí | — |
| `prioridad` | character varying(10) | no | `'media'::character varying` |
| `plazo` | character varying(120) | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `reunion_compromisos_reunion_idx`: INDEX reunion_compromisos_reunion_idx ON public.reunion_compromisos USING btree (reunion_id)

### `reunion_registros` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('reunion_registros_id_seq'::regc` |
| `clave` | character varying(200) | no | — |
| `plataforma` | character varying(40) | sí | — |
| `titulo` | character varying(300) | sí | — |
| `inicio_en` | timestamp with time zone | sí | — |
| `fin_en` | timestamp with time zone | sí | — |
| `duracion_min` | integer | sí | — |
| `participantes` | jsonb | sí | — |
| `transcripcion` | text | no | — |
| `bloques` | jsonb | sí | — |
| `chat` | jsonb | sí | — |
| `crudo` | jsonb | sí | — |
| `estado` | character varying(20) | no | `'recibida'::character varying` |
| `error` | text | sí | — |
| `resumen` | text | sí | — |
| `extraccion` | jsonb | sí | — |
| `intentos` | smallint | no | `0` |
| `modelo` | character varying(80) | sí | — |
| `tokens_entrada` | integer | sí | — |
| `tokens_entrada_cache` | integer | sí | — |
| `tokens_salida` | integer | sí | — |
| `costo_usd` | numeric | sí | — |
| `costo_aproximado` | smallint | no | `0` |
| `created_at` | timestamp with time zone | no | `now()` |
| `resumida_en` | timestamp with time zone | sí | — |
| `ambito` | character varying(40) | sí | — |
| `capturada_por` | character varying(160) | sí | — |
| `transcripcion_corregida` | text | sí | — |
| `tramos_sin_corregir` | smallint | sí | — |
| `costo_vivo_usd` | numeric | sí | — |

Índices:
- `reunion_registros_ambito_idx`: INDEX reunion_registros_ambito_idx ON public.reunion_registros USING btree (ambito)
- `reunion_registros_clave_key`: UNIQUE INDEX reunion_registros_clave_key ON public.reunion_registros USING btree (clave)
- `reunion_registros_estado_idx`: INDEX reunion_registros_estado_idx ON public.reunion_registros USING btree (estado)
- `reunion_registros_inicio_idx`: INDEX reunion_registros_inicio_idx ON public.reunion_registros USING btree (inicio_en)

### `tuniche_agricultores` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_agricultores_id_seq'::r` |
| `area` | character varying(20) | no | — |
| `razon_social` | character varying(200) | no | — |
| `nombre_contacto` | character varying(160) | sí | — |
| `telefono` | character varying(20) | sí | — |
| `email` | character varying(254) | sí | — |
| `localidad` | character varying(120) | sí | — |
| `region` | character varying(120) | sí | — |
| `distribuidor` | character varying(200) | sí | — |
| `zonal_id` | integer | sí | — |
| `zonal_nombre` | character varying(120) | sí | — |
| `activo` | boolean | no | `true` |
| `created_at` | timestamp without time zone | no | `now()` |
| `demo` | boolean | no | `false` |

Índices:
- `tuniche_agricultores_area_idx`: INDEX tuniche_agricultores_area_idx ON public.tuniche_agricultores USING btree (area)
- `tuniche_agricultores_zonal_idx`: INDEX tuniche_agricultores_zonal_idx ON public.tuniche_agricultores USING btree (zonal_id)

### `tuniche_fotos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_fotos_id_seq'::regclass` |
| `visita_id` | integer | no | — |
| `url` | text | no | — |
| `tipo` | character varying(20) | no | `'general'::character varying` |
| `wa_message_id` | character varying(120) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `tuniche_fotos_visita_idx`: INDEX tuniche_fotos_visita_idx ON public.tuniche_fotos USING btree (visita_id)

### `tuniche_fotos_pendientes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_fotos_pendientes_id_seq` |
| `usuario_id` | integer | no | — |
| `url` | text | no | — |
| `tipo` | character varying(20) | no | `'general'::character varying` |
| `wa_message_id` | character varying(120) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |

Índices:
- `tuniche_fotos_pend_usuario_idx`: INDEX tuniche_fotos_pend_usuario_idx ON public.tuniche_fotos_pendientes USING btree (usuario_id, created_at)

### `tuniche_informes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_informes_id_seq'::regcl` |
| `tipo` | character varying(20) | no | — |
| `area` | character varying(20) | no | — |
| `titulo` | character varying(200) | no | — |
| `estado` | character varying(20) | no | `'borrador'::character varying` |
| `visita_id` | integer | sí | — |
| `lote_id` | integer | sí | — |
| `agricultor_id` | integer | sí | — |
| `cliente` | character varying(200) | sí | — |
| `periodo_desde` | timestamp without time zone | sí | — |
| `periodo_hasta` | timestamp without time zone | sí | — |
| `contenido` | jsonb | no | — |
| `generado_por` | integer | no | — |
| `generado_en` | timestamp without time zone | no | `now()` |
| `aprobado_por` | integer | sí | — |
| `aprobado_en` | timestamp without time zone | sí | — |
| `enviado_por` | integer | sí | — |
| `enviado_en` | timestamp without time zone | sí | — |
| `enviado_a` | character varying(200) | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `demo` | boolean | no | `false` |

Índices:
- `tuniche_informes_agricultor_idx`: INDEX tuniche_informes_agricultor_idx ON public.tuniche_informes USING btree (agricultor_id)
- `tuniche_informes_estado_idx`: INDEX tuniche_informes_estado_idx ON public.tuniche_informes USING btree (estado)
- `tuniche_informes_generado_idx`: INDEX tuniche_informes_generado_idx ON public.tuniche_informes USING btree (generado_en)
- `tuniche_informes_lote_idx`: INDEX tuniche_informes_lote_idx ON public.tuniche_informes USING btree (lote_id)
- `tuniche_informes_tipo_idx`: INDEX tuniche_informes_tipo_idx ON public.tuniche_informes USING btree (tipo)
- `tuniche_informes_visita_idx`: UNIQUE INDEX tuniche_informes_visita_idx ON public.tuniche_informes USING btree (visita_id)

### `tuniche_lotes` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_lotes_id_seq'::regclass` |
| `agricultor_id` | integer | no | — |
| `area` | character varying(20) | no | — |
| `codigo` | character varying(60) | no | — |
| `temporada` | character varying(20) | sí | — |
| `cultivo` | character varying(80) | sí | — |
| `variedad` | character varying(80) | sí | — |
| `relacion_hm` | character varying(20) | sí | — |
| `hectareas` | numeric | sí | — |
| `objetivo` | character varying(60) | sí | — |
| `cliente_final` | character varying(200) | sí | — |
| `idase` | character varying(40) | sí | — |
| `tipo_semilla` | character varying(60) | sí | — |
| `etapa_actual` | character varying(40) | sí | — |
| `hitos` | jsonb | sí | `'{}'::jsonb` |
| `activo` | boolean | no | `true` |
| `created_at` | timestamp without time zone | no | `now()` |
| `demo` | boolean | no | `false` |

Índices:
- `tuniche_lotes_agricultor_idx`: INDEX tuniche_lotes_agricultor_idx ON public.tuniche_lotes USING btree (agricultor_id)
- `tuniche_lotes_codigo_idx`: UNIQUE INDEX tuniche_lotes_codigo_idx ON public.tuniche_lotes USING btree (codigo)

### `tuniche_usuarios` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_usuarios_id_seq'::regcl` |
| `username` | character varying(60) | no | — |
| `nombre` | character varying(120) | no | — |
| `email` | character varying(254) | sí | — |
| `telefono` | character varying(20) | sí | — |
| `password_hash` | text | no | — |
| `rol` | character varying(20) | no | `'zonal'::character varying` |
| `area` | character varying(20) | sí | — |
| `activo` | boolean | no | `true` |
| `debe_cambiar_clave` | boolean | no | `false` |
| `ultimo_ingreso` | timestamp without time zone | sí | — |
| `creado_por` | integer | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `area_audio` | character varying(20) | sí | — |
| `recibe_informes` | boolean | no | `false` |

Índices:
- `tuniche_usuarios_area_idx`: INDEX tuniche_usuarios_area_idx ON public.tuniche_usuarios USING btree (area)
- `tuniche_usuarios_telefono_idx`: UNIQUE INDEX tuniche_usuarios_telefono_idx ON public.tuniche_usuarios USING btree (telefono)
- `tuniche_usuarios_username_idx`: UNIQUE INDEX tuniche_usuarios_username_idx ON public.tuniche_usuarios USING btree (username)

### `tuniche_visitas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('tuniche_visitas_id_seq'::regcla` |
| `lote_id` | integer | sí | — |
| `agricultor_id` | integer | sí | — |
| `area` | character varying(20) | no | — |
| `usuario_id` | integer | no | — |
| `fecha` | timestamp without time zone | no | `now()` |
| `origen` | character varying(20) | no | `'audio'::character varying` |
| `wa_message_id` | character varying(120) | sí | — |
| `audio_url` | text | sí | — |
| `transcripcion` | text | sí | — |
| `etapa` | character varying(40) | sí | — |
| `datos` | jsonb | sí | `'{}'::jsonb` |
| `nota_agronomica` | integer | sí | — |
| `resumen` | text | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `validada_en` | timestamp without time zone | sí | — |
| `enviada_al_agricultor_en` | timestamp without time zone | sí | — |
| `created_at` | timestamp without time zone | no | `now()` |
| `demo` | boolean | no | `false` |

Índices:
- `tuniche_visitas_estado_idx`: INDEX tuniche_visitas_estado_idx ON public.tuniche_visitas USING btree (estado)
- `tuniche_visitas_fecha_idx`: INDEX tuniche_visitas_fecha_idx ON public.tuniche_visitas USING btree (fecha)
- `tuniche_visitas_lote_idx`: INDEX tuniche_visitas_lote_idx ON public.tuniche_visitas USING btree (lote_id)
- `tuniche_visitas_usuario_idx`: INDEX tuniche_visitas_usuario_idx ON public.tuniche_visitas USING btree (usuario_id)

### `venta_actividades` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('venta_actividades_id_seq'::regc` |
| `oportunidad_id` | integer | sí | — |
| `contacto_id` | integer | sí | — |
| `tipo` | character varying(20) | no | `'nota'::character varying` |
| `detalle` | text | no | — |
| `autor` | character varying(160) | sí | — |
| `ocurrio_en` | timestamp with time zone | no | `now()` |

Índices:
- `venta_actividades_fecha_idx`: INDEX venta_actividades_fecha_idx ON public.venta_actividades USING btree (ocurrio_en)
- `venta_actividades_oportunidad_idx`: INDEX venta_actividades_oportunidad_idx ON public.venta_actividades USING btree (oportunidad_id)

### `venta_contactos` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('venta_contactos_id_seq'::regcla` |
| `empresa_id` | integer | sí | — |
| `nombre` | character varying(200) | no | — |
| `cargo` | character varying(160) | sí | — |
| `email` | character varying(254) | sí | — |
| `telefono` | character varying(40) | sí | — |
| `linkedin` | character varying(300) | sí | — |
| `notas` | text | sí | — |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `venta_contactos_empresa_idx`: INDEX venta_contactos_empresa_idx ON public.venta_contactos USING btree (empresa_id)
- `venta_contactos_nombre_idx`: INDEX venta_contactos_nombre_idx ON public.venta_contactos USING btree (nombre)

### `venta_empresas` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('venta_empresas_id_seq'::regclas` |
| `nombre` | character varying(200) | no | — |
| `rubro` | character varying(120) | sí | — |
| `sitio` | character varying(200) | sí | — |
| `tamano` | character varying(40) | sí | — |
| `ciudad` | character varying(120) | sí | — |
| `notas` | text | sí | — |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `venta_empresas_nombre_idx`: INDEX venta_empresas_nombre_idx ON public.venta_empresas USING btree (nombre)

### `venta_oportunidades` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('venta_oportunidades_id_seq'::re` |
| `contacto_id` | integer | no | — |
| `empresa_id` | integer | sí | — |
| `titulo` | character varying(200) | no | — |
| `etapa` | character varying(20) | no | `'nuevo'::character varying` |
| `monto` | integer | no | `0` |
| `probabilidad` | smallint | no | `5` |
| `fuente` | character varying(40) | sí | — |
| `cierre_estimado` | date | sí | — |
| `abierto_en` | timestamp with time zone | no | `now()` |
| `cerrado_en` | timestamp with time zone | sí | — |
| `motivo_perdida` | character varying(300) | sí | — |
| `ultima_actividad` | timestamp with time zone | sí | — |
| `created_at` | timestamp with time zone | no | `now()` |

Índices:
- `venta_oportunidades_contacto_idx`: INDEX venta_oportunidades_contacto_idx ON public.venta_oportunidades USING btree (contacto_id)
- `venta_oportunidades_empresa_idx`: INDEX venta_oportunidades_empresa_idx ON public.venta_oportunidades USING btree (empresa_id)
- `venta_oportunidades_etapa_idx`: INDEX venta_oportunidades_etapa_idx ON public.venta_oportunidades USING btree (etapa)

### `work_sheets` — ? filas

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | integer | no | `nextval('work_sheets_id_seq'::regclass)` |
| `report_id` | integer | no | — |
| `tarea` | text | no | — |
| `responsable_sugerido` | character varying(160) | sí | — |
| `prioridad` | character varying(10) | no | `'media'::character varying` |
| `plazo` | character varying(120) | sí | — |
| `recursos` | text | sí | — |
| `evidencia_requerida` | text | sí | — |
| `estado` | character varying(20) | no | `'pendiente'::character varying` |
| `created_at` | timestamp without time zone | no | `now()` |
