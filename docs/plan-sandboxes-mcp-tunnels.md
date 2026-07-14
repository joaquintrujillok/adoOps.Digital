# Plan de implementación · Self-Hosted Sandboxes & MCP Tunnels

> **Objetivo**: probar las dos funciones nuevas de Claude Managed Agents (anunciadas el 19-may-2026 en "Code with Claude", Londres) con un piloto real sobre nuestro stack, y dejar armado el caso de negocio para clientes con restricciones de compliance (salud, legal, finanzas).
>
> **Fuente analizada**: guía de @prompteafacil (PDF, edición mayo 2026), **verificada contra documentación oficial de Anthropic** (platform.claude.com/docs, claude.com/blog). Fecha de este plan: 14-jul-2026.

---

## 1. Análisis: qué es real y qué hay que matizar

### Verificado ✅

| Claim del PDF | Estado |
|---|---|
| Self-Hosted Sandboxes en **beta pública** | ✅ Correcto (anuncio 19-may-2026) |
| MCP Tunnels en **research preview** con solicitud de acceso | ✅ Correcto |
| El **bucle de agente queda en Anthropic**; solo la **ejecución de herramientas** se mueve a tu infra | ✅ Correcto — es la arquitectura exacta |
| Proveedores: Cloudflare, Daytona, Modal, Vercel, custom | ✅ Correcto, pero **incompleto**: también E2B y GKE Agent Sandbox (add-on de Kubernetes) |
| Tunnels: solo conexiones salientes, cifrado end-to-end, sin endpoints públicos | ✅ Correcto (modelo de seguridad de 3 capas, ver §6) |
| Adquisiciones: Bun (dic-25), Vercept (feb-26), Coefficient Bio (abr-26, US$400M), Stainless (may-26, US$300M+) | ✅ Todas confirmadas |

### Matices que el PDF omite o imprecisa ⚠️

1. **HIPAA / compliance — el matiz más importante para nuestro pitch**: Managed Agents (incluyendo self-hosted sandboxes) **NO es elegible todavía para Zero Data Retention (ZDR) ni para HIPAA BAA**, porque el producto es stateful (sesiones persistentes, historial server-side). El argumento "los datos del paciente nunca llegan a Anthropic" es **parcialmente cierto**: los archivos y el código quedan en tu perímetro, pero **los resultados de las herramientas sí viajan al bucle de agente en la nube de Anthropic y se retienen**. Para un cliente de salud esto reduce exposición, no la elimina. No vender como "HIPAA-ready".
2. **Solicitud de acceso a MCP Tunnels**: el formulario real es `https://claude.com/form/claude-managed-agents` (no "platform.claude.com" a secas). La aprobación es manual, sin plazos publicados.
3. **Ruta en Console**: la documentación usa "Settings → Managed Agents → Sandboxes" / "Manage → Environments"; el "Organization Settings" del PDF es aproximado. Verificar en la Console real.
4. **MCP Tunnels depende de Cloudflare como transporte** (cloudflared + tunnel edge). Cloudflare no puede leer los payloads (TLS interna), pero sí ve metadata de conexión (IP de egreso, timing, volumen). Es un subprocesador — relevante si el cliente audita subprocesadores.
5. **Research preview = sin SLA**: se ofrece "as-is", sin garantías de uptime ni soporte, y Anthropic puede modificarlo o discontinuarlo. No comprometer en contratos.
6. **No disponible en Claude Platform sobre AWS** (Bedrock): solo API directa de Anthropic.

---

## 2. Conceptos base: Claude Managed Agents

Las dos funciones se montan sobre **Managed Agents** (agentes hospedados por Anthropic). Modelo de objetos:

- **Agent**: config reutilizable (modelo, system prompt, tools, MCP servers, skills).
- **Environment**: dónde corren las sesiones — sandbox cloud (default, Anthropic) o **self-hosted** (tu infra).
- **Session**: instancia corriendo del agente; mantiene estado. Se factura **US$0.08 por hora-sesión** en estado `running` + tokens a tarifa normal del modelo.
- **Events**: mensajes intercambiados (turnos de usuario, resultados de tools), vía SSE.

SDK: namespaces `client.beta.agents.*`, `client.beta.sessions.*` (Python, TS, Go, Java…). Beta header: `managed-agents-2026-04-01`.

---

## 3. Plan de implementación por fases

### Fase 0 — Prerequisitos (día 1, ~1 hora)

- [ ] Cuenta en Claude Console (`console.anthropic.com`) con API key y créditos (~US$25 bastan para todo el piloto).
- [ ] **Solicitar acceso a MCP Tunnels HOY** en `https://claude.com/form/claude-managed-agents` — la aprobación es manual y sin plazo; es el cuello de botella del plan, así que se pide primero y las fases 1–3 avanzan mientras tanto.
- [ ] Verificar en Console que aparece la sección Managed Agents / Sandboxes para nuestra organización.
- [ ] Leer: [overview de Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) y [self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes).

### Fase 1 — Baseline: Managed Agent con sandbox cloud (día 1-2, ~medio día)

Antes de mover nada a nuestra infra, validar el flujo completo con el sandbox default de Anthropic. Sin esta línea base no podemos aislar problemas del sandbox self-hosted.

Script de prueba (Node, corre local con `ANTHROPIC_API_KEY`; el SDK `openai` que ya usamos no sirve aquí — instalar `@anthropic-ai/sdk` como devDependency o usar un script suelto):

```
1. beta.agents.create        → agente "adoops-piloto" (modelo Sonnet, toolset estándar)
2. beta.sessions.create      → sesión en environment cloud (default)
3. beta.sessions.events.send → tarea: "genera un CSV con 5 filas de reportes de terreno de ejemplo y calcula totales"
4. Stream de eventos SSE     → observar tool calls (bash, file ops) y resultado
```

**Criterio de éxito**: la sesión ejecuta bash/archivos en el sandbox cloud y devuelve el resultado. Anotar: latencia por tool call, costo de la sesión (Console → usage).

### Fase 2 — Self-Hosted Sandbox con proveedor gestionado (día 2-3, ~1 día)

**Proveedor recomendado: Vercel** — ya desplegamos ahí, tiene setup one-click desde Console y arranque en milisegundos. (Alternativa: Cloudflare si queremos comparar.)

1. Console → Settings → Managed Agents → Sandboxes → crear environment `self_hosted`, provider Vercel (integración OAuth one-click).
2. Repetir el script de Fase 1 apuntando `environment_id` al nuevo environment.
3. **Verificar dónde corre realmente la ejecución**: revisar logs/facturación en el dashboard de Vercel — debe aparecer actividad de cómputo nuestra. Este es el punto que le mostraremos a clientes ("la ejecución corre en NUESTRA cuenta, no en Anthropic").
4. Probar una tarea que toque datos "sensibles" simulados: p.ej. un archivo con RUTs ficticios que el agente procesa dentro del sandbox. Confirmar qué viaja de vuelta a Anthropic (solo el output de la tool) mirando el stream de eventos.

**Criterio de éxito**: misma tarea que Fase 1, ejecución visible en infra propia, y documentación (screenshots) de qué datos salen del perímetro — insumo directo para el pitch de compliance.

### Fase 3 — (Opcional, avanzado) Sandbox custom (día 4-5, ~1-2 días)

Solo si queremos ofrecer "on-premise real" a clientes con VPC propia. El contrato del worker es: reclamar work items de la cola de Anthropic → ejecutar tool calls (`execute(name, input) → output`) → postear resultados. Se autentica con dos credenciales: **environment key** (Console) + **API key**.

- Usar el helper `EnvironmentWorker` del Claude Agent SDK (maneja polling, setup y ejecución end-to-end).
- Referencia pública: [sample de GKE](https://github.com/GoogleCloudPlatform/kubernetes-engine-samples/tree/main/ai-ml/anthropic-agent-sandbox) y [guía de hosting del Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting).
- ⚠️ El protocolo de la cola (schemas, timeouts, rate limits) no está completamente documentado en público; presupuestar tiempo de ingeniería inversa sobre los samples.

**Criterio de éxito**: worker propio en un contenedor Docker local procesando una sesión de punta a punta. Si toma más de 2 días, congelar — los proveedores gestionados cubren el 90% de los casos de venta.

### Fase 4 — MCP Tunnels (al recibir acceso; ~1-2 días)

Caso de prueba realista con nuestro stack: **exponer los datos de `field_reports`/`acta_reports` como un MCP server "interno"**, simulando la base de datos privada de un cliente.

1. **MCP server de prueba**: script Python (`pip install mcp`) con 2-3 tools de solo lectura (`buscar_reportes`, `resumen_semanal`) contra una copia local/staging de la DB. Correrlo en Docker **sin puertos publicados** — esa es la gracia.
2. **Desplegar el stack del tunnel** con Docker Compose (quickstart oficial): `mcp-proxy` (imagen de Anthropic, termina TLS interna y rutea por hostname) + `cloudflared` (conexión saliente única al edge, puerto 7844 TCP/UDP hacia `198.41.192.0/19`). Config en `mcp-proxy.yaml`: `routes: { reportes: http://mcp-server:9000 }`.
3. **Registrar en Console**: Managed Agents → sesión/agente → "+ MCP Server" → elegir el tunnel → subdominio `reportes`, path `/mcp`. También se puede referenciar por Messages API (`mcp_servers: [{type: "url", url: "https://reportes.<tunnel-domain>/mcp"}]`).
4. **Probar**: agente de Fase 2 consultando "¿cuántos reportes de terreno validados hubo esta semana?" → debe resolver vía el tunnel sin que el MCP server tenga IP pública.
5. **Checklist de seguridad**: tratar tunnel token y llave TLS privada como secretos de alto valor (juntos permiten suplantar el proxy); agregar OAuth al MCP server antes de cualquier demo con datos reales.

**Criterio de éxito**: Claude usa tools de una "red privada" sin reglas inbound en el firewall. Grabar esta demo — es el material de venta más potente para clínicas/estudios legales.

### Fase 5 — Caso de negocio y demo comercial (semana 2)

- Armar demo grabada + one-pager: "IA que trabaja con tus datos sin que salgan de tu red" con la arquitectura real (y los matices honestos de §1).
- Tabla de respuestas a objeciones **corregida** (versión precisa del PDF):
  - "Nuestros datos no pueden salir" → archivos/código/APIs quedan en tu perímetro; **los resultados de tools sí llegan al bucle de agente**.
  - "HIPAA" → reduce exposición significativamente; **aún sin BAA/ZDR** — para salud, posicionar como piloto con datos desidentificados.
  - "SOC 2" → la ejecución corre en infra ya dentro del alcance de tu auditoría (cierto para sandboxes; el tunnel agrega a Cloudflare como subprocesador de transporte).
- Definir pricing de un "Piloto Compliance" como servicio (setup del tunnel + sandbox + 1 caso de uso).

---

## 4. Costos estimados del piloto

| Ítem | Costo |
|---|---|
| Sesiones Managed Agents | US$0.08/hora-sesión (solo en `running`) |
| Tokens | tarifa normal del modelo (usar Sonnet para el piloto) |
| Web search del agente (si se usa) | US$0.01/búsqueda |
| Vercel sandbox | dentro del plan actual (verificar en Fase 2) |
| Tunnel (cloudflared + mcp-proxy) | infra propia mínima (1 contenedor pequeño) |
| **Total piloto completo (fases 1-4)** | **~US$15–40 en API + horas de desarrollo** |

Rate limits relevantes: 60 req/min endpoints de creación, 600 req/min lectura.

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Acceso a MCP Tunnels demora o no llega | Solicitarlo en Fase 0; fases 1-3 no dependen de él. Plan B para demos: MCP server remoto con OAuth |
| Research preview cambia o se discontinúa | No comprometer tunnels en contratos; venderlo como piloto |
| Docs incompletas (sandbox custom, UI de Console) | Fase 3 es opcional con timebox de 2 días |
| Sobre-prometer compliance (HIPAA/ZDR) | Usar siempre la tabla corregida de §5 del plan; revisar elegibilidad BAA cada trimestre |
| No disponible vía AWS Bedrock | Clientes AWS-only: solo API directa de Anthropic por ahora |

---

## 6. Referencia rápida: arquitectura de seguridad de MCP Tunnels

Tres capas independientes:

1. **mTLS externo + validación de IP** (Anthropic ↔ transporte): bloquea clientes no autorizados.
2. **TLS interna** (backend de Anthropic ↔ tu proxy, con certificado que solo tú tienes): Cloudflare no puede leer payloads.
3. **OAuth en cada MCP server**: bloquea uso no autorizado de las tools.

Requisitos de red (todo saliente): `api.anthropic.com:443` (provisioning), edge de Cloudflare `198.41.192.0/19` y `2606:4700:a0::/44` puerto `7844` TCP+UDP (runtime).

---

## 7. Fuentes oficiales

- Anuncio: https://claude.com/blog/claude-managed-agents-updates
- Managed Agents: https://platform.claude.com/docs/en/managed-agents/overview · [quickstart](https://platform.claude.com/docs/en/managed-agents/quickstart) · [reference](https://platform.claude.com/docs/en/managed-agents/reference)
- Self-Hosted Sandboxes: https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes
- MCP Tunnels: [overview](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview) · [quickstart](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/quickstart) · [security](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/security) · [deploy compose](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/deploy-compose) · [deploy helm](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/deploy-helm)
- Agent SDK hosting (sandbox custom): https://code.claude.com/docs/en/agent-sdk/hosting
- Sample GKE: https://github.com/GoogleCloudPlatform/kubernetes-engine-samples/tree/main/ai-ml/anthropic-agent-sandbox
- Formulario de acceso: https://claude.com/form/claude-managed-agents
