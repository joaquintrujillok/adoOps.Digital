# Brief · Ordenar los módulos de adoOps.Digital

**Para:** una sesión de Claude Code (o quien tome el trabajo) sobre el repo
`joaquintrujillok/adoOps.Digital`.
**Duración estimada:** una sesión larga.
**No toca:** el motor de prospección (`/dashboard360/motor`), que está en
producción y se acaba de desplegar.

---

## El problema, en una frase

La web acumuló módulos que se construyeron uno tras otro y **hoy nada distingue
un demo de venta de un sistema en producción**. Alguien que abre el repo —o el
sitio— no puede saber si lo que está viendo tiene datos reales, datos sembrados,
o clientes de verdad detrás.

Eso ya tiene un costo concreto: en un proyecto hermano (el CRM de CDC) unas
fichas de prueba terminaron en el sistema de producción de un cliente y quedaron
ahí para siempre, porque nada en la pantalla decía a qué ambiente se estaba
escribiendo. El riesgo acá es el mismo con otra forma.

## Lo que ya está decidido

| Módulo | Estado |
|---|---|
| `/dashboard360/motor` — motor de prospección | **Producción**, uso interno de adOps |
| `/crm` — CRM de Highend | **Demo** comercial |

Todo lo demás hay que clasificarlo, y **la clasificación la confirma Joaquín, no
la deduce quien tome este trabajo.** Si un módulo es ambiguo, se pregunta.

## Inventario de partida

Rutas de primer nivel en `app/`:

```
/                  página corporativa
/framework         (único enlace desde la home)
/crm               CRM de Highend · sesión propia · db/crm.ts
/dashboard360      Panel 360 · sesión propia · db/dashboard360.ts
  └ /motor         Motor de prospección · db/leads.ts
/leads             redirects legacy → /dashboard360/motor
/terreno           demo · WhatsApp → IA → dashboard
/actas             demo · misma tubería, otro esquema
/mantencion        demo · misma tubería, otro esquema
/mix  /tv/[room]   TV Mix · música y pantalla
/showroom          ?
/admin             ?
```

APIs: `/api/{crm,dashboard360,leads,mix,whatsapp}`.
Esquemas: `db/{crm,dashboard360,leads,schema}.ts`.
Docs existentes: `docs/*-demo.md` para terreno, actas y mantención.

Hay una pista útil ya en el repo: `lib/demo-settings.ts` tiene una noción de
"demo activo" con tres verticales. O sea, la idea de que hay cosas que son demos
**ya existe a medias** — falta hacerla explícita y extenderla.

---

## El trabajo

### 1 · Inventario real

Recorrer `app/`, `lib/`, `db/`, `docs/` y armar la tabla completa. Por cada
módulo:

- ruta, tablas que usa, si tiene sesión propia o comparte
- **de dónde salen sus datos**: reales, sembrados, o mock
- quién lo mira: un cliente, un prospecto en una reunión, el equipo de adOps
- si está vivo o quedó abandonado

Los módulos abandonados son parte del hallazgo. Reportarlos, no borrarlos por
cuenta propia.

### 2 · La clasificación

Proponer tres o cuatro estados —algo como **producción · demo · interno ·
archivado**— y definirlos por lo que implican, no por lo que suenan:

- ¿puede tener datos de personas reales?
- ¿se puede romper sin avisarle a nadie?
- ¿aparece en el menú, o se llega solo con el link?

Llevarle la propuesta a Joaquín **antes** de aplicarla.

### 3 · Una fuente de verdad, no un documento

Un `docs/modulos.md` se desactualiza en dos semanas. La recomendación es un
**registro en código** —algo como `lib/modulos.ts`— que declare cada módulo con
su estado, su dueño, su origen de datos y quién lo ve, y que lo lean:

- la navegación, para decidir qué se pinta
- la home o un índice interno, para listarlos
- **la pantalla del propio módulo**, para poder marcarse

Ese tercer punto es el que importa de verdad y el que casi nunca se hace.

### 4 · Que la diferencia se vea en la pantalla

**Un demo tiene que decir que es un demo, dentro del demo.** No en un README:
en la interfaz, donde está la persona que podría confundirse.

No hace falta que sea feo ni que arruine una reunión de venta — un chip discreto
y consistente basta. Lo que no puede pasar es que un módulo con datos sembrados
se vea idéntico a uno con datos de clientes.

Precedente que conviene copiar: en el CRM de CDC, `pre_quotes.salucloud_env`
guarda **por fila** contra qué ambiente se escribió, y la pantalla lo muestra
cuando no es producción. Sin esa etiqueta, una conversión de prueba se lee igual
que una real. La lección es que el estado se guarda con el dato, no se deduce de
la configuración de hoy.

### 5 · Aplicarlo

Marcar cada módulo, ajustar la navegación, y dejar un `docs/modulos.md` **corto**
que explique la convención y remita al registro para el detalle.

---

## Restricciones

- **No tocar `/dashboard360/motor` ni `lib/leads/*`.** Está en producción y se
  desplegó hoy. Si el ordenamiento lo afecta, se propone y se espera.
- **Un commit por paso**, con mensajes que expliquen el porqué y no solo el qué
  — es la convención del repo, y sus comentarios de código son la mejor
  referencia de tono.
- **Antes de desplegar:** `npm run al-dia`, `npx tsc --noEmit`, `npx next build`.
  Y para desplegar, `npm run desplegar` — **nunca `vercel --prod` directo**: ese
  comando sube la carpeta local y desde un clon atrasado hace retroceder
  producción. Ya pasó una vez.
- Producción se despliega **empujando a `main`**; la integración de Git lo hace
  sola.

## Qué se entrega

1. La tabla del inventario, con la clasificación propuesta y las dudas marcadas.
2. El registro en código, con la convención aplicada a todos los módulos.
3. `docs/modulos.md` corto.
4. Una lista de lo que quedó pendiente o hay que decidir.

## Lo primero que hay que preguntar

- ¿Qué son `/framework`, `/showroom` y `/admin`? No tienen doc.
- ¿`/mix` y `/tv` siguen vivos o son de otra etapa?
- ¿Los tres demos de WhatsApp (terreno, actas, mantención) se muestran a
  prospectos hoy, o quedaron de un ciclo anterior?
- ¿Hay algún módulo con datos de personas reales además del motor?

La última es la más importante: define cuáles hay que revisar con cuidado bajo la
Ley 21.719, que entra en vigencia el 1 de diciembre.
