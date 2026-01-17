import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    getDocs,
    addDoc,
    serverTimestamp,
    Timestamp,
    limit 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { obtenerFriendlyBodega } from './bodega-names.js';
import { actualizarStockBodega, procesarMovimientoInventario } from './inventario-movimientos-utils.js';

let bodegasEspeciales = [];
let productos = [];
let herramientas = [];
let cuentasGasto = [];
let bodegasTodas = [];
let empleados = [];
let datosLiquidacionIndividual = null;
let contadorFilas = 0;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        cargarDatosBase();
    } catch (error) {
        console.error('Error inicializando liquidación:', error);
    }
});

function esperarAuthManager() {
    return new Promise((resolve, reject) => {
        if (window.authManager) return resolve(window.authManager);
        const interval = setInterval(() => {
            if (window.authManager) {
                clearInterval(interval);
                resolve(window.authManager);
            }
        }, 100);
    });
}

function cargarDatosBase() {
    // Bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegasTodas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Volver a filtrar SOLAMENTE especiales, según requerimiento estricto
        bodegasEspeciales = bodegasTodas.filter(b => b.tipo === 'especial');
        
        renderizarSelectorBodegas();
        
        // Una vez cargadas las bodegas, buscamos fechas de movimientos
        cargarFechasAlistos();
        
        // Cargar resumen de pendientes (28 días anteriores + 3 días siguientes)
        cargarResumenPendientes28Dias();
    });

    // Productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Herramientas
    onSnapshot(query(collection(db, 'herramientas'), orderBy('nombre')), (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Cuentas Gasto
    onSnapshot(query(collection(db, 'cuentas_gasto'), orderBy('nombre')), (snapshot) => {
        cuentasGasto = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Empleados (Nuevo: Para obtener nombres correctos de bodegas)
    onSnapshot(query(collection(db, 'empleados')), (snapshot) => {
        empleados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

// Nueva función para el resumen de 28 días anteriores + 3 días siguientes
async function cargarResumenPendientes28Dias() {
    const container = document.getElementById('resumenDiasPendientes');
    const mainContainer = document.getElementById('contenedorResumenPendientes');
    if (!container || !mainContainer) return;

    try {
        mainContainer.style.display = 'block';
        container.innerHTML = '<div class="text-center text-muted py-2 w-100"><div class="spinner-border spinner-border-sm"></div> Analizando últimos 28 días y próximos 3 días...</div>';

        // Definir rango: Hoy - 28 días hasta Hoy + 3 días
        const hoy = new Date();
        const hace28dias = new Date();
        hace28dias.setDate(hoy.getDate() - 28);
        const en3dias = new Date();
        en3dias.setDate(hoy.getDate() + 3);
        
        // Ajustar a inicio del día local
        const start = new Date(hace28dias.setHours(0, 0, 0, 0));
        const end = new Date(en3dias.setHours(23, 59, 59, 999)); // Hasta el final del día en 3 días

        // Consultar movimientos
        const q = query(
            collection(db, 'movimientos_inventario'),
            where('fecha', '>=', start),
            where('fecha', '<=', end),
            orderBy('fecha', 'desc')
        );

        const snapshot = await getDocs(q);
        const movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Estructura para agrupar por Día -> Bodega -> Producto -> Saldo
        const resumenDiario = {}; // {'YYYY-MM-DD': { bodegaId: { 'producto:ID' o 'herramienta:ID': saldo } } }
        
        // Generar claves para los últimos 28 días (para asegurar que aparezcan días sin movimientos)
        for (let i = 0; i < 28; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const fechaStr = d.toISOString().split('T')[0]; // Usar local en el futuro, por ahora UTC simple para keys
            resumenDiario[fechaStr] = {};
        }
        
        // Generar claves para los próximos 3 días
        for (let i = 1; i <= 3; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const fechaStr = d.toISOString().split('T')[0];
            resumenDiario[fechaStr] = {};
        }

        const idsBodegasEspeciales = bodegasEspeciales.map(b => b.id);

        movimientos.forEach(m => {
            let fechaMov = null;
            if (m.fecha && m.fecha.toDate) fechaMov = m.fecha.toDate();
            else if (m.fecha) fechaMov = new Date(m.fecha);

            if (!fechaMov) return;

            // Obtener fecha local directamente usando métodos de Date
            // fechaMov.toDate() ya devuelve la fecha en zona horaria local
            const año = fechaMov.getFullYear();
            const mes = String(fechaMov.getMonth() + 1).padStart(2, '0');
            const dia = String(fechaMov.getDate()).padStart(2, '0');
            const fechaStr = `${año}-${mes}-${dia}`;

            if (!resumenDiario[fechaStr]) resumenDiario[fechaStr] = {}; // Por si acaso

            const cant = parseFloat(m.cantidad || 0);

            // 1. Entrada a Bodega Especial
            if (idsBodegasEspeciales.includes(m.destino)) {
                if (!resumenDiario[fechaStr][m.destino]) resumenDiario[fechaStr][m.destino] = {};
                // Procesar tanto productos como herramientas
                const esHerramienta = !!(m.herramientaId || m.tipoItem === 'herramienta');
                const itemId = esHerramienta ? m.herramientaId : m.productoId;
                if (!itemId) return; // Si no tiene ni productoId ni herramientaId, saltar
                const claveItem = esHerramienta ? `herramienta:${itemId}` : `producto:${itemId}`;
                
                if (!resumenDiario[fechaStr][m.destino][claveItem]) resumenDiario[fechaStr][m.destino][claveItem] = 0;
                resumenDiario[fechaStr][m.destino][claveItem] += cant;
            }

            // 2. Salida de Bodega Especial
            if (idsBodegasEspeciales.includes(m.origen)) {
                if (!resumenDiario[fechaStr][m.origen]) resumenDiario[fechaStr][m.origen] = {};
                // Procesar tanto productos como herramientas
                const esHerramienta = !!(m.herramientaId || m.tipoItem === 'herramienta');
                const itemId = esHerramienta ? m.herramientaId : m.productoId;
                if (!itemId) return; // Si no tiene ni productoId ni herramientaId, saltar
                const claveItem = esHerramienta ? `herramienta:${itemId}` : `producto:${itemId}`;
                
                if (!resumenDiario[fechaStr][m.origen][claveItem]) resumenDiario[fechaStr][m.origen][claveItem] = 0;
                resumenDiario[fechaStr][m.origen][claveItem] -= cant;
            }
        });

        // Analizar resultados
        container.innerHTML = '';
        const diasOrdenados = Object.keys(resumenDiario).sort().reverse();

        diasOrdenados.forEach(fechaStr => {
            const datosDia = resumenDiario[fechaStr];
            const bodegasConPendientes = new Set();
            let totalPendientes = 0;

            Object.keys(datosDia).forEach(bodegaId => {
                const productosDia = datosDia[bodegaId];
                let tienePendiente = false;
                Object.values(productosDia).forEach(saldo => {
                    if (Math.abs(saldo) > 0.001) {
                        tienePendiente = true;
                        totalPendientes++;
                    }
                });
                if (tienePendiente) bodegasConPendientes.add(bodegaId);
            });

            const countBodegas = bodegasConPendientes.size;
            
            // Renderizar tarjeta
            const card = document.createElement('div');
            // Estilo visual: Rojo si hay pendientes, Verde si no (y hay bodegas analizadas o simplemente es un día pasado)
            // Si no hubo movimientos ese día para bodegas especiales, countBodegas será 0, asumimos verde (ok) o gris (sin actividad)
            
            let colorClass = 'bg-success text-white';
            let iconClass = 'fa-check-circle';
            let titleText = 'Todo al día';

            if (countBodegas > 0) {
                colorClass = 'bg-danger text-white';
                iconClass = 'fa-exclamation-circle';
                titleText = `${countBodegas} bodegas con pendientes`;
            } else {
                // Verificar si hubo actividad para no pintar verde días vacíos futuros o pasados sin nada
                // Pero el requerimiento es "identificar facilmente que dias no hay un neteo en 0"
                // Así que 0 pendientes es bueno.
                colorClass = 'bg-success bg-opacity-75 text-white';
            }
            
            // Parsear fecha para mostrar
            const partes = fechaStr.split('-');
            const fechaVisual = new Date(partes[0], partes[1]-1, partes[2]);
            const diaMes = fechaVisual.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            const diaSemana = fechaVisual.toLocaleDateString('es-ES', { weekday: 'short' });

            card.className = `card border-0 shadow-sm p-2 d-flex flex-column align-items-center justify-content-center ${colorClass}`;
            card.style.width = '80px';
            card.style.cursor = 'pointer';
            card.style.transition = 'transform 0.2s';
            card.onmouseover = () => card.style.transform = 'scale(1.1)';
            card.onmouseout = () => card.style.transform = 'scale(1.0)';
            
            // Acción al hacer click: Filtrar abajo
            card.onclick = () => {
                // Remover estilo activo de todos
                const todasLasCards = container.querySelectorAll('.card');
                todasLasCards.forEach(c => c.classList.remove('border-primary', 'border-3'));

                // Agregar estilo activo al actual
                card.classList.add('border-primary', 'border-3');

                // Buscar el checkbox de esta fecha y seleccionarlo
                const checkbox = document.getElementById(`fecha-${fechaStr}`);
                if (checkbox) {
                    // Deseleccionar todos primero
                    document.querySelectorAll('.check-fecha-liq').forEach(c => c.checked = false);
                    checkbox.checked = true;
                    // Auto generar
                    generarMatrizLiquidacion();
                    // Scroll to results
                    document.getElementById('contenedorTablaLiquidacion').scrollIntoView({ behavior: 'smooth' });
                } else {
                    alert(`No hay registros directos de alistos (transferencias) visibles en el filtro para el día ${fechaStr}, aunque el resumen detectó movimientos.`);
                }
            };

            card.innerHTML = `
                <div style="font-size: 0.75rem; text-transform: uppercase;">${diaSemana}</div>
                <div class="fw-bold" style="font-size: 1.1rem;">${diaMes}</div>
                <div class="mt-1"><i class="fas ${iconClass}"></i> ${countBodegas > 0 ? countBodegas : ''}</div>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error en resumen 28 días:", error);
        container.innerHTML = '<div class="text-danger small">Error cargando resumen.</div>';
    }
}

async function cargarFechasAlistos() {
    const container = document.getElementById('listaFechasAlistos');
    if (!container) return;

    try {
        // Solución temporal sin índice compuesto:
        // Traer últimos 2000 movimientos y filtrar en memoria
        // Esto evita el error "The query requires an index"
        const q = query(
            collection(db, 'movimientos_inventario'),
            orderBy('fecha', 'desc'),
            limit(2000)
        );

        const snapshot = await getDocs(q);
        const fechasSet = new Set();
        const fechasMap = {}; 

        const idsBodegasEspeciales = bodegasEspeciales.map(b => b.id);

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Filtro Estricto: Solo actividad real en Bodegas Especiales
            // Ignorar si el movimiento involucra Ruteros, APV o Personal (a menos que sea contraparte de una Especial)
            const esEntrada = idsBodegasEspeciales.includes(data.destino);
            const esSalida = idsBodegasEspeciales.includes(data.origen);

            if (esEntrada || esSalida) {
                let fechaObj = null;
                if (data.fecha && data.fecha.toDate) fechaObj = data.fecha.toDate();
                else if (data.fecha) fechaObj = new Date(data.fecha);

                if (fechaObj) {
                    // FIX CRÍTICO: Usar fecha LOCAL, no UTC.
                    // toISOString() convierte a UTC, moviendo las transacciones de la noche (23:00) al día siguiente.
                    // Esto causaba desalineación entre la etiqueta del checkbox y el filtro real.
                    // Ajustamos el offset para obtener el YYYY-MM-DD local correcto.
                    const offset = fechaObj.getTimezoneOffset() * 60000;
                    const fechaLocal = new Date(fechaObj.getTime() - offset);
                    const fechaStr = fechaLocal.toISOString().split('T')[0];
                    
                    if (!fechasSet.has(fechaStr)) {
                        fechasSet.add(fechaStr);
                        fechasMap[fechaStr] = fechaObj;
                    }
                }
            }
        });

        const fechasOrdenadas = Array.from(fechasSet).sort().reverse(); 

        container.innerHTML = '';
        if (fechasOrdenadas.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-2">No se encontraron alistos recientes.</div>';
            return;
        }

        // Calcular fecha de ayer en formato YYYY-MM-DD
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        const ayerStr = ayer.toISOString().split('T')[0];

        fechasOrdenadas.forEach(fechaStr => {
            const fechaObj = fechasMap[fechaStr];
            const partes = fechaStr.split('-');
            const fechaVisual = new Date(partes[0], partes[1]-1, partes[2]);
            
            const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
            const label = fechaVisual.toLocaleDateString('es-ES', options);

            // Pre-seleccionar si es ayer
            const isChecked = fechaStr === ayerStr ? 'checked' : '';

            const div = document.createElement('div');
            div.className = 'form-check ps-4'; 
            div.innerHTML = `
                <input class="form-check-input check-fecha-liq" type="checkbox" value="${fechaStr}" id="fecha-${fechaStr}" ${isChecked}>
                <label class="form-check-label small" for="fecha-${fechaStr}" style="cursor:pointer; text-transform: capitalize;">
                    ${label}
                </label>
            `;
            container.appendChild(div);
        });

        // Auto-generar reporte si hay fechas seleccionadas (por ejemplo, ayer)
        const haySeleccion = document.querySelector('.check-fecha-liq:checked');
        if (haySeleccion) {
            console.log('🔄 Auto-generando reporte inicial...');
            generarMatrizLiquidacion();
        }

    } catch (error) {
        console.error("Error cargando fechas:", error);
        container.innerHTML = '<div class="text-danger small">Error cargando fechas: ' + error.message + '</div>';
    }
}

function renderizarSelectorBodegas() {
    const container = document.getElementById('listaBodegasLiquidacion');
    if(!container) return;
    container.innerHTML = '';
    
    if (bodegasEspeciales.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">No hay bodegas especiales configuradas.</div>';
        return;
    }

    bodegasEspeciales.forEach(b => {
        const friendly = obtenerFriendlyBodega(b, empleados);
        const div = document.createElement('div');
        div.className = 'col-xl-3 col-lg-3 col-md-4 col-sm-6';
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input check-bodega-liq" type="checkbox" value="${b.id}" id="check-liq-${b.id}" checked>
                <label class="form-check-label" for="check-liq-${b.id}" title="${friendly.nombreLargo}">
                    <i class="fas ${friendly.icono} me-1"></i>${friendly.nombre}
                </label>
            </div>
        `;
        container.appendChild(div);
    });
}

window.seleccionarTodasBodegasLiq = function(checked) {
    document.querySelectorAll('.check-bodega-liq').forEach(c => c.checked = checked);
};

window.generarMatrizLiquidacion = async function() {
    // Obtener fechas seleccionadas
    const fechasSeleccionadas = Array.from(document.querySelectorAll('.check-fecha-liq:checked')).map(c => c.value);
    const bodegasIds = Array.from(document.querySelectorAll('.check-bodega-liq:checked')).map(c => c.value);

    if (fechasSeleccionadas.length === 0) {
        alert('Por favor selecciona al menos una fecha de alisto.');
        return;
    }

    if (bodegasIds.length === 0) {
        alert('Selecciona al menos una bodega especial.');
        return;
    }

    const btn = document.querySelector('button[onclick="generarMatrizLiquidacion()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculando...';

    try {
        // Ordenar fechas para rango
        fechasSeleccionadas.sort();
        const minFecha = fechasSeleccionadas[0];
        const maxFecha = fechasSeleccionadas[fechasSeleccionadas.length - 1];

        const start = new Date(minFecha + 'T00:00:00');
        const end = new Date(maxFecha + 'T23:59:59');

        // Consultar rango amplio
        const q = query(
            collection(db, 'movimientos_inventario'),
            where('fecha', '>=', start),
            where('fecha', '<=', end),
            orderBy('fecha', 'desc')
        );

        const snapshot = await getDocs(q);
        const movimientos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Procesar matriz - Soporta tanto productos como herramientas
        const matriz = {}; 
        const itemsActivos = new Set(); // Guarda claves "producto:ID" o "herramienta:ID"
        
        console.group("🔍 Diagnóstico de Movimientos Liquidación");
        console.log(`Total movimientos recuperados: ${movimientos.length}`);
        let contEntradas = 0;
        let contSalidas = 0;

        // Pre-procesar rangos de fechas seleccionadas para comparación robusta
        // Esto evita problemas de zona horaria con strings simples
        const rangosFechas = fechasSeleccionadas.map(fechaStr => {
            // Crear fecha base en zona local (asumiendo input YYYY-MM-DD)
            // Agregar T00:00 para asegurar interpretación local
            const inicio = new Date(`${fechaStr}T00:00:00`);
            const fin = new Date(`${fechaStr}T23:59:59.999`);
            return { inicio, fin };
        });

        movimientos.forEach(m => {
            // Obtener objeto fecha del movimiento
            let fechaMov = null;
            if (m.fecha && m.fecha.toDate) fechaMov = m.fecha.toDate();
            else if (m.fecha) fechaMov = new Date(m.fecha);
            
            if (!fechaMov) return;

            // Verificar si la fecha cae en alguno de los días seleccionados
            // Usando comparación de tiempo real, no strings
            const enRango = rangosFechas.some(rango => 
                fechaMov >= rango.inicio && fechaMov <= rango.fin
            );

            if (!enRango) return;

            const cant = parseFloat(m.cantidad || 0);
            
            // Determinar si es producto o herramienta
            const esHerramienta = !!m.herramientaId;
            const itemId = esHerramienta ? m.herramientaId : m.productoId;
            const tipoItem = esHerramienta ? 'herramienta' : 'producto';
            const claveItem = `${tipoItem}:${itemId}`; // Clave única: "producto:ID" o "herramienta:ID"
            
            if (!itemId) return; // Si no tiene ni productoId ni herramientaId, saltar
            
            // Validar que los movimientos de transferencia tengan origen y destino
            if (m.tipo === 'transferencia' && (!m.origen || !m.destino)) {
                console.warn(`⚠️ Movimiento ${m.id} de tipo transferencia sin origen o destino, omitiendo`);
                return;
            }
            
            // Lógica Simplificada: Destino = Entrada, Origen = Salida
            
            // 1. Es Entrada si el destino es una de las bodegas seleccionadas
            if (bodegasIds.includes(m.destino)) {
                if (!matriz[claveItem]) matriz[claveItem] = {};
                if (!matriz[claveItem][m.destino]) matriz[claveItem][m.destino] = { entrada: 0, salida: 0 };
                
                matriz[claveItem][m.destino].entrada += cant;
                itemsActivos.add(claveItem);
                contEntradas++;
            }

            // 2. Es Salida si el origen es una de las bodegas seleccionadas
            // Validar que el movimiento tenga origen antes de procesar
            if (!m.origen) {
                console.warn(`⚠️ Movimiento ${m.id} sin origen, omitiendo salida`);
                return;
            }
            
            const esOrigen = bodegasIds.includes(m.origen);
            
            if (esOrigen) {
                const nombreItem = esHerramienta ? (m.herramientaNombre || 'Herramienta') : (m.productoNombre || 'Producto');
                const origenNombre = m.origenNombre || bodegasTodas.find(b => b.id === m.origen)?.nombre || m.origen;
                console.log(`📉 Salida Detectada: ${m.tipo} | ID: ${m.id} | ${tipoItem}: ${nombreItem} | Cant: ${cant} | Origen: ${origenNombre}`);
                
                if (!matriz[claveItem]) matriz[claveItem] = {};
                if (!matriz[claveItem][m.origen]) matriz[claveItem][m.origen] = { entrada: 0, salida: 0 };
                
                matriz[claveItem][m.origen].salida += cant;
                itemsActivos.add(claveItem);
                contSalidas++;
            }
        });
        console.log(`Resumen: ${contEntradas} Entradas procesadas, ${contSalidas} Salidas procesadas.`);
        console.groupEnd();

        renderizarTablaMatriz(matriz, bodegasIds, Array.from(itemsActivos));
        
        document.getElementById('contenedorTablaLiquidacion').style.display = 'block';
        const diasTexto = fechasSeleccionadas.length === 1 ? 'día seleccionado' : 'días seleccionados';
        document.getElementById('tituloReporteLiquidacion').textContent = 
            `Liquidación de Saldos (${fechasSeleccionadas.length} ${diasTexto})`;

    } catch (error) {
        console.error('Error generando matriz:', error);
        alert('Error generando reporte: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

function formatearNombreCorto(nombreCompleto) {
    if (!nombreCompleto) return 'S/N';
    
    let nombreLimpio = nombreCompleto;

    // Estrategia 1: Si tiene guion, tomar la parte derecha (generalmente el nombre personal)
    if (nombreCompleto.includes(' - ')) {
        const partes = nombreCompleto.split(' - ');
        // Tomar la última parte que suele ser el nombre (ej: "Insumos Diarios E - Carlo León")
        nombreLimpio = partes[partes.length - 1].trim();
    } else {
        // Estrategia 2: Limpiar prefijos si no hay guion
        nombreLimpio = nombreCompleto
            .replace(/Insumos Diarios [A-Z]?/i, '')
            .replace(/Insumos D\.? [A-Z]?/i, '') // Caso "Insumos D."
            .replace(/Personal [A-Z]?/i, '')
            .replace(/Bodega /i, '')
            .trim();
    }
        
    // Formatear a "Nombre A."
    // Evitar nombres vacíos si la limpieza borró todo
    if (!nombreLimpio) return nombreCompleto.substring(0, 10) + '.';

    const palabras = nombreLimpio.split(' ').filter(p => p.length > 0);
    
    if (palabras.length >= 2) {
        // Caso especial: "Jose Pablo" -> "Jose P."
        return `${palabras[0]} ${palabras[1].charAt(0)}.`;
    } else if (palabras.length === 1) {
        return palabras[0];
    }
    
    return nombreLimpio.substring(0, 12);
}

function renderizarTablaMatriz(matriz, bodegasIds, itemsIds) {
    const thead = document.querySelector('#tablaLiquidacion thead');
    const tbody = document.querySelector('#tablaLiquidacion tbody');
    
    // Headers
    let headerHtml = '<tr><th class="align-middle bg-light text-dark py-2 border-bottom border-2" style="min-width: 140px; font-size: 0.85rem; border-color: #dee2e6;">Producto / Herramienta</th>';
    const bodegasSeleccionadas = bodegasEspeciales.filter(b => bodegasIds.includes(b.id));
    
    bodegasSeleccionadas.forEach(b => {
        const friendly = obtenerFriendlyBodega(b, empleados);
        const nombreMostrar = friendly.nombreCorto;
        
        headerHtml += `
            <th class="text-center bg-light text-dark border-bottom border-start p-1 position-relative" style="width: 45px; min-width: 45px; height: 140px; vertical-align: bottom; border-color: #dee2e6;">
                <div class="fw-bold mx-auto text-secondary" style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 0.75rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-height: 120px; cursor:help; letter-spacing: 0.5px;" title="${friendly.nombreLargo}">
                    ${nombreMostrar}
                </div>
            </th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Body
    tbody.innerHTML = '';
    
    if (itemsIds.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${bodegasIds.length + 1}" class="text-center p-4">No hay movimientos para los criterios seleccionados.</td></tr>`;
        return;
    }

    // Separar productos y herramientas
    const productosClaves = itemsIds.filter(k => k.startsWith('producto:'));
    const herramientasClaves = itemsIds.filter(k => k.startsWith('herramienta:'));
    
    // Procesar productos
    const productosLista = productos
        .filter(p => productosClaves.includes(`producto:${p.id}`))
        .map(p => ({ ...p, tipoItem: 'producto', claveItem: `producto:${p.id}` }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Procesar herramientas
    const herramientasLista = herramientas
        .filter(h => herramientasClaves.includes(`herramienta:${h.id}`))
        .map(h => ({ ...h, tipoItem: 'herramienta', claveItem: `herramienta:${h.id}` }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    // Combinar y ordenar (productos primero, luego herramientas)
    const itemsLista = [...productosLista, ...herramientasLista];

    itemsLista.forEach(item => {
        const tr = document.createElement('tr');
        const icono = item.tipoItem === 'herramienta' ? '🔧' : '📦';
        tr.setAttribute('data-texto', `${item.nombre} ${item.codigo || ''}`.toLowerCase());
        
        tr.innerHTML = `<td class="align-middle py-1 px-1" style="max-width: 120px; overflow: hidden;">
            <div class="fw-bold text-dark text-truncate" style="font-size: 0.75rem;" title="${item.nombre}">
                ${icono} ${item.nombre}
            </div>
        </td>`;
        
        bodegasSeleccionadas.forEach(b => {
            const datos = matriz[item.claveItem]?.[b.id] || { entrada: 0, salida: 0 };
            const entrada = parseFloat(datos.entrada.toFixed(2));
            const salida = parseFloat(datos.salida.toFixed(2));
            const pendiente = parseFloat((entrada - salida).toFixed(2));
            
            let contenido = '';
            let claseCelda = '';
            let onclick = '';
            let cursor = 'default';
            let opacity = 'opacity-100';

            if (entrada === 0 && salida === 0) {
                contenido = '<span class="text-muted text-opacity-25 small">-</span>';
            } else {
                const esCero = Math.abs(pendiente) < 0.001;
                
                if (!esCero) {
                    if (pendiente > 0) claseCelda = 'bg-warning bg-opacity-10'; 
                    else claseCelda = 'bg-danger bg-opacity-10';
                    
                    onclick = `onclick="window.abrirModalLiquidacion('${item.id}', '${b.id}', ${pendiente}, '${item.tipoItem}')"`;
                    cursor = 'pointer';
                } else {
                    opacity = 'opacity-25 grayscale'; 
                    claseCelda = ''; 
                }

                if (esCero) {
                    // Versión compacta para ceros
                    contenido = `
                        <div class="d-flex flex-column align-items-center justify-content-center ${opacity} w-100">
                            <div class="d-flex justify-content-center gap-1 small text-muted mb-1" style="font-size: 0.65rem;">
                                <span title="Entrada">+${entrada}</span>
                                <span title="Salida">-${salida}</span>
                            </div>
                            <div class="fw-bold text-success mt-1 text-center w-100" style="font-size: 0.9rem;">0</div>
                        </div>
                    `;
                } else {
                    // Versión legible para pendientes
                    contenido = `
                        <div class="d-flex flex-column align-items-center justify-content-center w-100">
                            <div class="d-flex justify-content-center gap-2 small mb-1" style="font-size: 0.65rem;">
                                <span class="text-secondary" title="Entrada">+${entrada}</span>
                                <span class="text-muted" title="Salida">-${salida}</span>
                            </div>
                            <div class="${pendiente > 0 ? 'text-warning' : 'text-danger'} fw-bold px-0 text-center text-truncate d-block" title="Pendiente: ${pendiente}" style="font-size: 1.1rem; line-height: 1;">
                                ${pendiente}
                            </div>
                        </div>
                    `;
                }
                
                // Actualizar onclick para usar item en lugar de p
                if (pendiente > 0.001) {
                    onclick = `onclick="window.abrirModalLiquidacion('${item.id}', '${b.id}', ${pendiente}, '${item.tipoItem}')"`;
                    cursor = 'pointer';
                } else {
                    opacity = 'opacity-25 grayscale'; 
                    claseCelda = ''; 
                }
            }
            
            const td = document.createElement('td');
            // Usar clases personalizadas y border-start suave
            td.className = `text-center align-middle ${claseCelda} position-relative p-1 border-start-0`;
            td.style.cursor = cursor;
            
            // Borde izquierdo suave solo si no es la primera celda de datos
            td.style.borderLeft = '1px solid #f0f0f0';

            if (onclick) {
                td.setAttribute('onclick', onclick.replace('onclick="', '').replace('"', ''));
                td.classList.add('clickable-cell'); // Efecto hover
            }
            
            td.innerHTML = contenido;
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
}

// Filtro de texto instantáneo
window.filtrarTablaTexto = function() {
    const texto = document.getElementById('filtroTextoTabla').value.toLowerCase();
    const filas = document.querySelectorAll('#tablaLiquidacion tbody tr');
    
    filas.forEach(tr => {
        const dataTexto = tr.getAttribute('data-texto') || '';
        // También buscar en el contenido visible por si acaso
        const contenido = tr.innerText.toLowerCase();
        
        if (dataTexto.includes(texto) || contenido.includes(texto)) {
            tr.style.display = '';
        } else {
            tr.style.display = 'none';
        }
    });
};

window.abrirModalLiquidacion = async function(itemId, bodegaId, cantidadPendiente, tipoItem = 'producto') {
    if (cantidadPendiente <= 0.001) return; 

    // Buscar el item (producto o herramienta)
    const item = tipoItem === 'herramienta' 
        ? herramientas.find(h => h.id === itemId)
        : productos.find(p => p.id === itemId);
    const bodega = bodegasEspeciales.find(b => b.id === bodegaId);

    if (!item || !bodega) return;

    // Buscar el movimiento de entrada original (pedido especial) para obtener su fecha contable
    // Buscar movimientos de transferencia donde el destino es esta bodega especial y el item coincide
    const campoId = tipoItem === 'herramienta' ? 'herramientaId' : 'productoId';
    
    let fechaContableOriginal = null;
    try {
        // Intentar query con orderBy primero
        let qEntrada = query(
            collection(db, 'movimientos_inventario'),
            where('tipo', '==', 'transferencia'),
            where('destino', '==', bodegaId),
            where(campoId, '==', itemId),
            where('esPedidoEspecial', '==', true),
            orderBy('fecha', 'desc'),
            limit(1)
        );
        
        let snapshotEntrada;
        try {
            snapshotEntrada = await getDocs(qEntrada);
        } catch (indexError) {
            // Si falla por índice, intentar sin orderBy y ordenar en cliente
            console.warn('⚠️ Query con orderBy falló, intentando sin orderBy:', indexError);
            qEntrada = query(
                collection(db, 'movimientos_inventario'),
                where('tipo', '==', 'transferencia'),
                where('destino', '==', bodegaId),
                where(campoId, '==', itemId),
                where('esPedidoEspecial', '==', true)
            );
            snapshotEntrada = await getDocs(qEntrada);
            
            // Ordenar por fecha en cliente
            const movimientos = snapshotEntrada.docs.map(d => ({ id: d.id, ...d.data() }));
            movimientos.sort((a, b) => {
                const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha || 0);
                const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha || 0);
                return fechaB - fechaA; // Descendente
            });
            
            if (movimientos.length > 0) {
                fechaContableOriginal = movimientos[0].fecha;
                const fechaStr = fechaContableOriginal?.toDate ? fechaContableOriginal.toDate().toISOString() : fechaContableOriginal;
                console.log(`✅ Fecha contable del pedido original encontrada (sin orderBy):`, fechaStr);
            }
        }
        
        if (!fechaContableOriginal && !snapshotEntrada.empty) {
            const movimientoEntrada = snapshotEntrada.docs[0].data();
            fechaContableOriginal = movimientoEntrada.fecha;
            const fechaStr = fechaContableOriginal?.toDate ? fechaContableOriginal.toDate().toISOString() : fechaContableOriginal;
            console.log(`✅ Fecha contable del pedido original encontrada:`, fechaStr);
        }
        
        if (!fechaContableOriginal) {
            console.warn(`⚠️ No se encontró movimiento de entrada original para ${tipoItem} ${itemId} en bodega ${bodegaId}`);
        }
    } catch (error) {
        console.error('❌ Error obteniendo fecha contable del pedido original:', error);
    }

    datosLiquidacionIndividual = {
        itemId,
        itemNombre: item.nombre,
        tipoItem, // 'producto' o 'herramienta'
        bodegaId,
        bodegaNombre: bodega.nombre,
        cantidadTotal: cantidadPendiente,
        fechaContableOriginal, // Guardar la fecha contable del pedido original
        // Mantener compatibilidad con código existente
        productoId: tipoItem === 'producto' ? itemId : null,
        productoNombre: tipoItem === 'producto' ? item.nombre : null,
        herramientaId: tipoItem === 'herramienta' ? itemId : null,
        herramientaNombre: tipoItem === 'herramienta' ? item.nombre : null
    };

    const icono = tipoItem === 'herramienta' ? '🔧' : '📦';
    document.getElementById('modalProductoNombre').textContent = `${icono} ${item.nombre}`;
    document.getElementById('modalBodegaNombre').textContent = bodega.nombre;
    document.getElementById('modalCantidadDisponible').textContent = cantidadPendiente;
    document.getElementById('maxCantidadTotalIndividual').textContent = cantidadPendiente;
    document.getElementById('totalCantidadAsignada').textContent = '0';
    
    document.getElementById('tbodyTransaccionesLiquidacion').innerHTML = '';
    contadorFilas = 0;
    
    agregarFilaTransaccion();

    new bootstrap.Modal(document.getElementById('modalLiquidacionIndividual')).show();
};

window.agregarFilaTransaccion = function() {
    contadorFilas++;
    const tbody = document.getElementById('tbodyTransaccionesLiquidacion');
    const tr = document.createElement('tr');
    tr.id = `fila-transaccion-${contadorFilas}`;
    
    // Determinar si es herramienta para restringir opciones
    const esHerramienta = datosLiquidacionIndividual?.tipoItem === 'herramienta';
    
    let opcionesGasto = '<option value="">Sel. Cuenta Gasto...</option>';
    cuentasGasto.forEach(c => opcionesGasto += `<option value="gasto:${c.id}">${c.nombre}</option>`);
    
    // Para herramientas: solo bodegas de tipo 'herramientas'
    // Para productos: bodegas principales y rutero
    let opcionesBodegas = '<optgroup label="Devolver a Bodega">';
    bodegasTodas.forEach(b => {
        if (esHerramienta) {
            // Solo bodegas de herramientas
            if (b.tipo === 'herramientas') {
                opcionesBodegas += `<option value="${b.id}">Devolver a: ${b.nombre}</option>`;
            }
        } else {
            // Solo bodegas principales y rutero (no herramientas, no insumos/personal)
            if (b.tipo === 'principal' || b.tipo === 'rutero') { 
                opcionesBodegas += `<option value="${b.id}">Devolver a: ${b.nombre}</option>`;
            }
        }
    });
    opcionesBodegas += '</optgroup>';

    // Si es herramienta, NO mostrar opción "Gasto (Consumo)"
    const opcionesTipo = esHerramienta
        ? '<option value="transferencia">Devolución (Sobrante)</option>'
        : '<option value="gasto">Gasto (Consumo)</option>\n                <option value="transferencia">Devolución (Sobrante)</option>';

    tr.innerHTML = `
        <td>
            <select class="form-select form-select-sm tipo-transaccion" onchange="window.actualizarDestinos(this, ${contadorFilas})">
                ${opcionesTipo}
            </select>
        </td>
        <td>
            <select class="form-select form-select-sm destino-transaccion">
                ${esHerramienta ? opcionesBodegas : opcionesGasto}
            </select>
        </td>
        <td>
            <input type="number" class="form-control form-control-sm cantidad-transaccion" 
                   min="1" step="1" oninput="window.actualizarCantidadEntera(this); window.actualizarTotalAsignado()">
        </td>
        <td>
            <input type="text" class="form-control form-control-sm nota-transaccion" placeholder="Nota / Recibo">
        </td>
        <td class="text-center">
            <button class="btn btn-sm btn-outline-danger" onclick="window.eliminarFilaTransaccion(${contadorFilas})">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
};

window.actualizarDestinos = function(selectTipo, filaId) {
    const tr = document.getElementById(`fila-transaccion-${filaId}`);
    const selectDestino = tr.querySelector('.destino-transaccion');
    const tipo = selectTipo.value;
    const esHerramienta = datosLiquidacionIndividual?.tipoItem === 'herramienta';

    selectDestino.innerHTML = '';
    if (tipo === 'gasto') {
        // Solo productos pueden tener gasto
        selectDestino.innerHTML = '<option value="">Sel. Cuenta Gasto...</option>' + 
            cuentasGasto.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } else {
        // Transferencia: filtrar bodegas según tipo de item
        let bodegasFiltradas = bodegasTodas.filter(b => b.id !== datosLiquidacionIndividual.bodegaId);
        
        if (esHerramienta) {
            // Solo bodegas de herramientas
            bodegasFiltradas = bodegasFiltradas.filter(b => b.tipo === 'herramientas');
        } else {
            // Solo bodegas principales y rutero (no herramientas, no insumos/personal)
            bodegasFiltradas = bodegasFiltradas.filter(b => b.tipo === 'principal' || b.tipo === 'rutero');
        }
        
        selectDestino.innerHTML = '<option value="">Sel. Bodega Destino...</option>' + 
            bodegasFiltradas.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('');
    }
};

window.eliminarFilaTransaccion = function(id) {
    const tr = document.getElementById(`fila-transaccion-${id}`);
    if (tr) tr.remove();
    actualizarTotalAsignado();
};

window.actualizarCantidadEntera = function(input) {
    // Convertir automáticamente a entero
    const valor = parseInt(input.value) || 0;
    if (valor < 1) {
        input.value = '';
    } else {
        input.value = valor;
    }
};

window.actualizarTotalAsignado = function() {
    let total = 0;
    document.querySelectorAll('.cantidad-transaccion').forEach(input => {
        total += parseInt(input.value || 0);
    });
    
    const elTotal = document.getElementById('totalCantidadAsignada');
    elTotal.textContent = total;
    
    const max = datosLiquidacionIndividual.cantidadTotal;
    if (total > max) {
        elTotal.className = 'text-danger fw-bold';
        elTotal.innerHTML += ' <i class="fas fa-exclamation-circle" title="Excede el pendiente"></i>';
    } else if (Math.abs(total - max) < 0.01) {
        elTotal.className = 'text-success fw-bold';
    } else {
        elTotal.className = 'text-warning fw-bold';
    }
};

window.procesarLiquidacionIndividual = async function() {
    if (!datosLiquidacionIndividual) return;

    const filas = document.querySelectorAll('#tbodyTransaccionesLiquidacion tr');
    const transacciones = [];
    let total = 0;
    let errores = [];

    filas.forEach((tr, index) => {
        const tipo = tr.querySelector('.tipo-transaccion').value;
        const destino = tr.querySelector('.destino-transaccion').value;
        const cantidad = parseInt(tr.querySelector('.cantidad-transaccion').value || 0);
        const nota = tr.querySelector('.nota-transaccion').value;

        if (!destino) errores.push(`Fila ${index + 1}: Selecciona un destino.`);
        if (cantidad < 1) errores.push(`Fila ${index + 1}: Cantidad inválida (debe ser al menos 1 unidad entera).`);
        
        total += cantidad;
        transacciones.push({ tipo, destino, cantidad, nota });
    });

    if (errores.length > 0) {
        alert(errores.join('\n'));
        return;
    }

    if (Math.abs(total - datosLiquidacionIndividual.cantidadTotal) > 0.01) {
        if (!confirm(`El total asignado (${total}) no coincide con el pendiente (${datosLiquidacionIndividual.cantidadTotal}). ¿Continuar de todas formas?`)) {
            return;
        }
    }

    const btn = document.querySelector('button[onclick="procesarLiquidacionIndividual()"]');
    btn.disabled = true;
    
    try {
        const esHerramienta = datosLiquidacionIndividual.tipoItem === 'herramienta';
        const itemId = esHerramienta ? datosLiquidacionIndividual.herramientaId : datosLiquidacionIndividual.productoId;
        const itemNombre = esHerramienta ? datosLiquidacionIndividual.herramientaNombre : datosLiquidacionIndividual.productoNombre;
        
        // Crear movimientos y actualizar stocks
        // Usar la fecha contable del pedido original si está disponible, de lo contrario usar fecha actual
        let fechaContable;
        if (datosLiquidacionIndividual.fechaContableOriginal) {
            // Usar la fecha contable del pedido original
            fechaContable = datosLiquidacionIndividual.fechaContableOriginal;
            const fechaStr = fechaContable?.toDate ? fechaContable.toDate().toISOString() : fechaContable;
            console.log(`✅ Usando fecha contable del pedido original para liquidación:`, fechaStr);
        } else {
            // Fallback: usar fecha actual local a mediodía (12:00 PM)
            const ahora = new Date();
            const año = ahora.getFullYear();
            const mes = ahora.getMonth();
            const dia = ahora.getDate();
            const fechaLocalMediodia = new Date(año, mes, dia, 12, 0, 0, 0);
            fechaContable = Timestamp.fromDate(fechaLocalMediodia);
            console.error(`❌ ERROR: No se encontró fecha contable original, usando fecha actual (${año}-${mes+1}-${dia})`);
        }
        
        for (const t of transacciones) {
            const movimiento = {
                fecha: fechaContable,
                origen: datosLiquidacionIndividual.bodegaId,
                origenNombre: datosLiquidacionIndividual.bodegaNombre,
                cantidad: t.cantidad,
                tipo: t.tipo === 'gasto' ? 'gasto' : 'transferencia',
                tipoItem: esHerramienta ? 'herramienta' : 'producto',
                usuarioId: auth.currentUser.uid,
                empleado: auth.currentUser.email,
                fechaRegistro: serverTimestamp(),
                motivo: `Liquidación: ${t.nota || 'Sin nota'}`,
                observaciones: `Liquidación Manual desde Matriz. ${t.nota || ''}`
            };

            // Asignar productoId o herramientaId según corresponda
            if (esHerramienta) {
                movimiento.herramientaId = itemId;
                movimiento.herramientaNombre = itemNombre;
            } else {
                movimiento.productoId = itemId;
                movimiento.productoNombre = itemNombre;
            }

            if (t.tipo === 'gasto') {
                const cta = cuentasGasto.find(c => c.id === t.destino);
                movimiento.destino = t.destino;
                movimiento.destinoNombre = cta ? cta.nombre : 'Cuenta Gasto';
                movimiento.esLiquidacion = true;
            } else {
                // Limpiar prefijo "transferencia:" si existe
                let destinoId = t.destino;
                if (destinoId && destinoId.startsWith('transferencia:')) {
                    destinoId = destinoId.replace(/^transferencia:/, '');
                }
                
                const bod = bodegasTodas.find(b => b.id === destinoId);
                movimiento.destino = destinoId;
                movimiento.destinoNombre = bod ? bod.nombre : 'Bodega Destino';
            }

            // Usar procesarMovimientoInventario para mantener consistencia y validaciones
            await procesarMovimientoInventario(db, movimiento, datosLiquidacionIndividual.tipoItem);
        }

        alert('Liquidación procesada exitosamente.');
        bootstrap.Modal.getInstance(document.getElementById('modalLiquidacionIndividual')).hide();
        
        // Esperar un poco más para que Firestore propague el movimiento recién creado
        // y luego regenerar la matriz
        setTimeout(async () => {
            console.log('🔄 Regenerando matriz después de liquidación...');
            await generarMatrizLiquidacion();
        }, 2000);

    } catch (e) {
        console.error('Error procesando:', e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
    }
};
