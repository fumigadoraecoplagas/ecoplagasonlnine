// Módulo de Operario de Bodega
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, addDoc, orderBy, doc, updateDoc, getDoc, serverTimestamp, increment, limit, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { procesarMovimientoInventario } from './inventario-movimientos-utils.js';
// showUserInfo y addLogoutButton ahora vienen de load-headersecure.js
// No necesitamos importarlos aquí

// Configuración de Firebase
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

// Usar la app de Firebase existente
let app, db;
try {
    app = getApp();
    db = getFirestore(app);
} catch (error) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
}

// ============================================
// FUNCIONES HELPER PARA NORMALIZAR FECHAS A GMT-6 (Costa Rica)
// ============================================

/**
 * Convierte una fecha a representar el tiempo en GMT-6 (Costa Rica)
 */
function fechaGMT6(fecha) {
    if (!fecha) {
        const ahora = new Date();
        const utcTime = ahora.getTime() + (ahora.getTimezoneOffset() * 60 * 1000);
        const gmt6Time = utcTime - (6 * 60 * 60 * 1000);
        return new Date(gmt6Time);
    }
    
    let fechaObj;
    if (fecha instanceof Date) {
        fechaObj = new Date(fecha);
    } else if (typeof fecha === 'string') {
        if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = fecha.split('-').map(Number);
            fechaObj = new Date(Date.UTC(year, month - 1, day, 6, 0, 0, 0));
        } else {
            fechaObj = new Date(fecha);
        }
    } else {
        fechaObj = new Date(fecha);
    }
    
    const utcTime = fechaObj.getTime() + (fechaObj.getTimezoneOffset() * 60 * 1000);
    const gmt6Time = utcTime - (6 * 60 * 60 * 1000);
    
    return new Date(gmt6Time);
}

function inicioDiaGMT6(fecha) {
    let fechaBase;
    if (typeof fecha === 'string' && fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Si es string YYYY-MM-DD, crear directamente a medianoche GMT-6
        const [year, month, day] = fecha.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 6, 0, 0, 0));
    }
    
    fechaBase = fechaGMT6(fecha);
    // fechaBase es un Date que representa GMT-6
    // Internamente, el timestamp es UTC
    // Para extraer el día correcto en GMT-6, necesitamos restar 6 horas del timestamp UTC
    // porque el timestamp UTC interno representa la hora GMT-6
    const utcTime = fechaBase.getTime() - (6 * 60 * 60 * 1000); // Restar 6 horas para obtener el día GMT-6
    const fechaGMT6ParaExtraer = new Date(utcTime);
    const año = fechaGMT6ParaExtraer.getUTCFullYear();
    const mes = fechaGMT6ParaExtraer.getUTCMonth();
    const día = fechaGMT6ParaExtraer.getUTCDate();
    // Crear nueva fecha a medianoche GMT-6 (6 AM UTC del día correcto)
    return new Date(Date.UTC(año, mes, día, 6, 0, 0, 0));
}

function finDiaGMT6(fecha) {
    const inicio = inicioDiaGMT6(fecha);
    return new Date(inicio.getTime() + (23 * 60 * 60 * 1000) + (59 * 60 * 1000) + (59 * 1000) + 999);
}

function ahoraGMT6() {
    return fechaGMT6(new Date());
}

function fechaSoloDiaGMT6(fecha) {
    // Usar inicioDiaGMT6 para obtener el inicio del día en GMT-6
    // y luego extraer los componentes UTC (que representan el día correcto en GMT-6)
    const inicioDia = inicioDiaGMT6(fecha);
    const año = inicioDia.getUTCFullYear();
    const mes = String(inicioDia.getUTCMonth() + 1).padStart(2, '0');
    const día = String(inicioDia.getUTCDate()).padStart(2, '0');
    return `${año}-${mes}-${día}`;
}

// Variables globales
let currentUser = null;
let miBodeguita = null;
let misBodegas = []; // Array para almacenar todas las bodegas del empleado
let todasBodegasAPV = []; // Array para almacenar todas las bodegas APV
let productos = [];
let herramientas = []; // Array para almacenar herramientas
let stockBodeguita = [];
let stockHerramientas = []; // Array para almacenar stock de herramientas
let stockTodasAPV = []; // Array para almacenar stock de todas las bodegas APV
let cuentasGasto = []; // Array para almacenar cuentas de gasto

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 [OPERARIO_BODEGA_SECURE] Iniciando módulo de operario de bodega...');
    
    // Verificar que el body esté autenticado (ya verificado en el head)
    if (document.body && !document.body.classList.contains('authenticated')) {
        console.log('⏳ [OPERARIO_BODEGA_SECURE] Esperando verificación de autenticación del head...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!document.body.classList.contains('authenticated')) {
            if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
                console.log('❌ [OPERARIO_BODEGA_SECURE] No autenticado, redirigiendo...');
                if (!window.location.pathname.includes('iniciar_sesion.html')) {
                    window.location.replace('iniciar_sesion.html');
                }
                return;
            } else {
                document.body.style.display = 'block';
                document.body.classList.add('authenticated');
            }
        }
    }
    
    // Esperar a secureAuthManager
    if (!window.secureAuthManager) {
        let retries = 0;
        while (!window.secureAuthManager && retries < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
    }
    
    if (window.secureAuthManager) {
        window.authManager = window.secureAuthManager;
    }
    
    // Verificar autenticación
    if (window.authManager) {
        currentUser = window.authManager.getCurrentUser();
        if (!currentUser) {
            console.log('❌ [OPERARIO_BODEGA_SECURE] No se pudo obtener usuario');
            if (!window.location.pathname.includes('iniciar_sesion.html')) {
                window.location.replace('iniciar_sesion.html');
            }
            return;
        }
        
        // Verificar permisos
        if (!currentUser.permisos?.operario_bodega) {
            alert('No tienes permisos para acceder a este módulo');
            window.location.href = 'registro_horas.html';
            return;
        }
        
        console.log('✅ [OPERARIO_BODEGA_SECURE] Usuario autenticado:', currentUser.nombre);
        await cargarDatos();
    } else {
        console.log('⏳ [OPERARIO_BODEGA_SECURE] Esperando authManager...');
        setTimeout(async () => {
            if (window.authManager) {
                currentUser = window.authManager.getCurrentUser();
                if (currentUser) {
                    await cargarDatos();
                } else {
                    if (!window.location.pathname.includes('iniciar_sesion.html')) {
                        window.location.replace('iniciar_sesion.html');
                    }
                }
            }
        }, 1000);
    }
});

// Cargar datos iniciales
async function cargarDatos() {
    try {
        console.log('📦 Cargando datos de bodeguita...');
        
        // Buscar mi bodeguita (bodega rutero asignada al empleado)
        // Buscar bodegas donde el empleado es responsable (rutero, especial o APV)
        const bodegasQuery = query(
            collection(db, 'bodegas'),
            where('empleadoId', '==', currentUser.id)
        );
        const bodegasSnapshot = await getDocs(bodegasQuery);
        
        if (bodegasSnapshot.empty) {
            console.log('⚠️ No se encontró bodeguita personal para el empleado');
            console.log('📝 Continuando con carga de datos (bodegas APV, productos, herramientas, etc.)');
            misBodegas = [];
            miBodeguita = null;
            // No retornar, continuar cargando otros datos
        } else {
            // Cargar todas las bodegas del empleado (rutero y especial)
            misBodegas = bodegasSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Usar la primera bodega como principal (para compatibilidad)
            miBodeguita = misBodegas[0];
            
            console.log('✅ Bodegas encontradas:', misBodegas.length);
            console.log('📊 Bodegas del empleado:', misBodegas.map(b => `${b.nombre} (${b.tipo})`));
            console.log('✅ Bodeguita principal:', miBodeguita.nombre, 'Tipo:', miBodeguita.tipo);
        }
        
        // Cargar productos
        await cargarProductos();
        
        // Cargar herramientas
        await cargarHerramientas();
        
        // Cargar cuentas de gasto
        await cargarCuentasGasto();
        
        // Cargar todas las bodegas APV
        await cargarTodasBodegasAPV();
        
        // Cargar stock de mi bodeguita
        await cargarStockBodeguita();
        
        // Cargar stock de herramientas
        await cargarStockHerramientas();
        
        // Cargar stock de todas las bodegas APV
        await cargarStockTodasAPV();
        
        // Llenar select de productos DESPUÉS de cargar el stock
        llenarSelectProductos();
        
        // Cargar resumen
        await cargarResumen();
        
        // Cargar nuevas secciones
        await mostrarReporteItems();
        await cargarGastosPorAuditar();
        await cargarGastosAuditados();
        await cargarTransaccionesRecientes();
        
        // Configurar búsqueda
        configurarBusqueda();
        
        console.log('✅ Datos cargados exitosamente');
        
        // Mostrar tabla de productos
        mostrarTablaProductos();
        
    } catch (error) {
        console.error('❌ Error cargando datos:', error);
        mostrarMensaje('Error cargando datos de bodeguita', 'danger');
    }
}

// Cargar productos
async function cargarProductos() {
    try {
        console.log('🛍️ Cargando productos...');
        const productosQuery = query(collection(db, 'productos'), where('activo', '==', true));
        const productosSnapshot = await getDocs(productosQuery);
        
        productos = productosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('✅ Productos cargados:', productos.length);
        console.log('📊 Lista de productos:', productos);
        
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
    }
}

// Cargar herramientas
async function cargarHerramientas() {
    try {
        console.log('🔧 Cargando herramientas...');
        const herramientasQuery = query(collection(db, 'herramientas'));
        const herramientasSnapshot = await getDocs(herramientasQuery);
        
        herramientas = herramientasSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('✅ Herramientas cargadas:', herramientas.length);
        
    } catch (error) {
        console.error('❌ Error cargando herramientas:', error);
    }
}

// Cargar cuentas de gasto
async function cargarCuentasGasto() {
    try {
        console.log('💰 Cargando cuentas de gasto...');
        const cuentasGastoQuery = query(
            collection(db, 'cuentas_gasto'),
            where('activo', '==', true)
        );
        const cuentasGastoSnapshot = await getDocs(cuentasGastoQuery);
        
        cuentasGasto = cuentasGastoSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('✅ Cuentas de gasto cargadas:', cuentasGasto.length);
        
    } catch (error) {
        console.error('❌ Error cargando cuentas de gasto:', error);
    }
}

// Cargar todas las bodegas APV
async function cargarTodasBodegasAPV() {
    try {
        console.log('🚛 Cargando todas las bodegas APV...');
        const bodegasAPVQuery = query(
            collection(db, 'bodegas'),
            where('tipo', '==', 'apv')
        );
        const bodegasAPVSnapshot = await getDocs(bodegasAPVQuery);
        
        todasBodegasAPV = bodegasAPVSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Ordenar alfabéticamente por nombre
        todasBodegasAPV.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        
        console.log('✅ Bodegas APV cargadas:', todasBodegasAPV.length);
        console.log('📊 Lista de bodegas APV:', todasBodegasAPV.map(b => b.nombre));
        
    } catch (error) {
        console.error('❌ Error cargando bodegas APV:', error);
        mostrarMensaje('Error cargando bodegas APV', 'danger');
    }
}

// Cargar stock de todas las bodegas APV
async function cargarStockTodasAPV() {
    try {
        console.log('📦 Cargando stock de todas las bodegas APV...');
        stockTodasAPV = [];
        
        for (const bodega of todasBodegasAPV) {
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodega.id)
            );
            const stockSnapshot = await getDocs(stockQuery);
            
            const stockBodega = stockSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                bodegaNombre: bodega.nombre,
                bodegaId: bodega.id
            }));
            
            stockTodasAPV = stockTodasAPV.concat(stockBodega);
        }
        
        console.log('✅ Stock de todas las APV cargado:', stockTodasAPV.length, 'registros');
        
        // Actualizar el contenedor de APV
        mostrarInventarioAPV();
        
    } catch (error) {
        console.error('❌ Error cargando stock de todas las APV:', error);
        mostrarMensaje('Error cargando stock de bodegas APV', 'danger');
        
        // Asegurar que el contenedor se actualice incluso si hay error
        const contenedor = document.getElementById('contenedorBodegasAPV');
        if (contenedor) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(contenedor, '<div class="text-center text-danger py-3"><i class="fas fa-exclamation-triangle fa-lg mb-2"></i><div>Error cargando bodegas APV</div></div>', true);
            } else {
                contenedor.innerHTML = '<div class="text-center text-danger py-3"><i class="fas fa-exclamation-triangle fa-lg mb-2"></i><div>Error cargando bodegas APV</div></div>';
            }
        }
    }
}

// Cargar stock de todas las bodegas del empleado
async function cargarStockBodeguita() {
    try {
        console.log('📦 Cargando stock de todas las bodegas del empleado...');
        
        stockBodeguita = [];
        
        // Si no hay bodegas, no cargar stock
        if (!misBodegas || misBodegas.length === 0) {
            console.log('⚠️ No hay bodegas personales, saltando carga de stock');
            mostrarTablaProductos(); // Mostrar tabla vacía
            return;
        }
        
        // Cargar stock de cada bodega del empleado (solo productos, no herramientas)
        for (const bodega of misBodegas) {
            // Solo cargar stock de productos (excluir bodegas de herramientas)
            if (bodega.tipo === 'herramientas') {
                continue;
            }
            
            console.log(`🔍 Cargando stock de bodega: ${bodega.nombre} (${bodega.tipo})`);
        
        const stockQuery = query(
            collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodega.id)
        );
        const stockSnapshot = await getDocs(stockQuery);
        
            const stockBodega = stockSnapshot.docs
                .filter(doc => doc.data().productoId && !doc.data().herramientaId) // Solo productos, excluir herramientas
                .map(doc => ({
            id: doc.id,
                ...doc.data(),
                bodegaNombre: bodega.nombre,
                bodegaTipo: bodega.tipo
            }));
            
            stockBodeguita = stockBodeguita.concat(stockBodega);
            console.log(`✅ Stock cargado de ${bodega.nombre}:`, stockBodega.length, 'productos');
        }
        
        console.log('✅ Stock total cargado:', stockBodeguita.length, 'productos');
        console.log('📊 Datos de stock:', stockBodeguita);
        
        // Mostrar tabla de productos
        mostrarTablaProductos();
        
    } catch (error) {
        console.error('❌ Error cargando stock:', error);
    }
}

// Cargar stock de herramientas de bodegas de herramientas y especiales
async function cargarStockHerramientas() {
    try {
        console.log('🔧 Cargando stock de herramientas...');
        
        stockHerramientas = [];
        
        // Si no hay bodegas, no cargar stock
        if (!misBodegas || misBodegas.length === 0) {
            console.log('⚠️ No hay bodegas personales, saltando carga de stock de herramientas');
            mostrarInventarioHerramientas(); // Mostrar inventario vacío
            return;
        }
        
        // Filtrar bodegas de tipo "herramientas" (rutero) y "especial" (para devolución)
        const bodegasHerramientas = misBodegas.filter(b => b.tipo === 'herramientas');
        const bodegasEspeciales = misBodegas.filter(b => b.tipo === 'especial');
        
        // Cargar stock de bodegas de herramientas (rutero)
        for (const bodega of bodegasHerramientas) {
            console.log(`🔍 Cargando stock de herramientas de bodega: ${bodega.nombre}`);
        
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodega.id)
            );
            const stockSnapshot = await getDocs(stockQuery);
            
            const stockBodega = stockSnapshot.docs
                .filter(doc => doc.data().herramientaId) // Solo herramientas
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    bodegaNombre: bodega.nombre,
                    bodegaTipo: bodega.tipo
                }));
            
            stockHerramientas = stockHerramientas.concat(stockBodega);
            console.log(`✅ Stock de herramientas cargado de ${bodega.nombre}:`, stockBodega.length);
        }
        
        // Cargar stock de bodegas especiales (para devolución)
        for (const bodega of bodegasEspeciales) {
            console.log(`🔍 Cargando stock de herramientas de bodega especial: ${bodega.nombre}`);
        
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodega.id)
            );
            const stockSnapshot = await getDocs(stockQuery);
            
            const stockBodega = stockSnapshot.docs
                .filter(doc => doc.data().herramientaId) // Solo herramientas
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    bodegaNombre: bodega.nombre,
                    bodegaTipo: bodega.tipo,
                    bodegaId: bodega.id
                }));
            
            stockHerramientas = stockHerramientas.concat(stockBodega);
            console.log(`✅ Stock de herramientas cargado de bodega especial ${bodega.nombre}:`, stockBodega.length);
        }
        
        console.log('✅ Stock total de herramientas cargado:', stockHerramientas.length);
        
        // Mostrar inventario de herramientas
        mostrarInventarioHerramientas();
        
    } catch (error) {
        console.error('❌ Error cargando stock de herramientas:', error);
    }
}

// Cargar resumen
async function cargarResumen() {
    try {
        let valorTotal = 0;
        let totalProductos = 0;
        let productosStockBajo = 0;
        let gastoTotal = 0;
        
        // Calcular valores del stock
        for (const stock of stockBodeguita) {
            const producto = productos.find(p => p.id === stock.productoId);
            if (producto) {
                const valor = (stock.stockActual || 0) * (producto.precioUnitario || 0);
                valorTotal += valor;
                totalProductos++;
                
                if ((stock.stockActual || 0) <= (producto.stockMinimo || 0)) {
                    productosStockBajo++;
                }
            }
        }
        
        // Calcular gasto total (movimientos de salida)
        let gastosSnapshot = { size: 0 };
        if (miBodeguita && miBodeguita.id) {
            const gastosQuery = query(
                collection(db, 'movimientos_inventario'),
                where('bodegaDestino', '==', miBodeguita.id),
                where('tipo', '==', 'gasto')
            );
            gastosSnapshot = await getDocs(gastosQuery);
            
            gastosSnapshot.forEach(doc => {
                gastoTotal += doc.data().total || 0;
            });
        } else {
            console.log('⚠️ No hay bodeguita principal, saltando cálculo de gastos');
        }
        
        // Actualizar UI (SIN VALORES MONETARIOS)
        const totalProductosEl = document.getElementById('totalProductos');
        if (totalProductosEl) {
            totalProductosEl.textContent = totalProductos;
        }
        
        const productosStockBajoEl = document.getElementById('productosStockBajo');
        if (productosStockBajoEl) {
            productosStockBajoEl.textContent = productosStockBajo;
        }
        
        const totalGastosEl = document.getElementById('totalGastos');
        if (totalGastosEl) {
            totalGastosEl.textContent = gastosSnapshot.size; // Solo cantidad de gastos, no valor
        }
        
    } catch (error) {
        console.error('❌ Error cargando resumen:', error);
    }
}

// Llenar select de productos
function llenarSelectProductos() {
    console.log('🔍 Llenando select de productos...');
    console.log('📦 Stock bodeguita length:', stockBodeguita.length);
    console.log('🛍️ Productos length:', productos.length);
    console.log('📦 Stock bodeguita:', stockBodeguita);
    console.log('🛍️ Productos disponibles:', productos);
    
    // Llenar select de productos para gasto rutero
    const selectRutero = document.getElementById('productoGastoRutero');
    if (selectRutero) {
        // Sanitizar: usar textContent para opciones estáticas
        selectRutero.innerHTML = '';
        const optionDefault = document.createElement('option');
        optionDefault.value = '';
        optionDefault.textContent = 'Seleccionar producto...';
        selectRutero.appendChild(optionDefault);
        
        // Solo mostrar productos que tienen stock en mi bodeguita
        const productosConStock = stockBodeguita.filter(stock => (stock.stockActual || 0) > 0);
        
        console.log('📊 Productos con stock > 0:', productosConStock.length);
        
        productosConStock.forEach(stock => {
            const producto = productos.find(p => p.id === stock.productoId);
            console.log('🔍 Buscando producto:', stock.productoId, 'Encontrado:', producto);
            if (producto) {
                const option = document.createElement('option');
                option.value = producto.id;
                option.textContent = `${producto.nombre} (Stock: ${stock.stockActual || 0} ${producto.unidad || 'unidades'})`;
                selectRutero.appendChild(option);
                console.log('✅ Agregado al select rutero:', producto.nombre);
            }
        });
        
        console.log('✅ Productos disponibles para gasto rutero:', productosConStock.length);
        console.log('📋 Opciones en select rutero:', selectRutero.options.length);
    } else {
        console.error('❌ Elemento productoGastoRutero no encontrado');
    }
    
    // Llenar select de productos para gasto APV
    const selectAPV = document.getElementById('productoGastoAPV');
    if (selectAPV) {
        // Sanitizar: usar textContent para opciones estáticas
        selectAPV.innerHTML = '';
        const optionDefault = document.createElement('option');
        optionDefault.value = '';
        optionDefault.textContent = 'Seleccionar producto...';
        selectAPV.appendChild(optionDefault);
        
        // Solo mostrar productos que tienen stock en mi bodeguita
        const productosConStock = stockBodeguita.filter(stock => (stock.stockActual || 0) > 0);
        
        productosConStock.forEach(stock => {
            const producto = productos.find(p => p.id === stock.productoId);
            if (producto) {
                const option = document.createElement('option');
                option.value = producto.id;
                option.textContent = `${producto.nombre} (Stock: ${stock.stockActual || 0} ${producto.unidad || 'unidades'})`;
                selectAPV.appendChild(option);
                console.log('✅ Agregado al select APV:', producto.nombre);
            }
        });
        
        console.log('✅ Productos disponibles para gasto APV:', productosConStock.length);
        console.log('📋 Opciones en select APV:', selectAPV.options.length);
    } else {
        console.error('❌ Elemento productoGastoAPV no encontrado');
    }
}

// Mostrar productos separados por tipo de bodega
function mostrarTablaProductos() {
    mostrarInventarioRutero();
    mostrarInventarioEspecialPorDia();
    mostrarInventarioAPV();
}

// Mostrar inventario de herramientas
function mostrarInventarioHerramientas() {
    const container = document.getElementById('tablaInventarioHerramientas');
    if (!container) {
        console.log('⚠️ Elemento tablaInventarioHerramientas no encontrado');
        return;
    }
    container.innerHTML = '';
    
    // Filtrar herramientas con stock > 0
    const herramientasConStock = stockHerramientas.filter(stock => 
        (stock.stockActual || 0) > 0
    );
    
    if (herramientasConStock.length === 0) {
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-tools fa-lg mb-2"></i><div>No tienes herramientas asignadas</div></td></tr>', true);
        } else {
            container.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-tools fa-lg mb-2"></i><div>No tienes herramientas asignadas</div></td></tr>';
        }
        return;
    }
    
    // Filtrar solo herramientas de bodegas especiales (las que se pueden devolver)
    const herramientasEspeciales = herramientasConStock.filter(stock => stock.bodegaTipo === 'especial');
    
    // Agrupar herramientas por nombre y bodega (para poder devolver desde la bodega correcta)
    const herramientasAgrupadas = {};
    herramientasEspeciales.forEach(stock => {
        const herramienta = herramientas.find(h => h.id === stock.herramientaId);
        if (herramienta) {
            // Clave única: nombre + bodegaId (para diferenciar si está en múltiples bodegas especiales)
            const clave = `${herramienta.nombre}_${stock.bodegaId}`;
            if (!herramientasAgrupadas[clave]) {
                herramientasAgrupadas[clave] = {
                    nombre: herramienta.nombre,
                    herramientaId: herramienta.id,
                    bodegaId: stock.bodegaId,
                    bodegaNombre: stock.bodegaNombre,
                    cantidadTotal: 0
                };
            }
            herramientasAgrupadas[clave].cantidadTotal += (stock.stockActual || 0);
        }
    });
    
    // Convertir a array y ordenar por nombre
    const herramientasArray = Object.values(herramientasAgrupadas).sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
    
    // Generar filas de la tabla
    herramientasArray.forEach(herramienta => {
        const row = document.createElement('tr');
        const herramientaNombreSanitizado = window.escapeHTML ? window.escapeHTML(herramienta.nombre || '') : (herramienta.nombre || '');
        
        if (window.setSafeInnerHTML) {
            const rowHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                    <span class="badge fs-6" style="background-color: #1976d2; color: white;">${herramienta.cantidadTotal}</span>
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #0d47a1;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${herramientaNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                    <button class="btn btn-sm" onclick="abrirDevolucionHerramienta('${herramienta.nombre.replace(/'/g, "\\'")}', ${herramienta.cantidadTotal}, '${herramienta.bodegaId}', '${herramienta.herramientaId}')" title="Devolver a Bodega Principal Herramientas" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #28a745; color: white; border-color: #28a745;">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            `;
            window.setSafeInnerHTML(row, rowHTML, true);
        } else {
            row.innerHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                    <span class="badge fs-6" style="background-color: #1976d2; color: white;">${herramienta.cantidadTotal}</span>
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #0d47a1;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${herramientaNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                    <button class="btn btn-sm" onclick="abrirDevolucionHerramienta('${herramienta.nombre.replace(/'/g, "\\'")}', ${herramienta.cantidadTotal}, '${herramienta.bodegaId}', '${herramienta.herramientaId}')" title="Devolver a Bodega Principal Herramientas" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #28a745; color: white; border-color: #28a745;">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            `;
        }
        container.appendChild(row);
    });
    
    console.log('✅ Inventario de herramientas actualizado:', herramientasArray.length, 'herramientas');
}

// Mostrar inventario personal combinado (rutero + especial)
function mostrarInventarioPersonalCombinado() {
    const container = document.getElementById('tablaInventarioPersonal');
    if (!container) {
        console.error('❌ Elemento tablaInventarioPersonal no encontrado');
        return;
    }
    // Limpiar contenedor - seguro (vacío)
    container.innerHTML = '';
    
    // Combinar productos de rutero y especial
    const productosRutero = stockBodeguita.filter(stock => 
        stock.bodegaTipo === 'rutero' && (stock.stockActual || 0) > 0
    );
    
    const productosEspecial = stockBodeguita.filter(stock => 
        stock.bodegaTipo === 'especial' && (stock.stockActual || 0) > 0
    );
    
    const todosProductos = [...productosRutero, ...productosEspecial];
    
    if (todosProductos.length === 0) {
        // Sanitizar: HTML estático seguro
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div>No tienes productos en tus bodegas</div></td></tr>', true);
        } else {
            container.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div>No tienes productos en tus bodegas</div></td></tr>';
        }
        return;
    }
    
    // Agrupar productos por nombre y tipo, sumar cantidades
    const productosAgrupados = {};
    todosProductos.forEach(stock => {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto) {
            const clave = producto.nombre;
            if (!productosAgrupados[clave]) {
                productosAgrupados[clave] = {
                    nombre: producto.nombre,
                    cantidadRutero: 0,
                    cantidadEspecial: 0,
                    cantidadTotal: 0,
                    tieneRutero: false,
                    tieneEspecial: false
                };
            }
            
            if (stock.bodegaTipo === 'rutero') {
                productosAgrupados[clave].cantidadRutero += (stock.stockActual || 0);
                productosAgrupados[clave].tieneRutero = true;
            } else if (stock.bodegaTipo === 'especial') {
                productosAgrupados[clave].cantidadEspecial += (stock.stockActual || 0);
                productosAgrupados[clave].tieneEspecial = true;
            }
            
            productosAgrupados[clave].cantidadTotal += (stock.stockActual || 0);
        }
    });
    
    // Convertir a array y ordenar por tipo de bodega primero, luego por nombre
    const productosArray = Object.values(productosAgrupados).sort((a, b) => {
        // Primero ordenar por tipo de bodega: rutero primero, luego especial
        if (a.tieneRutero && !b.tieneRutero) return -1; // a va primero (rutero)
        if (!a.tieneRutero && b.tieneRutero) return 1;  // b va primero (rutero)
        
        // Si ambos tienen el mismo tipo o ambos tienen ambos tipos, ordenar por nombre
        return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });
    
    // Generar filas de la tabla
    productosArray.forEach(producto => {
        const row = document.createElement('tr');
        
        // Determinar el color de fondo de la fila según el tipo principal
        let rowClass = '';
        if (producto.tieneRutero && producto.tieneEspecial) {
            rowClass = 'table-light'; // Gris claro para productos que están en ambos
        } else if (producto.tieneRutero) {
            rowClass = 'table-success'; // Verde para rutero
        } else if (producto.tieneEspecial) {
            rowClass = 'table-warning'; // Amarillo para especial
        }
        
        // Crear iconos según el tipo de bodega con colores diferenciados
        let iconosHtml = '';
        if (producto.tieneRutero && producto.tieneEspecial) {
            iconosHtml = `
                <span class="badge bg-success fs-6 me-1" title="Rutero: ${producto.cantidadRutero}">
                    <i class="fas fa-user-tie"></i> ${producto.cantidadRutero}
                </span>
                <span class="badge bg-warning fs-6" title="Especial: ${producto.cantidadEspecial}">
                    <i class="fas fa-clock"></i> ${producto.cantidadEspecial}
                </span>
            `;
        } else if (producto.tieneRutero) {
            iconosHtml = `
                <span class="badge bg-success fs-6" title="Rutero: ${producto.cantidadRutero}">
                    <i class="fas fa-user-tie"></i> ${producto.cantidadRutero}
                </span>
            `;
        } else if (producto.tieneEspecial) {
            iconosHtml = `
                <span class="badge bg-warning fs-6" title="Especial: ${producto.cantidadEspecial}">
                    <i class="fas fa-clock"></i> ${producto.cantidadEspecial}
                </span>
            `;
        }
        
        // Sanitizar datos del producto antes de renderizar
        const productoNombreSanitizado = window.escapeHTML ? window.escapeHTML(producto.nombre) : producto.nombre;
        const productoNombreEscapado = productoNombreSanitizado.replace(/'/g, "\\'");
        
        row.className = rowClass;
        if (window.setSafeInnerHTML) {
            const rowHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem;">
                    ${iconosHtml}
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem;">
                    <button class="btn btn-outline-secondary btn-sm" onclick="abrirModalGastoRutero('${productoNombreEscapado}', ${producto.cantidadTotal})" title="Reportar Gasto">
                        <i class="fas fa-receipt"></i>
                    </button>
                </td>
            `;
            window.setSafeInnerHTML(row, rowHTML, true);
        } else {
            row.innerHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem;">
                    ${iconosHtml}
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem;">
                    <button class="btn btn-outline-secondary btn-sm" onclick="abrirModalGastoRutero('${productoNombreEscapado}', ${producto.cantidadTotal})" title="Reportar Gasto">
                        <i class="fas fa-receipt"></i>
                    </button>
                </td>
            `;
        }
        container.appendChild(row);
    });
    
    console.log('✅ Inventario personal combinado actualizado:', productosArray.length, 'productos');
}

// Mostrar inventario personal (rutero)
async function mostrarInventarioRutero() {
    const container = document.getElementById('tablaInventarioRutero');
    if (!container) {
        console.error('❌ Elemento tablaInventarioRutero no encontrado');
        return;
    }
    container.innerHTML = '';
    
    // Filtrar productos de bodegas rutero
    const productosRutero = stockBodeguita.filter(stock => 
        stock.bodegaTipo === 'rutero' && (stock.stockActual || 0) > 0
    );
    
    if (productosRutero.length === 0) {
        // Sanitizar: HTML estático seguro
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-user-slash fa-lg mb-2"></i><div>No tienes productos en tu bodega rutero</div></td></tr>', true);
        } else {
            container.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3"><i class="fas fa-user-slash fa-lg mb-2"></i><div>No tienes productos en tu bodega rutero</div></td></tr>';
        }
        return;
    }
    
    // Agrupar productos por nombre y sumar cantidades
    const productosAgrupados = {};
    productosRutero.forEach(stock => {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto) {
            const clave = producto.nombre;
            if (!productosAgrupados[clave]) {
                productosAgrupados[clave] = {
                    nombre: producto.nombre,
                    cantidadTotal: 0
                };
            }
            productosAgrupados[clave].cantidadTotal += (stock.stockActual || 0);
        }
    });
    
    // Convertir a array y ordenar por nombre
    const productosArray = Object.values(productosAgrupados).sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
    
    // Generar filas de la tabla
    productosArray.forEach(producto => {
        const row = document.createElement('tr');
        row.style.backgroundColor = '#ffffff';
        // Sanitizar datos del producto antes de renderizar
        const productoNombreSanitizado = window.escapeHTML ? window.escapeHTML(producto.nombre) : producto.nombre;
        const productoNombreEscapado = productoNombreSanitizado.replace(/'/g, "\\'");
        
        if (window.setSafeInnerHTML) {
            const rowHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                    <span class="badge fs-6" style="background-color: #1976d2; color: white;">${producto.cantidadTotal}</span>
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #0d47a1;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                    <button class="btn btn-sm" onclick="abrirLiquidacionRutero('${producto.nombre.replace(/'/g, "\\'")}', ${producto.cantidadTotal})" title="Liquidar" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #1976d2; color: white; border-color: #1976d2;">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </td>
            `;
            window.setSafeInnerHTML(row, rowHTML, true);
        } else {
            row.innerHTML = `
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                    <span class="badge fs-6" style="background-color: #1976d2; color: white;">${producto.cantidadTotal}</span>
                </td>
                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #0d47a1;">
                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreSanitizado}</div>
                </td>
                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                    <button class="btn btn-sm" onclick="abrirLiquidacionRutero('${producto.nombre.replace(/'/g, "\\'")}', ${producto.cantidadTotal})" title="Liquidar" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #1976d2; color: white; border-color: #1976d2;">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                </td>
            `;
        }
        container.appendChild(row);
    });
    
    console.log('✅ Inventario rutero actualizado:', productosArray.length, 'productos');
}

// Mostrar inventario especial con neteo por día contable
async function mostrarInventarioEspecialPorDia() {
    const container = document.getElementById('inventarioEspecialPorDia');
    if (!container) {
        console.error('❌ Elemento inventarioEspecialPorDia no encontrado');
        return;
    }
    
    container.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-spinner fa-spin me-2"></i>Cargando...</div>';
    
    try {
        // Obtener bodegas especiales del empleado
        const bodegasEspeciales = misBodegas.filter(b => b.tipo === 'especial');
        
        if (bodegasEspeciales.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(container, '<div class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div>No tienes bodegas especiales asignadas</div></div>', true);
            } else {
                container.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div>No tienes bodegas especiales asignadas</div></div>';
            }
            return;
        }
        
        const bodegasEspecialesIds = bodegasEspeciales.map(b => b.id);
        const bodegasEspecialesSet = new Set(bodegasEspecialesIds);
        
        // Cargar todos los movimientos (filtrar en cliente para evitar límite de 'in')
        console.log('📦 Cargando movimientos para bodegas especiales...');
        const movimientosQuery = query(
            collection(db, 'movimientos_inventario'),
            orderBy('fecha', 'desc')
        );
        const movimientosSnapshot = await getDocs(movimientosQuery);
        
        // Filtrar movimientos relacionados con bodegas especiales del empleado
        const movimientosRelevantes = movimientosSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(mov => {
                const esEntrada = bodegasEspecialesSet.has(mov.destino) && 
                                 (mov.tipo === 'transferencia' || mov.tipo === 'compra');
                const esSalida = bodegasEspecialesSet.has(mov.origen) && 
                                (mov.tipo === 'gasto' || mov.tipo === 'transferencia' || 
                                 (mov.tipo === 'reversion' && mov.tipoOriginal === 'gasto'));
                return esEntrada || esSalida;
            });
        
        console.log(`✅ ${movimientosRelevantes.length} movimientos relevantes encontrados`);
        
        // Agrupar movimientos por producto, bodega y día contable
        const movimientosPorProductoBodegaDia = {};
        
        movimientosRelevantes.forEach(mov => {
            // Determinar si es entrada o salida
            const esEntrada = bodegasEspecialesSet.has(mov.destino) && 
                             (mov.tipo === 'transferencia' || mov.tipo === 'compra');
            const esSalida = bodegasEspecialesSet.has(mov.origen) && 
                            (mov.tipo === 'gasto' || mov.tipo === 'transferencia' || 
                             (mov.tipo === 'reversion' && mov.tipoOriginal === 'gasto'));
            
            if (!esEntrada && !esSalida) return;
            
            // Obtener fecha contable en GMT-6
            const fechaMov = mov.fecha?.toDate ? fechaGMT6(mov.fecha.toDate()) : (mov.fecha ? fechaGMT6(mov.fecha) : ahoraGMT6());
            const diaContable = fechaSoloDiaGMT6(fechaMov);
            
            const productoId = mov.productoId;
            const bodegaId = esEntrada ? mov.destino : mov.origen;
            
            if (!productoId || !bodegaId) return;
            
            const clave = `${productoId}_${bodegaId}_${diaContable}`;
            if (!movimientosPorProductoBodegaDia[clave]) {
                movimientosPorProductoBodegaDia[clave] = {
                    productoId,
                    bodegaId,
                    diaContable,
                    entradas: 0,
                    salidas: 0,
                    saldo: 0
                };
            }
            
            if (esEntrada) {
                movimientosPorProductoBodegaDia[clave].entradas += (mov.cantidad || 0);
            } else if (esSalida) {
                // Para reversiones que revierten gastos, restan de las salidas
                if (mov.tipo === 'reversion' && mov.tipoOriginal === 'gasto') {
                    movimientosPorProductoBodegaDia[clave].salidas -= (mov.cantidad || 0);
                } else {
                    movimientosPorProductoBodegaDia[clave].salidas += (mov.cantidad || 0);
                }
            }
            
            movimientosPorProductoBodegaDia[clave].saldo = 
                movimientosPorProductoBodegaDia[clave].entradas - movimientosPorProductoBodegaDia[clave].salidas;
        });
        
        // Agrupar por día contable primero, luego por producto
        const diasPorFecha = {};
        Object.values(movimientosPorProductoBodegaDia).forEach(datos => {
            const producto = productos.find(p => p.id === datos.productoId);
            if (!producto) return;
            
            const diaContable = datos.diaContable;
            if (!diasPorFecha[diaContable]) {
                diasPorFecha[diaContable] = {
                    diaContable: diaContable,
                    productos: {}
                };
            }
            
            const claveProducto = datos.productoId;
            if (!diasPorFecha[diaContable].productos[claveProducto]) {
                diasPorFecha[diaContable].productos[claveProducto] = {
                    productoId: datos.productoId,
                    productoNombre: producto.nombre,
                    bodegaId: datos.bodegaId,
                    entradas: 0,
                    salidas: 0,
                    saldo: 0
                };
            }
            
            diasPorFecha[diaContable].productos[claveProducto].entradas += datos.entradas;
            diasPorFecha[diaContable].productos[claveProducto].salidas += datos.salidas;
            diasPorFecha[diaContable].productos[claveProducto].saldo += datos.saldo;
        });
        
        // Generar HTML agrupado por fecha contable
        let html = '';
        const diasArray = Object.values(diasPorFecha).sort((a, b) => 
            b.diaContable.localeCompare(a.diaContable) // Más reciente primero
        );
        
        if (diasArray.length === 0) {
            html = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-box-open fa-lg mb-2"></i>
                    <div>No hay movimientos en tus bodegas especiales</div>
                </div>
            `;
        } else {
            // Mostrar el botón de neteados si hay productos neteados
            const tieneNeteados = diasArray.some(dia => {
                const productosArray = Object.values(dia.productos);
                return productosArray.some(p => p.saldo === 0);
            });
            
            if (tieneNeteados) {
                const toggleBtn = document.getElementById('toggleSaldoCero');
                if (toggleBtn) {
                    toggleBtn.style.display = 'block';
                }
            }
            
            diasArray.forEach(dia => {
                // Filtrar días con más de 7 días de antigüedad
                const ahora = ahoraGMT6();
                const hoyDiaString = fechaSoloDiaGMT6(ahora);
                const fechaDiaString = dia.diaContable;
                
                // Calcular diferencia en días usando strings YYYY-MM-DD
                const hoyParts = hoyDiaString.split('-');
                const fechaParts = fechaDiaString.split('-');
                const hoyDate = new Date(parseInt(hoyParts[0]), parseInt(hoyParts[1]) - 1, parseInt(hoyParts[2]));
                const fechaDate = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));
                const diasDiferencia = Math.floor((hoyDate.getTime() - fechaDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diasDiferencia > 7) {
                    return; // Saltar días con más de 7 días de antigüedad
                }
                
                // Verificar si es hoy
                const esHoy = fechaDiaString === hoyDiaString;
                
                // Formatear fecha para mostrar (usar fechaParts ya declarado)
                const año = parseInt(fechaParts[0]);
                const mes = parseInt(fechaParts[1]) - 1;
                const día = parseInt(fechaParts[2]);
                const fechaObj = new Date(Date.UTC(año, mes, día));
                
                // Formato corto de fecha (siempre)
                const fechaCorta = fechaObj.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
                
                // Generar etiqueta relativa con fecha corta
                let fechaStr = '';
                if (diasDiferencia === 0) {
                    fechaStr = `Hoy (${fechaCorta})`;
                } else if (diasDiferencia === 1) {
                    fechaStr = `Ayer (${fechaCorta})`;
                } else if (diasDiferencia === 2) {
                    fechaStr = `Antier (${fechaCorta})`;
                } else if (diasDiferencia === -1) {
                    fechaStr = `Mañana (${fechaCorta})`;
                } else if (diasDiferencia === -2) {
                    fechaStr = `Pasado Mañana (${fechaCorta})`;
                } else {
                    // Para fechas más lejanas, solo fecha corta
                    fechaStr = fechaCorta;
                }
                
                // Separar productos con saldo diferente de 0 y productos neteados
                const productosArray = Object.values(dia.productos);
                const productosConSaldo = productosArray.filter(p => p.saldo !== 0);
                const productosNeteados = productosArray.filter(p => p.saldo === 0);
                
                // Solo mostrar la fecha si tiene productos con saldo (no mostrar si solo hay neteados)
                if (productosConSaldo.length === 0) {
                    return; // Saltar fechas sin productos con saldo (se mostrarán con el toggle)
                }
                
                // Aplicar estilo verde para hoy, gris para los demás
                const cardClass = esHoy ? 'card mb-3 shadow-sm border-success border-2' : 'card mb-3 shadow-sm';
                const headerClass = esHoy ? 'card-header bg-success bg-opacity-10' : 'card-header bg-secondary bg-opacity-10';
                const collapseId = `collapseDia_${dia.diaContable.replace(/-/g, '_')}`;
                const isExpanded = esHoy ? 'true' : 'false';
                const showClass = esHoy ? 'show' : '';
                
                html += `
                    <div class="rounded-3 border shadow-sm mb-2" style="background-color: ${esHoy ? '#fff3e0' : '#fafafa'}; border-color: ${esHoy ? '#f57c00' : '#bdbdbd'} !important; padding: 0.5rem 0.75rem;">
                        <div class="d-flex justify-content-between align-items-center" style="padding: 0; min-height: 32px;">
                            <div class="d-flex align-items-center">
                                <h6 class="mb-0 fw-bold" style="color: ${esHoy ? '#e65100' : '#616161'}; font-size: 0.9rem; line-height: 1.4; padding: 0; margin: 0;">${fechaStr}</h6>
                            </div>
                            <div class="d-flex align-items-center gap-1">
                                <button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isExpanded}" aria-controls="${collapseId}" style="background-color: ${esHoy ? '#f57c00' : '#9e9e9e'}; color: white; border-color: ${esHoy ? '#f57c00' : '#9e9e9e'}; padding: 0.25rem 0.4rem; font-size: 0.75rem; line-height: 1.4; min-height: 28px; height: 28px; width: 28px;">
                                    <i class="fas fa-angle-${esHoy ? 'down' : 'right'}" style="font-size: 0.7rem;"></i>
                                </button>
                            </div>
                        </div>
                        <div class="collapse ${showClass}" id="${collapseId}">
                            <div class="table-responsive">
                                <table class="table table-modern table-sm" style="table-layout: fixed; width: 100%;">
                                    <tbody>
                `;
                
                // Mostrar productos con saldo (siempre visibles)
                productosConSaldo.forEach(producto => {
                    const saldoColor = producto.saldo >= 0 ? 'success' : 'danger';
                    const saldoSigno = producto.saldo >= 0 ? '+' : '';
                    
                    html += `
                                        <tr style="background-color: #ffffff;">
                                            <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                                                <span class="badge fs-6" style="background-color: ${saldoColor === 'success' ? '#f57c00' : '#d32f2f'}; color: white;">${saldoSigno}${producto.saldo}</span>
                                            </td>
                                            <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: ${saldoColor === 'success' ? '#e65100' : '#c62828'};">
                                                <div style="white-space: normal; overflow-wrap: break-word;">${producto.productoNombre}</div>
                                            </td>
                                            <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                                                <button class="btn btn-sm" onclick="abrirLiquidacionDiaContable('${producto.productoId}', '${producto.bodegaId}', '${dia.diaContable}', ${producto.saldo})" title="Liquidar" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #f57c00; color: white; border-color: #f57c00;">
                                                    <i class="fas fa-arrow-down"></i>
                                                </button>
                                            </td>
                                        </tr>
                    `;
                });
                
                html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
                
            });
            
            // Agregar días que solo tienen productos neteados (ocultos por defecto)
            diasArray.forEach(dia => {
                // Filtrar días con más de 7 días de antigüedad
                const ahora = ahoraGMT6();
                const hoyDiaString = fechaSoloDiaGMT6(ahora);
                const fechaDiaString = dia.diaContable;
                
                // Calcular diferencia en días usando strings YYYY-MM-DD
                const hoyParts = hoyDiaString.split('-');
                const fechaParts = fechaDiaString.split('-');
                const hoyDate = new Date(parseInt(hoyParts[0]), parseInt(hoyParts[1]) - 1, parseInt(hoyParts[2]));
                const fechaDate = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));
                const diasDiferencia = Math.floor((hoyDate.getTime() - fechaDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diasDiferencia > 7) {
                    return; // Saltar días con más de 7 días de antigüedad
                }
                
                // Verificar si es hoy
                const esHoy = fechaDiaString === hoyDiaString;
                
                // Formatear fecha para mostrar (usar fechaParts ya declarado)
                const año = parseInt(fechaParts[0]);
                const mes = parseInt(fechaParts[1]) - 1;
                const día = parseInt(fechaParts[2]);
                const fechaObj = new Date(Date.UTC(año, mes, día));
                
                // Formato corto de fecha (siempre)
                const fechaCorta = fechaObj.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
                
                // Generar etiqueta relativa con fecha corta
                let fechaStr = '';
                if (diasDiferencia === 0) {
                    fechaStr = `Hoy (${fechaCorta})`;
                } else if (diasDiferencia === 1) {
                    fechaStr = `Ayer (${fechaCorta})`;
                } else if (diasDiferencia === 2) {
                    fechaStr = `Antier (${fechaCorta})`;
                } else if (diasDiferencia === -1) {
                    fechaStr = `Mañana (${fechaCorta})`;
                } else if (diasDiferencia === -2) {
                    fechaStr = `Pasado Mañana (${fechaCorta})`;
                } else {
                    // Para fechas más lejanas, solo fecha corta
                    fechaStr = fechaCorta;
                }
                
                // Separar productos con saldo diferente de 0 y productos neteados
                const productosArray = Object.values(dia.productos);
                const productosConSaldo = productosArray.filter(p => p.saldo !== 0);
                const productosNeteados = productosArray.filter(p => p.saldo === 0);
                
                // Solo mostrar fechas que SOLO tienen productos neteados (ocultas por defecto)
                if (productosConSaldo.length === 0 && productosNeteados.length > 0) {
                    const collapseId = `collapseDiaNet_${dia.diaContable.replace(/-/g, '_')}`;
                    const isExpanded = esHoy ? 'true' : 'false';
                    const showClass = esHoy ? 'show' : '';
                    
                    html += `
                        <div class="rounded-3 border shadow-sm mb-2 dias-neteados" style="display: none; background-color: ${esHoy ? '#fff3e0' : '#fafafa'}; border-color: ${esHoy ? '#f57c00' : '#bdbdbd'} !important; padding: 0.5rem 0.75rem;">
                            <div class="d-flex justify-content-between align-items-center" style="padding: 0; min-height: 32px;">
                                <div class="d-flex align-items-center">
                                    <h6 class="mb-0 fw-bold" style="color: ${esHoy ? '#e65100' : '#616161'}; font-size: 0.9rem; line-height: 1.4; padding: 0; margin: 0;">${fechaStr}</h6>
                                </div>
                                <div class="d-flex align-items-center gap-1">
                                    <button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isExpanded}" aria-controls="${collapseId}" style="background-color: ${esHoy ? '#f57c00' : '#9e9e9e'}; color: white; border-color: ${esHoy ? '#f57c00' : '#9e9e9e'}; padding: 0.25rem 0.4rem; font-size: 0.75rem; line-height: 1.4; min-height: 28px; height: 28px; width: 28px;">
                                        <i class="fas fa-angle-${esHoy ? 'down' : 'right'}" style="font-size: 0.7rem;"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="collapse ${showClass}" id="${collapseId}">
                                <div class="table-responsive">
                                    <table class="table table-modern table-sm" style="table-layout: fixed; width: 100%;">
                                        <tbody>
                    `;
                    
                    // Sanitizar datos de productos antes de renderizar
                    productosNeteados.forEach(producto => {
                        const productoNombreSanitizado = window.escapeHTML ? window.escapeHTML(producto.productoNombre || '') : (producto.productoNombre || '');
                        html += `
                            <tr style="background-color: #fafafa; opacity: 0.7;">
                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                                    <span class="badge fs-6" style="background-color: #9e9e9e; color: white;">0</span>
                                </td>
                                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #616161;">
                                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreSanitizado}</div>
                                </td>
                                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                                                    <button class="btn btn-sm" disabled title="Ya neteado" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #9e9e9e; color: white; border-color: #9e9e9e;">
                                                        <i class="fas fa-check-circle"></i>
                                                    </button>
                                                </td>
                                            </tr>
                        `;
                    });
                    
                    html += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
        }
        
        // Sanitizar: html contiene datos del usuario (productos, fechas)
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, html, true);
        } else {
            container.innerHTML = html;
        }
        console.log('✅ Inventario especial por día actualizado:', diasArray.length, 'fechas contables');
        
    } catch (error) {
        console.error('❌ Error cargando inventario especial por día:', error);
        // Sanitizar: HTML estático seguro
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error cargando inventario especial</div>', true);
        } else {
            container.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error cargando inventario especial</div>';
        }
    }
}

// Mostrar inventario especial
function mostrarInventarioEspecial() {
    const container = document.getElementById('tablaInventarioEspecial');
    if (!container) {
        console.error('❌ Elemento tablaInventarioEspecial no encontrado');
        return;
    }
    container.innerHTML = '';
    
    // Filtrar productos de bodegas especial
    const productosEspecial = stockBodeguita.filter(stock => 
        stock.bodegaTipo === 'especial' && (stock.stockActual || 0) > 0
    );
    
    if (productosEspecial.length === 0) {
        // Sanitizar: HTML estático seguro
        if (window.setSafeInnerHTML) {
            window.setSafeInnerHTML(container, '<tr><td colspan="2" class="text-center text-muted py-3"><i class="fas fa-star-slash fa-lg mb-2"></i><div>No tienes productos especiales</div></td></tr>', true);
        } else {
            container.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3"><i class="fas fa-star-slash fa-lg mb-2"></i><div>No tienes productos especiales</div></td></tr>';
        }
        return;
    }
    
    // Agrupar productos por nombre y sumar cantidades
    const productosAgrupados = {};
    productosEspecial.forEach(stock => {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto) {
            const clave = producto.nombre;
            if (!productosAgrupados[clave]) {
                productosAgrupados[clave] = {
                    nombre: producto.nombre,
                    cantidadTotal: 0
                };
            }
            productosAgrupados[clave].cantidadTotal += (stock.stockActual || 0);
        }
    });
    
    // Convertir a array y ordenar por nombre
    const productosArray = Object.values(productosAgrupados).sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
    
    // Generar filas de la tabla
    productosArray.forEach(producto => {
        const row = document.createElement('tr');
        // Sanitizar datos del producto antes de renderizar
        const productoNombreSanitizado = window.escapeHTML ? window.escapeHTML(producto.nombre) : producto.nombre;
        const productoNombreEscapado = productoNombreSanitizado.replace(/'/g, "\\'");
        
        if (window.setSafeInnerHTML) {
            const rowHTML = `
                <td class="text-center">
                    <span class="badge bg-dark fs-6">${producto.cantidadTotal}</span>
                </td>
                <td class="fw-bold small">${productoNombreSanitizado}</td>
                <td class="text-center">
                    <button class="btn btn-outline-dark btn-sm" onclick="abrirModalGastoEspecial('${productoNombreEscapado}', ${producto.cantidadTotal})" title="Reportar Gasto">
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            `;
            window.setSafeInnerHTML(row, rowHTML, true);
        } else {
            row.innerHTML = `
                <td class="text-center">
                    <span class="badge bg-dark fs-6">${producto.cantidadTotal}</span>
                </td>
                <td class="fw-bold small">${productoNombreSanitizado}</td>
                <td class="text-center">
                    <button class="btn btn-outline-dark btn-sm" onclick="abrirModalGastoEspecial('${productoNombreEscapado}', ${producto.cantidadTotal})" title="Reportar Gasto">
                        <i class="fas fa-plus"></i>
                    </button>
                </td>
            `;
        }
        container.appendChild(row);
    });
    
    console.log('✅ Inventario especial actualizado:', productosArray.length, 'productos');
}

// Mostrar inventario APV - Todas las bodegas APV
function mostrarInventarioAPV() {
    const contenedor = document.getElementById('contenedorBodegasAPV');
    
    if (!contenedor) {
        console.error('❌ Elemento contenedorBodegasAPV no encontrado');
        return;
    }
    
    contenedor.innerHTML = '';
    
        if (todasBodegasAPV.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(contenedor, '<div class="text-center text-muted py-3"><i class="fas fa-truck-slash fa-lg mb-2"></i><div>No hay bodegas APV disponibles</div></div>', true);
            } else {
                contenedor.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-truck-slash fa-lg mb-2"></i><div>No hay bodegas APV disponibles</div></div>';
            }
            return;
        }
    
    // Crear tabla para cada bodega APV
    todasBodegasAPV.forEach((bodega, index) => {
        const productosBodega = stockTodasAPV.filter(stock => 
            stock.bodegaId === bodega.id && (stock.stockActual || 0) > 0
        );
        
        // Agrupar productos por nombre y sumar cantidades
        const productosAgrupados = {};
        productosBodega.forEach(stock => {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto) {
                const clave = producto.nombre;
                if (!productosAgrupados[clave]) {
                    productosAgrupados[clave] = {
                        nombre: producto.nombre,
                        cantidadTotal: 0
                    };
                }
                productosAgrupados[clave].cantidadTotal += (stock.stockActual || 0);
            }
        });
        
        const productosArray = Object.values(productosAgrupados).sort((a, b) => 
            a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        );
        
        const collapseId = `collapseAPV${index}`;
        const bodegaCard = document.createElement('div');
        bodegaCard.className = 'mb-1';
        // Sanitizar datos de bodega antes de renderizar
        const bodegaNombreSanitizado = window.escapeHTML ? window.escapeHTML(bodega.nombre || '') : (bodega.nombre || '');
        
        if (window.setSafeInnerHTML) {
            const bodegaHTML = `
                <div class="rounded-3 border shadow-sm mb-2" style="background-color: #fff9c4 !important; border-color: #fff9c4 !important; padding: 0.5rem 0.75rem;">
                    <div class="d-flex justify-content-between align-items-center" style="padding: 0; min-height: 32px;">
                        <div class="d-flex align-items-center">
                            <div>
                                <h6 class="mb-0 fw-bold" style="color: #000000 !important; font-size: 0.9rem; line-height: 1.4; padding: 0; margin: 0;">${bodegaNombreSanitizado}</h6>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-1">
                            <span class="badge" style="background-color: #0b7835 !important; color: #ffffff !important; padding: 0.25rem 0.5rem; font-size: 0.75rem; line-height: 1.4;">${productosArray.length} productos</span>
                            <button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" style="background-color: #fbdc02 !important; color: #ffffff !important; border-color: #fbdc02 !important; padding: 0.25rem 0.4rem; font-size: 0.75rem; line-height: 1.4; min-height: 28px; height: 28px; width: 28px;">
                                <i class="fas fa-chevron-down" style="font-size: 0.7rem; color: #ffffff !important;"></i>
                            </button>
                        </div>
                    </div>
                    <div class="collapse" id="${collapseId}">
                        <div class="table-responsive">
                            <table class="table table-modern table-sm" style="table-layout: fixed; width: 100%;">
                                <tbody id="tablaAPV${index}">
                                    ${productosArray.length === 0 ? `
                                        <tr>
                                            <td colspan="3" class="text-center text-muted py-3">
                                                <i class="fas fa-box-open fa-lg mb-2"></i>
                                                <div>Sin productos en esta bodega</div>
                                            </td>
                                        </tr>
                                    ` : productosArray.map(producto => {
                                        const productoNombreEscapado = (producto.nombre || '').replace(/'/g, "\\'");
                                        const bodegaNombreEscapado = (bodega.nombre || '').replace(/'/g, "\\'");
                                        return `
                                            <tr style="background-color: #ffffff;">
                                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                                                    <span class="badge fs-6" style="background-color: #388e3c; color: white;">${producto.cantidadTotal}</span>
                                                </td>
                                                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #1b5e20;">
                                                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreEscapado}</div>
                                                </td>
                                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                                                    <button class="btn btn-sm" onclick="abrirLiquidacionAPV('${productoNombreEscapado}', ${producto.cantidadTotal}, '${bodega.id}', '${bodegaNombreEscapado}')" title="Liquidar" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #388e3c; color: white; border-color: #388e3c;">
                                                        <i class="fas fa-arrow-down"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            window.setSafeInnerHTML(bodegaCard, bodegaHTML, true);
        } else {
            bodegaCard.innerHTML = `
                <div class="rounded-3 border shadow-sm mb-2" style="background-color: #fff9c4 !important; border-color: #fff9c4 !important; padding: 0.5rem 0.75rem;">
                    <div class="d-flex justify-content-between align-items-center" style="padding: 0; min-height: 32px;">
                        <div class="d-flex align-items-center">
                            <div>
                                <h6 class="mb-0 fw-bold" style="color: #000000 !important; font-size: 0.9rem; line-height: 1.4; padding: 0; margin: 0;">${bodegaNombreSanitizado}</h6>
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-1">
                            <span class="badge" style="background-color: #0b7835 !important; color: #ffffff !important; padding: 0.25rem 0.5rem; font-size: 0.75rem; line-height: 1.4;">${productosArray.length} productos</span>
                            <button class="btn btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" style="background-color: #fbdc02 !important; color: #ffffff !important; border-color: #fbdc02 !important; padding: 0.25rem 0.4rem; font-size: 0.75rem; line-height: 1.4; min-height: 28px; height: 28px; width: 28px;">
                                <i class="fas fa-chevron-down" style="font-size: 0.7rem; color: #ffffff !important;"></i>
                            </button>
                        </div>
                    </div>
                    <div class="collapse" id="${collapseId}">
                        <div class="table-responsive">
                            <table class="table table-modern table-sm" style="table-layout: fixed; width: 100%;">
                                <tbody id="tablaAPV${index}">
                                    ${productosArray.length === 0 ? `
                                        <tr>
                                            <td colspan="3" class="text-center text-muted py-3">
                                                <i class="fas fa-box-open fa-lg mb-2"></i>
                                                <div>Sin productos en esta bodega</div>
                                            </td>
                                        </tr>
                                    ` : productosArray.map(producto => {
                                        const productoNombreEscapado = (producto.nombre || '').replace(/'/g, "\\'");
                                        const bodegaNombreEscapado = (bodega.nombre || '').replace(/'/g, "\\'");
                                        return `
                                            <tr style="background-color: #ffffff;">
                                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 12%;">
                                                    <span class="badge fs-6" style="background-color: #388e3c; color: white;">${producto.cantidadTotal}</span>
                                                </td>
                                                <td class="fw-bold" style="padding: 0.35rem 0.5rem; word-wrap: break-word; line-height: 1.3; font-size: 0.85rem; width: 68%; color: #1b5e20;">
                                                    <div style="white-space: normal; overflow-wrap: break-word;">${productoNombreEscapado}</div>
                                                </td>
                                                <td class="text-center" style="padding: 0.35rem 0.5rem; width: 20%;">
                                                    <button class="btn btn-sm" onclick="abrirLiquidacionAPV('${productoNombreEscapado}', ${producto.cantidadTotal}, '${bodega.id}', '${bodegaNombreEscapado}')" title="Liquidar" style="font-size: 0.7rem; padding: 0.25rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background-color: #388e3c; color: white; border-color: #388e3c;">
                                                        <i class="fas fa-arrow-down"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        
        contenedor.appendChild(bodegaCard);
    });
    
    console.log('✅ Inventario APV actualizado:', todasBodegasAPV.length, 'bodegas');
}

// Funciones para abrir modales de gasto
window.abrirModalGastoRutero = function(nombreProducto, cantidadDisponible) {
    console.log('🔍 Abriendo modal de gasto para:', nombreProducto, 'Cantidad:', cantidadDisponible);
    
    // Llenar los campos del modal
    document.getElementById('productoNombreGasto').value = nombreProducto;
    document.getElementById('cantidadDisponibleGasto').value = cantidadDisponible;
    document.getElementById('cantidadGastada').value = '';
    document.getElementById('cantidadGastada').max = cantidadDisponible;
    document.getElementById('cuentaGasto').value = 'gastos_operativos'; // Pre-seleccionar cuenta
    document.getElementById('observacionesGasto').value = '';
    
    // Mostrar el modal
    const modalElement = document.getElementById('modalGastoRutero');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('❌ Modal modalGastoRutero no encontrado');
    }
}

window.abrirModalGastoEspecial = function(nombreProducto, cantidadDisponible) {
    // Para especial, usar el mismo modal que rutero pero cambiar el contexto
    window.abrirModalGastoRutero(nombreProducto, cantidadDisponible);
}

// Función para registrar gasto simple
window.registrarGastoSimple = async function() {
    try {
        const nombreProducto = document.getElementById('productoNombreGasto').value;
        const cantidadDisponible = parseInt(document.getElementById('cantidadDisponibleGasto').value);
        const cantidadGastada = parseInt(document.getElementById('cantidadGastada').value);
        const cuentaGasto = document.getElementById('cuentaGasto').value;
        const observaciones = document.getElementById('observacionesGasto').value;
        
        // Validaciones
        if (!cantidadGastada || cantidadGastada <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        if (cantidadGastada > cantidadDisponible) {
            mostrarMensaje('La cantidad no puede ser mayor a la disponible', 'warning');
            return;
        }
        
        if (!cuentaGasto) {
            mostrarMensaje('Debe seleccionar una cuenta de gasto', 'warning');
            return;
        }
        
        // Buscar el producto
        const producto = productos.find(p => p.nombre === nombreProducto);
        if (!producto) {
            mostrarMensaje('Producto no encontrado', 'danger');
            return;
        }
        
        // Buscar la bodega del usuario que tiene este producto
        const stockProducto = stockBodeguita.find(s => 
            s.productoId === producto.id && s.stockActual >= cantidadGastada
        );
        
        if (!stockProducto) {
            mostrarMensaje('No hay suficiente stock disponible', 'warning');
            return;
        }
        
        // Bloquear gastos desde bodegas especiales - deben liquidarse desde "Liquidación de Alistos Especiales"
        const bodegaDelStock = misBodegas.find(b => b.id === stockProducto.bodegaId);
        if (bodegaDelStock && bodegaDelStock.tipo === 'especial') {
            mostrarMensaje('❌ Los gastos desde bodegas especiales deben liquidarse desde "Liquidación de Alistos Especiales" en el módulo de administrador.', 'danger');
            return;
        }
        
        // Crear el registro de gasto
        const gastoData = {
            productoId: producto.id,
            productoNombre: producto.nombre,
            bodegaId: stockProducto.bodegaId,
            bodegaNombre: stockProducto.bodegaNombre,
            cantidadGastada: cantidadGastada,
            cuentaGasto: cuentaGasto,
            observaciones: observaciones,
            empleadoId: currentUser.id,
            empleadoNombre: `${currentUser.primerNombre} ${currentUser.primerApellido}`,
            fechaGasto: ahoraGMT6(), // Fecha normalizada a GMT-6
            estado: 'pendiente_auditoria',
            tipoGasto: 'operativo'
        };
        
        console.log('📝 Registrando gasto:', gastoData);
        
        // Guardar en Firestore
        await addDoc(collection(db, 'gastos'), gastoData);
        
        // Actualizar el stock
        const nuevoStock = stockProducto.stockActual - cantidadGastada;
        await updateDoc(doc(db, 'stock_bodegas', stockProducto.id), {
            stockActual: nuevoStock,
            ultimaActualizacion: new Date()
        });
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalGastoRutero'));
        if (modal) {
            modal.hide();
        }
        
        // Mostrar mensaje de éxito
        mostrarMensaje(`Gasto reportado exitosamente: ${cantidadGastada} ${producto.nombre}`, 'success');
        
        // Recargar datos
        await cargarStockBodeguita();
        mostrarInventarioPersonalCombinado();
        
    } catch (error) {
        console.error('❌ Error registrando gasto:', error);
        mostrarMensaje('Error al registrar el gasto', 'danger');
    }
}

window.abrirModalGastoAPV = function(nombreProducto, cantidadDisponible) {
    // Seleccionar el producto en el select APV
    const selectProducto = document.getElementById('productoGastoAPV');
    if (selectProducto) {
        const opciones = Array.from(selectProducto.options);
        const opcion = opciones.find(op => op.textContent.includes(nombreProducto));
        if (opcion) {
            selectProducto.value = opcion.value;
            // Disparar evento change para actualizar saldo
            selectProducto.dispatchEvent(new Event('change'));
        }
    }
    
    // Abrir modal APV
    const modalElement = document.getElementById('modalGastoAPV');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('❌ Modal modalGastoAPV no encontrado');
    }
}

window.abrirModalGastoAPVEspecifica = function(nombreProducto, cantidadDisponible, bodegaId, bodegaNombre) {
    // Seleccionar el producto en el select APV
    const selectProducto = document.getElementById('productoGastoAPV');
    if (selectProducto) {
        const opciones = Array.from(selectProducto.options);
        const opcion = opciones.find(op => op.textContent.includes(nombreProducto));
        if (opcion) {
            selectProducto.value = opcion.value;
            // Disparar evento change para actualizar saldo
            selectProducto.dispatchEvent(new Event('change'));
        }
    }
    
    // Seleccionar la bodega específica en el select de bodegas APV
    const selectBodega = document.getElementById('bodegaGastoAPV');
    if (selectBodega) {
        selectBodega.value = bodegaId;
        // Disparar evento change para actualizar saldo
        selectBodega.dispatchEvent(new Event('change'));
    }
    
    // Abrir modal APV
    const modalElement = document.getElementById('modalGastoAPV');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('❌ Modal modalGastoAPV no encontrado');
    }
    
    // Mostrar mensaje informativo
    mostrarMensaje(`Reportando gasto para ${nombreProducto} en ${bodegaNombre}`, 'info');
}

// Funciones para manejar los modales de gasto
window.cargarProductosRutero = function() {
    console.log('🔄 Cargando productos rutero...');
    // Esta función se puede implementar si es necesaria
}

window.actualizarSaldoRutero = function() {
    console.log('🔄 Actualizando saldo rutero...');
    const selectProducto = document.getElementById('productoGastoRutero');
    const saldoActual = document.getElementById('saldoActualRutero');
    
    if (selectProducto && saldoActual) {
        const productoId = selectProducto.value;
        if (productoId) {
            // Buscar el stock del producto en las bodegas del empleado
            const stock = stockBodeguita.find(s => s.productoId === productoId);
            if (stock) {
                saldoActual.textContent = `${stock.stockActual || 0} unidades`;
            } else {
                saldoActual.textContent = '0 unidades';
            }
        } else {
            saldoActual.textContent = '0 unidades';
        }
    }
}

window.actualizarNuevoSaldoRutero = function() {
    console.log('🔄 Actualizando nuevo saldo rutero...');
    const cantidadInput = document.getElementById('cantidadGastoRutero');
    const nuevoSaldo = document.getElementById('nuevoSaldoRutero');
    const saldoActual = document.getElementById('saldoActualRutero');
    
    if (cantidadInput && nuevoSaldo && saldoActual) {
        const cantidad = parseInt(cantidadInput.value) || 0;
        const saldoActualTexto = saldoActual.textContent;
        const saldoActualNumero = parseInt(saldoActualTexto) || 0;
        const nuevoSaldoCalculado = Math.max(0, saldoActualNumero - cantidad);
        
        nuevoSaldo.textContent = `${nuevoSaldoCalculado} unidades`;
    }
}

window.cargarProductosAPV = function() {
    console.log('🔄 Cargando productos APV...');
    // Esta función se puede implementar si es necesaria
}

window.actualizarSaldoAPV = function() {
    console.log('🔄 Actualizando saldo APV...');
    const selectProducto = document.getElementById('productoGastoAPV');
    const saldoActual = document.getElementById('saldoActualAPV');
    
    if (selectProducto && saldoActual) {
        const productoId = selectProducto.value;
        if (productoId) {
            // Buscar el stock del producto en todas las bodegas APV
            const stock = stockTodasAPV.find(s => s.productoId === productoId);
            if (stock) {
                saldoActual.textContent = `${stock.stockActual || 0} unidades`;
            } else {
                saldoActual.textContent = '0 unidades';
            }
        } else {
            saldoActual.textContent = '0 unidades';
        }
    }
}

window.actualizarNuevoSaldoAPV = function() {
    console.log('🔄 Actualizando nuevo saldo APV...');
    const cantidadInput = document.getElementById('cantidadGastoAPV');
    const nuevoSaldo = document.getElementById('nuevoSaldoAPV');
    const saldoActual = document.getElementById('saldoActualAPV');
    
    if (cantidadInput && nuevoSaldo && saldoActual) {
        const cantidad = parseInt(cantidadInput.value) || 0;
        const saldoActualTexto = saldoActual.textContent;
        const saldoActualNumero = parseInt(saldoActualTexto) || 0;
        const nuevoSaldoCalculado = Math.max(0, saldoActualNumero - cantidad);
        
        nuevoSaldo.textContent = `${nuevoSaldoCalculado} unidades`;
    }
}

// Configurar búsqueda para cards móviles
function configurarBusqueda() {
    const inputBusqueda = document.getElementById('buscarProducto');
    
    if (!inputBusqueda) {
        console.log('⚠️ Elemento buscarProducto no encontrado, saltando configuración de búsqueda...');
        return;
    }
    
    inputBusqueda.addEventListener('input', function() {
        const termino = this.value.toLowerCase();
        const cards = document.querySelectorAll('.mobile-product-card');
        
        cards.forEach(card => {
            const texto = card.textContent.toLowerCase();
            if (texto.includes(termino)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// Registrar gasto
async function registrarGasto() {
    try {
        const productoId = document.getElementById('productoGasto').value;
        const cantidad = parseFloat(document.getElementById('cantidadGasto').value);
        const motivo = document.getElementById('motivoGasto').value;
        const observaciones = document.getElementById('observacionesGasto').value;
        
        // Validaciones robustas
        if (!productoId || !cantidad || !motivo) {
            mostrarMensaje('Por favor completa todos los campos obligatorios', 'warning');
            return;
        }
        
        if (isNaN(cantidad) || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser un número válido mayor a 0', 'warning');
            return;
        }
        
        const producto = productos.find(p => p.id === productoId);
        const stock = stockBodeguita.find(s => s.productoId === productoId);
        
        if (!producto) {
            mostrarMensaje('Producto no encontrado', 'danger');
            return;
        }
        
        if (!stock) {
            mostrarMensaje('No se encontró stock para este producto', 'danger');
            return;
        }
        
        const stockDisponible = stock.stockActual || 0;
        if (stockDisponible < cantidad) {
            mostrarMensaje(`No hay suficiente stock disponible. Stock actual: ${stockDisponible} ${producto.unidad || 'unidades'}`, 'danger');
            return;
        }
        
        // Bloquear gastos desde bodegas especiales - deben liquidarse desde "Liquidación de Alistos Especiales"
        if (miBodeguita && miBodeguita.tipo === 'especial') {
            mostrarMensaje('❌ Los gastos desde bodegas especiales deben liquidarse desde "Liquidación de Alistos Especiales" en el módulo de administrador.', 'danger');
            return;
        }
        
        // Crear movimiento de gasto con validaciones
        const precioUnitario = producto.precioUnitario || 0;
        const total = cantidad * precioUnitario;
        
        const ahora = ahoraGMT6();
        const movimiento = {
            productoId: productoId,
            bodegaOrigen: miBodeguita.id,
            bodegaDestino: '',
            tipo: 'gasto',
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            motivo: motivo,
            usuarioId: currentUser.id,
            empleado: currentUser.nombre || 'Usuario',
            fecha: ahora, // Fecha contable normalizada a GMT-6
            createdAt: ahora, // Timestamp de creación para trazabilidad
            lastModifiedAt: ahora, // Timestamp de última modificación
            observaciones: observaciones || '',
            revisado: false
        };
        
        await addDoc(collection(db, 'movimientos_inventario'), movimiento);
        
        // Actualizar stock
        const nuevoStock = stock.stockActual - cantidad;
        await updateDoc(doc(db, 'stock_bodegas', stock.id), {
            stockActual: nuevoStock,
            ultimaActualizacion: new Date()
        });
        
        mostrarMensaje('Gasto registrado exitosamente', 'success');
        
        // Cerrar modal y limpiar formulario
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalRegistrarGasto'));
        modal.hide();
        document.getElementById('formRegistrarGasto').reset();
        
        // Recargar datos
        await cargarStockBodeguita();
        llenarSelectProductos(); // Llenar select después de cargar stock
        await cargarResumen();
        await mostrarReporteItems();
        await cargarGastosPorAuditar();
        await cargarGastosAuditados();
        
        // Notificar al administrador para actualizar stock disponible
        if (typeof window.actualizarStockDisponible === 'function') {
            console.log('🔄 Notificando actualización de stock al administrador...');
            window.actualizarStockDisponible();
        }
        
    } catch (error) {
        console.error('❌ Error registrando gasto:', error);
        mostrarMensaje('Error registrando gasto', 'danger');
    }
}

// Función mostrarMensaje ahora está en utils.js

// Mostrar reporte de items y saldo
async function mostrarReporteItems() {
    try {
        const reporteItems = document.getElementById('reporteItems');
        if (!reporteItems) {
            console.log('⚠️ Elemento reporteItems no encontrado, saltando...');
            return;
        }
        
        if (stockBodeguita.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(reporteItems, '<tr><td colspan="2" class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div style="font-size: 0.7rem;">No hay productos en tu bodeguita</div></td></tr>', true);
            } else {
                reporteItems.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3"><i class="fas fa-box-open fa-lg mb-2"></i><div style="font-size: 0.7rem;">No hay productos en tu bodeguita</div></td></tr>';
            }
            return;
        }

        // Sanitizar datos de items antes de renderizar
        const itemsSanitizados = stockBodeguita.map(item => {
            const producto = productos.find(p => p.id === item.productoId);
            return {
                ...item,
                productoNombre: window.escapeHTML ? window.escapeHTML(producto?.nombre || '') : (producto?.nombre || '')
            };
        });
        
        if (window.setSafeInnerHTML) {
            const html = itemsSanitizados.map(item => {
                console.log('🔍 Procesando item para reporte:', item);
                const producto = productos.find(p => p.id === item.productoId);
                console.log('🔍 Producto para reporte:', producto);
                const isStockBajo = (item.stockActual || 0) <= (producto?.stockMinimo || 0);
                
                return `
                    <tr style="font-size: 0.7rem;">
                        <td style="padding: 4px 6px;" class="fw-semibold ${isStockBajo ? 'text-warning' : ''}">
                            ${producto?.nombre || 'Producto no encontrado'}
                            ${isStockBajo ? ' <i class="fas fa-exclamation-triangle text-warning" style="font-size: 0.6rem;"></i>' : ''}
                        </td>
                        <td style="padding: 4px 6px; text-align: center;" class="fw-bold">
                            ${item.stockActual || 0} ${producto?.unidad || 'un'}
                        </td>
                    </tr>
                `;
            }).join('');
            window.setSafeInnerHTML(reporteItems, html, true);
        } else {
            reporteItems.innerHTML = itemsSanitizados.map(item => {
                console.log('🔍 Procesando item para reporte:', item);
                const producto = productos.find(p => p.id === item.productoId);
                console.log('🔍 Producto para reporte:', producto);
                const isStockBajo = (item.stockActual || 0) <= (producto?.stockMinimo || 0);
                
                return `
                    <tr style="font-size: 0.7rem;">
                        <td style="padding: 4px 6px;" class="fw-semibold ${isStockBajo ? 'text-warning' : ''}">
                            ${producto?.nombre || 'Producto no encontrado'}
                            ${isStockBajo ? ' <i class="fas fa-exclamation-triangle text-warning" style="font-size: 0.6rem;"></i>' : ''}
                        </td>
                        <td style="padding: 4px 6px; text-align: center;" class="fw-bold">
                            ${item.stockActual || 0} ${producto?.unidad || 'un'}
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
    } catch (error) {
        console.error('❌ Error mostrando reporte de items:', error);
    }
}

// Cargar gastos por revisar (últimos 30 días)
async function cargarGastosPorAuditar() {
    try {
        const gastosPorAuditar = document.getElementById('gastosPorAuditar');
        const contador = document.getElementById('contadorGastosPendientes');
        
        if (!gastosPorAuditar || !contador) {
            console.log('⚠️ Elementos de gastos por auditar no encontrados, saltando...');
            return;
        }
        
        // Calcular fecha de hace 30 días
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - 30);
        
        // Consulta simplificada sin filtro de fecha para evitar índices complejos
        const gastosQuery = query(
            collection(db, 'movimientos_inventario'),
            where('bodegaOrigen', '==', miBodeguita.id),
            where('tipo', '==', 'gasto'),
            where('revisado', '==', false)
        );
        
        const querySnapshot = await getDocs(gastosQuery);
        const gastos = [];
        
        querySnapshot.forEach(doc => {
            const gasto = { id: doc.id, ...doc.data() };
            const fechaGasto = gasto.fecha?.toDate ? gasto.fecha.toDate() : (gasto.fecha ? new Date(gasto.fecha) : new Date());
            
            // Filtrar por fecha en el cliente (últimos 30 días)
            if (fechaGasto >= fechaLimite) {
                gastos.push(gasto);
            }
        });
        
        // Ordenar por fecha descendente
        gastos.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
            return fechaB - fechaA;
        });
        
        contador.textContent = gastos.length;
        
        if (gastos.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(gastosPorAuditar, '<div class="text-center text-muted py-4"><i class="fas fa-check-circle fa-2x mb-2 text-success"></i><p>No hay gastos pendientes de revisión</p></div>', true);
            } else {
                gastosPorAuditar.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-check-circle fa-2x mb-2 text-success"></i><p>No hay gastos pendientes de revisión</p></div>';
            }
            return;
        }
        
        // Sanitizar datos de gastos antes de renderizar
        const gastosSanitizados = gastos.map(gasto => {
            const producto = productos.find(p => p.id === gasto.productoId);
            return {
                ...gasto,
                productoNombre: window.escapeHTML ? window.escapeHTML(producto?.nombre || '') : (producto?.nombre || ''),
                observaciones: window.escapeHTML ? window.escapeHTML(gasto.observaciones || '') : (gasto.observaciones || ''),
                comentariosRevision: window.escapeHTML ? window.escapeHTML(gasto.comentariosRevision || '') : (gasto.comentariosRevision || '')
            };
        });
        
        if (window.setSafeInnerHTML) {
            const html = gastosSanitizados.map(gasto => {
            const producto = productos.find(p => p.id === gasto.productoId);
            const fecha = gasto.fecha?.toDate ? gasto.fecha.toDate() : (gasto.fecha ? new Date(gasto.fecha) : new Date());
            
                return `
                    <div class="card mb-3 border-warning">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="card-title mb-0">
                                    <i class="fas fa-box text-primary me-2"></i>
                                    ${gasto.productoNombre || 'Producto no encontrado'}
                                </h6>
                                <span class="badge bg-warning text-dark">
                                    <i class="fas fa-clock me-1"></i>Pendiente
                                </span>
                            </div>
                            <div class="row g-2">
                                <div class="col-6">
                                    <small class="text-muted">Cantidad:</small>
                                    <div class="fw-bold">${gasto.cantidad} ${producto?.unidad || 'unidades'}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Estado:</small>
                                    <div class="fw-bold text-warning">
                                        <i class="fas fa-clock me-1"></i>Pendiente
                                    </div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted">Motivo:</small>
                                    <div class="fw-semibold">${gasto.motivo || 'Sin motivo especificado'}</div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted">Fecha:</small>
                                    <div>${fecha.toLocaleDateString('es-CR')} ${fecha.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                ${gasto.observaciones ? `
                                    <div class="col-12">
                                        <small class="text-muted">Observaciones:</small>
                                        <div class="text-muted">${gasto.observaciones}</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            window.setSafeInnerHTML(gastosPorAuditar, html, true);
        } else {
            // Fallback si security-helpers no está disponible
            gastosPorAuditar.innerHTML = gastosSanitizados.map(gasto => {
                // ... (código similar pero sin sanitización adicional)
            }).join('');
        }
        
    } catch (error) {
        console.error('❌ Error cargando gastos por auditar:', error);
    }
}

// Cargar gastos revisados (últimos 30 días)
async function cargarGastosAuditados() {
    try {
        const gastosAuditados = document.getElementById('gastosAuditados');
        const contador = document.getElementById('contadorGastosAuditados');
        
        if (!gastosAuditados || !contador) {
            console.log('⚠️ Elementos de gastos auditados no encontrados, saltando...');
            return;
        }
        
        // Calcular fecha de hace 30 días
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - 30);
        
        // Consulta simplificada sin filtro de fecha para evitar índices complejos
        const gastosQuery = query(
            collection(db, 'movimientos_inventario'),
            where('bodegaOrigen', '==', miBodeguita.id),
            where('tipo', '==', 'gasto'),
            where('revisado', '==', true)
        );
        
        const querySnapshot = await getDocs(gastosQuery);
        const gastos = [];
        
        querySnapshot.forEach(doc => {
            const gasto = { id: doc.id, ...doc.data() };
            const fechaGasto = gasto.fecha?.toDate ? gasto.fecha.toDate() : (gasto.fecha ? new Date(gasto.fecha) : new Date());
            
            // Filtrar por fecha en el cliente (últimos 30 días)
            if (fechaGasto >= fechaLimite) {
                gastos.push(gasto);
            }
        });
        
        // Ordenar por fecha descendente
        gastos.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
            return fechaB - fechaA;
        });
        
        contador.textContent = gastos.length;
        
        if (gastos.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(gastosAuditados, '<div class="text-center text-muted py-4"><i class="fas fa-inbox fa-2x mb-2"></i><p>No hay gastos revisados en los últimos 30 días</p></div>', true);
            } else {
                gastosAuditados.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-inbox fa-2x mb-2"></i><p>No hay gastos revisados en los últimos 30 días</p></div>';
            }
            return;
        }
        
        // Sanitizar datos de gastos antes de renderizar
        const gastosSanitizados = gastos.map(gasto => {
            const producto = productos.find(p => p.id === gasto.productoId);
            return {
                ...gasto,
                productoNombre: window.escapeHTML ? window.escapeHTML(producto?.nombre || '') : (producto?.nombre || ''),
                observaciones: window.escapeHTML ? window.escapeHTML(gasto.observaciones || '') : (gasto.observaciones || ''),
                comentariosRevision: window.escapeHTML ? window.escapeHTML(gasto.comentariosRevision || '') : (gasto.comentariosRevision || ''),
                revisadoPor: window.escapeHTML ? window.escapeHTML(gasto.revisadoPor || 'Administrador de Bodega') : (gasto.revisadoPor || 'Administrador de Bodega')
            };
        });
        
        if (window.setSafeInnerHTML) {
            const html = gastosSanitizados.map(gasto => {
                const fecha = gasto.fecha?.toDate ? gasto.fecha.toDate() : (gasto.fecha ? new Date(gasto.fecha) : new Date());
                const fechaRevision = gasto.fechaRevision?.toDate ? gasto.fechaRevision.toDate() : (gasto.fechaRevision ? new Date(gasto.fechaRevision) : new Date());
                
                return `
                    <div class="card mb-3 border-success">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="card-title mb-0">
                                    <i class="fas fa-box text-primary me-2"></i>
                                    ${gasto.productoNombre}
                                </h6>
                                <span class="badge bg-success">
                                    <i class="fas fa-check me-1"></i>Revisado
                                </span>
                            </div>
                            <div class="row g-2">
                                <div class="col-6">
                                    <small class="text-muted">Cantidad:</small>
                                    <div class="fw-bold">${gasto.cantidad} ${producto?.unidad || 'unidades'}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Estado:</small>
                                    <div class="fw-bold text-success">
                                        <i class="fas fa-check me-1"></i>Revisado
                                    </div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted">Motivo:</small>
                                    <div class="fw-semibold">${gasto.motivo || 'Sin motivo especificado'}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Fecha Gasto:</small>
                                    <div>${fecha.toLocaleDateString('es-CR')} ${fecha.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted">Fecha Revisión:</small>
                                    <div>${fechaRevision.toLocaleDateString('es-CR')} ${fechaRevision.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div class="col-12">
                                    <small class="text-muted">Revisado por:</small>
                                    <div class="fw-semibold text-success">${gasto.revisadoPor}</div>
                                </div>
                                ${gasto.observaciones ? `
                                    <div class="col-12">
                                        <small class="text-muted">Observaciones:</small>
                                        <div class="text-muted">${gasto.observaciones}</div>
                                    </div>
                                ` : ''}
                                ${gasto.comentariosRevision ? `
                                    <div class="col-12">
                                        <small class="text-muted">Comentarios de Revisión:</small>
                                        <div class="text-success fw-semibold">${gasto.comentariosRevision}</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            window.setSafeInnerHTML(gastosAuditados, html, true);
        } else {
            // Fallback si security-helpers no está disponible
            gastosAuditados.innerHTML = gastosSanitizados.map(gasto => {
                // ... (código similar pero sin sanitización adicional)
            }).join('');
        }
        
    } catch (error) {
        console.error('❌ Error cargando gastos auditados:', error);
    }
}

// Cargar transacciones recientes del usuario
async function cargarTransaccionesRecientes() {
    try {
        const listaGastos = document.getElementById('listaGastos');
        
        if (!listaGastos) {
            console.log('⚠️ Elemento listaGastos no encontrado, saltando...');
            return;
        }
        
        // Obtener IDs de todas las bodegas del usuario
        const bodegasIds = misBodegas.map(b => b.id);
        
        if (bodegasIds.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(listaGastos, '<div class="text-center text-muted py-2"><i class="fas fa-inbox fa-lg mb-2"></i><p style="font-size: 0.85rem;">No hay bodegas asignadas</p></div>', true);
            } else {
                listaGastos.innerHTML = '<div class="text-center text-muted py-2"><i class="fas fa-inbox fa-lg mb-2"></i><p style="font-size: 0.85rem;">No hay bodegas asignadas</p></div>';
            }
            return;
        }
        
        // Calcular fecha de hace 24 horas
        const fechaLimite = ahoraGMT6();
        fechaLimite.setHours(fechaLimite.getHours() - 24);
        
        // Calcular tiempo límite para eliminación (30 minutos)
        const tiempoLimiteEliminacion = 30 * 60 * 1000; // 30 minutos en milisegundos
        const ahora = new Date(); // Fecha actual para comparar con createdAt
        
        // Cargar movimientos donde el usuario es responsable
        // Sin orderBy para evitar necesidad de índice compuesto
        const movimientosQuery = query(
            collection(db, 'movimientos_inventario'),
            where('usuarioId', '==', currentUser.id)
        );
        
        const querySnapshot = await getDocs(movimientosQuery);
        const transacciones = [];
        
        querySnapshot.forEach(doc => {
            const mov = { id: doc.id, ...doc.data() };
            const fechaMov = mov.fecha?.toDate ? mov.fecha.toDate() : (mov.fecha ? new Date(mov.fecha) : new Date());
            
            // Filtrar por fecha en el cliente (últimas 24 horas)
            if (fechaMov >= fechaLimite) {
                transacciones.push(mov);
            }
        });
        
        // Ordenar por fecha descendente en el cliente
        transacciones.sort((a, b) => {
            const fechaA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
            const fechaB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
            return fechaB - fechaA;
        });
        
        // Mostrar todas las transacciones de las últimas 24 horas
        const transaccionesLimitadas = transacciones;
        
        if (transaccionesLimitadas.length === 0) {
            // Sanitizar: HTML estático seguro
            if (window.setSafeInnerHTML) {
                window.setSafeInnerHTML(listaGastos, '<div class="text-center text-muted py-2"><i class="fas fa-inbox fa-lg mb-2"></i><p style="font-size: 0.85rem;">No hay transacciones recientes</p></div>', true);
            } else {
                listaGastos.innerHTML = '<div class="text-center text-muted py-2"><i class="fas fa-inbox fa-lg mb-2"></i><p style="font-size: 0.85rem;">No hay transacciones recientes</p></div>';
            }
            return;
        }
        
        // Obtener fecha actual para comparar
        const ahoraComparacion = ahoraGMT6();
        const hoy = new Date(ahoraComparacion);
        hoy.setHours(0, 0, 0, 0);
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        
        // Generar HTML compacto para mobile
        let html = '<div class="table-responsive" style="max-height: 400px; overflow-y: auto;">';
        html += '<table class="table table-sm table-hover mb-0" style="font-size: 0.75rem;">';
        html += '<thead style="position: sticky; top: 0; background-color: #f8f9fa; z-index: 10;">';
        html += '<tr>';
        html += '<th style="padding: 0.4rem 0.3rem; font-size: 0.7rem; font-weight: bold; color: #495057; width: 10%; text-align: center;">Acción</th>';
        html += '<th style="padding: 0.4rem 0.3rem; font-size: 0.7rem; font-weight: bold; color: #495057; width: 15%; text-align: center;">Cantidad</th>';
        html += '<th style="padding: 0.4rem 0.3rem; font-size: 0.7rem; font-weight: bold; color: #495057; width: 30%; text-align: left;">Producto</th>';
        html += '<th style="padding: 0.4rem 0.3rem; font-size: 0.7rem; font-weight: bold; color: #495057; width: 15%; text-align: center;">Recibo</th>';
        html += '<th style="padding: 0.4rem 0.3rem; font-size: 0.7rem; font-weight: bold; color: #495057; width: 15%; text-align: center;">Fecha</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody>';
        
        transaccionesLimitadas.forEach(mov => {
            const fecha = mov.fecha?.toDate ? mov.fecha.toDate() : (mov.fecha ? new Date(mov.fecha) : new Date());
            
            // Determinar si es Hoy o Ayer
            const fechaMov = new Date(fecha);
            fechaMov.setHours(0, 0, 0, 0);
            let fechaStr = '';
            if (fechaMov.getTime() === hoy.getTime()) {
                fechaStr = 'Hoy';
            } else if (fechaMov.getTime() === ayer.getTime()) {
                fechaStr = 'Ayer';
            } else {
                // Si no es hoy ni ayer, mostrar fecha corta
                const dia = fecha.getDate();
                const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                const mes = meses[fecha.getMonth()];
                fechaStr = `${dia}-${mes}`;
            }
            
            // Verificar si la transacción tiene menos de 30 minutos usando createdAt
            let fechaCreacion;
            if (mov.createdAt) {
                // Si es un Timestamp de Firestore, convertir a Date
                if (mov.createdAt.toDate) {
                    fechaCreacion = mov.createdAt.toDate();
                } else if (mov.createdAt instanceof Date) {
                    fechaCreacion = mov.createdAt;
                } else if (mov.createdAt.seconds) {
                    // Si es un objeto Timestamp con seconds
                    fechaCreacion = new Date(mov.createdAt.seconds * 1000);
                } else {
                    fechaCreacion = new Date(mov.createdAt);
                }
            } else {
                // Si no hay createdAt, usar la fecha del movimiento como fallback
                fechaCreacion = fecha;
            }
            
            const tiempoTranscurrido = ahora.getTime() - fechaCreacion.getTime();
            const puedeEliminar = tiempoTranscurrido >= 0 && tiempoTranscurrido < tiempoLimiteEliminacion;
            
            // Obtener nombre del producto o herramienta y sanitizar
            let nombreItem = 'Item no encontrado';
            if (mov.productoId) {
                const producto = productos.find(p => p.id === mov.productoId);
                nombreItem = producto?.nombre || 'Producto no encontrado';
            } else if (mov.herramientaId) {
                const herramienta = herramientas.find(h => h.id === mov.herramientaId);
                nombreItem = herramienta?.nombre || 'Herramienta no encontrada';
            }
            const nombreItemSanitizado = window.escapeHTML ? window.escapeHTML(nombreItem) : nombreItem;
            
            const cantidad = mov.cantidad || 0;
            
            // Determinar el tipo de transacción y su icono/color
            const tipo = mov.tipo || 'gasto';
            let tipoIcono = '';
            let tipoColor = '';
            let tipoTexto = '';
            
            switch(tipo) {
                case 'gasto':
                    tipoIcono = 'fa-receipt';
                    tipoColor = '#dc3545'; // Rojo
                    tipoTexto = 'Gasto';
                    break;
                case 'devolucion':
                    tipoIcono = 'fa-undo';
                    tipoColor = '#0d6efd'; // Azul
                    tipoTexto = 'Devolución';
                    break;
                case 'transferencia':
                    tipoIcono = 'fa-exchange-alt';
                    tipoColor = '#6c757d'; // Gris
                    tipoTexto = 'Transferencia';
                    break;
                case 'compra':
                    tipoIcono = 'fa-shopping-cart';
                    tipoColor = '#198754'; // Verde
                    tipoTexto = 'Compra';
                    break;
                case 'reversion':
                    tipoIcono = 'fa-redo';
                    tipoColor = '#ffc107'; // Amarillo
                    tipoTexto = 'Reversión';
                    break;
                default:
                    tipoIcono = 'fa-box';
                    tipoColor = '#6c757d';
                    tipoTexto = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            }
            
            // Formatear el nombre del item con el tipo de transacción (nombreItemSanitizado ya sanitizado)
            const nombreCompleto = `${nombreItemSanitizado} <span style="color: ${tipoColor}; font-size: 0.6rem; font-weight: normal;"><i class="fas ${tipoIcono}"></i> ${tipoTexto}</span>`;
            
            // Formatear cantidad: si es devolución, mostrar círculo verde con menos
            let cantidadDisplay = '';
            if (tipo === 'devolucion') {
                cantidadDisplay = `
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background-color: #198754; color: white; font-weight: bold; font-size: 0.7rem;">
                        −
                    </span>
                    <span style="margin-left: 4px; font-weight: bold; font-size: 0.75rem;">${Math.abs(cantidad)}</span>
                `;
            } else {
                cantidadDisplay = `<span style="font-weight: bold; font-size: 0.75rem;">${cantidad}</span>`;
            }
            
            // Botón de eliminar (rojo) o símbolo de bloqueo
            const accion = puedeEliminar ? `
                <button 
                    class="btn btn-sm" 
                    onclick="eliminarTransaccion('${mov.id}')" 
                    title="Eliminar transacción"
                    style="padding: 0.15rem 0.3rem; font-size: 0.65rem; background-color: #dc3545; color: white; border-color: #dc3545; min-height: 20px; height: 20px; width: 20px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-trash" style="font-size: 0.6rem;"></i>
                </button>
            ` : `
                <i class="fas fa-lock text-muted" style="font-size: 0.8rem;" title="No se puede eliminar (más de 30 minutos)"></i>
            `;
            
            // Obtener número de recibo si existe
            const numeroRecibo = mov.recibo || mov.numeroRecibo || '';
            const reciboDisplay = numeroRecibo ? 
                `<span style="font-weight: bold; color: #0d6efd; font-size: 0.7rem;">#${numeroRecibo}</span>` : 
                `<span style="color: #adb5bd; font-size: 0.65rem;">-</span>`;
            
            html += `
                <tr style="border-bottom: 1px solid #e9ecef;">
                    <td style="padding: 0.4rem 0.3rem; width: 10%; text-align: center; vertical-align: middle;">
                        ${accion}
                    </td>
                    <td style="padding: 0.4rem 0.3rem; width: 15%; text-align: center; vertical-align: middle;">
                        ${cantidadDisplay}
                    </td>
                    <td style="padding: 0.4rem 0.3rem; font-size: 0.65rem; width: 30%; text-align: left; vertical-align: middle;">
                        <div style="line-height: 1.2; max-height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-wrap: break-word;">
                            ${nombreCompleto}
                        </div>
                    </td>
                    <td style="padding: 0.4rem 0.3rem; width: 15%; text-align: center; vertical-align: middle;">
                        ${reciboDisplay}
                    </td>
                    <td style="padding: 0.4rem 0.3rem; color: #6c757d; font-size: 0.7rem; width: 15%; text-align: center; vertical-align: middle;">
                        ${fechaStr}
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        listaGastos.innerHTML = html;
        
        console.log('✅ Transacciones recientes cargadas (últimas 24 horas):', transaccionesLimitadas.length, 'de', transacciones.length, 'totales');
        
    } catch (error) {
        console.error('❌ Error cargando transacciones recientes:', error);
        const listaGastos = document.getElementById('listaGastos');
        if (listaGastos) {
            listaGastos.innerHTML = `
                <div class="text-center text-danger py-2">
                    <i class="fas fa-exclamation-triangle fa-lg mb-2"></i>
                    <p style="font-size: 0.85rem;">Error cargando transacciones</p>
                </div>
            `;
        }
    }
}

// Eliminar transacción (solo si tiene menos de 30 minutos)
window.eliminarTransaccion = async function(transaccionId) {
    try {
        // Confirmar eliminación
        if (!confirm('¿Estás seguro de que deseas eliminar esta transacción?')) {
            return;
        }
        
        // Obtener la transacción para verificar que tiene menos de 30 minutos
        const transaccionDoc = await getDoc(doc(db, 'movimientos_inventario', transaccionId));
        if (!transaccionDoc.exists()) {
            alert('La transacción no existe');
            return;
        }
        
        const transaccion = transaccionDoc.data();
        
        // Usar createdAt para verificar el tiempo real de creación (misma lógica que en cargarTransaccionesRecientes)
        let fechaCreacion;
        if (transaccion.createdAt) {
            // Si es un Timestamp de Firestore, convertir a Date
            if (transaccion.createdAt.toDate) {
                fechaCreacion = transaccion.createdAt.toDate();
            } else if (transaccion.createdAt instanceof Date) {
                fechaCreacion = transaccion.createdAt;
            } else if (transaccion.createdAt.seconds) {
                // Si es un objeto Timestamp con seconds
                fechaCreacion = new Date(transaccion.createdAt.seconds * 1000);
            } else {
                fechaCreacion = new Date(transaccion.createdAt);
            }
        } else {
            // Si no hay createdAt, usar la fecha del movimiento como fallback
            const fechaMov = transaccion.fecha?.toDate ? transaccion.fecha.toDate() : (transaccion.fecha ? new Date(transaccion.fecha) : new Date());
            fechaCreacion = fechaMov;
        }
        
        const ahora = new Date();
        const tiempoTranscurrido = ahora.getTime() - fechaCreacion.getTime();
        const tiempoLimiteEliminacion = 30 * 60 * 1000; // 30 minutos
        
        console.log('🔍 Verificando eliminación:', {
            transaccionId: transaccionId,
            createdAt: transaccion.createdAt,
            fechaCreacion: fechaCreacion,
            tiempoTranscurrido: Math.round(tiempoTranscurrido / 1000) + 's',
            tiempoLimite: Math.round(tiempoLimiteEliminacion / 1000) + 's'
        });
        
        if (tiempoTranscurrido >= tiempoLimiteEliminacion) {
            alert('No se puede eliminar esta transacción. Solo se pueden eliminar transacciones creadas hace menos de 30 minutos.');
            // Recargar para actualizar la vista
            await cargarTransaccionesRecientes();
            return;
        }
        
        // Verificar que el usuario es el dueño de la transacción
        if (transaccion.usuarioId !== currentUser.id) {
            alert('No tienes permiso para eliminar esta transacción');
            return;
        }
        
        // Revertir los saldos según el tipo de transacción ANTES de eliminar
        console.log('🔄 Revirtiendo saldos para transacción:', transaccion.tipo);
        
        // Determinar si es producto o herramienta
        const esHerramienta = !!transaccion.herramientaId;
        const campoId = esHerramienta ? 'herramientaId' : 'productoId';
        const itemId = esHerramienta ? transaccion.herramientaId : transaccion.productoId;
        
        if (transaccion.tipo === 'gasto') {
            // Gasto: Bodega → Cuenta Gasto
            // Eliminar: Sumar de vuelta a la bodega origen
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', transaccion.origen),
                where(campoId, '==', itemId)
            );
            const stockSnapshot = await getDocs(stockQuery);
            if (!stockSnapshot.empty) {
                const stockDoc = stockSnapshot.docs[0];
                await updateDoc(doc(db, 'stock_bodegas', stockDoc.id), {
                    stockActual: increment(transaccion.cantidad),
                    ultimaActualizacion: serverTimestamp()
                });
                console.log(`✅ Stock ${esHerramienta ? 'herramienta' : 'producto'} revertido en bodega origen:`, transaccion.origen);
            } else {
                // Si no existe stock, crear uno nuevo
                const nuevoStock = {
                    bodegaId: transaccion.origen,
                    stockActual: transaccion.cantidad,
                    stockMinimo: 0,
                    createdAt: serverTimestamp(),
                    ultimaActualizacion: serverTimestamp()
                };
                nuevoStock[campoId] = itemId;
                await addDoc(collection(db, 'stock_bodegas'), nuevoStock);
                console.log(`✅ Nuevo stock ${esHerramienta ? 'herramienta' : 'producto'} creado al revertir gasto`);
            }
            
        } else if (transaccion.tipo === 'devolucion' || transaccion.tipo === 'transferencia') {
            // Devolución/Transferencia: Bodega → Bodega Principal
            // Eliminar: Restar del destino (bodega principal), sumar al origen
            // Revertir stock origen (sumar)
            const stockOrigenQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', transaccion.origen),
                where(campoId, '==', itemId)
            );
            const stockOrigenSnapshot = await getDocs(stockOrigenQuery);
            if (!stockOrigenSnapshot.empty) {
                const stockOrigenDoc = stockOrigenSnapshot.docs[0];
                await updateDoc(doc(db, 'stock_bodegas', stockOrigenDoc.id), {
                    stockActual: increment(transaccion.cantidad),
                    ultimaActualizacion: serverTimestamp()
                });
                console.log(`✅ Stock ${esHerramienta ? 'herramienta' : 'producto'} revertido en bodega origen:`, transaccion.origen);
            } else {
                // Crear stock si no existe
                const nuevoStockOrigen = {
                    bodegaId: transaccion.origen,
                    stockActual: transaccion.cantidad,
                    stockMinimo: 0,
                    createdAt: serverTimestamp(),
                    ultimaActualizacion: serverTimestamp()
                };
                nuevoStockOrigen[campoId] = itemId;
                await addDoc(collection(db, 'stock_bodegas'), nuevoStockOrigen);
                console.log(`✅ Nuevo stock ${esHerramienta ? 'herramienta' : 'producto'} creado en origen al revertir devolución`);
            }
            
            // Revertir stock destino (restar)
            const stockDestinoQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', transaccion.destino),
                where(campoId, '==', itemId)
            );
            const stockDestinoSnapshot = await getDocs(stockDestinoQuery);
            if (!stockDestinoSnapshot.empty) {
                const stockDestinoDoc = stockDestinoSnapshot.docs[0];
                const stockActual = stockDestinoDoc.data().stockActual || 0;
                if (stockActual > transaccion.cantidad) {
                    await updateDoc(doc(db, 'stock_bodegas', stockDestinoDoc.id), {
                        stockActual: increment(-transaccion.cantidad),
                        ultimaActualizacion: serverTimestamp()
                    });
                    console.log(`✅ Stock ${esHerramienta ? 'herramienta' : 'producto'} revertido en bodega destino:`, transaccion.destino);
                } else {
                    // Si el stock queda en 0 o negativo, eliminar el registro
                    await deleteDoc(doc(db, 'stock_bodegas', stockDestinoDoc.id));
                    console.log(`✅ Registro de stock ${esHerramienta ? 'herramienta' : 'producto'} eliminado (stock <= 0)`);
                }
            }
        }
        
        // Eliminar la transacción
        await deleteDoc(doc(db, 'movimientos_inventario', transaccionId));
        
        console.log('✅ Transacción eliminada:', transaccionId);
        
        // Recargar las transacciones y los saldos
        await Promise.all([
            cargarTransaccionesRecientes(),
            cargarStockBodeguita(),
            cargarStockHerramientas() // Recargar stock de herramientas también
        ]);
        
    } catch (error) {
        console.error('❌ Error eliminando transacción:', error);
        alert('Error al eliminar la transacción: ' + error.message);
    }
};

// Recalcular saldos desde cero basándose en todas las transacciones
window.recalcularSaldos = async function() {
    try {
        if (!confirm('¿Estás seguro de que deseas recalcular todos los saldos? Esto puede tomar varios segundos.')) {
            return;
        }
        
        console.log('🔄 Iniciando recálculo de saldos...');
        // Mostrar mensaje si la función existe, sino usar alert
        if (typeof mostrarMensaje === 'function') {
            mostrarMensaje('Recalculando saldos, por favor espera...', 'info');
        } else {
            alert('Recalculando saldos, por favor espera...');
        }
        
        // Obtener todas las bodegas del usuario
        const bodegasIds = misBodegas.map(b => b.id);
        console.log('📦 Bodegas a procesar:', bodegasIds);
        
        // Obtener todas las transacciones relacionadas con estas bodegas
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA necesita TODOS los movimientos_inventario
        // NO debe tener límite porque procesa TODO el historial para recalcular saldos correctamente
        const movimientosQuery = query(
            collection(db, 'movimientos_inventario'),
            orderBy('fecha', 'asc')
        );
        const movimientosSnapshot = await getDocs(movimientosQuery);
        
        const todasLasTransacciones = movimientosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('📊 Total de transacciones encontradas:', todasLasTransacciones.length);
        
        // Filtrar solo las transacciones relacionadas con las bodegas del usuario
        const transaccionesUsuario = todasLasTransacciones.filter(mov => {
            return bodegasIds.includes(mov.origen) || 
                   bodegasIds.includes(mov.destino) ||
                   (mov.bodegaId && bodegasIds.includes(mov.bodegaId));
        });
        
        console.log('📊 Transacciones del usuario:', transaccionesUsuario.length);
        
        // Calcular saldos por bodega y producto
        const saldosCalculados = {}; // { bodegaId_productoId: cantidad }
        
        for (const transaccion of transaccionesUsuario) {
            const bodegaId = transaccion.origen || transaccion.bodegaId;
            const productoId = transaccion.productoId;
            const cantidad = transaccion.cantidad || 0;
            const tipo = transaccion.tipo;
            
            if (!bodegaId || !productoId) {
                continue;
            }
            
            const clave = `${bodegaId}_${productoId}`;
            if (!saldosCalculados[clave]) {
                saldosCalculados[clave] = {
                    bodegaId: bodegaId,
                    productoId: productoId,
                    saldo: 0
                };
            }
            
            // Calcular según el tipo de transacción
            if (tipo === 'gasto') {
                // Gasto: Resta de la bodega origen
                if (bodegasIds.includes(transaccion.origen)) {
                    saldosCalculados[clave].saldo -= cantidad;
                }
            } else if (tipo === 'devolucion') {
                // Devolución: Resta del origen, suma al destino
                if (bodegasIds.includes(transaccion.origen)) {
                    const claveOrigen = `${transaccion.origen}_${productoId}`;
                    if (!saldosCalculados[claveOrigen]) {
                        saldosCalculados[claveOrigen] = {
                            bodegaId: transaccion.origen,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveOrigen].saldo -= cantidad;
                }
                if (bodegasIds.includes(transaccion.destino)) {
                    const claveDestino = `${transaccion.destino}_${productoId}`;
                    if (!saldosCalculados[claveDestino]) {
                        saldosCalculados[claveDestino] = {
                            bodegaId: transaccion.destino,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveDestino].saldo += cantidad;
                }
            } else if (tipo === 'compra') {
                // Compra: Suma a la bodega destino
                if (bodegasIds.includes(transaccion.destino)) {
                    const claveDestino = `${transaccion.destino}_${productoId}`;
                    if (!saldosCalculados[claveDestino]) {
                        saldosCalculados[claveDestino] = {
                            bodegaId: transaccion.destino,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveDestino].saldo += cantidad;
                }
            } else if (tipo === 'transferencia') {
                // Transferencia: Resta del origen, suma al destino
                if (bodegasIds.includes(transaccion.origen)) {
                    const claveOrigen = `${transaccion.origen}_${productoId}`;
                    if (!saldosCalculados[claveOrigen]) {
                        saldosCalculados[claveOrigen] = {
                            bodegaId: transaccion.origen,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveOrigen].saldo -= cantidad;
                }
                if (bodegasIds.includes(transaccion.destino)) {
                    const claveDestino = `${transaccion.destino}_${productoId}`;
                    if (!saldosCalculados[claveDestino]) {
                        saldosCalculados[claveDestino] = {
                            bodegaId: transaccion.destino,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveDestino].saldo += cantidad;
                }
            } else if (tipo === 'reversion') {
                // Reversión: Suma a la bodega destino (reversión de gasto)
                if (bodegasIds.includes(transaccion.destino)) {
                    const claveDestino = `${transaccion.destino}_${productoId}`;
                    if (!saldosCalculados[claveDestino]) {
                        saldosCalculados[claveDestino] = {
                            bodegaId: transaccion.destino,
                            productoId: productoId,
                            saldo: 0
                        };
                    }
                    saldosCalculados[claveDestino].saldo += cantidad;
                }
            }
        }
        
        console.log('📊 Saldos calculados:', saldosCalculados);
        
        // Actualizar o crear registros en stock_bodegas
        let actualizados = 0;
        let creados = 0;
        let eliminados = 0;
        
        for (const clave in saldosCalculados) {
            const { bodegaId, productoId, saldo } = saldosCalculados[clave];
            
            // Buscar registro existente
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodegaId),
                where('productoId', '==', productoId)
            );
            const stockSnapshot = await getDocs(stockQuery);
            
            if (saldo <= 0) {
                // Si el saldo es 0 o negativo, eliminar el registro si existe
                if (!stockSnapshot.empty) {
                    const stockDoc = stockSnapshot.docs[0];
                    await deleteDoc(doc(db, 'stock_bodegas', stockDoc.id));
                    eliminados++;
                    console.log(`🗑️ Eliminado stock vacío: ${bodegaId} - ${productoId}`);
                }
            } else {
                // Actualizar o crear registro
                if (!stockSnapshot.empty) {
                    const stockDoc = stockSnapshot.docs[0];
                    await updateDoc(doc(db, 'stock_bodegas', stockDoc.id), {
                        stockActual: saldo,
                        ultimaActualizacion: serverTimestamp()
                    });
                    actualizados++;
                    console.log(`✅ Actualizado: ${bodegaId} - ${productoId} = ${saldo}`);
                } else {
                    await addDoc(collection(db, 'stock_bodegas'), {
                        bodegaId: bodegaId,
                        productoId: productoId,
                        stockActual: saldo,
                        stockMinimo: 0,
                        createdAt: serverTimestamp(),
                        ultimaActualizacion: serverTimestamp()
                    });
                    creados++;
                    console.log(`➕ Creado: ${bodegaId} - ${productoId} = ${saldo}`);
                }
            }
        }
        
        console.log(`✅ Recálculo completado: ${actualizados} actualizados, ${creados} creados, ${eliminados} eliminados`);
        
        const mensaje = `Recálculo completado: ${actualizados} actualizados, ${creados} creados, ${eliminados} eliminados`;
        if (typeof mostrarMensaje === 'function') {
            mostrarMensaje(mensaje, 'success');
        } else {
            alert(mensaje);
        }
        
        // Recargar los saldos
        await cargarStockBodeguita();
        
    } catch (error) {
        console.error('❌ Error recalculando saldos:', error);
        const mensajeError = 'Error al recalcular saldos: ' + error.message;
        if (typeof mostrarMensaje === 'function') {
            mostrarMensaje(mensajeError, 'danger');
        } else {
            alert(mensajeError);
        }
    }
};

// Registrar gasto APV
window.registrarGastoAPV = async function() {
    try {
        const bodegaId = document.getElementById('bodegaOrigenAPV').value;
        const productoId = document.getElementById('productoGastoAPV').value;
        const cantidad = parseFloat(document.getElementById('cantidadGastoAPV').value);
        const cuentaGastoId = document.getElementById('cuentaGastoAPV').value;
        const numeroRecibo = document.getElementById('numeroRecibo').value;
        const motivo = document.getElementById('motivoGastoAPV').value;
        const justificacion = document.getElementById('justificacionAPV').value;
        const observaciones = document.getElementById('observacionesGastoAPV').value;
        
        // Validaciones
        if (!bodegaId || !productoId || !cantidad || !cuentaGastoId || !motivo || !justificacion) {
            mostrarMensaje('Por favor completa todos los campos obligatorios', 'warning');
            return;
        }
        
        // Validar recibo obligatorio
        if (!numeroRecibo || numeroRecibo.trim() === '') {
            mostrarMensaje('El número de recibo es obligatorio', 'warning');
            return;
        }
        
        const reciboNum = parseInt(numeroRecibo);
        if (isNaN(reciboNum) || reciboNum <= 0 || !Number.isInteger(reciboNum)) {
            mostrarMensaje('El número de recibo debe ser un número entero mayor a 0', 'warning');
            return;
        }
        
        if (isNaN(cantidad) || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser un número válido mayor a 0', 'warning');
            return;
        }
        
        // Verificar que la bodega sea APV
        const bodega = todasBodegasAPV.find(b => b.id === bodegaId);
        if (!bodega) {
            mostrarMensaje('Bodega no encontrada', 'danger');
            return;
        }
        
        if (bodega.tipo !== 'apv') {
            mostrarMensaje('Esta función solo está disponible para bodegas APV', 'danger');
            return;
        }
        
        // Buscar el producto
        const producto = productos.find(p => p.id === productoId);
        if (!producto) {
            mostrarMensaje('Producto no encontrado', 'danger');
            return;
        }
        
        // Buscar el stock en la bodega APV
        const stockQuery = query(
            collection(db, 'stock_bodegas'),
            where('bodegaId', '==', bodegaId),
            where('productoId', '==', productoId)
        );
        const stockSnapshot = await getDocs(stockQuery);
        
        if (stockSnapshot.empty) {
            mostrarMensaje('No se encontró stock para este producto en esta bodega', 'danger');
            return;
        }
        
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockActual = stockData.stockActual || 0;
        
        if (stockActual < cantidad) {
            mostrarMensaje(`No hay suficiente stock disponible. Stock actual: ${stockActual} ${producto.unidad || 'unidades'}`, 'danger');
            return;
        }
        
        // Buscar la cuenta de gasto
        const cuentaGasto = cuentasGasto.find(c => c.id === cuentaGastoId);
        const nombreCuentaGasto = cuentaGasto ? cuentaGasto.nombre : 'Cuenta no encontrada';
        
        // Calcular precio y total
        const precioUnitario = producto.precioUnitario || 0;
        const total = cantidad * precioUnitario;
        
        // Crear movimiento de gasto
        const ahora = ahoraGMT6();
        const movimientoData = {
            tipo: 'gasto',
            productoId: productoId,
            origen: bodegaId,
            destino: cuentaGastoId,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            fecha: ahora,
            createdAt: ahora,
            lastModifiedAt: ahora,
            usuarioId: currentUser.id,
            empleado: currentUser.nombre || 'Usuario',
            cuentaGasto: nombreCuentaGasto,
            cuentaGastoId: cuentaGastoId,
            origenNombre: bodega.nombre,
            destinoNombre: nombreCuentaGasto,
            motivo: motivo,
            observaciones: observaciones || '',
            justificacion: justificacion,
            recibo: reciboNum, // Número de recibo obligatorio
            revisado: false
        };
        
        // Guardar movimiento
        await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
        
        // Actualizar stock
        await updateDoc(doc(db, 'stock_bodegas', stockDoc.id), {
            stockActual: stockActual - cantidad,
            ultimaActualizacion: serverTimestamp()
        });
        
        mostrarMensaje('Gasto APV registrado exitosamente', 'success');
        
        // Cerrar modal y limpiar formulario
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalReportarGastoAPV'));
        if (modal) {
            modal.hide();
        }
        document.getElementById('formReportarGastoAPV').reset();
        
        // Recargar datos
        await cargarStockBodeguita();
        mostrarInventarioPersonalCombinado();
        
    } catch (error) {
        console.error('❌ Error registrando gasto APV:', error);
        mostrarMensaje('Error al registrar el gasto APV: ' + error.message, 'danger');
    }
};

// Variables para liquidación por día contable
let datosLiquidacionDiaContable = null;

// Abrir modal de liquidación por día contable
window.abrirLiquidacionDiaContable = function(productoId, bodegaId, diaContable, saldo) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) {
        mostrarMensaje('Producto no encontrado', 'danger');
        return;
    }
    
    const bodega = misBodegas.find(b => b.id === bodegaId);
    const bodegaNombre = bodega ? bodega.nombre : 'Bodega no encontrada';
    
    // Formatear fecha (usar UTC para evitar desfases de zona horaria)
    const fechaParts = diaContable.split('-');
    const año = parseInt(fechaParts[0]);
    const mes = parseInt(fechaParts[1]) - 1; // Mes es 0-indexado
    const día = parseInt(fechaParts[2]);
    const fechaObj = new Date(Date.UTC(año, mes, día));
    const fechaStr = fechaObj.toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    
    // Guardar datos
    datosLiquidacionDiaContable = {
        productoId,
        productoNombre: producto.nombre,
        bodegaId,
        bodegaNombre,
        diaContable,
        saldo
    };
    
    // Llenar información del modal
    document.getElementById('infoProductoDia').textContent = producto.nombre;
    document.getElementById('infoFechaDia').textContent = `Fecha: ${fechaStr}`;
    document.getElementById('infoSaldoDia').textContent = `Saldo disponible: ${saldo >= 0 ? '+' : ''}${saldo}`;
    
    // Establecer cantidad máxima
    const cantidadInput = document.getElementById('cantidadLiquidacionDia');
    const maxCantidadSpan = document.getElementById('maxCantidadDia');
    
    if (cantidadInput) {
        cantidadInput.max = Math.abs(saldo);
        cantidadInput.value = 1; // Valor por defecto: 1
        cantidadInput.dataset.max = Math.abs(saldo);
    }
    
    if (maxCantidadSpan) {
        maxCantidadSpan.textContent = Math.abs(saldo);
    }
    
    // Limpiar selección de tipo
    document.getElementById('tipoLiquidacionDia').value = '';
    document.getElementById('btnDevolucion').classList.remove('active', 'btn-primary');
    document.getElementById('btnDevolucion').classList.add('btn-outline-primary');
    document.getElementById('btnGasto').classList.remove('active', 'btn-warning');
    document.getElementById('btnGasto').classList.add('btn-outline-warning');
    
    // Limpiar campos
    document.getElementById('reciboLiquidacionDia').value = '';
    document.getElementById('reciboLiquidacionDiaContainer').style.display = 'none';
    
    // Mostrar modal
    const modalElement = document.getElementById('modalLiquidacionDiaContable');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
};

// Seleccionar tipo de liquidación
window.seleccionarTipoLiquidacion = function(tipo) {
    const tipoInput = document.getElementById('tipoLiquidacionDia');
    const btnDevolucion = document.getElementById('btnDevolucion');
    const btnGasto = document.getElementById('btnGasto');
    const reciboContainer = document.getElementById('reciboLiquidacionDiaContainer');
    const reciboInput = document.getElementById('reciboLiquidacionDia');
    
    tipoInput.value = tipo;
    
    if (tipo === 'devolucion') {
        btnDevolucion.classList.remove('btn-outline-primary');
        btnDevolucion.classList.add('active', 'btn-primary');
        btnGasto.classList.remove('active', 'btn-warning');
        btnGasto.classList.add('btn-outline-warning');
        reciboContainer.style.display = 'none';
        reciboInput.required = false;
        reciboInput.value = '';
    } else if (tipo === 'gasto') {
        btnGasto.classList.remove('btn-outline-warning');
        btnGasto.classList.add('active', 'btn-warning');
        btnDevolucion.classList.remove('active', 'btn-primary');
        btnDevolucion.classList.add('btn-outline-primary');
        reciboContainer.style.display = 'block';
        reciboInput.required = true;
    }
};

// Procesar liquidación por día contable
window.procesarLiquidacionDiaContable = async function() {
    if (!datosLiquidacionDiaContable) {
        mostrarMensaje('Error: No hay datos de liquidación', 'danger');
        return;
    }
    
    try {
        const tipoInput = document.getElementById('tipoLiquidacionDia');
        const cantidadInput = document.getElementById('cantidadLiquidacionDia');
        const reciboInput = document.getElementById('reciboLiquidacionDia');
        
        if (!tipoInput || !cantidadInput) {
            mostrarMensaje('Error: Campos no encontrados', 'danger');
            return;
        }
        
        const tipo = tipoInput.value;
        const cantidad = parseInt(cantidadInput.value);
        const recibo = reciboInput ? reciboInput.value.trim() : '';
        
        if (!tipo || !cantidad) {
            mostrarMensaje('Completa todos los campos obligatorios', 'warning');
            return;
        }
        
        if (cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        if (cantidad > Math.abs(datosLiquidacionDiaContable.saldo)) {
            mostrarMensaje(`La cantidad no puede ser mayor al saldo disponible (${datosLiquidacionDiaContable.saldo})`, 'warning');
            return;
        }
        
        // Validar recibo para gastos
        if (tipo === 'gasto') {
            if (!recibo || recibo.trim() === '') {
                mostrarMensaje('El número de recibo es obligatorio para gastos', 'warning');
                return;
            }
            const reciboNum = parseInt(recibo);
            if (isNaN(reciboNum) || reciboNum <= 0 || !Number.isInteger(reciboNum)) {
                mostrarMensaje('El número de recibo debe ser un número entero mayor a 0', 'warning');
                return;
            }
        }
        
        mostrarMensaje('Procesando liquidación...', 'info');
        
        // Crear fecha contable (23:00 GMT-6 del día seleccionado)
        const fechaParts = datosLiquidacionDiaContable.diaContable.split('-');
        const año = parseInt(fechaParts[0]);
        const mes = parseInt(fechaParts[1]) - 1;
        const día = parseInt(fechaParts[2]);
        const inicioDia = new Date(Date.UTC(año, mes, día, 6, 0, 0, 0)); // Medianoche GMT-6 = 6 AM UTC
        const fechaTimestamp = new Date(inicioDia.getTime() + (23 * 60 * 60 * 1000)); // Agregar 23 horas
        
        let movimientoId = null;
        
        if (tipo === 'gasto') {
            // Buscar cuenta "Gasto Natural"
            const cuentaGastoNatural = cuentasGasto.find(c => 
                c.activo !== false && 
                (c.nombre && c.nombre.toLowerCase().includes('gasto natural'))
            );
            
            if (!cuentaGastoNatural) {
                mostrarMensaje('No se encontró la cuenta "Gasto Natural". Contacta al administrador.', 'danger');
                return;
            }
            
            const bodega = misBodegas.find(b => b.id === datosLiquidacionDiaContable.bodegaId);
            const nombreBodega = bodega ? bodega.nombre : 'Bodega no encontrada';
            
            const ahora = ahoraGMT6();
            const movimientoData = {
                tipo: 'gasto',
                productoId: datosLiquidacionDiaContable.productoId,
                origen: datosLiquidacionDiaContable.bodegaId,
                destino: cuentaGastoNatural.id,
                cantidad: cantidad,
                fecha: fechaTimestamp,
                createdAt: serverTimestamp(), // Usar serverTimestamp para precisión exacta
                lastModifiedAt: ahora,
                usuarioId: currentUser.id,
                cuentaGasto: cuentaGastoNatural.nombre,
                cuentaGastoId: cuentaGastoNatural.id,
                origenNombre: nombreBodega,
                destinoNombre: cuentaGastoNatural.nombre,
                motivo: 'Liquidación desde operario',
                observaciones: '',
                recibo: parseInt(recibo),
                revisado: false
            };
            
            const docRef = await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
            movimientoId = docRef.id;
            
            // Actualizar stock
            const stockQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', datosLiquidacionDiaContable.bodegaId),
                where('productoId', '==', datosLiquidacionDiaContable.productoId)
            );
            const stockSnapshot = await getDocs(stockQuery);
            if (!stockSnapshot.empty) {
                const stockDoc = stockSnapshot.docs[0];
                await updateDoc(doc(db, 'stock_bodegas', stockDoc.id), {
                    stockActual: increment(-cantidad),
                    ultimaActualizacion: serverTimestamp()
                });
            }
            
        } else if (tipo === 'devolucion') {
            // Buscar bodega principal
            const bodegasQuery = query(
                collection(db, 'bodegas'),
                where('tipo', '==', 'principal')
            );
            const bodegasSnapshot = await getDocs(bodegasQuery);
            
            if (bodegasSnapshot.empty) {
                mostrarMensaje('No se encontró bodega principal', 'danger');
                return;
            }
            
            const bodegaPrincipal = bodegasSnapshot.docs[0];
            const bodegaPrincipalId = bodegaPrincipal.id;
            
            // Registrar devolución
            const ahora = ahoraGMT6();
            const movimientoData = {
                tipo: 'transferencia',
                productoId: datosLiquidacionDiaContable.productoId,
                origen: datosLiquidacionDiaContable.bodegaId,
                destino: bodegaPrincipalId,
                cantidad: cantidad,
                fecha: fechaTimestamp,
                createdAt: ahora,
                lastModifiedAt: ahora,
                usuarioId: currentUser.id,
                nota: 'Devolución desde liquidación operario',
                liquidacionBulk: false
            };
            
            const docRef = await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
            movimientoId = docRef.id;
            
            // Actualizar stock origen (bodega especial)
            const stockOrigenQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', datosLiquidacionDiaContable.bodegaId),
                where('productoId', '==', datosLiquidacionDiaContable.productoId)
            );
            const stockOrigenSnapshot = await getDocs(stockOrigenQuery);
            if (!stockOrigenSnapshot.empty) {
                const stockOrigenDoc = stockOrigenSnapshot.docs[0];
                await updateDoc(doc(db, 'stock_bodegas', stockOrigenDoc.id), {
                    stockActual: increment(-cantidad),
                    ultimaActualizacion: serverTimestamp()
                });
            }
            
            // Actualizar o crear stock destino (bodega principal)
            const stockDestinoQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', bodegaPrincipalId),
                where('productoId', '==', datosLiquidacionDiaContable.productoId)
            );
            const stockDestinoSnapshot = await getDocs(stockDestinoQuery);
            if (!stockDestinoSnapshot.empty) {
                const stockDestinoDoc = stockDestinoSnapshot.docs[0];
                await updateDoc(doc(db, 'stock_bodegas', stockDestinoDoc.id), {
                    stockActual: increment(cantidad),
                    ultimaActualizacion: serverTimestamp()
                });
            } else {
                // Crear nuevo stock
                await addDoc(collection(db, 'stock_bodegas'), {
                    bodegaId: bodegaPrincipalId,
                    productoId: datosLiquidacionDiaContable.productoId,
                    stockActual: cantidad,
                    stockMinimo: 0,
                    createdAt: serverTimestamp(),
                    ultimaActualizacion: serverTimestamp()
                });
            }
        }
        
        mostrarMensaje('Liquidación procesada exitosamente', 'success');
        
        // Cerrar modal
        const modalElement = document.getElementById('modalLiquidacionDiaContable');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
        
        // Recargar datos
        await cargarStockBodeguita();
        await mostrarInventarioEspecialPorDia();
        
    } catch (error) {
        console.error('❌ Error procesando liquidación:', error);
        mostrarMensaje('Error al procesar la liquidación: ' + error.message, 'danger');
    }
};

// Toggle para mostrar/ocultar días con saldo 0
window.toggleDiasSaldoCero = function() {
    const toggleBtn = document.getElementById('toggleSaldoCero');
    const diasNeteados = document.querySelectorAll('.dias-neteados');
    const isVisible = diasNeteados[0] && diasNeteados[0].style.display !== 'none';
    
    if (isVisible) {
        // Ocultar
        diasNeteados.forEach(el => el.style.display = 'none');
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        toggleBtn.setAttribute('title', 'Mostrar neteados');
        toggleBtn.classList.remove('btn-outline-primary');
        toggleBtn.classList.add('btn-outline-secondary');
    } else {
        // Mostrar
        diasNeteados.forEach(el => el.style.display = 'block');
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleBtn.setAttribute('title', 'Ocultar neteados');
        toggleBtn.classList.remove('btn-outline-secondary');
        toggleBtn.classList.add('btn-outline-primary');
    }
};

// Variables para liquidación APV
let datosLiquidacionAPV = null;

// Abrir modal de liquidación APV
window.abrirLiquidacionAPV = function(nombreProducto, cantidadDisponible, bodegaId, bodegaNombre) {
    // Buscar el producto por nombre
    const producto = productos.find(p => p.nombre === nombreProducto);
    if (!producto) {
        mostrarMensaje('Producto no encontrado', 'danger');
        return;
    }
    
    // Buscar el stock en la bodega APV
    const stock = stockTodasAPV.find(s => 
        s.bodegaId === bodegaId && 
        s.productoId === producto.id && 
        (s.stockActual || 0) > 0
    );
    
    if (!stock) {
        mostrarMensaje('No se encontró stock para este producto en esta bodega', 'danger');
        return;
    }
    
    // Guardar datos para procesar
    datosLiquidacionAPV = {
        productoId: producto.id,
        productoNombre: producto.nombre,
        bodegaId: bodegaId,
        bodegaNombre: bodegaNombre,
        cantidadDisponible: stock.stockActual || 0
    };
    
    // Llenar información del modal
    document.getElementById('infoProductoAPV').textContent = producto.nombre;
    document.getElementById('infoBodegaAPV').textContent = `Bodega: ${bodegaNombre}`;
    document.getElementById('infoSaldoAPV').textContent = `Disponible: ${stock.stockActual || 0} unidades`;
    
    // Limpiar y configurar campos
    const cantidadInput = document.getElementById('cantidadLiquidacionAPV');
    const maxCantidadSpan = document.getElementById('maxCantidadAPV');
    const reciboInput = document.getElementById('reciboLiquidacionAPV');
    
    if (cantidadInput) {
        cantidadInput.value = 1; // Valor por defecto: 1
        cantidadInput.max = stock.stockActual || 0;
        cantidadInput.dataset.max = stock.stockActual || 0;
    }
    
    if (maxCantidadSpan) {
        maxCantidadSpan.textContent = stock.stockActual || 0;
    }
    
    if (reciboInput) {
        reciboInput.value = '';
    }
    
    // Abrir modal
    const modalElement = document.getElementById('modalLiquidacionAPV');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
};

// Procesar liquidación APV
window.procesarLiquidacionAPV = async function() {
    if (!datosLiquidacionAPV) {
        mostrarMensaje('Error: No hay datos de liquidación', 'danger');
        return;
    }
    
    try {
        const cantidadInput = document.getElementById('cantidadLiquidacionAPV');
        const reciboInput = document.getElementById('reciboLiquidacionAPV');
        
        if (!cantidadInput || !reciboInput) {
            mostrarMensaje('Error: Campos no encontrados', 'danger');
            return;
        }
        
        const cantidad = parseInt(cantidadInput.value);
        const recibo = reciboInput.value.trim();
        
        // Validaciones
        if (!cantidad || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        if (cantidad > datosLiquidacionAPV.cantidadDisponible) {
            mostrarMensaje(`La cantidad no puede ser mayor a ${datosLiquidacionAPV.cantidadDisponible} unidades`, 'warning');
            return;
        }
        
        if (!recibo || recibo === '') {
            mostrarMensaje('El número de recibo es obligatorio', 'warning');
            return;
        }
        
        const reciboNum = parseInt(recibo);
        if (isNaN(reciboNum) || reciboNum <= 0 || !Number.isInteger(reciboNum)) {
            mostrarMensaje('El número de recibo debe ser un número entero mayor a 0', 'warning');
            return;
        }
        
        // Buscar cuenta "Gasto Natural"
        const cuentaGastoNatural = cuentasGasto.find(c => 
            c.activo !== false && 
            (c.nombre && c.nombre.toLowerCase().includes('gasto natural'))
        );
        
        if (!cuentaGastoNatural) {
            mostrarMensaje('No se encontró la cuenta "Gasto Natural". Contacta al administrador.', 'danger');
            return;
        }
        
        // Buscar el producto
        const producto = productos.find(p => p.id === datosLiquidacionAPV.productoId);
        if (!producto) {
            mostrarMensaje('Producto no encontrado', 'danger');
            return;
        }
        
        // Buscar el stock en la bodega APV
        const stockQuery = query(
            collection(db, 'stock_bodegas'),
            where('bodegaId', '==', datosLiquidacionAPV.bodegaId),
            where('productoId', '==', datosLiquidacionAPV.productoId)
        );
        const stockSnapshot = await getDocs(stockQuery);
        
        if (stockSnapshot.empty) {
            mostrarMensaje('No se encontró stock para este producto en esta bodega', 'danger');
            return;
        }
        
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockActual = stockData.stockActual || 0;
        
        if (stockActual < cantidad) {
            mostrarMensaje(`No hay suficiente stock. Disponible: ${stockActual} unidades`, 'danger');
            return;
        }
        
        // Calcular precio y total
        const precioUnitario = producto.precioUnitario || 0;
        const total = cantidad * precioUnitario;
        
        // Crear movimiento de gasto
        const ahora = ahoraGMT6();
        const movimientoData = {
            tipo: 'gasto',
            productoId: datosLiquidacionAPV.productoId,
            origen: datosLiquidacionAPV.bodegaId,
            destino: cuentaGastoNatural.id,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            fecha: ahora,
            createdAt: serverTimestamp(), // Usar serverTimestamp para precisión exacta
            lastModifiedAt: ahora,
            usuarioId: currentUser.id,
            empleado: currentUser.nombre || 'Usuario',
            cuentaGasto: cuentaGastoNatural.nombre,
            cuentaGastoId: cuentaGastoNatural.id,
            origenNombre: datosLiquidacionAPV.bodegaNombre,
            destinoNombre: cuentaGastoNatural.nombre,
            motivo: 'Liquidación desde APV',
            observaciones: '',
            recibo: reciboNum,
            revisado: false
        };
        
        // Guardar movimiento
        await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
        
        // Actualizar stock
        await updateDoc(stockDoc.ref, {
            stockActual: increment(-cantidad),
            lastModifiedAt: ahora
        });
        
        // Cerrar modal
        const modalElement = document.getElementById('modalLiquidacionAPV');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        
        // Limpiar datos
        const productoNombre = datosLiquidacionAPV.productoNombre;
        datosLiquidacionAPV = null;
        
        // Recargar datos
        await cargarStockTodasAPV();
        mostrarInventarioAPV();
        
        mostrarMensaje(`✅ Liquidación registrada: ${cantidad} unidades de ${productoNombre}`, 'success');
        
    } catch (error) {
        console.error('❌ Error procesando liquidación APV:', error);
        mostrarMensaje('Error al procesar la liquidación: ' + error.message, 'danger');
    }
};

// Variables para liquidación Rutero
let datosLiquidacionRutero = null;

// Abrir modal de liquidación Rutero
window.abrirLiquidacionRutero = function(nombreProducto, cantidadDisponible) {
    // Buscar el producto por nombre
    const producto = productos.find(p => p.nombre === nombreProducto);
    if (!producto) {
        mostrarMensaje('Producto no encontrado', 'danger');
        return;
    }
    
    // Buscar el stock en las bodegas rutero del usuario
    const stockRutero = stockBodeguita.find(s => 
        s.bodegaTipo === 'rutero' && 
        s.productoId === producto.id && 
        (s.stockActual || 0) > 0
    );
    
    if (!stockRutero) {
        mostrarMensaje('No se encontró stock para este producto en tu bodega personal', 'danger');
        return;
    }
    
    // Buscar la bodega rutero
    const bodegaRutero = misBodegas.find(b => b.id === stockRutero.bodegaId && b.tipo === 'rutero');
    if (!bodegaRutero) {
        mostrarMensaje('Bodega rutero no encontrada', 'danger');
        return;
    }
    
    // Guardar datos para procesar
    datosLiquidacionRutero = {
        productoId: producto.id,
        productoNombre: producto.nombre,
        bodegaId: bodegaRutero.id,
        bodegaNombre: bodegaRutero.nombre,
        cantidadDisponible: stockRutero.stockActual || 0,
        stockDocId: stockRutero.id
    };
    
    // Llenar información del modal
    document.getElementById('infoProductoRutero').textContent = producto.nombre;
    document.getElementById('infoSaldoRutero').textContent = `Disponible: ${stockRutero.stockActual || 0} unidades`;
    
    // Limpiar y configurar campos
    const cantidadInput = document.getElementById('cantidadLiquidacionRutero');
    const maxCantidadSpan = document.getElementById('maxCantidadRutero');
    
    if (cantidadInput) {
        cantidadInput.value = 1; // Valor por defecto: 1
        cantidadInput.max = stockRutero.stockActual || 0;
        cantidadInput.dataset.max = stockRutero.stockActual || 0;
    }
    
    if (maxCantidadSpan) {
        maxCantidadSpan.textContent = stockRutero.stockActual || 0;
    }
    
    // Abrir modal
    const modalElement = document.getElementById('modalLiquidacionRutero');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
};

// Procesar liquidación Rutero
window.procesarLiquidacionRutero = async function() {
    if (!datosLiquidacionRutero) {
        mostrarMensaje('Error: No hay datos de liquidación', 'danger');
        return;
    }
    
    try {
        const cantidadInput = document.getElementById('cantidadLiquidacionRutero');
        
        if (!cantidadInput) {
            mostrarMensaje('Error: Campo no encontrado', 'danger');
            return;
        }
        
        const cantidad = parseInt(cantidadInput.value);
        
        // Validaciones
        if (!cantidad || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        if (cantidad > datosLiquidacionRutero.cantidadDisponible) {
            mostrarMensaje(`La cantidad no puede ser mayor a ${datosLiquidacionRutero.cantidadDisponible} unidades`, 'warning');
            return;
        }
        
        // Buscar cuenta "Gasto Natural"
        const cuentaGastoNatural = cuentasGasto.find(c => 
            c.activo !== false && 
            (c.nombre && c.nombre.toLowerCase().includes('gasto natural'))
        );
        
        if (!cuentaGastoNatural) {
            mostrarMensaje('No se encontró la cuenta "Gasto Natural". Contacta al administrador.', 'danger');
            return;
        }
        
        // Buscar el producto
        const producto = productos.find(p => p.id === datosLiquidacionRutero.productoId);
        if (!producto) {
            mostrarMensaje('Producto no encontrado', 'danger');
            return;
        }
        
        // Buscar el stock en la bodega rutero
        const stockQuery = query(
            collection(db, 'stock_bodegas'),
            where('bodegaId', '==', datosLiquidacionRutero.bodegaId),
            where('productoId', '==', datosLiquidacionRutero.productoId)
        );
        const stockSnapshot = await getDocs(stockQuery);
        
        if (stockSnapshot.empty) {
            mostrarMensaje('No se encontró stock para este producto en tu bodega', 'danger');
            return;
        }
        
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockActual = stockData.stockActual || 0;
        
        if (stockActual < cantidad) {
            mostrarMensaje(`No hay suficiente stock. Disponible: ${stockActual} unidades`, 'danger');
            return;
        }
        
        // Calcular precio y total
        const precioUnitario = producto.precioUnitario || 0;
        const total = cantidad * precioUnitario;
        
        // Crear movimiento de gasto
        const ahora = ahoraGMT6();
        const movimientoData = {
            tipo: 'gasto',
            productoId: datosLiquidacionRutero.productoId,
            origen: datosLiquidacionRutero.bodegaId,
            destino: cuentaGastoNatural.id,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            total: total,
            fecha: ahora,
            createdAt: serverTimestamp(), // Usar serverTimestamp para precisión exacta
            lastModifiedAt: ahora,
            usuarioId: currentUser.id,
            empleado: currentUser.nombre || 'Usuario',
            cuentaGasto: cuentaGastoNatural.nombre,
            cuentaGastoId: cuentaGastoNatural.id,
            origenNombre: datosLiquidacionRutero.bodegaNombre,
            destinoNombre: cuentaGastoNatural.nombre,
            motivo: 'Liquidación desde Bodega Personal',
            observaciones: '',
            revisado: false
        };
        
        // Guardar movimiento
        await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
        
        // Actualizar stock
        await updateDoc(stockDoc.ref, {
            stockActual: increment(-cantidad),
            lastModifiedAt: ahora
        });
        
        // Cerrar modal
        const modalElement = document.getElementById('modalLiquidacionRutero');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        
        // Limpiar datos
        const productoNombre = datosLiquidacionRutero.productoNombre;
        datosLiquidacionRutero = null;
        
        // Recargar datos
        await cargarStockBodeguita();
        mostrarInventarioRutero();
        
        mostrarMensaje(`✅ Liquidación registrada: ${cantidad} unidades de ${productoNombre}`, 'success');
        
    } catch (error) {
        console.error('❌ Error procesando liquidación Rutero:', error);
        mostrarMensaje('Error al procesar la liquidación: ' + error.message, 'danger');
    }
};

// Funciones para incrementar/decrementar cantidad en liquidación Rutero
// Funciones genéricas para incrementar/decrementar cantidad
window.incrementarCantidad = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const currentValue = parseInt(input.value) || 0;
    const maxValue = parseInt(input.max) || Infinity;
    const newValue = Math.min(currentValue + 1, maxValue);
    input.value = newValue;
    // Disparar evento change para actualizar otros campos si es necesario
    input.dispatchEvent(new Event('change'));
};

window.decrementarCantidad = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const currentValue = parseInt(input.value) || 0;
    const minValue = parseInt(input.min) || 1;
    const newValue = Math.max(currentValue - 1, minValue);
    input.value = newValue;
    // Disparar evento change para actualizar otros campos si es necesario
    input.dispatchEvent(new Event('change'));
};

window.incrementarCantidadRutero = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionRutero');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual < maxCantidad) {
        cantidadInput.value = cantidadActual + 1;
        validarCantidadRutero();
    }
};

window.decrementarCantidadRutero = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionRutero');
    if (!cantidadInput) return;
    
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > 1) {
        cantidadInput.value = cantidadActual - 1;
        validarCantidadRutero();
    }
};

// Validar que la cantidad no exceda el máximo
window.validarCantidadRutero = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionRutero');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > maxCantidad) {
        cantidadInput.value = maxCantidad;
    } else if (cantidadActual < 1) {
        cantidadInput.value = 1;
    }
};

// Funciones para incrementar/decrementar cantidad en liquidación Día
window.incrementarCantidadDia = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionDia');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual < maxCantidad) {
        cantidadInput.value = cantidadActual + 1;
        validarCantidadDia();
    }
};

window.decrementarCantidadDia = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionDia');
    if (!cantidadInput) return;
    
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > 1) {
        cantidadInput.value = cantidadActual - 1;
        validarCantidadDia();
    }
};

// Validar que la cantidad no exceda el máximo en liquidación Día
window.validarCantidadDia = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionDia');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > maxCantidad) {
        cantidadInput.value = maxCantidad;
    } else if (cantidadActual < 1) {
        cantidadInput.value = 1;
    }
};

// Funciones para incrementar/decrementar cantidad en liquidación APV
window.incrementarCantidadAPV = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionAPV');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual < maxCantidad) {
        cantidadInput.value = cantidadActual + 1;
        validarCantidadAPV();
    }
};

window.decrementarCantidadAPV = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionAPV');
    if (!cantidadInput) return;
    
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > 1) {
        cantidadInput.value = cantidadActual - 1;
        validarCantidadAPV();
    }
};

// Validar que la cantidad no exceda el máximo en liquidación APV
window.validarCantidadAPV = function() {
    const cantidadInput = document.getElementById('cantidadLiquidacionAPV');
    if (!cantidadInput) return;
    
    const maxCantidad = parseInt(cantidadInput.dataset.max) || parseInt(cantidadInput.max) || 0;
    const cantidadActual = parseInt(cantidadInput.value) || 1;
    
    if (cantidadActual > maxCantidad) {
        cantidadInput.value = maxCantidad;
    } else if (cantidadActual < 1) {
        cantidadInput.value = 1;
    }
};

// Función para abrir modal de reportar pérdida de herramienta
window.abrirReportarGastoHerramienta = function(nombreHerramienta, cantidadDisponible) {
    console.log('🔧 Abriendo modal de pérdida de herramienta:', nombreHerramienta);
    
    // Prellenar datos
    document.getElementById('herramientaNombrePerdida').value = nombreHerramienta;
    document.getElementById('cantidadPerdidaHerramienta').value = 1;
    document.getElementById('cantidadPerdidaHerramienta').max = cantidadDisponible;
    document.getElementById('fechaPerdidaHerramienta').value = new Date().toISOString().split('T')[0];
    document.getElementById('motivoPerdidaHerramienta').value = '';
    document.getElementById('descripcionPerdidaHerramienta').value = '';
    document.getElementById('observacionesPerdidaHerramienta').value = '';
    
    // Llenar select de bodegas de herramientas
    llenarSelectBodegasHerramientasPerdida();
    
    // Ocultar info de saldo inicialmente
    document.getElementById('infoSaldoHerramientaPerdida').style.display = 'none';
    
    // Mostrar modal
    const modalElement = document.getElementById('modalReportarPerdidaHerramienta');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('❌ Modal modalReportarPerdidaHerramienta no encontrado');
    }
};

// Llenar select de bodegas de herramientas para pérdida
function llenarSelectBodegasHerramientasPerdida() {
    const select = document.getElementById('bodegaOrigenHerramientaPerdida');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleccionar bodega...</option>';
    
    // Filtrar solo bodegas de herramientas asignadas al empleado
    const bodegasHerramientas = misBodegas.filter(b => b.tipo === 'herramientas');
    
    if (bodegasHerramientas.length === 0) {
        select.innerHTML = '<option value="">No hay bodegas de herramientas asignadas</option>';
        return;
    }
    
    bodegasHerramientas.forEach(bodega => {
        const option = document.createElement('option');
        option.value = bodega.id;
        option.textContent = bodega.nombre;
        select.appendChild(option);
    });
    
    // Agregar listener para actualizar saldo cuando se seleccione bodega
    select.onchange = function() {
        actualizarSaldoHerramientaPerdida();
    };
}

// Actualizar saldo cuando se selecciona bodega
function actualizarSaldoHerramientaPerdida() {
    const bodegaId = document.getElementById('bodegaOrigenHerramientaPerdida').value;
    const herramientaNombre = document.getElementById('herramientaNombrePerdida').value;
    
    if (!bodegaId || !herramientaNombre) {
        document.getElementById('infoSaldoHerramientaPerdida').style.display = 'none';
        return;
    }
    
    // Buscar la herramienta
    const herramienta = herramientas.find(h => h.nombre === herramientaNombre);
    if (!herramienta) {
        document.getElementById('infoSaldoHerramientaPerdida').style.display = 'none';
        return;
    }
    
    // Buscar stock en esa bodega
    const stock = stockHerramientas.find(s => 
        s.bodegaId === bodegaId && s.herramientaId === herramienta.id
    );
    
    const saldo = stock ? (stock.stockActual || 0) : 0;
    document.getElementById('saldoActualHerramientaPerdida').textContent = saldo;
    document.getElementById('infoSaldoHerramientaPerdida').style.display = 'block';
    
    // Actualizar máximo de cantidad
    document.getElementById('cantidadPerdidaHerramienta').max = saldo;
}

// Registrar pérdida de herramienta (requiere aprobación)
window.registrarPerdidaHerramienta = async function() {
    try {
        const herramientaNombre = document.getElementById('herramientaNombrePerdida').value;
        const bodegaId = document.getElementById('bodegaOrigenHerramientaPerdida').value;
        const cantidad = parseInt(document.getElementById('cantidadPerdidaHerramienta').value);
        const fechaPerdida = document.getElementById('fechaPerdidaHerramienta').value;
        const motivo = document.getElementById('motivoPerdidaHerramienta').value;
        const descripcion = document.getElementById('descripcionPerdidaHerramienta').value.trim();
        const observaciones = document.getElementById('observacionesPerdidaHerramienta').value.trim();
        
        // Validaciones
        if (!herramientaNombre || !bodegaId || !cantidad || !fechaPerdida || !motivo || !descripcion) {
            mostrarMensaje('Por favor completa todos los campos obligatorios', 'warning');
            return;
        }
        
        if (descripcion.length < 20) {
            mostrarMensaje('La descripción debe tener al menos 20 caracteres. Sé más específico sobre cómo se perdió la herramienta.', 'warning');
            return;
        }
        
        if (cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        // Buscar herramienta
        const herramienta = herramientas.find(h => h.nombre === herramientaNombre);
        if (!herramienta) {
            mostrarMensaje('Herramienta no encontrada', 'danger');
            return;
        }
        
        // Buscar bodega
        const bodega = misBodegas.find(b => b.id === bodegaId && b.tipo === 'herramientas');
        if (!bodega) {
            mostrarMensaje('Bodega de herramientas no encontrada', 'danger');
            return;
        }
        
        // Verificar stock disponible
        const stock = stockHerramientas.find(s => 
            s.bodegaId === bodegaId && s.herramientaId === herramienta.id
        );
        
        if (!stock || (stock.stockActual || 0) < cantidad) {
            mostrarMensaje('No hay suficiente stock disponible en esta bodega', 'warning');
            return;
        }
        
        // Crear registro de pérdida (NO rebajar stock todavía, requiere aprobación)
        const perdidaData = {
            herramientaId: herramienta.id,
            herramientaNombre: herramienta.nombre,
            bodegaId: bodegaId,
            bodegaNombre: bodega.nombre,
            cantidadPerdida: cantidad,
            fechaPerdida: fechaPerdida,
            motivo: motivo,
            descripcion: descripcion,
            observaciones: observaciones,
            empleadoId: currentUser.id,
            empleadoNombre: `${currentUser.primerNombre} ${currentUser.primerApellido}`,
            fechaReporte: ahoraGMT6(),
            estado: 'pendiente_auditoria', // Requiere aprobación de administrador
            tipo: 'perdida_herramienta'
        };
        
        console.log('📝 Registrando pérdida de herramienta:', perdidaData);
        
        // Guardar en Firestore (colección de gastos o crear nueva colección de pérdidas)
        await addDoc(collection(db, 'gastos'), perdidaData);
        
        mostrarMensaje('✅ Pérdida de herramienta reportada. Un administrador revisará tu reporte antes de rebajar el inventario.', 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalReportarPerdidaHerramienta'));
        if (modal) modal.hide();
        
        // Limpiar formulario
        document.getElementById('formReportarPerdidaHerramienta').reset();
        
        // Recargar datos después de un momento
        setTimeout(() => {
            cargarStockHerramientas();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error registrando pérdida de herramienta:', error);
        mostrarMensaje('Error al registrar la pérdida. Intenta nuevamente.', 'danger');
    }
};

// Variables para devolución de herramientas
let datosDevolucionHerramienta = null;

// Función para abrir modal de devolución de herramienta
window.abrirDevolucionHerramienta = function(nombreHerramienta, cantidadDisponible, bodegaId, herramientaId) {
    console.log('🔄 Abriendo modal de devolución de herramienta:', nombreHerramienta);
    
    // Validar que la bodega sea especial
    const bodega = misBodegas.find(b => b.id === bodegaId && b.tipo === 'especial');
    if (!bodega) {
        mostrarMensaje('Solo se pueden devolver herramientas de bodegas especiales', 'warning');
        return;
    }
    
    // Buscar stock en esa bodega
    const stock = stockHerramientas.find(s => 
        s.bodegaId === bodegaId && s.herramientaId === herramientaId && s.bodegaTipo === 'especial'
    );
    
    if (!stock || (stock.stockActual || 0) <= 0) {
        mostrarMensaje('No hay stock disponible de esta herramienta en la bodega especial', 'warning');
        return;
    }
    
    // Guardar datos para procesar
    datosDevolucionHerramienta = {
        herramientaId: herramientaId,
        herramientaNombre: nombreHerramienta,
        bodegaId: bodegaId,
        bodegaNombre: bodega.nombre,
        cantidadDisponible: stock.stockActual || 0
    };
    
    // Llenar información del modal
    const herramientaNombreEl = document.getElementById('herramientaNombreDevolucion');
    const bodegaOrigenEl = document.getElementById('bodegaOrigenDevolucion');
    const saldoActualEl = document.getElementById('saldoActualDevolucion');
    const cantidadInput = document.getElementById('cantidadDevolucionHerramienta');
    
    if (herramientaNombreEl) herramientaNombreEl.textContent = nombreHerramienta;
    if (bodegaOrigenEl) bodegaOrigenEl.textContent = bodega.nombre;
    if (saldoActualEl) saldoActualEl.textContent = stock.stockActual || 0;
    if (cantidadInput) {
        cantidadInput.value = 1;
        cantidadInput.max = stock.stockActual || 0;
        cantidadInput.min = 1;
    }
    
    // Mostrar modal
    const modalElement = document.getElementById('modalDevolucionHerramienta');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('❌ Modal modalDevolucionHerramienta no encontrado');
    }
};

// Procesar devolución de herramienta
window.procesarDevolucionHerramienta = async function() {
    if (!datosDevolucionHerramienta) {
        mostrarMensaje('Error: No hay datos de devolución', 'danger');
        return;
    }
    
    try {
        const cantidadInput = document.getElementById('cantidadDevolucionHerramienta');
        const cantidad = parseInt(cantidadInput.value) || 0;
        
        // Validaciones
        if (!cantidad || cantidad <= 0) {
            mostrarMensaje('La cantidad debe ser mayor a 0', 'warning');
            return;
        }
        
        if (cantidad > datosDevolucionHerramienta.cantidadDisponible) {
            mostrarMensaje(`La cantidad no puede ser mayor a ${datosDevolucionHerramienta.cantidadDisponible} unidades`, 'warning');
            return;
        }
        
        // Buscar o crear "Bodega Principal Herramientas"
        let bodegaPrincipalHerramientas = null;
        let bodegaPrincipalHerramientasId = null;
        
        // Buscar bodega principal de herramientas
        const qPrincipal = query(
            collection(db, 'bodegas'),
            where('tipo', '==', 'herramientas'),
            where('nombre', '==', 'Bodega Principal Herramientas'),
            limit(1)
        );
        const snapshotPrincipal = await getDocs(qPrincipal);
        
        if (!snapshotPrincipal.empty) {
            bodegaPrincipalHerramientas = snapshotPrincipal.docs[0].data();
            bodegaPrincipalHerramientasId = snapshotPrincipal.docs[0].id;
        } else {
            // Si no existe, buscar cualquier bodega principal de herramientas
            const qAlternativa = query(
                collection(db, 'bodegas'),
                where('tipo', '==', 'herramientas'),
                limit(1)
            );
            const snapshotAlternativa = await getDocs(qAlternativa);
            
            if (!snapshotAlternativa.empty) {
                bodegaPrincipalHerramientas = snapshotAlternativa.docs[0].data();
                bodegaPrincipalHerramientasId = snapshotAlternativa.docs[0].id;
                console.log('⚠️ No se encontró "Bodega Principal Herramientas", usando:', bodegaPrincipalHerramientas.nombre);
            } else {
                mostrarMensaje('No se encontró ninguna bodega de herramientas principal. Contacta al administrador.', 'danger');
                return;
            }
        }
        
        // Buscar el stock en la bodega especial
        const stockQuery = query(
            collection(db, 'stock_bodegas'),
            where('bodegaId', '==', datosDevolucionHerramienta.bodegaId),
            where('herramientaId', '==', datosDevolucionHerramienta.herramientaId)
        );
        const stockSnapshot = await getDocs(stockQuery);
        
        if (stockSnapshot.empty) {
            mostrarMensaje('No se encontró stock para esta herramienta en la bodega especial', 'danger');
            return;
        }
        
        const stockDoc = stockSnapshot.docs[0];
        const stockData = stockDoc.data();
        const stockActual = stockData.stockActual || 0;
        
        if (stockActual < cantidad) {
            mostrarMensaje(`No hay suficiente stock. Disponible: ${stockActual} unidades`, 'danger');
            return;
        }
        
        // Crear movimiento de transferencia
        const ahora = ahoraGMT6();
        const movimientoData = {
            fecha: ahora,
            tipo: 'transferencia',
            herramientaId: datosDevolucionHerramienta.herramientaId,
            herramientaNombre: datosDevolucionHerramienta.herramientaNombre,
            tipoItem: 'herramienta',
            origen: datosDevolucionHerramienta.bodegaId,
            origenNombre: datosDevolucionHerramienta.bodegaNombre,
            destino: bodegaPrincipalHerramientasId,
            destinoNombre: bodegaPrincipalHerramientas.nombre,
            cantidad: cantidad,
            motivo: 'Devolución desde bodega especial',
            observaciones: 'Devolución realizada por operario',
            usuarioId: currentUser.id,
            empleado: currentUser.nombre || 'Usuario',
            fechaRegistro: serverTimestamp(),
            createdAt: ahora,
            lastModifiedAt: ahora
        };
        
        // Obtener precio si es posible
        const herramienta = herramientas.find(h => h.id === datosDevolucionHerramienta.herramientaId);
        if (herramienta && herramienta.precioUnitario) {
            movimientoData.precioUnitario = herramienta.precioUnitario;
            movimientoData.total = cantidad * herramienta.precioUnitario;
        }
        
        // Procesar movimiento (crea movimiento y actualiza stocks automáticamente)
        await procesarMovimientoInventario(db, movimientoData, 'herramienta');
        
        mostrarMensaje(`✅ Devolución registrada: ${cantidad} unidades de ${datosDevolucionHerramienta.herramientaNombre} devueltas a ${bodegaPrincipalHerramientas.nombre}`, 'success');
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalDevolucionHerramienta'));
        if (modal) modal.hide();
        
        // Limpiar datos
        datosDevolucionHerramienta = null;
        
        // Recargar datos
        await cargarStockHerramientas();
        
    } catch (error) {
        console.error('❌ Error procesando devolución de herramienta:', error);
        mostrarMensaje('Error al procesar la devolución: ' + error.message, 'danger');
    }
};

// Hacer funciones globales
window.registrarGasto = registrarGasto;
// showUserInfo y addLogoutButton ahora vienen de load-headersecure.js
