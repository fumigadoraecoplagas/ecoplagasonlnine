import { auth, db } from './auth-secure.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot,
    getDocs,
    where,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let bodegas = [];
let productos = [];
let stockBodegas = [];
let movimientos = []; // Se carga bajo demanda para reportes históricos

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        setupUI();
        cargarDatosBase();
    } catch (error) {
        console.error('Error inicializando reportes:', error);
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

function setupUI() {
    // Controlar visibilidad de filtros de fecha según tab
    const tabs = document.querySelectorAll('button[data-bs-toggle="pill"]');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (event) {
            const targetId = event.target.getAttribute('data-bs-target');
            const necesitaFechas = targetId === '#pills-gastos-dia' || targetId === '#pills-saldos-diarios';
            const necesitaMeses = targetId === '#pills-gastos-mes';
            
            const container = document.getElementById('filtroFechasContainer');
            if (necesitaFechas) {
                container.style.display = 'flex';
                cargarFechasDisponibles('dia');
            } else if (necesitaMeses) {
                container.style.display = 'flex';
                cargarFechasDisponibles('mes');
            } else {
                container.style.display = 'none';
            }
            
            // Ocultar resultados anteriores
            document.getElementById('areaResultadosReporte').style.display = 'none';
            document.getElementById('placeholderReporte').style.display = 'block';
        });
    });
}

function cargarDatosBase() {
    // Bodegas
    onSnapshot(query(collection(db, 'bodegas'), orderBy('nombre')), (snapshot) => {
        bodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarCheckboxesBodegas(bodegas);
    });

    // Productos
    onSnapshot(query(collection(db, 'productos'), orderBy('nombre')), (snapshot) => {
        productos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // Stock Actual (para reporte de saldos actual)
    onSnapshot(collection(db, 'stock_bodegas'), (snapshot) => {
        stockBodegas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

function renderizarCheckboxesBodegas(listaBodegas) {
    const container = document.getElementById('listaBodegasReporte');
    container.innerHTML = '';
    
    listaBodegas.forEach(b => {
        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4';
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input check-bodega-reporte" type="checkbox" value="${b.id}" data-tipo="${b.tipo}" id="check-rep-${b.id}" checked>
                <label class="form-check-label small" for="check-rep-${b.id}">${b.nombre}</label>
            </div>
        `;
        container.appendChild(div);
    });
}

window.filtrarBodegasPorTipo = function() {
    const tipo = document.getElementById('filtroTipoBodegaReporte').value;
    const checkboxes = document.querySelectorAll('.check-bodega-reporte');
    
    checkboxes.forEach(cb => {
        const div = cb.closest('.col-md-6');
        if (tipo === 'todos' || cb.dataset.tipo === tipo) {
            div.style.display = 'block';
            cb.checked = true;
        } else {
            div.style.display = 'none';
            cb.checked = false;
        }
    });
};

window.toggleTodasBodegasReporte = function() {
    const checked = document.getElementById('checkTodasBodegasReporte').checked;
    const visibles = Array.from(document.querySelectorAll('.check-bodega-reporte')).filter(cb => cb.closest('.col-md-6').style.display !== 'none');
    visibles.forEach(cb => cb.checked = checked);
};

async function cargarFechasDisponibles(modo) {
    const select = document.getElementById('filtroFechasReporte');
    select.innerHTML = '<option disabled>Analizando historial...</option>';
    
    try {
        // Obtener rango real de fechas consultando primer y último registro
        const qMax = query(collection(db, 'movimientos_inventario'), orderBy('fecha', 'desc'), limit(1));
        const qMin = query(collection(db, 'movimientos_inventario'), orderBy('fecha', 'asc'), limit(1));
        
        const [snapMax, snapMin] = await Promise.all([getDocs(qMax), getDocs(qMin)]);
        
        let fechaFin = new Date();
        let fechaInicio = new Date();
        fechaInicio.setDate(fechaInicio.getDate() - 60); // Fallback por defecto

        if (!snapMax.empty && !snapMin.empty) {
            const fMax = snapMax.docs[0].data().fecha;
            const fMin = snapMin.docs[0].data().fecha;
            if (fMax && fMin) {
                fechaFin = fMax.toDate();
                fechaInicio = fMin.toDate();
            }
        }

        const fechas = [];
        const current = new Date(fechaFin);
        
        if (modo === 'dia') {
            while (current >= fechaInicio) {
                fechas.push({
                    valor: current.toISOString().split('T')[0],
                    texto: current.toLocaleDateString('es-CR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                });
                current.setDate(current.getDate() - 1);
            }
        } else {
            // Mensual
            current.setDate(1); 
            const minDateMonth = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
            
            while (current >= minDateMonth) {
                const valor = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
                fechas.push({
                    valor: valor,
                    texto: current.toLocaleDateString('es-CR', { year: 'numeric', month: 'long' })
                });
                current.setMonth(current.getMonth() - 1);
            }
        }
        
        select.innerHTML = '';
        if (fechas.length === 0) {
             select.innerHTML = '<option disabled>No hay datos disponibles</option>';
        } else {
            fechas.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.valor;
                opt.textContent = f.texto;
                select.appendChild(opt);
            });
        }

    } catch (e) {
        console.error('Error cargando fechas:', e);
        select.innerHTML = '<option disabled>Error cargando fechas (usando simuladas)</option>';
        // Fallback a simulado en caso de error
        cargarFechasSimuladas(modo, select);
    }
}

function cargarFechasSimuladas(modo, select) {
    const fechas = [];
    const hoy = new Date();
    if (modo === 'dia') {
        for (let i = 0; i < 60; i++) {
            const d = new Date(hoy);
            d.setDate(d.getDate() - i);
            fechas.push({ valor: d.toISOString().split('T')[0], texto: d.toLocaleDateString('es-CR') });
        }
    }
    select.innerHTML = '';
    fechas.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.valor;
        opt.textContent = f.texto;
        select.appendChild(opt);
    });
}

// Generación de Reportes
window.generarReporteActual = async function() {
    const tabActiva = document.querySelector('.nav-link.active').id;
    const bodegasSeleccionadas = Array.from(document.querySelectorAll('.check-bodega-reporte:checked')).map(cb => cb.value);
    
    if (bodegasSeleccionadas.length === 0) {
        mostrarMensaje('Selecciona al menos una bodega', 'warning');
        return;
    }
    
    document.getElementById('placeholderReporte').style.display = 'none';
    document.getElementById('areaResultadosReporte').style.display = 'block';
    const contenedor = document.getElementById('contenedorTablaReporte');
    contenedor.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div><p>Generando reporte...</p></div>';
    
    try {
        if (tabActiva === 'pills-saldos-tab') {
            generarReporteSaldos(bodegasSeleccionadas);
        } else if (tabActiva === 'pills-gastos-dia-tab') {
            const fechas = Array.from(document.getElementById('filtroFechasReporte').selectedOptions).map(o => o.value);
            if (fechas.length === 0) { mostrarMensaje('Selecciona fechas', 'warning'); return; }
            await generarReporteGastosDia(bodegasSeleccionadas, fechas);
        }
        // Implementar otros tipos...
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        contenedor.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
};

function generarReporteSaldos(bodegasIds) {
    const excluirCeros = document.getElementById('excluirCeros').checked;
    const excluirBodegasVacias = document.getElementById('excluirBodegasVacias').checked;
    const bodegasObj = bodegas.filter(b => bodegasIds.includes(b.id));
    
    let html = '<table class="table table-bordered table-sm table-hover bg-white" id="tablaReporteExportar">';
    html += '<thead class="table-dark"><tr><th>Producto</th><th>Unidad</th>';
    bodegasObj.forEach(b => html += `<th>${b.nombre}</th>`);
    html += '<th>Total Global</th></tr></thead><tbody>';
    
    let totalFilas = 0;
    
    productos.forEach(p => {
        let rowHtml = `<tr><td class="fw-bold">${p.nombre}</td><td>${p.unidad}</td>`;
        let totalProducto = 0;
        let tieneStock = false;
        
        bodegasObj.forEach(b => {
            const stockItem = stockBodegas.find(s => s.bodegaId === b.id && s.productoId === p.id);
            const cant = stockItem ? parseFloat(stockItem.stockActual) : 0;
            totalProducto += cant;
            if (cant !== 0) tieneStock = true;
            
            const clase = cant < 0 ? 'text-danger fw-bold' : (cant === 0 ? 'text-muted' : '');
            rowHtml += `<td class="${clase}">${cant}</td>`;
        });
        
        rowHtml += `<td class="fw-bold bg-light">${totalProducto}</td></tr>`;
        
        if (!excluirCeros || tieneStock) {
            html += rowHtml;
            totalFilas++;
        }
    });
    
    html += '</tbody></table>';
    document.getElementById('contenedorTablaReporte').innerHTML = html;
    
    if (totalFilas === 0) {
        document.getElementById('contenedorTablaReporte').innerHTML = '<div class="alert alert-info">No hay datos que mostrar con los filtros actuales.</div>';
    }
}

async function generarReporteGastosDia(bodegasIds, fechas) {
    // Consultar gastos para las fechas seleccionadas
    // Nota: Esto puede ser pesado, optimizar rango
    fechas.sort();
    const fechaInicio = new Date(fechas[0]);
    const fechaFin = new Date(fechas[fechas.length - 1]);
    fechaFin.setHours(23,59,59);
    
    const q = query(
        collection(db, 'movimientos_inventario'),
        where('tipo', '==', 'gasto'),
        where('fecha', '>=', fechaInicio),
        where('fecha', '<=', fechaFin)
    );
    
    const snapshot = await getDocs(q);
    const gastos = snapshot.docs.map(doc => ({ ...doc.data(), fechaStr: doc.data().fecha.toDate().toISOString().split('T')[0] }));
    
    // Filtrar por bodegas seleccionadas (origen)
    const gastosFiltrados = gastos.filter(g => bodegasIds.includes(g.origen));
    
    // Construir matriz
    // Filas: Productos, Columnas: Fechas
    const bodegasObj = bodegas.filter(b => bodegasIds.includes(b.id));
    
    let html = '<div class="accordion" id="accordionReporte">';
    
    bodegasObj.forEach((bodega, index) => {
        // Gastos de esta bodega
        const gastosBodega = gastosFiltrados.filter(g => g.origen === bodega.id);
        if (gastosBodega.length === 0 && document.getElementById('excluirBodegasVacias').checked) return;
        
        html += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button ${index !== 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${bodega.id}">
                        ${bodega.nombre}
                    </button>
                </h2>
                <div id="collapse-${bodega.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#accordionReporte">
                    <div class="accordion-body p-0">
                        <table class="table table-sm table-bordered mb-0">
                            <thead class="table-light">
                                <tr>
                                    <th>Producto</th>
                                    ${fechas.map(f => `<th>${f.split('-')[2]}/${f.split('-')[1]}</th>`).join('')}
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
        `;
        
        productos.forEach(p => {
            const gastosProd = gastosBodega.filter(g => g.productoId === p.id);
            if (gastosProd.length === 0 && document.getElementById('excluirCeros').checked) return;
            
            let rowTotal = 0;
            let rowHtml = `<tr><td>${p.nombre}</td>`;
            
            fechas.forEach(f => {
                const sum = gastosProd.filter(g => g.fechaStr === f).reduce((a, b) => a + parseFloat(b.cantidad), 0);
                rowTotal += sum;
                rowHtml += `<td class="${sum > 0 ? 'text-danger' : 'text-muted'}">${sum || '-'}</td>`;
            });
            
            rowHtml += `<td class="fw-bold">${rowTotal}</td></tr>`;
            html += rowHtml;
        });
        
        html += `</tbody></table></div></div></div>`;
    });
    
    html += '</div>';
    document.getElementById('contenedorTablaReporte').innerHTML = html;
}

window.exportarReporteExcel = function() {
    const table = document.getElementById('tablaReporteExportar'); // Solo funciona si es una sola tabla
    if (table) {
        const wb = XLSX.utils.table_to_book(table, { sheet: "Reporte" });
        XLSX.writeFile(wb, 'Reporte_Inventario.xlsx');
    } else {
        mostrarMensaje('La exportación directa solo está disponible para reportes de tabla simple. Usa Copiar/Pegar para reportes complejos.', 'info');
    }
};

window.exportarReportePDF = function() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Obtener el tipo de reporte activo
        const tabActiva = document.querySelector('.nav-link.active');
        const tipoReporte = tabActiva ? tabActiva.textContent.trim() : 'Reporte de Inventario';
        
        // Título del documento
        doc.setFontSize(16);
        doc.text(tipoReporte, 14, 15);
        
        // Fecha de generación
        doc.setFontSize(10);
        const fecha = new Date().toLocaleDateString('es-CR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        doc.text(`Generado el: ${fecha}`, 14, 22);
        
        let startY = 30;
        
        // Intentar exportar tabla simple
        const table = document.getElementById('tablaReporteExportar');
        if (table) {
            // Usar autoTable para generar la tabla
            doc.autoTable({
                html: table,
                startY: startY,
                theme: 'grid',
                headStyles: { fillColor: [33, 37, 41], textColor: 255 },
                styles: { fontSize: 8, cellPadding: 2 },
                margin: { top: startY }
            });
        } else {
            // Si hay múltiples tablas (como en el reporte de gastos por día)
            const accordion = document.getElementById('accordionReporte');
            if (accordion) {
                const tablas = accordion.querySelectorAll('table');
                let currentY = startY;
                
                tablas.forEach((tabla, index) => {
                    // Obtener el nombre de la bodega del accordion
                    const accordionButton = tabla.closest('.accordion-item')?.querySelector('.accordion-button');
                    const nombreBodega = accordionButton ? accordionButton.textContent.trim() : `Bodega ${index + 1}`;
                    
                    // Agregar nueva página si no es la primera
                    if (index > 0) {
                        doc.addPage();
                        currentY = 15;
                    }
                    
                    // Título de la bodega
                    doc.setFontSize(12);
                    doc.text(nombreBodega, 14, currentY);
                    currentY += 8;
                    
                    // Generar tabla
                    doc.autoTable({
                        html: tabla,
                        startY: currentY,
                        theme: 'grid',
                        headStyles: { fillColor: [33, 37, 41], textColor: 255 },
                        styles: { fontSize: 7, cellPadding: 1.5 },
                        margin: { top: currentY }
                    });
                    
                    // Actualizar posición Y para la siguiente tabla
                    currentY = doc.lastAutoTable.finalY + 10;
                });
            } else {
                // Si no hay tabla, mostrar mensaje
                doc.setFontSize(12);
                doc.text('No hay datos para exportar', 14, startY);
            }
        }
        
        // Guardar el PDF
        const nombreArchivo = `Reporte_Inventario_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(nombreArchivo);
        
    } catch (error) {
        console.error('Error exportando PDF:', error);
        mostrarMensaje('Error al generar el PDF: ' + error.message, 'danger');
    }
};

