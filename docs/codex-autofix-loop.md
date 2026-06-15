# Codex auto-fix loop (local, vía Claude Code)

Loop local que escucha comentarios de **Codex** (`chatgpt-codex-connector[bot]`)
en un PR y, por cada comentario nuevo, aplica un fix automático con el skill
`fix-issue-efimeral-clone` (clone efímero → fix → push a la rama del PR) y hace
el closeout en el hilo (reacción 🚀 + reply con link al commit + resolver el hilo
inline).

> Es un complemento del workflow de CI [.github/workflows/codex-autofix.yml](../.github/workflows/codex-autofix.yml).
> El **Action** es la persistencia real 24/7 (webhook, sin sesión). Este **loop local**
> corre solo mientras Claude Code está abierto (el cron es de sesión: `durable: true`
> no se persiste en este entorno, así que el job muere al cerrar Claude).

## Cómo relanzarlo (cualquier PR)

1. Reemplazá los placeholders del prompt de abajo (`{{OWNER}}`, `{{REPO}}`,
   `{{PR}}`, `{{BRANCH}}`) por los del PR objetivo.
2. Inicializá el estado de dedup del PR (vacío procesa todo el backlog; con ids
   ya cargados procesa solo los nuevos):
   ```
   .codex-autofix/processed-{{PR}}.json  ->  {"pr":{{PR}},"processedCommentIds":[]}
   ```
   (`.codex-autofix/` está gitignored: es estado de runtime, no se commitea.)
3. Lanzá el loop pegando el prompt con un intervalo, p. ej. cada 5 min:
   ```
   /loop 5m <pegá acá el prompt ya completado>
   ```
   O, más simple, decile a Claude: «relanzá el loop de Codex para el PR {{PR}}
   usando docs/codex-autofix-loop.md» y completa la plantilla por vos.

El intervalo es session-only: si cerrás Claude, hay que relanzarlo. El loop se
**auto-cancela** solo cuando el PR deja de estar `OPEN` (mergeado/cerrado/borrado).

## Prompt (plantilla parametrizable)

```text
Loop de auto-fix de comentarios de Codex en el PR #{{PR}} de {{OWNER}}/{{REPO}} (rama {{BRANCH}}).

GUARD DE AUTO-CANCELACIÓN (hacelo SIEMPRE primero). Obtené el estado del PR:
  estado=$(gh pr view {{PR}} --repo {{OWNER}}/{{REPO}} --json state -q .state 2>/dev/null)
- "OPEN" -> seguí. - "MERGED"/"CLOSED" -> auto-cancelá. - vacío/falla (404 PR o repo borrado) -> confirmá una vez con `gh api repos/{{OWNER}}/{{REPO}}/pulls/{{PR}} --jq .state 2>&1`; si vuelve a fallar o "closed", auto-cancelá; si "open", seguí (error transitorio).
Auto-cancelar = CronList, identificá el job de ESTE loop (cron `*/5 * * * *`, auto-fix de Codex en PR #{{PR}}), borralo con CronDelete por id, PushNotification de una línea avisando el motivo, y terminá sin procesar.

Si OPEN, procesá:
(1) Leé processedCommentIds desde .codex-autofix/processed-{{PR}}.json. (2) Traé comentarios de chatgpt-codex-connector[bot]: inline `gh api repos/{{OWNER}}/{{REPO}}/pulls/{{PR}}/comments`, generales `gh api repos/{{OWNER}}/{{REPO}}/issues/{{PR}}/comments`. (3) Por cada comentario cuyo id NO esté en processedCommentIds, de a uno en orden (secuencial, nunca en paralelo): invocá el skill fix-issue-efimeral-clone con el cuerpo + path + line, resolvé en clone efímero y pusheá a {{BRANCH}}. GUARDÁ el sha COMPLETO del commit pusheado. Llevá un contador de cuántos comentarios fixeaste con éxito esta vuelta.

(4) CLOSEOUT en ÉXITO (push hecho). Definí el link al commit: COMMIT_URL=https://github.com/{{OWNER}}/{{REPO}}/commit/<sha>
   a. Reacción 🚀: `gh api -X POST repos/{{OWNER}}/{{REPO}}/pulls/comments/<id>/reactions -f content=rocket` (INLINE) o `.../issues/comments/<id>/reactions` (GENERAL).
   b. Reply en el hilo con el **template de cierre** (ver «Plantilla de comentario de cierre» abajo). Definí `<resumen>` = UNA línea de qué cambió y su efecto, y usá el sha corto de 7 chars como texto del link:
      - INLINE: `gh api -X POST repos/{{OWNER}}/{{REPO}}/pulls/{{PR}}/comments/<id>/replies -f body="$(printf '✅ **Resuelto** en [`%s`](%s).\n\n**Qué cambió:** %s\n\n<sub>🤖 Fix automático en respuesta a este comentario de Codex.</sub>' "<sha_corto>" "<COMMIT_URL>" "<resumen>")"`
      - GENERAL: `gh pr comment {{PR}} --repo {{OWNER}}/{{REPO}} --body "$(printf '✅ **Resuelto** en [`%s`](%s) (en respuesta a tu comentario).\n\n**Qué cambió:** %s\n\n<sub>🤖 Fix automático de Codex.</sub>' "<sha_corto>" "<COMMIT_URL>" "<resumen>")"`
   c. SOLO INLINE — resolver el hilo vía GraphQL:
      THREAD_ID=$(gh api graphql -f query='query($owner:String!,$repo:String!,$pr:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$pr){reviewThreads(first:100){nodes{id comments(first:100){nodes{databaseId}}}}}}}' -F owner={{OWNER}} -F repo={{REPO}} -F pr={{PR}} --jq "[.data.repository.pullRequest.reviewThreads.nodes[] | select(any(.comments.nodes[]; .databaseId == <id>)) | .id] | first // empty")
      si THREAD_ID no vacío: gh api graphql -f query='mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{isResolved}}}' -F threadId="$THREAD_ID"
   d. Agregá el id a processedCommentIds en .codex-autofix/processed-{{PR}}.json.

(5) Si FALLA (no se pudo aplicar el fix por una falla del loop/agente, no porque la sugerencia sea inválida): NO marques el id, NO resuelvas, y NO cuentes ese comentario como fixeado. NO reacciones 👎 (content=-1): el 👎 es la señal de "sugerencia incorrecta/no útil" que Codex interpreta sobre su comentario, y acá el problema es el loop, no la sugerencia. Reaccioná 😕 (content=confused) para pedir atención humana y, opcionalmente, dejá un reply con el motivo/link al error. Reservá el 👎 solo para cuando evaluaste la sugerencia y concluiste que no requería cambios.

(6) AL FINAL: si en esta vuelta fixeaste con éxito al menos 1 comentario nuevo (contador >= 1) y ya no quedan pendientes, posteá UN único comentario general `@codex review` para disparar una nueva revisión de Codex: `gh pr comment {{PR}} --repo {{OWNER}}/{{REPO}} --body "@codex review"`. Si NO fixeaste nada nuevo esta vuelta (contador == 0), NO postees nada (evitá spam).
```

## Plantilla de comentario de cierre

Tanto el loop local como el Action ([.github/workflows/codex-autofix.yml](../.github/workflows/codex-autofix.yml))
cierran el hilo con el **mismo** formato. Placeholders: `{{sha_corto}}` (7 chars),
`{{commit_url}}`, `{{resumen}}` (una línea), `{{run_url}}` (solo el Action).

- **Éxito (fix aplicado) → 🚀**
  ```text
  ✅ **Resuelto** en [`{{sha_corto}}`]({{commit_url}}).

  **Qué cambió:** {{resumen}}

  <sub>🤖 Fix automático en respuesta a este comentario de Codex · [run]({{run_url}})</sub>
  ```
  (Si no hay resumen disponible, omitir la línea «Qué cambió».)

- **Sin cambios (el agente evaluó y no hacía falta tocar código) → 👎**
  ```text
  ℹ️ **Sin cambios.** Revisé la sugerencia pero no requería cambios de código.

  <sub>🤖 Auto-fix de Codex · [run]({{run_url}})</sub>
  ```

- **Falla del flujo (no se pudo aplicar; problema del Action/loop, no de la sugerencia) → 😕**
  ```text
  ⚠️ **No pude aplicar el fix** (falla del Action, no de la sugerencia).

  <sub>🤖 Auto-fix de Codex · [run]({{run_url}})</sub>
  ```

> Regla de paridad: cualquier cambio a esta plantilla debe reflejarse en ambos
> lados (este doc y el step «Cerrar comentario» del workflow).

## Notas

- **Secuencial obligatorio**: nunca procesar comentarios en paralelo; todos
  pushean a la misma rama y se pisarían (cada fix rebasea antes de pushear).
- **Estado por PR**: un archivo `processed-<PR>.json` por cada PR en seguimiento;
  así un mismo loop o varios loops no reprocesan lo ya hecho.
- **Cancelar a mano**: `CronList` para ver el job y `CronDelete <id>`.
- **Persistencia real**: para correr sin sesión abierta, mergeá el workflow de CI
  a la rama default y usá el Action.
