import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let productos = [];
let bodegas = [];
let stockBodegas = [];

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Esperar a que el authManager esté disponible y el usuario autenticado
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        // Cargar datos en tiempo real
        cargarDatos();
        
    } catch (error) {
        console.error('Error inicializando dashboard:', error);
    }
});

// Helper para esperar a que window.authManager esté definido
function esperarAuthManager() {
    return new Promise((resolve, reject) => {
        // Si ya existe, resolver inmediatamente
        if (window.authManager) {
            resolve(window.authManager);
            return;
        }

        // Si no, esperar al evento secure-auth-ready
        const onAuthReady = () => {
            window.removeEventListener('secure-auth-ready', onAuthReady);
            if (window.authManager) {
                resolve(window.authManager);
            } else {
                // Fallback por si acaso
                setTimeout(() => {
                    if (window.authManager) resolve(window.authManager);
                    else reject(new Error('AuthManager no inicializado tras evento'));
                }, 100);
            }
        };
        window.addEventListener('secure-auth-ready', onAuthReady);

        // Polling de respaldo por si el evento ya pasó o falló
        let retries = 0;
        const interval = setInterval(() => {
            if (window.authManager) {
                clearInterval(interval);
                window.removeEventListener('secure-auth-ready', onAuthReady);
                resolve(window.authManager);
            }
            retries++;
            if (retries > 50) { // 5 segundos máx
                clearInterval(interval);
                reject(new Error('Timeout esperando a AuthManager'));
            }
        }, 100);
    });
}

// Cargar datos
function cargarDatos() {
    console.log('🔄 Iniciando carga de datos...');
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';

    // 1. Cargar Productos
    const productosQuery = query(collection(db, 'productos'), orderBy('nombre'));
    const unsubscribeProductos = onSnapshot(productosQuery, (snapshot) => {
        productos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        actualizarDashboard();
    }, error => console.error('Error cargando productos:', error));

    // 2. Cargar Bodegas
    const bodegasQuery = query(collection(db, 'bodegas'), orderBy('nombre'));
    const unsubscribeBodegas = onSnapshot(bodegasQuery, (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        actualizarDashboard();
    }, error => console.error('Error cargando bodegas:', error));

    // 3. Cargar Stock
    const stockQuery = query(collection(db, 'stock_bodegas'));
    const unsubscribeStock = onSnapshot(stockQuery, (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        actualizarDashboard();
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }, error => console.error('Error cargando stock:', error));
    
    // Listeners de búsqueda
    const inputBusqueda = document.getElementById('buscarProductoGlobal');
    if (inputBusqueda) {
        inputBusqueda.addEventListener('input', buscarProductoGlobal);
    }
}

// Actualizar métricas del dashboard
function actualizarDashboard() {
    if (!productos.length || !stockBodegas.length) return;

    let valorTotalGlobal = 0;
    let productosStockBajo = 0;
    
    // Calcular valor total del inventario
    for (const stock of stockBodegas) {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto) {
            const valor = (Number(stock.stockActual) || 0) * (Number(producto.precioUnitario) || 0);
            valorTotalGlobal += valor;
            
            if ((Number(stock.stockActual) || 0) <= (Number(producto.stockMinimo) || 0)) {
                productosStockBajo++;
            }
        }
    }
    
    // Actualizar DOM
    const valorTotalEl = document.getElementById('valorTotalGlobal');
    if (valorTotalEl) valorTotalEl.textContent = formatearColones(valorTotalGlobal);
    
    const totalBodegasEl = document.getElementById('totalBodegas');
    if (totalBodegasEl) totalBodegasEl.textContent = bodegas.length;
    
    const stockBajoEl = document.getElementById('productosStockBajoGlobal');
    if (stockBajoEl) stockBajoEl.textContent = productosStockBajo;
    
    const totalProductosEl = document.getElementById('totalProductosGlobal');
    if (totalProductosEl) totalProductosEl.textContent = productos.length;
}

// Buscar producto global
function buscarProductoGlobal() {
    const termino = document.getElementById('buscarProductoGlobal').value.toLowerCase();
    const resultados = document.getElementById('resultadosBusqueda');
    const tabla = document.getElementById('tablaResultadosBusqueda');
    
    if (termino.length < 2) {
        resultados.style.display = 'none';
        return;
    }
    
    // Buscar productos que coincidan
    const productosEncontrados = [];
    
    for (const stock of stockBodegas) {
        const producto = productos.find(p => p.id === stock.productoId);
        if (producto && producto.nombre.toLowerCase().includes(termino)) {
            const bodega = bodegas.find(b => b.id === stock.bodegaId);
            if (bodega) {
                productosEncontrados.push({
                    producto,
                    bodega,
                    stock
                });
            }
        }
    }
    
    // Mostrar resultados
    tabla.innerHTML = '';
    if (productosEncontrados.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No se encontraron productos</td></tr>';
    } else {
        // Limitar a 50 resultados para rendimiento
        const resultadosLimitados = productosEncontrados.slice(0, 50);
        
        resultadosLimitados.forEach(item => {
            const valorTotal = (Number(item.stock.stockActual) || 0) * (Number(item.producto.precioUnitario) || 0);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.producto.nombre}</td>
                <td>${item.bodega.nombre}</td>
                <td>${item.stock.stockActual} ${item.producto.unidad}</td>
                <td>${formatearColones(item.producto.precioUnitario)}</td>
                <td>${formatearColones(valorTotal)}</td>
            `;
            tabla.appendChild(row);
        });
        
        if (productosEncontrados.length > 50) {
             const row = document.createElement('tr');
             row.innerHTML = `<td colspan="5" class="text-center text-muted">... y ${productosEncontrados.length - 50} más</td>`;
             tabla.appendChild(row);
        }
    }
    
    resultados.style.display = 'block';
}

// Generar reporte completo (Redirección)
window.generarReporteCompleto = function() {
    window.location.href = 'admin_inventario_reportes.html';
};

// Utilidades
function formatearColones(monto) {
    return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC'
    }).format(monto);
}

