import { auth, db } from './auth-secure.js';
import { 
    collection, 
    getDocs,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let bodegasExistentes = [];
let empleados = [];
let vehiculos = [];

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const authManager = await esperarAuthManager();
        await authManager.waitForCurrentUser();
        
        await cargarDatosBase();
    } catch (error) {
        console.error('Error inicializando recuperación:', error);
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

async function cargarDatosBase() {
    try {
        // Cargar bodegas existentes
        const bodegasSnapshot = await getDocs(collection(db, 'bodegas'));
        bodegasExistentes = bodegasSnapshot.docs.map(doc => doc.id);
        console.log(`✅ Cargadas ${bodegasExistentes.length} bodegas existentes`);

        // Cargar empleados
        const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
        empleados = empleadosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ Cargados ${empleados.length} empleados`);

        // Cargar vehículos (si existe la colección)
        try {
            const vehiculosSnapshot = await getDocs(collection(db, 'vehiculos'));
            vehiculos = vehiculosSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ Cargados ${vehiculos.length} vehículos`);
        } catch (e) {
            console.log('⚠️ No se encontró colección de vehículos');
        }

    } catch (error) {
        console.error('Error cargando datos base:', error);
    }
}

window.buscarBodegasDesconocidas = async function() {
    const contenedorCargando = document.getElementById('contenedorCargando');
    const contenedorResultados = document.getElementById('contenedorResultados');
    const contenedorVacio = document.getElementById('contenedorVacio');
    const listaBodegas = document.getElementById('listaBodegasDesconocidas');

    try {
        contenedorCargando.style.display = 'block';
        contenedorResultados.style.display = 'none';
        contenedorVacio.style.display = 'none';
        listaBodegas.innerHTML = '';

        // Recargar bodegas existentes
        await cargarDatosBase();

        // Buscar todas las transacciones
        // ⚠️ IMPORTANTE: Esta función ADMINISTRATIVA (recuperación) necesita TODOS los movimientos_inventario
        // NO debe tener límite porque debe procesar TODO el historial para recuperar datos
        console.log('🔍 Buscando transacciones...');
        const movimientosSnapshot = await getDocs(collection(db, 'movimientos_inventario'));
        const movimientos = movimientosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Encontradas ${movimientos.length} transacciones`);

        // Identificar bodegas desconocidas
        const bodegasDesconocidas = new Map(); // Map<bodegaId, { info, movimientos }>

        movimientos.forEach(mov => {
            // Verificar origen
            if (mov.origen && !bodegasExistentes.includes(mov.origen)) {
                if (!bodegasDesconocidas.has(mov.origen)) {
                    bodegasDesconocidas.set(mov.origen, {
                        id: mov.origen,
                        nombre: mov.origenNombre || 'Sin nombre',
                        tipo: inferirTipoBodega(mov.origenNombre),
                        movimientos: [],
                        comoOrigen: 0,
                        comoDestino: 0
                    });
                }
                const info = bodegasDesconocidas.get(mov.origen);
                info.movimientos.push(mov);
                info.comoOrigen++;
            }

            // Verificar destino
            if (mov.destino && !bodegasExistentes.includes(mov.destino)) {
                if (!bodegasDesconocidas.has(mov.destino)) {
                    bodegasDesconocidas.set(mov.destino, {
                        id: mov.destino,
                        nombre: mov.destinoNombre || 'Sin nombre',
                        tipo: inferirTipoBodega(mov.destinoNombre),
                        movimientos: [],
                        comoOrigen: 0,
                        comoDestino: 0
                    });
                }
                const info = bodegasDesconocidas.get(mov.destino);
                info.movimientos.push(mov);
                info.comoDestino++;
            }
        });

        console.log(`✅ Encontradas ${bodegasDesconocidas.size} bodegas desconocidas`);

        // Mostrar resultados
        contenedorCargando.style.display = 'none';
        
        if (bodegasDesconocidas.size === 0) {
            contenedorVacio.style.display = 'block';
            contenedorVacio.innerHTML = `
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <p class="fw-bold">¡Excelente!</p>
                <p>No se encontraron bodegas desconocidas en las transacciones.</p>
            `;
            return;
        }

        contenedorResultados.style.display = 'block';
        document.getElementById('totalBodegasDesconocidas').textContent = bodegasDesconocidas.size;

        // Renderizar tarjetas
        listaBodegas.innerHTML = '';
        const bodegasArray = Array.from(bodegasDesconocidas.values());
        
        bodegasArray.forEach(bodega => {
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4';
            
            const fechaPrimera = bodega.movimientos.length > 0 
                ? obtenerFechaPrimera(bodega.movimientos[0])
                : 'N/A';
            const fechaUltima = bodega.movimientos.length > 0 
                ? obtenerFechaUltima(bodega.movimientos)
                : 'N/A';

            card.innerHTML = `
                <div class="card bodega-card shadow-sm h-100">
                    <div class="card-header bg-warning text-dark">
                        <h6 class="mb-0"><i class="fas fa-exclamation-triangle me-2"></i>Bodega Desconocida</h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-2">
                            <strong>ID:</strong> 
                            <code class="small">${bodega.id}</code>
                        </div>
                        <div class="mb-2">
                            <strong>Nombre en Transacciones:</strong>
                            <div class="text-primary fw-bold">${bodega.nombre}</div>
                        </div>
                        <div class="mb-2">
                            <strong>Tipo Inferido:</strong>
                            <span class="badge bg-info">${bodega.tipo || 'Desconocido'}</span>
                        </div>
                        <hr>
                        <div class="small">
                            <div class="mb-1">
                                <i class="fas fa-list me-1"></i>
                                <strong>Total Movimientos:</strong> ${bodega.movimientos.length}
                            </div>
                            <div class="mb-1">
                                <i class="fas fa-arrow-up me-1 text-success"></i>
                                <strong>Como Origen:</strong> ${bodega.comoOrigen}
                            </div>
                            <div class="mb-1">
                                <i class="fas fa-arrow-down me-1 text-primary"></i>
                                <strong>Como Destino:</strong> ${bodega.comoDestino}
                            </div>
                            <div class="mb-1">
                                <i class="fas fa-calendar me-1"></i>
                                <strong>Primera Transacción:</strong> ${fechaPrimera}
                            </div>
                            <div>
                                <i class="fas fa-calendar me-1"></i>
                                <strong>Última Transacción:</strong> ${fechaUltima}
                            </div>
                        </div>
                    </div>
                    <div class="card-footer bg-light">
                        <button class="btn btn-success btn-sm w-100" onclick="abrirModalCrearBodega('${bodega.id}', '${bodega.nombre}', '${bodega.tipo || ''}')">
                            <i class="fas fa-plus-circle me-2"></i>Recrear Bodega
                        </button>
                    </div>
                </div>
            `;
            
            listaBodegas.appendChild(card);
        });

    } catch (error) {
        console.error('Error buscando bodegas desconocidas:', error);
        alert('Error al buscar bodegas desconocidas: ' + error.message);
        contenedorCargando.style.display = 'none';
        contenedorVacio.style.display = 'block';
    }
};

function inferirTipoBodega(nombre) {
    if (!nombre) return 'principal';
    
    const nombreLower = nombre.toLowerCase();
    
    if (nombreLower.includes('rutero') || nombreLower.includes('ruta')) return 'rutero';
    if (nombreLower.includes('especial') || nombreLower.includes('insumos diarios')) return 'especial';
    if (nombreLower.includes('apv') || nombreLower.includes('vehiculo')) return 'apv';
    if (nombreLower.includes('principal') || nombreLower.includes('central')) return 'principal';
    
    return 'principal'; // Por defecto
}

function obtenerFechaPrimera(movimiento) {
    if (!movimiento.fecha) return 'N/A';
    
    try {
        const fecha = movimiento.fecha.toDate ? movimiento.fecha.toDate() : new Date(movimiento.fecha);
        return fecha.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    } catch (e) {
        return 'N/A';
    }
}

function obtenerFechaUltima(movimientos) {
    if (movimientos.length === 0) return 'N/A';
    
    let fechaMasReciente = null;
    
    movimientos.forEach(mov => {
        if (mov.fecha) {
            try {
                const fecha = mov.fecha.toDate ? mov.fecha.toDate() : new Date(mov.fecha);
                if (!fechaMasReciente || fecha > fechaMasReciente) {
                    fechaMasReciente = fecha;
                }
            } catch (e) {
                // Ignorar errores de fecha
            }
        }
    });
    
    if (!fechaMasReciente) return 'N/A';
    
    return fechaMasReciente.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

window.abrirModalCrearBodega = function(bodegaId, nombreSugerido, tipoSugerido) {
    document.getElementById('bodegaIdRecuperar').value = bodegaId;
    document.getElementById('modalBodegaId').textContent = bodegaId;
    document.getElementById('nombreBodegaRecuperar').value = nombreSugerido;
    document.getElementById('nombreSugerido').textContent = nombreSugerido;
    document.getElementById('tipoBodegaRecuperar').value = tipoSugerido || 'principal';
    
    // Llenar select de empleados
    const selectEmpleado = document.getElementById('empleadoBodegaRecuperar');
    selectEmpleado.innerHTML = '<option value="">Sin empleado asignado</option>';
    empleados.forEach(emp => {
        const nombreCompleto = `${emp.primerNombre || ''} ${emp.primerApellido || ''}`.trim();
        selectEmpleado.innerHTML += `<option value="${emp.id}">${nombreCompleto}</option>`;
    });
    
    // Llenar select de vehículos
    const selectVehiculo = document.getElementById('vehiculoBodegaRecuperar');
    selectVehiculo.innerHTML = '<option value="">Sin vehículo asignado</option>';
    vehiculos.forEach(veh => {
        selectVehiculo.innerHTML += `<option value="${veh.id}">${veh.nombre || veh.placa || veh.id}</option>`;
    });
    
    // Mostrar/ocultar campos según tipo
    actualizarCamposSegunTipo();
    
    // Agregar listener al cambio de tipo
    const tipoSelect = document.getElementById('tipoBodegaRecuperar');
    // Remover listener anterior si existe
    const nuevoTipoSelect = tipoSelect.cloneNode(true);
    tipoSelect.parentNode.replaceChild(nuevoTipoSelect, tipoSelect);
    nuevoTipoSelect.addEventListener('change', actualizarCamposSegunTipo);
    
    new bootstrap.Modal(document.getElementById('modalCrearBodega')).show();
};

function actualizarCamposSegunTipo() {
    const tipo = document.getElementById('tipoBodegaRecuperar').value;
    const contenedorEmpleado = document.getElementById('contenedorEmpleado');
    const contenedorVehiculo = document.getElementById('contenedorVehiculo');
    
    if (tipo === 'rutero' || tipo === 'especial') {
        contenedorEmpleado.style.display = 'block';
        contenedorVehiculo.style.display = 'none';
    } else if (tipo === 'apv') {
        contenedorEmpleado.style.display = 'none';
        contenedorVehiculo.style.display = 'block';
    } else {
        contenedorEmpleado.style.display = 'none';
        contenedorVehiculo.style.display = 'none';
    }
}

window.crearBodegaRecuperada = async function() {
    const bodegaId = document.getElementById('bodegaIdRecuperar').value;
    const nombre = document.getElementById('nombreBodegaRecuperar').value;
    const tipo = document.getElementById('tipoBodegaRecuperar').value;
    const empleadoId = document.getElementById('empleadoBodegaRecuperar').value;
    const vehiculoId = document.getElementById('vehiculoBodegaRecuperar').value;
    const ubicacion = document.getElementById('ubicacionBodegaRecuperar').value;

    if (!nombre || !tipo) {
        alert('Por favor completa todos los campos obligatorios');
        return;
    }

    if ((tipo === 'rutero' || tipo === 'especial') && !empleadoId) {
        if (!confirm('Este tipo de bodega normalmente requiere un empleado asignado. ¿Deseas continuar sin empleado?')) {
            return;
        }
    }

    if (tipo === 'apv' && !vehiculoId) {
        if (!confirm('Las bodegas APV normalmente requieren un vehículo asignado. ¿Deseas continuar sin vehículo?')) {
            return;
        }
    }

    const btn = document.querySelector('button[onclick="crearBodegaRecuperada()"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';

    try {
        // Verificar que la bodega no exista ya
        const bodegasSnapshot = await getDocs(collection(db, 'bodegas'));
        const bodegasExistentes = bodegasSnapshot.docs.map(doc => doc.id);
        
        if (bodegasExistentes.includes(bodegaId)) {
            alert('Esta bodega ya existe en el sistema. No es necesario recrearla.');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check me-2"></i>Crear Bodega';
            bootstrap.Modal.getInstance(document.getElementById('modalCrearBodega')).hide();
            return;
        }

        // Crear la bodega con el ID específico usando setDoc
        const bodegaData = {
            nombre,
            tipo,
            empleadoId: (tipo === 'rutero' || tipo === 'especial') ? (empleadoId || null) : null,
            vehiculoId: tipo === 'apv' ? (vehiculoId || null) : null,
            ubicacion: ubicacion || null,
            activa: true,
            createdAt: serverTimestamp(),
            recuperada: true,
            fechaRecuperacion: serverTimestamp()
        };

        // Agregar token CSRF si está disponible
        if (window.csrfProtection) {
            window.csrfProtection.addTokenToData(bodegaData);
        }

        await setDoc(doc(db, 'bodegas', bodegaId), bodegaData);

        alert(`✅ Bodega recreada exitosamente con ID: ${bodegaId}\n\nLas transacciones ahora deberían ser rastreables en reportes y saldos.`);
        
        bootstrap.Modal.getInstance(document.getElementById('modalCrearBodega')).hide();
        document.getElementById('formCrearBodega').reset();
        
        // Recargar bodegas existentes y buscar de nuevo
        await cargarDatosBase();
        window.buscarBodegasDesconocidas();

    } catch (error) {
        console.error('Error creando bodega:', error);
        alert('Error al crear la bodega: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check me-2"></i>Crear Bodega';
    }
};







