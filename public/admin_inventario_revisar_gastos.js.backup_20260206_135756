import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let gastos = [];
let productos = [];
let bodegas = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarDatosAuxiliares();
        cargarGastos();
    } catch (error) {
        console.error('Error inicializando revisión de gastos:', error);
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

function cargarDatosAuxiliares() {
    // Cargar productos para mostrar nombres
    onSnapshot(query(collection(db, 'productos')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarTabla(); // Refrescar si llegan nombres
    });
    
    // Cargar bodegas
    onSnapshot(query(collection(db, 'bodegas')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarTabla();
    });
}

function cargarGastos() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    // Consultar solo movimientos tipo 'gasto'
    // Optimizamos trayendo los últimos 500, si se necesita historial más antiguo se puede paginar
    const q = query(
        collection(db, 'movimientos_inventario'), 
        where('tipo', '==', 'gasto'),
        orderBy('fecha', 'desc'),
        limit(500)
    );
    
    onSnapshot(q, (snapshot) => {
        gastos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        actualizarEstadisticas();
        llenarFiltroOperarios();
        filtrarGastos(); // Renderiza la tabla
        
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }, error => {
        console.error("Error cargando gastos:", error);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    });
}

function actualizarEstadisticas() {
    document.getElementById('totalGastosCount').textContent = gastos.length;
    
    const pendientes = gastos.filter(g => !g.revisado).length;
    document.getElementById('gastosPendientesCount').textContent = pendientes;
    
    const revisados = gastos.filter(g => g.revisado).length;
    document.getElementById('gastosRevisadosCount').textContent = revisados;
}

function llenarFiltroOperarios() {
    const operarios = [...new Set(gastos.map(g => g.empleado || g.usuarioId).filter(u => u))];
    const select = document.getElementById('filtroOperarioGasto');
    const valorActual = select.value;
    
    select.innerHTML = '<option value="">Todos</option>';
    operarios.sort().forEach(op => {
        const option = document.createElement('option');
        option.value = op;
        option.textContent = op;
        select.appendChild(option);
    });
    
    if (valorActual && operarios.includes(valorActual)) {
        select.value = valorActual;
    }
}

window.filtrarGastos = function() {
    const estado = document.getElementById('filtroEstadoGasto').value;
    const operario = document.getElementById('filtroOperarioGasto').value;
    
    let filtrados = [...gastos];
    
    if (estado === 'pendiente') {
        filtrados = filtrados.filter(g => !g.revisado);
    } else if (estado === 'revisado') {
        filtrados = filtrados.filter(g => g.revisado);
    }
    
    if (operario) {
        filtrados = filtrados.filter(g => (g.empleado === operario || g.usuarioId === operario));
    }
    
    renderizarTabla(filtrados);
};

function renderizarTabla(listaGastos = gastos) {
    const tbody = document.getElementById('tablaGastosReportados');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (listaGastos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay gastos que coincidan con los filtros</td></tr>';
        return;
    }
    
    listaGastos.forEach(gasto => {
        const producto = productos.find(p => p.id === gasto.productoId) || { nombre: 'Desconocido', unidad: '' };
        const bodega = bodegas.find(b => b.id === gasto.origen) || { nombre: 'Desconocida' };
        const fecha = gasto.fecha?.toDate ? formatearFechaHora(gasto.fecha.toDate()) : formatearFechaHora(new Date(gasto.fecha));
        
        const esRevisado = !!gasto.revisado;
        const estadoBadge = esRevisado 
            ? '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Revisado</span>' 
            : '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>Pendiente</span>';
            
        const btnAccion = esRevisado
            ? `<button class="btn btn-outline-secondary btn-sm" disabled><i class="fas fa-check-double"></i> Listo</button>`
            : `<button class="btn btn-success btn-sm" onclick="marcarGastoRevisado('${gasto.id}')" title="Marcar como revisado">
                 <i class="fas fa-check"></i> Aprobar
               </button>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fecha}</td>
            <td class="fw-bold">${producto.nombre}</td>
            <td>${gasto.cantidad} ${producto.unidad}</td>
            <td>${gasto.empleado || gasto.usuarioId || 'N/A'}</td>
            <td>${bodega.nombre}</td>
            <td>${gasto.tipoGasto || 'Gasto General'}</td>
            <td><small>${gasto.motivo || gasto.observaciones || '-'}</small></td>
            <td>${estadoBadge}</td>
            <td>${btnAccion}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.marcarGastoRevisado = async function(gastoId) {
    try {
        const gastoRef = doc(db, 'movimientos_inventario', gastoId);
        await updateDoc(gastoRef, {
            revisado: true,
            fechaRevision: serverTimestamp(),
            usuarioRevision: auth.currentUser.email
        });
        
        mostrarMensaje('Gasto marcado como revisado', 'success');
        // La actualización en tiempo real refrescará la tabla
        
    } catch (error) {
        console.error('Error marcando gasto:', error);
        mostrarMensaje('Error al actualizar el gasto: ' + error.message, 'danger');
    }
};

