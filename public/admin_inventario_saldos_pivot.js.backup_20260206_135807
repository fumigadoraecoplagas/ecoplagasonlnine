import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Variables globales
let productos = [];
let herramientas = [];
let bodegas = [];
let stockBodegas = [];
let bodegasSeleccionadas = new Set();

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        cargarDatos();
        
    } catch (error) {
        console.error('Error inicializando saldos pivot:', error);
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

// Cargar datos
function cargarDatos() {
    // Productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarTablaPivot();
    });

    // Herramientas
    onSnapshot(query(collection(db, 'herramientas'), orderBy('nombre')), (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarTablaPivot();
    });

    // Bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarListaBodegas();
        actualizarTablaPivot();
    });

    // Stock por bodega
    onSnapshot(collection(db, 'stock_bodegas'), (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarTablaPivot();
    });
}

// Actualizar lista de bodegas en filtros
function actualizarListaBodegas() {
    const container = document.getElementById('listaBodegas');
    if (!container) return;
    
    container.innerHTML = '';
    
    const tipoFiltro = document.getElementById('filtroTipoBodega')?.value || '';
    let bodegasFiltradas = bodegas;
    
    if (tipoFiltro) {
        bodegasFiltradas = bodegas.filter(b => b.tipo === tipoFiltro);
    }
    
    bodegasFiltradas.forEach(bodega => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        
        const check = document.createElement('div');
        check.className = 'form-check';
        
        const input = document.createElement('input');
        input.className = 'form-check-input';
        input.type = 'checkbox';
        input.id = `bodega_${bodega.id}`;
        input.value = bodega.id;
        input.checked = bodegasSeleccionadas.has(bodega.id) || bodegasSeleccionadas.size === 0;
        input.onchange = function() {
            if (this.checked) {
                bodegasSeleccionadas.add(bodega.id);
            } else {
                bodegasSeleccionadas.delete(bodega.id);
            }
            actualizarTablaPivot();
        };
        
        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = `bodega_${bodega.id}`;
        label.style.color = '#495057';
        label.textContent = bodega.nombre;
        
        check.appendChild(input);
        check.appendChild(label);
        col.appendChild(check);
        container.appendChild(col);
    });
    
    // Inicializar todas seleccionadas si no hay ninguna
    if (bodegasSeleccionadas.size === 0 && bodegasFiltradas.length > 0) {
        bodegasFiltradas.forEach(b => bodegasSeleccionadas.add(b.id));
        bodegasFiltradas.forEach(b => {
            const checkbox = document.getElementById(`bodega_${b.id}`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    // Actualizar el checkbox "Seleccionar todas"
    const checkTodas = document.getElementById('checkTodasBodegas');
    if (checkTodas) {
        const todasSeleccionadas = bodegasFiltradas.every(b => bodegasSeleccionadas.has(b.id));
        checkTodas.checked = todasSeleccionadas && bodegasFiltradas.length > 0;
    }
}

// Toggle todas las bodegas
window.toggleTodasBodegas = function() {
    const checkTodas = document.getElementById('checkTodasBodegas');
    const tipoFiltro = document.getElementById('filtroTipoBodega')?.value || '';
    let bodegasFiltradas = bodegas;
    
    if (tipoFiltro) {
        bodegasFiltradas = bodegas.filter(b => b.tipo === tipoFiltro);
    }
    
    bodegasFiltradas.forEach(bodega => {
        const checkbox = document.getElementById(`bodega_${bodega.id}`);
        if (checkbox) {
            checkbox.checked = checkTodas.checked;
            if (checkTodas.checked) {
                bodegasSeleccionadas.add(bodega.id);
            } else {
                bodegasSeleccionadas.delete(bodega.id);
            }
        }
    });
    
    actualizarTablaPivot();
};

// Filtrar bodegas por tipo
window.filtrarBodegas = function() {
    const tipoFiltro = document.getElementById('filtroTipoBodega')?.value || '';
    
    // Si hay un filtro de tipo, actualizar las bodegas seleccionadas
    if (tipoFiltro) {
        const bodegasFiltradas = bodegas.filter(b => b.tipo === tipoFiltro);
        // Limpiar selección actual
        bodegasSeleccionadas.clear();
        // Seleccionar todas las bodegas del tipo filtrado
        bodegasFiltradas.forEach(b => bodegasSeleccionadas.add(b.id));
    } else {
        // Si no hay filtro, seleccionar todas
        bodegasSeleccionadas.clear();
        bodegas.forEach(b => bodegasSeleccionadas.add(b.id));
    }
    
    actualizarListaBodegas();
    actualizarTablaPivot();
};

// Filtrar productos
window.filtrarProductos = function() {
    actualizarTablaPivot();
};

// Actualizar tabla pivot
function actualizarTablaPivot() {
    if (bodegas.length === 0) {
        return;
    }
    
    // Filtrar bodegas seleccionadas
    const bodegasActivas = bodegas.filter(b => bodegasSeleccionadas.has(b.id));
    
    if (bodegasActivas.length === 0) {
        document.getElementById('pivotBody').innerHTML = `
            <tr>
                <td colspan="100" class="text-center py-4 text-muted">
                    <i class="fas fa-info-circle me-2"></i>Selecciona al menos una bodega
                </td>
            </tr>
        `;
        return;
    }
    
    // Determinar si son bodegas de herramientas
    const sonBodegasHerramientas = bodegasActivas.every(b => b.tipo === 'herramientas');
    
    // Seleccionar items según tipo de bodega
    let items = [];
    let tipoItem = 'producto';
    
    if (sonBodegasHerramientas) {
        items = herramientas;
        tipoItem = 'herramienta';
    } else {
        items = productos;
        tipoItem = 'producto';
    }
    
    if (items.length === 0) {
        document.getElementById('pivotBody').innerHTML = `
            <tr>
                <td colspan="${bodegasActivas.length + 2}" class="text-center py-4 text-muted">
                    <i class="fas fa-info-circle me-2"></i>Cargando ${tipoItem === 'herramienta' ? 'herramientas' : 'productos'}...
                </td>
            </tr>
        `;
        return;
    }
    
    const filtroProducto = document.getElementById('filtroProducto')?.value.toLowerCase() || '';
    
    // Filtrar items
    let itemsFiltrados = items;
    if (filtroProducto) {
        itemsFiltrados = items.filter(p => 
            (p.nombre && p.nombre.toLowerCase().includes(filtroProducto)) ||
            (p.codigo && p.codigo.toLowerCase().includes(filtroProducto))
        );
    }
    
    // Primero calcular totales para filtrar items con saldo 0 y bodegas sin stock
    const itemsConTotales = itemsFiltrados.map(item => {
        let totalItem = 0;
        const cantidadesPorBodega = [];
        
        bodegasActivas.forEach(bodega => {
            const stock = stockBodegas.find(s => {
                if (tipoItem === 'herramienta') {
                    return s.bodegaId === bodega.id && s.herramientaId === item.id;
                } else {
                    return s.bodegaId === bodega.id && s.productoId === item.id;
                }
            });
            const cantidad = stock ? (stock.stockActual || 0) : 0;
            totalItem += cantidad;
            cantidadesPorBodega.push({ bodega, cantidad });
        });
        
        return { item, totalItem, cantidadesPorBodega };
    });
    
    // Filtrar items con total 0
    const itemsConStock = itemsConTotales.filter(item => item.totalItem > 0);
    
    // Calcular total por bodega para filtrar bodegas sin stock
    const totalesPorBodega = {};
    bodegasActivas.forEach(bodega => {
        totalesPorBodega[bodega.id] = 0;
    });
    
    itemsConStock.forEach(({ cantidadesPorBodega }) => {
        cantidadesPorBodega.forEach(({ bodega, cantidad }) => {
            totalesPorBodega[bodega.id] += cantidad;
        });
    });
    
    // Filtrar bodegas con stock > 0
    const bodegasConStock = bodegasActivas.filter(b => totalesPorBodega[b.id] > 0);
    
    if (bodegasConStock.length === 0) {
        document.getElementById('pivotBody').innerHTML = `
            <tr>
                <td colspan="${bodegasActivas.length + 2}" class="text-center py-4 text-muted">
                    <i class="fas fa-info-circle me-2"></i>No hay ${tipoItem === 'herramienta' ? 'herramientas' : 'productos'} con stock en las bodegas seleccionadas
                </td>
            </tr>
        `;
        return;
    }
    
    // Construir header solo con bodegas que tienen stock
    const header = document.getElementById('pivotHeader');
    header.innerHTML = `<tr><th>${tipoItem === 'herramienta' ? 'Herramienta' : 'Producto'}</th>`;
    bodegasConStock.forEach(bodega => {
        const th = document.createElement('th');
        th.textContent = bodega.nombre;
        th.title = bodega.nombre;
        header.querySelector('tr').appendChild(th);
    });
    header.querySelector('tr').innerHTML += '<th>Total</th></tr>';
    
    // Construir body
    const tbody = document.getElementById('pivotBody');
    tbody.innerHTML = '';
    
    // Renderizar solo items con stock, filtrando solo bodegas con stock
    itemsConStock.forEach(({ item, totalItem, cantidadesPorBodega }) => {
        const tr = document.createElement('tr');
        
        // Celda de item (producto o herramienta)
        const tdItem = document.createElement('td');
        const unidad = item.unidad || (tipoItem === 'herramienta' ? 'unidad' : 'unidad');
        tdItem.innerHTML = `
            <div class="fw-bold">${escapeHTML(item.nombre || 'Sin nombre')}</div>
            <small class="text-muted">${escapeHTML(item.codigo || '')} - ${escapeHTML(unidad)}</small>
            ${tipoItem === 'herramienta' ? '<span class="badge bg-warning text-dark ms-1" style="font-size: 0.7rem;">H</span>' : ''}
        `;
        tr.appendChild(tdItem);
        
        // Filtrar solo cantidades de bodegas con stock
        const cantidadesConStock = cantidadesPorBodega.filter(({ bodega }) => 
            bodegasConStock.some(b => b.id === bodega.id)
        );
        
        // Calcular min y max para esta fila (para formato condicional)
        const cantidades = cantidadesConStock.map(item => item.cantidad);
        const minCantidad = Math.min(...cantidades);
        const maxCantidad = Math.max(...cantidades);
        const rango = maxCantidad - minCantidad;
        
        // Celdas de bodegas (solo las que tienen stock)
        cantidadesConStock.forEach(({ bodega, cantidad }) => {
            const td = document.createElement('td');
            
            // Determinar clase según cantidad absoluta
            let clase = 'normal';
            if (cantidad === 0) {
                clase = 'zero';
            } else if (cantidad <= 1) {
                clase = 'very-low';
            } else if (cantidad <= 5) {
                clase = 'low';
            }
            
            // Formato condicional basado en posición relativa en la fila
            let estiloFondo = '';
            let estiloTexto = '';
            
            // Regla especial para PORTACEBOS - MUPAL 903 /CAJA
            const esPortacebos = item.nombre && item.nombre.trim() === 'PORTACEBOS - MUPAL 903 /CAJA';
            
            if (esPortacebos) {
                // Lógica especial para PORTACEBOS
                if (cantidad === 10) {
                    // Exactamente 10: verde
                    estiloFondo = 'background-color: #28a745;'; // Verde
                    estiloTexto = 'color: #ffffff; font-weight: 700;';
                } else if (cantidad < 10) {
                    // Menos de 10: rojo
                    estiloFondo = 'background-color: #dc3545;'; // Rojo
                    estiloTexto = 'color: #ffffff; font-weight: 700;';
                } else {
                    // Más de 10: azul
                    estiloFondo = 'background-color: #007bff;'; // Azul
                    estiloTexto = 'color: #ffffff; font-weight: 700;';
                }
            } else if (rango > 0 && cantidad > 0) {
                // Calcular posición relativa (0 = min, 1 = max)
                const posicionRelativa = (cantidad - minCantidad) / rango;
                
                // Escala de colores: rojo (bajo) -> amarillo (medio) -> verde (alto)
                if (posicionRelativa === 0) {
                    // Valor mínimo (pero no cero)
                    estiloFondo = 'background-color: #ffe0e0;'; // Rojo muy claro
                    estiloTexto = 'color: #c00; font-weight: 600;';
                } else if (posicionRelativa === 1) {
                    // Valor máximo
                    estiloFondo = 'background-color: #d4edda;'; // Verde claro
                    estiloTexto = 'color: #155724; font-weight: 700;';
                } else if (posicionRelativa < 0.33) {
                    // Bajo (tercio inferior)
                    const intensidad = Math.floor(255 - (posicionRelativa * 255 * 0.5));
                    estiloFondo = `background-color: rgb(255, ${intensidad}, ${intensidad});`;
                    estiloTexto = 'color: #721c24; font-weight: 600;';
                } else if (posicionRelativa < 0.67) {
                    // Medio (tercio medio)
                    estiloFondo = 'background-color: #fff3cd;'; // Amarillo claro
                    estiloTexto = 'color: #856404; font-weight: 500;';
                } else {
                    // Alto (tercio superior)
                    const intensidad = Math.floor(200 + (posicionRelativa - 0.67) * 55);
                    estiloFondo = `background-color: rgb(${255 - intensidad}, ${intensidad}, ${255 - intensidad});`;
                    estiloTexto = 'color: #155724; font-weight: 600;';
                }
            } else if (cantidad === 0) {
                // Cero siempre gris
                estiloFondo = 'background-color: #f8f9fa;';
                estiloTexto = 'color: #adb5bd;';
            }
            
            td.className = `pivot-value ${clase}`;
            td.style.cssText = estiloFondo + estiloTexto;
            td.textContent = cantidad.toFixed(2);
            const unidad = item.unidad || (tipoItem === 'herramienta' ? 'unidad' : 'unidad');
            td.title = `${item.nombre} en ${bodega.nombre}: ${cantidad.toFixed(2)} ${unidad}`;
            tr.appendChild(td);
        });
        
        // Celda de total
        const tdTotal = document.createElement('td');
        tdTotal.className = 'pivot-value fw-bold';
        tdTotal.style.background = '#e9ecef';
        tdTotal.textContent = totalItem.toFixed(2);
        tr.appendChild(tdTotal);
        
        tbody.appendChild(tr);
    });
    
    if (itemsConStock.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${bodegasConStock.length + 2}" class="text-center py-4 text-muted">
                    <i class="fas fa-info-circle me-2"></i>No hay ${tipoItem === 'herramienta' ? 'herramientas' : 'productos'} con stock en las bodegas seleccionadas
                </td>
            </tr>
        `;
    }
}

// Exportar a Excel
window.exportarExcel = function() {
    const tabla = document.querySelector('.pivot-table');
    if (!tabla) return;
    
    let csv = '';
    
    // Headers
    const headers = [];
    tabla.querySelectorAll('thead th').forEach(th => {
        headers.push(th.textContent.trim());
    });
    csv += headers.join(',') + '\n';
    
    // Rows
    tabla.querySelectorAll('tbody tr').forEach(tr => {
        const row = [];
        tr.querySelectorAll('td').forEach((td, index) => {
            if (index === 0) {
                // Producto - solo nombre
                const nombre = td.querySelector('.fw-bold')?.textContent || td.textContent;
                row.push(`"${nombre.trim()}"`);
            } else {
                row.push(td.textContent.trim());
            }
        });
        csv += row.join(',') + '\n';
    });
    
    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `saldos_pivot_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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








