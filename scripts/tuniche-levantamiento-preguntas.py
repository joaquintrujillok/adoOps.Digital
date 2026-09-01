# (seccion, pregunta, ayuda, necesario_para_costear)
BLOQUES = [
 ("1 · Tecnología", "Responde: TI",
  "Cómo funciona hoy su infraestructura, para saber qué implicaría instalar el sistema en sus servidores.",
 [
  ("Servidores", "¿Dónde correrían una aplicación web como esta?",
   "Servidores propios, máquinas virtuales, Azure u otro.", True),
  ("Servidores", "¿Usan contenedores o instalan las aplicaciones directo en el servidor?",
   "Docker, Kubernetes u otro.", False),
  ("Servidores", "¿Qué sistema operativo usan en esos servidores?", "", False),
  ("Servidores", "¿Pueden instalar Node.js, o ya lo tienen disponible?",
   "Si ya lo tienen, indicar la versión.", False),
  ("Servidores", "¿Cómo publican hoy una aplicación para que sea accesible desde internet?",
   "El sistema recibe los mensajes de WhatsApp por una llamada entrante, así que necesita una dirección pública.", True),
  ("Servidores", "¿Qué revisiones o autorizaciones piden para publicar algo hacia afuera?", "", False),

  ("Base de datos", "¿Qué motor de base de datos usan?",
   "SQL Server, PostgreSQL, Oracle u otro.", True),
  ("Base de datos", "¿Quién administra las bases de datos?",
   "Equipo interno, proveedor externo, el mismo equipo de desarrollo.", False),
  ("Base de datos", "¿Qué política de respaldos aplican a un sistema como este?", "", False),

  ("Archivos", "¿Dónde guardan hoy los archivos que genera una aplicación?",
   "Carpeta de red, Azure Blob, SharePoint u otro.", False),
  ("Archivos", "¿Hay límite de espacio o tiempo de conservación?",
   "Cada visita puede traer tres fotos de teléfono.", False),

  ("Inteligencia artificial", "¿Tienen Azure OpenAI habilitado?", "", True),
  ("Inteligencia artificial", "¿Hay política sobre qué modelos de IA se pueden usar?", "", True),
  ("Inteligencia artificial", "¿Los datos deben quedar en alguna región en particular?", "", False),
  ("Inteligencia artificial", "¿Pueden salir datos de la empresa hacia un servicio externo para ser procesados?",
   "Hoy el audio del zonal y el nombre del agricultor se procesan fuera de la red.", True),
  ("Inteligencia artificial", "¿Quién autoriza cambiar de modelo, y cuánto suele demorar?", "", False),

  ("WhatsApp", "¿El número debe ser corporativo?", "", False),
  ("WhatsApp", "¿Tienen una cuenta de WhatsApp Business verificada a nombre de la empresa?",
   "WhatsApp siempre pasa por Meta o por un proveedor: no se puede instalar en un servidor propio.", True),
  ("WhatsApp", "¿Hay restricciones internas para usar WhatsApp en comunicaciones de la empresa?", "", False),

  ("Usuarios y accesos", "¿Prefieren que entren con su cuenta de Microsoft o con un usuario propio del sistema?",
   "Hoy el sistema usa usuario y contraseña propios.", True),
  ("Usuarios y accesos", "¿Los zonales tienen cuenta corporativa y la usan desde el teléfono?", "", False),
  ("Usuarios y accesos", "¿Exigen segundo factor para sistemas internos?", "", False),

  ("Integración con el SIA", "¿El SIA tiene API, base consultable, o solo permite exportar a Excel?",
   "Hoy los agricultores y lotes se cargan desde un Excel exportado.", True),
  ("Integración con el SIA", "¿Quién mantiene el SIA?", "", False),
  ("Integración con el SIA", "¿Cuánto suele demorar una solicitud de cambio ahí?", "", False),
  ("Integración con el SIA", "¿Necesitan que la visita quede registrada también en el SIA?", "", False),

  ("Soporte y operación", "¿Quién operaría el sistema una vez instalado?",
   "Su equipo, nosotros, o compartido.", True),
  ("Soporte y operación", "¿Tienen mesa de ayuda?", "", False),
  ("Soporte y operación", "Si un zonal manda un audio y no recibe respuesta, ¿a quién debería avisar?", "", False),
  ("Soporte y operación", "¿Qué piden para poner un sistema en producción?",
   "Pruebas, documentación, revisión de seguridad, ambiente de pruebas separado.", False),

  ("Datos personales", "¿Tienen política de tratamiento de datos personales que debamos cumplir?",
   "El sistema guarda nombre, teléfono y observaciones del campo de cada agricultor.", False),
  ("Datos personales", "¿Cuánto tiempo debe conservarse el historial de un agricultor?", "", False),
  ("Datos personales", "¿Qué pasa con esos datos cuando termina el contrato?", "", False),
 ]),

 ("2 · Usuarios y volumen", "Responde: Jefatura",
  "Cuánta gente lo usaría y con qué frecuencia.",
 [
  ("Personas", "¿Cuántos zonales y supervisores hay en total, sumando las dos áreas?", "", True),
  ("Personas", "¿Cuántas jefaturas revisarían y aprobarían informes?", "", False),
  ("Personas", "¿Hay otras áreas o empresas del grupo que hagan visitas a campo?",
   "En la primera reunión se mencionó Confarm.", False),
  ("Personas", "¿Cuántos agricultores tienen bajo contrato?", "", False),

  ("Volumen", "¿Cuántas visitas a campo hace un zonal en una semana de temporada alta?", "", True),
  ("Volumen", "¿Cuántas fotos suele traer una visita?", "", False),
  ("Volumen", "¿En qué meses se concentra el trabajo de terreno?", "", True),
  ("Volumen", "¿Cuántos meses al año queda prácticamente detenido?", "", False),
 ]),

 ("3 · Cómo se hace hoy", "Responde: Jefatura y zonales",
  "Cómo funciona hoy el registro de las visitas, para poder comparar.",
 [
  ("Registrar una visita", "Después de recorrer un campo, ¿cuánto tarda un zonal en dejar registrado lo que vio?", "", True),
  ("Registrar una visita", "¿Con qué frecuencia no alcanza a registrarlo?", "", False),
  ("Registrar una visita", "¿Cuánto tiempo toma buscar en WhatsApp qué se conversó con un agricultor?", "", False),

  ("Informe mensual al cliente", "¿Cuántas horas toma armar el informe mensual?", "", True),
  ("Informe mensual al cliente", "¿Quién lo arma y cuántos se emiten al año?", "", False),

  ("Trazabilidad", "¿Cuántas veces al año hay una discusión con un agricultor sobre lo que se hizo en su campo?", "", True),
  ("Trazabilidad", "¿Cómo se resuelven hoy esas situaciones?", "", False),
  ("Trazabilidad", "¿Ha habido pérdidas de producción que se hubieran evitado detectando antes un problema de riego, maleza o sanidad?", "", False),
  ("Trazabilidad", "Cuando un zonal deja la empresa, ¿qué pasa con lo que sabía de sus campos?", "", False),

  ("Qué esperan", "Si pudieran ver la nota agronómica de cada lote a lo largo de la temporada, ¿qué harían con esa información?", "", False),
  ("Qué esperan", "¿Qué tendría que pasar en los próximos tres meses para que valga la pena seguir?", "", False),
 ]),
]

STACK = [
 ("Aplicación web sobre Node.js", "Dónde se instala y quién la opera"),
 ("Base de datos PostgreSQL", "Qué motor usan ustedes"),
 ("Archivos en almacenamiento en la nube", "Dónde guardar fotos y PDF"),
 ("Transcripción y lectura del audio con IA", "Qué servicio de IA usar y desde dónde"),
 ("WhatsApp a través de un proveedor", "Qué número usar y bajo qué cuenta"),
 ("Usuario y contraseña propios", "Si prefieren cuenta corporativa"),
 ("Agricultores y lotes cargados desde Excel", "Cómo conectarlo al SIA"),
]
