import { auth, db } from './auth-secure.js';
import { procesarMovimientoInventario } from './inventario-movimientos-utils.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    where,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let bodegas = [];
let productos = [];
let cuentasGasto = [];
let proveedores = [];
let stockBodegas = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarDatos();
        setupListeners();
    } catch (error) {
        console.error('Error inicializando transferencias:', error);
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
    // Listener para búsqueda de productos en transferencia
    const inputBusqueda = document.getElementById('buscarProductoTransferencia');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', filtrarProductosTransferencia);
    }
    
    // Listener para formulario de transferencia
    const formTransferencia = document.getElementById('formTransferencia');
    if (formTransferencia) {
        formTransferencia.addEventListener('submit', function(e) {
            e.preventDefault();
            registrarTransferencia();
        });
    }
    
    // Listener para cálculo de totales en compra
    const inputCantidadCompra = document.getElementById('cantidadCompra');
    const inputPrecioCompra = document.getElementById('precioCompra');
    
    if (inputCantidadCompra) inputCantidadCompra.addEventListener('input', calcularTotalCompra);
    if (inputPrecioCompra) inputPrecioCompra.addEventListener('input', calcularTotalCompra);
    
    // Listener para selección de producto en compra (cargar precio)
    const selectProductoCompra = document.getElementById('productoCompra');
    if (selectProductoCompra) {
        selectProductoCompra.addEventListener('change', function() {
            const producto = productos.find(p => p.id === this.value);
            if (producto && producto.precioUnitario) {
                document.getElementById('precioCompra').value = producto.precioUnitario;
                calcularTotalCompra();
            }
        });
    }
}

// Cargar datos
function cargarDatos() {
    // Bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        llenarSelectsBodegas();
    });

    // Productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        llenarSelectProductos();
    });
    
    // Cuentas Gasto
    onSnapshot(query(collection(db, 'cuentas_gasto'), orderBy('nombre')), (snapshot) => {
        cuentasGasto = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        llenarSelectDestinosTransferencia();
    });
    
    // Proveedores
    onSnapshot(query(collection(db, 'proveedores'), orderBy('nombre')), (snapshot) => {
        proveedores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        llenarSelectProveedores();
    });
    
    // Stock (para validaciones)
    onSnapshot(collection(db, 'stock_bodegas'), (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Movimientos recientes (para reversiones)
    // Solo cargamos una muestra para el select, luego se puede buscar más si es necesario
    cargarMovimientosParaReversion();
}

function llenarSelectsBodegas() {
    const selectOrigen = document.getElementById('bodegaOrigenTransferencia');
    const selectBodegaCompra = document.getElementById('bodegaCompra');
    const selectBodegaDestinoReversion = document.getElementById('bodegaDestinoReversion');
    
    const llenar = (select) => {
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar bodega...</option>';
        bodegas.forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.nombre;
            select.appendChild(option);
        });
    };
    
    llenar(selectOrigen);
    llenar(selectBodegaCompra);
    llenar(selectBodegaDestinoReversion);
    
    llenarSelectDestinosTransferencia();
}

function llenarSelectDestinosTransferencia() {
    const selectDestino = document.getElementById('bodegaDestinoTransferencia');
    if (!selectDestino) return;
    
    selectDestino.innerHTML = '<option value="">Selecciona el destino...</option>';
    
    // Grupo Bodegas
    const groupBodegas = document.createElement('optgroup');
    groupBodegas.label = "🏢 Bodegas";
    bodegas.forEach(b => {
        const option = document.createElement('option');
        option.value = b.id;
        option.textContent = b.nombre;
        groupBodegas.appendChild(option);
    });
    selectDestino.appendChild(groupBodegas);
    
    // Grupo Cuentas Gasto
    const groupGastos = document.createElement('optgroup');
    groupGastos.label = "💰 Cuentas de Gasto";
    cuentasGasto.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nombre;
        groupGastos.appendChild(option);
    });
    selectDestino.appendChild(groupGastos);
}

function llenarSelectProductos() {
    const selectCompra = document.getElementById('productoCompra');
    if (selectCompra) {
        selectCompra.innerHTML = '<option value="">Seleccionar producto...</option>';
        productos.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nombre;
            selectCompra.appendChild(option);
        });
    }
    // El select de transferencia se llena dinámicamente al buscar o seleccionar bodegas
}

function llenarSelectProveedores() {
    const select = document.getElementById('proveedorCompra');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    proveedores.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
    });
}

function calcularTotalCompra() {
    const cant = parseFloat(document.getElementById('cantidadCompra').value) || 0;
    const precio = parseFloat(document.getElementById('precioCompra').value) || 0;
    document.getElementById('totalCompra').value = (cant * precio).toFixed(2);
}

// Lógica de Transferencia
window.registrarTransferencia = async function() {
    const origenId = document.getElementById('bodegaOrigenTransferencia').value;
    const destinoId = document.getElementById('bodegaDestinoTransferencia').value;
    const productoId = document.getElementById('productoTransferencia').value;
    const cantidad = parseFloat(document.getElementById('cantidadTransferencia').value);
    const motivo = document.getElementById('motivoTransferencia').value;
    const observaciones = document.getElementById('observacionesTransferencia').value;
    
    if (!origenId || !destinoId || !productoId || !cantidad || cantidad <= 0) {
        mostrarMensaje('Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
    if (origenId === destinoId) {
        mostrarMensaje('El origen y destino no pueden ser iguales', 'warning');
        return;
    }
    
    // Validar stock
    const stockItem = stockBodegas.find(s => s.bodegaId === origenId && s.productoId === productoId);
    const stockDisponible = stockItem ? parseFloat(stockItem.stockActual) : 0;
    
    if (cantidad > stockDisponible) {
        mostrarMensaje(`Stock insuficiente. Disponible: ${stockDisponible}`, 'danger');
        return;
    }
    
    // Determinar tipo (transferencia o gasto)
    const esGasto = cuentasGasto.some(c => c.id === destinoId);
    const tipo = esGasto ? 'gasto' : 'transferencia';
    
    try {
        const user = auth.currentUser;
        const movimientoData = {
            fecha: serverTimestamp(),
            tipo: tipo,
            productoId: productoId,
            origen: origenId,
            destino: destinoId,
            cantidad: cantidad,
            motivo: motivo,
            observaciones: observaciones,
            usuarioId: user.uid,
            empleado: user.email, // O username si estuviera disponible
            fechaRegistro: serverTimestamp()
        };
        
        // Obtener precio promedio si es posible (para valorizar el gasto/transferencia)
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            movimientoData.precioUnitario = producto.precioUnitario;
            movimientoData.total = cantidad * producto.precioUnitario;
        }
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, movimientoData, 'producto');
        
        mostrarMensaje('Transferencia registrada con éxito', 'success');
        document.getElementById('formTransferencia').reset();
        
    } catch (error) {
        console.error('Error registrando transferencia:', error);
        mostrarMensaje('Error al registrar transferencia: ' + error.message, 'danger');
    }
};

// Lógica de Compra
window.registrarCompra = async function() {
    if (!validarFormulario('formCompra', ['productoCompra', 'bodegaCompra', 'cantidadCompra', 'precioCompra', 'facturaCompra', 'proveedorCompra'])) {
        return;
    }
    
    try {
        const user = auth.currentUser;
        const compraData = {
            fecha: serverTimestamp(),
            tipo: 'compra',
            productoId: document.getElementById('productoCompra').value,
            origen: document.getElementById('proveedorCompra').value, // Proveedor es el origen
            destino: document.getElementById('bodegaCompra').value,
            cantidad: parseFloat(document.getElementById('cantidadCompra').value),
            precioUnitario: parseFloat(document.getElementById('precioCompra').value),
            total: parseFloat(document.getElementById('totalCompra').value),
            numeroFactura: document.getElementById('facturaCompra').value,
            observaciones: document.getElementById('observacionesCompra').value,
            usuarioId: user.uid,
            empleado: user.email,
            fechaRegistro: serverTimestamp()
        };
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, compraData, 'producto');
        
        mostrarMensaje('Compra registrada con éxito', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalRegistrarCompra'));
        modal.hide();
        document.getElementById('formCompra').reset();
        
    } catch (error) {
        console.error('Error registrando compra:', error);
        mostrarMensaje('Error al registrar compra: ' + error.message, 'danger');
    }
};

// Lógica de Reversión
async function cargarMovimientosParaReversion() {
    // Cargar movimientos recientes (gasto o compra) para llenar el select
    // Limitamos a 100 para no saturar, idealmente debería ser un buscador asíncrono
    const q = query(
        collection(db, 'movimientos_inventario'),
        where('tipo', 'in', ['gasto', 'compra']),
        orderBy('fecha', 'desc'),
        limit(100)
    );
    
    onSnapshot(q, (snapshot) => {
        const select = document.getElementById('gastoReversar');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccionar gasto o compra...</option>';
        
        snapshot.forEach(doc => {
            const m = doc.data();
            const producto = productos.find(p => p.id === m.productoId);
            const prodNombre = producto ? producto.nombre : 'Producto desconocido';
            const fecha = m.fecha?.toDate ? m.fecha.toDate().toLocaleDateString() : 'Fecha desconocida';
            const tipo = m.tipo === 'gasto' ? 'Gasto' : 'Compra';
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${tipo} | ${fecha} | ${prodNombre} (${m.cantidad}) | ${m.empleado || ''}`;
            // Guardamos data para usar al seleccionar
            option.dataset.tipo = m.tipo;
            option.dataset.cantidad = m.cantidad;
            option.dataset.productoId = m.productoId;
            select.appendChild(option);
        });
    });
}

window.reversarGasto = async function() {
    const movimientoId = document.getElementById('gastoReversar').value;
    const bodegaDestino = document.getElementById('bodegaDestinoReversion').value;
    const motivo = document.getElementById('motivoReversion').value;
    const observaciones = document.getElementById('observacionesReversion').value;
    
    if (!movimientoId || !bodegaDestino || !motivo) {
        mostrarMensaje('Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
    const select = document.getElementById('gastoReversar');
    const option = select.options[select.selectedIndex];
    const tipoOriginal = option.dataset.tipo;
    const cantidad = parseFloat(option.dataset.cantidad);
    const productoId = option.dataset.productoId;
    
    try {
        const user = auth.currentUser;
        const reversionData = {
            fecha: serverTimestamp(),
            tipo: 'reversion',
            productoId: productoId,
            origen: movimientoId, // Referencia al movimiento original (aunque en UI mostramos proveedor/cuenta)
            destino: bodegaDestino, // Vuelve a una bodega
            cantidad: cantidad,
            motivo: motivo,
            observaciones: observaciones,
            usuarioId: user.uid,
            empleado: user.email,
            fechaRegistro: serverTimestamp(),
            // Metadatos para trazabilidad correcta (Fix de reversiones)
            tipoOriginal: tipoOriginal,
            tipoMovimientoOriginal: tipoOriginal,
            movimientoOriginalId: movimientoId
        };
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, reversionData, 'producto');
        
        mostrarMensaje('Reversión realizada con éxito', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalReversarGasto'));
        modal.hide();
        document.getElementById('formReversarGasto').reset();
        
    } catch (error) {
        console.error('Error al reversar:', error);
        mostrarMensaje('Error al realizar reversión: ' + error.message, 'danger');
    }
};

// Helpers UI
window.decrementarCantidadTransferencia = function() {
    const input = document.getElementById('cantidadTransferencia');
    const val = parseFloat(input.value) || 0;
    if (val > 1) input.value = val - 1;
};

window.incrementarCantidadTransferencia = function() {
    const input = document.getElementById('cantidadTransferencia');
    const val = parseFloat(input.value) || 0;
    input.value = val + 1;
};

window.limpiarBusquedaProductoTransferencia = function() {
    document.getElementById('buscarProductoTransferencia').value = '';
    filtrarProductosTransferencia();
};

function filtrarProductosTransferencia() {
    const termino = document.getElementById('buscarProductoTransferencia').value.toLowerCase();
    const select = document.getElementById('productoTransferencia');
    
    select.innerHTML = '<option value="">Seleccionar producto...</option>';
    
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(termino) || 
        p.codigo.toLowerCase().includes(termino)
    );
    
    filtrados.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
    });
}

