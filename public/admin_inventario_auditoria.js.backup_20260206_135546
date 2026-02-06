import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    getDocs, 
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let transaccionesAuditoria = [];
let productos = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        // Fecha por defecto hoy
        const hoy = new Date().toISOString().split('T')[0];
        document.getElementById('fechaAuditoria').value = hoy;
        
        cargarDatosAuxiliares();
        
    } catch (error) {
        console.error('Error inicializando auditoría:', error);
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
    onSnapshot(query(collection(db, 'productos')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

window.cargarTransaccionesAuditoria = async function() {
    const fechaInput = document.getElementById('fechaAuditoria').value;
    if (!fechaInput) {
        mostrarMensaje('Por favor selecciona una fecha', 'warning');
        return;
    }

    // Rango de fechas para consulta optimizada
    const start = new Date(`${fechaInput}T00:00:00`);
    const end = new Date(`${fechaInput}T23:59:59.999`);

    const tbody = document.getElementById('tablaAuditoria');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando...</td></tr>';

    try {
        // Consultar rango exacto (requiere índice para 'fecha')
        const q = query(
            collection(db, 'movimientos_inventario'), 
            where('fecha', '>=', start),
            where('fecha', '<=', end),
            orderBy('fecha', 'asc')
        );
        
        const snapshot = await getDocs(q);
        
        transaccionesAuditoria = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        actualizarSelectUsuarios();
        filtrarAuditoria();
        
    } catch (error) {
        console.error('Error cargando auditoría:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}<br><small class="text-muted">Verifica si falta crear el índice en Firebase Console.</small></td></tr>`;
    }
};

function actualizarSelectUsuarios() {
    const usuarios = [...new Set(transaccionesAuditoria.map(t => t.usuarioId || t.empleado).filter(u => u))];
    const select = document.getElementById('filtroUsuarioAuditoria');
    select.innerHTML = '<option value="">Todos</option>';
    usuarios.sort().forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u;
        select.appendChild(opt);
    });
}

window.filtrarAuditoria = function() {
    const usuario = document.getElementById('filtroUsuarioAuditoria').value;
    const tipo = document.getElementById('filtroTipoAuditoria').value;
    const estado = document.getElementById('filtroEstadoAuditoria').value;
    
    let filtrados = [...transaccionesAuditoria];
    
    if (usuario) filtrados = filtrados.filter(t => (t.usuarioId === usuario || t.empleado === usuario));
    if (tipo) filtrados = filtrados.filter(t => t.tipo === tipo);
    if (estado) {
        if (estado === 'pendiente') filtrados = filtrados.filter(t => !t.auditoria);
        if (estado === 'auditada') filtrados = filtrados.filter(t => t.auditoria);
    }
    
    actualizarResumen(filtrados);
    renderizarTablaAuditoria(filtrados);
};

function actualizarResumen(lista) {
    document.getElementById('totalAuditoria').textContent = lista.length;
    document.getElementById('pendientesAuditoria').textContent = lista.filter(t => !t.auditoria).length;
    document.getElementById('correctasAuditoria').textContent = lista.filter(t => t.auditoria?.estado === 'correcta').length;
    document.getElementById('incorrectasAuditoria').textContent = lista.filter(t => t.auditoria?.estado === 'incorrecta').length;
}

function renderizarTablaAuditoria(lista) {
    const tbody = document.getElementById('tablaAuditoria');
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No se encontraron transacciones</td></tr>';
        return;
    }
    
    lista.forEach(t => {
        const fecha = t.fecha?.toDate ? t.fecha.toDate() : new Date(t.fecha);
        const hora = formatearHora(fecha);
        const producto = productos.find(p => p.id === t.productoId) || { nombre: 'Desconocido' };
        
        let estadoAudit = '<span class="badge bg-secondary">Pendiente</span>';
        if (t.auditoria) {
            estadoAudit = t.auditoria.estado === 'correcta' 
                ? '<span class="badge bg-success">Correcta</span>'
                : '<span class="badge bg-danger">Incorrecta</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${hora}</td>
            <td><span class="badge bg-light text-dark border">${t.tipo}</span></td>
            <td>${producto.nombre}</td>
            <td>${t.cantidad}</td>
            <td><small>${t.usuarioId || t.empleado || 'N/A'}</small></td>
            <td>${estadoAudit}</td>
            <td><small>${t.auditoria ? t.auditoria.detalle : '-'}</small></td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="auditarTransaccion('${t.id}')">
                    <i class="fas fa-search"></i> Auditar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.auditarTransaccion = function(id) {
    const transaccion = transaccionesAuditoria.find(t => t.id === id);
    if (!transaccion) return;
    
    document.getElementById('transaccionIdAuditar').value = id;
    
    // Mostrar info
    const producto = productos.find(p => p.id === transaccion.productoId) || { nombre: 'Desconocido' };
    const infoDiv = document.getElementById('infoTransaccionAuditar');
    infoDiv.innerHTML = `
        <p><strong>Tipo:</strong> ${transaccion.tipo}</p>
        <p><strong>Producto:</strong> ${producto.nombre}</p>
        <p><strong>Cantidad:</strong> ${transaccion.cantidad}</p>
        <p><strong>Usuario:</strong> ${transaccion.usuarioId || transaccion.empleado}</p>
        <p><strong>Motivo:</strong> ${transaccion.motivo || '-'}</p>
    `;
    
    // Resetear form
    document.getElementById('formAuditarTransaccion').reset();
    if (transaccion.auditoria) {
        if (transaccion.auditoria.estado === 'correcta') document.getElementById('statusCorrecta').checked = true;
        if (transaccion.auditoria.estado === 'incorrecta') document.getElementById('statusIncorrecta').checked = true;
        document.getElementById('detalleAuditoria').value = transaccion.auditoria.detalle || '';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('modalAuditarTransaccion'));
    modal.show();
};

window.guardarAuditoria = async function() {
    const id = document.getElementById('transaccionIdAuditar').value;
    const estado = document.querySelector('input[name="statusAuditoria"]:checked')?.value;
    const detalle = document.getElementById('detalleAuditoria').value;
    
    if (!estado || !detalle) {
        mostrarMensaje('Por favor completa todos los campos', 'warning');
        return;
    }
    
    try {
        const auditoriaData = {
            auditoria: {
                estado: estado,
                detalle: detalle,
                fecha: serverTimestamp(),
                auditor: auth.currentUser.email
            }
        };
        
        await updateDoc(doc(db, 'movimientos_inventario', id), auditoriaData);
        
        mostrarMensaje('Auditoría guardada correctamente', 'success');
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAuditarTransaccion'));
        modal.hide();
        
        cargarTransaccionesAuditoria(); // Recargar tabla
        
    } catch (error) {
        console.error('Error guardando auditoría:', error);
        mostrarMensaje('Error: ' + error.message, 'danger');
    }
};

