import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    where,
    limit,
    doc,
    updateDoc,
    getDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { procesarMovimientoInventario, validarStockDisponible, esCuentaGasto, obtenerNombreOrigenDestino as obtenerNombre } from './inventario-movimientos-utils.js';

// Función para formatear colones
function formatearColones(monto) {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(monto);
}

// Variables globales
let bodegas = [];
let bodegasHerramientas = []; // Solo bodegas tipo "herramientas"
let herramientas = [];
let cuentasGasto = [];
let proveedores = [];
let stockBodegas = [];
let movimientos = []; // Historial de movimientos

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarDatos();
        setupListeners();
    } catch (error) {
        console.error('Error inicializando movimientos de herramientas:', error);
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
    // Listener para búsqueda de herramientas en transferencia
    const inputBusqueda = document.getElementById('buscarHerramientaTransferencia');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', filtrarHerramientasTransferencia);
    }
    
    // Listener para formulario de transferencia
    const formTransferencia = document.getElementById('formTransferenciaHerramienta');
    if (formTransferencia) {
        formTransferencia.addEventListener('submit', function(e) {
            e.preventDefault();
            registrarTransferenciaHerramienta();
        });
    }
    
    // Listener para cambio de destino (mostrar/ocultar recibo)
    const selectDestino = document.getElementById('bodegaDestinoHerramienta');
    if (selectDestino) {
        selectDestino.addEventListener('change', function() {
            const esGasto = cuentasGasto.some(c => c.id === this.value);
            const reciboContainer = document.getElementById('reciboHerramientaTransferenciaContainer');
            if (reciboContainer) {
                reciboContainer.style.display = esGasto ? 'block' : 'none';
                if (esGasto) {
                    document.getElementById('reciboHerramientaTransferencia').required = true;
                } else {
                    document.getElementById('reciboHerramientaTransferencia').required = false;
                }
            }
        });
    }
    
    // Listener para cálculo de totales en compra
    const inputCantidadCompra = document.getElementById('cantidadCompraHerramienta');
    const inputPrecioCompra = document.getElementById('precioCompraHerramienta');
    
    if (inputCantidadCompra) inputCantidadCompra.addEventListener('input', calcularTotalCompraHerramienta);
    if (inputPrecioCompra) inputPrecioCompra.addEventListener('input', calcularTotalCompraHerramienta);
    
    // Listener para selección de herramienta en compra (cargar precio y mostrar opción de actualizar)
    const selectHerramientaCompra = document.getElementById('herramientaCompra');
    if (selectHerramientaCompra) {
        selectHerramientaCompra.addEventListener('change', function() {
            const herramienta = herramientas.find(h => h.id === this.value);
            const precioActualDiv = document.getElementById('precioActualHerramientaCompra');
            const precioActualValor = document.getElementById('precioActualHerramientaCompraValor');
            const alertActualizar = document.getElementById('alertActualizarPrecioHerramientaCompra');
            
            if (herramienta) {
                // Mostrar precio actual
                if (herramienta.precioUnitario) {
                    precioActualValor.textContent = formatearColones(herramienta.precioUnitario);
                    precioActualDiv.style.display = 'block';
                    // Pre-llenar con precio actual
                    document.getElementById('precioCompraHerramienta').value = herramienta.precioUnitario;
                } else {
                    precioActualDiv.style.display = 'none';
                }
                
                // Mostrar alerta de actualización solo si hay herramienta seleccionada
                if (alertActualizar) {
                    alertActualizar.style.display = 'block';
                }
                
                calcularTotalCompraHerramienta();
            } else {
                precioActualDiv.style.display = 'none';
                if (alertActualizar) {
                    alertActualizar.style.display = 'none';
                }
            }
        });
    }
}

// Cargar datos
function cargarDatos() {
    // Bodegas (solo tipo herramientas)
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        const todasBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        bodegas = todasBodegas;
        bodegasHerramientas = todasBodegas.filter(b => b.tipo === 'herramientas');
        llenarSelectsBodegas();
    });

    // Herramientas
    onSnapshot(query(collection(db, 'herramientas'), orderBy('nombre')), (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        llenarSelectHerramientas();
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
    
    // Stock (para validaciones) - solo de bodegas herramientas
    onSnapshot(collection(db, 'stock_bodegas'), (snapshot) => {
        const todosStocks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const bodegasHerramientasIds = bodegasHerramientas.map(b => b.id);
        stockBodegas = todosStocks.filter(s => 
            bodegasHerramientasIds.includes(s.bodegaId) && s.herramientaId
        );
    });
    
    // Movimientos recientes (para reversiones)
    cargarMovimientosParaReversion();
    
    // Cargar historial completo
    cargarHistorialMovimientos();
    
    // Setup filtros
    setupFiltros();
}

function llenarSelectsBodegas() {
    const selectOrigen = document.getElementById('bodegaOrigenHerramienta');
    const selectBodegaCompra = document.getElementById('bodegaCompraHerramienta');
    const selectBodegaDestinoReversion = document.getElementById('bodegaDestinoReversionHerramienta');
    
    const llenar = (select) => {
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar bodega...</option>';
        // Solo mostrar bodegas tipo "herramientas"
        bodegasHerramientas.forEach(b => {
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
    const selectDestino = document.getElementById('bodegaDestinoHerramienta');
    if (!selectDestino) return;
    
    selectDestino.innerHTML = '<option value="">Selecciona el destino...</option>';
    
    // Grupo Bodegas de Herramientas
    const groupBodegas = document.createElement('optgroup');
    groupBodegas.label = "🔧 Bodegas de Herramientas";
    bodegasHerramientas.forEach(b => {
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

function llenarSelectHerramientas() {
    const selectCompra = document.getElementById('herramientaCompra');
    if (selectCompra) {
        selectCompra.innerHTML = '<option value="">Seleccionar herramienta...</option>';
        herramientas.forEach(h => {
            const option = document.createElement('option');
            option.value = h.id;
            option.textContent = h.nombre;
            selectCompra.appendChild(option);
        });
    }
}

function llenarSelectProveedores() {
    const select = document.getElementById('proveedorCompraHerramienta');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    proveedores.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        select.appendChild(option);
    });
}

function calcularTotalCompraHerramienta() {
    const cant = parseFloat(document.getElementById('cantidadCompraHerramienta').value) || 0;
    const precio = parseFloat(document.getElementById('precioCompraHerramienta').value) || 0;
    document.getElementById('totalCompraHerramienta').value = (cant * precio).toFixed(2);
}

// Lógica de Transferencia de Herramienta
window.registrarTransferenciaHerramienta = async function() {
    const origenId = document.getElementById('bodegaOrigenHerramienta').value;
    const destinoId = document.getElementById('bodegaDestinoHerramienta').value;
    const herramientaId = document.getElementById('herramientaTransferencia').value;
    const cantidad = parseInt(document.getElementById('cantidadHerramientaTransferencia').value);
    const motivo = document.getElementById('motivoHerramientaTransferencia').value;
    const observaciones = document.getElementById('observacionesHerramientaTransferencia').value;
    const recibo = document.getElementById('reciboHerramientaTransferencia').value;
    
    if (!origenId || !destinoId || !herramientaId || !cantidad || cantidad <= 0) {
        mostrarMensaje('Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
    if (origenId === destinoId) {
        mostrarMensaje('El origen y destino no pueden ser iguales', 'warning');
        return;
    }
    
    // Determinar tipo (transferencia o gasto)
    const esGasto = esCuentaGasto(destinoId, cuentasGasto);
    const tipo = esGasto ? 'gasto' : 'transferencia';
    
    if (esGasto && !recibo) {
        mostrarMensaje('El número de recibo es obligatorio para gastos', 'warning');
        return;
    }
    
    try {
        // Validar stock disponible
        const validacionStock = await validarStockDisponible(db, origenId, herramientaId, cantidad, 'herramienta');
        
        if (!validacionStock.valido) {
            mostrarMensaje(`Stock insuficiente. Disponible: ${validacionStock.stockDisponible}`, 'danger');
            return;
        }
        
        const user = auth.currentUser;
        const movimientoData = {
            fecha: serverTimestamp(),
            tipo: tipo,
            herramientaId: herramientaId, // Campo específico de herramientas
            tipoItem: 'herramienta', // Campo para diferenciación en reportes
            origen: origenId,
            destino: destinoId,
            cantidad: cantidad,
            motivo: motivo || null,
            observaciones: observaciones || null,
            usuarioId: user.uid,
            empleado: user.email,
            fechaRegistro: serverTimestamp()
        };
        
        if (esGasto && recibo) {
            movimientoData.recibo = parseInt(recibo);
        }
        
        // Obtener precio si es posible
        const herramienta = herramientas.find(h => h.id === herramientaId);
        if (herramienta && herramienta.precioUnitario) {
            movimientoData.precioUnitario = herramienta.precioUnitario;
            movimientoData.total = cantidad * herramienta.precioUnitario;
        }
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, movimientoData, 'herramienta');
        
        mostrarMensaje('Transferencia de herramienta registrada con éxito', 'success');
        document.getElementById('formTransferenciaHerramienta').reset();
        document.getElementById('reciboHerramientaTransferenciaContainer').style.display = 'none';
        
        // El historial se actualizará automáticamente por el listener
        
    } catch (error) {
        console.error('Error registrando transferencia de herramienta:', error);
        mostrarMensaje('Error al registrar transferencia: ' + error.message, 'danger');
    }
};

// Lógica de Compra de Herramienta
window.registrarCompraHerramienta = async function() {
    if (!validarFormulario('formCompraHerramienta', ['herramientaCompra', 'bodegaCompraHerramienta', 'cantidadCompraHerramienta', 'precioCompraHerramienta', 'facturaCompraHerramienta', 'proveedorCompraHerramienta'])) {
        return;
    }
    
    try {
        const user = auth.currentUser;
        const herramientaId = document.getElementById('herramientaCompra').value;
        const bodegaDestinoId = document.getElementById('bodegaCompraHerramienta').value;
        const cantidad = parseInt(document.getElementById('cantidadCompraHerramienta').value);
        const precioUnitario = parseFloat(document.getElementById('precioCompraHerramienta').value);
        const total = parseFloat(document.getElementById('totalCompraHerramienta').value);
        const numeroFactura = document.getElementById('facturaCompraHerramienta').value;
        const proveedorId = document.getElementById('proveedorCompraHerramienta').value;
        const observaciones = document.getElementById('observacionesCompraHerramienta').value;
        
        const compraData = {
            fecha: serverTimestamp(),
            tipo: 'compra',
            herramientaId: herramientaId, // Campo específico de herramientas
            tipoItem: 'herramienta', // Campo para diferenciación en reportes
            origen: proveedorId, // Proveedor es el origen
            destino: bodegaDestinoId,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            numeroFactura: numeroFactura,
            observaciones: observaciones || null,
            usuarioId: user.uid,
            empleado: user.email,
            fechaRegistro: serverTimestamp()
        };
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, compraData, 'herramienta');
        
        // Actualizar precio de la herramienta si el checkbox está marcado
        const actualizarPrecio = document.getElementById('actualizarPrecioHerramientaCompra')?.checked ?? true;
        if (actualizarPrecio) {
            await updateDoc(doc(db, 'herramientas', herramientaId), {
                precioUnitario: precioUnitario,
                fechaActualizacion: serverTimestamp(),
                usuarioActualizacion: auth.currentUser.email
            });
            console.log('✅ Precio de la herramienta actualizado en catálogo');
        }
        
        mostrarMensaje('Compra de herramienta registrada con éxito' + (actualizarPrecio ? ' y precio actualizado' : ''), 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalRegistrarCompraHerramienta'));
        modal.hide();
        document.getElementById('formCompraHerramienta').reset();
        // Ocultar alertas al resetear
        document.getElementById('precioActualHerramientaCompra').style.display = 'none';
        document.getElementById('alertActualizarPrecioHerramientaCompra').style.display = 'none';
        
        // El historial se actualizará automáticamente por el listener
        
    } catch (error) {
        console.error('Error registrando compra de herramienta:', error);
        mostrarMensaje('Error al registrar compra: ' + error.message, 'danger');
    }
};

// Lógica de Reversión
async function cargarMovimientosParaReversion() {
    // Usar consulta sin filtro de tipo para evitar problemas de índice
    // Filtrar en cliente después
    const q = query(
        collection(db, 'movimientos_inventario'),
        orderBy('fecha', 'desc'),
        limit(200)
    );
    
    onSnapshot(q, (snapshot) => {
        const select = document.getElementById('gastoReversarHerramienta');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccionar gasto o compra...</option>';
        
        snapshot.forEach(doc => {
            const m = doc.data();
            // Filtrar: solo gastos/compras de herramientas
            if (m.tipo !== 'gasto' && m.tipo !== 'compra') return;
            // Solo mostrar movimientos de herramientas (tienen herramientaId y NO tienen productoId)
            if (!m.herramientaId || m.productoId) return;
            
            const herramienta = herramientas.find(h => h.id === m.herramientaId);
            const herramientaNombre = herramienta ? herramienta.nombre : 'Herramienta desconocida';
            const fecha = m.fecha?.toDate ? m.fecha.toDate().toLocaleDateString() : 'Fecha desconocida';
            const tipo = m.tipo === 'gasto' ? 'Gasto' : 'Compra';
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${tipo} | ${fecha} | ${herramientaNombre} (${m.cantidad}) | ${m.empleado || ''}`;
            option.dataset.tipo = m.tipo;
            option.dataset.cantidad = m.cantidad;
            option.dataset.herramientaId = m.herramientaId;
            select.appendChild(option);
        });
    });
}

window.reversarGastoHerramienta = async function() {
    const movimientoId = document.getElementById('gastoReversarHerramienta').value;
    const bodegaDestino = document.getElementById('bodegaDestinoReversionHerramienta').value;
    const motivo = document.getElementById('motivoReversionHerramienta').value;
    const observaciones = document.getElementById('observacionesReversionHerramienta').value;
    
    if (!movimientoId || !bodegaDestino || !motivo) {
        mostrarMensaje('Por favor completa los campos obligatorios', 'warning');
        return;
    }
    
        const select = document.getElementById('gastoReversarHerramienta');
        const option = select.options[select.selectedIndex];
        const tipoOriginal = option.dataset.tipo;
        const cantidad = parseInt(option.dataset.cantidad);
        const herramientaId = option.dataset.herramientaId;
    
    try {
        const user = auth.currentUser;
        const reversionData = {
            fecha: serverTimestamp(),
            tipo: 'reversion',
            herramientaId: herramientaId, // Campo específico de herramientas
            tipoItem: 'herramienta', // Campo para diferenciación en reportes
            origen: movimientoId,
            destino: bodegaDestino,
            cantidad: cantidad,
            motivo: motivo,
            observaciones: observaciones || null,
            usuarioId: user.uid,
            empleado: user.email,
            fechaRegistro: serverTimestamp(),
            tipoOriginal: tipoOriginal,
            tipoMovimientoOriginal: tipoOriginal,
            movimientoOriginalId: movimientoId
        };
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, reversionData, 'herramienta');
        
        mostrarMensaje('Reversión realizada con éxito', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalReversarGastoHerramienta'));
        modal.hide();
        document.getElementById('formReversarGastoHerramienta').reset();
        
    } catch (error) {
        console.error('Error al reversar:', error);
        mostrarMensaje('Error al realizar reversión: ' + error.message, 'danger');
    }
};

// Helpers UI
window.decrementarCantidadHerramientaTransferencia = function() {
    const input = document.getElementById('cantidadHerramientaTransferencia');
    const val = parseInt(input.value) || 0;
    if (val > 1) input.value = val - 1;
};

window.incrementarCantidadHerramientaTransferencia = function() {
    const input = document.getElementById('cantidadHerramientaTransferencia');
    const val = parseInt(input.value) || 0;
    input.value = val + 1;
};

window.limpiarBusquedaHerramientaTransferencia = function() {
    document.getElementById('buscarHerramientaTransferencia').value = '';
    filtrarHerramientasTransferencia();
};

function filtrarHerramientasTransferencia() {
    const termino = document.getElementById('buscarHerramientaTransferencia').value.toLowerCase();
    const select = document.getElementById('herramientaTransferencia');
    
    select.innerHTML = '<option value="">Seleccionar herramienta...</option>';
    
    const filtradas = herramientas.filter(h => 
        h.nombre.toLowerCase().includes(termino) || 
        (h.codigo && h.codigo.toLowerCase().includes(termino))
    );
    
    filtradas.forEach(h => {
        const option = document.createElement('option');
        option.value = h.id;
        option.textContent = h.nombre;
        select.appendChild(option);
    });
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    let contenedor = document.getElementById('mensajesContainer');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'mensajesContainer';
        contenedor.style.position = 'fixed';
        contenedor.style.top = '80px';
        contenedor.style.right = '20px';
        contenedor.style.zIndex = '9999';
        contenedor.style.maxWidth = '400px';
        document.body.appendChild(contenedor);
    }
    
    const alertClass = {
        'success': 'alert-success',
        'danger': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-info';
    
    const iconClass = {
        'success': 'fa-check-circle',
        'danger': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[tipo] || 'fa-info-circle';
    
    const alert = document.createElement('div');
    alert.className = `alert ${alertClass} alert-dismissible fade show shadow`;
    alert.innerHTML = `
        <i class="fas ${iconClass} me-2"></i>${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    contenedor.appendChild(alert);
    
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Función de validación
function validarFormulario(formId, camposRequeridos) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    let valido = true;
    camposRequeridos.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo && !campo.value.trim()) {
            campo.classList.add('is-invalid');
            valido = false;
        } else if (campo) {
            campo.classList.remove('is-invalid');
        }
    });
    
    if (!valido) {
        mostrarMensaje('Por favor completa todos los campos requeridos', 'warning');
    }
    
    return valido;
}

// Cargar historial de movimientos
function cargarHistorialMovimientos() {
    // Buscar movimientos de herramientas: por tipoItem='herramienta' (nuevo) o herramientaId (legacy)
    const q = query(
        collection(db, 'movimientos_inventario'),
        where('tipoItem', '==', 'herramienta'), // Nuevo sistema unificado
        orderBy('fecha', 'desc'),
        limit(100)
    );
    
    onSnapshot(q, (snapshot) => {
        movimientos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        mostrarHistorialMovimientos();
    }, (error) => {
        // Si falla (índice no creado), usar query legacy
        console.warn('⚠️ Query con tipoItem falló, usando query legacy:', error);
        const qLegacy = query(
            collection(db, 'movimientos_inventario'),
            orderBy('fecha', 'desc'),
            limit(200)
        );
        
        onSnapshot(qLegacy, (snapshot) => {
            // Filtrar solo movimientos de herramientas (tipoItem='herramienta' o herramientaId sin productoId)
            movimientos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(m => 
                    m.tipoItem === 'herramienta' || 
                    (m.herramientaId && !m.productoId)
                );
            mostrarHistorialMovimientos();
        });
    });
}

// Mostrar historial de movimientos
function mostrarHistorialMovimientos() {
    const tbody = document.getElementById('tablaHistorialMovimientos');
    if (!tbody) return;
    
    // Aplicar filtros
    let movimientosFiltrados = [...movimientos];
    
    const filtroTipo = document.getElementById('filtroTipoMovimiento')?.value;
    if (filtroTipo) {
        movimientosFiltrados = movimientosFiltrados.filter(m => m.tipo === filtroTipo);
    }
    
    const filtroHerramienta = document.getElementById('filtroHerramienta')?.value.toLowerCase();
    if (filtroHerramienta) {
        movimientosFiltrados = movimientosFiltrados.filter(m => {
            const herramienta = herramientas.find(h => h.id === m.herramientaId);
            if (!herramienta) return false;
            return herramienta.nombre.toLowerCase().includes(filtroHerramienta) ||
                   (herramienta.codigo && herramienta.codigo.toLowerCase().includes(filtroHerramienta));
        });
    }
    
    const filtroBodega = document.getElementById('filtroBodega')?.value;
    if (filtroBodega) {
        movimientosFiltrados = movimientosFiltrados.filter(m => 
            m.origen === filtroBodega || m.destino === filtroBodega
        );
    }
    
    if (movimientosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <div>No hay movimientos que coincidan con los filtros</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = movimientosFiltrados.map(movimiento => {
        const herramienta = herramientas.find(h => h.id === movimiento.herramientaId);
        const herramientaNombre = herramienta ? herramienta.nombre : 'Herramienta desconocida';
        
        const origenNombre = obtenerNombreOrigenDestino(movimiento.origen);
        const destinoNombre = obtenerNombreOrigenDestino(movimiento.destino);
        
        const fecha = movimiento.fecha?.toDate ? 
            movimiento.fecha.toDate().toLocaleString('es-CR', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            }) : 
            'Fecha desconocida';
        
        const tipoClass = {
            'compra': 'success',
            'transferencia': 'info',
            'gasto': 'danger',
            'reversion': 'warning'
        }[movimiento.tipo] || 'secondary';
        
        const tipoIcon = {
            'compra': 'fa-shopping-cart',
            'transferencia': 'fa-exchange-alt',
            'gasto': 'fa-minus-circle',
            'reversion': 'fa-undo'
        }[movimiento.tipo] || 'fa-circle';
        
        const tipoTexto = {
            'compra': 'Compra',
            'transferencia': 'Transferencia',
            'gasto': 'Gasto',
            'reversion': 'Reversión'
        }[movimiento.tipo] || movimiento.tipo;
        
        return `
            <tr>
                <td>${fecha}</td>
                <td>
                    <span class="badge bg-${tipoClass}">
                        <i class="fas ${tipoIcon} me-1"></i>${tipoTexto}
                    </span>
                </td>
                <td>${escapeHTML(herramientaNombre)}</td>
                <td>${escapeHTML(origenNombre)}</td>
                <td>${escapeHTML(destinoNombre)}</td>
                <td class="text-end">${movimiento.cantidad || 0}</td>
                <td class="text-end">₡${(movimiento.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}</td>
                <td>${escapeHTML(movimiento.empleado || 'N/A')}</td>
            </tr>
        `;
    }).join('');
}

// Helper para obtener nombre de origen/destino (usa función compartida)
function obtenerNombreOrigenDestino(id) {
    return obtenerNombre(id, bodegas, cuentasGasto, proveedores);
}

// Setup filtros
function setupFiltros() {
    // Llenar select de bodegas para filtro
    const selectBodega = document.getElementById('filtroBodega');
    if (selectBodega) {
        bodegasHerramientas.forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.nombre;
            selectBodega.appendChild(option);
        });
    }
    
    // Listeners para filtros
    const filtroTipo = document.getElementById('filtroTipoMovimiento');
    const filtroHerramienta = document.getElementById('filtroHerramienta');
    const filtroBodega = document.getElementById('filtroBodega');
    
    if (filtroTipo) filtroTipo.addEventListener('change', mostrarHistorialMovimientos);
    if (filtroHerramienta) filtroHerramienta.addEventListener('input', mostrarHistorialMovimientos);
    if (filtroBodega) filtroBodega.addEventListener('change', mostrarHistorialMovimientos);
}

// Limpiar filtros
window.limpiarFiltros = function() {
    document.getElementById('filtroTipoMovimiento').value = '';
    document.getElementById('filtroHerramienta').value = '';
    document.getElementById('filtroBodega').value = '';
    mostrarHistorialMovimientos();
};

// Helper para escapar HTML
function escapeHTML(text) {
    if (!text || typeof text !== 'string') {
        return String(text || '');
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

