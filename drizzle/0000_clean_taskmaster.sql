CREATE TABLE "acta_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_phone" varchar(40) NOT NULL,
	"sender_name" varchar(160),
	"source" varchar(10) DEFAULT 'audio' NOT NULL,
	"wa_message_id" varchar(128),
	"audio_url" text,
	"transcript" text,
	"titulo" varchar(200),
	"fecha" varchar(120),
	"lugar" varchar(160),
	"participantes" jsonb,
	"extraction" jsonb,
	"executive_summary" text,
	"decisiones" jsonb,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "compromisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"acta_id" integer NOT NULL,
	"compromiso" text NOT NULL,
	"responsable" varchar(160),
	"prioridad" varchar(10) DEFAULT 'media' NOT NULL,
	"plazo" varchar(120),
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"active_demo" varchar(20) DEFAULT 'terreno' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_phone" varchar(40) NOT NULL,
	"sender_name" varchar(160),
	"source" varchar(10) DEFAULT 'audio' NOT NULL,
	"wa_message_id" varchar(128),
	"audio_url" text,
	"transcript" text,
	"cliente" varchar(160),
	"sector" varchar(120),
	"cuarteles" text,
	"responsable" varchar(160),
	"equipo_personas" integer,
	"avance_pct" integer,
	"hectareas" integer,
	"estado_tarea" varchar(20),
	"extraction" jsonb,
	"executive_summary" text,
	"incidencias" jsonb,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "incidencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_phone" varchar(40) NOT NULL,
	"sender_name" varchar(160),
	"source" varchar(10) DEFAULT 'audio' NOT NULL,
	"wa_message_id" varchar(128),
	"audio_url" text,
	"transcript" text,
	"equipo" varchar(160),
	"codigo_activo" varchar(80),
	"ubicacion" varchar(160),
	"reportado_por" varchar(160),
	"tipo_falla" varchar(160),
	"severidad" varchar(20),
	"estado_equipo" varchar(30),
	"extraction" jsonb,
	"executive_summary" text,
	"alertas" jsonb,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"validated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"empresa" varchar(120) NOT NULL,
	"rol" varchar(120),
	"tipo" varchar(40) DEFAULT 'Assessment' NOT NULL,
	"mensaje" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mix_rooms" (
	"code" varchar(12) PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"progress" jsonb,
	"rtc" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_trabajo" (
	"id" serial PRIMARY KEY NOT NULL,
	"incidencia_id" integer NOT NULL,
	"tarea" text NOT NULL,
	"responsable_sugerido" varchar(160),
	"prioridad" varchar(10) DEFAULT 'media' NOT NULL,
	"plazo" varchar(120),
	"repuestos" text,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" integer NOT NULL,
	"tarea" text NOT NULL,
	"responsable_sugerido" varchar(160),
	"prioridad" varchar(10) DEFAULT 'media' NOT NULL,
	"plazo" varchar(120),
	"recursos" text,
	"evidencia_requerida" text,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"rut" varchar(20),
	"industria" varchar(80),
	"tamano" varchar(20),
	"ciudad" varchar(80),
	"sitio_web" varchar(200),
	"estado" varchar(20) DEFAULT 'prospecto' NOT NULL,
	"fuente" varchar(60),
	"owner_id" integer,
	"notas" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"deal_id" integer,
	"contact_id" integer,
	"tipo" varchar(20) NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"detalle" text,
	"owner_id" integer,
	"ocurrido_en" timestamp DEFAULT now() NOT NULL,
	"vence_en" timestamp,
	"completada" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clave" varchar(200) NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"severidad" varchar(10) DEFAULT 'media' NOT NULL,
	"titulo" varchar(250) NOT NULL,
	"detalle" text,
	"entidad_tipo" varchar(20),
	"entidad_id" integer,
	"accion_sugerida" jsonb,
	"estado" varchar(20) DEFAULT 'abierta' NOT NULL,
	"generada_en" timestamp DEFAULT now() NOT NULL,
	"resuelta_en" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_audiciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"visita_id" integer,
	"sala_id" integer,
	"con_cita" boolean DEFAULT true NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"duracion_minutos" smallint,
	"acompanantes" smallint DEFAULT 0 NOT NULL,
	"equipo_escuchado" text,
	"que_dijo" text,
	"le_gusto" text,
	"descarto" text,
	"presupuesto_mencionado" integer,
	"atendido_por" integer,
	"proximo_paso" text,
	"proximo_paso_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"canal" varchar(30) NOT NULL,
	"inicio" timestamp NOT NULL,
	"fin" timestamp,
	"costo" integer DEFAULT 0 NOT NULL,
	"objetivo" text,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"nombre" varchar(120) NOT NULL,
	"cargo" varchar(120),
	"email" varchar(254),
	"telefono" varchar(20),
	"es_decisor" boolean DEFAULT false NOT NULL,
	"opt_in_whatsapp" boolean DEFAULT false NOT NULL,
	"estado" varchar(20) DEFAULT 'prospecto' NOT NULL,
	"fuente" varchar(60),
	"owner_id" integer,
	"ciudad" varchar(80),
	"etiquetas" jsonb,
	"notas" text,
	"preferencias" text,
	"rut" varchar(20),
	"primera_compra_en" timestamp,
	"consentimiento" boolean DEFAULT false NOT NULL,
	"consentimiento_en" timestamp,
	"cumpleanos" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deal_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"contact_id" integer,
	"titulo" varchar(200) NOT NULL,
	"etapa" varchar(20) DEFAULT 'nuevo' NOT NULL,
	"monto" integer DEFAULT 0 NOT NULL,
	"probabilidad" integer DEFAULT 10 NOT NULL,
	"owner_id" integer,
	"fuente" varchar(60),
	"categoria" varchar(80),
	"campaign_first_id" integer,
	"campaign_last_id" integer,
	"abierto_en" timestamp DEFAULT now() NOT NULL,
	"cierre_estimado" timestamp,
	"cerrado_en" timestamp,
	"motivo_perdida" varchar(200),
	"ultima_actividad_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_inventory" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"reservado" integer DEFAULT 0 NOT NULL,
	"punto_reposicion" integer DEFAULT 0 NOT NULL,
	"lead_time_dias" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_narraciones" (
	"clave" varchar(40) PRIMARY KEY NOT NULL,
	"huella" varchar(64) NOT NULL,
	"texto" text NOT NULL,
	"origen" varchar(12) NOT NULL,
	"generada_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"account_id" integer,
	"deal_id" integer,
	"quote_id" integer,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"canal" varchar(40),
	"origen" varchar(20) DEFAULT 'pos' NOT NULL,
	"external_id" varchar(80),
	"documento" varchar(30),
	"numero_documento" varchar(40),
	"sucursal" varchar(80),
	"identificado" boolean DEFAULT true NOT NULL,
	"metodo_identificacion" varchar(20),
	"vendedor" varchar(120),
	"medio_pago" varchar(40)
);
--> statement-breakpoint
CREATE TABLE "crm_perfil_atributos" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"clave" varchar(60) NOT NULL,
	"valor" text,
	"estado" varchar(12) DEFAULT 'conocido' NOT NULL,
	"confianza" smallint DEFAULT 2 NOT NULL,
	"origen" varchar(20) DEFAULT 'vendedor' NOT NULL,
	"origen_id" integer,
	"registrado_por" integer,
	"registrado_en" timestamp DEFAULT now() NOT NULL,
	"vigente_hasta" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(40) NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"categoria" varchar(80),
	"marca" varchar(80),
	"precio" integer DEFAULT 0 NOT NULL,
	"costo" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"descripcion" text,
	"permite_descuento" boolean DEFAULT true NOT NULL,
	"tope_descuento_bp" integer
);
--> statement-breakpoint
CREATE TABLE "crm_quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"producto_nombre" varchar(160) NOT NULL,
	"sku" varchar(40),
	"marca" varchar(80),
	"cantidad" integer DEFAULT 1 NOT NULL,
	"precio_unitario" integer DEFAULT 0 NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"tope_descuento_bp" integer,
	"total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"cotizante_nombre" varchar(120) NOT NULL,
	"cotizante_telefono" varchar(20) NOT NULL,
	"para_si_mismo" boolean DEFAULT true NOT NULL,
	"destinatario_nombre" varchar(120),
	"boutique" varchar(80),
	"created_by_id" integer,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"descuento_global" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"estado" varchar(20) DEFAULT 'abierta' NOT NULL,
	"conversation_id" integer,
	"order_id" integer,
	"deal_id" integer,
	"enviada_en" timestamp,
	"convertida_en" timestamp,
	"editada_tras_envio" boolean DEFAULT false NOT NULL,
	"editada_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_salas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(60) NOT NULL,
	"descripcion" text,
	"capacidad_min" smallint DEFAULT 1 NOT NULL,
	"capacidad_max" smallint DEFAULT 4 NOT NULL,
	"nivel" smallint DEFAULT 3 NOT NULL,
	"orden" smallint DEFAULT 0 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"descripcion" text,
	"definicion" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_senales" (
	"id" serial PRIMARY KEY NOT NULL,
	"clave" varchar(200) NOT NULL,
	"contact_id" integer NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"prioridad" varchar(10) DEFAULT 'media' NOT NULL,
	"titulo" varchar(250) NOT NULL,
	"evidencia" text,
	"borrador" text,
	"product_id" integer,
	"owner_id" integer,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"vence_en" timestamp,
	"generada_en" timestamp DEFAULT now() NOT NULL,
	"resuelta_en" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_settings" (
	"clave" varchar(80) PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_showroom_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"telefono" varchar(20),
	"email" varchar(254),
	"interes" varchar(120),
	"detalle" text,
	"boutique" varchar(80),
	"medio" varchar(30) DEFAULT 'qr' NOT NULL,
	"evento" varchar(120),
	"consentimiento" boolean DEFAULT false NOT NULL,
	"consentimiento_en" timestamp,
	"atendido_por" integer,
	"contact_id" integer,
	"con_cita" boolean DEFAULT false NOT NULL,
	"sala_id" integer,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_touchpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"account_id" integer,
	"campaign_id" integer,
	"tipo" varchar(20) NOT NULL,
	"detalle" text,
	"ocurrido_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(254),
	"password_hash" text NOT NULL,
	"rol" varchar(20) DEFAULT 'vendedor' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_ingreso" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_wa_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer,
	"contact_id" integer,
	"deal_id" integer,
	"telefono" varchar(20) NOT NULL,
	"nombre" varchar(120),
	"estado" varchar(20) DEFAULT 'abierta' NOT NULL,
	"baja" boolean DEFAULT false NOT NULL,
	"ultimo_mensaje_en" timestamp,
	"leido_en" timestamp,
	"destacada" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_wa_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"direccion" varchar(4) NOT NULL,
	"cuerpo" text NOT NULL,
	"estado" varchar(20) DEFAULT 'draft' NOT NULL,
	"motivo" text,
	"automatico" boolean DEFAULT false NOT NULL,
	"autor_id" integer,
	"wa_message_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"enviado_en" timestamp
);
--> statement-breakpoint
CREATE TABLE "crm_wa_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"cuerpo" text NOT NULL,
	"proposito" varchar(40),
	"activa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_acciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"inscripcion_id" integer NOT NULL,
	"persona_id" integer NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"canal" varchar(20) NOT NULL,
	"emisor_id" integer,
	"programada_en" timestamp NOT NULL,
	"fecha_chile" date NOT NULL,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"motivo" varchar(60),
	"intentos" smallint DEFAULT 0 NOT NULL,
	"cuerpo" text,
	"resultado" text,
	"aprobada_por" integer,
	"aprobada_en" timestamp,
	"ejecutada_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_campanas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"icp" jsonb,
	"limites" jsonb,
	"canal_preferido" varchar(20),
	"emisor_id" integer,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"simulado" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_config" (
	"clave" varchar(60) PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_emisores" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"identificador" varchar(200) NOT NULL,
	"unipile_account_id" varchar(120),
	"cuota_diaria" smallint DEFAULT 5 NOT NULL,
	"dia_warmup" smallint DEFAULT 1 NOT NULL,
	"ventana_inicio" smallint DEFAULT 9 NOT NULL,
	"ventana_fin" smallint DEFAULT 19 NOT NULL,
	"ip" varchar(45),
	"tasa_aceptacion_7d" smallint,
	"estado" varchar(20) DEFAULT 'warmup' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"rut" varchar(12),
	"razon_social" varchar(200) NOT NULL,
	"acteco" varchar(6),
	"rubro" varchar(160),
	"tramo_ventas" smallint,
	"tramo_ventas_ano" smallint,
	"region" smallint,
	"comuna" varchar(80),
	"dominio" varchar(200),
	"dominio_origen" varchar(20),
	"dominio_obtenido_en" timestamp,
	"grupo" varchar(80),
	"grupo_metodo" varchar(20),
	"origen" varchar(20) NOT NULL,
	"obtenido_en" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_inscripciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"campana_id" integer NOT NULL,
	"senal_id" integer,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"paso_actual" smallint DEFAULT 0 NOT NULL,
	"proximo_paso_en" timestamp,
	"toques_totales" smallint DEFAULT 0 NOT NULL,
	"invitada_en" timestamp,
	"respondio_en" timestamp,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_mensajes" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_id" integer NOT NULL,
	"inscripcion_id" integer,
	"accion_id" integer,
	"emisor_id" integer,
	"canal" varchar(20) NOT NULL,
	"direccion" varchar(10) NOT NULL,
	"cuerpo" text NOT NULL,
	"enviado_en" timestamp DEFAULT now() NOT NULL,
	"external_id" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_urn" varchar(64),
	"public_identifier" varchar(160),
	"linkedin_origen" varchar(20),
	"linkedin_obtenido_en" timestamp,
	"nombre" varchar(160) NOT NULL,
	"cargo" varchar(200),
	"empresa_id" integer,
	"email" varchar(254),
	"email_origen" varchar(20),
	"email_obtenido_en" timestamp,
	"email_verificado" boolean,
	"telefono" varchar(20),
	"telefono_origen" varchar(20),
	"telefono_obtenido_en" timestamp,
	"es_open_profile" boolean,
	"network_distance" smallint,
	"suprimido_en" timestamp,
	"suprimido_motivo" varchar(60),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_secuencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"campana_id" integer NOT NULL,
	"orden" smallint NOT NULL,
	"espera_dias" smallint DEFAULT 0 NOT NULL,
	"canal" varchar(20) NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"asunto" varchar(200),
	"plantilla" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_senales" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"tipo" varchar(40) NOT NULL,
	"resumen" text NOT NULL,
	"evidencia_url" varchar(500),
	"fecha_hecho" timestamp NOT NULL,
	"vence_en" timestamp NOT NULL,
	"estado" varchar(20) DEFAULT 'vigente' NOT NULL,
	"origen" varchar(20) NOT NULL,
	"obtenido_en" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_fuentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(40) NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"cuenta" varchar(120),
	"ultima_sync" timestamp,
	"frecuencia_min" integer DEFAULT 1440 NOT NULL,
	"ultimo_error" text,
	"nota" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_informes" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(160) NOT NULL,
	"desde" varchar(10) NOT NULL,
	"hasta" varchar(10) NOT NULL,
	"cuerpo_md" text NOT NULL,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"autor_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" varchar(10) NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"empresa" varchar(120),
	"email" varchar(254),
	"fuente_primer_toque" varchar(40) NOT NULL,
	"fuente_ultimo_toque" varchar(40) NOT NULL,
	"campania" varchar(160),
	"estado" varchar(20) DEFAULT 'nuevo' NOT NULL,
	"valor_clp" integer,
	"en_crm" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_mercado" (
	"id" serial PRIMARY KEY NOT NULL,
	"ano_comercial" smallint NOT NULL,
	"rubro" varchar(120) NOT NULL,
	"region" smallint,
	"tramo" smallint,
	"empresas" integer NOT NULL,
	"operativas" integer NOT NULL,
	"inversion" integer NOT NULL,
	"fuente" varchar(20) DEFAULT 'sii' NOT NULL,
	"obtenido_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_metricas_diarias" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" varchar(10) NOT NULL,
	"fuente_slug" varchar(40) NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"campania" varchar(160) NOT NULL,
	"impresiones" integer,
	"clics" integer,
	"costo_clp" integer,
	"envios" integer,
	"aperturas" integer,
	"interacciones" integer,
	"seguidores_nuevos" integer,
	"leads" integer,
	"cuota_impresiones" integer,
	"cuota_perdida_presupuesto" integer,
	"cuota_perdida_ranking" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "d360_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(254),
	"password_hash" text NOT NULL,
	"rol" varchar(20) DEFAULT 'analista' NOT NULL,
	"cuentas" jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_ingreso" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contenido_emisores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"tipo" varchar(20) DEFAULT 'persona' NOT NULL,
	"rol" varchar(60),
	"autor_urn" varchar(120),
	"token" text,
	"scopes" varchar(200),
	"token_vence_en" timestamp,
	"conectado_en" timestamp,
	"pausado" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contenido_piezas" (
	"id" serial PRIMARY KEY NOT NULL,
	"emisor_id" integer,
	"slot" smallint,
	"fecha_objetivo" date,
	"formato" varchar(20) DEFAULT 'texto' NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"cuerpo" text NOT NULL,
	"medio_urn" varchar(120),
	"medio_nombre" varchar(200),
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"segmento" varchar(120),
	"servicio" varchar(120),
	"aprobada_por" varchar(120),
	"aprobada_en" timestamp,
	"impresiones" integer,
	"interacciones" integer,
	"metricas_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contenido_publicaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"pieza_id" integer NOT NULL,
	"emisor_id" integer,
	"urn" varchar(120),
	"http" smallint,
	"error" text,
	"visibilidad" varchar(20),
	"simulado" smallint DEFAULT 0 NOT NULL,
	"publicada_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cafecito_ediciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(10) NOT NULL,
	"titulo" varchar(300) NOT NULL,
	"bajada" varchar(400),
	"contenido" text NOT NULL,
	"lectura" varchar(20),
	"publicada" boolean DEFAULT true NOT NULL,
	"publicada_en" timestamp DEFAULT now() NOT NULL,
	"actualizada_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cafecito_suscriptores" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"nombre" varchar(160),
	"empresa" varchar(160),
	"rol" varchar(160),
	"taza" varchar(30),
	"origen" varchar(30) DEFAULT 'web' NOT NULL,
	"token_confirmacion" varchar(64),
	"confirmacion_expira_en" timestamp,
	"confirmado_en" timestamp,
	"token_baja" varchar(64) NOT NULL,
	"baja_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_agricultores" (
	"id" serial PRIMARY KEY NOT NULL,
	"area" varchar(20) NOT NULL,
	"razon_social" varchar(200) NOT NULL,
	"nombre_contacto" varchar(160),
	"telefono" varchar(20),
	"email" varchar(254),
	"localidad" varchar(120),
	"region" varchar(120),
	"distribuidor" varchar(200),
	"zonal_id" integer,
	"zonal_nombre" varchar(120),
	"activo" boolean DEFAULT true NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_fotos" (
	"id" serial PRIMARY KEY NOT NULL,
	"visita_id" integer NOT NULL,
	"url" text NOT NULL,
	"tipo" varchar(20) DEFAULT 'general' NOT NULL,
	"wa_message_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_fotos_pendientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"url" text NOT NULL,
	"tipo" varchar(20) DEFAULT 'general' NOT NULL,
	"wa_message_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_informes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" varchar(20) NOT NULL,
	"area" varchar(20) NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"visita_id" integer,
	"lote_id" integer,
	"agricultor_id" integer,
	"cliente" varchar(200),
	"periodo_desde" timestamp,
	"periodo_hasta" timestamp,
	"contenido" jsonb NOT NULL,
	"generado_por" integer NOT NULL,
	"generado_en" timestamp DEFAULT now() NOT NULL,
	"aprobado_por" integer,
	"aprobado_en" timestamp,
	"enviado_por" integer,
	"enviado_en" timestamp,
	"enviado_a" varchar(200),
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_lotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"agricultor_id" integer NOT NULL,
	"area" varchar(20) NOT NULL,
	"codigo" varchar(60) NOT NULL,
	"temporada" varchar(20),
	"cultivo" varchar(80),
	"variedad" varchar(80),
	"relacion_hm" varchar(20),
	"hectareas" numeric(8, 2),
	"objetivo" varchar(60),
	"cliente_final" varchar(200),
	"idase" varchar(40),
	"tipo_semilla" varchar(60),
	"etapa_actual" varchar(40),
	"hitos" jsonb DEFAULT '{}'::jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(254),
	"telefono" varchar(20),
	"password_hash" text NOT NULL,
	"rol" varchar(20) DEFAULT 'zonal' NOT NULL,
	"area" varchar(20),
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_clave" boolean DEFAULT false NOT NULL,
	"ultimo_ingreso" timestamp,
	"area_audio" varchar(20),
	"recibe_informes" boolean DEFAULT false NOT NULL,
	"creado_por" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tuniche_visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"lote_id" integer,
	"agricultor_id" integer,
	"area" varchar(20) NOT NULL,
	"usuario_id" integer NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"origen" varchar(20) DEFAULT 'audio' NOT NULL,
	"wa_message_id" varchar(120),
	"audio_url" text,
	"transcripcion" text,
	"etapa" varchar(40),
	"datos" jsonb DEFAULT '{}'::jsonb,
	"nota_agronomica" integer,
	"resumen" text,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"validada_en" timestamp,
	"enviada_al_agricultor_en" timestamp,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reunion_compromisos" (
	"id" serial PRIMARY KEY NOT NULL,
	"reunion_id" integer NOT NULL,
	"compromiso" text NOT NULL,
	"responsable" varchar(160),
	"prioridad" varchar(10) DEFAULT 'media' NOT NULL,
	"plazo" varchar(120),
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reunion_registros" (
	"id" serial PRIMARY KEY NOT NULL,
	"clave" varchar(200) NOT NULL,
	"plataforma" varchar(40),
	"titulo" varchar(300),
	"ambito" varchar(40),
	"capturada_por" varchar(160),
	"inicio_en" timestamp with time zone,
	"fin_en" timestamp with time zone,
	"duracion_min" integer,
	"participantes" jsonb,
	"transcripcion" text NOT NULL,
	"bloques" jsonb,
	"chat" jsonb,
	"transcripcion_corregida" text,
	"tramos_sin_corregir" smallint,
	"crudo" jsonb,
	"estado" varchar(20) DEFAULT 'recibida' NOT NULL,
	"error" text,
	"resumen" text,
	"extraccion" jsonb,
	"intentos" smallint DEFAULT 0 NOT NULL,
	"modelo" varchar(80),
	"tokens_entrada" integer,
	"tokens_entrada_cache" integer,
	"tokens_salida" integer,
	"costo_usd" numeric(12, 6),
	"costo_aproximado" smallint DEFAULT 0 NOT NULL,
	"costo_vivo_usd" numeric(12, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resumida_en" timestamp with time zone,
	CONSTRAINT "reunion_registros_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "venta_actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"oportunidad_id" integer,
	"contacto_id" integer,
	"tipo" varchar(20) DEFAULT 'nota' NOT NULL,
	"detalle" text NOT NULL,
	"autor" varchar(160),
	"ocurrio_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta_contactos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer,
	"nombre" varchar(200) NOT NULL,
	"cargo" varchar(160),
	"email" varchar(254),
	"telefono" varchar(40),
	"linkedin" varchar(300),
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta_empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"rubro" varchar(120),
	"sitio" varchar(200),
	"tamano" varchar(40),
	"ciudad" varchar(120),
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venta_oportunidades" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"empresa_id" integer,
	"titulo" varchar(200) NOT NULL,
	"etapa" varchar(20) DEFAULT 'nuevo' NOT NULL,
	"monto" integer DEFAULT 0 NOT NULL,
	"probabilidad" smallint DEFAULT 5 NOT NULL,
	"fuente" varchar(40),
	"cierre_estimado" date,
	"abierto_en" timestamp with time zone DEFAULT now() NOT NULL,
	"cerrado_en" timestamp with time zone,
	"motivo_perdida" varchar(300),
	"ultima_actividad" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conocimiento_trozos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cuenta" varchar(40) NOT NULL,
	"origen" varchar(200) NOT NULL,
	"ruta" text NOT NULL,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"siempre" smallint DEFAULT 0 NOT NULL,
	"vector" vector(1536),
	"tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" text DEFAULT 'family' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"conversation_id" text DEFAULT 'family' NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compromisos" ADD CONSTRAINT "compromisos_acta_id_acta_reports_id_fk" FOREIGN KEY ("acta_id") REFERENCES "public"."acta_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_incidencia_id_incidencias_id_fk" FOREIGN KEY ("incidencia_id") REFERENCES "public"."incidencias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sheets" ADD CONSTRAINT "work_sheets_report_id_field_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."field_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_piezas" ADD CONSTRAINT "contenido_piezas_emisor_id_contenido_emisores_id_fk" FOREIGN KEY ("emisor_id") REFERENCES "public"."contenido_emisores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_publicaciones" ADD CONSTRAINT "contenido_publicaciones_pieza_id_contenido_piezas_id_fk" FOREIGN KEY ("pieza_id") REFERENCES "public"."contenido_piezas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_publicaciones" ADD CONSTRAINT "contenido_publicaciones_emisor_id_contenido_emisores_id_fk" FOREIGN KEY ("emisor_id") REFERENCES "public"."contenido_emisores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reunion_compromisos" ADD CONSTRAINT "reunion_compromisos_reunion_id_reunion_registros_id_fk" FOREIGN KEY ("reunion_id") REFERENCES "public"."reunion_registros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_actividades" ADD CONSTRAINT "venta_actividades_oportunidad_id_venta_oportunidades_id_fk" FOREIGN KEY ("oportunidad_id") REFERENCES "public"."venta_oportunidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_actividades" ADD CONSTRAINT "venta_actividades_contacto_id_venta_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."venta_contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_contactos" ADD CONSTRAINT "venta_contactos_empresa_id_venta_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."venta_empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_oportunidades" ADD CONSTRAINT "venta_oportunidades_contacto_id_venta_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."venta_contactos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venta_oportunidades" ADD CONSTRAINT "venta_oportunidades_empresa_id_venta_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."venta_empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_accounts_estado_idx" ON "crm_accounts" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_accounts_owner_idx" ON "crm_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_activities_account_idx" ON "crm_activities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_activities_deal_idx" ON "crm_activities" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_activities_fecha_idx" ON "crm_activities" USING btree ("ocurrido_en");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_alerts_clave_idx" ON "crm_alerts" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "crm_alerts_estado_idx" ON "crm_alerts" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_audiciones_contacto_idx" ON "crm_audiciones" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_audiciones_fecha_idx" ON "crm_audiciones" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "crm_audiciones_sala_idx" ON "crm_audiciones" USING btree ("sala_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_account_idx" ON "crm_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_contacts_telefono_idx" ON "crm_contacts" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "crm_contacts_estado_idx" ON "crm_contacts" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_contacts_owner_idx" ON "crm_contacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_deal_items_deal_idx" ON "crm_deal_items" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "crm_deals_etapa_idx" ON "crm_deals" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "crm_deals_account_idx" ON "crm_deals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_deals_owner_idx" ON "crm_deals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_order_items_order_idx" ON "crm_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "crm_order_items_product_idx" ON "crm_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "crm_orders_contact_idx" ON "crm_orders" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_orders_account_idx" ON "crm_orders" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_orders_fecha_idx" ON "crm_orders" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "crm_orders_origen_idx" ON "crm_orders" USING btree ("origen");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_orders_external_idx" ON "crm_orders" USING btree ("origen","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_perfil_atributo_idx" ON "crm_perfil_atributos" USING btree ("contact_id","clave");--> statement-breakpoint
CREATE INDEX "crm_perfil_clave_idx" ON "crm_perfil_atributos" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "crm_perfil_estado_idx" ON "crm_perfil_atributos" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_products_sku_idx" ON "crm_products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "crm_quote_items_quote_idx" ON "crm_quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "crm_quotes_estado_idx" ON "crm_quotes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_quotes_contact_idx" ON "crm_quotes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_quotes_telefono_idx" ON "crm_quotes" USING btree ("cotizante_telefono");--> statement-breakpoint
CREATE INDEX "crm_quotes_fecha_idx" ON "crm_quotes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_senales_clave_idx" ON "crm_senales" USING btree ("clave");--> statement-breakpoint
CREATE INDEX "crm_senales_estado_idx" ON "crm_senales" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_senales_contact_idx" ON "crm_senales" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "crm_senales_owner_idx" ON "crm_senales" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "crm_showroom_estado_idx" ON "crm_showroom_visitas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_showroom_fecha_idx" ON "crm_showroom_visitas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crm_showroom_telefono_idx" ON "crm_showroom_visitas" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "crm_touchpoints_account_idx" ON "crm_touchpoints" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "crm_touchpoints_campaign_idx" ON "crm_touchpoints" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "crm_touchpoints_fecha_idx" ON "crm_touchpoints" USING btree ("ocurrido_en");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_users_username_idx" ON "crm_users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_wa_conv_telefono_idx" ON "crm_wa_conversations" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "crm_wa_conv_estado_idx" ON "crm_wa_conversations" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "crm_wa_conv_destacada_idx" ON "crm_wa_conversations" USING btree ("destacada");--> statement-breakpoint
CREATE INDEX "crm_wa_msg_conv_idx" ON "crm_wa_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "crm_wa_msg_estado_idx" ON "crm_wa_messages" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "lead_acciones_cola_idx" ON "lead_acciones" USING btree ("estado","programada_en");--> statement-breakpoint
CREATE INDEX "lead_acciones_inscripcion_idx" ON "lead_acciones" USING btree ("inscripcion_id");--> statement-breakpoint
CREATE INDEX "lead_acciones_dia_idx" ON "lead_acciones" USING btree ("fecha_chile","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_acciones_un_toque_dia_idx" ON "lead_acciones" USING btree ("persona_id","fecha_chile") WHERE estado in ('pendiente', 'aprobada', 'enviada');--> statement-breakpoint
CREATE INDEX "lead_campanas_estado_idx" ON "lead_campanas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "lead_emisores_estado_idx" ON "lead_emisores" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_empresas_rut_idx" ON "lead_empresas" USING btree ("rut");--> statement-breakpoint
CREATE INDEX "lead_empresas_acteco_idx" ON "lead_empresas" USING btree ("acteco");--> statement-breakpoint
CREATE INDEX "lead_empresas_region_idx" ON "lead_empresas" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_inscripciones_unica_idx" ON "lead_inscripciones" USING btree ("persona_id","campana_id");--> statement-breakpoint
CREATE INDEX "lead_inscripciones_proximo_idx" ON "lead_inscripciones" USING btree ("proximo_paso_en");--> statement-breakpoint
CREATE INDEX "lead_inscripciones_estado_idx" ON "lead_inscripciones" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_mensajes_external_idx" ON "lead_mensajes" USING btree ("canal","external_id");--> statement-breakpoint
CREATE INDEX "lead_mensajes_persona_idx" ON "lead_mensajes" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "lead_mensajes_enviado_idx" ON "lead_mensajes" USING btree ("enviado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_personas_urn_idx" ON "lead_personas" USING btree ("member_urn");--> statement-breakpoint
CREATE INDEX "lead_personas_empresa_idx" ON "lead_personas" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "lead_personas_email_idx" ON "lead_personas" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_personas_suprimido_idx" ON "lead_personas" USING btree ("suprimido_en");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_secuencias_paso_idx" ON "lead_secuencias" USING btree ("campana_id","orden");--> statement-breakpoint
CREATE INDEX "lead_senales_empresa_idx" ON "lead_senales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "lead_senales_vence_idx" ON "lead_senales" USING btree ("vence_en");--> statement-breakpoint
CREATE INDEX "lead_senales_estado_idx" ON "lead_senales" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "d360_fuentes_slug_idx" ON "d360_fuentes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "d360_informes_hasta_idx" ON "d360_informes" USING btree ("hasta");--> statement-breakpoint
CREATE INDEX "d360_leads_fecha_idx" ON "d360_leads" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "d360_leads_estado_idx" ON "d360_leads" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "d360_mercado_celda_idx" ON "d360_mercado" USING btree ("ano_comercial","rubro","region","tramo");--> statement-breakpoint
CREATE INDEX "d360_mercado_rubro_idx" ON "d360_mercado" USING btree ("rubro");--> statement-breakpoint
CREATE INDEX "d360_metricas_fecha_idx" ON "d360_metricas_diarias" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "d360_metricas_fuente_idx" ON "d360_metricas_diarias" USING btree ("fuente_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "d360_users_username_idx" ON "d360_users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "contenido_emisores_vence_idx" ON "contenido_emisores" USING btree ("token_vence_en");--> statement-breakpoint
CREATE INDEX "contenido_piezas_estado_idx" ON "contenido_piezas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "contenido_piezas_fecha_idx" ON "contenido_piezas" USING btree ("fecha_objetivo");--> statement-breakpoint
CREATE INDEX "contenido_publicaciones_pieza_idx" ON "contenido_publicaciones" USING btree ("pieza_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cafecito_ediciones_slug_idx" ON "cafecito_ediciones" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cafecito_ediciones_publicada_idx" ON "cafecito_ediciones" USING btree ("publicada","publicada_en");--> statement-breakpoint
CREATE UNIQUE INDEX "cafecito_suscriptores_email_idx" ON "cafecito_suscriptores" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "cafecito_suscriptores_conf_idx" ON "cafecito_suscriptores" USING btree ("token_confirmacion");--> statement-breakpoint
CREATE UNIQUE INDEX "cafecito_suscriptores_baja_idx" ON "cafecito_suscriptores" USING btree ("token_baja");--> statement-breakpoint
CREATE INDEX "cafecito_suscriptores_envio_idx" ON "cafecito_suscriptores" USING btree ("estado","taza");--> statement-breakpoint
CREATE INDEX "tuniche_agricultores_area_idx" ON "tuniche_agricultores" USING btree ("area");--> statement-breakpoint
CREATE INDEX "tuniche_agricultores_zonal_idx" ON "tuniche_agricultores" USING btree ("zonal_id");--> statement-breakpoint
CREATE INDEX "tuniche_fotos_visita_idx" ON "tuniche_fotos" USING btree ("visita_id");--> statement-breakpoint
CREATE INDEX "tuniche_fotos_pend_usuario_idx" ON "tuniche_fotos_pendientes" USING btree ("usuario_id","created_at");--> statement-breakpoint
CREATE INDEX "tuniche_informes_tipo_idx" ON "tuniche_informes" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "tuniche_informes_estado_idx" ON "tuniche_informes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "tuniche_informes_agricultor_idx" ON "tuniche_informes" USING btree ("agricultor_id");--> statement-breakpoint
CREATE INDEX "tuniche_informes_lote_idx" ON "tuniche_informes" USING btree ("lote_id");--> statement-breakpoint
CREATE INDEX "tuniche_informes_generado_idx" ON "tuniche_informes" USING btree ("generado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "tuniche_informes_visita_idx" ON "tuniche_informes" USING btree ("visita_id");--> statement-breakpoint
CREATE INDEX "tuniche_lotes_agricultor_idx" ON "tuniche_lotes" USING btree ("agricultor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tuniche_lotes_codigo_idx" ON "tuniche_lotes" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "tuniche_usuarios_username_idx" ON "tuniche_usuarios" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "tuniche_usuarios_telefono_idx" ON "tuniche_usuarios" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "tuniche_usuarios_area_idx" ON "tuniche_usuarios" USING btree ("area");--> statement-breakpoint
CREATE INDEX "tuniche_visitas_lote_idx" ON "tuniche_visitas" USING btree ("lote_id");--> statement-breakpoint
CREATE INDEX "tuniche_visitas_usuario_idx" ON "tuniche_visitas" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tuniche_visitas_fecha_idx" ON "tuniche_visitas" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "tuniche_visitas_estado_idx" ON "tuniche_visitas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "reunion_compromisos_reunion_idx" ON "reunion_compromisos" USING btree ("reunion_id");--> statement-breakpoint
CREATE INDEX "reunion_registros_inicio_idx" ON "reunion_registros" USING btree ("inicio_en");--> statement-breakpoint
CREATE INDEX "reunion_registros_estado_idx" ON "reunion_registros" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "reunion_registros_ambito_idx" ON "reunion_registros" USING btree ("ambito");--> statement-breakpoint
CREATE INDEX "venta_actividades_oportunidad_idx" ON "venta_actividades" USING btree ("oportunidad_id");--> statement-breakpoint
CREATE INDEX "venta_actividades_fecha_idx" ON "venta_actividades" USING btree ("ocurrio_en");--> statement-breakpoint
CREATE INDEX "venta_contactos_empresa_idx" ON "venta_contactos" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "venta_contactos_nombre_idx" ON "venta_contactos" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "venta_empresas_nombre_idx" ON "venta_empresas" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "venta_oportunidades_etapa_idx" ON "venta_oportunidades" USING btree ("etapa");--> statement-breakpoint
CREATE INDEX "venta_oportunidades_contacto_idx" ON "venta_oportunidades" USING btree ("contacto_id");--> statement-breakpoint
CREATE INDEX "venta_oportunidades_empresa_idx" ON "venta_oportunidades" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "conocimiento_trozos_cuenta_idx" ON "conocimiento_trozos" USING btree ("cuenta");--> statement-breakpoint
CREATE INDEX "conocimiento_trozos_siempre_idx" ON "conocimiento_trozos" USING btree ("siempre");--> statement-breakpoint
CREATE INDEX "idx_messages_conv" ON "messages" USING btree ("conversation_id","id");