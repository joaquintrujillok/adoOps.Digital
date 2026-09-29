CREATE TABLE "vanni_capturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(12) NOT NULL,
	"rut" varchar(12) NOT NULL,
	"cliente_id" integer,
	"encontrado" boolean DEFAULT false NOT NULL,
	"sucursal" varchar(80),
	"telefono" varchar(20),
	"origen_telefono" varchar(12),
	"consentimiento" boolean DEFAULT false NOT NULL,
	"completada_at" timestamp with time zone,
	"whatsapp_at" timestamp with time zone,
	"origen_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_clientes_maestra" (
	"id" serial PRIMARY KEY NOT NULL,
	"rut" varchar(12) NOT NULL,
	"nombre" varchar(160),
	"razon_social" varchar(200),
	"telefono" varchar(20),
	"email" varchar(254),
	"sucursal" varchar(80),
	"descuento" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vanni_promociones" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(160) NOT NULL,
	"detalle" text,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vanni_capturas" ADD CONSTRAINT "vanni_capturas_cliente_id_vanni_clientes_maestra_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."vanni_clientes_maestra"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_capturas_codigo_idx" ON "vanni_capturas" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "vanni_capturas_rut_idx" ON "vanni_capturas" USING btree ("rut");--> statement-breakpoint
CREATE INDEX "vanni_capturas_origen_idx" ON "vanni_capturas" USING btree ("origen_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_clientes_maestra_rut_idx" ON "vanni_clientes_maestra" USING btree ("rut");