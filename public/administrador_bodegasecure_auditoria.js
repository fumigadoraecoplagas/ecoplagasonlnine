// Módulo de Auditoría integrado en administrador_bodega.html
// Funciones para mostrar/ocultar la sección de auditoría y gestionar transacciones

import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    updateDoc, 
    doc,
    orderBy,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let transaccionesAuditoria = [];
let empleadosAuditoria = [];
let productosAuditoria = [];
let bodegasAuditoria = [];
let cuentasGastoAuditoria = [];
let fechasPendientesAuditoria = [];

// Cargar fechas pendientes automáticamente al cargar la página
window.cargarFechasPendientesAuditoria = cargarFechasPendientesAuditoria;

// Cargar empleados para el filtro
async function cargarEmpleadosAuditoria() {
    try {
        const q = query(collection(db, 'empleados'), orderBy('primerNombre'));
        const snapshot = await getDocs(q);
        empleadosAuditoria = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const select = document.getElementById('filtroUsuarioAuditoria');
        if (select) {
            select.innerHTML = '<option value="">Todos</option>';
            empleadosAuditoria.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.username || emp.id;
                option.textContent = `${emp.primerNombre || ''} ${emp.primerApellido || ''}`.trim() || emp.username || emp.id;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando empleados para auditoría:', error);
    }
}

// Cargar fechas con transacciones y su estado de auditoría
async function cargarFechasPendientesAuditoria() {
    try {
        // Obtener fechas de los últimos 35 días
        const hoy = new Date();
        const hace35dias = new Date();
        hace35dias.setDate(hoy.getDate() - 35);
        hace35dias.setHours(0, 0, 0, 0);
        const hoyFin = new Date();
        hoyFin.setHours(23, 59, 59, 999);
        
        // Consultar todas las transacciones del rango
        const q = query(
            collection(db, 'movimientos_inventario'),
            where('fecha', '>=', Timestamp.fromDate(hace35dias)),
            where('fecha', '<=', Timestamp.fromDate(hoyFin)),
            orderBy('fecha', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const transacciones = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Agrupar por fecha y contar totales, auditadas y pendientes
        const fechasMap = {};
        transacciones.forEach(t => {
            const fechaStr = normalizarFechaLocalAuditoria(t.fecha);
            
            if (!fechasMap[fechaStr]) {
                fechasMap[fechaStr] = {
                    fecha: fechaStr,
                    total: 0,
                    auditadas: 0,
                    pendientes: 0
                };
            }
            
            fechasMap[fechaStr].total++;
            if (t.auditado && t.auditado === true) {
                fechasMap[fechaStr].auditadas++;
            } else {
                fechasMap[fechaStr].pendientes++;
            }
        });
        
        // Generar todas las fechas de los últimos 35 días (incluso sin transacciones)
        // Usar la misma función de normalización que se usa para las transacciones
        const todasLasFechas = [];
        for (let i = 0; i < 35; i++) {
            const fecha = new Date();
            fecha.setDate(fecha.getDate() - i);
            fecha.setHours(12, 0, 0, 0); // Mediodía para evitar problemas de zona horaria
            // Usar la misma función de normalización para consistencia
            const fechaStr = normalizarFechaLocalAuditoria(fecha);
            
            if (fechasMap[fechaStr]) {
                todasLasFechas.push(fechasMap[fechaStr]);
            } else {
                // Fecha sin transacciones
                todasLasFechas.push({
                    fecha: fechaStr,
                    total: 0,
                    auditadas: 0,
                    pendientes: 0
                });
            }
        }
        
        fechasPendientesAuditoria = todasLasFechas.sort((a, b) => 
            b.fecha.localeCompare(a.fecha) // Más recientes primero
        );
        
        mostrarFechasPendientes();
        
    } catch (error) {
        console.error('Error cargando fechas pendientes:', error);
    }
}

// Mostrar fechas con colores según estado
function mostrarFechasPendientes() {
    const container = document.getElementById('fechasPendientesContainer');
    const selector = document.getElementById('selectorFechasAuditoria');
    
    if (!container || !selector) {
        console.error('❌ No se encontraron los elementos del selector de fechas');
        return;
    }
    
    // Siempre mostrar el selector, incluso si no hay fechas
    selector.style.display = 'block';
    container.innerHTML = '';
    
    if (fechasPendientesAuditoria.length === 0) {
        console.warn('⚠️ No hay fechas para mostrar');
        container.innerHTML = '<p class="text-muted">No hay fechas disponibles</p>';
        return;
    }
    
    fechasPendientesAuditoria.forEach(item => {
        const fechaObj = new Date(item.fecha + 'T12:00:00');
        const diaMes = fechaObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const diaSemana = fechaObj.toLocaleDateString('es-ES', { weekday: 'short' });
        
        // Determinar color según estado
        let backgroundColor, borderColor, textColor, iconClass, textoInfo;
        
        if (item.total === 0) {
            // Gris: No hay transacciones
            backgroundColor = '#e9ecef';
            borderColor = '#adb5bd';
            textColor = '#6c757d';
            iconClass = 'fa-minus-circle';
            textoInfo = '';
        } else if (item.pendientes === 0) {
            // Verde: Todo auditado
            backgroundColor = '#d1e7dd';
            borderColor = '#28a745';
            textColor = '#155724';
            iconClass = 'fa-check-circle';
            textoInfo = `${item.total}`;
        } else {
            // Rojo: Faltan de auditar
            backgroundColor = '#f8d7da';
            borderColor = '#dc3545';
            textColor = '#721c24';
            iconClass = 'fa-exclamation-circle';
            textoInfo = `${item.pendientes} pend.`;
        }
        
        const card = document.createElement('div');
        card.className = 'card border-0 shadow-sm p-1 d-flex flex-column align-items-center justify-content-center';
        card.style.width = '55px';
        card.style.height = '65px';
        card.style.cursor = item.total > 0 ? 'pointer' : 'default';
        card.style.transition = 'transform 0.2s';
        card.style.backgroundColor = backgroundColor;
        card.style.border = `2px solid ${borderColor}`;
        
        if (item.total > 0) {
            card.onmouseover = () => {
                card.style.transform = 'scale(1.1)';
                card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
            };
            card.onmouseout = () => {
                card.style.transform = 'scale(1.0)';
                card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            };
            
            card.onclick = () => {
                // Establecer fecha en el input
                const fechaInput = document.getElementById('fechaAuditoria');
                if (fechaInput) {
                    fechaInput.value = item.fecha;
                }
                
                // Remover borde azul de todas las cards
                container.querySelectorAll('.card').forEach(c => {
                    const currentBorder = c.style.border;
                    if (currentBorder.includes('#0d6efd')) {
                        // Restaurar borde original según el estado
                        const total = c.dataset.total || '0';
                        const pendientes = c.dataset.pendientes || '0';
                        if (total === '0') {
                            c.style.border = '2px solid #adb5bd';
                        } else if (pendientes === '0') {
                            c.style.border = '2px solid #28a745';
                        } else {
                            c.style.border = '2px solid #dc3545';
                        }
                    }
                });
                
                // Agregar borde azul a la seleccionada
                card.style.border = '3px solid #0d6efd';
                
                // Auto-cargar transacciones - usar window para asegurar que esté disponible
                // Usar una función helper que intente múltiples veces si es necesario
                const intentarCargar = (intentos = 0) => {
                    if (window.cargarTransaccionesAuditoria) {
                        try {
                            window.cargarTransaccionesAuditoria();
                        } catch (error) {
                            console.error('Error al llamar cargarTransaccionesAuditoria:', error);
                            if (intentos < 3) {
                                setTimeout(() => intentarCargar(intentos + 1), 200);
                            } else {
                                alert('Error al cargar transacciones. Por favor, haz clic en el botón "Cargar" manualmente.');
                            }
                        }
                    } else {
                        if (intentos < 5) {
                            setTimeout(() => intentarCargar(intentos + 1), 200);
                        } else {
                            console.error('cargarTransaccionesAuditoria no está disponible después de varios intentos');
                            alert('Error: No se pudo cargar las transacciones. Por favor, haz clic en el botón "Cargar" manualmente.');
                        }
                    }
                };
                intentarCargar();
            };
        }
        
        // Guardar datos en el card para restaurar borde
        card.dataset.total = item.total;
        card.dataset.pendientes = item.pendientes;
        
        card.innerHTML = `
            <div style="font-size: 0.55rem; text-transform: uppercase; line-height: 1.1; text-align: center; color: ${textColor};">
                ${diaSemana}
            </div>
            <div style="font-size: 0.85rem; font-weight: bold; color: ${textColor}; margin: 2px 0;">
                ${diaMes.split(' ')[0]}
            </div>
            <div style="font-size: 0.5rem; color: ${textColor};">
                <i class="fas ${iconClass}"></i> ${textoInfo}
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Cargar productos, bodegas y cuentas de gasto para resolver nombres
async function cargarProductosYBodegasAuditoria() {
    try {
        // Cargar productos
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        productosAuditoria = productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Cargar bodegas
        const bodegasSnapshot = await getDocs(collection(db, 'bodegas'));
        bodegasAuditoria = bodegasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Cargar cuentas de gasto (necesario para transacciones de tipo "gasto")
        const cuentasGastoSnapshot = await getDocs(collection(db, 'cuentas_gasto'));
        cuentasGastoAuditoria = cuentasGastoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error cargando productos, bodegas y cuentas de gasto para auditoría:', error);
    }
}

// Función helper para obtener nombre de producto
function obtenerNombreProducto(productoId) {
    if (!productoId) return 'N/A';
    const producto = productosAuditoria.find(p => p.id === productoId);
    return producto?.nombre || productoId;
}

// Función helper para obtener nombre de bodega
function obtenerNombreBodega(bodegaId) {
    if (!bodegaId) return 'N/A';
    const bodega = bodegasAuditoria.find(b => b.id === bodegaId);
    return bodega?.nombre || bodegaId;
}

// Función helper para obtener nombre de cuenta de gasto
function obtenerNombreCuentaGasto(cuentaGastoId) {
    if (!cuentaGastoId) return 'N/A';
    const cuenta = cuentasGastoAuditoria.find(c => c.id === cuentaGastoId);
    return cuenta?.nombre || cuentaGastoId;
}

// Función helper para obtener nombre del destino (bodega o cuenta de gasto según el tipo)
function obtenerNombreDestino(destinoId, tipoTransaccion) {
    if (!destinoId) return 'N/A';
    
    // Si es un gasto, buscar en cuentas de gasto
    if (tipoTransaccion === 'gasto') {
        return obtenerNombreCuentaGasto(destinoId);
    }
    
    // Para otros tipos (transferencia, compra, etc.), buscar en bodegas
    return obtenerNombreBodega(destinoId);
}

// Función helper global para normalizar fecha a YYYY-MM-DD en zona local
function normalizarFechaLocalAuditoria(fecha) {
    if (!fecha) return null;
    
    let d;
    if (fecha?.toDate) {
        // Es un Timestamp de Firestore
        d = fecha.toDate();
    } else if (fecha instanceof Date) {
        // Ya es un objeto Date
        d = fecha;
    } else {
        // Intentar crear Date desde string u otro formato
        d = new Date(fecha);
    }
    
    // Validar que la fecha es válida
    if (isNaN(d.getTime())) {
        console.error('Fecha inválida:', fecha);
        return null;
    }
    
    // Usar métodos locales para obtener año, mes, día (más confiable que toISOString)
    const año = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
}

// Cargar transacciones para auditoría
window.cargarTransaccionesAuditoria = async function() {
    console.log('🔍 cargarTransaccionesAuditoria llamada');
    
    // El input de fecha ahora está oculto, pero aún se usa para almacenar la fecha seleccionada
    const fechaInput = document.getElementById('fechaAuditoria');
    const usuarioSelect = document.getElementById('filtroUsuarioAuditoria');
    const tipoSelect = document.getElementById('filtroTipoAuditoria');
    const estadoSelect = document.getElementById('filtroEstadoAuditoria');
    
    if (!fechaInput) {
        console.error('❌ fechaInput no encontrado');
        alert('Error: Campo de fecha no encontrado');
        return;
    }
    
    if (!fechaInput.value) {
        alert('Por favor selecciona una fecha de los botones de fechas para auditar');
        return;
    }
    
    console.log('📅 Fecha seleccionada:', fechaInput.value);
    
    const fecha = new Date(fechaInput.value);
    // Asegurar que la fecha se interprete en zona local
    // Usar mediodía para evitar problemas de zona horaria al convertir a Timestamp
    const fechaInicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
    const fechaFin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
    
    // Expandir el rango un poco para capturar transacciones que puedan estar en días adyacentes
    // debido a zona horaria (agregar/restar 1 día)
    const fechaInicioExpandida = new Date(fechaInicio);
    fechaInicioExpandida.setDate(fechaInicioExpandida.getDate() - 1);
    fechaInicioExpandida.setHours(0, 0, 0, 0);
    
    const fechaFinExpandida = new Date(fechaFin);
    fechaFinExpandida.setDate(fechaFinExpandida.getDate() + 1);
    fechaFinExpandida.setHours(23, 59, 59, 999);
    
    try {
        // Construir query base con rango expandido para capturar todas las transacciones
        // que puedan pertenecer al día seleccionado (considerando zona horaria)
        let q = query(
            collection(db, 'movimientos_inventario'),
            where('fecha', '>=', Timestamp.fromDate(fechaInicioExpandida)),
            where('fecha', '<=', Timestamp.fromDate(fechaFinExpandida)),
            orderBy('fecha', 'desc')
        );
        
        const snapshot = await getDocs(q);
        transaccionesAuditoria = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`📊 Total transacciones del rango: ${transaccionesAuditoria.length}`);
        
        // El query de Firestore ya filtró por rango de fecha (fechaInicio a fechaFin)
        // No necesitamos filtrar de nuevo porque puede causar problemas de zona horaria
        // Las transacciones que vienen del query ya están en el rango correcto
        const fechaStr = fechaInput.value; // YYYY-MM-DD (solo para referencia)
        
        // Debug: mostrar algunas fechas para verificar
        if (transaccionesAuditoria.length > 0) {
            console.log('🔍 Primeras 5 fechas normalizadas:');
            transaccionesAuditoria.slice(0, 5).forEach((t, idx) => {
                const fechaNorm = normalizarFechaLocalAuditoria(t.fecha);
                const fechaOriginal = t.fecha?.toDate ? t.fecha.toDate() : new Date(t.fecha);
                console.log(`  ${idx + 1}. Fecha original: ${fechaOriginal.toString()}, Normalizada: ${fechaNorm}, Buscando: ${fechaStr}`);
            });
        }
        
        // Aplicar filtro de fecha local para asegurar que solo se muestren transacciones del día seleccionado
        // Esto es necesario porque el query de Firestore puede traer transacciones de días adyacentes
        // debido a diferencias de zona horaria
        const antesFiltro = transaccionesAuditoria.length;
        transaccionesAuditoria = transaccionesAuditoria.filter(t => {
            const fechaTransStr = normalizarFechaLocalAuditoria(t.fecha);
            return fechaTransStr === fechaStr;
        });
        
        console.log(`📊 Transacciones después del filtro de fecha (${fechaStr}): ${transaccionesAuditoria.length} (antes: ${antesFiltro})`);
        
        // Resolver nombres de productos, bodegas y cuentas de gasto
        await cargarProductosYBodegasAuditoria();
        transaccionesAuditoria = transaccionesAuditoria.map(t => ({
            ...t,
            productoNombre: t.productoNombre || obtenerNombreProducto(t.productoId),
            origenNombre: t.origenNombre || obtenerNombreBodega(t.origen),
            destinoNombre: t.destinoNombre || obtenerNombreDestino(t.destino, t.tipo)
        }));
        
        // Aplicar filtros adicionales
        if (usuarioSelect && usuarioSelect.value) {
            transaccionesAuditoria = transaccionesAuditoria.filter(t => 
                t.empleado === usuarioSelect.value || 
                t.usuarioId === usuarioSelect.value
            );
        }
        
        if (tipoSelect && tipoSelect.value) {
            transaccionesAuditoria = transaccionesAuditoria.filter(t => 
                t.tipo === tipoSelect.value
            );
        }
        
        if (estadoSelect && estadoSelect.value) {
            if (estadoSelect.value === 'pendientes') {
                transaccionesAuditoria = transaccionesAuditoria.filter(t => 
                    !t.auditado || t.auditado === false
                );
            } else if (estadoSelect.value === 'auditadas') {
                transaccionesAuditoria = transaccionesAuditoria.filter(t => 
                    t.auditado === true
                );
            }
        }
        
        // Agrupar por usuario
        mostrarTransaccionesAuditoria();
        
    } catch (error) {
        console.error('Error cargando transacciones para auditoría:', error);
        alert('Error al cargar transacciones: ' + error.message);
    }
};

// Función helper global para obtener nombre del empleado de manera consistente
function obtenerNombreEmpleado(empleadoId) {
    if (!empleadoId) return 'Desconocido';
    
    // Buscar en el mapa de empleados
    const empleado = empleadosAuditoria.find(emp => 
        emp.username === empleadoId || 
        emp.id === empleadoId ||
        emp.firebaseAuthEmail === empleadoId ||
        (empleadoId.includes('@') && emp.firebaseAuthEmail && empleadoId.includes(emp.firebaseAuthEmail.split('@')[0]))
    );
    
    if (empleado) {
        const nombreCompleto = `${empleado.primerNombre || ''} ${empleado.primerApellido || ''}`.trim();
        return nombreCompleto || empleado.username || empleado.id || 'Desconocido';
    }
    
    // Si no se encuentra, limpiar el formato del email
    if (empleadoId.includes('@')) {
        // Extraer username del email: rh+username@domain.com -> username
        const match = empleadoId.match(/rh\+([^@]+)@/);
        if (match) {
            return match[1];
        }
        // Si es email normal, usar la parte antes del @
        return empleadoId.split('@')[0];
    }
    
    return empleadoId;
}

// Mostrar transacciones agrupadas por usuario
function mostrarTransaccionesAuditoria() {
    const container = document.getElementById('transaccionesAuditoriaContainer');
    if (!container) return;
    
    if (transaccionesAuditoria.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No hay transacciones para la fecha seleccionada</div>';
        return;
    }
    
    // Agrupar por usuario con nombres normalizados
    const agrupadas = {};
    transaccionesAuditoria.forEach(t => {
        const empleadoId = t.empleado || t.usuarioId || 'Desconocido';
        const nombreEmpleado = obtenerNombreEmpleado(empleadoId);
        
        if (!agrupadas[nombreEmpleado]) {
            agrupadas[nombreEmpleado] = [];
        }
        agrupadas[nombreEmpleado].push(t);
    });
    
    // Función helper para formatear fecha corta
    function formatearFechaCorta(fecha) {
        if (!fecha) return 'N/A';
        const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const año = d.getFullYear();
        const horas = String(d.getHours()).padStart(2, '0');
        const minutos = String(d.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${año} ${horas}:${minutos}`;
    }
    
    let html = '';
    Object.keys(agrupadas).forEach(usuario => {
        const transacciones = agrupadas[usuario];
        
        // Detectar si es Mayren Rodriguez (variaciones del nombre)
        const esMayren = usuario.toLowerCase().includes('mayren') && usuario.toLowerCase().includes('rodriguez');
        
        // Contar transacciones pendientes
        const pendientes = transacciones.filter(t => !t.auditado || t.auditado === false).length;
        
        html += `
            <div class="card mb-2">
                <div class="card-header bg-light" style="color: #212529; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                    <h6 class="mb-0" style="color: #212529;">${usuario} (${transacciones.length} transacciones)</h6>
                    ${esMayren && pendientes > 0 ? `
                        <button class="btn btn-sm btn-success" onclick="auditarBulkMayren('${usuario}')" style="font-size: 0.75rem; padding: 0.25rem 0.75rem;">
                            <i class="fas fa-check-double"></i> Auditar Todas (${pendientes} pend.)
                        </button>
                    ` : ''}
                </div>
                <div class="card-body p-2">
                    <div class="table-responsive">
                        <table class="table table-sm table-hover mb-0 tabla-auditoria" style="font-size: 0.85rem;">
                            <colgroup>
                                <col style="width: 12% !important; min-width: 12% !important; max-width: 12% !important;">
                                <col style="width: 8% !important; min-width: 8% !important; max-width: 8% !important;">
                                <col style="width: 20% !important; min-width: 20% !important; max-width: 20% !important;">
                                <col style="width: 6% !important; min-width: 6% !important; max-width: 6% !important;">
                                <col style="width: 18% !important; min-width: 18% !important; max-width: 18% !important;">
                                <col style="width: 18% !important; min-width: 18% !important; max-width: 18% !important;">
                                <col style="width: 8% !important; min-width: 8% !important; max-width: 8% !important;">
                                <col style="width: 10% !important; min-width: 10% !important; max-width: 10% !important;">
                            </colgroup>
                            <thead style="background-color: #f8f9fa;">
                                <tr>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Fecha/Hora</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Tipo</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Producto</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Cantidad</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Origen</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Destino</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Estado</th>
                                    <th style="padding: 0.4rem; font-size: 0.8rem;">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        transacciones.forEach((t, index) => {
            const fecha = t.fecha ? formatearFechaCorta(t.fecha) : 'N/A';
            const estado = t.auditado ? 
                (t.auditoriaCorrecta ? '<span class="badge bg-success" style="font-size: 0.75rem;">Correcta</span>' : '<span class="badge bg-danger" style="font-size: 0.75rem;">Incorrecta</span>') :
                '<span class="badge bg-warning" style="font-size: 0.75rem;">Pendiente</span>';
            
            // Filas alternadas para mejor legibilidad
            const bgColor = index % 2 === 0 ? 'transparent' : '#f8f9fa';
            const hoverColor = '#e9ecef';
            
            html += `
                <tr style="background-color: ${bgColor}; cursor: pointer;" onmouseover="this.style.backgroundColor='${hoverColor}'" onmouseout="this.style.backgroundColor='${bgColor}'">
                    <td style="padding: 0.4rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fecha}</td>
                    <td style="padding: 0.4rem; overflow: hidden; text-overflow: ellipsis;">${t.tipo || 'N/A'}</td>
                    <td style="padding: 0.4rem; overflow: hidden; text-overflow: ellipsis;" title="${t.productoNombre || t.productoId || 'N/A'}">${t.productoNombre || t.productoId || 'N/A'}</td>
                    <td style="padding: 0.4rem; text-align: center;">${t.cantidad || 0}</td>
                    <td style="padding: 0.4rem; overflow: hidden; text-overflow: ellipsis;" title="${t.origenNombre || t.origen || 'N/A'}">${t.origenNombre || t.origen || 'N/A'}</td>
                    <td style="padding: 0.4rem; overflow: hidden; text-overflow: ellipsis;" title="${t.destinoNombre || t.destino || 'N/A'}">${t.destinoNombre || t.destino || 'N/A'}</td>
                    <td style="padding: 0.4rem;">${estado}</td>
                    <td style="padding: 0.4rem;">
                        <button class="btn btn-sm btn-outline-primary" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; white-space: nowrap;" onclick="event.stopPropagation(); abrirModalAuditoria('${t.id}')">
                            <i class="fas fa-search"></i> Auditar
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Actualizar resumen de auditoría
function actualizarResumenAuditoria() {
    const total = transaccionesAuditoria.length;
    const pendientes = transaccionesAuditoria.filter(t => !t.auditado || t.auditado === false).length;
    const correctas = transaccionesAuditoria.filter(t => t.auditado && t.auditoriaCorrecta === true).length;
    const incorrectas = transaccionesAuditoria.filter(t => t.auditado && t.auditoriaCorrecta === false).length;
    
    document.getElementById('totalTransaccionesAuditoria').textContent = total;
    document.getElementById('pendientesAuditoria').textContent = pendientes;
    document.getElementById('auditadasCorrectas').textContent = correctas;
    document.getElementById('auditadasIncorrectas').textContent = incorrectas;
    
    const resumen = document.getElementById('resumenAuditoria');
    if (resumen) {
        resumen.style.display = 'block';
    }
}

// Abrir modal de auditoría
window.abrirModalAuditoria = function(transaccionId) {
    const transaccion = transaccionesAuditoria.find(t => t.id === transaccionId);
    if (!transaccion) return;
    
    // Llenar información de la transacción
    const infoDiv = document.getElementById('infoTransaccionAuditar');
    if (infoDiv) {
        const fecha = transaccion.fecha?.toDate ? transaccion.fecha.toDate().toLocaleString() : 'N/A';
        
        // Resolver nombres si no están disponibles
        const productoNombre = transaccion.productoNombre || obtenerNombreProducto(transaccion.productoId);
        const origenNombre = transaccion.origenNombre || obtenerNombreBodega(transaccion.origen);
        const destinoNombre = transaccion.destinoNombre || obtenerNombreDestino(transaccion.destino, transaccion.tipo);
        
        infoDiv.innerHTML = `
            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Tipo:</strong> ${transaccion.tipo || 'N/A'}</p>
            <p><strong>Producto:</strong> ${productoNombre}</p>
            <p><strong>Cantidad:</strong> ${transaccion.cantidad || 0}</p>
            <p><strong>Origen:</strong> ${origenNombre}</p>
            <p><strong>Destino:</strong> ${destinoNombre}</p>
            <p><strong>Usuario:</strong> ${transaccion.empleado || transaccion.usuarioId || 'N/A'}</p>
        `;
    }
    
    document.getElementById('transaccionIdAuditar').value = transaccionId;
    
    // Establecer estado actual si existe
    if (transaccion.auditado) {
        const radioCorrecta = document.getElementById('statusCorrecta');
        const radioIncorrecta = document.getElementById('statusIncorrecta');
        if (transaccion.auditoriaCorrecta) {
            if (radioCorrecta) radioCorrecta.checked = true;
        } else {
            if (radioIncorrecta) radioIncorrecta.checked = true;
        }
    }
    
    document.getElementById('detalleAuditoria').value = transaccion.detalleAuditoria || '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalAuditarTransaccion'));
    modal.show();
};

// Guardar auditoría
window.guardarAuditoria = async function() {
    const transaccionId = document.getElementById('transaccionIdAuditar').value;
    const estadoRadio = document.querySelector('input[name="statusAuditoria"]:checked');
    const detalle = document.getElementById('detalleAuditoria').value;
    
    if (!transaccionId || !estadoRadio || !detalle) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    const estado = estadoRadio.value;
    
    try {
        const currentUser = auth.currentUser;
        const updateData = {
            auditado: true,
            auditoriaCorrecta: estado === 'correcta',
            detalleAuditoria: detalle,
            auditadoPor: currentUser?.email || currentUser?.uid || 'unknown',
            fechaAuditoria: Timestamp.now()
        };
        
        await updateDoc(doc(db, 'movimientos_inventario', transaccionId), updateData);
        
        // Actualizar en memoria
        const transaccion = transaccionesAuditoria.find(t => t.id === transaccionId);
        if (transaccion) {
            Object.assign(transaccion, updateData);
        }
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAuditarTransaccion'));
        if (modal) modal.hide();
        
        // Refrescar vista
        mostrarTransaccionesAuditoria();
        
        alert('Auditoría guardada exitosamente');
        
    } catch (error) {
        console.error('Error guardando auditoría:', error);
        alert('Error al guardar auditoría: ' + error.message);
    }
};

// Auditar en bulk todas las transacciones pendientes de Mayren Rodriguez
window.auditarBulkMayren = async function(nombreUsuario) {
    if (!confirm(`¿Estás seguro de auditar todas las transacciones pendientes de ${nombreUsuario} como "Correctas"?`)) {
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        
        // Obtener todas las transacciones pendientes de este usuario
        const transaccionesPendientes = transaccionesAuditoria.filter(t => {
            const empleadoId = t.empleado || t.usuarioId || 'Desconocido';
            const nombreEmpleado = obtenerNombreEmpleado(empleadoId);
            return nombreEmpleado === nombreUsuario && (!t.auditado || t.auditado === false);
        });
        
        if (transaccionesPendientes.length === 0) {
            alert('No hay transacciones pendientes para auditar');
            return;
        }
        
        // Mostrar indicador de progreso
        const mensajeProgreso = `Auditando ${transaccionesPendientes.length} transacciones...`;
        console.log(mensajeProgreso);
        
        // Auditar todas las transacciones pendientes
        const updatePromises = transaccionesPendientes.map(async (transaccion) => {
            const updateData = {
                auditado: true,
                auditoriaCorrecta: true,
                detalleAuditoria: 'Auditado en bulk - Usuario de confianza',
                auditadoPor: currentUser?.email || currentUser?.uid || 'unknown',
                fechaAuditoria: Timestamp.now()
            };
            
            await updateDoc(doc(db, 'movimientos_inventario', transaccion.id), updateData);
            
            // Actualizar en memoria
            Object.assign(transaccion, updateData);
        });
        
        await Promise.all(updatePromises);
        
        console.log(`✅ ${transaccionesPendientes.length} transacciones auditadas exitosamente`);
        
        // Refrescar vista
        mostrarTransaccionesAuditoria();
        
        // Recargar fechas pendientes para actualizar los contadores
        await cargarFechasPendientesAuditoria();
        
        alert(`✅ ${transaccionesPendientes.length} transacciones auditadas exitosamente como "Correctas"`);
        
    } catch (error) {
        console.error('Error en auditoría bulk:', error);
        alert('Error al auditar transacciones: ' + error.message);
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando módulo de auditoría...');
    
    // Cargar empleados
    cargarEmpleadosAuditoria();
    
    // Cargar fechas pendientes automáticamente
    // Usar un pequeño delay para asegurar que el DOM esté completamente cargado
    setTimeout(() => {
        console.log('📅 Cargando fechas pendientes...');
        cargarFechasPendientesAuditoria().catch(error => {
            console.error('❌ Error al cargar fechas pendientes:', error);
        });
    }, 100);
    
    // El botón de cargar ya tiene onclick="cargarTransaccionesAuditoria()" en el HTML
});


