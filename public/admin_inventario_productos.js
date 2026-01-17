import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let productos = [];
let herramientas = [];
let bodegas = [];
let stockBodegas = [];
let productoSeleccionadoEliminar = null;
let herramientaSeleccionadaEliminar = null;
let conteoTransacciones = {}; // Mapa: { 'producto:ID': count, 'herramienta:ID': count }

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarDatos();
        cargarHerramientas(); // Cargar herramientas también
        setupListeners();
    } catch (error) {
        console.error('Error inicializando productos:', error);
    }
});

function esperarAuthManager() {
    return new Promise((resolve, reject) => {
        if (window.authManager) return resolve(window.authManager);
        
        const onAuthReady = () => {
            window.removeEventListener('secure-auth-ready', onAuthReady);
            if (window.authManager) resolve(window.authManager);
        };
        window.addEventListener('secure-auth-ready', onAuthReady);

        let retries = 0;
        const interval = setInterval(() => {
            if (window.authManager) {
                clearInterval(interval);
                window.removeEventListener('secure-auth-ready', onAuthReady);
                resolve(window.authManager);
            }
            retries++;
            if (retries > 50) {
                clearInterval(interval);
                reject(new Error('Timeout esperando a AuthManager'));
            }
        }, 100);
    });
}

function setupListeners() {
    // Listener para el modal de productos (resetear al cerrar)
    const modalProducto = document.getElementById('modalProducto');
    if (modalProducto) {
        modalProducto.addEventListener('hidden.bs.modal', function () {
            resetearModalProducto();
        });
    }

    // Listener búsqueda local para productos
    const inputBusqueda = document.getElementById('buscarProducto');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', function() {
            mostrarTablaProductos(this.value);
        });
    }
    
    // Listener búsqueda local para herramientas
    const inputBusquedaHerramientas = document.getElementById('buscarHerramienta');
    if (inputBusquedaHerramientas) {
        inputBusquedaHerramientas.addEventListener('input', function() {
            mostrarTablaHerramientas(this.value);
        });
    }
}

// Cargar datos
function cargarDatos() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    // 1. Productos
    const productosQuery = query(collection(db, 'productos'), orderBy('nombre'));
    onSnapshot(productosQuery, (snapshot) => {
        productos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        mostrarTablaProductos();
        actualizarSelectEliminar();
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    });

    // 2. Bodegas (para validar stock al eliminar)
    const bodegasQuery = query(collection(db, 'bodegas'));
    onSnapshot(bodegasQuery, (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    });

    // 3. Stock (para validar stock al eliminar)
    const stockQuery = query(collection(db, 'stock_bodegas'));
    onSnapshot(stockQuery, (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        mostrarTablaProductos(); // Actualizar stock disponible visualmente
        actualizarResumenPivot(); // Actualizar resumen pivot
    });
    
    // Verificar permisos de administrador para mostrar botón de eliminar
    verificarPermisosAdmin();
    
    // Cargar transacciones para contar uso
    cargarConteoTransacciones();
}

// Cargar herramientas
function cargarHerramientas() {
    const loadingSpinner = document.getElementById('loadingSpinnerHerramientas');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    // Herramientas
    const herramientasQuery = query(collection(db, 'herramientas'), orderBy('nombre'));
    onSnapshot(herramientasQuery, (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        mostrarTablaHerramientas();
        actualizarSelectEliminarHerramienta();
        actualizarResumenPivot(); // Actualizar resumen pivot
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    });
}

async function verificarPermisosAdmin() {
    const user = auth.currentUser;
    if (!user) return;

    // Lista de admins hardcoded (mismo criterio que en el monolito)
    const ADMIN_USERS = ['mario.paniagua', 'pablo.paniagua', 'mayren.rodriguez'];
    
    // También podemos chequear claims si estuvieran implementados, pero usamos username por consistencia actual
    // Necesitamos el username del usuario actual. Lo obtenemos de su perfil en Firestore o Auth.
    // Asumimos que auth-secure carga el perfil en window.currentUserData o similar, 
    // pero mejor consultamos el perfil si es necesario.
    // Por simplicidad y consistencia con el código legado, usaremos el email o username del objeto auth.
    
    let username = user.email ? user.email.split('@')[0] : '';
    
    // Intentar obtener username real del auth manager
    if (window.authManager && window.authManager.currentUser) {
        username = window.authManager.currentUser.username || username;
    }

    if (ADMIN_USERS.includes(username)) {
        const adminControls = document.getElementById('adminControls');
        if (adminControls) adminControls.style.display = 'block';
        const adminControlsHerramientas = document.getElementById('adminControlsHerramientas');
        if (adminControlsHerramientas) adminControlsHerramientas.style.display = 'block';
    }
}

// Mostrar tabla de productos
function mostrarTablaProductos(filtro = '') {
    const tbody = document.getElementById('tablaProductos');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const termino = filtro.toLowerCase();
    
    const productosFiltrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo.toLowerCase().includes(termino) ||
        p.categoria.toLowerCase().includes(termino)
    );
    
    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No se encontraron productos</td></tr>';
        return;
    }
    
    // Ordenar productos: primero los que NO son "Insumos Gastables" (con warning), luego "Insumos Gastables" al final
    const productosOrdenados = productosFiltrados.sort((a, b) => {
        const categoriaA = a.categoria || 'Sin categoría';
        const categoriaB = b.categoria || 'Sin categoría';
        const esInsumosGastablesA = categoriaA === 'Insumos Gastables';
        const esInsumosGastablesB = categoriaB === 'Insumos Gastables';
        
        // Si uno es "Insumos Gastables" y el otro no, el que no lo es va primero
        if (esInsumosGastablesA && !esInsumosGastablesB) return 1;
        if (!esInsumosGastablesA && esInsumosGastablesB) return -1;
        
        // Si ambos son o no son "Insumos Gastables", ordenar alfabéticamente por categoría
        if (categoriaA !== categoriaB) {
            return categoriaA.localeCompare(categoriaB);
        }
        
        // Si tienen la misma categoría, ordenar por nombre
        return (a.nombre || '').localeCompare(b.nombre || '');
    });
    
    // Limitar renderizado inicial para rendimiento
    const MAX_ROWS = 50;
    const productosMostrados = productosOrdenados.slice(0, MAX_ROWS);

    productosMostrados.forEach(producto => {
        const stockTotal = calcularStockTotalProducto(producto.id);
        const stockClass = stockTotal <= (producto.stockMinimo || 0) ? 'text-danger fw-bold' : 'text-success';
        const estadoClass = producto.activo !== false ? 'bg-success' : 'bg-danger';
        const estadoTexto = producto.activo !== false ? 'Activo' : 'Inactivo';
        
        // Obtener conteo de transacciones
        const numTransacciones = conteoTransacciones[`producto:${producto.id}`] || 0;
        const transaccionesBadge = numTransacciones > 0 
            ? `<span class="badge bg-info" title="${numTransacciones} transacciones registradas">${numTransacciones}</span>`
            : `<span class="badge bg-secondary" title="Sin transacciones">0</span>`;
        
        // Determinar si la categoría necesita corrección
        const categoria = producto.categoria || 'Sin categoría';
        const esInsumosGastables = categoria === 'Insumos Gastables';
        const categoriaBadge = esInsumosGastables 
            ? `<span class="badge bg-info text-dark">${categoria}</span>`
            : `<span class="badge bg-warning text-dark">
                ${categoria} 
                <i class="fas fa-exclamation-triangle ms-1" title="Categoría debe corregirse a 'Insumos Gastables'"></i>
               </span>`;
        
        const tr = document.createElement('tr');
        // Agregar clase de warning si no es "Insumos Gastables"
        if (!esInsumosGastables) {
            tr.className = 'table-warning';
        }
        tr.innerHTML = `
            <td><span class="badge bg-light text-dark border">${producto.codigo}</span></td>
            <td class="fw-bold">${producto.nombre}</td>
            <td>${categoriaBadge}</td>
            <td>${producto.unidad}</td>
            <td>${formatearColones(producto.precioUnitario)}</td>
            <td>${producto.stockMinimo || 0}</td>
            <td class="${stockClass}">${stockTotal}</td>
            <td class="text-center">${transaccionesBadge}</td>
            <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editarProducto('${producto.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (productosOrdenados.length > MAX_ROWS) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="10" class="text-center text-muted">... y ${productosOrdenados.length - MAX_ROWS} productos más (usa el buscador para verlos)</td>`;
        tbody.appendChild(tr);
    }
}

function calcularStockTotalProducto(productoId) {
    if (!stockBodegas) return 0;
    const stocksProducto = stockBodegas.filter(s => s.productoId === productoId);
    return stocksProducto.reduce((sum, s) => sum + (Number(s.stockActual) || 0), 0);
}

// Guardar producto (Nuevo / Editar)
window.guardarProducto = async function() {
    if (!validarFormulario('formProducto', ['codigoProducto', 'nombreProducto', 'categoriaProducto', 'unidadProducto', 'precioProducto'])) {
        return;
    }

    const btnGuardar = document.querySelector('#modalProducto .btn-success');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';

    try {
        const id = document.getElementById('productoId').value;
        const productoData = {
            codigo: document.getElementById('codigoProducto').value.trim(),
            nombre: document.getElementById('nombreProducto').value.trim(),
            categoria: document.getElementById('categoriaProducto').value,
            unidad: document.getElementById('unidadProducto').value.trim(),
            precioUnitario: parseFloat(document.getElementById('precioProducto').value),
            stockMinimo: parseInt(document.getElementById('stockMinimoProducto').value) || 0,
            fechaActualizacion: serverTimestamp(),
            usuarioActualizacion: auth.currentUser.email
        };

        if (id) {
            // Actualizar
            await updateDoc(doc(db, 'productos', id), productoData);
            mostrarMensaje('Producto actualizado exitosamente', 'success');
        } else {
            // Crear
            productoData.activo = true;
            productoData.fechaCreacion = serverTimestamp();
            productoData.usuarioCreacion = auth.currentUser.email;
            await addDoc(collection(db, 'productos'), productoData);
            mostrarMensaje('Producto creado exitosamente', 'success');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalProducto'));
        modal.hide();
        resetearModalProducto();

    } catch (error) {
        console.error('Error guardando producto:', error);
        mostrarMensaje('Error al guardar el producto: ' + error.message, 'danger');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
};

// Editar producto (Cargar datos en modal)
window.editarProducto = function(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('productoId').value = producto.id;
    document.getElementById('codigoProducto').value = producto.codigo;
    document.getElementById('nombreProducto').value = producto.nombre;
    document.getElementById('categoriaProducto').value = producto.categoria;
    document.getElementById('unidadProducto').value = producto.unidad;
    document.getElementById('precioProducto').value = producto.precioUnitario;
    document.getElementById('stockMinimoProducto').value = producto.stockMinimo || 0;

    document.querySelector('#modalProducto .modal-title').textContent = 'Editar Producto';
    const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
    modal.show();
};

// Resetear modal
function resetearModalProducto() {
    document.getElementById('formProducto').reset();
    document.getElementById('productoId').value = '';
    document.querySelector('#modalProducto .modal-title').textContent = 'Nuevo Producto';
}

// --- Lógica de Eliminación ---

function actualizarSelectEliminar() {
    const select = document.getElementById('productoEliminar');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar producto...</option>';
    productos.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.codigo} - ${p.nombre}`;
        select.appendChild(option);
    });

    select.addEventListener('change', function() {
        mostrarInfoProductoEliminar(this.value);
    });
}

function mostrarInfoProductoEliminar(id) {
    const container = document.getElementById('infoProductoEliminar');
    const btnEliminar = document.getElementById('btnConfirmarEliminar');
    
    if (!id) {
        container.innerHTML = '<div class="text-muted">Selecciona un producto para ver su información</div>';
        btnEliminar.disabled = true;
        productoSeleccionadoEliminar = null;
        return;
    }
    
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    
    productoSeleccionadoEliminar = producto;
    
    // Verificar historial
    // Nota: Esto requiere consultas adicionales para ser preciso, aquí haremos una verificación básica de stock
    const stockTotal = calcularStockTotalProducto(id);
    const tieneStock = stockTotal > 0;
    
    let advertenciaHtml = '';
    if (tieneStock) {
        advertenciaHtml = `
            <div class="alert alert-warning mt-2 mb-0">
                <i class="fas fa-exclamation-circle me-1"></i>
                <strong>¡Atención!</strong> Este producto tiene stock activo (${stockTotal} unidades).
                Se recomienda liquidar el stock antes de eliminarlo.
            </div>
        `;
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="fw-bold mb-1">${producto.nombre}</h6>
                <p class="mb-1 text-muted small">Código: ${producto.codigo}</p>
                <p class="mb-0 text-muted small">Categoría: ${producto.categoria}</p>
            </div>
            <span class="badge ${producto.activo ? 'bg-success' : 'bg-secondary'}">
                ${producto.activo ? 'Activo' : 'Inactivo'}
            </span>
        </div>
        ${advertenciaHtml}
    `;
    
    btnEliminar.disabled = false;
}

window.mostrarModalEliminacionProducto = function() {
    const modal = new bootstrap.Modal(document.getElementById('modalEliminarProducto'));
    actualizarSelectEliminar(); // Refrescar lista
    modal.show();
};

window.confirmarEliminacionProducto = async function() {
    if (!productoSeleccionadoEliminar) return;
    
    if (!confirm(`¿Estás SEGURO de que deseas eliminar permanentemente el producto "${productoSeleccionadoEliminar.nombre}"? Esta acción NO se puede deshacer.`)) {
        return;
    }
    
    const btnEliminar = document.getElementById('btnConfirmarEliminar');
    const textoOriginal = btnEliminar.innerHTML;
    btnEliminar.disabled = true;
    btnEliminar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Eliminando...';
    
    try {
        // 1. Eliminar registros de stock asociados
        const batchSize = 500;
        const stockRef = collection(db, 'stock_bodegas');
        const qStock = query(stockRef, where('productoId', '==', productoSeleccionadoEliminar.id));
        const snapshotStock = await getDocs(qStock);
        
        const deletePromises = snapshotStock.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // 2. Eliminar producto
        await deleteDoc(doc(db, 'productos', productoSeleccionadoEliminar.id));
        
        mostrarMensaje('Producto y sus registros de stock eliminados correctamente', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEliminarProducto'));
        modal.hide();
        
        // Resetear selección
        document.getElementById('productoEliminar').value = '';
        document.getElementById('infoProductoEliminar').innerHTML = '<div class="text-muted">Selecciona un producto para ver su información</div>';
        
    } catch (error) {
        console.error('Error eliminando producto:', error);
        mostrarMensaje('Error al eliminar producto: ' + error.message, 'danger');
    } finally {
        btnEliminar.disabled = false;
        btnEliminar.innerHTML = textoOriginal;
    }
};

// ========== FUNCIONES PARA HERRAMIENTAS ==========

// Mostrar tabla de herramientas
function mostrarTablaHerramientas(filtro = '') {
    const tbody = document.getElementById('tablaHerramientas');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const termino = (filtro || '').toLowerCase();
    
    const herramientasFiltradas = herramientas.filter(h => {
        if (!termino) return true; // Si no hay término de búsqueda, mostrar todas
        const nombre = (h.nombre || '').toLowerCase();
        const codigo = (h.codigo || '').toLowerCase();
        const id = (h.id || '').toLowerCase();
        return nombre.includes(termino) || codigo.includes(termino) || id.includes(termino);
    });
    
    if (herramientasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se encontraron herramientas</td></tr>';
        return;
    }
    
    // Limitar renderizado inicial para rendimiento
    const MAX_ROWS = 50;
    const herramientasMostradas = herramientasFiltradas.slice(0, MAX_ROWS);

    herramientasMostradas.forEach(herramienta => {
        const stockTotal = calcularStockTotalHerramienta(herramienta.id);
        const estadoClass = herramienta.activo !== false ? 'bg-success' : 'bg-danger';
        const estadoTexto = herramienta.activo !== false ? 'Activo' : 'Inactivo';
        
        // Obtener conteo de transacciones
        const numTransacciones = conteoTransacciones[`herramienta:${herramienta.id}`] || 0;
        const transaccionesBadge = numTransacciones > 0 
            ? `<span class="badge bg-info" title="${numTransacciones} transacciones registradas">${numTransacciones}</span>`
            : `<span class="badge bg-secondary" title="Sin transacciones">0</span>`;
        
        // Generar código/ID para mostrar (usar codigo si existe, sino usar id corto)
        const codigoMostrar = herramienta.codigo || herramienta.id.substring(0, 8).toUpperCase();
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge bg-light text-dark border">${codigoMostrar}</span></td>
            <td class="fw-bold">${herramienta.nombre}</td>
            <td>${formatearColones(herramienta.precioUnitario || 0)}</td>
            <td class="text-success">${stockTotal}</td>
            <td class="text-center">${transaccionesBadge}</td>
            <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="editarHerramienta('${herramienta.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (herramientasFiltradas.length > MAX_ROWS) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" class="text-center text-muted">... y ${herramientasFiltradas.length - MAX_ROWS} herramientas más (usa el buscador para verlas)</td>`;
        tbody.appendChild(tr);
    }
}

function calcularStockTotalHerramienta(herramientaId) {
    if (!stockBodegas) return 0;
    const stocksHerramienta = stockBodegas.filter(s => s.herramientaId === herramientaId);
    return stocksHerramienta.reduce((sum, s) => sum + (Number(s.stockActual || s.cantidad) || 0), 0);
}

// Cargar y contar transacciones por producto/herramienta
async function cargarConteoTransacciones() {
    try {
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA necesita TODOS los movimientos_inventario
        // NO debe tener límite porque debe contar TODAS las transacciones por producto/herramienta
        const snapshot = await getDocs(collection(db, 'movimientos_inventario'));
        const movimientos = snapshot.docs.map(d => d.data());
        
        // Reiniciar conteo
        conteoTransacciones = {};
        
        // Contar transacciones por producto
        movimientos.forEach(mov => {
            if (mov.productoId) {
                const clave = `producto:${mov.productoId}`;
                conteoTransacciones[clave] = (conteoTransacciones[clave] || 0) + 1;
            }
            if (mov.herramientaId) {
                const clave = `herramienta:${mov.herramientaId}`;
                conteoTransacciones[clave] = (conteoTransacciones[clave] || 0) + 1;
            }
        });
        
        console.log(`✅ Conteo de transacciones cargado: ${Object.keys(conteoTransacciones).length} items con transacciones`);
        
        // Actualizar tablas si ya están cargadas
        mostrarTablaProductos();
        mostrarTablaHerramientas();
    } catch (error) {
        console.error('Error cargando conteo de transacciones:', error);
    }
}

// Generar código automático para herramienta
function generarCodigoHerramienta() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `HERR-${timestamp.toString(36).toUpperCase().slice(-6)}${random.toString().padStart(3, '0')}`;
}

// Guardar herramienta (Nuevo / Editar)
window.guardarHerramienta = async function() {
    if (!validarFormulario('formHerramienta', ['nombreHerramienta', 'precioHerramienta'])) {
        return;
    }

    const btnGuardar = document.querySelector('#modalHerramienta .btn-warning');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...';

    try {
        const id = document.getElementById('herramientaId').value;
        const nombre = document.getElementById('nombreHerramienta').value.trim();
        const precioUnitario = parseFloat(document.getElementById('precioHerramienta').value);
        
        const herramientaData = {
            nombre: nombre,
            precioUnitario: precioUnitario,
            fechaActualizacion: serverTimestamp(),
            usuarioActualizacion: auth.currentUser.email
        };

        if (id) {
            // Actualizar - mantener código existente
            const herramientaExistente = herramientas.find(h => h.id === id);
            if (herramientaExistente && herramientaExistente.codigo) {
                herramientaData.codigo = herramientaExistente.codigo;
            }
            await updateDoc(doc(db, 'herramientas', id), herramientaData);
            mostrarMensaje('Herramienta actualizada exitosamente', 'success');
        } else {
            // Crear - generar código automático
            herramientaData.codigo = generarCodigoHerramienta();
            herramientaData.activo = true;
            herramientaData.fechaCreacion = serverTimestamp();
            herramientaData.usuarioCreacion = auth.currentUser.email;
            await addDoc(collection(db, 'herramientas'), herramientaData);
            mostrarMensaje('Herramienta creada exitosamente', 'success');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalHerramienta'));
        modal.hide();
        resetearModalHerramienta();

    } catch (error) {
        console.error('Error guardando herramienta:', error);
        mostrarMensaje('Error al guardar la herramienta: ' + error.message, 'danger');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
};

// Editar herramienta (Cargar datos en modal)
window.editarHerramienta = function(id) {
    const herramienta = herramientas.find(h => h.id === id);
    if (!herramienta) return;

    document.getElementById('herramientaId').value = herramienta.id;
    document.getElementById('codigoHerramienta').value = herramienta.codigo || herramienta.id.substring(0, 8).toUpperCase();
    document.getElementById('nombreHerramienta').value = herramienta.nombre;
    document.getElementById('precioHerramienta').value = herramienta.precioUnitario || 0;

    document.querySelector('#modalHerramienta .modal-title').innerHTML = '<i class="fas fa-tools me-2"></i>Editar Herramienta';
    const modal = new bootstrap.Modal(document.getElementById('modalHerramienta'));
    modal.show();
};

// Resetear modal
function resetearModalHerramienta() {
    document.getElementById('formHerramienta').reset();
    document.getElementById('herramientaId').value = '';
    document.getElementById('codigoHerramienta').value = '';
    document.querySelector('#modalHerramienta .modal-title').innerHTML = '<i class="fas fa-tools me-2"></i>Nueva Herramienta';
}

// --- Lógica de Eliminación de Herramientas ---

function actualizarSelectEliminarHerramienta() {
    const select = document.getElementById('herramientaEliminar');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar herramienta...</option>';
    herramientas.forEach(h => {
        const codigoMostrar = h.codigo || h.id.substring(0, 8).toUpperCase();
        const option = document.createElement('option');
        option.value = h.id;
        option.textContent = `${codigoMostrar} - ${h.nombre}`;
        select.appendChild(option);
    });

    select.addEventListener('change', function() {
        mostrarInfoHerramientaEliminar(this.value);
    });
}

function mostrarInfoHerramientaEliminar(id) {
    const container = document.getElementById('infoHerramientaEliminar');
    const btnEliminar = document.getElementById('btnConfirmarEliminarHerramienta');
    
    if (!id) {
        container.innerHTML = '<div class="text-muted">Selecciona una herramienta para ver su información</div>';
        btnEliminar.disabled = true;
        herramientaSeleccionadaEliminar = null;
        return;
    }
    
    const herramienta = herramientas.find(h => h.id === id);
    if (!herramienta) return;
    
    herramientaSeleccionadaEliminar = herramienta;
    
    // Verificar stock
    const stockTotal = calcularStockTotalHerramienta(id);
    const tieneStock = stockTotal > 0;
    
    let advertenciaHtml = '';
    if (tieneStock) {
        advertenciaHtml = `
            <div class="alert alert-warning mt-2 mb-0">
                <i class="fas fa-exclamation-circle me-1"></i>
                <strong>¡Atención!</strong> Esta herramienta tiene stock activo (${stockTotal} unidades).
                Se recomienda liquidar el stock antes de eliminarla.
            </div>
        `;
    }

    const codigoMostrar = herramienta.codigo || herramienta.id.substring(0, 8).toUpperCase();

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="fw-bold mb-1">${herramienta.nombre}</h6>
                <p class="mb-1 text-muted small">ID: ${codigoMostrar}</p>
                <p class="mb-0 text-muted small">Precio: ${formatearColones(herramienta.precioUnitario || 0)}</p>
            </div>
            <span class="badge ${herramienta.activo !== false ? 'bg-success' : 'bg-secondary'}">
                ${herramienta.activo !== false ? 'Activo' : 'Inactivo'}
            </span>
        </div>
        ${advertenciaHtml}
    `;
    
    btnEliminar.disabled = false;
}

window.mostrarModalEliminacionHerramienta = function() {
    const modal = new bootstrap.Modal(document.getElementById('modalEliminarHerramienta'));
    actualizarSelectEliminarHerramienta(); // Refrescar lista
    modal.show();
};

window.confirmarEliminacionHerramienta = async function() {
    if (!herramientaSeleccionadaEliminar) return;
    
    if (!confirm(`¿Estás SEGURO de que deseas eliminar permanentemente la herramienta "${herramientaSeleccionadaEliminar.nombre}"? Esta acción NO se puede deshacer.`)) {
        return;
    }
    
    const btnEliminar = document.getElementById('btnConfirmarEliminarHerramienta');
    const textoOriginal = btnEliminar.innerHTML;
    btnEliminar.disabled = true;
    btnEliminar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Eliminando...';
    
    try {
        // 1. Eliminar registros de stock asociados
        const stockRef = collection(db, 'stock_bodegas');
        const qStock = query(stockRef, where('herramientaId', '==', herramientaSeleccionadaEliminar.id));
        const snapshotStock = await getDocs(qStock);
        
        const deletePromises = snapshotStock.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // 2. Eliminar herramienta
        await deleteDoc(doc(db, 'herramientas', herramientaSeleccionadaEliminar.id));
        
        mostrarMensaje('Herramienta y sus registros de stock eliminados correctamente', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEliminarHerramienta'));
        modal.hide();
        
        // Resetear selección
        document.getElementById('herramientaEliminar').value = '';
        document.getElementById('infoHerramientaEliminar').innerHTML = '<div class="text-muted">Selecciona una herramienta para ver su información</div>';
        
    } catch (error) {
        console.error('Error eliminando herramienta:', error);
        mostrarMensaje('Error al eliminar herramienta: ' + error.message, 'danger');
    } finally {
        btnEliminar.disabled = false;
        btnEliminar.innerHTML = textoOriginal;
    }
};

// Función para actualizar resumen pivot
function actualizarResumenPivot() {
    const tbody = document.getElementById('tablaResumenPivot');
    if (!tbody) return;
    
    if (productos.length === 0 && herramientas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Cargando datos...</td></tr>';
        return;
    }
    
    // Agrupar productos por categoría
    const productosPorCategoria = {};
    productos.forEach(p => {
        let categoria = p.categoria || 'Sin categoría';
        
        // Normalizar categorías antiguas: "Insumos" -> "Insumos Gastables"
        if (categoria === 'Insumos') {
            categoria = 'Insumos Gastables (corregir)';
        }
        
        if (!productosPorCategoria[categoria]) {
            productosPorCategoria[categoria] = {
                productos: [],
                stockTotal: 0
            };
        }
        productosPorCategoria[categoria].productos.push(p);
        const stock = calcularStockTotalProducto(p.id);
        productosPorCategoria[categoria].stockTotal += stock;
    });
    
    // Calcular totales de herramientas
    const stockTotalHerramientas = herramientas.reduce((sum, h) => {
        return sum + calcularStockTotalHerramienta(h.id);
    }, 0);
    
    // Obtener todas las categorías únicas
    const categorias = Object.keys(productosPorCategoria).sort();
    
    tbody.innerHTML = '';
    
    let totalProductosCount = 0;
    let totalProductosStock = 0;
    let totalHerramientasCount = herramientas.length;
    let totalHerramientasStock = stockTotalHerramientas;
    
    // Primero mostrar todas las categorías de productos
    categorias.forEach(categoria => {
        const tr = document.createElement('tr');
        const datos = productosPorCategoria[categoria];
        const count = datos.productos.length;
        const stock = datos.stockTotal;
        
        totalProductosCount += count;
        totalProductosStock += stock;
        
        // Si la categoría es "Herramientas", aclarar que son PRODUCTOS mal clasificados
        const esCategoriaHerramientas = categoria === 'Herramientas';
        // Si la categoría contiene "(corregir)", es una categoría antigua que debe normalizarse
        const necesitaCorreccion = categoria.includes('(corregir)');
        const nombreMostrar = esCategoriaHerramientas 
            ? 'Herramientas (Productos mal clasificados)' 
            : categoria.replace(' (corregir)', '');
        
        tr.className = esCategoriaHerramientas ? 'table-danger' : (necesitaCorreccion ? 'table-warning' : '');
        tr.innerHTML = `
            <td class="align-middle">
                <i class="fas fa-box me-2 text-primary"></i>${nombreMostrar}
                <br><small class="text-muted fw-normal">(Colección: <code>productos</code>, ID: <code>productoId</code>)</small>
                ${esCategoriaHerramientas ? '<br><small class="text-danger fw-bold">⚠️ Estos son productos, deberían estar en la colección de herramientas</small>' : ''}
                ${necesitaCorreccion ? '<br><small class="text-warning fw-bold">⚠️ Categoría antigua "Insumos" - Debe cambiarse a "Insumos Gastables"</small>' : ''}
            </td>
            <td class="text-center fw-bold bg-primary bg-opacity-10">${count}</td>
            <td class="text-center fw-bold bg-primary bg-opacity-10">${stock.toFixed(2)}</td>
            <td class="text-center bg-light">-</td>
            <td class="text-center bg-light">-</td>
            <td class="text-center fw-bold">${count}</td>
            <td class="text-center fw-bold">${stock.toFixed(2)}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    // Luego mostrar la colección de herramientas (separada y claramente identificada)
    const trHerramientas = document.createElement('tr');
    trHerramientas.className = 'table-warning';
    trHerramientas.innerHTML = `
        <td class="align-middle fw-bold">
            <i class="fas fa-tools me-2 text-warning"></i>Herramientas (Colección)
            <br><small class="text-muted fw-normal">(Colección: <code>herramientas</code>, ID: <code>herramientaId</code>)</small>
            <br><small class="text-success fw-bold">✅ Esta es la colección correcta de herramientas</small>
        </td>
        <td class="text-center bg-light">-</td>
        <td class="text-center bg-light">-</td>
        <td class="text-center fw-bold bg-warning bg-opacity-10">${herramientas.length}</td>
        <td class="text-center fw-bold bg-warning bg-opacity-10">${stockTotalHerramientas.toFixed(2)}</td>
        <td class="text-center fw-bold">${herramientas.length}</td>
        <td class="text-center fw-bold">${stockTotalHerramientas.toFixed(2)}</td>
    `;
    tbody.appendChild(trHerramientas);
    
    // Actualizar totales en el footer
    const filaTotales = document.getElementById('filaTotalesPivot');
    if (filaTotales) {
        filaTotales.innerHTML = `
            <td class="align-middle fw-bold">
                <i class="fas fa-calculator me-2"></i>TOTALES
                <br><small class="text-muted fw-normal">Suma de todos los items</small>
            </td>
            <td class="text-center fw-bold bg-primary bg-opacity-10">
                ${totalProductosCount}
                <br><small class="text-muted fw-normal">items con <code>productoId</code></small>
            </td>
            <td class="text-center fw-bold bg-primary bg-opacity-10">
                ${totalProductosStock.toFixed(2)}
                <br><small class="text-muted fw-normal">unidades totales</small>
            </td>
            <td class="text-center fw-bold bg-warning bg-opacity-10">
                ${totalHerramientasCount}
                <br><small class="text-muted fw-normal">items con <code>herramientaId</code></small>
            </td>
            <td class="text-center fw-bold bg-warning bg-opacity-10">
                ${totalHerramientasStock.toFixed(2)}
                <br><small class="text-muted fw-normal">unidades totales</small>
            </td>
            <td class="text-center fw-bold">
                ${totalProductosCount + totalHerramientasCount}
                <br><small class="text-muted fw-normal">total items</small>
            </td>
            <td class="text-center fw-bold">
                ${(totalProductosStock + totalHerramientasStock).toFixed(2)}
                <br><small class="text-muted fw-normal">stock global</small>
            </td>
        `;
    }
    
    // Detectar posibles duplicados
    detectarDuplicados();
}

// Función para detectar duplicados entre productos y herramientas
function detectarDuplicados() {
    const duplicados = [];
    const listaDuplicados = document.getElementById('listaDuplicados');
    const contenedorDuplicados = document.getElementById('duplicadosDetectados');
    const sinDuplicados = document.getElementById('sinDuplicados');
    
    if (!listaDuplicados || !contenedorDuplicados || !sinDuplicados) return;
    
    // Normalizar nombres para comparación (minúsculas, sin espacios extra)
    const normalizar = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    
    productos.forEach(p => {
        const nombreNormalizado = normalizar(p.nombre);
        
        herramientas.forEach(h => {
            const nombreHerramientaNormalizado = normalizar(h.nombre);
            
            // Detectar si son muy similares (mismo nombre normalizado o muy parecido)
            if (nombreNormalizado === nombreHerramientaNormalizado) {
                duplicados.push({
                    tipo: 'exacto',
                    producto: p,
                    herramienta: h
                });
            } else if (
                nombreNormalizado.includes(nombreHerramientaNormalizado) ||
                nombreHerramientaNormalizado.includes(nombreNormalizado)
            ) {
                // Uno contiene al otro (ej: "TERMONEBULIZADORA" vs "Termonebulizadora")
                duplicados.push({
                    tipo: 'similar',
                    producto: p,
                    herramienta: h
                });
            }
        });
    });
    
    if (duplicados.length > 0) {
        listaDuplicados.innerHTML = '';
        duplicados.forEach(dup => {
            const li = document.createElement('li');
            li.className = 'mb-2';
            li.innerHTML = `
                <strong>Producto:</strong> "${dup.producto.nombre}" (ID: ${dup.producto.id}, Categoría: ${dup.producto.categoria || 'N/A'})<br>
                <strong>Herramienta:</strong> "${dup.herramienta.nombre}" (ID: ${dup.herramienta.id})<br>
                <span class="badge ${dup.tipo === 'exacto' ? 'bg-danger' : 'bg-warning'}">${dup.tipo === 'exacto' ? 'Duplicado Exacto' : 'Posible Duplicado'}</span>
            `;
            listaDuplicados.appendChild(li);
        });
        contenedorDuplicados.style.display = 'block';
        sinDuplicados.style.display = 'none';
    } else {
        contenedorDuplicados.style.display = 'none';
        sinDuplicados.style.display = 'block';
    }
    
    // Actualizar JSON después de detectar duplicados
    actualizarJSON();
}

// Función para generar y actualizar el JSON de datos
function actualizarJSON() {
    const textarea = document.getElementById('jsonDatos');
    if (!textarea) return;
    
    // Preparar datos de productos con stock
    const productosConStock = productos.map(p => ({
        id: p.id,
        codigo: p.codigo || '',
        nombre: p.nombre || '',
        categoria: p.categoria || 'Sin categoría',
        unidad: p.unidad || '',
        precio: p.precio || 0,
        stockMinimo: p.stockMinimo || 0,
        stockActual: calcularStockTotalProducto(p.id),
        activo: p.activo !== false
    }));
    
    // Preparar datos de herramientas con stock
    const herramientasConStock = herramientas.map(h => ({
        id: h.id,
        nombre: h.nombre || '',
        precio: h.precio || 0,
        stockActual: calcularStockTotalHerramienta(h.id),
        activo: h.activo !== false
    }));
    
    // Agrupar productos por categoría
    const productosPorCategoria = {};
    productosConStock.forEach(p => {
        const cat = p.categoria;
        if (!productosPorCategoria[cat]) {
            productosPorCategoria[cat] = [];
        }
        productosPorCategoria[cat].push(p);
    });
    
    // Detectar duplicados
    const normalizar = (str) => str.toLowerCase().trim().replace(/\s+/g, ' ');
    const duplicados = [];
    
    productosConStock.forEach(p => {
        const nombreNormalizado = normalizar(p.nombre);
        herramientasConStock.forEach(h => {
            const nombreHerramientaNormalizado = normalizar(h.nombre);
            if (nombreNormalizado === nombreHerramientaNormalizado) {
                duplicados.push({
                    tipo: 'exacto',
                    producto: { id: p.id, nombre: p.nombre, categoria: p.categoria },
                    herramienta: { id: h.id, nombre: h.nombre }
                });
            } else if (
                nombreNormalizado.includes(nombreHerramientaNormalizado) ||
                nombreHerramientaNormalizado.includes(nombreNormalizado)
            ) {
                duplicados.push({
                    tipo: 'similar',
                    producto: { id: p.id, nombre: p.nombre, categoria: p.categoria },
                    herramienta: { id: h.id, nombre: h.nombre }
                });
            }
        });
    });
    
    // Estructura completa del JSON
    const datosCompletos = {
        fechaGeneracion: new Date().toISOString(),
        resumen: {
            totalProductos: productosConStock.length,
            totalHerramientas: herramientasConStock.length,
            totalItems: productosConStock.length + herramientasConStock.length,
            stockTotalProductos: productosConStock.reduce((sum, p) => sum + p.stockActual, 0),
            stockTotalHerramientas: herramientasConStock.reduce((sum, h) => sum + h.stockActual, 0),
            stockTotalGlobal: productosConStock.reduce((sum, p) => sum + p.stockActual, 0) + 
                             herramientasConStock.reduce((sum, h) => sum + h.stockActual, 0)
        },
        productosPorCategoria: productosPorCategoria,
        productos: productosConStock,
        herramientas: herramientasConStock,
        duplicados: duplicados,
        estadisticas: {
            categoriasProductos: Object.keys(productosPorCategoria).length,
            productosActivos: productosConStock.filter(p => p.activo).length,
            productosInactivos: productosConStock.filter(p => !p.activo).length,
            herramientasActivas: herramientasConStock.filter(h => h.activo).length,
            herramientasInactivas: herramientasConStock.filter(h => !h.activo).length,
            productosConStockCero: productosConStock.filter(p => p.stockActual === 0).length,
            herramientasConStockCero: herramientasConStock.filter(h => h.stockActual === 0).length
        }
    };
    
    // Formatear y mostrar JSON
    textarea.value = JSON.stringify(datosCompletos, null, 2);
}

// Función para copiar JSON al portapapeles
window.copiarJSON = function() {
    const textarea = document.getElementById('jsonDatos');
    const mensaje = document.getElementById('mensajeCopia');
    
    if (!textarea || !textarea.value) {
        alert('No hay datos para copiar. Primero actualiza el JSON.');
        return;
    }
    
    textarea.select();
    textarea.setSelectionRange(0, 99999); // Para móviles
    
    try {
        document.execCommand('copy');
        if (mensaje) {
            mensaje.style.display = 'inline';
            setTimeout(() => {
                mensaje.style.display = 'none';
            }, 3000);
        }
    } catch (err) {
        // Fallback: usar Clipboard API si está disponible
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textarea.value).then(() => {
                if (mensaje) {
                    mensaje.style.display = 'inline';
                    setTimeout(() => {
                        mensaje.style.display = 'none';
                    }, 3000);
                }
            }).catch(err => {
                console.error('Error copiando:', err);
                alert('Error al copiar. Por favor, selecciona y copia manualmente.');
            });
        } else {
            alert('No se pudo copiar automáticamente. Por favor, selecciona y copia manualmente.');
        }
    }
};

// Función global para actualizar JSON
window.actualizarJSON = actualizarJSON;


