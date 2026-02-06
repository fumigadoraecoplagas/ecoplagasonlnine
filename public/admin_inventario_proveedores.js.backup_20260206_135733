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
let proveedores = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarProveedores();
        setupListeners();
    } catch (error) {
        console.error('Error inicializando proveedores:', error);
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
    const modalProveedor = document.getElementById('modalProveedor');
    if (modalProveedor) {
        modalProveedor.addEventListener('hidden.bs.modal', function () {
            resetearModalProveedor();
        });
        
        modalProveedor.addEventListener('show.bs.modal', function(event) {
            // Solo limpiar si no es edición (el botón no tiene data-proveedor-id o si el form está vacío)
            const id = document.getElementById('proveedorId').value;
            if (!id) {
                document.querySelector('#modalProveedor .modal-title').innerHTML = '<i class="fas fa-plus"></i> Nuevo Proveedor';
                const btnGuardar = document.querySelector('#modalProveedor .btn-primary');
                btnGuardar.innerHTML = 'Guardar Proveedor';
            }
        });
    }
}

// Cargar proveedores
function cargarProveedores() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    const q = query(collection(db, 'proveedores'), orderBy('nombre'));
    
    onSnapshot(q, (snapshot) => {
        proveedores = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        mostrarTablaProveedores();
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }, error => {
        console.error('Error cargando proveedores:', error);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    });
}

// Mostrar tabla
function mostrarTablaProveedores() {
    const tbody = document.getElementById('tablaProveedores');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (proveedores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay proveedores registrados</td></tr>';
        return;
    }
    
    proveedores.forEach(proveedor => {
        const estadoClass = proveedor.activo !== false ? 'bg-success' : 'bg-danger';
        const estadoTexto = proveedor.activo !== false ? 'Activo' : 'Inactivo';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${proveedor.nombre}</td>
            <td>${proveedor.contacto || '-'}</td>
            <td>${proveedor.telefono || '-'}</td>
            <td>${proveedor.email || '-'}</td>
            <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editarProveedor('${proveedor.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Guardar Proveedor (Nuevo / Editar)
window.guardarProveedor = async function() {
    if (!validarFormulario('formProveedor', ['nombreProveedor', 'contactoProveedor'])) {
        return;
    }
    
    const btnGuardar = document.querySelector('#modalProveedor .btn-primary');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';
    
    try {
        const id = document.getElementById('proveedorId').value;
        const proveedorData = {
            nombre: document.getElementById('nombreProveedor').value.trim(),
            contacto: document.getElementById('contactoProveedor').value.trim(),
            telefono: document.getElementById('telefonoProveedor').value.trim(),
            email: document.getElementById('emailProveedor').value.trim(),
            fechaActualizacion: serverTimestamp(),
            usuarioActualizacion: auth.currentUser.email
        };
        
        if (id) {
            await updateDoc(doc(db, 'proveedores', id), proveedorData);
            mostrarMensaje('Proveedor actualizado exitosamente', 'success');
        } else {
            proveedorData.activo = true;
            proveedorData.fechaCreacion = serverTimestamp();
            proveedorData.usuarioCreacion = auth.currentUser.email;
            await addDoc(collection(db, 'proveedores'), proveedorData);
            mostrarMensaje('Proveedor creado exitosamente', 'success');
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalProveedor'));
        modal.hide();
        resetearModalProveedor();
        
    } catch (error) {
        console.error('Error guardando proveedor:', error);
        mostrarMensaje('Error al guardar proveedor: ' + error.message, 'danger');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
};

// Editar Proveedor
window.editarProveedor = function(id) {
    const proveedor = proveedores.find(p => p.id === id);
    if (!proveedor) return;
    
    document.getElementById('proveedorId').value = proveedor.id;
    document.getElementById('nombreProveedor').value = proveedor.nombre;
    document.getElementById('contactoProveedor').value = proveedor.contacto || '';
    document.getElementById('telefonoProveedor').value = proveedor.telefono || '';
    document.getElementById('emailProveedor').value = proveedor.email || '';
    
    document.querySelector('#modalProveedor .modal-title').textContent = 'Editar Proveedor';
    document.querySelector('#modalProveedor .btn-primary').textContent = 'Actualizar Proveedor';
    
    const modal = new bootstrap.Modal(document.getElementById('modalProveedor'));
    modal.show();
};

function resetearModalProveedor() {
    document.getElementById('formProveedor').reset();
    document.getElementById('proveedorId').value = '';
    document.querySelector('#modalProveedor .modal-title').textContent = 'Nuevo Proveedor';
    const btnGuardar = document.querySelector('#modalProveedor .btn-primary');
    if (btnGuardar) btnGuardar.textContent = 'Guardar Proveedor';
}

