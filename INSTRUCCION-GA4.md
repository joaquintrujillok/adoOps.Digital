# Google Analytics 4 en adoOps.Digital

Repo: `~/Proyectos/adoOps.Digital`

Estado al 07-09-2026: **no hay nada de GA en el código**. Ni `gtag`, ni GTM, ni
`@next/third-parties`. Lo único instalado es `@vercel/analytics`, que es otra
cosa y se queda.

El ID de medición (`G-XXXXXXXXXX`) lo entrega la consola de Analytics al crear
el flujo de datos web. Si todavía no lo tienes, esta tarea espera: sin ese ID no
hay nada que configurar.

## 1. Instalar

```
npm i @next/third-parties
```

Es el componente oficial de Next para GA4. Carga el script con la estrategia
correcta para el App Router y evita el `<script>` a mano, que en Next 16 se
inyecta mal más veces de las que uno quisiera.

## 2. Montarlo en el layout

En `app/layout.tsx`, junto a `<Analytics />` que ya está:

```tsx
import { GoogleAnalytics } from "@next/third-parties/google";

// dentro del <body>, al final:
{process.env.NEXT_PUBLIC_GA_ID && (
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
)}
```

El guard no es decorativo: sin él, un entorno sin la variable inyecta un script
con `gaId` undefined y ensucia la consola del navegador.

## 3. La variable de entorno, solo en producción

`NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX` en Vercel, **marcada únicamente para
Production**. No la pongas en Preview ni en Development.

La razón importa: cada deploy de preview genera una URL propia, y si esas
visitas entran a la misma propiedad terminas midiendo tu propio trabajo. Con la
variable ausente en preview, el guard del punto 2 simplemente no monta nada.

Añádela también a `.env.local` si quieres probarla en local, pero acuérdate de
sacarla: es el mismo problema.

## 4. Eventos que sí importan

GA4 mide páginas vistas solo. Para este sitio, lo que hay que saber es cuánta
gente se suscribe, y eso son dos momentos distintos:

- **`suscripcion_iniciada`** — al enviar el correo en `/cafecito-ia`
  (`registrar` en `lib/cafecito/actions.ts` devuelve `status: "success"`).
- **`suscripcion_confirmada`** — al completar el perfilamiento
  (`perfilar` devuelve `status: "success"`). Manda la taza elegida como
  parámetro: es el dato que dice qué audiencia estás atrayendo.

Ambos se disparan desde el cliente, en los componentes que ya tienen el estado
de la acción. Con `sendGAEvent` de `@next/third-parties/google`:

```tsx
import { sendGAEvent } from "@next/third-parties/google";
// al detectar el success:
sendGAEvent("event", "suscripcion_confirmada", { taza });
```

La distancia entre los dos números es la tasa de abandono del doble opt-in, que
hoy no sabes y es lo más accionable que te va a dar GA4.

Después, en la consola, márcalos como **eventos clave** para que aparezcan como
conversiones.

## 5. Verificación

- Abre el sitio en producción y confirma en *Tiempo real* de GA4 que aparece la
  visita.
- Revisa en las herramientas de desarrollo que se cargue `gtag/js?id=G-...` y
  que no haya errores.
- Suscríbete con un correo de prueba y confirma que los dos eventos llegan.
- Confirma que un deploy de preview **no** registra nada.

## Cosas que se deciden en la consola, no acá

Las dejo anotadas para que no se pierdan; van en la interfaz de GA4:

- **Excluir tu propio tráfico.** Sin esto, tus visitas de desarrollo son una
  parte enorme de los datos de un sitio nuevo.
- **Retención de datos a 14 meses.** El valor por defecto es 2 meses y no se
  puede recuperar lo que ya se descartó.
- **Enlazar con Search Console**, para ver consultas de búsqueda dentro de GA4.
- **Zona horaria en Santiago y moneda en CLP**, si no quedaron así.

## Un punto que no es técnico

GA4 usa cookies y sigue a personas identificables. La ley chilena de protección
de datos (21.719) entra en vigencia en los próximos meses y cambia lo que se
puede hacer sin consentimiento. No soy abogado y no te voy a decir que estás
cubierto: vale que lo revises con quien corresponda antes de dar por cerrado el
tema, y considerar un aviso de cookies. Vercel Analytics no tiene este problema
porque no usa cookies ni identifica personas — si el resultado de esa revisión
es incómodo, tienes esa alternativa ya instalada.

## Reglas del repo

- `db/schema.ts` re-exporta los 10 archivos de `db/`. Que siga así.
- **Nunca `drizzle-kit push`** contra esta base: es compartida.
- Migraciones antes del despliegue, no después.
