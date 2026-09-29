CREATE TABLE "vanni_cola" (
	"id" integer PRIMARY KEY NOT NULL,
	"ocupada_hasta" timestamp with time zone NOT NULL,
	"dueno" varchar(40)
);
--> statement-breakpoint
ALTER TABLE "vanni_campanas" ADD COLUMN "imagen_url" text;--> statement-breakpoint
ALTER TABLE "vanni_campanas" ADD COLUMN "pausa_motivo" text;--> statement-breakpoint
CREATE UNIQUE INDEX "vanni_mensajes_entrante_wa_idx" ON "vanni_mensajes" USING btree ("wa_msg_id") WHERE "vanni_mensajes"."direccion" = 'in' and "vanni_mensajes"."wa_msg_id" is not null;