// Importar funciones de Firebase
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuración de Firebase (usar configuración centralizada si está disponible)
// NOTA: Las API Keys de Firebase son públicas por diseño.
// La seguridad está en Firestore Rules y Firebase App Check.
const firebaseConfig = window.firebaseConfig || {
    projectId: "cursorwebapp-f376d",
    appId: "1:719990096116:web:07c1ff697e7655b2cd9ea1",
    databaseURL: "https://cursorwebapp-f376d-default-rtdb.firebaseio.com",
    storageBucket: "cursorwebapp-f376d.firebasestorage.app",
    apiKey: "AIzaSyC-IQj0yHR8cELr-mw-v2xlnw6LlJYFUyk",
    authDomain: "cursorwebapp-f376d.firebaseapp.com",
    messagingSenderId: "719990096116",
    measurementId: "G-DJXLKFR7CD"
};

// Usar la app de Firebase existente o inicializar
let app, db;
try {
    app = getApp();
    db = getFirestore(app);
} catch (error) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}

// Variables globales
let productos = [];
let bodegas = [];
let movimientos = [];
let stockBodegas = [];
let auditoriaResultados = [];

// Esperar a que secureAuthManager esté disponible
async function waitForSecureAuth() {
    let retries = 0;
    const maxRetries = 30;
    
    while (retries < maxRetries) {
        if (window.secureAuthManager && window.secureAuthManager.isAuthenticated()) {
            return window.secureAuthManager;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }
    
    throw new Error('secureAuthManager no disponible');
}

// Verificar autenticación y permisos al cargar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Esperar a que el body esté marcado como authenticated
        let bodyCheckRetries = 0;
        while (!document.body.classList.contains('authenticated') && bodyCheckRetries < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            bodyCheckRetries++;
        }
        
        if (!document.body.classList.contains('authenticated')) {
            console.warn('⚠️ [AUDITORIA_STOCK_SECURE] Body no marcado como authenticated');
            if (!window.location.pathname.includes('iniciar_sesion.html')) {
                window.location.replace('iniciar_sesion.html');
            }
            return;
        }
        
        // Esperar a secureAuthManager
        await waitForSecureAuth();
        
        // Verificar permisos
        const user = window.secureAuthManager.getCurrentUser();
        if (!user || (!user.permisos || (!user.permisos.administrador_bodega && !user.permisos.operario_bodega))) {
            console.warn('⚠️ [AUDITORIA_STOCK_SECURE] Usuario sin permisos para auditoría de stock');
            alert('No tienes permisos para acceder a la auditoría de stock. Se requiere permiso de administrador_bodega o operario_bodega.');
            if (!window.location.pathname.includes('iniciar_sesion.html')) {
                window.location.replace('iniciar_sesion.html');
            }
            return;
        }
        
        console.log('✅ [AUDITORIA_STOCK_SECURE] Usuario autenticado y con permisos');
        
    } catch (error) {
        console.error('❌ [AUDITORIA_STOCK_SECURE] Error en verificación:', error);
        if (!window.location.pathname.includes('iniciar_sesion.html')) {
            window.location.replace('iniciar_sesion.html');
        }
    }
});

// Función principal de auditoría
async function ejecutarAuditoria() {
    try {
        mostrarLoading(true);
        
        console.log('🔍 Iniciando auditoría de stock...');
        
        // Cargar datos
        await cargarDatos();
        
        // Ejecutar auditoría
        auditoriaResultados = await calcularAuditoriaStock();
        
        // Mostrar resultados
        mostrarResultados();
        mostrarEstadisticas();
        llenarFiltros();
        
        console.log('✅ Auditoría completada:', auditoriaResultados.length, 'productos auditados');
        
    } catch (error) {
        console.error('❌ Error en auditoría:', error);
        alert('Error ejecutando auditoría: ' + error.message);
    } finally {
        mostrarLoading(false);
    }
}

// Cargar datos desde Firebase
async function cargarDatos() {
    console.log('📥 Cargando datos...');
    
    // Cargar productos
    const productosSnapshot = await getDocs(collection(db, 'productos'));
    productos = productosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Productos cargados:', productos.length);
    
    // Cargar bodegas
    const bodegasSnapshot = await getDocs(collection(db, 'bodegas'));
    bodegas = bodegasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Bodegas cargadas:', bodegas.length);
    
    // Cargar movimientos
    // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA (auditoría) necesita TODOS los movimientos_inventario
    // NO debe tener límite porque debe procesar TODO el historial para auditoría completa
    const movimientosSnapshot = await getDocs(collection(db, 'movimientos_inventario'));
    movimientos = movimientosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Movimientos cargados:', movimientos.length);
    
    // Cargar stock de bodegas
    // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA (auditoría) necesita TODOS los stock_bodegas
    // NO debe tener límite porque debe verificar TODOS los registros de stock
    const stockSnapshot = await getDocs(collection(db, 'stock_bodegas'));
    stockBodegas = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Stock de bodegas cargado:', stockBodegas.length);
}

// Calcular auditoría de stock
async function calcularAuditoriaStock() {
    console.log('🧮 Calculando auditoría de stock...');
    
    const resultados = [];
    
    // Para cada producto
    for (const producto of productos) {
        // Para cada bodega
        for (const bodega of bodegas) {
            const resultado = await auditarProductoBodega(producto.id, bodega.id);
            if (resultado) {
                resultados.push(resultado);
            }
        }
    }
    
    return resultados;
}

// Auditar un producto específico en una bodega
async function auditarProductoBodega(productoId, bodegaId) {
    // Buscar stock registrado
    const stockRegistrado = stockBodegas.find(s => 
        s.productoId === productoId && s.bodegaId === bodegaId
    );
    
    // Buscar movimientos del producto en esta bodega
    const movimientosProducto = movimientos.filter(m => 
        m.productoId === productoId && (m.origen === bodegaId || m.destino === bodegaId)
    );
    
    // Si no hay movimientos y no hay stock, no incluir en la auditoría
    if (movimientosProducto.length === 0 && (!stockRegistrado || stockRegistrado.stockActual === 0)) {
        return null;
    }
    
    // Calcular stock basado en movimientos
    let stockCalculado = 0;
    
    for (const movimiento of movimientosProducto) {
        if (movimiento.destino === bodegaId) {
            // Entrada a la bodega
            stockCalculado += movimiento.cantidad || 0;
        } else if (movimiento.origen === bodegaId) {
            // Salida de la bodega
            stockCalculado -= movimiento.cantidad || 0;
        }
    }
    
    const stockActual = stockRegistrado ? stockRegistrado.stockActual : 0;
    const diferencia = stockActual - stockCalculado;
    
    // Determinar estado
    let estado = 'correcto';
    let tipoDiscrepancia = '';
    
    if (Math.abs(diferencia) > 0.01) { // Tolerancia para decimales
        estado = 'discrepancia';
        tipoDiscrepancia = diferencia > 0 ? 'mayor' : 'menor';
    } else if (movimientosProducto.length === 0 && stockActual > 0) {
        estado = 'sin-movimientos';
    }
    
    // Buscar información del producto y bodega
    const producto = productos.find(p => p.id === productoId);
    const bodega = bodegas.find(b => b.id === bodegaId);
    
    return {
        productoId,
        bodegaId,
        productoNombre: producto ? producto.nombre : 'Producto no encontrado',
        productoCodigo: producto ? producto.codigo : 'N/A',
        bodegaNombre: bodega ? bodega.nombre : 'Bodega no encontrada',
        stockCalculado,
        stockActual,
        diferencia,
        estado,
        tipoDiscrepancia,
        movimientos: movimientosProducto
    };
}

// Mostrar resultados en la tabla
function mostrarResultados() {
    const tbody = document.getElementById('tablaAuditoria');
    const filtrados = aplicarFiltros();
    
    // Sanitizar datos de resultados antes de renderizar
    const resultadosSanitizados = filtrados.map(resultado => ({
        ...resultado,
        productoNombre: window.escapeHTML ? window.escapeHTML(resultado.productoNombre || '') : (resultado.productoNombre || ''),
        productoCodigo: window.escapeHTML ? window.escapeHTML(resultado.productoCodigo || '') : (resultado.productoCodigo || ''),
        bodegaNombre: window.escapeHTML ? window.escapeHTML(resultado.bodegaNombre || '') : (resultado.bodegaNombre || '')
    }));
    
    if (window.setSafeInnerHTML) {
        const html = resultadosSanitizados.map(resultado => {
        const estadoClass = resultado.estado === 'correcto' ? 'badge-correct' : 
                           resultado.estado === 'discrepancia' ? 'badge-discrepancy' : 'badge-warning';
        
        const estadoText = resultado.estado === 'correcto' ? 'Correcto' :
                          resultado.estado === 'discrepancia' ? 'Discrepancia' : 'Sin Movimientos';
        
        const diferenciaClass = Math.abs(resultado.diferencia) > 0 ? 'text-danger' : 'text-success';
        const diferenciaText = resultado.diferencia > 0 ? `+${resultado.diferencia}` : resultado.diferencia.toString();
        
            return `
                <tr class="product-row">
                    <td>
                        <div>
                            <strong>${resultado.productoNombre}</strong>
                            <br>
                            <small class="text-muted">Código: ${resultado.productoCodigo}</small>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-primary">${resultado.bodegaNombre}</span>
                    </td>
                <td>
                    <span class="badge bg-info">${resultado.stockCalculado}</span>
                </td>
                <td>
                    <span class="badge bg-secondary">${resultado.stockActual}</span>
                </td>
                <td>
                    <span class="${diferenciaClass} fw-bold">${diferenciaText}</span>
                </td>
                <td>
                    <span class="badge ${estadoClass}">${estadoText}</span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-info" onclick="verDetallesMovimientos('${resultado.productoId}', '${resultado.bodegaId}')" title="Ver movimientos">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
        window.setSafeInnerHTML(tbody, html, true);
    } else {
        // Fallback si security-helpers no está disponible
        tbody.innerHTML = resultadosSanitizados.map(resultado => {
            // ... (código similar pero sin sanitización adicional)
        }).join('');
    }
    
    // Actualizar contadores
    document.getElementById('totalResultados').textContent = `${filtrados.length} productos`;
    document.getElementById('correctosResultados').textContent = `${filtrados.filter(r => r.estado === 'correcto').length} correctos`;
    document.getElementById('discrepanciasResultados').textContent = `${filtrados.filter(r => r.estado === 'discrepancia').length} con discrepancias`;
}

// Mostrar estadísticas generales
function mostrarEstadisticas() {
    const total = auditoriaResultados.length;
    const correctos = auditoriaResultados.filter(r => r.estado === 'correcto').length;
    const discrepancias = auditoriaResultados.filter(r => r.estado === 'discrepancia').length;
    const precision = total > 0 ? Math.round((correctos / total) * 100) : 0;
    
    document.getElementById('totalProductos').textContent = total;
    document.getElementById('productosCorrectos').textContent = correctos;
    document.getElementById('productosDiscrepancia').textContent = discrepancias;
    document.getElementById('porcentajePrecision').textContent = `${precision}%`;
    
    // Mostrar secciones
    document.getElementById('estadisticas').style.display = 'block';
    document.getElementById('filtros').style.display = 'block';
    document.getElementById('resultados').style.display = 'block';
}

// Llenar filtros
function llenarFiltros() {
    // Filtro de bodegas
    const selectBodega = document.getElementById('filtroBodega');
    // Sanitizar: usar textContent para opciones estáticas
    // Limpiar - seguro (vacío)
    selectBodega.innerHTML = '';
    const optionDefault = document.createElement('option');
    optionDefault.value = '';
    optionDefault.textContent = 'Todas las bodegas';
    selectBodega.appendChild(optionDefault);
    
    const bodegasUnicas = [...new Set(auditoriaResultados.map(r => r.bodegaId))];
    bodegasUnicas.forEach(bodegaId => {
        const bodega = bodegas.find(b => b.id === bodegaId);
        if (bodega) {
            const option = document.createElement('option');
            option.value = bodegaId;
            option.textContent = bodega.nombre;
            selectBodega.appendChild(option);
        }
    });
    
    // Event listeners para filtros
    document.getElementById('filtroBodega').addEventListener('change', mostrarResultados);
    document.getElementById('filtroEstado').addEventListener('change', mostrarResultados);
    document.getElementById('filtroTipoDiscrepancia').addEventListener('change', mostrarResultados);
    document.getElementById('buscarProducto').addEventListener('input', mostrarResultados);
}

// Aplicar filtros
function aplicarFiltros() {
    let filtrados = [...auditoriaResultados];
    
    // Filtro por bodega
    const bodegaFiltro = document.getElementById('filtroBodega').value;
    if (bodegaFiltro) {
        filtrados = filtrados.filter(r => r.bodegaId === bodegaFiltro);
    }
    
    // Filtro por estado
    const estadoFiltro = document.getElementById('filtroEstado').value;
    if (estadoFiltro) {
        filtrados = filtrados.filter(r => r.estado === estadoFiltro);
    }
    
    // Filtro por tipo de discrepancia
    const tipoDiscrepanciaFiltro = document.getElementById('filtroTipoDiscrepancia').value;
    if (tipoDiscrepanciaFiltro) {
        filtrados = filtrados.filter(r => r.tipoDiscrepancia === tipoDiscrepanciaFiltro);
    }
    
    // Filtro por búsqueda de producto
    const busqueda = document.getElementById('buscarProducto').value.toLowerCase();
    if (busqueda) {
        filtrados = filtrados.filter(r => 
            r.productoNombre.toLowerCase().includes(busqueda) ||
            r.productoCodigo.toLowerCase().includes(busqueda)
        );
    }
    
    return filtrados;
}

// Ver detalles de movimientos
function verDetallesMovimientos(productoId, bodegaId) {
    const resultado = auditoriaResultados.find(r => 
        r.productoId === productoId && r.bodegaId === bodegaId
    );
    
    if (!resultado) return;
    
    // Sanitizar datos del resultado antes de renderizar
    const productoNombreSanitizado = window.escapeHTML ? window.escapeHTML(resultado.productoNombre || '') : (resultado.productoNombre || '');
    const productoCodigoSanitizado = window.escapeHTML ? window.escapeHTML(resultado.productoCodigo || '') : (resultado.productoCodigo || '');
    const bodegaNombreSanitizado = window.escapeHTML ? window.escapeHTML(resultado.bodegaNombre || '') : (resultado.bodegaNombre || '');
    
    // Información del producto
    const infoProducto = document.getElementById('infoProducto');
    const infoHTML = `<strong>Producto:</strong> ${productoNombreSanitizado} (${productoCodigoSanitizado})<br><strong>Bodega:</strong> ${bodegaNombreSanitizado}<br><strong>Stock Calculado:</strong> ${resultado.stockCalculado} | <strong>Stock Registrado:</strong> ${resultado.stockActual} | <strong>Diferencia:</strong> ${resultado.diferencia}`;
    if (window.setSafeInnerHTML) {
        window.setSafeInnerHTML(infoProducto, infoHTML, true);
    } else {
        // Sanitizar: infoHTML contiene datos del usuario
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(infoProducto, infoHTML, true);
        } else {
            infoProducto.innerHTML = infoHTML;
        }
    }
    
    // Tabla de movimientos
    const tbody = document.getElementById('tablaMovimientos');
    // Sanitizar movimientos antes de renderizar
    const movimientosSanitizados = resultado.movimientos.map(mov => ({
        ...mov,
        tipo: window.escapeHTML ? window.escapeHTML(mov.tipo || '') : (mov.tipo || ''),
        motivo: window.escapeHTML ? window.escapeHTML(mov.motivo || '') : (mov.motivo || '')
    }));
    
    if (window.setSafeInnerHTML) {
        const movimientosHTML = movimientosSanitizados.map(mov => {
        const fecha = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha || 0);
        const fechaFormateada = fecha.toLocaleDateString('es-CR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const esEntrada = mov.destino === bodegaId;
        const cantidadClass = esEntrada ? 'text-success' : 'text-danger';
        const cantidadText = esEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`;
        
        return `
            <tr>
                <td>${fechaFormateada}</td>
                <td><span class="badge bg-info">${mov.tipo}</span></td>
                <td>${obtenerNombreOrigen(mov.origen)}</td>
                <td>${obtenerNombreDestino(mov.destino)}</td>
                <td><span class="${cantidadClass} fw-bold">${cantidadText}</span></td>
                <td>${mov.empleado || mov.usuarioId || 'N/A'}</td>
            </tr>
            `;
        }).join('');
        window.setSafeInnerHTML(tbody, movimientosHTML, true);
    } else {
        // Fallback si security-helpers no está disponible
        tbody.innerHTML = movimientosSanitizados.map(mov => {
            const fecha = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha || 0);
            const fechaFormateada = fecha.toLocaleDateString('es-CR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const esEntrada = mov.destino === bodegaId;
            const cantidadClass = esEntrada ? 'text-success' : 'text-danger';
            const cantidadText = esEntrada ? `+${mov.cantidad}` : `-${mov.cantidad}`;
            
            return `
                <tr>
                    <td>${fechaFormateada}</td>
                    <td><span class="badge bg-info">${mov.tipo}</span></td>
                    <td>${obtenerNombreOrigen(mov.origen)}</td>
                    <td>${obtenerNombreDestino(mov.destino)}</td>
                    <td><span class="${cantidadClass} fw-bold">${cantidadText}</span></td>
                    <td>${mov.empleado || mov.usuarioId || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    }
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('detallesMovimientos'));
    modal.show();
}

// Obtener nombre del origen
function obtenerNombreOrigen(origenId) {
    const bodega = bodegas.find(b => b.id === origenId);
    if (bodega) return bodega.nombre;
    
    // Buscar en proveedores (si existe esa colección)
    return 'Proveedor/Origen';
}

// Obtener nombre del destino
function obtenerNombreDestino(destinoId) {
    const bodega = bodegas.find(b => b.id === destinoId);
    if (bodega) return bodega.nombre;
    
    // Buscar en cuentas de gasto (si existe esa colección)
    return 'Cuenta de Gasto';
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (mostrar) {
        loading.classList.add('show');
    } else {
        loading.classList.remove('show');
    }
}

// Exportar auditoría
function exportarAuditoria() {
    const filtrados = aplicarFiltros();
    
    // Crear CSV
    let csv = 'Producto,Código,Bodega,Stock Calculado,Stock Registrado,Diferencia,Estado\n';
    
    filtrados.forEach(resultado => {
        const estado = resultado.estado === 'correcto' ? 'Correcto' :
                      resultado.estado === 'discrepancia' ? 'Discrepancia' : 'Sin Movimientos';
        
        csv += `"${resultado.productoNombre}","${resultado.productoCodigo}","${resultado.bodegaNombre}",${resultado.stockCalculado},${resultado.stockActual},${resultado.diferencia},"${estado}"\n`;
    });
    
    // Descargar archivo
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_stock_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Hacer funciones globales
window.ejecutarAuditoria = ejecutarAuditoria;
window.exportarAuditoria = exportarAuditoria;
window.verDetallesMovimientos = verDetallesMovimientos;

