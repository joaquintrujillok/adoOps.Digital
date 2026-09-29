CREATE TABLE "vanni_cupones" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(40) NOT NULL,
	"codigo" varchar(12) NOT NULL,
	"captura_id" integer,
	"rut" varchar(12) NOT NULL,
	"telefono" varchar(20),
	"nombre" varchar(160),
	"descuento" text NOT NULL,
	"estado" varchar(12) DEFAULT 'vigente' NOT NULL,
	"vence_at" timestamp with time zone NOT NULL,
	"canjeado_at" timestamp with time zone,
	"canjeado_por" integer,
	"sucursal_canje" varchar(80),
	"boleta" varchar(40),
	"monto_compra" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vanni_cupones" ADD CONSTRAINT "vanni_cupones_captura_id_vanni_capturas_id_fk" FOREIGN KEY ("captura_id") REFERENCES "public"."vanni_capturas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vanni_cupones" ADD CONSTRAINT "vanni_cupones_canjeado_por_vanni_usuarios_id_fk" FOREIGN KEY ("canjeado_por") REFERENCES "public"."vanni_usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_cupones_token_idx" ON "vanni_cupones" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_cupones_codigo_idx" ON "vanni_cupones" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "vanni_cupones_rut_idx" ON "vanni_cupones" USING btree ("rut");