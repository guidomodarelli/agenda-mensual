# Changelog

Todos los cambios relevantes de Control Mensual se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Changed

- La aplicación usa `@golfo/ui` 2.0.0 (antes `beez-ui` 0.10.0): botones, diálogos, menús, selects, opciones de radio, tooltips, tarjetas, avisos, insignias, avatares y placeholders de carga toman el diseño y la motion de Arc que trae la biblioteca.
- El menú de acciones de cada gasto deja de tener submenús: duplicar ("Duplicar en este mes", "Duplicar en el mes siguiente", "Duplicar en otro mes…"), recurrencia, tipo de cambio, link de pago y carpetas aparecen como grupos de opciones separados dentro del mismo menú.
- El menú «Ordenar por» de la tabla de gastos muestra los criterios de deuda (cuotas pagadas, restantes y total) como opciones propias, y la dirección del orden pasa a un menú «Dirección» al lado.
- Las confirmaciones de eliminación y los diálogos de edición rápida de la tabla se anuncian como diálogos de alerta y abren con el foco en «Cancelar».
- Los enlaces con aspecto de botón (inicio de sesión, error de autenticación y vista sin conexión) se dibujan como enlaces con el estilo de botón de Arc.
- El selector de estado de envío de un comprobante muestra solo el texto ("Pendiente" o "Enviado"), sin el ícono.
- Los botones de la biblioteca (por ejemplo «Continuar con Google» y «Alternar tema») usan su tipografía propia: texto de 14 px con peso medio, igual que en el resto de Arc.

## [0.1.4] - 2026-10-03

- 054b7ac agrega reglas para el agente de Next.js
- 07030d7 agrega diseño del menú lateral según la biblioteca de componentes (#28)

## [0.1.3] - 2026-10-03

- 44e9e96 agrega estilos para el menú lateral y mejora la estructura del componente

## [0.1.2] - 2026-10-03

- 42b272f agrega animación al menú lateral y mejora la integración con «beez-ui»
- 8d2f2f1 actualiza la dependencia «beez-ui» a la versión «0.10.0» (#27)
- de2495a actualiza la dependencia «beez-rp» a la versión «0.6.1»
- 7e98e71 update «beez-rp» dependency to version «0.5.0»
- 7a5dc01 build: bump beez-rp to 0.4.0
- 0f9b488 add hydration handling in PWA update control (#26)

## [0.1.1] - 2026-09-27

### Changed

- Los mensajes de la carga de comprobantes ("Completado", "Subiendo...", "Eliminar") quedan en español.
- El menú de la cuenta de Google de la barra superior adopta el diseño compartido de la biblioteca de componentes.

