# Las preguntas del levantamiento viven en tuniche-levantamiento-preguntas.py
# y de ahí salen las DOS salidas: el .xlsx que se manda y la página que se
# publica. Escritas dos veces, se habrían separado al primer cambio de
# redacción — y la que se separa siempre es la que el cliente termina leyendo.
import sys, html, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from importlib import import_module
_p = import_module("tuniche-levantamiento-preguntas")
BLOQUES, STACK = _p.BLOQUES, _p.STACK
e = html.escape

CSS = open("/Users/joaquintrujillo/Proyectos/adoOps.Digital/docs/sistema_funcional/levantamiento-costeo.html").read()
CSS = CSS[CSS.index("<style>"):CSS.index("</style>") + 8]

filas_stack = "\n".join(
    f"    <tr><td>{e(a)}</td><td>{e(b)}</td></tr>" for a, b in STACK)

bloques = []
for titulo, quien, bajada, filas in BLOQUES:
    secs, orden = {}, []
    for seccion, preg, ayuda, clave in filas:
        if seccion not in secs:
            secs[seccion] = []; orden.append(seccion)
        secs[seccion].append((preg, ayuda, clave))

    partes = [f'''<section class="bloque">
  <h2>{e(titulo.split("· ")[1])}</h2>
  <p class="sub">{e(bajada)}</p>
  <span class="quien">{e(quien)}</span>''']
    for seccion in orden:
        partes.append(f"  <h3>{e(seccion)}</h3>\n  <ol class=\"preguntas\">")
        for preg, ayuda, clave in secs[seccion]:
            cls = ' class="clave"' if clave else ""
            ay = f'\n      <div class="por-que">{e(ayuda)}</div>' if ayuda else ""
            partes.append(f'    <li{cls}>\n      <div class="p">{e(preg)}</div>{ay}\n    </li>')
        partes.append("  </ol>")
    partes.append("</section>")
    bloques.append("\n".join(partes))

total = sum(len(b[3]) for b in BLOQUES)
clave = sum(1 for b in BLOQUES for f in b[3] if f[3])

doc = f'''<title>SaaS o servidor propio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=IBM+Plex+Mono:wght@400;600&display=swap">

{CSS}

<div class="wrap">

<header class="top">
  <p class="eyebrow">Semillas Tuniche · Sistema de visitas a campo</p>
  <h1>SaaS o servidor propio</h1>
  <p class="lede">Necesitamos entender cómo funciona hoy su infraestructura y su
  operación para dimensionar bien las dos alternativas: mantener el sistema como
  servicio mensual, o instalarlo en sus servidores.</p>
</header>

<hr class="rule">

<div class="nota" style="margin-top:32px">
  <p><strong>Tres bloques, {total} preguntas.</strong> Los responde gente distinta y
  ninguno necesita esperar a los otros: el primero lo contesta TI, el segundo y el
  tercero jefatura.</p>
  <p>Las {clave} marcadas <strong>«Necesario para costear»</strong> son las que pueden
  cambiar el alcance o el esfuerzo. Las demás ayudan a diseñar mejor, pero no
  bloquean una primera estimación. Si algo no lo saben todavía, dejarlo en blanco
  es más útil que una aproximación.</p>
</div>

<h2 style="font-size:22px;font-weight:600;margin:52px 0 4px">Qué habría que definir si va a sus servidores</h2>
<div class="tabla-envoltorio">
<table>
  <thead><tr><th>Cómo funciona hoy</th><th>Qué habría que definir</th></tr></thead>
  <tbody>
{filas_stack}
  </tbody>
</table>
</div>

{"\n\n".join(bloques)}

<footer>
  <p>adoOps · Levantamiento para costear el sistema de visitas a campo · agosto de 2026</p>
</footer>

</div>
'''
open("/Users/joaquintrujillo/Proyectos/adoOps.Digital/docs/sistema_funcional/levantamiento-costeo.html","w").write(doc)
print(f"✓ html regenerado desde los mismos datos · {total} preguntas · {clave} necesarias")
