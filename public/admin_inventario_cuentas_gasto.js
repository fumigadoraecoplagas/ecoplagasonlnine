import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let cuentasGasto = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarCuentasGasto();
        setupListeners();
    } catch (error) {
        console.error('Error inicializando cuentas gasto:', error);
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

function setupListeners() {
    const modalCuenta = document.getElementById('modalCuentaGasto');
    if (modalCuenta) {
        modalCuenta.addEventListener('hidden.bs.modal', function () {
            resetearModalCuenta();
        });
        
        modalCuenta.addEventListener('show.bs.modal', function(event) {
            const id = document.getElementById('cuentaId').value;
            if (!id) {
                document.querySelector('#modalCuentaGasto .modal-title').innerHTML = '<i class="fas fa-plus"></i> Nueva Cuenta de Gasto';
                const btnGuardar = document.querySelector('#modalCuentaGasto .btn-warning');
                btnGuardar.innerHTML = 'Guardar Cuenta';
            }
        });
    }
}

// Cargar cuentas
function cargarCuentasGasto() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    const q = query(collection(db, 'cuentas_gasto'), orderBy('nombre'));
    
    onSnapshot(q, (snapshot) => {
        cuentasGasto = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        mostrarTablaCuentasGasto();
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }, error => {
        console.error('Error cargando cuentas:', error);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    });
}

// Mostrar tabla
function mostrarTablaCuentasGasto() {
    const tbody = document.getElementById('tablaCuentasGasto');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (cuentasGasto.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay cuentas de gasto registradas</td></tr>';
        return;
    }
    
    cuentasGasto.forEach(cuenta => {
        const estadoClass = cuenta.activo !== false ? 'bg-success' : 'bg-danger';
        const estadoTexto = cuenta.activo !== false ? 'Activa' : 'Inactiva';
        const fechaCreacion = cuenta.fechaCreacion ? formatearFecha(cuenta.fechaCreacion) : '-';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${cuenta.nombre}</td>
            <td>${cuenta.descripcion || '-'}</td>
            <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            <td>${fechaCreacion}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editarCuentaGasto('${cuenta.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Guardar Cuenta (Nueva / Editar)
window.guardarCuentaGasto = async function() {
    if (!validarFormulario('formCuentaGasto', ['nombreCuentaGasto'])) {
        return;
    }
    
    const btnGuardar = document.querySelector('#modalCuentaGasto .btn-warning');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
    
    try {
        const id = document.getElementById('cuentaId').value;
        const cuentaData = {
            nombre: document.getElementById('nombreCuentaGasto').value.trim(),
            descripcion: document.getElementById('descripcionCuentaGasto').value.trim(),
            fechaActualizacion: serverTimestamp(),
            usuarioActualizacion: auth.currentUser.email
        };
        
        if (id) {
            await updateDoc(doc(db, 'cuentas_gasto', id), cuentaData);
            mostrarMensaje('Cuenta actualizada exitosamente', 'success');
        } else {
            cuentaData.activo = true;
            cuentaData.fechaCreacion = serverTimestamp();
            cuentaData.usuarioCreacion = auth.currentUser.email;
            await addDoc(collection(db, 'cuentas_gasto'), cuentaData);
            mostrarMensaje('Cuenta creada exitosamente', 'success');
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCuentaGasto'));
        modal.hide();
        resetearModalCuenta();
        
    } catch (error) {
        console.error('Error guardando cuenta:', error);
        mostrarMensaje('Error al guardar cuenta: ' + error.message, 'danger');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
};

// Editar Cuenta
window.editarCuentaGasto = function(id) {
    const cuenta = cuentasGasto.find(c => c.id === id);
    if (!cuenta) return;
    
    document.getElementById('cuentaId').value = cuenta.id;
    document.getElementById('nombreCuentaGasto').value = cuenta.nombre;
    document.getElementById('descripcionCuentaGasto').value = cuenta.descripcion || '';
    
    document.querySelector('#modalCuentaGasto .modal-title').textContent = 'Editar Cuenta de Gasto';
    document.querySelector('#modalCuentaGasto .btn-warning').textContent = 'Actualizar Cuenta';
    
    const modal = new bootstrap.Modal(document.getElementById('modalCuentaGasto'));
    modal.show();
};

function resetearModalCuenta() {
    document.getElementById('formCuentaGasto').reset();
    document.getElementById('cuentaId').value = '';
    document.querySelector('#modalCuentaGasto .modal-title').textContent = 'Nueva Cuenta de Gasto';
    const btnGuardar = document.querySelector('#modalCuentaGasto .btn-warning');
    if (btnGuardar) btnGuardar.textContent = 'Guardar Cuenta';
}

