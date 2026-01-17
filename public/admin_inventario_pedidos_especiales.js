import { auth, db } from './auth-secure.js';
import { procesarMovimientoInventario } from './inventario-movimientos-utils.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    serverTimestamp,
    Timestamp,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let bodegasEspeciales = [];
let productos = [];
let herramientas = [];
let stockBodegas = [];
let bodegaPrincipalId = null; // ID de la bodega principal (para productos)
let bodegaPrincipalHerramientasId = null; // ID de la bodega principal de herramientas
let pedidoActual = {}; // Estructura: { bodegaId: [{ productoId/herramientaId, cantidad, tipoItem }] }

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        // Fecha por defecto mañana
        seleccionarFechaPedido(1);
        
        // Actualizar texto de botones después de un pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            actualizarTextoBotonesFecha();
        }, 100);
        
        await cargarDatos();
        
    } catch (error) {
        console.error('Error inicializando pedidos especiales:', error);
    }
});

// Función para seleccionar fecha del pedido
window.seleccionarFechaPedido = function(diasDesdeHoy) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + diasDesdeHoy);
    
    // Formatear fecha como YYYY-MM-DD
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const fechaStr = `${año}-${mes}-${dia}`;
    
    // Establecer en el input oculto
    document.getElementById('fechaPedidoEspecial').value = fechaStr;
    
    // Actualizar botones activos
    document.querySelectorAll('.btn-fecha').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.dias) === diasDesdeHoy) {
            btn.classList.add('active');
        }
    });
    
    // Actualizar texto de los botones con día de la semana
    actualizarTextoBotonesFecha();
};

// Función para actualizar el texto de los botones con el día de la semana
function actualizarTextoBotonesFecha() {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    document.querySelectorAll('.btn-fecha').forEach(btn => {
        const dias = parseInt(btn.dataset.dias);
        const fecha = new Date();
        fecha.setDate(fecha.getDate() + dias);
        
        const diaSemana = diasSemana[fecha.getDay()];
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        
        let texto = '';
        if (dias === 0) texto = `Hoy - ${diaSemana}`;
        else if (dias === 1) texto = `Mañana - ${diaSemana}`;
        else if (dias === 2) texto = `Pasado Mañana - ${diaSemana}`;
        else texto = `${diaSemana} ${dia} ${mes}`;
        
        btn.textContent = texto;
    });
}

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

async function cargarDatos() {
    // Cargar bodegas tipo 'especial'
    onSnapshot(query(collection(db, 'bodegas'), where('tipo', '==', 'especial')), (snapshot) => {
        bodegasEspeciales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Cargar productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Cargar herramientas
    onSnapshot(query(collection(db, 'herramientas'), orderBy('nombre')), (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Cargar stock de bodegas para validación
    onSnapshot(query(collection(db, 'stock_bodegas')), (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Cargar bodega principal (para productos)
    try {
        const qPrincipal = query(collection(db, 'bodegas'), where('tipo', '==', 'principal'), limit(1));
        const snapshotPrincipal = await getDocs(qPrincipal);
        if (!snapshotPrincipal.empty) {
            bodegaPrincipalId = snapshotPrincipal.docs[0].id;
        }
    } catch (error) {
        console.error('Error cargando bodega principal:', error);
    }
    
    // Cargar bodega principal de herramientas
    try {
        const qPrincipalHerramientas = query(
            collection(db, 'bodegas'), 
            where('tipo', '==', 'herramientas'),
            where('nombre', '==', 'Bodega Principal Herramientas'),
            limit(1)
        );
        const snapshotPrincipalHerramientas = await getDocs(qPrincipalHerramientas);
        if (!snapshotPrincipalHerramientas.empty) {
            bodegaPrincipalHerramientasId = snapshotPrincipalHerramientas.docs[0].id;
        } else {
            // Si no existe con ese nombre exacto, buscar cualquier bodega principal de herramientas
            const qAlternativa = query(
                collection(db, 'bodegas'), 
                where('tipo', '==', 'herramientas'),
                limit(1)
            );
            const snapshotAlternativa = await getDocs(qAlternativa);
            if (!snapshotAlternativa.empty) {
                bodegaPrincipalHerramientasId = snapshotAlternativa.docs[0].id;
            }
        }
    } catch (error) {
        console.error('Error cargando bodega principal de herramientas:', error);
    }
}

// Función para calcular stock de un producto en la bodega principal
function calcularStockBodegaPrincipalProducto(productoId) {
    if (!stockBodegas || stockBodegas.length === 0 || !bodegaPrincipalId) return 0;
    const stock = stockBodegas.find(s => 
        s.bodegaId === bodegaPrincipalId && s.productoId === productoId
    );
    return stock ? (Number(stock.stockActual) || 0) : 0;
}

// Función para calcular stock de una herramienta en la bodega principal de herramientas
function calcularStockBodegaPrincipalHerramienta(herramientaId) {
    if (!stockBodegas || stockBodegas.length === 0 || !bodegaPrincipalHerramientasId) return 0;
    const stock = stockBodegas.find(s => 
        s.bodegaId === bodegaPrincipalHerramientasId && s.herramientaId === herramientaId
    );
    return stock ? (Number(stock.stockActual) || 0) : 0;
}

// Función genérica para calcular stock en bodega principal
function calcularStockBodegaPrincipal(itemId, tipoItem) {
    if (tipoItem === 'herramienta') {
        return calcularStockBodegaPrincipalHerramienta(itemId);
    } else {
        return calcularStockBodegaPrincipalProducto(itemId);
    }
}

window.agregarBodegaEspecialUI = function() {
    const contenedor = document.getElementById('contenedorBodegasEspeciales');
    
    // Limpiar mensaje vacío si existe
    if (contenedor.querySelector('.text-muted')) {
        contenedor.innerHTML = '';
    }
    
    const idUnico = Date.now();
    const cardHtml = `
        <div class="card mb-3" id="card-bodega-${idUnico}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0"><i class="fas fa-warehouse me-2"></i>Bodega Especial</h5>
                <button class="btn btn-sm btn-outline-danger" onclick="removerBodegaUI('${idUnico}')">
                    <i class="fas fa-times me-1"></i> Eliminar
                </button>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <label class="form-label fw-bold">Seleccionar Bodega: *</label>
                    <select class="form-select select-bodega-especial" data-id="${idUnico}">
                        <option value="">Seleccionar bodega especial...</option>
                        ${bodegasEspeciales.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="productos-container mb-3 p-3 bg-light rounded border" id="productos-${idUnico}" style="min-height: 80px;">
                    <!-- Productos aquí -->
                </div>
                <button class="btn btn-outline-primary w-100" onclick="agregarItemUI('${idUnico}')">
                    <i class="fas fa-plus me-2"></i> Agregar Producto/Herramienta
                </button>
            </div>
        </div>
    `;
    
    contenedor.insertAdjacentHTML('beforeend', cardHtml);
    agregarItemUI(idUnico); // Agregar un item por defecto
};

window.removerBodegaUI = function(id) {
    document.getElementById(`card-bodega-${id}`).remove();
};

window.agregarItemUI = function(bodegaId) {
    const container = document.getElementById(`productos-${bodegaId}`);
    const itemId = Date.now() + Math.random().toString(36).substr(2, 5);
    
    const rowHtml = `
        <div class="row g-2 mb-2 align-items-end p-2 bg-white rounded border" id="item-row-${itemId}">
            <div class="col-md-2">
                <label class="form-label small mb-1">Tipo: *</label>
                <select class="form-select select-tipo-item" onchange="actualizarTipoItem(this, '${itemId}')">
                    <option value="producto">📦 Producto</option>
                    <option value="herramienta">🔧 Herramienta</option>
                </select>
            </div>
            <div class="col-md-5">
                <label class="form-label small mb-1"><span id="label-item-${itemId}">Producto</span>: *</label>
                <select class="form-select select-item-especial" id="select-item-${itemId}" onchange="actualizarStockItem(this, '${itemId}')">
                    <option value="">Seleccionar...</option>
                </select>
                <small class="text-muted stock-info" id="stock-info-${itemId}" style="display: none;"></small>
            </div>
            <div class="col-md-3">
                <label class="form-label small mb-1">Cantidad: *</label>
                <input type="number" class="form-control input-cantidad-especial" id="cantidad-${itemId}" min="1" step="1" placeholder="0" oninput="this.value = Math.abs(Math.floor(this.value)) || ''">
            </div>
            <div class="col-md-2">
                <button class="btn btn-outline-danger w-100" onclick="document.getElementById('item-row-${itemId}').remove()" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
    // Inicializar con productos
    actualizarTipoItem(document.querySelector(`#item-row-${itemId} .select-tipo-item`), itemId);
};

// Función para actualizar el tipo de item (producto/herramienta)
window.actualizarTipoItem = function(selectTipo, rowId) {
    const tipoItem = selectTipo.value;
    const selectItem = document.getElementById(`select-item-${rowId}`);
    const labelItem = document.getElementById(`label-item-${rowId}`);
    const stockInfo = document.getElementById(`stock-info-${rowId}`);
    const cantInput = document.getElementById(`cantidad-${rowId}`);
    
    if (!selectItem) return;
    
    // Actualizar label
    if (labelItem) {
        labelItem.textContent = tipoItem === 'herramienta' ? 'Herramienta' : 'Producto';
    }
    
    // Limpiar selección anterior
    selectItem.innerHTML = '<option value="">Seleccionar...</option>';
    selectItem.value = '';
    if (stockInfo) stockInfo.style.display = 'none';
    if (cantInput) {
        cantInput.value = '';
        cantInput.max = '';
        cantInput.disabled = false;
    }
    
    // Llenar con productos o herramientas según el tipo
    if (tipoItem === 'herramienta') {
        herramientas.forEach(h => {
            const stock = calcularStockBodegaPrincipalHerramienta(h.id);
            const stockText = stock > 0 ? ` (Stock: ${stock})` : ' (Sin stock)';
            const disabled = stock <= 0 ? 'disabled' : '';
            const option = document.createElement('option');
            option.value = h.id;
            option.textContent = `${h.nombre}${stockText}`;
            option.dataset.stock = stock;
            option.disabled = stock <= 0;
            selectItem.appendChild(option);
        });
    } else {
        productos.forEach(p => {
            const stock = calcularStockBodegaPrincipalProducto(p.id);
            const stockText = stock > 0 ? ` (Stock: ${stock})` : ' (Sin stock)';
            const disabled = stock <= 0 ? 'disabled' : '';
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nombre}${stockText}`;
            option.dataset.stock = stock;
            option.disabled = stock <= 0;
            selectItem.appendChild(option);
        });
    }
};

// Función para actualizar información de stock cuando se selecciona un item
window.actualizarStockItem = function(select, rowId) {
    const itemId = select.value;
    const stockInfo = document.getElementById(`stock-info-${rowId}`);
    const cantInput = document.getElementById(`cantidad-${rowId}`);
    const selectTipo = select.closest('.row').querySelector('.select-tipo-item');
    const tipoItem = selectTipo ? selectTipo.value : 'producto';
    
    if (!itemId) {
        if (stockInfo) stockInfo.style.display = 'none';
        if (cantInput) cantInput.max = '';
        return;
    }
    
    const stockDisponible = calcularStockBodegaPrincipal(itemId, tipoItem);
    const option = select.options[select.selectedIndex];
    
    if (stockInfo) {
        if (stockDisponible <= 0) {
            stockInfo.textContent = '⚠️ Sin stock disponible';
            stockInfo.className = 'text-danger small';
            stockInfo.style.display = 'block';
            if (cantInput) {
                cantInput.disabled = true;
                cantInput.value = '';
            }
        } else {
            stockInfo.textContent = `✓ Stock disponible: ${stockDisponible} unidades`;
            stockInfo.className = 'text-success small';
            stockInfo.style.display = 'block';
            if (cantInput) {
                cantInput.disabled = false;
                cantInput.max = stockDisponible;
            }
        }
    }
};

window.mostrarConfirmacionPedido = function() {
    const fecha = document.getElementById('fechaPedidoEspecial').value;
    if (!fecha) {
        mostrarMensaje('Selecciona una fecha para el pedido', 'warning');
        return;
    }
    
    // Recolectar datos
    const tarjetas = document.querySelectorAll('[id^="card-bodega-"]');
    const resumen = [];
    let hayErrores = false;
    const erroresStock = [];
    
    tarjetas.forEach(card => {
        const bodegaSelect = card.querySelector('.select-bodega-especial');
        const bodegaId = bodegaSelect.value;
        
        if (!bodegaId) {
            hayErrores = true; 
            return;
        }
        
        const bodegaNombre = bodegaSelect.options[bodegaSelect.selectedIndex].text;
        const itemRows = card.querySelectorAll('[id^="item-row-"]');
        
        itemRows.forEach(row => {
            const selectTipo = row.querySelector('.select-tipo-item');
            const selectItem = row.querySelector('.select-item-especial');
            const cantInput = row.querySelector('.input-cantidad-especial');
            
            if (!selectTipo || !selectItem || !cantInput) return;
            
            const tipoItem = selectTipo.value;
            const itemId = selectItem.value;
            const cantidad = parseInt(cantInput.value) || 0;
            
            if (itemId && cantidad > 0) {
                const itemNombre = selectItem.options[selectItem.selectedIndex].text.split(' (')[0]; // Remover stock del nombre
                
                // Validar stock disponible
                const stockDisponible = calcularStockBodegaPrincipal(itemId, tipoItem);
                
                if (stockDisponible <= 0) {
                    erroresStock.push(`${itemNombre}: Sin stock disponible (Stock: ${stockDisponible})`);
                    hayErrores = true;
                    return;
                }
                
                if (cantidad > stockDisponible) {
                    erroresStock.push(`${itemNombre}: Stock insuficiente. Solicitado: ${cantidad}, Disponible: ${stockDisponible}`);
                    hayErrores = true;
                    return;
                }
                
                resumen.push({
                    bodegaId,
                    bodegaNombre,
                    tipoItem,
                    itemId,
                    itemNombre,
                    cantidad,
                    stockDisponible
                });
            }
        });
    });
    
    if (hayErrores && erroresStock.length > 0) {
        mostrarMensaje('Error de stock:\n' + erroresStock.join('\n'), 'danger');
        return;
    }
    
    if (resumen.length === 0) {
        mostrarMensaje('Agrega al menos una bodega y un producto/herramienta con cantidad válida', 'warning');
        return;
    }
    
    // Mostrar en modal - Parsear fecha correctamente en hora local
    const [año, mes, dia] = fecha.split('-').map(Number);
    const fechaLocal = new Date(año, mes - 1, dia, 12, 0, 0); // mes - 1 porque Date usa 0-11
    document.getElementById('fechaConfirmacionPedido').textContent = formatearFecha(fechaLocal);
    const tbody = document.getElementById('tbodyConfirmacionPedido');
    tbody.innerHTML = '';
    
    resumen.forEach(item => {
        const icono = item.tipoItem === 'herramienta' ? '🔧' : '📦';
        tbody.innerHTML += `
            <tr>
                <td>${item.bodegaNombre}</td>
                <td class="fw-bold text-center">${item.cantidad}</td>
                <td>${icono} ${item.itemNombre}</td>
            </tr>
        `;
    });
    
    // Guardar temporalmente para procesar
    window.pedidoEspecialTemp = { fecha, resumen };
    
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmarPedidoEspecial'));
    modal.show();
};

window.procesarPedidoEspeciales = async function() {
    const datos = window.pedidoEspecialTemp;
    if (!datos) return;
    
    try {
        // Validar stock nuevamente antes de procesar (por si cambió entre confirmación y procesamiento)
        // Validar stock desde bodega principal
        const erroresStock = [];
        for (const item of datos.resumen) {
            const stockDisponible = calcularStockBodegaPrincipal(item.itemId, item.tipoItem);
            
            if (stockDisponible <= 0) {
                erroresStock.push(`${item.itemNombre}: Sin stock disponible en bodega principal (Stock: ${stockDisponible})`);
            } else if (item.cantidad > stockDisponible) {
                erroresStock.push(`${item.itemNombre}: Stock insuficiente en bodega principal. Solicitado: ${item.cantidad}, Disponible: ${stockDisponible}`);
            }
        }
        
        if (erroresStock.length > 0) {
            mostrarMensaje('Error de stock al procesar:\n' + erroresStock.join('\n'), 'danger');
            return;
        }
        
        // Crear fecha a las 12:00 PM local
        // Parsear fecha desde formato "YYYY-MM-DD" directamente en hora local
        const [año, mes, dia] = datos.fecha.split('-').map(Number);
        const fechaHora = new Date(año, mes - 1, dia, 12, 0, 0); // mes - 1 porque Date usa 0-11
        
        // Buscar bodegas principales según el tipo de item
        // Para productos: bodega tipo "principal"
        // Para herramientas: bodega tipo "herramientas" con nombre "Bodega Principal Herramientas"
        
        // Buscar bodega principal de productos
        let bodegaPrincipalProductosId = null;
        let bodegaPrincipalProductosNombre = null;
        const qPrincipal = query(collection(db, 'bodegas'), where('tipo', '==', 'principal'), limit(1));
        const snapshotPrincipal = await getDocs(qPrincipal);
        if (!snapshotPrincipal.empty) {
            bodegaPrincipalProductosId = snapshotPrincipal.docs[0].id;
            bodegaPrincipalProductosNombre = snapshotPrincipal.docs[0].data().nombre;
        }
        
        // Buscar bodega principal de herramientas
        let bodegaPrincipalHerramientasIdProc = null;
        let bodegaPrincipalHerramientasNombre = null;
        const qPrincipalHerramientas = query(
            collection(db, 'bodegas'), 
            where('tipo', '==', 'herramientas'),
            where('nombre', '==', 'Bodega Principal Herramientas'),
            limit(1)
        );
        const snapshotPrincipalHerramientas = await getDocs(qPrincipalHerramientas);
        if (!snapshotPrincipalHerramientas.empty) {
            bodegaPrincipalHerramientasIdProc = snapshotPrincipalHerramientas.docs[0].id;
            bodegaPrincipalHerramientasNombre = snapshotPrincipalHerramientas.docs[0].data().nombre;
        } else {
            // Si no existe con ese nombre exacto, buscar cualquier bodega principal de herramientas
            const qAlternativa = query(
                collection(db, 'bodegas'), 
                where('tipo', '==', 'herramientas'),
                limit(1)
            );
            const snapshotAlternativa = await getDocs(qAlternativa);
            if (!snapshotAlternativa.empty) {
                bodegaPrincipalHerramientasIdProc = snapshotAlternativa.docs[0].id;
                bodegaPrincipalHerramientasNombre = snapshotAlternativa.docs[0].data().nombre;
            }
        }

        const batchPromises = datos.resumen.map(async item => {
            let precioUnitario = 0;
            let total = 0;
            
            // Determinar bodega origen según el tipo de item
            let bodegaOrigenId = null;
            let bodegaOrigenNombre = null;
            
            if (item.tipoItem === 'herramienta') {
                if (!bodegaPrincipalHerramientasIdProc) {
                    throw new Error('No se encontró ninguna Bodega Principal de Herramientas configurada en el sistema. No se puede procesar el pedido de herramientas.');
                }
                bodegaOrigenId = bodegaPrincipalHerramientasIdProc;
                bodegaOrigenNombre = bodegaPrincipalHerramientasNombre;
                
                const herramienta = herramientas.find(h => h.id === item.itemId);
                precioUnitario = herramienta ? (herramienta.precioUnitario || 0) : 0;
                total = precioUnitario * item.cantidad;
            } else {
                if (!bodegaPrincipalProductosId) {
                    throw new Error('No se encontró ninguna Bodega Principal configurada en el sistema (tipo="principal"). No se puede procesar el pedido.');
                }
                bodegaOrigenId = bodegaPrincipalProductosId;
                bodegaOrigenNombre = bodegaPrincipalProductosNombre;
                
                const producto = productos.find(p => p.id === item.itemId);
                precioUnitario = producto ? (producto.precioUnitario || 0) : 0;
                total = precioUnitario * item.cantidad;
            }
            
            const movimientoData = {
                fecha: Timestamp.fromDate(fechaHora),
                tipo: 'transferencia', 
                origen: bodegaOrigenId,
                origenNombre: bodegaOrigenNombre,
                destino: item.bodegaId,
                destinoNombre: item.bodegaNombre,
                cantidad: item.cantidad,
                precioUnitario: precioUnitario,
                total: total,
                motivo: 'Pedido Especial',
                observaciones: 'Generado desde módulo de Pedidos Especiales',
                usuarioId: auth.currentUser.uid,
                empleado: auth.currentUser.email,
                fechaRegistro: serverTimestamp(),
                esPedidoEspecial: true
            };
            
            // Asignar productoId o herramientaId según el tipo
            if (item.tipoItem === 'herramienta') {
                movimientoData.herramientaId = item.itemId;
                movimientoData.herramientaNombre = item.itemNombre;
            } else {
                movimientoData.productoId = item.itemId;
                movimientoData.productoNombre = item.itemNombre;
            }
            
            // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
            return procesarMovimientoInventario(db, movimientoData, item.tipoItem);
        });
        
        await Promise.all(batchPromises);
        
        mostrarMensaje('Pedido especial procesado exitosamente', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalConfirmarPedidoEspecial')).hide();
        
        // Limpiar UI
        document.getElementById('contenedorBodegasEspeciales').innerHTML = `
            <div class="text-center py-5 text-muted bg-light rounded border border-dashed">
                <i class="fas fa-warehouse fa-3x mb-3"></i>
                <h5>Agrega bodegas especiales para comenzar</h5>
            </div>
        `;
        
    } catch (error) {
        console.error('Error procesando pedido:', error);
        mostrarMensaje('Error al procesar: ' + error.message, 'danger');
    }
};

