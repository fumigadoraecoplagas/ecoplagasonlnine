import { auth, db } from './auth-secure.js';
import { 
    collection, 
    getDocs,
    query,
    where,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let bodegasRutero = []; // Solo bodegas tipo 'rutero' (bodegas personales)
let empleados = [];
let reporteData = [];

// Esperar autenticación
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        // Establecer fechas por defecto (últimas 4 semanas)
        const hoy = new Date();
        const fechaFin = new Date(hoy);
        fechaFin.setDate(fechaFin.getDate() - (fechaFin.getDay() || 7) + 6); // Último domingo
        const fechaInicio = new Date(fechaFin);
        fechaInicio.setDate(fechaInicio.getDate() - 27); // 4 semanas atrás
        
        document.getElementById('fechaInicio').value = fechaInicio.toISOString().split('T')[0];
        document.getElementById('fechaFin').value = fechaFin.toISOString().split('T')[0];
        
        await cargarDatosBase();
    } catch (error) {
        console.error('Error inicializando:', error);
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

async function cargarDatosBase() {
    try {
        // Cargar bodegas tipo 'rutero' (bodegas personales)
        const bodegasSnapshot = await getDocs(collection(db, 'bodegas'));
        bodegasRutero = bodegasSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(b => b.tipo === 'rutero');
        console.log(`✅ Cargadas ${bodegasRutero.length} bodegas personales (rutero)`);

        // Cargar empleados
        const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
        empleados = empleadosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ Cargados ${empleados.length} empleados`);
    } catch (error) {
        console.error('Error cargando datos base:', error);
    }
}

// Formatear monto en miles de colones (redondeado)
function formatearMontoMiles(monto) {
    if (typeof monto !== 'number' || isNaN(monto)) {
        return '₡0';
    }
    // Redondear a miles
    const montoMiles = Math.round(monto / 1000);
    return `₡${montoMiles.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
}

// Obtener número de semana del año
function obtenerNumeroSemana(fecha) {
    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Obtener rango de semana (lunes a domingo)
function obtenerRangoSemana(fecha) {
    const d = new Date(fecha);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar a lunes
    const lunes = new Date(d.setDate(diff));
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);
    
    const formatoFecha = (f) => {
        const dia = String(f.getDate()).padStart(2, '0');
        const mes = String(f.getMonth() + 1).padStart(2, '0');
        return `${dia}/${mes}`;
    };
    
    return `${formatoFecha(lunes)} - ${formatoFecha(domingo)}`;
}

// Obtener nombre del técnico
function obtenerNombreTecnico(usuarioId) {
    const empleado = empleados.find(e => e.id === usuarioId || e.username === usuarioId);
    if (empleado) {
        return `${empleado.primerNombre || ''} ${empleado.primerApellido || ''}`.trim() || empleado.username || usuarioId;
    }
    return usuarioId;
}

// Cargar reporte
window.cargarReporte = async function() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio || !fechaFin) {
        alert('Por favor selecciona las fechas de inicio y fin');
        return;
    }
    
    const contenedorCargando = document.getElementById('contenedorCargando');
    const contenedorResultados = document.getElementById('contenedorResultados');
    const contenedorVacio = document.getElementById('contenedorVacio');
    
    try {
        contenedorCargando.style.display = 'block';
        contenedorResultados.style.display = 'none';
        contenedorVacio.style.display = 'none';
        
        // Convertir fechas a Timestamp
        const fechaInicioDate = new Date(fechaInicio + 'T00:00:00-06:00');
        const fechaFinDate = new Date(fechaFin + 'T23:59:59-06:00');
        const fechaInicioTimestamp = Timestamp.fromDate(fechaInicioDate);
        const fechaFinTimestamp = Timestamp.fromDate(fechaFinDate);
        
        // Obtener IDs de bodegas rutero
        const bodegasRuteroIds = bodegasRutero.map(b => b.id);
        
        if (bodegasRuteroIds.length === 0) {
            contenedorCargando.style.display = 'none';
            contenedorVacio.style.display = 'block';
            return;
        }
        
        // Buscar gastos en el rango de fechas
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA (reporte) necesita TODOS los movimientos_inventario
        // NO debe tener límite porque filtra por fecha después, pero necesita acceso a todo el historial
        console.log('🔍 Buscando gastos...');
        const movimientosSnapshot = await getDocs(collection(db, 'movimientos_inventario'));
        const movimientos = movimientosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar gastos de bodegas rutero en el rango de fechas
        const gastos = movimientos.filter(mov => {
            if (mov.tipo !== 'gasto') return false;
            if (!bodegasRuteroIds.includes(mov.origen)) return false;
            
            // Verificar fecha
            let fechaMov = null;
            if (mov.fecha) {
                if (mov.fecha.toDate) {
                    fechaMov = mov.fecha.toDate();
                } else if (mov.fecha instanceof Date) {
                    fechaMov = mov.fecha;
                } else {
                    fechaMov = new Date(mov.fecha);
                }
            }
            
            if (!fechaMov || isNaN(fechaMov.getTime())) return false;
            
            return fechaMov >= fechaInicioDate && fechaMov <= fechaFinDate;
        });
        
        console.log(`✅ Encontrados ${gastos.length} gastos`);
        
        // Agrupar por técnico y semana
        const agrupacion = {};
        
        gastos.forEach(gasto => {
            let fechaGasto = null;
            if (gasto.fecha) {
                if (gasto.fecha.toDate) {
                    fechaGasto = gasto.fecha.toDate();
                } else if (gasto.fecha instanceof Date) {
                    fechaGasto = gasto.fecha;
                } else {
                    fechaGasto = new Date(gasto.fecha);
                }
            }
            
            if (!fechaGasto || isNaN(fechaGasto.getTime())) return;
            
            const tecnicoId = gasto.usuarioId || gasto.empleado || 'Desconocido';
            const semanaKey = `${fechaGasto.getFullYear()}-W${obtenerNumeroSemana(fechaGasto)}`;
            const key = `${tecnicoId}-${semanaKey}`;
            
            if (!agrupacion[key]) {
                agrupacion[key] = {
                    tecnicoId: tecnicoId,
                    semanaKey: semanaKey,
                    fechaSemana: fechaGasto,
                    gastoTotal: 0,
                    transacciones: 0,
                    detalles: []
                };
            }
            
            const total = gasto.total || (gasto.cantidad || 0) * (gasto.precioUnitario || 0);
            agrupacion[key].gastoTotal += total;
            agrupacion[key].transacciones++;
            
            // Obtener nombre del producto
            const productoNombre = gasto.productoNombre || gasto.productoId || 'N/A';
            agrupacion[key].detalles.push({
                producto: productoNombre,
                cantidad: gasto.cantidad || 0,
                total: total
            });
        });
        
        // Convertir a array y ordenar
        reporteData = Object.values(agrupacion)
            .sort((a, b) => {
                // Ordenar por técnico, luego por semana
                const nombreA = obtenerNombreTecnico(a.tecnicoId);
                const nombreB = obtenerNombreTecnico(b.tecnicoId);
                if (nombreA !== nombreB) {
                    return nombreA.localeCompare(nombreB);
                }
                return a.semanaKey.localeCompare(b.semanaKey);
            });
        
        // Renderizar tabla
        renderizarTabla();
        
        contenedorCargando.style.display = 'none';
        contenedorResultados.style.display = 'block';
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        alert('Error al generar el reporte: ' + error.message);
        contenedorCargando.style.display = 'none';
    }
};

// Renderizar tabla pivot
function renderizarTabla() {
    const thead = document.getElementById('theadReporte');
    const tbody = document.getElementById('tbodyReporte');
    thead.innerHTML = '';
    tbody.innerHTML = '';
    
    if (reporteData.length === 0) {
        document.getElementById('contenedorResultados').style.display = 'none';
        document.getElementById('contenedorVacio').style.display = 'block';
        return;
    }
    
    // Obtener todas las semanas únicas ordenadas
    const semanasUnicas = [...new Set(reporteData.map(item => item.semanaKey))].sort();
    
    // Obtener todos los técnicos únicos
    const tecnicosUnicos = [...new Set(reporteData.map(item => item.tecnicoId))];
    
    // Crear estructura pivot: tecnicoId -> semanaKey -> gastoTotal
    const pivotData = {};
    let totalGeneral = 0;
    
    tecnicosUnicos.forEach(tecnicoId => {
        pivotData[tecnicoId] = {
            nombre: obtenerNombreTecnico(tecnicoId),
            semanas: {},
            total: 0
        };
    });
    
    reporteData.forEach(item => {
        if (!pivotData[item.tecnicoId]) {
            pivotData[item.tecnicoId] = {
                nombre: obtenerNombreTecnico(item.tecnicoId),
                semanas: {},
                total: 0
            };
        }
        pivotData[item.tecnicoId].semanas[item.semanaKey] = item.gastoTotal;
        pivotData[item.tecnicoId].total += item.gastoTotal;
        totalGeneral += item.gastoTotal;
    });
    
    // Ordenar técnicos por nombre
    const tecnicosOrdenados = tecnicosUnicos.sort((a, b) => {
        const nombreA = pivotData[a].nombre;
        const nombreB = pivotData[b].nombre;
        return nombreA.localeCompare(nombreB);
    });
    
    // Crear encabezado
    const trHeader = document.createElement('tr');
    trHeader.innerHTML = '<th style="position: sticky; left: 0; background-color: #f8f9fa; z-index: 20;">Técnico</th>';
    
    semanasUnicas.forEach(semanaKey => {
        // Extraer fecha de la primera transacción de esa semana para obtener rango
        const itemSemana = reporteData.find(item => item.semanaKey === semanaKey);
        const rangoSemana = itemSemana ? obtenerRangoSemana(itemSemana.fechaSemana) : semanaKey;
        trHeader.innerHTML += `<th class="text-center" style="min-width: 100px;">${escapeHTML(rangoSemana)}</th>`;
    });
    
    trHeader.innerHTML += '<th class="text-end fw-bold" style="background-color: #e9ecef;">Total</th>';
    thead.appendChild(trHeader);
    
    // Crear filas para cada técnico
    tecnicosOrdenados.forEach(tecnicoId => {
        const tr = document.createElement('tr');
        const datos = pivotData[tecnicoId];
        
        // Nombre del técnico (sticky)
        tr.innerHTML = `<td class="fw-bold" style="position: sticky; left: 0; background-color: white; z-index: 10; border-right: 2px solid #dee2e6;">${escapeHTML(datos.nombre)}</td>`;
        
        // Valores por semana
        semanasUnicas.forEach(semanaKey => {
            const gasto = datos.semanas[semanaKey] || 0;
            const montoMiles = Math.round(gasto / 1000);
            tr.innerHTML += `<td class="text-end monto">${montoMiles > 0 ? `₡${montoMiles.toLocaleString('es-CR')}K` : '-'}</td>`;
        });
        
        // Total del técnico
        const totalMiles = Math.round(datos.total / 1000);
        tr.innerHTML += `<td class="text-end monto monto-total fw-bold" style="background-color: #f8f9fa;">${totalMiles > 0 ? `₡${totalMiles.toLocaleString('es-CR')}K` : '-'}</td>`;
        
        tbody.appendChild(tr);
    });
    
    // Fila de totales por semana
    const trTotales = document.createElement('tr');
    trTotales.className = 'table-primary';
    trTotales.innerHTML = '<td class="fw-bold" style="position: sticky; left: 0; background-color: #0d6efd; color: white; z-index: 10; border-right: 2px solid #dee2e6;">TOTAL</td>';
    
    semanasUnicas.forEach(semanaKey => {
        const totalSemana = reporteData
            .filter(item => item.semanaKey === semanaKey)
            .reduce((sum, item) => sum + item.gastoTotal, 0);
        const totalMiles = Math.round(totalSemana / 1000);
        trTotales.innerHTML += `<td class="text-end monto monto-total fw-bold">${totalMiles > 0 ? `₡${totalMiles.toLocaleString('es-CR')}K` : '-'}</td>`;
    });
    
    // Total general
    const totalGeneralMiles = Math.round(totalGeneral / 1000);
    trTotales.innerHTML += `<td class="text-end monto monto-total fw-bold" style="background-color: #0d6efd; color: white;">₡${totalGeneralMiles.toLocaleString('es-CR')}K</td>`;
    
    tbody.appendChild(trTotales);
    
    // Actualizar resumen
    document.getElementById('totalTecnicos').textContent = tecnicosUnicos.length;
    document.getElementById('totalSemanas').textContent = semanasUnicas.length;
    document.getElementById('gastoTotal').textContent = formatearMontoMiles(totalGeneral);
}

// Escapar HTML
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Exportar a Excel (formato pivot)
window.exportarExcel = function() {
    if (reporteData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    // Obtener semanas únicas ordenadas
    const semanasUnicas = [...new Set(reporteData.map(item => item.semanaKey))].sort();
    
    // Obtener técnicos únicos
    const tecnicosUnicos = [...new Set(reporteData.map(item => item.tecnicoId))];
    
    // Crear estructura pivot
    const pivotData = {};
    tecnicosUnicos.forEach(tecnicoId => {
        pivotData[tecnicoId] = {
            nombre: obtenerNombreTecnico(tecnicoId),
            semanas: {},
            total: 0
        };
    });
    
    reporteData.forEach(item => {
        if (!pivotData[item.tecnicoId]) {
            pivotData[item.tecnicoId] = {
                nombre: obtenerNombreTecnico(item.tecnicoId),
                semanas: {},
                total: 0
            };
        }
        pivotData[item.tecnicoId].semanas[item.semanaKey] = item.gastoTotal;
        pivotData[item.tecnicoId].total += item.gastoTotal;
    });
    
    // Ordenar técnicos por nombre
    const tecnicosOrdenados = tecnicosUnicos.sort((a, b) => {
        return pivotData[a].nombre.localeCompare(pivotData[b].nombre);
    });
    
    // Crear CSV
    let csv = 'Técnico';
    semanasUnicas.forEach(semanaKey => {
        const itemSemana = reporteData.find(item => item.semanaKey === semanaKey);
        const rangoSemana = itemSemana ? obtenerRangoSemana(itemSemana.fechaSemana) : semanaKey;
        csv += `,"${rangoSemana}"`;
    });
    csv += ',Total\n';
    
    // Filas de técnicos
    tecnicosOrdenados.forEach(tecnicoId => {
        const datos = pivotData[tecnicoId];
        csv += `"${datos.nombre}"`;
        semanasUnicas.forEach(semanaKey => {
            const gasto = datos.semanas[semanaKey] || 0;
            const montoMiles = Math.round(gasto / 1000);
            csv += `,${montoMiles > 0 ? montoMiles : ''}`;
        });
        const totalMiles = Math.round(datos.total / 1000);
        csv += `,${totalMiles}\n`;
    });
    
    // Fila de totales
    csv += '"TOTAL"';
    semanasUnicas.forEach(semanaKey => {
        const totalSemana = reporteData
            .filter(item => item.semanaKey === semanaKey)
            .reduce((sum, item) => sum + item.gastoTotal, 0);
        const totalMiles = Math.round(totalSemana / 1000);
        csv += `,${totalMiles}`;
    });
    const totalGeneral = reporteData.reduce((sum, item) => sum + item.gastoTotal, 0);
    const totalGeneralMiles = Math.round(totalGeneral / 1000);
    csv += `,${totalGeneralMiles}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gastos_semanales_pivot_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

