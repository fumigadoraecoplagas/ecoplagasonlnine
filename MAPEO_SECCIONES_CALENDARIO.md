# Mapeo de Secciones - calendario.html

Este documento mapea todas las secciones principales de `calendario.html` para facilitar las referencias.

## 📋 Secciones Principales

### 1. **SECCIÓN: FILTROS** (`data-section="filtros"`)
- **Ubicación:** Línea ~1362
- **Descripción:** Contenedor principal de filtros de fecha
- **Elementos incluidos:**
  - Botón "Mes Anterior" (`btnPrevMonthCronograma`)
  - Selector de días del mes (`datePickerContainer`) - Botones de días del mes
  - Botón "Mes Siguiente" (`btnNextMonthCronograma`)
  - Input oculto de fecha (`datePicker`)
  - Botón "Vista Compacta" (`btnToggleVistaCompacta`)
  - Navegación de semana (`navegacionSemana`) - Solo visible en vista compacta
    - Botón "Semana Anterior" (`btnSemanaAnterior`)
    - Rango de semana (`rangoSemana`)
    - Botón "Semana Siguiente" (`btnSemanaSiguiente`)

### 2. **SECCIÓN: MENÚ HAMBURGUESA** (`menuHamburguesa`)
- **Ubicación:** Línea ~1419
- **Descripción:** Menú desplegable con opciones adicionales
- **Subsecciones:**
  - **Actualizar Data:**
    - Botón "Cargar CSV" (`btnCargarCSV`)
    - Botón "Actualizar desde CSV" (`btnActualizarCSV`)
    - Botón "Actualizar desde Sheets Oficial" (`btnActualizarGoogleSheetsAuto`)
  - **Reportes:**
    - Link "Táctico 2025"
    - Link "Encuestas"
  - **Agregar:**
    - Botón "Servicios" (`btnGestionarServicios`)
    - Botón "Equipo" (`btnGestionarEquipo`)
  - **Opciones:**
    - Botón "Eliminar Todas" (`btnEliminarTodasCitas`)

### 3. **SECCIÓN: CALENDARIO MES** (`calendarGrid`)
- **Ubicación:** Línea ~1478
- **Descripción:** Grid del calendario mensual con días
- **Elementos:** Se genera dinámicamente con los días del mes

### 4. **SECCIÓN: AGENDA / CITAS DEL DÍA** (`data-section="agenda"`)
- **Ubicación:** Línea ~1484
- **ID:** `vistaDia`
- **Descripción:** Vista de citas del día seleccionado
- **Subsecciones:**
  - **Header de Agenda:**
    - Título "Citas del Día" (`vistaDiaTitulo`)
    - Facturación Total del Día (`facturacionTotalDia`)
    - Botón "Día Anterior" (`btnPrevDay`)
    - Botón "Día Siguiente" (`btnNextDay`)
  - **Grid de Vehículos:** (`vehiculosGrid`)
    - Columnas de vehículos con sus citas

### 5. **SECCIÓN: CRONOGRAMA** (`data-section="cronograma"`)
- **Ubicación:** Línea ~1514
- **ID:** `vistaCronograma`
- **Descripción:** Vista de cronograma con rutas y recursos
- **Subsecciones:**

#### 5.1. **SUBSECCIÓN: BUSCADOR DE CITAS** (`data-section="buscador-citas"`)
- **Ubicación:** Línea ~1517
- **Descripción:** Buscador de citas por cliente o teléfono
- **Elementos:**
  - Input de búsqueda (`buscadorCitas`)
  - Resultados de búsqueda (`resultadosBusquedaCitas`)

#### 5.2. **SUBSECCIÓN: RECURSOS SIN ASIGNAR** (`data-section="recursos-sin-asignar"`)
- **Ubicación:** Línea ~1532
- **Descripción:** Contenedor de técnicos y vehículos sin asignar
- **Subsecciones:**
  - **Técnicos Sin Asignar** (`data-section="tecnicos-sin-asignar"`):
    - Botón "Actualizar" (`btnActualizarTecnicos`)
    - Contenedor (`tecnicosSinAsignarContainer`)
  - **Vehículos Sin Asignar** (`data-section="vehiculos-sin-asignar"`):
    - Botón "Actualizar" (`btnActualizarVehiculos`)
    - Contenedor (`vehiculosSinAsignarContainer`)

#### 5.3. **SECCIÓN: RUTAS DIURNAS** (`data-section="rutas-diurnas"`)
- **Ubicación:** Línea ~1563
- **ID:** `seccionRutasDiurnas`
- **Descripción:** Sección de rutas diurnas (Ruta 1-10)
- **Elementos:**
  - Título "Rutas Diurnas (Ruta 1-10)"
  - Contenedor de cronograma (`cronograma-container`)
  - Eje de horas (`ejeHorasDiurnas`) - Oculto
  - Cronograma de vehículos (`vehiculosCronogramaDiurnas`)

#### 5.4. **SECCIÓN: RUTAS NOCTURNAS** (`data-section="rutas-nocturnas"`)
- **Ubicación:** Línea ~1598
- **Descripción:** Sección de rutas nocturnas y especiales (Ruta 11-Cancelaciones)
- **Elementos:**
  - Título "Rutas Nocturnas / Especiales (Ruta 11-Cancelaciones)"
  - Contenedor de cronograma
  - Eje de horas
  - Cronograma de vehículos

## 🎯 Modales Principales

### 6. **MODAL: EDITAR CITA** (`modalEditarCita`)
- **Descripción:** Modal para editar una cita existente
- **Secciones internas:**
  - Campos Requeridos
  - Campos Opcionales
  - Ubicación
  - Servicios
  - Productos
  - Equipo
  - Certificados
  - Resumen Financiero

### 7. **MODAL: NUEVA CITA** (`nuevaCitaModal`)
- **ID:** `nuevaCitaModal`
- **Descripción:** Modal para crear una nueva cita
- **Secciones internas:** Similar al modal de editar

### 8. **MODAL: ASIGNAR TÉCNICOS Y VEHÍCULOS**
- **Descripción:** Modal para asignar técnicos y vehículos a rutas

### 9. **MODAL: MIGRAR CITAS ENTRE RUTAS**
- **Descripción:** Modal para migrar citas de una ruta a otra

### 10. **MODAL: GESTIONAR SERVICIOS**
- **Descripción:** Modal para gestionar servicios disponibles

### 11. **MODAL: GESTIONAR EQUIPO**
- **Descripción:** Modal para gestionar equipo y herramientas

### 12. **MODAL: ELIMINAR CITAS**
- **Descripción:** Modal para eliminar citas con diferentes opciones

### 13. **MODAL: JUSTIFICAR CITA SIN ENCUESTA** (`modalJustificarSinEncuesta`)
- **Descripción:** Modal para justificar por qué una cita no lleva encuesta

## 📝 Notas de Uso

- Todas las secciones principales tienen el atributo `data-section` para facilitar su identificación
- Los IDs de elementos son únicos y pueden usarse directamente en JavaScript
- Las secciones se muestran/ocultan dinámicamente según la vista seleccionada (calendario, agenda, cronograma)
- La "Vista Compacta" cambia la visualización del calendario y muestra navegación por semana

## 🔍 Cómo Referenciar Secciones

**Ejemplos:**
- "En la sección FILTROS, cambia el color del botón Vista Compacta"
- "En la sección BUSCADOR DE CITAS, aumenta el tamaño del input"
- "En la sección RUTAS DIURNAS, cambia el color de fondo"
- "En el modal NUEVA CITA, modifica el campo de teléfono"
