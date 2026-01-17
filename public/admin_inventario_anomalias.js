import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let bodegas = [];
let productos = [];
let stockBodegas = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        cargarDatos();
    } catch (error) {
        console.error('Error inicializando anomalías:', error);
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

function cargarDatos() {
    // Cargar bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarAnomalias();
    });

    // Cargar productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarAnomalias();
    });
    
    // Cargar stock de bodegas
    onSnapshot(query(collection(db, 'stock_bodegas')), (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        cargarAnomalias();
    });
}

window.cargarAnomalias = function() {
    const tbody = document.getElementById('tablaAnomalias');
    const sinAnomalias = document.getElementById('sinAnomalias');
    const contador = document.getElementById('contadorAnomalias');
    
    if (!tbody) return;
    
    // Verificar que todos los datos estén cargados
    if (bodegas.length === 0 || productos.length === 0 || stockBodegas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2 text-muted">Cargando datos...</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Filtrar stocks negativos
    const anomalias = stockBodegas.filter(stock => {
        const stockActual = Number(stock.stockActual) || 0;
        return stockActual < 0 && stock.productoId; // Solo productos, no herramientas
    });
    
    if (anomalias.length === 0) {
        tbody.innerHTML = '';
        if (sinAnomalias) sinAnomalias.style.display = 'block';
        if (contador) contador.textContent = '0 anomalías encontradas';
        return;
    }
    
    if (sinAnomalias) sinAnomalias.style.display = 'none';
    if (contador) contador.textContent = `${anomalias.length} anomalía${anomalias.length !== 1 ? 's' : ''} encontrada${anomalias.length !== 1 ? 's' : ''}`;
    
    // Crear mapa de bodegas y productos para búsqueda rápida
    const bodegasMap = {};
    bodegas.forEach(b => bodegasMap[b.id] = b);
    
    const productosMap = {};
    productos.forEach(p => productosMap[p.id] = p);
    
    tbody.innerHTML = '';
    
    // Ordenar por stock más negativo primero
    anomalias.sort((a, b) => {
        const stockA = Number(a.stockActual) || 0;
        const stockB = Number(b.stockActual) || 0;
        return stockA - stockB; // Más negativo primero
    });
    
    anomalias.forEach(stock => {
        const bodega = bodegasMap[stock.bodegaId];
        const producto = productosMap[stock.productoId];
        const stockActual = Number(stock.stockActual) || 0;
        
        if (!bodega || !producto) return; // Saltar si no se encuentra la bodega o producto
        
        const tr = document.createElement('tr');
        tr.className = 'stock-negativo';
        tr.innerHTML = `
            <td>
                <i class="fas fa-warehouse me-2 text-muted"></i>
                <strong>${bodega.nombre || 'Bodega no encontrada'}</strong>
                <br><small class="text-muted">ID: ${stock.bodegaId}</small>
            </td>
            <td>
                <i class="fas fa-box me-2 text-primary"></i>
                <strong>${producto.nombre || 'Producto no encontrado'}</strong>
                <br><small class="text-muted">ID: ${stock.productoId}</small>
            </td>
            <td>
                <span class="badge bg-light text-dark">${producto.codigo || 'N/A'}</span>
            </td>
            <td class="text-center">
                <span class="text-stock-negativo fs-5">${stockActual}</span>
            </td>
            <td>
                <small class="text-muted">
                    <i class="fas fa-info-circle me-1"></i>
                    Stock negativo detectado. Revisar movimientos de inventario.
                </small>
            </td>
        `;
        tbody.appendChild(tr);
    });
};


