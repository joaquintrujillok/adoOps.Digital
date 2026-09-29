CREATE TABLE "vanni_campanas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"promocion" text NOT NULL,
	"condiciones" text,
	"ejecutiva_id" integer,
	"estado" varchar(20) DEFAULT 'borrador' NOT NULL,
	"segmentos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sucursales" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recordatorio_horas" integer,
	"ejemplo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_at" timestamp with time zone,
	"terminada_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vanni_categorias" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" varchar(160) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"parent_id" integer,
	"conteo" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_contactos" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefono" varchar(20) NOT NULL,
	"nombre" varchar(160),
	"razon_social" varchar(200),
	"rut" varchar(20),
	"email" varchar(254),
	"sucursal" varchar(80),
	"categoria_habitual" varchar(120),
	"ejecutiva_id" integer,
	"ultima_compra" date,
	"n_compras" integer,
	"monto_total" bigint,
	"r_score" smallint,
	"f_score" smallint,
	"m_score" smallint,
	"segmento" varchar(40) DEFAULT 'Sin historial' NOT NULL,
	"estado" varchar(20) DEFAULT 'activo' NOT NULL,
	"origen" varchar(20) DEFAULT 'manual' NOT NULL,
	"ejemplo" boolean DEFAULT false NOT NULL,
	"baja_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_envios" (
	"id" serial PRIMARY KEY NOT NULL,
	"campana_id" integer NOT NULL,
	"contacto_id" integer NOT NULL,
	"variante_id" integer,
	"telefono" varchar(20) NOT NULL,
	"texto" text NOT NULL,
	"estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"entrega" varchar(20),
	"wa_msg_id" varchar(64),
	"wa_key_id" varchar(128),
	"error" text,
	"intentos" smallint DEFAULT 0 NOT NULL,
	"enviado_at" timestamp with time zone,
	"entregado_at" timestamp with time zone,
	"leido_at" timestamp with time zone,
	"respondio_at" timestamp with time zone,
	"resultado" varchar(20),
	"recordatorio_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_mensajes" (
	"id" serial PRIMARY KEY NOT NULL,
	"telefono" varchar(20) NOT NULL,
	"flujo" varchar(20) NOT NULL,
	"direccion" varchar(4) NOT NULL,
	"texto" text NOT NULL,
	"imagen_url" text,
	"simulado" boolean DEFAULT false NOT NULL,
	"wa_msg_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_oportunidades" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"campana_id" integer,
	"envio_id" integer,
	"ejecutiva_id" integer,
	"tipo" varchar(20) DEFAULT 'interes' NOT NULL,
	"interes" text,
	"resumen" text,
	"estado" varchar(20) DEFAULT 'por_llamar' NOT NULL,
	"notas" text,
	"monto_cotizado" bigint,
	"notificada_at" timestamp with time zone,
	"ejemplo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_pedido_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"producto_id" integer,
	"nombre" varchar(300) NOT NULL,
	"precio" integer NOT NULL,
	"cantidad" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(20) NOT NULL,
	"telefono" varchar(20) NOT NULL,
	"contacto_id" integer,
	"nombre_cliente" varchar(160),
	"direccion" text,
	"estado" varchar(20) DEFAULT 'pendiente_pago' NOT NULL,
	"total" integer NOT NULL,
	"token_pago" varchar(40) NOT NULL,
	"historial" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"simulado" boolean DEFAULT false NOT NULL,
	"pagado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_presupuesto" (
	"fecha" date PRIMARY KEY NOT NULL,
	"llamadas" integer DEFAULT 0 NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_salida" integer DEFAULT 0 NOT NULL,
	"costo_usd" numeric(10, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"woo_id" integer NOT NULL,
	"sku" varchar(60),
	"nombre" varchar(300) NOT NULL,
	"slug" varchar(300),
	"descripcion" text,
	"categoria" varchar(160),
	"categoria_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"imagen_url" text,
	"imagen_origen" text,
	"permalink" text,
	"precio" integer NOT NULL,
	"precio_ficticio" boolean DEFAULT true NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"destacado" boolean DEFAULT false NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_sesiones" (
	"telefono" varchar(20) PRIMARY KEY NOT NULL,
	"flujo" varchar(20) NOT NULL,
	"contacto_id" integer,
	"campana_id" integer,
	"estado" jsonb,
	"actualizada_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"email" varchar(254),
	"telefono" varchar(20),
	"rol" varchar(20) DEFAULT 'ejecutiva' NOT NULL,
	"password_hash" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_clave" boolean DEFAULT true NOT NULL,
	"ultimo_ingreso" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_variantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campana_id" integer NOT NULL,
	"codigo" varchar(4) NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"plantilla" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vanni_campanas" ADD CONSTRAINT "vanni_campanas_ejecutiva_id_vanni_usuarios_id_fk" FOREIGN KEY ("ejecutiva_id") REFERENCES "public"."vanni_usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_contactos" ADD CONSTRAINT "vanni_contactos_ejecutiva_id_vanni_usuarios_id_fk" FOREIGN KEY ("ejecutiva_id") REFERENCES "public"."vanni_usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_envios" ADD CONSTRAINT "vanni_envios_campana_id_vanni_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."vanni_campanas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_envios" ADD CONSTRAINT "vanni_envios_contacto_id_vanni_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."vanni_contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_envios" ADD CONSTRAINT "vanni_envios_variante_id_vanni_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."vanni_variantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_oportunidades" ADD CONSTRAINT "vanni_oportunidades_contacto_id_vanni_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."vanni_contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_oportunidades" ADD CONSTRAINT "vanni_oportunidades_campana_id_vanni_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."vanni_campanas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_oportunidades" ADD CONSTRAINT "vanni_oportunidades_envio_id_vanni_envios_id_fk" FOREIGN KEY ("envio_id") REFERENCES "public"."vanni_envios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_oportunidades" ADD CONSTRAINT "vanni_oportunidades_ejecutiva_id_vanni_usuarios_id_fk" FOREIGN KEY ("ejecutiva_id") REFERENCES "public"."vanni_usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_pedido_items" ADD CONSTRAINT "vanni_pedido_items_pedido_id_vanni_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."vanni_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_pedido_items" ADD CONSTRAINT "vanni_pedido_items_producto_id_vanni_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."vanni_productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_pedidos" ADD CONSTRAINT "vanni_pedidos_contacto_id_vanni_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."vanni_contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_sesiones" ADD CONSTRAINT "vanni_sesiones_contacto_id_vanni_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."vanni_contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_sesiones" ADD CONSTRAINT "vanni_sesiones_campana_id_vanni_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."vanni_campanas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_variantes" ADD CONSTRAINT "vanni_variantes_campana_id_vanni_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."vanni_campanas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_contactos_telefono_idx" ON "vanni_contactos" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "vanni_contactos_segmento_idx" ON "vanni_contactos" USING btree ("segmento");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_envios_campana_contacto_idx" ON "vanni_envios" USING btree ("campana_id","contacto_id");--> statement-breakpoint
CREATE INDEX "vanni_envios_estado_idx" ON "vanni_envios" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "vanni_envios_telefono_idx" ON "vanni_envios" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "vanni_envios_msg_idx" ON "vanni_envios" USING btree ("wa_msg_id");--> statement-breakpoint
CREATE INDEX "vanni_envios_key_idx" ON "vanni_envios" USING btree ("wa_key_id");--> statement-breakpoint
CREATE INDEX "vanni_mensajes_telefono_idx" ON "vanni_mensajes" USING btree ("telefono","created_at");--> statement-breakpoint
CREATE INDEX "vanni_oportunidades_estado_idx" ON "vanni_oportunidades" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_pedidos_codigo_idx" ON "vanni_pedidos" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_pedidos_token_idx" ON "vanni_pedidos" USING btree ("token_pago");--> statement-breakpoint
CREATE INDEX "vanni_pedidos_telefono_idx" ON "vanni_pedidos" USING btree ("telefono");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_productos_woo_idx" ON "vanni_productos" USING btree ("woo_id");--> statement-breakpoint
CREATE INDEX "vanni_productos_categoria_idx" ON "vanni_productos" USING btree ("categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_usuarios_username_idx" ON "vanni_usuarios" USING btree ("username");