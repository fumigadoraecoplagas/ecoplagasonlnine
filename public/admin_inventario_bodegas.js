// Módulo de Gestión de Bodegas (Admin)
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, addDoc, orderBy, doc, updateDoc, deleteDoc, serverTimestamp, limit, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuración de Firebase (reutilizada)
const firebaseConfig = {
    projectId: "cursorwebapp-f376d",
    appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
    databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
    storageBucket: "cursorwebapp-f376d.firebasestorage.app",
    apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
    authDomain: "cursorwebapp-f376d.firebaseapp.com",
    messagingSenderId: "719990096116",
    measurementId: "G-DJXLKFR7CD"
};

let app, db;
try {
    app = getApp();
    db = getFirestore(app);
} catch (error) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}

// Variables globales del módulo
let bodegas = [];
let empleados = [];
let productos = []; // Necesario para calcular valor del inventario
let stockBodegas = []; // Necesario para valor
let currentUser = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('🚀 [ADMIN_BODEGAS] Iniciando módulo...');
        
        // Asegurar interactividad inmediata
        document.body.style.pointerEvents = 'auto';
        
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        const currentUser = authManager.getCurrentUser();
        if (currentUser && currentUser.permisos?.administrador_bodega) {
            await cargarDatos();
        } else {
            window.location.href = 'inicio.html';
        }
        
    } catch (error) {
        console.error('Error inicializando bodegas:', error);
    }
});

function esperarAuthManager() {
    return new Promise((resolve, reject) => {
        if (window.authManager) {
            resolve(window.authManager);
            return;
        }

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

async function cargarDatos() {
    try {
        await Promise.all([
            cargarBodegas(),
            cargarEmpleados(),
            cargarProductos(), // Necesario para valor
            cargarStockBodegas() // Necesario para valor
        ]);
        
        configurarEventos();
        mostrarTablaBodegas();
        console.log('✅ Datos de bodegas cargados');
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        alert('Error al cargar datos: ' + error.message);
    }
}

// Funciones de carga
async function cargarBodegas() {
    const snapshot = await getDocs(collection(db, 'bodegas'));
    bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function cargarEmpleados() {
    const q = query(collection(db, 'empleados'), orderBy('primerNombre'));
    const snapshot = await getDocs(q);
    empleados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function cargarProductos() {
    // Solo necesitamos ID y precio para calcular valor
    const snapshot = await getDocs(collection(db, 'productos'));
    productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function cargarStockBodegas() {
    // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA necesita TODOS los stock_bodegas
    // NO debe tener límite porque se usa para gestión completa de bodegas
    const snapshot = await getDocs(collection(db, 'stock_bodegas'));
    stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Configurar eventos UI
function configurarEventos() {
    const tipoBodegaEl = document.getElementById('tipoBodega');
    if (tipoBodegaEl) {
        tipoBodegaEl.addEventListener('change', function() {
            const empleadoGroup = document.getElementById('empleadoBodegaGroup');
            const vehiculoGroup = document.getElementById('vehiculoBodegaGroup');
            
            if (empleadoGroup) empleadoGroup.style.display = 'none';
            if (vehiculoGroup) vehiculoGroup.style.display = 'none';
            
            if (this.value === 'rutero' || this.value === 'especial') {
                if (empleadoGroup) empleadoGroup.style.display = 'block';
                llenarSelectEmpleados();
            } else if (this.value === 'apv') {
                if (vehiculoGroup) vehiculoGroup.style.display = 'block';
            }
        });
    }
}

function llenarSelectEmpleados() {
    const select = document.getElementById('empleadoBodega');
    select.innerHTML = '<option value="">Seleccionar empleado...</option>';
    empleados.forEach(empleado => {
        const option = document.createElement('option');
        option.value = empleado.username;
        option.textContent = `${empleado.primerNombre} ${empleado.primerApellido}`;
        select.appendChild(option);
    });
}

// Lógica de visualización
function calcularValorBodega(bodegaId) {
    let valorTotal = 0;
    const stocks = stockBodegas.filter(s => s.bodegaId === bodegaId);
    
    stocks.forEach(stock => {
        const stockActual = Number(stock.stockActual) || 0;
        if (stockActual > 0) {
            const producto = productos.find(p => p.id === stock.productoId);
            if (producto) {
                valorTotal += stockActual * (producto.precioUnitario || 0);
            }
        }
    });
    return valorTotal;
}

window.mostrarTablaBodegas = function() {
    const tbody = document.getElementById('tablaBodegas');
    if (!tbody) return;
    
    if (bodegas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay bodegas registradas</td></tr>';
        return;
    }
    
    // Agrupar y ordenar
    const grupos = {
        principal: bodegas.filter(b => b.tipo === 'principal').sort((a, b) => a.nombre.localeCompare(b.nombre)),
        rutero: bodegas.filter(b => b.tipo === 'rutero').sort((a, b) => a.nombre.localeCompare(b.nombre)),
        apv: bodegas.filter(b => b.tipo === 'apv').sort((a, b) => a.nombre.localeCompare(b.nombre)),
        especial: bodegas.filter(b => b.tipo === 'especial').sort((a, b) => a.nombre.localeCompare(b.nombre)),
        herramientas: bodegas.filter(b => b.tipo === 'herramientas').sort((a, b) => a.nombre.localeCompare(b.nombre)),
        otros: bodegas.filter(b => !['principal', 'rutero', 'apv', 'especial', 'herramientas'].includes(b.tipo)).sort((a, b) => a.nombre.localeCompare(b.nombre))
    };
    
    let html = '';
    
    const generarFilas = (lista, titulo, color) => {
        if (lista.length === 0) return '';
        
        let filas = lista.map(bodega => {
            const empleado = empleados.find(e => e.username === bodega.empleadoId);
            const nombreEmpleado = empleado ? `${empleado.primerNombre} ${empleado.primerApellido}` : 'N/A';
            const valorTotal = calcularValorBodega(bodega.id);
            
            let tipoDisplay = 'N/A';
            let badgeClass = 'bg-secondary';
            
            switch(bodega.tipo) {
                case 'principal': tipoDisplay = 'Principal'; badgeClass = 'bg-primary'; break;
                case 'apv': tipoDisplay = `APV (${bodega.vehiculoId || 'N/A'})`; badgeClass = 'bg-info'; break;
                case 'rutero': tipoDisplay = 'Rutero'; badgeClass = 'bg-success'; break;
                case 'especial': tipoDisplay = 'Especial'; badgeClass = 'bg-warning'; break;
                case 'herramientas': tipoDisplay = 'Herramientas'; badgeClass = 'bg-secondary'; break;
                default: tipoDisplay = bodega.tipo || 'Otro';
            }
            
            return `
                <tr>
                    <td><strong>${bodega.nombre}</strong></td>
                    <td><span class="badge ${badgeClass}">${tipoDisplay}</span></td>
                    <td>${nombreEmpleado}</td>
                    <td>${bodega.ubicacion || 'N/A'}</td>
                    <td>₡${valorTotal.toLocaleString()}</td>
                    <td><span class="badge bg-success">Activa</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarBodega('${bodega.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarBodega('${bodega.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
        
        return `<tr class="table-${color}"><td colspan="7" class="fw-bold text-center py-2">${titulo} (${lista.length})</td></tr>${filas}`;
    };
    
    html += generarFilas(grupos.principal, 'Bodegas Principales', 'primary');
    html += generarFilas(grupos.rutero, 'Bodegas Rutero', 'success');
    html += generarFilas(grupos.apv, 'Bodegas APV', 'info');
    html += generarFilas(grupos.especial, 'Bodegas Especiales', 'warning');
    html += generarFilas(grupos.herramientas, 'Bodegas de Herramientas', 'secondary');
    html += generarFilas(grupos.otros, 'Sin Clasificar', 'secondary');
    
    tbody.innerHTML = html;
    
    // Actualizar resumen
    actualizarResumenValores(grupos);
}

function actualizarResumenValores(grupos) {
    const container = document.getElementById('resumenValoresBodegas');
    if (!container) return;
    
    const calcularTotal = (lista) => lista.reduce((acc, b) => acc + calcularValorBodega(b.id), 0);
    
    const vPrincipal = calcularTotal(grupos.principal);
    const vRutero = calcularTotal(grupos.rutero);
    const vAPV = calcularTotal(grupos.apv);
    const vEspecial = calcularTotal(grupos.especial);
    const vHerramientas = calcularTotal(grupos.herramientas);
    
    container.innerHTML = `
        <div class="col-12 mb-3"><h5><i class="fas fa-chart-pie me-2"></i>Valor del Inventario</h5></div>
        <div class="col-md-2"><div class="card border-primary"><div class="card-body text-center"><h6 class="text-primary">Principales</h6><h4>₡${vPrincipal.toLocaleString()}</h4></div></div></div>
        <div class="col-md-2"><div class="card border-success"><div class="card-body text-center"><h6 class="text-success">Rutero</h6><h4>₡${vRutero.toLocaleString()}</h4></div></div></div>
        <div class="col-md-2"><div class="card border-info"><div class="card-body text-center"><h6 class="text-info">APV</h6><h4>₡${vAPV.toLocaleString()}</h4></div></div></div>
        <div class="col-md-2"><div class="card border-warning"><div class="card-body text-center"><h6 class="text-warning">Especiales</h6><h4>₡${vEspecial.toLocaleString()}</h4></div></div></div>
        <div class="col-md-2"><div class="card border-secondary"><div class="card-body text-center"><h6 class="text-secondary">Herramientas</h6><h4>₡${vHerramientas.toLocaleString()}</h4></div></div></div>
    `;
}

// Acciones CRUD
window.guardarBodega = async function() {
    const id = document.getElementById('bodegaId').value;
    const nombre = document.getElementById('nombreBodega').value;
    const tipo = document.getElementById('tipoBodega').value;
    const empleado = document.getElementById('empleadoBodega').value;
    const vehiculo = document.getElementById('vehiculoBodega').value;
    const ubicacion = document.getElementById('ubicacionBodega').value;
    
    if (!nombre || !tipo) {
        alert('Nombre y tipo son obligatorios');
        return;
    }
    
    const data = {
        nombre, tipo, empleadoId: empleado, vehiculoId: vehiculo, ubicacion,
        updatedAt: serverTimestamp()
    };
    
    try {
        if (id) {
            await updateDoc(doc(db, 'bodegas', id), data);
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db, 'bodegas'), data);
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalBodega'));
        modal.hide();
        document.getElementById('formBodega').reset();
        
        await cargarBodegas();
        mostrarTablaBodegas();
        alert('Bodega guardada exitosamente');
    } catch (e) {
        console.error(e);
        alert('Error guardando bodega');
    }
}

window.editarBodega = function(id) {
    const bodega = bodegas.find(b => b.id === id);
    if (!bodega) return;
    
    document.getElementById('bodegaId').value = bodega.id;
    document.getElementById('nombreBodega').value = bodega.nombre;
    document.getElementById('tipoBodega').value = bodega.tipo;
    
    // Disparar evento change para mostrar campos condicionales
    const event = new Event('change');
    document.getElementById('tipoBodega').dispatchEvent(event);
    
    setTimeout(() => {
        if (bodega.empleadoId) document.getElementById('empleadoBodega').value = bodega.empleadoId;
        if (bodega.vehiculoId) document.getElementById('vehiculoBodega').value = bodega.vehiculoId;
    }, 100);
    
    document.getElementById('ubicacionBodega').value = bodega.ubicacion || '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalBodega'));
    modal.show();
}

window.eliminarBodega = async function(id) {
    if (!confirm('¿Seguro que deseas eliminar esta bodega?')) return;
    
    try {
        // Validar dependencias (historial)
        const qOrigen = query(collection(db, 'movimientos_inventario'), where('origen', '==', id), limit(1));
        const qDestino = query(collection(db, 'movimientos_inventario'), where('destino', '==', id), limit(1));
        
        const [snapOrigen, snapDestino] = await Promise.all([getDocs(qOrigen), getDocs(qDestino)]);
        
        if (!snapOrigen.empty || !snapDestino.empty) {
            alert('No se puede eliminar esta bodega porque tiene historial de movimientos asociado. Esto causaría inconsistencias en los reportes.');
            return;
        }
        
        // Validar stock
        const qStock = query(collection(db, 'stock_bodegas'), where('bodegaId', '==', id));
        const snapStock = await getDocs(qStock);
        const tieneStock = snapStock.docs.some(d => (Number(d.data().stockActual) || 0) > 0);
        
        if (tieneStock) {
            alert('No se puede eliminar la bodega porque tiene productos con stock positivo. Realiza una transferencia o ajuste de salida primero.');
            return;
        }

        // Eliminación segura
        const batch = writeBatch(db);
        batch.delete(doc(db, 'bodegas', id));
        snapStock.docs.forEach(d => batch.delete(d.ref)); // Limpiar stocks en 0
        
        await batch.commit();
        
        await cargarBodegas();
        mostrarTablaBodegas();
        alert('Bodega eliminada correctamente.');
        
    } catch (e) {
        console.error(e);
        alert('Error eliminando bodega: ' + e.message);
    }
}

// Funciones de Utilidad (Recálculo y Exportación)
window.recalcularTodosLosSaldos = async function() {
    if (!confirm('ADVERTENCIA: ¿Recalcular todos los saldos? Esta acción reconstruirá el stock basándose en TODO el historial de movimientos. Esto puede tardar varios minutos y sobreescribirá los valores actuales.')) return;
    
    const btn = document.getElementById('btnRecalcularSaldos');
    const progresoDiv = document.getElementById('progresoRecalculo');
    const barra = document.getElementById('barraProgresoRecalculo');
    let textoProgreso = document.getElementById('textoProgresoRecalculo');

    if (!textoProgreso) {
        textoProgreso = document.createElement('small');
        textoProgreso.id = 'textoProgresoRecalculo';
        textoProgreso.className = 'text-muted d-block text-center mt-1';
        progresoDiv.appendChild(textoProgreso);
    }
    
    btn.disabled = true;
    progresoDiv.style.display = 'block';
    textoProgreso.textContent = 'Iniciando...';
    barra.style.width = '0%';
    
    try {
        // 1. Cargar Datos
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA necesita TODOS los movimientos_inventario
        // NO debe tener límite porque procesa TODO el historial para recalcular saldos correctamente
        textoProgreso.textContent = 'Cargando historial de movimientos...';
        const qMovs = query(collection(db, 'movimientos_inventario'), orderBy('fecha', 'asc'));
        const snapshotMovs = await getDocs(qMovs);
        const transacciones = snapshotMovs.docs.map(d => d.data());
        
        textoProgreso.textContent = `Procesando ${transacciones.length} movimientos...`;
        barra.style.width = '20%';
        
        // 2. Cargar Stock Actual (productos y herramientas)
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA necesita TODOS los stock_bodegas
        // NO debe tener límite porque debe actualizar TODOS los registros de stock
        const snapshotStock = await getDocs(collection(db, 'stock_bodegas'));
        const stockMap = {};
        snapshotStock.docs.forEach(d => {
            const data = d.data();
            // Mapear tanto productos como herramientas
            if (data.productoId) {
                stockMap[`producto_${data.bodegaId}_${data.productoId}`] = d.id;
            }
            if (data.herramientaId) {
                stockMap[`herramienta_${data.bodegaId}_${data.herramientaId}`] = d.id;
            }
        });
        
        // 3. Calcular Saldos en Memoria
        const saldosCalculados = {};
        
        transacciones.forEach(t => {
            // Determinar si es producto o herramienta
            const esHerramienta = !!(t.herramientaId || t.tipoItem === 'herramienta');
            const itemId = esHerramienta ? t.herramientaId : t.productoId;
            
            if (!itemId || !t.cantidad) return;
            
            const tipoItem = esHerramienta ? 'herramienta' : 'producto';
            
            // Función helper para limpiar prefijos de IDs
            const limpiarId = (id) => {
                if (!id) return null;
                if (typeof id === 'string') {
                    // Limpiar prefijos comunes
                    return id.replace(/^(transferencia:|gasto:|proveedor:)/, '');
                }
                return id;
            };
            
            const procesar = (bodegaId, itemId, cant, operacion, tipoItem) => {
                const bodegaIdLimpio = limpiarId(bodegaId);
                if (!bodegaIdLimpio) return;
                const k = `${tipoItem}_${bodegaIdLimpio}_${itemId}`;
                if (!saldosCalculados[k]) saldosCalculados[k] = 0;
                
                const cantidad = parseFloat(cant) || 0;
                if (operacion === '+') saldosCalculados[k] += cantidad;
                else saldosCalculados[k] -= cantidad;
            };
            
            if (t.tipo === 'compra') procesar(t.destino, itemId, t.cantidad, '+', tipoItem);
            else if (t.tipo === 'gasto') procesar(t.origen, itemId, t.cantidad, '-', tipoItem);
            else if (t.tipo === 'transferencia') {
                procesar(t.origen, itemId, t.cantidad, '-', tipoItem);
                procesar(t.destino, itemId, t.cantidad, '+', tipoItem);
            } else if (t.tipo === 'reversion') {
                if (t.destino) procesar(t.destino, itemId, t.cantidad, '+', tipoItem);
            } else if (t.tipo === 'ajuste_entrada') {
                procesar(t.destino, itemId, t.cantidad, '+', tipoItem);
            } else if (t.tipo === 'ajuste_salida') {
                procesar(t.origen, itemId, t.cantidad, '-', tipoItem);
            }
        });

        barra.style.width = '50%';
        textoProgreso.textContent = 'Preparando actualizaciones de base de datos...';

        // 4. Preparar Batches
        const operaciones = [];
        
        for (const key in saldosCalculados) {
            const [tipoItem, bodegaId, itemId] = key.split('_');
            const nuevoStock = parseFloat(saldosCalculados[key].toFixed(2));
            const docId = stockMap[key];
            
            const dataUpdate = {
                stockActual: nuevoStock,
                updatedAt: serverTimestamp(),
                tipo: tipoItem // Agregar campo tipo para diferenciación
            };
            
            if (docId) {
                operaciones.push({
                    tipo: 'update',
                    ref: doc(db, 'stock_bodegas', docId),
                    data: dataUpdate
                });
            } else {
                const dataCreate = {
                    bodegaId,
                    stockActual: nuevoStock,
                    updatedAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    tipo: tipoItem
                };
                
                // Asignar productoId o herramientaId según corresponda
                if (tipoItem === 'herramienta') {
                    dataCreate.herramientaId = itemId;
                } else {
                    dataCreate.productoId = itemId;
                }
                
                operaciones.push({
                    tipo: 'set',
                    ref: doc(collection(db, 'stock_bodegas')),
                    data: dataCreate
                });
            }
            if (stockMap[key]) delete stockMap[key];
        }
        
        // Poner en 0 los stocks obsoletos
        for (const key in stockMap) {
             const docId = stockMap[key];
             operaciones.push({
                tipo: 'update',
                ref: doc(db, 'stock_bodegas', docId),
                data: { stockActual: 0, updatedAt: serverTimestamp() }
            });
        }

        // 5. Ejecutar Batches
        const BATCH_SIZE = 450;
        const totalBatches = Math.ceil(operaciones.length / BATCH_SIZE);
        
        for (let i = 0; i < operaciones.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = operaciones.slice(i, i + BATCH_SIZE);
            
            chunk.forEach(op => {
                if (op.tipo === 'update') batch.update(op.ref, op.data);
                else if (op.tipo === 'set') batch.set(op.ref, op.data);
            });
            
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            textoProgreso.textContent = `Guardando lote ${batchNum} de ${totalBatches}...`;
            await batch.commit();
            
            const progresoBatch = 50 + (50 * (batchNum / totalBatches));
            barra.style.width = `${progresoBatch}%`;
        }

        barra.style.width = '100%';
        textoProgreso.textContent = '¡Completado!';
        
        await cargarStockBodegas();
        mostrarTablaBodegas();
        
        setTimeout(() => {
            progresoDiv.style.display = 'none';
            btn.disabled = false;
            alert(`Recálculo finalizado exitosamente.\nSe procesaron ${transacciones.length} movimientos y se actualizaron ${operaciones.length} registros.`);
        }, 1000);
        
    } catch (e) {
        console.error(e);
        btn.disabled = false;
        textoProgreso.textContent = 'Error: ' + e.message;
        alert('Error crítico durante el recálculo: ' + e.message);
    }
}

window.exportarTransaccionesCSV = async function() {
    const btn = document.querySelector('button[onclick="exportarTransaccionesCSV()"]');
    const originalText = btn ? btn.innerHTML : 'Exportar';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Exportando...';
    }

    try {
        const q = query(collection(db, 'movimientos_inventario'), orderBy('fecha', 'desc'), limit(2000));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            alert('No hay transacciones para exportar.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Fecha,Tipo,Origen,Destino,Producto,Cantidad,Usuario,Observaciones\n";

        snapshot.docs.forEach(doc => {
            const m = doc.data();
            const fecha = m.fecha?.toDate ? m.fecha.toDate().toLocaleString() : '';
            
            // Buscar nombre de producto si falta
            let prodNombre = m.productoNombre || '';
            if (!prodNombre && productos) {
                const p = productos.find(prod => prod.id === m.productoId);
                if (p) prodNombre = p.nombre;
            }

            const row = [
                fecha,
                m.tipo,
                `"${m.origenNombre || m.origen || ''}"`,
                `"${m.destinoNombre || m.destino || ''}"`,
                `"${prodNombre}"`,
                m.cantidad,
                `"${m.empleado || m.usuarioId || ''}"`,
                `"${(m.observaciones || '').replace(/"/g, '""')}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "transacciones_inventario.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error exportando:', error);
        alert('Error al exportar: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}
