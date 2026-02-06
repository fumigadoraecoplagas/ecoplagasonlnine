import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    where, 
    doc,
    updateDoc,
    deleteDoc,
    Timestamp,
    onSnapshot,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { actualizarStockBodega } from './inventario-movimientos-utils.js';

// Variables globales
let movimientos = [];
let bodegas = [];
let productos = [];
let herramientas = [];
let cuentasGasto = [];
let proveedores = [];
let empleados = [];
let datosCargadosBase = []; // Copia para filtros de columna

// Inicialización
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        // Inicializar fechas por defecto (Últimos 3 días: Hoy, Ayer, Anteayer)
        const hoy = new Date();
        const hace3dias = new Date(hoy);
        hace3dias.setDate(hoy.getDate() - 2);
        
        document.getElementById('fechaHastaMovimiento').valueAsDate = hoy;
        document.getElementById('fechaDesdeMovimiento').valueAsDate = hace3dias;
        
        cargarDatosAuxiliares();
        
        // Cargar aplicando el filtro de fechas inicial y extender si hay transacciones futuras
        await filtrarMovimientosConExtension();
        
    } catch (error) {
        console.error('Error inicializando historial:', error);
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

// Cargar datos auxiliares (Bodegas, Productos, etc.)
function cargarDatosAuxiliares() {
    // Bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarSelectsBodegas();
    });

    // Productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Herramientas
    onSnapshot(query(collection(db, 'herramientas'), orderBy('nombre')), (snapshot) => {
        herramientas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Cuentas Gasto
    onSnapshot(query(collection(db, 'cuentas_gasto'), orderBy('nombre')), (snapshot) => {
        cuentasGasto = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    
    // Proveedores
    onSnapshot(query(collection(db, 'proveedores'), orderBy('nombre')), (snapshot) => {
        proveedores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Empleados (para resolver nombres de usuarios)
    onSnapshot(query(collection(db, 'empleados')), (snapshot) => {
        empleados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

function actualizarSelectsBodegas() {
    const filtroBodega = document.getElementById('filtroBodegaMovimiento');
    if (filtroBodega) {
        filtroBodega.innerHTML = '<option value="">Todas las bodegas</option>';
        bodegas.forEach(b => {
            const option = document.createElement('option');
            option.value = b.id;
            option.textContent = b.nombre;
            filtroBodega.appendChild(option);
        });
    }
}

function cumpleFiltroInteligente(valorCelda, filtroInput) {
    if (!filtroInput) return true;
    if (!valorCelda) return false;
    
    const texto = valorCelda.toLowerCase();
    const terminos = filtroInput.toLowerCase().split(' ').filter(t => t.length > 0);
    
    return terminos.every(termino => texto.includes(termino));
}

window.filtrarTablaEnCliente = function() {
    let filtrados = [...datosCargadosBase];
    
    // 1. Filtro Global de Bodega (el select principal)
    const bodegaGlobal = document.getElementById('filtroBodegaMovimiento').value;
    if (bodegaGlobal) {
        filtrados = filtrados.filter(m => m.origen === bodegaGlobal || m.destino === bodegaGlobal);
    }

    // 2. Filtros de Columna
    const fTipo = document.getElementById('colFilterTipo')?.value.toLowerCase();
    const fProd = document.getElementById('colFilterProducto')?.value.toLowerCase();
    const fOrigen = document.getElementById('colFilterOrigen')?.value.toLowerCase();
    const fDestino = document.getElementById('colFilterDestino')?.value.toLowerCase();
    const fUsuario = document.getElementById('colFilterUsuario')?.value.toLowerCase();

    if (fTipo || fProd || fOrigen || fDestino || fUsuario) {
        filtrados = filtrados.filter(m => {
            // Tipo
            if (fTipo && m.tipo.toLowerCase() !== fTipo) return false;
            
            // Producto/Herramienta (Nombre)
            if (fProd) {
                let itemNombre = '';
                if (m.productoId) {
                    itemNombre = productos.find(p => p.id === m.productoId)?.nombre || m.productoNombre || '';
                } else if (m.herramientaId || m.tipoItem === 'herramienta') {
                    itemNombre = herramientas.find(h => h.id === m.herramientaId)?.nombre || m.herramientaNombre || '';
                }
                if (!cumpleFiltroInteligente(itemNombre, fProd)) return false;
            }

            // Origen (Nombre resuelto visible)
            if (fOrigen) {
                const detalle = obtenerDetalleLugar(m.origen, m.tipo, 'origen');
                // Usamos el HTML generado pero limpiamos las etiquetas para buscar sobre el texto que ve el usuario
                const textoVisible = detalle.html.replace(/<[^>]*>/g, ' ');
                if (!cumpleFiltroInteligente(textoVisible, fOrigen)) return false;
            }

            // Destino (Nombre resuelto visible)
            if (fDestino) {
                const detalle = obtenerDetalleLugar(m.destino, m.tipo, 'destino');
                const textoVisible = detalle.html.replace(/<[^>]*>/g, ' ');
                if (!cumpleFiltroInteligente(textoVisible, fDestino)) return false;
            }

            // Usuario (Nombre resuelto visible)
            if (fUsuario) {
                const nombreUsuario = obtenerNombreUsuario(m).replace(/<[^>]*>/g, ' '); 
                if (!cumpleFiltroInteligente(nombreUsuario, fUsuario)) return false;
            }

            return true;
        });
    }

    // 3. Ordenar (siempre descendente por fecha registro/edición)
    filtrados.sort((a, b) => {
        const fechaA = a.lastModified ? (a.lastModified.toDate ? a.lastModified.toDate() : new Date(a.lastModified)) 
                                      : (a.fechaRegistro ? (a.fechaRegistro.toDate ? a.fechaRegistro.toDate() : new Date(a.fechaRegistro)) : new Date(0));
        
        const fechaB = b.lastModified ? (b.lastModified.toDate ? b.lastModified.toDate() : new Date(b.lastModified)) 
                                      : (b.fechaRegistro ? (b.fechaRegistro.toDate ? b.fechaRegistro.toDate() : new Date(b.fechaRegistro)) : new Date(0));
                                      
        return fechaB - fechaA; 
    });


    renderizarTabla(filtrados);
    actualizarResumen(filtrados);
};

window.limpiarFiltrosColumnas = function() {
    if(document.getElementById('colFilterTipo')) document.getElementById('colFilterTipo').value = '';
    if(document.getElementById('colFilterProducto')) document.getElementById('colFilterProducto').value = '';
    if(document.getElementById('colFilterOrigen')) document.getElementById('colFilterOrigen').value = '';
    if(document.getElementById('colFilterDestino')) document.getElementById('colFilterDestino').value = '';
    if(document.getElementById('colFilterUsuario')) document.getElementById('colFilterUsuario').value = '';
    
    filtrarTablaEnCliente();
};

// Cargar movimientos
window.cargarMovimientos = async function() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    
    const tbody = document.getElementById('tablaMovimientos');
    tbody.innerHTML = '';

    try {
        // Cargar un lote inicial grande ordenado por FECHA DE REGISTRO (Sistema)
        // para ver lo último que se creó o modificó
        const q = query(
            collection(db, 'movimientos_inventario'),
            orderBy('fechaRegistro', 'desc'),
            limit(2000)
        );
        
        const snapshot = await getDocs(q);
        movimientos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        datosCargadosBase = [...movimientos];
        filtrarTablaEnCliente(); // Render inicial
        
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error cargando datos: ${error.message}</td></tr>`;
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
};

// Filtrar movimientos con extensión automática si hay transacciones futuras
async function filtrarMovimientosConExtension() {
    const hoy = new Date();
    const hace3dias = new Date(hoy);
    hace3dias.setDate(hoy.getDate() - 2);
    
    // Establecer fechas iniciales (últimos 3 días)
    const fechaDesdeInput = document.getElementById('fechaDesdeMovimiento');
    const fechaHastaInput = document.getElementById('fechaHastaMovimiento');
    
    fechaDesdeInput.valueAsDate = hace3dias;
    fechaHastaInput.valueAsDate = hoy;
    
    // Cargar movimientos desde hace 3 días hasta hoy
    await filtrarMovimientos();
    
    // Verificar si hay transacciones futuras consultando directamente
    try {
        const hoyInicio = new Date(hoy);
        hoyInicio.setHours(0, 0, 0, 0);
        const hoyFin = new Date(hoy);
        hoyFin.setHours(23, 59, 59, 999);
        
        // Buscar transacciones futuras (después de hoy)
        const qFuturas = query(
            collection(db, 'movimientos_inventario'),
            where('fecha', '>', Timestamp.fromDate(hoyFin)),
            orderBy('fecha', 'desc'),
            limit(100)
        );
        
        const snapshotFuturas = await getDocs(qFuturas);
        const futuras = snapshotFuturas.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Si hay transacciones futuras, encontrar la fecha máxima y extender el rango
        if (futuras.length > 0) {
            let fechaMaxima = hoy;
            
            futuras.forEach(mov => {
                if (mov.fecha) {
                    const fechaMov = mov.fecha.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
                    if (fechaMov > fechaMaxima) {
                        fechaMaxima = fechaMov;
                    }
                }
            });
            
            // Extender el rango hasta la última transacción futura
            fechaHastaInput.valueAsDate = fechaMaxima;
            await filtrarMovimientos();
        }
    } catch (error) {
        // Si falla la consulta de futuras (puede ser por falta de índice), continuar con los últimos 3 días
        console.log('No se pudieron cargar transacciones futuras:', error);
    }
}

// Filtrar movimientos (Ahora con búsqueda en servidor para fechas)
window.filtrarMovimientos = async function() {
    const btnFiltrar = document.querySelector('button[onclick="filtrarMovimientos()"]');
    const originalText = btnFiltrar ? btnFiltrar.innerHTML : 'Filtrar';
    
    if (btnFiltrar) {
        btnFiltrar.disabled = true;
        btnFiltrar.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Buscando...';
    }

    try {
        const bodegaId = document.getElementById('filtroBodegaMovimiento').value;
        const fechaDesde = document.getElementById('fechaDesdeMovimiento').value;
        const fechaHasta = document.getElementById('fechaHastaMovimiento').value;
        
        let resultados = [];

        // Si hay fechas seleccionadas, consultar al servidor para asegurar integridad histórica
        if (fechaDesde || fechaHasta) {
             let q = query(collection(db, 'movimientos_inventario'));
             
             // Manejo de fechas para query
             let start = null;
             let end = null;

             if (fechaDesde) {
                 const partesDesde = fechaDesde.split('-');
                 start = new Date(partesDesde[0], partesDesde[1] - 1, partesDesde[2], 0, 0, 0, 0);
                 q = query(q, where('fecha', '>=', Timestamp.fromDate(start)));
             }
             
             if (fechaHasta) {
                 const partesHasta = fechaHasta.split('-');
                 end = new Date(partesHasta[0], partesHasta[1] - 1, partesHasta[2], 23, 59, 59, 999);
                 q = query(q, where('fecha', '<=', Timestamp.fromDate(end)));
             }
             
             // Ordenar por fecha contable por defecto en la búsqueda por rango
             q = query(q, orderBy('fecha', 'desc'));
             
             // Limitar por seguridad (aunque el rango de fechas ya limita)
             q = query(q, limit(2000));

             const snapshot = await getDocs(q);
             resultados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        } else {
             // Si no hay fechas, usar la lista precargada (últimos registrados)
             resultados = [...movimientos];
        }
        
        datosCargadosBase = [...resultados];
        filtrarTablaEnCliente();

    } catch (error) {
        console.error("Error filtrando:", error);
        alert("Error al filtrar: " + error.message);
    } finally {
        if (btnFiltrar) {
            btnFiltrar.disabled = false;
            btnFiltrar.innerHTML = originalText;
        }
    }
};

window.actualizarResumen = function(listaMovimientos) {
    const tbody = document.querySelector('#tablaResumenProductos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (listaMovimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin datos para resumen</td></tr>';
        return;
    }

    // Agrupar por producto
    const resumen = {};

    listaMovimientos.forEach(m => {
        if (!m.productoId) return;
        
        if (!resumen[m.productoId]) {
            const prod = productos.find(p => p.id === m.productoId);
            resumen[m.productoId] = {
                nombre: prod ? prod.nombre : (m.productoNombre || 'Desconocido'),
                unidad: prod ? prod.unidad : '',
                entradas: 0,
                salidas: 0
            };
        }

        const cant = parseFloat(m.cantidad || 0);
        const filtroBodega = document.getElementById('filtroBodegaMovimiento').value;
        
        // Lógica robusta basada en Origen/Destino (Igual a Liquidación)
        
        // Es Entrada si:
        // 1. No hay filtro de bodega (visión global) Y el tipo es Compra, Ajuste Entrada o Reversión
        // 2. Hay filtro de bodega Y esa bodega es el Destino
        let esEntrada = false;
        if (filtroBodega) {
            if (m.destino === filtroBodega) esEntrada = true;
        } else {
            if (m.tipo === 'compra' || m.tipo === 'ajuste_entrada' || m.tipo === 'reversion') esEntrada = true;
            // En visión global, Transferencia no suma entrada neta al inventario global (solo mueve), 
            // a menos que queramos ver volumen de movimiento.
            // Por consistencia contable "Saldo Neto Global", transferencias se anulan.
        }

        // Es Salida si:
        // 1. No hay filtro de bodega (visión global) Y el tipo es Gasto o Ajuste Salida
        // 2. Hay filtro de bodega Y esa bodega es el Origen
        let esSalida = false;
        if (filtroBodega) {
            if (m.origen === filtroBodega) esSalida = true;
        } else {
            if (m.tipo === 'gasto' || m.tipo === 'ajuste_salida') esSalida = true;
        }

        if (esEntrada) resumen[m.productoId].entradas += cant;
        if (esSalida) resumen[m.productoId].salidas += cant;
    });

    // Convertir a array y ordenar
    const listaResumen = Object.values(resumen).sort((a, b) => a.nombre.localeCompare(b.nombre));

    listaResumen.forEach(item => {
        const saldo = item.entradas - item.salidas;
        const saldoClass = saldo > 0 ? 'text-success' : (saldo < 0 ? 'text-danger' : 'text-muted');
        
        // Solo mostrar filas con movimiento
        if (item.entradas === 0 && item.salidas === 0) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="fw-bold">${item.nombre}</div>
                <div class="small text-muted">${item.unidad}</div>
            </td>
            <td class="text-center text-success">+${item.entradas.toFixed(2)}</td>
            <td class="text-center text-danger">-${item.salidas.toFixed(2)}</td>
            <td class="text-center fw-bold ${saldoClass}">${saldo > 0 ? '+' : ''}${saldo.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
};

window.limpiarFiltrosMovimientos = function() {
    const hoy = new Date();
    const hace3dias = new Date(hoy);
    hace3dias.setDate(hoy.getDate() - 2);
    
    document.getElementById('filtroBodegaMovimiento').value = '';
    document.getElementById('fechaHastaMovimiento').valueAsDate = hoy;
    document.getElementById('fechaDesdeMovimiento').valueAsDate = hace3dias;
    
    limpiarFiltrosColumnas(); // Esto limpia columnas y relanza el filtrado
    filtrarMovimientos(); // Esto relanza la query de fecha
};

function formatearFechaHoraCompacta(fecha) {
    if (!fecha) return 'N/A';
    const f = fecha.toDate ? fecha.toDate() : new Date(fecha);
    
    // Formato: 02 Nov 2025
    // Nota: 'short' para mes puede dar 'nov.', quitamos punto si queremos
    const fechaStr = f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
    
    // Formato: 11:00 PM
    const horaStr = f.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return `<div style="line-height:1.1; font-size: 0.85rem;">
        <div class="fw-bold text-nowrap">${fechaStr}</div>
        <div class="text-muted small text-nowrap">${horaStr}</div>
    </div>`;
}

function renderizarTabla(listaMovimientos) {
    const tbody = document.getElementById('tablaMovimientos');
    tbody.innerHTML = '';
    
    if (listaMovimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay movimientos que coincidan con los filtros</td></tr>';
        return;
    }
    
    // Limitar renderizado
    const MAX_ROWS = 500;
    const mostrar = listaMovimientos.slice(0, MAX_ROWS);
    
    // Permisos de admin para mostrar botones de edición/eliminación
    const isAdmin = verificarPermisosAdmin();
    
    mostrar.forEach(mov => {
        // Fecha Contable (la que el usuario eligió o la efectiva del movimiento)
        const fechaContable = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
        
        // Fecha de Registro (auditoría del sistema, si existe)
        let tooltipFecha = `Fecha Contable: ${formatearFechaHora(fechaContable)}`;
        if (mov.fechaRegistro) {
            const fechaReg = mov.fechaRegistro?.toDate ? mov.fechaRegistro.toDate() : new Date(mov.fechaRegistro);
            tooltipFecha += `\nRegistrado en Sistema: ${formatearFechaHora(fechaReg)}`;
        }

        // Determinar si es producto o herramienta
        let itemNombre = 'Desconocido';
        let itemIcono = '';
        let esHerramienta = false;
        
        if (mov.productoId) {
            const producto = productos.find(p => p.id === mov.productoId);
            itemNombre = producto ? producto.nombre : (mov.productoNombre || 'Desconocido');
        } else if (mov.herramientaId || mov.tipoItem === 'herramienta') {
            esHerramienta = true;
            const herramienta = herramientas.find(h => h.id === mov.herramientaId);
            itemNombre = herramienta ? herramienta.nombre : (mov.herramientaNombre || 'Herramienta Desconocida');
            itemIcono = '<i class="fas fa-tools text-warning me-1" title="Herramienta"></i>';
        }
        
        const origen = obtenerDetalleLugar(mov.origen, mov.tipo, 'origen');
        const destino = obtenerDetalleLugar(mov.destino, mov.tipo, 'destino');
        
        let badgeContent = '';
        let badgeClass = 'bg-secondary';
        
        switch(mov.tipo) {
            case 'compra': 
                badgeClass = 'bg-success'; 
                badgeContent = '<i class="fas fa-cart-plus"></i>'; 
                break;
            case 'gasto': 
                badgeClass = 'bg-danger'; // Rojo para gasto
                badgeContent = '<i class="fas fa-money-bill-wave"></i>'; // Mismo icono que en cuenta gasto
                break;
            case 'transferencia': 
                badgeClass = 'bg-primary'; 
                badgeContent = '<i class="fas fa-exchange-alt"></i>'; 
                break;
            case 'reversion': 
                badgeClass = 'bg-danger'; 
                badgeContent = '<i class="fas fa-undo"></i>'; 
                break;
            case 'ajuste_entrada':
                badgeClass = 'bg-info text-dark';
                badgeContent = '<i class="fas fa-plus-circle"></i>';
                break;
            case 'ajuste_salida':
                badgeClass = 'bg-secondary';
                badgeContent = '<i class="fas fa-minus-circle"></i>';
                break;
            default: 
                badgeContent = mov.tipo.substring(0, 3).toUpperCase();
        }
        
        let botonesAccion = '';
        
        if (isAdmin) {
            botonesAccion += `
                <button class="btn btn-outline-warning btn-sm" onclick="editarTransaccion('${mov.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="eliminarMovimiento('${mov.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            `;
        } else {
             // Si no es admin, mostrar algo o nada? 
             // Dejaremos vacío o un icono de candado gris
             botonesAccion = '<small class="text-muted"><i class="fas fa-lock"></i></small>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="align-middle py-1" title="${tooltipFecha}" style="cursor: help;">${formatearFechaHoraCompacta(fechaContable)}</td>
            <td class="align-middle py-1 text-center">
                <div class="d-flex justify-content-center">
                    <span class="badge ${badgeClass} rounded-circle p-0 d-flex align-items-center justify-content-center" 
                          title="${mov.tipo.toUpperCase()}" 
                          style="width: 28px; height: 28px; min-width: 28px; font-size: 0.85rem;">
                        ${badgeContent}
                    </span>
                </div>
            </td>
            <td class="align-middle py-1 text-truncate" style="max-width: 200px;" title="${itemNombre}">${itemIcono}${itemNombre}</td>
            <td class="align-middle py-1"><small class="d-block text-muted text-nowrap text-truncate" style="max-width: 140px;" title="${origen.nombre}">${origen.icono} ${origen.html || origen.nombre}</small></td>
            <td class="align-middle py-1"><small class="d-block text-muted text-nowrap text-truncate" style="max-width: 140px;" title="${destino.nombre}">${destino.icono} ${destino.html || destino.nombre}</small></td>
            <td class="align-middle py-1 fw-bold text-center">${mov.cantidad}</td>
            <td class="align-middle py-1"><small class="text-truncate d-block" style="max-width: 120px;" title="${obtenerNombreUsuario(mov).replace(/<[^>]*>/g, '')}">${obtenerNombreUsuario(mov)}</small></td>
            <td class="align-middle py-1">
                <div class="btn-group btn-group-sm">
                    ${botonesAccion}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    if (listaMovimientos.length > MAX_ROWS) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" class="text-center text-muted">... y ${listaMovimientos.length - MAX_ROWS} movimientos más</td>`;
        tbody.appendChild(tr);
    }
}

function obtenerNombreUsuario(mov) {
    const idOrEmail = mov.usuarioId || mov.empleado || 'N/A';
    let nombre = idOrEmail;
    let esSecure = false;
    let emp = null;

    // Estrategia 1: Buscar por UID exacto (Secure)
    if (mov.usuarioId && mov.usuarioId.length > 20) {
        esSecure = true; // Es un UID largo, asumimos secure
        emp = empleados.find(e => e.firebaseAuthUID === mov.usuarioId);
    }

    // Estrategia 2: Buscar por Username o Email (Legacy o fallback)
    if (!emp && (mov.usuarioId || mov.empleado)) {
        const searchKey = mov.usuarioId || mov.empleado;
        emp = empleados.find(e => 
            e.username === searchKey || 
            e.email === searchKey || 
            e.correo === searchKey
        );
    }

    // Estrategia 3: Buscar por email en el campo 'empleado' si es un email
    if (!emp && mov.empleado && mov.empleado.includes('@')) {
        emp = empleados.find(e => e.email === mov.empleado || e.correo === mov.empleado);
    }

    // Resolución de Nombre
    if (emp) {
        nombre = `${emp.primerNombre} ${emp.primerApellido}`;
        if (emp.firebaseAuthUID) esSecure = true;
    } else {
        // Si no encontramos empleado pero tenemos un string que parece nombre o email
        let rawName = mov.empleado || mov.usuarioId;
        
        if (rawName && !rawName.includes(mov.usuarioId) || !esSecure) {
             // Limpiar prefijos y dominios comunes
             nombre = rawName
                .replace('rh+', '')
                .replace('@ecoplagascr.com', '')
                .replace('@gmail.com', '');

             // Formatear pablo.paniagua -> Pablo Paniagua
             if (nombre.includes('.')) {
                 nombre = nombre.split('.')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
             } else {
                 // Capitalizar simple
                 nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
             }
        } else if (esSecure) {
            // Fallback solo si es UID y no encontramos nada más
            nombre = 'Usuario Secure (S/N)';
        }
    }

    if (esSecure) {
        return `<i class="fas fa-shield-alt text-success me-1" title="Usuario Seguro"></i>${nombre}`;
    }
    return nombre;
}

function formatearNombreCorto(nombreCompleto) {
    if (!nombreCompleto) return 'S/N';
    
    let nombreLimpio = nombreCompleto;

    if (nombreCompleto.includes(' - ')) {
        const partes = nombreCompleto.split(' - ');
        nombreLimpio = partes[partes.length - 1].trim();
    } else {
        nombreLimpio = nombreCompleto
            .replace(/Insumos Diarios [A-Z]?/i, '')
            .replace(/Personal [A-Z]?/i, '')
            .replace(/Bodega /i, '')
            .trim();
    }
        
    nombreLimpio = nombreLimpio.replace('rh+', '').replace(/@.*/, '');

    const palabras = nombreLimpio.split(' ').filter(p => p.length > 0);
    
    if (palabras.length >= 2) {
        const n1 = palabras[0].charAt(0).toUpperCase() + palabras[0].slice(1).toLowerCase();
        const n2 = palabras[1].charAt(0).toUpperCase();
        return `${n1} ${n2}.`;
    } 
    
    return nombreLimpio.substring(0, 15);
}

function obtenerDetalleLugar(id, tipoMovimiento, rol) {
    if (!id) return { nombre: 'N/A', html: 'N/A', icono: '' };
    
    // Hardcoded Legacy
    if (id === 'BODEGA_PRINCIPAL_ID') return { nombre: 'Bodega Principal', html: 'Bodega Principal', icono: '<i class="fas fa-warehouse text-primary"></i>' };

    // 1. Buscar en bodegas (tiene campo 'tipo')
    const bodega = bodegas.find(b => b.id === id);
    if (bodega) {
        let icono = '<i class="fas fa-warehouse text-secondary"></i>'; 
        let nombreTexto = bodega.nombre;
        let htmlExtra = '';

        // Asignar Icono estrictamente por TIPO
        switch(bodega.tipo) {
            case 'especial':
                icono = '<i class="fas fa-clock text-warning" title="Bodega Especial"></i>';
                break;
            case 'rutero':
                // Rutero suele ser personal técnico
                icono = '<i class="fas fa-user text-info" title="Rutero / Personal"></i>'; 
                break;
            case 'apv':
                icono = '<i class="fas fa-truck text-success" title="APV / Vehículo"></i>';
                break;
            case 'principal':
                icono = '<i class="fas fa-building text-primary" title="Bodega Principal"></i>';
                nombreTexto = 'Bodega Principal'; // Forzar nombre estándar
                break;
            case 'herramientas':
                // Bodega de herramientas debe mostrar icono de warehouse, no de herramienta
                icono = '<i class="fas fa-warehouse text-secondary" title="Bodega de Herramientas"></i>';
                break;
            default:
                icono = '<i class="fas fa-warehouse text-secondary"></i>';
        }
        
        // Acortar nombre si es personal (rutero) o especial
        // APV mantiene nombre completo
        // Principal ya fue asignado arriba
        if (bodega.tipo === 'rutero' || bodega.tipo === 'especial') {
            nombreTexto = formatearNombreCorto(bodega.nombre);
            
            // Añadir etiqueta explicativa pequeña
            if (bodega.tipo === 'rutero') {
                htmlExtra = ' <span class="text-muted fst-italic" style="font-size: 0.7em;">(Personal)</span>';
            } else if (bodega.tipo === 'especial') {
                htmlExtra = ' <span class="text-muted fst-italic" style="font-size: 0.7em;">(Especial)</span>';
            }
        }

        return { nombre: nombreTexto, html: nombreTexto + htmlExtra, icono };
    }

    // Limpiar prefijos como "gasto:", "proveedor:" o "transferencia:" del ID
    let idLimpio = id;
    if (id.startsWith('gasto:')) {
        idLimpio = id.replace(/^gasto:/, '');
    } else if (id.startsWith('proveedor:')) {
        idLimpio = id.replace(/^proveedor:/, '');
    } else if (id.startsWith('transferencia:')) {
        idLimpio = id.replace(/^transferencia:/, '');
        // Después de limpiar el prefijo, buscar la bodega con el ID limpio
        const bodegaLimpia = bodegas.find(b => b.id === idLimpio);
        if (bodegaLimpia) {
            let icono = '<i class="fas fa-warehouse text-secondary"></i>';
            let nombreTexto = bodegaLimpia.nombre;
            let htmlExtra = '';
            
            switch(bodegaLimpia.tipo) {
                case 'especial':
                    icono = '<i class="fas fa-clock text-warning" title="Bodega Especial"></i>';
                    nombreTexto = formatearNombreCorto(bodegaLimpia.nombre);
                    htmlExtra = ' <span class="text-muted fst-italic" style="font-size: 0.7em;">(Especial)</span>';
                    break;
                case 'rutero':
                    icono = '<i class="fas fa-user text-info" title="Rutero / Personal"></i>';
                    nombreTexto = formatearNombreCorto(bodegaLimpia.nombre);
                    htmlExtra = ' <span class="text-muted fst-italic" style="font-size: 0.7em;">(Personal)</span>';
                    break;
                case 'apv':
                    icono = '<i class="fas fa-truck text-success" title="APV / Vehículo"></i>';
                    break;
                case 'principal':
                    icono = '<i class="fas fa-building text-primary" title="Bodega Principal"></i>';
                    nombreTexto = 'Bodega Principal';
                    break;
                case 'herramientas':
                    icono = '<i class="fas fa-tools text-secondary" title="Bodega de Herramientas"></i>';
                    break;
            }
            
            return { nombre: nombreTexto, html: nombreTexto + htmlExtra, icono };
        }
    }
    
    // 2. Proveedor (Si es Compra Origen)
    if (tipoMovimiento === 'compra' && rol === 'origen') {
        const prov = proveedores.find(p => p.id === idLimpio || p.id === id);
        if (prov) return { nombre: prov.nombre, html: prov.nombre, icono: '<i class="fas fa-industry text-dark"></i>' };
    }
    
    // 3. Cuenta Gasto (Si es Gasto Destino)
    
    if (tipoMovimiento === 'gasto' && rol === 'destino') {
        const cta = cuentasGasto.find(c => c.id === idLimpio || c.id === id);
        if (cta) return { nombre: cta.nombre, html: cta.nombre, icono: '<i class="fas fa-money-bill-wave text-danger"></i>' };
    }
    
    // 4. Reversiones (Casos especiales)
    if (tipoMovimiento === 'reversion') {
         const prov = proveedores.find(p => p.id === idLimpio || p.id === id);
         if (prov) return { nombre: prov.nombre, html: prov.nombre, icono: '<i class="fas fa-industry text-dark"></i>' };
         
         const cta = cuentasGasto.find(c => c.id === idLimpio || c.id === id);
         if (cta) return { nombre: cta.nombre, html: cta.nombre, icono: '<i class="fas fa-money-bill-wave text-danger"></i>' };
    }
    
    // Fallback
    const val = id || 'N/A';
    return { nombre: val, html: val, icono: '<i class="fas fa-question-circle text-muted small"></i>' };
}

function verificarPermisosAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    const ADMIN_USERS = ['mario.paniagua', 'pablo.paniagua', 'mayren.rodriguez'];
    let username = user.email ? user.email.split('@')[0] : '';
    if (window.authManager && window.authManager.currentUser) {
        username = window.authManager.currentUser.username || username;
    }
    return ADMIN_USERS.includes(username);
}

// Editar Transacción
window.editarTransaccion = function(id) {
    console.log('Intentando editar transacción:', id);
    const mov = movimientos.find(m => m.id === id) || datosCargadosBase.find(m => m.id === id);
    
    if (!mov) {
        console.error('Transacción no encontrada en memoria:', id);
        alert('Error: No se pudo cargar la información de la transacción.');
        return;
    }
    
    document.getElementById('editTransaccionId').value = mov.id;
    
    // Fecha (convertir a formato datetime-local)
    const fecha = mov.fecha?.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
    const offset = fecha.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(fecha - offset)).toISOString().slice(0, 16);
    document.getElementById('editTransaccionFecha').value = localISOTime;
    
    document.getElementById('editTransaccionTipo').value = mov.tipo;
    document.getElementById('editTransaccionCantidad').value = mov.cantidad;
    document.getElementById('editTransaccionPrecio').value = mov.precioUnitario || mov.precio || 0;
    document.getElementById('editTransaccionTotal').value = mov.total || 0;
    document.getElementById('editTransaccionEmpleado').value = mov.empleado || '';
    document.getElementById('editTransaccionUsuario').value = mov.usuarioId || '';
    document.getElementById('editTransaccionMotivo').value = mov.motivo || '';
    document.getElementById('editTransaccionObservaciones').value = mov.observaciones || '';
    
    // Llenar selects dinámicos
    llenarSelectProductos(mov.productoId);
    actualizarOrigenesDestinos(mov.tipo, mov.origen, mov.destino);
    
    // Manejo de reversiones
    const divReversion = document.getElementById('camposReversion');
    if (mov.tipo === 'reversion') {
        divReversion.style.display = 'block';
        document.getElementById('editTransaccionTipoOriginalRev').value = mov.tipoOriginal || '';
        document.getElementById('editTransaccionIdOriginalRev').value = mov.movimientoOriginalId || '';
    } else {
        divReversion.style.display = 'none';
    }
    
    // Listeners para actualizar selects al cambiar tipo
    document.getElementById('editTransaccionTipo').onchange = function() {
        actualizarOrigenesDestinos(this.value);
    };
    
    // Calcular total al cambiar cantidad/precio
    const calcTotal = () => {
        const c = parseFloat(document.getElementById('editTransaccionCantidad').value) || 0;
        const p = parseFloat(document.getElementById('editTransaccionPrecio').value) || 0;
        document.getElementById('editTransaccionTotal').value = (c * p).toFixed(2);
    };
    document.getElementById('editTransaccionCantidad').oninput = calcTotal;
    document.getElementById('editTransaccionPrecio').oninput = calcTotal;

    try {
        const modalEl = document.getElementById('modalEditarTransaccion');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } catch (e) {
        console.error('Error abriendo modal:', e);
        alert('Error al abrir el editor: ' + e.message);
    }
};

function llenarSelectProductos(selectedId) {
    const select = document.getElementById('editTransaccionProducto');
    select.innerHTML = '<option value="">Seleccionar producto...</option>';
    productos.sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.nombre;
        if (p.id === selectedId) option.selected = true;
        select.appendChild(option);
    });
}

function actualizarOrigenesDestinos(tipo, selectedOrigen, selectedDestino) {
    const selOrigen = document.getElementById('editTransaccionOrigen');
    const selDestino = document.getElementById('editTransaccionDestino');
    
    selOrigen.innerHTML = '<option value="">Seleccionar origen...</option>';
    selDestino.innerHTML = '<option value="">Seleccionar destino...</option>';
    
    // Helpers para llenar
    const addBodegas = (sel, selected) => {
        bodegas.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.nombre;
            if (b.id === selected) opt.selected = true;
            sel.appendChild(opt);
        });
    };
    
    const addProveedores = (sel, selected) => {
        proveedores.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            if (p.id === selected) opt.selected = true;
            sel.appendChild(opt);
        });
    };
    
    const addCuentasGasto = (sel, selected) => {
        cuentasGasto.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            if (c.id === selected) opt.selected = true;
            sel.appendChild(opt);
        });
    };
    
    if (tipo === 'compra') {
        addProveedores(selOrigen, selectedOrigen);
        addBodegas(selDestino, selectedDestino);
    } else if (tipo === 'transferencia') {
        addBodegas(selOrigen, selectedOrigen);
        addBodegas(selDestino, selectedDestino);
    } else if (tipo === 'gasto') {
        addBodegas(selOrigen, selectedOrigen);
        addCuentasGasto(selDestino, selectedDestino);
    } else if (tipo === 'reversion') {
        // Reversión: Origen puede ser Gasto o Compra (Proveedor/Cuenta) -> Destino Bodega
        // Simplificación: Mostrar todo en origen
        const optGroupProv = document.createElement('optgroup'); optGroupProv.label = "Proveedores";
        proveedores.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nombre; if(p.id===selectedOrigen) o.selected=true; optGroupProv.appendChild(o); });
        selOrigen.appendChild(optGroupProv);
        
        const optGroupCta = document.createElement('optgroup'); optGroupCta.label = "Cuentas Gasto";
        cuentasGasto.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nombre; if(c.id===selectedOrigen) o.selected=true; optGroupCta.appendChild(o); });
        selOrigen.appendChild(optGroupCta);
        
        addBodegas(selDestino, selectedDestino);
    }
}

window.guardarCambiosTransaccion = async function() {
    try {
        const id = document.getElementById('editTransaccionId').value;
        if (!id) return;
        
        const fechaLocal = document.getElementById('editTransaccionFecha').value;
        const fechaObj = new Date(fechaLocal);
        
        const updateData = {
            fecha: Timestamp.fromDate(fechaObj),
            tipo: document.getElementById('editTransaccionTipo').value,
            productoId: document.getElementById('editTransaccionProducto').value,
            origen: document.getElementById('editTransaccionOrigen').value,
            destino: document.getElementById('editTransaccionDestino').value,
            cantidad: parseFloat(document.getElementById('editTransaccionCantidad').value),
            precioUnitario: parseFloat(document.getElementById('editTransaccionPrecio').value),
            total: parseFloat(document.getElementById('editTransaccionTotal').value),
            motivo: document.getElementById('editTransaccionMotivo').value,
            observaciones: document.getElementById('editTransaccionObservaciones').value,
            lastModified: Timestamp.now()
        };
        
        // Agregar reversión fields
        if (updateData.tipo === 'reversion') {
             updateData.tipoOriginal = document.getElementById('editTransaccionTipoOriginalRev').value;
             updateData.movimientoOriginalId = document.getElementById('editTransaccionIdOriginalRev').value;
        }
        
        await updateDoc(doc(db, 'movimientos_inventario', id), updateData);
        
        mostrarMensaje('Transacción actualizada. Recuerda recalcular saldos si es necesario.', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarTransaccion'));
        modal.hide();
        
        cargarMovimientos(); // Recargar tabla
        
    } catch (error) {
        console.error('Error guardando:', error);
        mostrarMensaje('Error al guardar cambios: ' + error.message, 'danger');
    }
};

window.eliminarMovimiento = async function(id) {
    if (!confirm('¿Eliminar transacción permanentemente? Esto revertirá los saldos de stock.')) return;
    
    try {
        // Obtener la transacción antes de eliminarla
        const movDoc = await getDoc(doc(db, 'movimientos_inventario', id));
        if (!movDoc.exists()) {
            mostrarMensaje('Transacción no encontrada', 'danger');
            return;
        }
        
        const transaccion = { id: movDoc.id, ...movDoc.data() };
        
        console.log('🔄 Revirtiendo saldos para transacción:', transaccion.tipo, transaccion.id);
        
        // Determinar si es producto o herramienta
        const esHerramienta = !!(transaccion.herramientaId || transaccion.tipoItem === 'herramienta');
        const tipoItem = esHerramienta ? 'herramienta' : 'producto';
        const itemId = esHerramienta ? transaccion.herramientaId : transaccion.productoId;
        
        if (!itemId) {
            console.warn('⚠️ Transacción sin productoId ni herramientaId, eliminando sin revertir stock');
            await deleteDoc(doc(db, 'movimientos_inventario', id));
            mostrarMensaje('Transacción eliminada (sin stock asociado)', 'success');
            cargarMovimientos();
            return;
        }
        
        // Revertir saldos según el tipo de transacción
        switch(transaccion.tipo) {
            case 'compra':
                // Compra: Proveedor → Bodega Destino
                // Eliminar: Restar del destino (bodega)
                if (transaccion.destino) {
                    try {
                        await actualizarStockBodega(db, transaccion.destino, itemId, transaccion.cantidad, tipoItem, false);
                        console.log(`✅ Stock revertido en bodega destino (compra): ${transaccion.destino}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en destino (puede no existir): ${error.message}`);
                    }
                }
                break;
                
            case 'gasto':
                // Gasto: Bodega Origen → Cuenta Gasto
                // Eliminar: Sumar de vuelta a la bodega origen
                if (transaccion.origen) {
                    try {
                        await actualizarStockBodega(db, transaccion.origen, itemId, transaccion.cantidad, tipoItem, true);
                        console.log(`✅ Stock revertido en bodega origen (gasto): ${transaccion.origen}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en origen: ${error.message}`);
                    }
                }
                break;
                
            case 'transferencia':
                // Transferencia: Bodega Origen → Bodega Destino
                // Eliminar: Restar del destino, sumar al origen
                if (transaccion.destino) {
                    try {
                        await actualizarStockBodega(db, transaccion.destino, itemId, transaccion.cantidad, tipoItem, false);
                        console.log(`✅ Stock revertido en bodega destino (transferencia): ${transaccion.destino}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en destino: ${error.message}`);
                    }
                }
                if (transaccion.origen) {
                    try {
                        await actualizarStockBodega(db, transaccion.origen, itemId, transaccion.cantidad, tipoItem, true);
                        console.log(`✅ Stock revertido en bodega origen (transferencia): ${transaccion.origen}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en origen: ${error.message}`);
                    }
                }
                break;
                
            case 'reversion':
                // Reversión: Movimiento Original → Bodega Destino
                // Eliminar: Restar del destino (bodega)
                if (transaccion.destino) {
                    try {
                        await actualizarStockBodega(db, transaccion.destino, itemId, transaccion.cantidad, tipoItem, false);
                        console.log(`✅ Stock revertido en bodega destino (reversión): ${transaccion.destino}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en destino: ${error.message}`);
                    }
                }
                break;
                
            case 'ajuste_entrada':
                // Ajuste Entrada: Aumenta stock en destino
                // Eliminar: Restar del destino
                if (transaccion.destino) {
                    try {
                        await actualizarStockBodega(db, transaccion.destino, itemId, transaccion.cantidad, tipoItem, false);
                        console.log(`✅ Stock revertido en bodega destino (ajuste entrada): ${transaccion.destino}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en destino: ${error.message}`);
                    }
                }
                break;
                
            case 'ajuste_salida':
                // Ajuste Salida: Reduce stock en origen
                // Eliminar: Sumar al origen
                if (transaccion.origen) {
                    try {
                        await actualizarStockBodega(db, transaccion.origen, itemId, transaccion.cantidad, tipoItem, true);
                        console.log(`✅ Stock revertido en bodega origen (ajuste salida): ${transaccion.origen}`);
                    } catch (error) {
                        console.warn(`⚠️ No se pudo revertir stock en origen: ${error.message}`);
                    }
                }
                break;
                
            default:
                console.warn(`⚠️ Tipo de transacción desconocido para revertir: ${transaccion.tipo}`);
        }
        
        // Eliminar la transacción después de revertir saldos
        await deleteDoc(doc(db, 'movimientos_inventario', id));
        console.log('✅ Transacción eliminada:', id);
        
        mostrarMensaje('Transacción eliminada y saldos revertidos', 'success');
        cargarMovimientos();
        
    } catch (error) {
        console.error('❌ Error eliminando transacción:', error);
        mostrarMensaje('Error al eliminar: ' + error.message, 'danger');
    }
};

window.verDetalleMovimiento = function(id) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;
    // Aquí podrías implementar un modal de detalle de solo lectura
    editarTransaccion(id); // Por ahora reusamos el de edición (que muestra todo)
};


