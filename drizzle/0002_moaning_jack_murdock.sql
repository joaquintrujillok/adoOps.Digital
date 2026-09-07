-- Cafecito: el slug pasa a derivarse del título y la fecha gana columna propia.
--
-- Escrito a mano sobre lo que generó drizzle-kit. Lo generado era:
--
--   ALTER TABLE "cafecito_ediciones" ADD COLUMN "fecha" date NOT NULL;
--
-- y eso revienta: la tabla ya tiene ediciones publicadas, y una columna NOT NULL
-- sin default no tiene qué poner en ellas. Va en tres pasos —agregar, rellenar,
-- exigir— que es la forma de agregar una columna obligatoria a una tabla con
-- datos sin quedarse a medias.
--
-- El relleno sale del propio slug: hasta hoy TODO slug era `YYYY-MM-DD`, así que
-- la fecha ya estaba ahí, solo que sin poder consultarse ni ordenarse aparte.

ALTER TABLE "cafecito_ediciones" ALTER COLUMN "slug" SET DATA TYPE varchar(200);--> statement-breakpoint

ALTER TABLE "cafecito_ediciones" ADD COLUMN "fecha" date;--> statement-breakpoint

-- El `WHERE` no es decoración: si mañana esta migración corriera sobre una base
-- donde algún slug ya no es una fecha, el cast la tumbaría. Así esas filas se
-- saltan y el `SET NOT NULL` de abajo falla con un mensaje claro en vez de
-- romperse a mitad de camino.
UPDATE "cafecito_ediciones"
   SET "fecha" = "slug"::date
 WHERE "fecha" IS NULL
   AND "slug" ~ '^\d{4}-\d{2}-\d{2}$';--> statement-breakpoint

ALTER TABLE "cafecito_ediciones" ALTER COLUMN "fecha" SET NOT NULL;--> statement-breakpoint

-- Una edición por día. Antes lo garantizaba el índice único del slug, porque el
-- slug era la fecha; al soltar esa atadura hay que declararlo, y además la
-- redirección de las URLs viejas busca por fecha y necesita una sola fila.
CREATE UNIQUE INDEX "cafecito_ediciones_fecha_idx" ON "cafecito_ediciones" USING btree ("fecha");
