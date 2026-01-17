// Módulo de Tickets Internos - Eco Plagas
import { initializeApp, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, query, getDocs, where, updateDoc, doc, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// Sistema seguro: usar secureAuthManager directamente
// No importamos AuthManager, usamos window.secureAuthManager

// Firebase configuration (usar configuración centralizada si está disponible)
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

// Usar la app de Firebase existente (debe ser la misma que auth-secure.js)
let app, db, storage, auth;
try {
    app = getApp();
    db = getFirestore(app);
    // Usar la misma instancia de Auth que auth-secure.js
    // Si window.firebaseAuth existe, usar esa instancia (más confiable)
    if (window.firebaseAuth) {
        auth = window.firebaseAuth;
        // Asegurar que Storage use la misma app que Auth
        storage = getStorage(window.firebaseAuth.app);
    } else {
        auth = getAuth(app);
        // Exponer auth globalmente para que otros módulos lo usen
        window.firebaseAuth = auth;
        // Asegurar que Storage use la misma instancia de Auth
        storage = getStorage(app);
    }
} catch (error) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    // Exponer auth globalmente
    window.firebaseAuth = auth;
}

// Usar secureAuthManager (SISTEMA SEGURO)
let authManager;
let currentUser = null;
let empleados = [];
let tickets = [];

// Variable para cleanup de timers
let badgeIntervalId = null;

// Función para inicializar authManager
async function initializeAuthManager() {
    // Esperar a que secureAuthManager esté disponible
    let retries = 0;
    const maxRetries = 30; // 3 segundos
    
    while (!window.secureAuthManager && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
    }
    
    if (window.secureAuthManager) {
        authManager = window.secureAuthManager;
        // También configurar window.authManager para compatibilidad
        window.authManager = window.secureAuthManager;
        console.log('✅ [TICKETS_SECURE] secureAuthManager inicializado');
        return true;
    } else {
        console.error('❌ [TICKETS_SECURE] secureAuthManager no disponible');
        return false;
    }
}

// Esperar a que el usuario autenticado esté disponible
async function obtenerUsuarioAutenticado(timeoutMs = 8000) {
    if (!authManager) return null;

    if (typeof authManager.waitForCurrentUser === 'function') {
        return await authManager.waitForCurrentUser(timeoutMs);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        const user = authManager.getCurrentUser ? authManager.getCurrentUser() : null;
        if (user) {
            return user;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return null;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar que el body esté autenticado (ya verificado en el head)
    if (document.body && !document.body.classList.contains('authenticated')) {
        console.log('⏳ [TICKETS_SECURE] Esperando verificación de autenticación del head...');
        // Esperar un momento para que la verificación del head termine
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Si después de esperar aún no está autenticado, verificar
        if (!document.body.classList.contains('authenticated')) {
            if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
                console.log('❌ [TICKETS_SECURE] No autenticado en DOMContentLoaded, redirigiendo...');
                if (document.body) {
                    document.body.style.display = 'none';
                }
                if (!window.location.pathname.includes('iniciar_sesion.html')) {
                    window.location.replace('iniciar_sesion.html');
                }
                return;
            } else {
                // Mostrar body si está autenticado
                document.body.style.display = 'block';
                document.body.classList.add('authenticated');
            }
        }
    }
    
    // Inicializar authManager
    await initializeAuthManager();
    
    try {
        // Verificar permisos de acceso
        const permisosOk = await checkPagePermissions();
        if (!permisosOk) {
            return;
        }
        
        // Verificar autenticación (solo si llegamos aquí)
        currentUser = await obtenerUsuarioAutenticado();
        if (!currentUser) {
            console.log('❌ [TICKETS_SECURE] No se pudo obtener usuario después de inicializar authManager');
            mostrarMensaje('Tu sesión expiró, vuelve a iniciar sesión', 'warning');
            if (!window.location.pathname.includes('iniciar_sesion.html')) {
                setTimeout(() => {
                    window.location.replace('iniciar_sesion.html');
                }, 500);
            }
            return;
        }


        // Cargar datos
        await Promise.all([
            cargarEmpleados(),
            cargarTickets()
        ]);

        // Configurar eventos
        configurarEventos();
        
        // Verificar permisos para mostrar botón de crear tickets en masa
        verificarPermisosTicketsMasa();
        
        // Verificar permisos para mostrar reporte de eficiencia
        verificarPermisosReporteEficiencia();
        
        // Mostrar datos
        mostrarEstadisticas();
        mostrarTickets();
        
        // Hacer funciones globales
        window.crearTicket = crearTicket;
        window.verTicket = verTicket;
        window.abrirResolverTicket = abrirResolverTicket;
        window.resolverTicket = resolverTicket;
        window.abrirEditarTicket = abrirEditarTicket;
        window.guardarEdicionTicket = guardarEdicionTicket;
        window.seleccionarTodosEmpleadosMasa = seleccionarTodosEmpleadosMasa;
        window.confirmarCrearTicketsMasa = confirmarCrearTicketsMasa;
        window.crearTicketsMasa = crearTicketsMasa;
        window.previewFotosResolucion = previewFotosResolucion;
        window.removerFotoResolucion = removerFotoResolucion;
        
        // Actualizar badge de notificaciones
        actualizarBadgeTickets();
        
        // Actualizar badge periódicamente cada 30 segundos
        // Limpiar timer anterior si existe (por si se reinicializa)
        if (badgeIntervalId) {
            clearInterval(badgeIntervalId);
        }
        badgeIntervalId = setInterval(() => {
            actualizarBadgeTickets();
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error inicializando tickets:', error);
        mostrarMensaje('Error inicializando el módulo de tickets', 'danger');
    }
});

// Limpiar timers al salir de la página
window.addEventListener('beforeunload', () => {
    if (badgeIntervalId) {
        clearInterval(badgeIntervalId);
        badgeIntervalId = null;
    }
});

// Cargar empleados
async function cargarEmpleados() {
    try {
        const empleadosQuery = query(collection(db, 'empleados'), orderBy('primerNombre'));
        const querySnapshot = await getDocs(empleadosQuery);
        
        empleados = [];
        querySnapshot.forEach(doc => {
            empleados.push({ id: doc.id, ...doc.data() });
        });
        
    } catch (error) {
        console.error('❌ Error cargando empleados:', error);
        throw error;
    }
}

// Cargar tickets
async function cargarTickets() {
    try {
        const ticketsQuery = query(collection(db, 'tickets'), orderBy('fechaCreacion', 'desc'));
        const querySnapshot = await getDocs(ticketsQuery);
        
        tickets = [];
        querySnapshot.forEach(doc => {
            tickets.push({ id: doc.id, ...doc.data() });
        });
        
    } catch (error) {
        console.error('❌ Error cargando tickets:', error);
        throw error;
    }
}

// Configurar eventos
function configurarEventos() {
    // Filtros
    document.getElementById('filtroEstado').addEventListener('change', filtrarTickets);
    document.getElementById('filtroPrioridad').addEventListener('change', filtrarTickets);
    document.getElementById('filtroAsignado').addEventListener('change', filtrarTickets);
    document.getElementById('filtroCreador').addEventListener('change', filtrarTickets);
    
    // Llenar opciones de empleados
    llenarOpcionesEmpleados();
}

// Llenar opciones de empleados en filtros y formularios
function llenarOpcionesEmpleados() {
    const filtroAsignado = document.getElementById('filtroAsignado');
    const filtroCreador = document.getElementById('filtroCreador');
    const asignadoTicket = document.getElementById('asignadoTicket');
    const editAsignadoTicket = document.getElementById('editAsignadoTicket');
    const creadoPorGerencia = document.getElementById('creadoPorGerencia');
    
    // Filtrar solo empleados activos
    const empleadosActivos = empleados.filter(empleado => {
        const estado = empleado.estado || empleado.activo;
        return estado === 'Activo' || estado === 'activo' || estado === true;
    });
    
    // Lista de usuarios de gerencia
    const usuariosGerencia = ['pablo.paniagua', 'manuel.paniagua', 'cristhian.paniagua', 'mario.paniagua'];
    
    empleadosActivos.forEach(empleado => {
        // Mostrar nombre completo más legible
        const nombreCompleto = `${empleado.primerNombre} ${empleado.primerApellido}`;
        const option1 = new Option(nombreCompleto, empleado.username);
        const option2 = new Option(nombreCompleto, empleado.username);
        const option3 = new Option(nombreCompleto, empleado.username);
        
        filtroAsignado.appendChild(option1);
        filtroCreador.appendChild(option2);
        asignadoTicket.appendChild(option3);
        if (editAsignadoTicket) {
            const option4 = new Option(nombreCompleto, empleado.username);
            editAsignadoTicket.appendChild(option4);
        }
        
        // Agregar solo usuarios de gerencia al select de "Crear a nombre de"
        if (creadoPorGerencia && usuariosGerencia.includes(empleado.username)) {
            const optionGerencia = new Option(nombreCompleto, empleado.username);
            creadoPorGerencia.appendChild(optionGerencia);
        }
        
        // También agregar al select de tickets en masa
        const creadoPorGerenciaMasa = document.getElementById('creadoPorGerenciaMasa');
        if (creadoPorGerenciaMasa && usuariosGerencia.includes(empleado.username)) {
            const optionGerenciaMasa = new Option(nombreCompleto, empleado.username);
            creadoPorGerenciaMasa.appendChild(optionGerenciaMasa);
        }
    });
    
    // Mostrar/ocultar campo de gerencia según el usuario autenticado
    const usuariosAdministracion = ['mayren.soto', 'isabella.sanchez'];
    const campoCrearPorGerencia = document.getElementById('campoCrearPorGerencia');
    const campoCrearPorGerenciaMasa = document.getElementById('campoCrearPorGerenciaMasa');
    
    if (currentUser) {
        const esUsuarioAdministracion = usuariosAdministracion.includes(currentUser.username);
        
        if (campoCrearPorGerencia) {
            campoCrearPorGerencia.style.display = esUsuarioAdministracion ? 'block' : 'none';
        }
        
        if (campoCrearPorGerenciaMasa) {
            campoCrearPorGerenciaMasa.style.display = esUsuarioAdministracion ? 'block' : 'none';
        }
        
        console.log('[TICKETS] 🔐 Configurando campo de gerencia', {
            usuario: currentUser.username,
            esAdministracion: esUsuarioAdministracion,
            campoVisible: esUsuarioAdministracion,
            campoNuevoTicket: campoCrearPorGerencia ? 'encontrado' : 'no encontrado',
            campoTicketsMasa: campoCrearPorGerenciaMasa ? 'encontrado' : 'no encontrado'
        });
    }
}

// Funciones para seleccionar fecha de vencimiento fácilmente
window.seleccionarFechaVencimiento = function(dias) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    const fechaFormato = fecha.toISOString().split('T')[0];
    document.getElementById('vencimientoTicket').value = fechaFormato;
};

window.limpiarFechaVencimiento = function() {
    document.getElementById('vencimientoTicket').value = '';
};

// Mostrar estadísticas
function mostrarEstadisticas() {
    // Verificar si el usuario tiene permisos para ver el reporte
    const user = currentUser || authManager.getCurrentUser();
    const tienePermisos = user && user.permisos && 
                          user.permisos.administrador_bodega === true && 
                          user.permisos.tickets === true;
    
    // Si no tiene permisos, no mostrar estadísticas
    if (!tienePermisos) {
        const estadisticasContainer = document.getElementById('estadisticasTickets');
        if (estadisticasContainer) {
            estadisticasContainer.innerHTML = '';
        }
        return;
    }
    
    const totalTickets = tickets.length;
    const ticketsPendientes = tickets.filter(t => t.estado === 'pendiente').length;
    const ticketsCompletados = tickets.filter(t => t.estado === 'completada').length;
    const ticketsUrgentes = tickets.filter(t => t.prioridad === 'urgente').length;
    
    // Calcular porcentajes
    const completadosHoy = tickets.filter(t => {
        if (t.estado !== 'completada' || !t.fechaResolucion) return false;
        const hoy = new Date();
        const fechaResolucion = t.fechaResolucion.toDate ? t.fechaResolucion.toDate() : new Date(t.fechaResolucion);
        return fechaResolucion.toDateString() === hoy.toDateString();
    }).length;
    
    const completadosSemana = tickets.filter(t => {
        if (t.estado !== 'completada' || !t.fechaResolucion) return false;
        const fechaResolucion = t.fechaResolucion.toDate ? t.fechaResolucion.toDate() : new Date(t.fechaResolucion);
        const unaSemanaAtras = new Date();
        unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
        return fechaResolucion >= unaSemanaAtras;
    }).length;
    
    const completadosMes = tickets.filter(t => {
        if (t.estado !== 'completada' || !t.fechaResolucion) return false;
        const fechaResolucion = t.fechaResolucion.toDate ? t.fechaResolucion.toDate() : new Date(t.fechaResolucion);
        const unMesAtras = new Date();
        unMesAtras.setMonth(unMesAtras.getMonth() - 1);
        return fechaResolucion >= unMesAtras;
    }).length;
    
    const porcentajeCompletadosHoy = totalTickets > 0 ? ((completadosHoy / totalTickets) * 100).toFixed(1) : 0;
    const porcentajeCompletadosSemana = totalTickets > 0 ? ((completadosSemana / totalTickets) * 100).toFixed(1) : 0;
    const porcentajeCompletadosMes = totalTickets > 0 ? ((completadosMes / totalTickets) * 100).toFixed(1) : 0;
    
    // Función para determinar si un ticket está vencido
    const esTicketVencido = (ticket) => {
        if (ticket.estado === 'completada' || !ticket.fechaVencimiento) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaVencimiento = ticket.fechaVencimiento.toDate ? ticket.fechaVencimiento.toDate() : new Date(ticket.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);
        return fechaVencimiento < hoy;
    };
    
    // Calcular eficiencia por persona asignada
    const eficienciaPorPersona = empleados.map(empleado => {
        const ticketsAsignados = tickets.filter(t => t.asignadoA === empleado.username);
        const ticketsCompletados = ticketsAsignados.filter(t => t.estado === 'completada');
        const ticketsPendientes = ticketsAsignados.filter(t => t.estado === 'pendiente');
        const ticketsVencidos = ticketsPendientes.filter(t => esTicketVencido(t));
        const ticketsConTiempo = ticketsPendientes.filter(t => !esTicketVencido(t));
        
        // Calcular % de vencidas (1 - % de vencidas)
        const porcentajeVencidas = ticketsAsignados.length > 0 ? 
            ((ticketsVencidos.length / ticketsAsignados.length) * 100) : 0;
        const porcentajeNoVencidas = Math.round(100 - porcentajeVencidas);
        
        // Calcular % de completadas (solo informativo, no afecta el color)
        const porcentajeCompletadas = ticketsAsignados.length > 0 ? 
            Math.round((ticketsCompletados.length / ticketsAsignados.length) * 100) : 0;
        
        return {
            nombre: `${empleado.primerNombre} ${empleado.primerApellido}`,
            username: empleado.username,
            ticketsAsignados: ticketsAsignados.length,
            ticketsCompletados: ticketsCompletados.length,
            ticketsVencidos: ticketsVencidos,
            ticketsConTiempo: ticketsConTiempo,
            porcentajeNoVencidas: porcentajeNoVencidas,
            porcentajeCompletadas: porcentajeCompletadas
        };
    }).filter(p => p.ticketsAsignados > 0).sort((a, b) => b.ticketsAsignados - a.ticketsAsignados);
    
    // Calcular porcentaje de tareas vencidas
    const ticketsVencidos = tickets.filter(t => {
        if (t.estado === 'completada' || !t.fechaVencimiento) return false;
        const hoy = new Date();
        const fechaVencimiento = t.fechaVencimiento.toDate ? t.fechaVencimiento.toDate() : new Date(t.fechaVencimiento);
        return fechaVencimiento < hoy;
    }).length;
    
    const porcentajeVencidos = totalTickets > 0 ? ((ticketsVencidos / totalTickets) * 100).toFixed(1) : 0;
    
    const accordionId = 'accordionEficienciaEmpleados';
    const html = `
        <div class="accordion" id="${accordionId}" style="display: flex; flex-direction: column; gap: 3px;">
            ${eficienciaPorPersona.map((persona, index) => {
                // Color basado en % de no vencidas (1 - % de vencidas)
                // Rojo si < 90%, verde si >= 90%
                const esVerde = persona.porcentajeNoVencidas >= 90;
                const colorFondo = esVerde ? '#d4edda' : '#f8d7da';
                const colorBorde = esVerde ? '#c3e6cb' : '#f5c6cb';
                const colorTexto = esVerde ? '#155724' : '#721c24';
                const collapseId = `collapseEficiencia${persona.username.replace(/[^a-zA-Z0-9]/g, '')}`;
                const headingId = `headingEficiencia${persona.username.replace(/[^a-zA-Z0-9]/g, '')}`;
                
                return `
                    <div class="accordion-item" style="border: 1px solid ${colorBorde}; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                        <h2 class="accordion-header" id="${headingId}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}" style="background: ${colorFondo}; border: none; padding: 3px 10px; font-size: 0.8rem; box-shadow: none;">
                                <div class="d-flex align-items-center justify-content-between w-100">
                                    <!-- Nombre del empleado -->
                                    <div class="fw-bold" style="color: #2c3e50; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;">
                                        ${persona.nombre}
                                    </div>
                                    
                                    <!-- % de no vencidas (determina el color) -->
                                    <div class="text-center" style="flex-shrink: 0; margin: 0 12px;">
                                        <div class="fw-bold" style="font-size: 0.85rem; color: ${colorTexto}; line-height: 1.1;">
                                            ${persona.porcentajeNoVencidas}%
                                        </div>
                                        <div style="font-size: 0.6rem; color: #6c757d; margin-top: 1px;">No vencidas</div>
                                    </div>
                                    
                                    <!-- % de completadas (solo informativo) -->
                                    <div class="text-center" style="flex-shrink: 0;">
                                        <div class="fw-bold" style="font-size: 0.85rem; color: #6c757d; line-height: 1.1;">
                                            ${persona.porcentajeCompletadas}%
                                        </div>
                                        <div style="font-size: 0.6rem; color: #6c757d; margin-top: 1px;">Completadas</div>
                                    </div>
                                </div>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
                            <div class="accordion-body" style="padding: 8px 10px; background: white;">
                                ${persona.ticketsVencidos.length > 0 ? `
                                    <div class="mb-2">
                                        <div class="fw-bold text-danger mb-1" style="font-size: 0.75rem;">
                                            <i class="fas fa-exclamation-triangle me-1"></i>Pendientes Vencidas (${persona.ticketsVencidos.length})
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            ${persona.ticketsVencidos.map(ticket => `
                                                <div style="padding: 4px 8px; background: #fff5f5; border-left: 3px solid #dc3545; border-radius: 3px; font-size: 0.75rem;">
                                                    <div class="fw-bold" style="color: #721c24;">${ticket.titulo}</div>
                                                    ${ticket.fechaVencimiento ? `
                                                        <div style="font-size: 0.7rem; color: #6c757d; margin-top: 2px;">
                                                            Vencido: ${formatearVencimiento(ticket.fechaVencimiento)}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                ${persona.ticketsConTiempo.length > 0 ? `
                                    <div>
                                        <div class="fw-bold text-warning mb-1" style="font-size: 0.75rem;">
                                            <i class="fas fa-clock me-1"></i>Pendientes con Tiempo (${persona.ticketsConTiempo.length})
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            ${persona.ticketsConTiempo.map(ticket => `
                                                <div style="padding: 4px 8px; background: #fffbf0; border-left: 3px solid #ffc107; border-radius: 3px; font-size: 0.75rem;">
                                                    <div class="fw-bold" style="color: #856404;">${ticket.titulo}</div>
                                                    ${ticket.fechaVencimiento ? `
                                                        <div style="font-size: 0.7rem; color: #6c757d; margin-top: 2px;">
                                                            Vence: ${formatearVencimiento(ticket.fechaVencimiento)}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                ${persona.ticketsVencidos.length === 0 && persona.ticketsConTiempo.length === 0 ? `
                                    <div class="text-center text-muted" style="font-size: 0.75rem; padding: 8px;">
                                        <i class="fas fa-check-circle text-success me-1"></i>No hay tareas pendientes
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('estadisticasTickets').innerHTML = html;
}

// Mostrar tickets
function mostrarTickets(ticketsFiltrados = null) {
    const ticketsAMostrar = ticketsFiltrados || tickets;
    const container = document.getElementById('listaTickets');
    
    if (!currentUser || !currentUser.username) {
        container.innerHTML = '<div class="alert alert-warning">Error: Usuario no identificado</div>';
        return;
    }
    
    if (ticketsAMostrar.length === 0) {
        container.innerHTML = `
            <div class="mobile-empty-state">
                <i class="fas fa-ticket-alt"></i>
                <h6>No hay tickets</h6>
                <p>No se encontraron tickets con los filtros seleccionados</p>
            </div>
        `;
        return;
    }
    
    // Separar tickets en categorías
    const misTicketsCreados = ticketsAMostrar.filter(t => t.creadoPor === currentUser.username);
    const misTicketsAsignados = ticketsAMostrar.filter(t => t.asignadoA === currentUser.username && t.creadoPor !== currentUser.username);
    const otrosTickets = ticketsAMostrar.filter(t => t.creadoPor !== currentUser.username && t.asignadoA !== currentUser.username);
    
    // Función para determinar si un ticket está vencido
    const esTicketVencido = (ticket) => {
        if (ticket.estado === 'completada' || !ticket.fechaVencimiento) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fechaVencimiento = ticket.fechaVencimiento.toDate ? ticket.fechaVencimiento.toDate() : new Date(ticket.fechaVencimiento);
        fechaVencimiento.setHours(0, 0, 0, 0);
        return fechaVencimiento < hoy;
    };
    
    // Ordenar por fecha de vencimiento (más pronto primero)
    const ordenarPorVencimiento = (a, b) => {
        if (!a.fechaVencimiento && !b.fechaVencimiento) return 0;
        if (!a.fechaVencimiento) return 1;
        if (!b.fechaVencimiento) return -1;
        const fechaA = a.fechaVencimiento.toDate ? a.fechaVencimiento.toDate() : new Date(a.fechaVencimiento);
        const fechaB = b.fechaVencimiento.toDate ? b.fechaVencimiento.toDate() : new Date(b.fechaVencimiento);
        return fechaA - fechaB;
    };
    
    misTicketsCreados.sort(ordenarPorVencimiento);
    misTicketsAsignados.sort(ordenarPorVencimiento);
    otrosTickets.sort(ordenarPorVencimiento);
    
    // Función para renderizar ticket en formato mobile-friendly mejorado
    const renderTicketCard = (ticket, parentAccordionId = 'accordionTickets') => {
        const asignado = empleados.find(e => e.username === ticket.asignadoA);
        const creador = empleados.find(e => e.username === ticket.creadoPor);
        const nombreAsignado = asignado ? `${asignado.primerNombre} ${asignado.primerApellido}` : 'Sin asignar';
        const nombreCreador = creador ? `${creador.primerNombre} ${creador.primerApellido}` : 'Desconocido';
        const esVencido = ticket.fechaVencimiento && ticket.estado !== 'completada' && new Date(ticket.fechaVencimiento.toDate ? ticket.fechaVencimiento.toDate() : new Date(ticket.fechaVencimiento)) < new Date();
        const puedoEditar = ticket.creadoPor === currentUser.username;
        const esUrgente = ticket.prioridad === 'urgente';
        
        // Calcular días hasta vencimiento
        let diasRestantes = null;
        if (ticket.fechaVencimiento && ticket.estado !== 'completada') {
            const fechaVenc = ticket.fechaVencimiento.toDate ? ticket.fechaVencimiento.toDate() : new Date(ticket.fechaVencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            fechaVenc.setHours(0, 0, 0, 0);
            diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
        }
        
        // Generar ID único para el acordeón de este ticket
        const ticketAccordionId = `ticketAccordion${ticket.id.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        // Formato corto de nombres (solo primer nombre y primera letra del apellido)
        const nombreCreadorCorto = creador ? `${creador.primerNombre} ${creador.primerApellido.charAt(0)}.` : 'N/A';
        const nombreAsignadoCorto = asignado ? `${asignado.primerNombre} ${asignado.primerApellido.charAt(0)}.` : 'N/A';
        
        return `
            <div class="accordion-item mb-2" style="border: ${ticket.estado === 'completada' ? '2px solid #c3e6cb' : esVencido ? '3px solid #dc3545' : esUrgente ? '3px solid #ff6b6b' : '3px solid #ffc107'}; border-radius: 8px; overflow: hidden; box-shadow: ${ticket.estado === 'completada' ? '0 1px 4px rgba(0,0,0,0.1)' : '0 3px 8px rgba(0,0,0,0.15), 0 0 0 2px ' + (esVencido ? 'rgba(220, 53, 69, 0.2)' : esUrgente ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 193, 7, 0.2)')}; position: relative; background: ${ticket.estado === 'completada' ? '#f8fff9' : '#fff'};">
                <h2 class="accordion-header" id="heading${ticketAccordionId}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${ticketAccordionId}" aria-expanded="false" aria-controls="${ticketAccordionId}" style="background: ${ticket.estado === 'completada' ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : esVencido ? 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' : esUrgente ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' : 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)'}; border: none; padding: 8px 12px; padding-right: 50px; font-size: 0.9rem; font-weight: ${ticket.estado === 'pendiente' ? '700' : '600'}; position: relative; align-items: flex-start; white-space: normal; word-wrap: break-word; overflow-wrap: break-word; height: auto; min-height: auto; ${ticket.estado === 'pendiente' ? 'border-left: 4px solid ' + (esVencido ? '#dc3545' : esUrgente ? '#ff6b6b' : '#ffc107') + ';' : ''}">
                        <div style="display: flex; flex-direction: column; width: 100%; gap: 2px; min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
                                ${ticket.estado === 'pendiente' ? '<span class="badge bg-danger d-md-none" style="font-size: 0.6rem; padding: 2px 5px; font-weight: 700; border-radius: 3px; flex-shrink: 0; line-height: 1.2;"><i class="fas fa-clock"></i></span>' : ''}
                                ${esUrgente ? '<i class="fas fa-exclamation-triangle text-danger d-md-none" style="font-size: 0.75rem; flex-shrink: 0;"></i>' : ''}
                                ${esVencido ? '<i class="fas fa-exclamation-circle text-danger d-md-none" style="font-size: 0.75rem; flex-shrink: 0;"></i>' : ''}
                                <span style="color: ${ticket.estado === 'pendiente' ? '#2c3e50' : '#6c757d'}; font-weight: ${ticket.estado === 'pendiente' ? '700' : '600'}; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; flex: 1; min-width: 0; font-size: 0.9rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${ticket.titulo}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; margin-top: 2px;">
                                <span class="d-md-none" style="font-size: 0.65rem; color: #6c757d; font-weight: 500; white-space: nowrap; flex-shrink: 0;">${nombreCreadorCorto}→${nombreAsignadoCorto}</span>
                                <span class="d-none d-md-inline" style="font-size: 0.75rem; color: #6c757d; font-weight: 500; white-space: nowrap; flex-shrink: 0;">${nombreCreadorCorto} → ${nombreAsignadoCorto}</span>
                                ${ticket.estado === 'pendiente' ? '<span class="badge bg-warning d-none d-md-inline-block" style="font-size: 0.6rem; padding: 2px 6px; font-weight: 700; border-radius: 3px; flex-shrink: 0;"><i class="fas fa-clock me-1"></i>PEND</span>' : ''}
                            </div>
                            <div class="d-none d-md-flex" style="gap: 4px; flex-wrap: wrap; align-items: center; margin-top: 2px;">
                                ${esUrgente ? `
                                    <span class="badge bg-danger" style="font-size: 0.65rem; padding: 3px 6px; font-weight: 600;">
                                        <i class="fas fa-fire me-1"></i>Urgente
                    </span>
                                ` : ''}
                                ${esVencido ? `
                                    <span class="badge bg-danger" style="font-size: 0.65rem; padding: 3px 6px; font-weight: 600;">
                                        <i class="fas fa-exclamation-circle me-1"></i>Vencido
                                    </span>
                                ` : diasRestantes !== null && diasRestantes <= 3 && diasRestantes >= 0 ? `
                                    <span class="badge bg-warning" style="font-size: 0.65rem; padding: 3px 6px; font-weight: 600;">
                                        <i class="fas fa-hourglass-half me-1"></i>${diasRestantes}d
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                        <div class="d-md-none" style="position: absolute; top: 6px; right: 8px; display: flex; gap: 2px; flex-direction: column; align-items: flex-end; z-index: 10;">
                            ${esUrgente ? `
                                <span class="badge bg-danger" style="font-size: 0.55rem; padding: 2px 4px; font-weight: 700; line-height: 1.1;">
                                    <i class="fas fa-fire" style="font-size: 0.5rem;"></i>
                                </span>
                            ` : ''}
                            ${esVencido ? `
                                <span class="badge bg-danger" style="font-size: 0.55rem; padding: 2px 4px; font-weight: 700; line-height: 1.1;">
                                    <i class="fas fa-exclamation-circle" style="font-size: 0.5rem;"></i>
                                </span>
                            ` : diasRestantes !== null && diasRestantes <= 3 && diasRestantes >= 0 ? `
                                <span class="badge bg-warning" style="font-size: 0.55rem; padding: 2px 4px; font-weight: 700; line-height: 1.1;">
                                    ${diasRestantes}d
                                </span>
                            ` : ''}
                        </div>
                        </button>
                </h2>
                <div id="${ticketAccordionId}" class="accordion-collapse collapse" aria-labelledby="heading${ticketAccordionId}" data-bs-parent="#${parentAccordionId}">
                    <div class="accordion-body" style="padding: 16px; background: white;">
                        <div class="ticket-descripcion" style="font-size: 0.95rem; margin-bottom: 14px; color: #495057; line-height: 1.6; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid #17a2b8; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; height: auto; min-height: auto;">
                            <i class="fas fa-align-left text-muted me-2" style="font-size: 0.85rem;"></i>
                            ${ticket.descripcion}
                        </div>
                        <div class="ticket-info" style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 16px;">
                            <div class="info-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                                <i class="fas fa-user text-primary" style="font-size: 1rem; width: 20px;"></i>
                                <span style="font-size: 0.9rem;"><strong style="color: #6c757d;">Asignado a:</strong> <span style="color: #2c3e50; font-weight: 600;">${nombreAsignado}</span></span>
                            </div>
                            <div class="info-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                                <i class="fas fa-user-plus text-info" style="font-size: 1rem; width: 20px;"></i>
                                <span style="font-size: 0.9rem;"><strong style="color: #6c757d;">Creado por:</strong> <span style="color: #2c3e50; font-weight: 600;">${nombreCreador}</span></span>
                            </div>
                            <div class="info-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
                                <i class="fas fa-calendar text-success" style="font-size: 1rem; width: 20px;"></i>
                                <span style="font-size: 0.9rem;"><strong style="color: #6c757d;">Creado:</strong> <span style="color: #2c3e50; font-weight: 600;">${formatearFechaCreacion(ticket.fechaCreacion)}</span></span>
                            </div>
                            ${ticket.fechaVencimiento ? `
                                <div class="info-item ${esVencido ? 'text-danger' : diasRestantes !== null && diasRestantes <= 3 ? 'text-warning' : ''}" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: ${esVencido ? '#fff5f5' : diasRestantes !== null && diasRestantes <= 3 ? '#fffbf0' : '#f8f9fa'}; border-radius: 6px; border-left: 3px solid ${esVencido ? '#dc3545' : diasRestantes !== null && diasRestantes <= 3 ? '#ffc107' : '#17a2b8'};">
                                    <i class="fas fa-clock ${esVencido ? 'text-danger' : diasRestantes !== null && diasRestantes <= 3 ? 'text-warning' : 'text-info'}" style="font-size: 1rem; width: 20px;"></i>
                                    <span style="font-size: 0.9rem; font-weight: ${esVencido || (diasRestantes !== null && diasRestantes <= 3) ? '600' : 'normal'};">
                                        <strong style="color: #6c757d;">Vence:</strong> 
                                        <span style="color: ${esVencido ? '#dc3545' : diasRestantes !== null && diasRestantes <= 3 ? '#ff9800' : '#2c3e50'};">
                                            ${formatearVencimiento(ticket.fechaVencimiento)}
                                            ${diasRestantes !== null && !esVencido ? ` (${diasRestantes > 0 ? `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}` : 'Hoy'})` : ''}
                                        </span>
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="ticket-acciones" style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                            <button class="btn btn-primary btn-sm" onclick="verTicket('${ticket.id}')" style="font-size: 0.9rem; padding: 8px 16px; border-radius: 8px; font-weight: 600;" title="Ver detalles">
                                <i class="fas fa-eye me-1"></i>Ver Detalles
                            </button>
                            ${puedoEditar ? `
                                <button class="btn btn-warning btn-sm" onclick="abrirEditarTicket('${ticket.id}')" style="font-size: 0.9rem; padding: 8px 16px; border-radius: 8px; font-weight: 600;" title="Editar">
                                    <i class="fas fa-edit me-1"></i>Editar
                            </button>
                        ` : ''}
                            ${ticket.estado === 'pendiente' && ticket.asignadoA === currentUser.username ? `
                                <button class="btn btn-success btn-sm" onclick="abrirResolverTicket('${ticket.id}')" style="font-size: 0.95rem; padding: 10px 20px; border-radius: 8px; font-weight: 700; box-shadow: 0 2px 6px rgba(40, 167, 69, 0.3); transition: all 0.2s;" title="Marcar esta tarea como completada" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 10px rgba(40, 167, 69, 0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 6px rgba(40, 167, 69, 0.3)';">
                                    <i class="fas fa-check-circle me-2"></i>Marcar como Completada
                            </button>
                        ` : ''}
                    </div>
                    </div>
                </div>
            </div>
        `;
    };
    
    // Separar en pendientes y completados para cada categoría
    const misCreadosPendientes = misTicketsCreados.filter(t => t.estado === 'pendiente');
    const misCreadosCompletados = misTicketsCreados.filter(t => t.estado === 'completada');
    const misAsignadosCompletados = misTicketsAsignados.filter(t => t.estado === 'completada');
    const otrosPendientes = otrosTickets.filter(t => t.estado === 'pendiente');
    const otrosCompletados = otrosTickets.filter(t => t.estado === 'completada');
    
    // Construir HTML
    let html = '';
    
    // Separar pendientes en vencidas, on time, y sin fecha
    // Incluir tickets asignados a mí (incluso si yo los creé y me auto-asigné)
    const misAsignadosPendientes = ticketsAMostrar.filter(t => 
        t.estado === 'pendiente' && 
        t.asignadoA === currentUser.username
    );
    const misAsignadosPendientesVencidas = misAsignadosPendientes.filter(t => esTicketVencido(t));
    const misAsignadosPendientesConFecha = misAsignadosPendientes.filter(t => !esTicketVencido(t) && t.fechaVencimiento);
    const misAsignadosPendientesSinFecha = misAsignadosPendientes.filter(t => !t.fechaVencimiento);
    // Todas las que no están vencidas (con fecha o sin fecha)
    const misAsignadosPendientesOnTime = [...misAsignadosPendientesConFecha, ...misAsignadosPendientesSinFecha];
    
    // 1. TICKETS ASIGNADOS A MÍ - SOLO PENDIENTES (colapsable, expandido por defecto)
    html += `
        <div class="mb-4">
            <div class="accordion" id="accordionTareasPendientes" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div class="accordion-item" style="border: none;">
                    <h2 class="accordion-header">
                        <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTareasPendientes" style="font-size: 1rem; font-weight: 600; background: #ea0e2a; color: white; border: none; border-radius: 12px; padding: 1rem 1.5rem; box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25), inset 0 2px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(0, 0, 0, 0.2); position: relative;">
                            <i class="fas fa-exclamation-circle me-2" style="font-size: 1.2rem; color: white;"></i>
                            <span style="font-weight: 600;">Mis Tareas Pendientes</span>
                            ${misAsignadosPendientes.length > 0 ? `
                                <span class="badge ms-2" style="font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 6px; font-weight: 600; background: #ffcdd2; color: #000000;">
                                    ${misAsignadosPendientes.length} ${misAsignadosPendientes.length === 1 ? 'tarea' : 'tareas'}
                                </span>
                            ` : ''}
                            <i class="fas fa-chevron-down icon-expand-pulse" style="font-size: 1.8rem; color: white; position: absolute; right: 1.5rem; top: 1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;"></i>
                        </button>
                    </h2>
                    <div id="collapseTareasPendientes" class="accordion-collapse collapse show" data-bs-parent="#accordionTareasPendientes">
                        <div class="accordion-body" style="background: #f8f9fa; padding: 20px;">
                            ${misAsignadosPendientes.length > 0 ? `
                                ${misAsignadosPendientesVencidas.length > 0 ? `
                                    <div class="mb-4">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #dc3545; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-exclamation-triangle"></i>
                                            <span>Vencidas (${misAsignadosPendientesVencidas.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionTicketsVencidas">
                                            ${misAsignadosPendientesVencidas.map(t => renderTicketCard(t, 'accordionTicketsVencidas')).join('')}
                    </div>
                    </div>
                                ` : ''}
                                ${misAsignadosPendientesConFecha.length > 0 ? `
                                    <div class="mb-4">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #ffc107; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-clock"></i>
                                            <span>A Tiempo (${misAsignadosPendientesConFecha.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionTicketsOnTime">
                                            ${misAsignadosPendientesConFecha.map(t => renderTicketCard(t, 'accordionTicketsOnTime')).join('')}
                </div>
                                    </div>
                                ` : ''}
                                ${misAsignadosPendientesSinFecha.length > 0 ? `
                                    <div class="mb-3">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #17a2b8; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-calendar-alt"></i>
                                            <span>Sin Fecha de Vencimiento (${misAsignadosPendientesSinFecha.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionTicketsSinFecha">
                                            ${misAsignadosPendientesSinFecha.map(t => renderTicketCard(t, 'accordionTicketsSinFecha')).join('')}
                </div>
                                    </div>
                                ` : ''}
                            ` : `
                                <div style="text-align: center; padding: 1rem; background: #ffffff; border-radius: 8px;">
                                    <i class="fas fa-check-circle" style="font-size: 1.2rem; color: #0b7835; opacity: 0.7; margin-bottom: 0.5rem;"></i>
                                    <p style="font-size: 1rem; color: #000000; margin: 0; font-weight: 600;">¡Excelente! No tienes tareas pendientes</p>
                                    <p style="font-size: 0.9rem; color: #000000; margin-top: 0.5rem; font-weight: 400;">Todo está al día</p>
                    </div>
                            `}
                </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 1b. TAREAS COMPLETADAS (colapsado, solo si hay completadas)
    if (misAsignadosCompletados.length > 0) {
        html += `
            <div class="mb-4">
                <div class="accordion" id="accordionTareasCompletadas" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div class="accordion-item" style="border: none;">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTareasCompletadas" style="font-size: 1.2rem; font-weight: 800; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); color: #155724; border: none; padding: 18px 20px;">
                                <i class="fas fa-check-circle me-2" style="font-size: 1.4rem;"></i>
                                <span>Mis Tareas Completadas</span>
                                <span class="badge bg-success ms-2" style="font-size: 0.9rem; padding: 6px 12px; border-radius: 20px; font-weight: 700;">${misAsignadosCompletados.length}</span>
                            </button>
                        </h2>
                        <div id="collapseTareasCompletadas" class="accordion-collapse collapse" data-bs-parent="#accordionTareasCompletadas">
                            <div class="accordion-body" style="background: #f8f9fa; padding: 20px;">
                                <div class="accordion" id="accordionTicketsCompletadas">
                                    ${misAsignadosCompletados.map(t => renderTicketCard(t, 'accordionTicketsCompletadas')).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 2. MIS TICKETS CREADOS (colapsado)
    if (misTicketsCreados.length > 0) {
        html += `
        <div class="mb-4">
                <div class="accordion" id="accordionMisCreados" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div class="accordion-item" style="border: none;">
                    <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseMisCreados" style="font-size: 1rem; font-weight: 600; background: #fbdc02; color: #000000; border: none; border-radius: 12px; padding: 1rem 1.5rem; box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25), inset 0 2px 0 rgba(255, 255, 255, 0.25), inset 0 -1px 0 rgba(0, 0, 0, 0.2); position: relative;">
                                <span style="font-weight: 600;">Tickets que Yo Creé</span>
                                <span class="badge ms-2" style="font-size: 0.85rem; padding: 0.5rem 0.75rem; border-radius: 6px; font-weight: 600; background: #fff9c4; color: #000000;">${misTicketsCreados.length}</span>
                                <i class="fas fa-chevron-down icon-expand-pulse" style="font-size: 1.8rem; color: #000000; position: absolute; right: 1.5rem; top: 1rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center;"></i>
                        </button>
                    </h2>
                        <div id="collapseMisCreados" class="accordion-collapse collapse" data-bs-parent="#accordionMisCreados">
                            <div class="accordion-body" style="background: #f8f9fa; padding: 20px;">
                                ${misCreadosPendientes.length > 0 ? `
                                    <div class="mb-4">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #ff9800; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-clock"></i>
                                            <span>Pendientes (${misCreadosPendientes.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionTicketsCreadosPendientes">
                                            ${misCreadosPendientes.map(t => renderTicketCard(t, 'accordionTicketsCreadosPendientes')).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                                ${misCreadosCompletados.length > 0 ? `
                                    <div class="mb-3">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #28a745; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-check-circle"></i>
                                            <span>Completados (${misCreadosCompletados.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionTicketsCreadosCompletados">
                                            ${misCreadosCompletados.map(t => renderTicketCard(t, 'accordionTicketsCreadosCompletados')).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 3. OTROS TICKETS (colapsado)
    if (otrosPendientes.length > 0 || otrosCompletados.length > 0) {
        html += `
            <div class="mb-4">
                <div class="accordion" id="accordionOtrosTickets" style="border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div class="accordion-item" style="border: none;">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOtrosTickets" style="font-size: 1.2rem; font-weight: 800; background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); color: #7b1fa2; border: none; padding: 18px 20px; position: relative;">
                                <i class="fas fa-users me-2" style="font-size: 1.4rem;"></i>
                                <span>Tickets de Otros Empleados</span>
                                <span class="badge bg-secondary ms-2" style="font-size: 0.9rem; padding: 6px 12px; border-radius: 20px; font-weight: 700;">${otrosPendientes.length + otrosCompletados.length}</span>
                                <i class="fas fa-chevron-down icon-expand-pulse" style="position: absolute; top: 12px; right: 20px; font-size: 1.8rem; transition: transform 0.3s ease;"></i>
                            </button>
                        </h2>
                        <div id="collapseOtrosTickets" class="accordion-collapse collapse" data-bs-parent="#accordionOtrosTickets">
                            <div class="accordion-body" style="background: #f8f9fa; padding: 20px;">
                                ${otrosPendientes.length > 0 ? `
                                    <div class="mb-4">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #ff9800; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-clock"></i>
                                            <span>Pendientes (${otrosPendientes.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionOtrosPendientes">
                                            ${otrosPendientes.map(t => renderTicketCard(t, 'accordionOtrosPendientes')).join('')}
                                        </div>
                                    </div>
                                                        ` : ''}
                                ${otrosCompletados.length > 0 ? `
                                    <div class="mb-3">
                                        <h6 class="mb-3" style="font-size: 1rem; font-weight: 700; color: #28a745; display: flex; align-items: center; gap: 8px;">
                                            <i class="fas fa-check-circle"></i>
                                            <span>Completados (${otrosCompletados.length})</span>
                                        </h6>
                                        <div class="accordion" id="accordionOtrosCompletados">
                                            ${otrosCompletados.map(t => renderTicketCard(t, 'accordionOtrosCompletados')).join('')}
                                                    </div>
                            </div>
                                ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }
    
    container.innerHTML = html;
}

// Filtrar tickets
function filtrarTickets() {
    const estado = document.getElementById('filtroEstado').value;
    const prioridad = document.getElementById('filtroPrioridad').value;
    const asignado = document.getElementById('filtroAsignado').value;
    const creador = document.getElementById('filtroCreador').value;
    
    let ticketsFiltrados = [...tickets];
    
    if (estado) {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.estado === estado);
    }
    
    if (prioridad) {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.prioridad === prioridad);
    }
    
    if (asignado) {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.asignadoA === asignado);
    }
    
    if (creador) {
        ticketsFiltrados = ticketsFiltrados.filter(t => t.creadoPor === creador);
    }
    
    mostrarTickets(ticketsFiltrados);
}

// Crear ticket
async function crearTicket() {
    try {
        const titulo = document.getElementById('tituloTicket').value;
        const descripcion = document.getElementById('descripcionTicket').value;
        const asignadoA = document.getElementById('asignadoTicket').value;
        const prioridad = document.getElementById('prioridadTicket').value;
        const vencimiento = document.getElementById('vencimientoTicket').value;
        const fotosInput = document.getElementById('fotosTicket');
        
        // Validaciones mejoradas
        if (!titulo || titulo.trim().length < 3) {
            mostrarMensaje('El título debe tener al menos 3 caracteres', 'warning');
            return;
        }
        
        if (!descripcion || descripcion.trim().length < 10) {
            mostrarMensaje('La descripción debe tener al menos 10 caracteres', 'warning');
            return;
        }
        
        if (!asignadoA) {
            mostrarMensaje('Debe seleccionar a quién asignar el ticket', 'warning');
            return;
        }
        
        // Validar fecha de vencimiento (obligatoria)
        if (!vencimiento) {
            mostrarMensaje('La fecha de vencimiento es obligatoria', 'warning');
            return;
        }
        
        // Configurar fecha de vencimiento automática a las 23:59
            const fechaSeleccionada = new Date(vencimiento);
            fechaSeleccionada.setHours(23, 59, 59, 999); // 23:59:59.999
        const fechaVencimiento = fechaSeleccionada;

        // Procesar fotos si hay
        let fotosUrls = [];
        if (fotosInput.files && fotosInput.files.length > 0) {
            mostrarMensaje('Comprimiendo y subiendo fotos...', 'info');
            
            // Deshabilitar botón mientras se procesan las fotos
            const btnCrear = document.querySelector('#modalNuevoTicket .btn-primary');
            const textoOriginal = btnCrear.innerHTML;
            btnCrear.disabled = true;
            btnCrear.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando fotos...';
            
            try {
                fotosUrls = await comprimirYSubirFotos(Array.from(fotosInput.files));
                console.log(`✅ ${fotosUrls.length} foto(s) subida(s) exitosamente`);
            } catch (error) {
                console.error('❌ Error procesando fotos:', error);
                mostrarMensaje('Error al procesar algunas fotos. El ticket se creará sin ellas.', 'warning');
            }
            
            // Restaurar botón
            btnCrear.disabled = false;
            btnCrear.innerHTML = textoOriginal;
        }

        // Verificar si se seleccionó un usuario de gerencia para crear el ticket a su nombre
        const creadoPorGerencia = document.getElementById('creadoPorGerencia')?.value || '';
        let creadorFinal = currentUser.username;
        let creadorNombreFinal = currentUser.nombre;
        
        // Si se seleccionó un usuario de gerencia, usar ese como creador
        if (creadoPorGerencia && creadoPorGerencia.trim() !== '') {
            const empleadoGerencia = empleados.find(e => e.username === creadoPorGerencia);
            if (empleadoGerencia) {
                creadorFinal = empleadoGerencia.username;
                creadorNombreFinal = `${empleadoGerencia.primerNombre} ${empleadoGerencia.primerApellido}`;
                console.log('[TICKETS] 📝 Creando ticket a nombre de gerencia', {
                    creadorOriginal: currentUser.username,
                    creadorFinal: creadorFinal,
                    creadorNombreFinal: creadorNombreFinal
                });
            }
        }
        
        const ticketData = {
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            creadoPor: creadorFinal,
            creadoPorNombre: creadorNombreFinal,
            asignadoA: asignadoA,
            asignadoANombre: empleados.find(e => e.username === asignadoA)?.primerNombre + ' ' + empleados.find(e => e.username === asignadoA)?.primerApellido,
            estado: 'pendiente',
            prioridad: prioridad,
            fechaCreacion: serverTimestamp(),
            fechaVencimiento: fechaVencimiento,
            comentarios: [],
            fotos: fotosUrls // Array de URLs de las fotos
        };
        
        // Agregar token CSRF antes de crear ticket
        if (window.csrfProtection) {
            window.csrfProtection.addTokenToData(ticketData);
        }
        
        await addDoc(collection(db, 'tickets'), ticketData);
        
        // Limpiar formulario
        document.getElementById('formNuevoTicket').reset();
        fotosSeleccionadasTicket = [];
        fotosPreviewUrls = [];
        document.getElementById('previewFotosTicket').innerHTML = '';
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoTicket'));
        modal.hide();
        
        // Recargar datos
        await cargarTickets();
        mostrarEstadisticas();
        mostrarTickets();
        
        // Actualizar badge
        actualizarBadgeTickets();
        
        mostrarMensaje('Ticket creado exitosamente' + (fotosUrls.length > 0 ? ` con ${fotosUrls.length} foto(s)` : ''), 'success');
        
    } catch (error) {
        console.error('❌ Error creando ticket:', error);
        mostrarMensaje('Error creando el ticket', 'danger');
    }
}

// Variables para almacenar fotos seleccionadas
let fotosSeleccionadasTicket = [];
let fotosPreviewUrls = [];
let fotosSeleccionadasResolucion = [];
let fotosPreviewUrlsResolucion = [];

// Preview de fotos antes de subir
window.previewFotosTicket = function() {
    const input = document.getElementById('fotosTicket');
    const previewContainer = document.getElementById('previewFotosTicket');
    
    if (!input.files || input.files.length === 0) {
        previewContainer.innerHTML = '';
        fotosSeleccionadasTicket = [];
        fotosPreviewUrls = [];
        return;
    }
    
    previewContainer.innerHTML = '';
    fotosSeleccionadasTicket = Array.from(input.files);
    fotosPreviewUrls = [];
    
    fotosSeleccionadasTicket.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const url = e.target.result;
            fotosPreviewUrls.push(url);
            
            const previewDiv = document.createElement('div');
            previewDiv.className = 'foto-preview-container';
            previewDiv.innerHTML = `
                <img src="${url}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-foto" onclick="removerFotoTicket(${index})" title="Eliminar foto">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewDiv);
        };
        reader.readAsDataURL(file);
    });
};

// Remover foto del preview
window.removerFotoTicket = function(index) {
    fotosSeleccionadasTicket.splice(index, 1);
    fotosPreviewUrls.splice(index, 1);
    
    // Actualizar input file
    const input = document.getElementById('fotosTicket');
    const dt = new DataTransfer();
    fotosSeleccionadasTicket.forEach(file => dt.items.add(file));
    input.files = dt.files;
    
    // Actualizar preview
    previewFotosTicket();
};

// Preview de fotos de resolución antes de subir
window.previewFotosResolucion = function() {
    const input = document.getElementById('fotosResolucion');
    const previewContainer = document.getElementById('previewFotosResolucion');
    
    if (!input || !previewContainer) return;
    
    if (!input.files || input.files.length === 0) {
        previewContainer.innerHTML = '';
        fotosSeleccionadasResolucion = [];
        fotosPreviewUrlsResolucion = [];
        return;
    }
    
    previewContainer.innerHTML = '';
    fotosSeleccionadasResolucion = Array.from(input.files);
    fotosPreviewUrlsResolucion = [];
    
    fotosSeleccionadasResolucion.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const url = e.target.result;
            fotosPreviewUrlsResolucion.push(url);
            
            const previewDiv = document.createElement('div');
            previewDiv.className = 'foto-preview-container';
            previewDiv.innerHTML = `
                <img src="${url}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-foto" onclick="removerFotoResolucion(${index})" title="Eliminar foto">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(previewDiv);
        };
        reader.readAsDataURL(file);
    });
};

// Remover foto de resolución del preview
window.removerFotoResolucion = function(index) {
    fotosSeleccionadasResolucion.splice(index, 1);
    fotosPreviewUrlsResolucion.splice(index, 1);
    
    // Actualizar input file
    const input = document.getElementById('fotosResolucion');
    const dt = new DataTransfer();
    fotosSeleccionadasResolucion.forEach(file => dt.items.add(file));
    input.files = dt.files;
    
    // Actualizar preview
    previewFotosResolucion();
};

// Comprimir y subir fotos a Firebase Storage
async function comprimirYSubirFotos(files) {
    if (!files || files.length === 0) return [];
    
    // Verificar que el usuario esté autenticado en Firebase Auth (requerido para Storage)
    const firebaseAuthUser = auth?.currentUser || window.firebaseAuth?.currentUser;
    if (!firebaseAuthUser) {
        console.error('❌ Usuario no autenticado en Firebase Auth, no se pueden subir archivos');
        console.error('   auth.currentUser:', auth?.currentUser);
        console.error('   window.firebaseAuth.currentUser:', window.firebaseAuth?.currentUser);
        throw new Error('Debe estar autenticado en Firebase Auth para subir archivos. Por favor, cierra sesión y vuelve a iniciar sesión.');
    }
    
    console.log('✅ Usuario autenticado en Firebase Auth:', {
        uid: firebaseAuthUser.uid,
        email: firebaseAuthUser.email
    });
    
    // Verificar también que currentUser esté disponible
    if (!currentUser) {
        currentUser = await obtenerUsuarioAutenticado();
    }
    
    if (!currentUser) {
        console.error('❌ Usuario no autenticado en el sistema, no se pueden subir archivos');
        throw new Error('Debe estar autenticado para subir archivos');
    }
    const fotosUrls = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            // Comprimir imagen
            const options = {
                maxSizeMB: 0.5, // Tamaño máximo 500KB
                maxWidthOrHeight: 1920, // Ancho/alto máximo
                useWebWorker: true,
                fileType: 'image/jpeg', // Convertir a JPEG para mejor compresión
                initialQuality: 0.85 // Calidad inicial (85% - buen balance calidad/tamaño)
            };
            
            const compressedFile = await imageCompression(file, options);
            console.log(`✅ Foto ${i + 1} comprimida: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Generar nombre único para el archivo
            // Usar estructura: clientes/{clienteId}/{archivo}
            // Nota: Todos los empleados autenticados pueden ver todos los archivos en /clientes/
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            // Usar un identificador genérico para tickets (todos los empleados pueden ver)
            const fileName = `clientes/tickets/${timestamp}_${randomId}.jpg`;
            
            // Subir a Firebase Storage
            // Asegurar que Storage use la misma instancia de Auth
            // Usar la instancia de Auth global si está disponible (más confiable)
            const authInstance = window.firebaseAuth || auth;
            const currentAuthUser = authInstance?.currentUser;
            
            if (!currentAuthUser) {
                throw new Error('No hay usuario autenticado en Firebase Auth. Por favor, cierra sesión y vuelve a iniciar sesión.');
            }
            
            // Asegurar que Storage use la misma app que Auth
            // SIEMPRE usar la app de window.firebaseAuth si está disponible
            // Esto es crítico para que el token de Auth se envíe correctamente
            let storageInstance = storage;
            if (window.firebaseAuth && window.firebaseAuth.app) {
                storageInstance = getStorage(window.firebaseAuth.app);
                console.log('✅ Usando Storage de window.firebaseAuth.app');
            } else if (authInstance && authInstance.app) {
                // Si window.firebaseAuth no está disponible, usar la app de authInstance
                storageInstance = getStorage(authInstance.app);
                console.log('✅ Usando Storage de authInstance.app');
            } else {
                console.warn('⚠️ No se puede obtener la app de Auth, usando storage local');
            }
            const storageRef = ref(storageInstance, fileName);
            
            console.log('📤 Subiendo archivo a Storage:', {
                path: fileName,
                uid: currentAuthUser.uid,
                email: currentAuthUser.email,
                authInstance: authInstance === window.firebaseAuth ? 'window.firebaseAuth' : 'local auth',
                storageInstance: storageInstance === storage ? 'local storage' : 'auth app storage',
                storageApp: storageInstance.app?.name || 'unknown',
                authApp: authInstance.app?.name || 'unknown',
                sameApp: storageInstance.app?.name === authInstance.app?.name
            });
            
            await uploadBytes(storageRef, compressedFile);
            
            // Obtener URL de descarga
            const downloadURL = await getDownloadURL(storageRef);
            fotosUrls.push(downloadURL);
            
        } catch (error) {
            console.error(`❌ Error procesando foto ${i + 1}:`, error);
            // Continuar con las demás fotos aunque una falle
        }
    }
    
    return fotosUrls;
}

// Ver ticket
function verTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const creador = empleados.find(e => e.username === ticket.creadoPor);
    const asignado = empleados.find(e => e.username === ticket.asignadoA);
    const esVencido = ticket.fechaVencimiento && new Date(ticket.fechaVencimiento) < new Date();
    const esMio = currentUser && currentUser.username; // Cualquier usuario autenticado puede editar
    
    const html = `
        <div class="ticket-detail">
            <div class="ticket-detail-header">
                <h5>${ticket.titulo}</h5>
                <div class="ticket-badges">
                    <span class="badge bg-${ticket.prioridad === 'urgente' ? 'danger' : 'info'}">${ticket.prioridad.toUpperCase()}</span>
                    <span class="badge bg-${ticket.estado === 'completada' ? 'success' : 'warning'}">${ticket.estado.toUpperCase()}</span>
                    ${esVencido ? '<span class="badge bg-danger">VENCIDO</span>' : ''}
                </div>
            </div>
            
            <div class="ticket-detail-content">
                <p><strong>Descripción:</strong></p>
                <p>${ticket.descripcion}</p>
                
                <div class="ticket-detail-info">
                    <div class="row g-2">
                        <div class="col-6">
                            <strong>Creado por:</strong><br>
                            ${creador ? `${creador.primerNombre} ${creador.primerApellido}` : 'Desconocido'}
                        </div>
                        <div class="col-6">
                            <strong>Asignado a:</strong><br>
                            ${asignado ? `${asignado.primerNombre} ${asignado.primerApellido}` : 'Desconocido'}
                        </div>
                        <div class="col-6">
                            <strong>Fecha de creación:</strong><br>
                            ${formatearFecha(ticket.fechaCreacion)}
                        </div>
                        <div class="col-6">
                            <strong>Estado:</strong><br>
                            ${ticket.estado.toUpperCase()}
                        </div>
                        ${ticket.fechaVencimiento ? `
                            <div class="col-6">
                                <strong>Fecha de vencimiento:</strong><br>
                                <span class="${esVencido ? 'text-danger' : ''}">${formatearFecha(ticket.fechaVencimiento)}</span>
                            </div>
                        ` : ''}
                        ${ticket.fechaResolucion ? `
                            <div class="col-6">
                                <strong>Fecha de resolución:</strong><br>
                                ${formatearFecha(ticket.fechaResolucion)}
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${ticket.fotos && ticket.fotos.length > 0 ? `
                    <div class="ticket-fotos-container">
                        <h6><i class="fas fa-images me-2"></i>Fotos Adjuntas (${ticket.fotos.length})</h6>
                        <div class="ticket-fotos-grid">
                            ${ticket.fotos.map((fotoUrl, index) => `
                                <div class="ticket-foto-item" onclick="abrirFotoModal('${fotoUrl}')">
                                    <img src="${fotoUrl}" alt="Foto ${index + 1}" loading="lazy">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${ticket.comentarios && ticket.comentarios.length > 0 ? `
                    <div class="ticket-comentarios mt-3">
                        <h6>Comentarios:</h6>
                        ${ticket.comentarios.map(comentario => `
                            <div class="comentario-item">
                                <div class="comentario-header">
                                    <strong>${comentario.autor}</strong>
                                    <small class="text-muted">${formatearFecha(comentario.fecha)}</small>
                                </div>
                                <div class="comentario-content">${comentario.texto}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('contenidoTicket').innerHTML = html;
    
    // Botones
    const botones = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
        ${ticket.estado === 'pendiente' && esMio ? `
            <button type="button" class="btn btn-success btn-lg" onclick="abrirResolverTicket('${ticket.id}')" style="font-weight: 700; padding: 12px 24px; box-shadow: 0 3px 8px rgba(40, 167, 69, 0.4);">
                <i class="fas fa-check-circle me-2"></i>Marcar como Completada
            </button>
        ` : ''}
    `;
    
    document.getElementById('botonesTicket').innerHTML = botones;
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalVerTicket'));
    modal.show();
}

// Abrir foto en modal grande
window.abrirFotoModal = function(fotoUrl) {
    document.getElementById('fotoGrandeImg').src = fotoUrl;
    const modal = new bootstrap.Modal(document.getElementById('modalFotoGrande'));
    modal.show();
}

// Función para calcular tickets pendientes y actualizar badge (funciona desde cualquier página)
async function actualizarBadgeTickets() {
    try {
        // Obtener usuario actual desde authManager si no está disponible localmente
        const user = currentUser || (window.authManager ? window.authManager.getCurrentUser() : null);
        if (!user || !user.username) {
            return;
        }
        
        // Cargar tickets actualizados desde Firestore
        let ticketsActualizados = [];
        try {
            // Usar la instancia de db disponible o crear una nueva
            let dbInstance = db;
            if (!dbInstance && window.firebase) {
                // Intentar obtener db desde Firebase si está disponible globalmente
                const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
                dbInstance = getFirestore();
            }
            
            if (dbInstance) {
                const ticketsQuery = query(collection(dbInstance, 'tickets'), orderBy('fechaCreacion', 'desc'));
                const querySnapshot = await getDocs(ticketsQuery);
                querySnapshot.forEach(doc => {
                    ticketsActualizados.push({ id: doc.id, ...doc.data() });
                });
            } else {
                // Si no hay db disponible, usar tickets locales si existen
                ticketsActualizados = tickets || [];
            }
        } catch (error) {
            console.error('Error cargando tickets para badge:', error);
            // Si falla, usar tickets locales si existen
            ticketsActualizados = tickets || [];
        }
        
        // Calcular tickets pendientes - SOLO los asignados a mí
        const ticketsAsignadosPendientes = ticketsActualizados.filter(t => 
            t.asignadoA === user.username && 
            t.estado === 'pendiente'
        );
        
        const totalPendientes = ticketsAsignadosPendientes.length;
        
        // Actualizar badge en el header
        actualizarBadgeEnHeader(totalPendientes);
        
        // Actualizar badge en el footer móvil
        actualizarBadgeEnFooter(totalPendientes);
        
    } catch (error) {
        console.error('❌ Error actualizando badge de tickets:', error);
    }
}

// Función para actualizar badge en el header
function actualizarBadgeEnHeader(count) {
    // Buscar el elemento de tickets en el header
    const ticketsNavItem = document.querySelector('.mobile-nav-item[href="tickets.html"], .mobile-nav-item[data-permission="tickets"]');
    
    if (!ticketsNavItem) {
        return;
    }
    
    // Remover badge existente si existe
    const badgeExistente = ticketsNavItem.querySelector('.tickets-badge');
    if (badgeExistente) {
        badgeExistente.remove();
    }
    
    // Agregar badge si hay tickets pendientes
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'tickets-badge';
        badge.textContent = count > 99 ? '99+' : count.toString();
        // Ajustar tamaño según el número de dígitos
        if (count >= 10) {
            badge.style.minWidth = '32px';
            badge.style.height = '32px';
            badge.style.fontSize = '16px';
        }
        ticketsNavItem.appendChild(badge);
    }
}

// Función para actualizar badge en el footer móvil
function actualizarBadgeEnFooter(count) {
    // Buscar el botón de tickets en el footer
    const ticketsFooterBtn = document.querySelector('.footer-button[href="tickets.html"], .footer-button[href*="tickets"]');
    
    if (!ticketsFooterBtn) {
        return;
    }
    
    // Remover badge existente si existe
    const badgeExistente = ticketsFooterBtn.querySelector('.tickets-badge');
    if (badgeExistente) {
        badgeExistente.remove();
    }
    
    // Agregar badge si hay tickets pendientes
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'tickets-badge';
        badge.textContent = count > 99 ? '99+' : count.toString();
        // Ajustar tamaño según el número de dígitos
        if (count >= 10) {
            badge.style.minWidth = '32px';
            badge.style.height = '32px';
            badge.style.fontSize = '16px';
        }
        ticketsFooterBtn.appendChild(badge);
    }
}

// Hacer función global para que pueda ser llamada desde otras páginas
window.actualizarBadgeTickets = actualizarBadgeTickets;

// Abrir modal para resolver ticket
function abrirResolverTicket(ticketId) {
    window.ticketIdAResolver = ticketId;
    document.getElementById('comentarioResolucion').value = '';
    
    // Limpiar fotos de resolución
    fotosSeleccionadasResolucion = [];
    fotosPreviewUrlsResolucion = [];
    const fotosInput = document.getElementById('fotosResolucion');
    if (fotosInput) {
        fotosInput.value = '';
    }
    const previewContainer = document.getElementById('previewFotosResolucion');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    
    // Cerrar modal actual
    const modalActual = bootstrap.Modal.getInstance(document.getElementById('modalVerTicket'));
    if (modalActual) modalActual.hide();
    
    // Mostrar modal de resolución
    const modal = new bootstrap.Modal(document.getElementById('modalResolverTicket'));
    modal.show();
}

// Resolver ticket
async function resolverTicket() {
    try {
        const ticketId = window.ticketIdAResolver;
        const comentario = document.getElementById('comentarioResolucion').value;
        const fotosInput = document.getElementById('fotosResolucion');
        
        if (!comentario.trim()) {
            mostrarMensaje('Por favor agrega un comentario de resolución', 'warning');
            return;
        }
        
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;
        
        // Procesar fotos de resolución si hay
        let fotosResolucionUrls = [];
        if (fotosInput.files && fotosInput.files.length > 0) {
            mostrarMensaje('Comprimiendo y subiendo fotos de resolución...', 'info');
            
            // Deshabilitar botón mientras se procesan las fotos
            const btnResolver = document.querySelector('#modalResolverTicket .btn-success');
            const textoOriginal = btnResolver.innerHTML;
            btnResolver.disabled = true;
            btnResolver.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Procesando fotos...';
            
            try {
                fotosResolucionUrls = await comprimirYSubirFotos(Array.from(fotosInput.files));
                console.log(`✅ ${fotosResolucionUrls.length} foto(s) de resolución subida(s) exitosamente`);
            } catch (error) {
                console.error('❌ Error procesando fotos de resolución:', error);
                mostrarMensaje('Error al procesar algunas fotos. El ticket se resolverá sin ellas.', 'warning');
            }
            
            // Restaurar botón
            btnResolver.disabled = false;
            btnResolver.innerHTML = textoOriginal;
        }
        
        const comentarioResolucion = {
            autor: currentUser.nombre,
            autorUsername: currentUser.username,
            texto: comentario.trim(),
            fecha: new Date(),
            tipo: 'resolucion'
        };
        
        const comentariosActualizados = [...(ticket.comentarios || []), comentarioResolucion];
        
        // Combinar fotos existentes con fotos de resolución
        const fotosExistentes = ticket.fotos || [];
        const todasLasFotos = [...fotosExistentes, ...fotosResolucionUrls];
        
        // Preparar datos de actualización con token CSRF
        const updateData = {
            estado: 'completada',
            fechaResolucion: serverTimestamp(),
            comentarios: comentariosActualizados,
            fotos: todasLasFotos, // Actualizar array de fotos con las nuevas
            fotosResolucion: fotosResolucionUrls // Guardar también las fotos de resolución por separado
        };
        
        // Agregar token CSRF antes de actualizar
        if (window.csrfProtection) {
            window.csrfProtection.addTokenToData(updateData);
        }
        
        await updateDoc(doc(db, 'tickets', ticketId), updateData);
        
        // Limpiar formulario
        document.getElementById('formResolverTicket').reset();
        fotosSeleccionadasResolucion = [];
        fotosPreviewUrlsResolucion = [];
        document.getElementById('previewFotosResolucion').innerHTML = '';
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalResolverTicket'));
        modal.hide();
        
        // Recargar datos
        await cargarTickets();
        mostrarEstadisticas();
        mostrarTickets();
        
        // Actualizar badge
        actualizarBadgeTickets();
        
        mostrarMensaje('Ticket resuelto exitosamente' + (fotosResolucionUrls.length > 0 ? ` con ${fotosResolucionUrls.length} foto(s)` : ''), 'success');
        
    } catch (error) {
        console.error('❌ Error resolviendo ticket:', error);
        mostrarMensaje('Error resolviendo el ticket', 'danger');
    }
}

// Abrir modal para editar ticket
function abrirEditarTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    // Verificar que el usuario esté autenticado
    if (!currentUser || !currentUser.username) {
        mostrarMensaje('Debes estar autenticado para editar tickets', 'warning');
        return;
    }
    
    // Llenar opciones de empleados en el modal de edición
    const editAsignadoTicket = document.getElementById('editAsignadoTicket');
    editAsignadoTicket.innerHTML = '<option value="">Seleccionar empleado</option>';
    empleados.forEach(empleado => {
        const nombre = `${empleado.primerNombre} ${empleado.primerApellido}`;
        const option = new Option(nombre, empleado.username);
        editAsignadoTicket.appendChild(option);
    });
    
    // Llenar formulario con datos actuales
    document.getElementById('editTituloTicket').value = ticket.titulo;
    document.getElementById('editDescripcionTicket').value = ticket.descripcion;
    document.getElementById('editAsignadoTicket').value = ticket.asignadoA;
    document.getElementById('editPrioridadTicket').value = ticket.prioridad;
    document.getElementById('editEstadoTicket').value = ticket.estado;
    
    // Formatear fecha de vencimiento para input datetime-local
    if (ticket.fechaVencimiento) {
        const fechaVencimiento = ticket.fechaVencimiento.toDate ? 
            ticket.fechaVencimiento.toDate() : new Date(ticket.fechaVencimiento);
        const fechaFormateada = fechaVencimiento.toISOString().slice(0, 16);
        document.getElementById('editVencimientoTicket').value = fechaFormateada;
    } else {
        document.getElementById('editVencimientoTicket').value = '';
    }
    
    // Guardar ID del ticket a editar
    window.ticketIdAEditar = ticketId;
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalEditarTicket'));
    modal.show();
}

// Guardar edición de ticket
async function guardarEdicionTicket() {
    try {
        const ticketId = window.ticketIdAEditar;
        if (!ticketId) return;
        
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) return;
        
        // Obtener datos del formulario
        const titulo = document.getElementById('editTituloTicket').value.trim();
        const descripcion = document.getElementById('editDescripcionTicket').value.trim();
        const asignadoA = document.getElementById('editAsignadoTicket').value;
        const prioridad = document.getElementById('editPrioridadTicket').value;
        const estado = document.getElementById('editEstadoTicket').value;
        const vencimiento = document.getElementById('editVencimientoTicket').value;
        
        // Validaciones
        if (!titulo || titulo.length < 3) {
            mostrarMensaje('El título debe tener al menos 3 caracteres', 'warning');
            return;
        }
        
        if (!descripcion || descripcion.length < 10) {
            mostrarMensaje('La descripción debe tener al menos 10 caracteres', 'warning');
            return;
        }
        
        if (!asignadoA) {
            mostrarMensaje('Debe seleccionar a quién asignar el ticket', 'warning');
            return;
        }
        
        // Validar fecha de vencimiento (obligatoria)
        if (!vencimiento) {
            mostrarMensaje('La fecha de vencimiento es obligatoria', 'warning');
            return;
        }
        
        // Preparar datos de actualización
        // Configurar fecha de vencimiento automática a las 23:59
            const fechaSeleccionada = new Date(vencimiento);
            fechaSeleccionada.setHours(23, 59, 59, 999); // 23:59:59.999
        const fechaVencimiento = fechaSeleccionada;

        const updateData = {
            titulo: titulo,
            descripcion: descripcion,
            asignadoA: asignadoA,
            asignadoANombre: empleados.find(e => e.username === asignadoA)?.primerNombre + ' ' + empleados.find(e => e.username === asignadoA)?.primerApellido,
            prioridad: prioridad,
            estado: estado,
            fechaVencimiento: fechaVencimiento,
            fechaModificacion: serverTimestamp(),
            modificadoPor: currentUser.username,
            modificadoPorNombre: currentUser.nombre
        };
        
        // Si cambió el estado a completada y no tenía fecha de resolución, agregarla
        if (estado === 'completada' && ticket.estado !== 'completada') {
            updateData.fechaResolucion = serverTimestamp();
        }
        
        // Si cambió de completada a pendiente, quitar fecha de resolución
        if (estado === 'pendiente' && ticket.estado === 'completada') {
            updateData.fechaResolucion = null;
        }
        
        // Agregar token CSRF antes de actualizar
        if (window.csrfProtection) {
            window.csrfProtection.addTokenToData(updateData);
        }
        
        // Actualizar en Firebase
        await updateDoc(doc(db, 'tickets', ticketId), updateData);
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarTicket'));
        modal.hide();
        
        // Recargar datos
        await cargarTickets();
        mostrarEstadisticas();
        mostrarTickets();
        
        // Actualizar badge
        actualizarBadgeTickets();
        
        mostrarMensaje('Ticket actualizado exitosamente', 'success');
        
    } catch (error) {
        console.error('❌ Error actualizando ticket:', error);
        mostrarMensaje('Error actualizando el ticket', 'danger');
    }
}


// Función para formatear fechas de creación (cuánto tiempo hace que se creó)
function formatearFechaCreacion(fecha) {
    if (!fecha) return '-';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    const ahora = new Date();
    const diffTime = ahora - fechaObj;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffDays > 0) {
        return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
        return `Hace ${diffHours}h`;
    } else if (diffMinutes > 0) {
        return `Hace ${diffMinutes}m`;
    } else {
        return 'Ahora';
    }
}

// Función para formatear fechas relativas
function formatearFechaRelativa(fecha) {
    if (!fecha) return '-';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    const ahora = new Date();
    const diffTime = fechaObj - ahora;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffDays === 0) {
        // Si vence hoy, mostrar horas restantes
        if (diffHours > 0) {
            return `${diffHours}h`;
        } else if (diffHours === 0) {
            return 'Vence ahora';
        } else {
            return 'Vencido';
        }
    } else if (diffDays === 1) {
        return 'Mañana';
    } else if (diffDays === -1) {
        return 'Ayer';
    } else if (diffDays > 0) {
        return `En ${diffDays} días`;
    } else {
        return `Hace ${Math.abs(diffDays)} días`;
    }
}

// Función para formatear fechas de vencimiento con fecha específica
function formatearVencimiento(fecha) {
    if (!fecha) return '<span class="text-muted">-</span>';
    
    const fechaObj = fecha.toDate ? fecha.toDate() : new Date(fecha);
    const hoy = new Date();
    const diffTime = fechaObj - hoy;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    if (diffDays === 0) {
        return `<span class="text-warning fw-bold">Hoy (${fechaFormateada})</span>`;
    } else if (diffDays === 1) {
        return `<span class="text-info">Mañana (${fechaFormateada})</span>`;
    } else if (diffDays === -1) {
        return `<span class="text-danger fw-bold">Ayer (${fechaFormateada})</span>`;
    } else if (diffDays > 0) {
        return `<span class="text-info">En ${diffDays} días (${fechaFormateada})</span>`;
    } else {
        return `<span class="text-danger fw-bold">Hace ${Math.abs(diffDays)} días (${fechaFormateada})</span>`;
    }
}

// Funciones formatearFecha y mostrarMensaje ahora están en utils.js

// Verificar permisos para mostrar botón de crear tickets en masa
function verificarPermisosTicketsMasa() {
    try {
        const user = currentUser || authManager.getCurrentUser();
        if (!user || !user.permisos) {
            return;
        }
        
        // Verificar si tiene acceso a administrador_bodega Y tickets
        const tieneAdminBodega = user.permisos.administrador_bodega === true;
        const tieneTickets = user.permisos.tickets === true;
        
        if (tieneAdminBodega && tieneTickets) {
            const container = document.getElementById('btnCrearTicketsMasaContainer');
            if (container) {
                container.style.display = 'block';
            }
            
            // Configurar evento para cargar empleados cuando se abre el modal
            const modal = document.getElementById('modalCrearTicketsMasa');
            if (modal) {
                modal.addEventListener('show.bs.modal', () => {
                    cargarEmpleadosEnModalMasa();
                });
                
                // Limpiar formulario al cerrar
                modal.addEventListener('hidden.bs.modal', () => {
                    document.getElementById('formCrearTicketsMasa').reset();
                    document.getElementById('contadorEmpleadosSeleccionadosMasa').textContent = '0';
                    document.getElementById('btnConfirmarCrearMasa').disabled = true;
                });
            }
        } else {
            // Ocultar el botón si no tiene permisos
            const container = document.getElementById('btnCrearTicketsMasaContainer');
            if (container) {
                container.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error verificando permisos para tickets en masa:', error);
    }
}

function verificarPermisosReporteEficiencia() {
    try {
        const user = currentUser || authManager.getCurrentUser();
        if (!user || !user.permisos) {
            // Ocultar reporte si no hay usuario o permisos
            const reporteContainer = document.getElementById('subseccion-reporte-eficiencia');
            if (reporteContainer) {
                reporteContainer.style.display = 'none';
            }
            return;
        }
        
        // Verificar si tiene acceso a administrador_bodega Y tickets
        const tieneAdminBodega = user.permisos.administrador_bodega === true;
        const tieneTickets = user.permisos.tickets === true;
        
        const reporteContainer = document.getElementById('subseccion-reporte-eficiencia');
        if (reporteContainer) {
            if (tieneAdminBodega && tieneTickets) {
                reporteContainer.style.display = 'block';
            } else {
                reporteContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error verificando permisos para reporte de eficiencia:', error);
        // En caso de error, ocultar el reporte
        const reporteContainer = document.getElementById('subseccion-reporte-eficiencia');
        if (reporteContainer) {
            reporteContainer.style.display = 'none';
        }
    }
}

// Cargar empleados activos en el modal de tickets en masa
function cargarEmpleadosEnModalMasa() {
    const listaContainer = document.getElementById('listaEmpleadosTicketsMasa');
    if (!listaContainer) return;
    
    // Filtrar solo empleados activos
    const empleadosActivos = empleados.filter(empleado => {
        const estado = empleado.estado || empleado.activo;
        return estado === 'Activo' || estado === 'activo' || estado === true;
    });
    
    if (empleadosActivos.length === 0) {
        listaContainer.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                No hay empleados activos disponibles
            </div>
        `;
        return;
    }
    
    // Ordenar por nombre
    empleadosActivos.sort((a, b) => {
        const nombreA = `${a.primerNombre} ${a.primerApellido}`;
        const nombreB = `${b.primerNombre} ${b.primerApellido}`;
        return nombreA.localeCompare(nombreB);
    });
    
    listaContainer.innerHTML = empleadosActivos.map(empleado => {
        const nombreCompleto = `${empleado.primerNombre} ${empleado.primerApellido}`;
        return `
            <div class="form-check mb-2 p-2 border rounded" style="background: white; transition: all 0.2s;">
                <input class="form-check-input" type="checkbox" value="${empleado.username}" id="empleadoMasa_${empleado.username}" checked onchange="actualizarContadorEmpleadosMasa()" style="cursor: pointer; transform: scale(1.2);">
                <label class="form-check-label w-100" for="empleadoMasa_${empleado.username}" style="cursor: pointer; font-size: 0.95rem; font-weight: 500; color: #2c3e50;">
                    ${nombreCompleto}
                </label>
            </div>
        `;
    }).join('');
    
    // Actualizar contador inicial (todos seleccionados por defecto)
    actualizarContadorEmpleadosMasa();
}

// Seleccionar o deseleccionar todos los empleados
window.seleccionarTodosEmpleadosMasa = function(seleccionar) {
    const checkboxes = document.querySelectorAll('#listaEmpleadosTicketsMasa input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = seleccionar;
    });
    actualizarContadorEmpleadosMasa();
};

// Actualizar contador de empleados seleccionados
window.actualizarContadorEmpleadosMasa = function() {
    const checkboxes = document.querySelectorAll('#listaEmpleadosTicketsMasa input[type="checkbox"]:checked');
    const contador = document.getElementById('contadorEmpleadosSeleccionadosMasa');
    const btnConfirmar = document.getElementById('btnConfirmarCrearMasa');
    
    const cantidad = checkboxes.length;
    if (contador) {
        contador.textContent = cantidad;
    }
    
    // Habilitar/deshabilitar botón de confirmar
    if (btnConfirmar) {
        btnConfirmar.disabled = cantidad === 0;
    }
};

// Confirmar creación de tickets en masa
window.confirmarCrearTicketsMasa = function() {
    const titulo = document.getElementById('tituloTicketsMasa').value.trim();
    const descripcion = document.getElementById('descripcionTicketsMasa').value.trim();
    const checkboxes = document.querySelectorAll('#listaEmpleadosTicketsMasa input[type="checkbox"]:checked');
    
    // Validaciones
    if (!titulo || titulo.length < 3) {
        mostrarMensaje('El título debe tener al menos 3 caracteres', 'warning');
        return;
    }
    
    if (!descripcion || descripcion.length < 10) {
        mostrarMensaje('La descripción debe tener al menos 10 caracteres', 'warning');
        return;
    }
    
    if (checkboxes.length === 0) {
        mostrarMensaje('Debes seleccionar al menos un empleado', 'warning');
        return;
    }
    
    const empleadosSeleccionados = Array.from(checkboxes).map(cb => {
        const empleado = empleados.find(e => e.username === cb.value);
        return empleado ? `${empleado.primerNombre} ${empleado.primerApellido}` : cb.value;
    });
    
    // Mostrar confirmación
    const mensaje = `¿Estás seguro de crear ${checkboxes.length} ticket(s) para los siguientes empleados?\n\n${empleadosSeleccionados.join('\n')}\n\nTítulo: ${titulo}`;
    
    if (confirm(mensaje)) {
        crearTicketsMasa();
    }
};

// Crear tickets en masa
window.crearTicketsMasa = async function() {
    try {
        const titulo = document.getElementById('tituloTicketsMasa').value.trim();
        const descripcion = document.getElementById('descripcionTicketsMasa').value.trim();
        const prioridad = document.getElementById('prioridadTicketsMasa').value;
        const vencimiento = document.getElementById('vencimientoTicketsMasa').value;
        const checkboxes = document.querySelectorAll('#listaEmpleadosTicketsMasa input[type="checkbox"]:checked');
        
        // Validar fecha de vencimiento (obligatoria)
        if (!vencimiento) {
            mostrarMensaje('La fecha de vencimiento es obligatoria', 'warning');
            return;
        }
        
        // Configurar fecha de vencimiento
        const fechaSeleccionada = new Date(vencimiento);
        fechaSeleccionada.setHours(23, 59, 59, 999);
        const fechaVencimiento = fechaSeleccionada;
        
        // Deshabilitar botón y mostrar progreso
        const btnConfirmar = document.getElementById('btnConfirmarCrearMasa');
        const textoOriginal = btnConfirmar.innerHTML;
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Creando tickets...';
        
        let ticketsCreados = 0;
        let ticketsError = 0;
        
        // Crear un ticket para cada empleado seleccionado
        for (const checkbox of checkboxes) {
            try {
                const empleadoUsername = checkbox.value;
                const empleado = empleados.find(e => e.username === empleadoUsername);
                
                if (!empleado) {
                    console.warn(`Empleado no encontrado: ${empleadoUsername}`);
                    ticketsError++;
                    continue;
                }
                
                // Verificar si se seleccionó un usuario de gerencia para crear el ticket a su nombre
                const creadoPorGerenciaMasa = document.getElementById('creadoPorGerenciaMasa')?.value || '';
                let creadorFinalMasa = currentUser.username;
                let creadorNombreFinalMasa = currentUser.nombre;
                
                // Si se seleccionó un usuario de gerencia, usar ese como creador
                if (creadoPorGerenciaMasa && creadoPorGerenciaMasa.trim() !== '') {
                    const empleadoGerenciaMasa = empleados.find(e => e.username === creadoPorGerenciaMasa);
                    if (empleadoGerenciaMasa) {
                        creadorFinalMasa = empleadoGerenciaMasa.username;
                        creadorNombreFinalMasa = `${empleadoGerenciaMasa.primerNombre} ${empleadoGerenciaMasa.primerApellido}`;
                    }
                }
                
                const ticketData = {
                    titulo: titulo,
                    descripcion: descripcion,
                    creadoPor: creadorFinalMasa,
                    creadoPorNombre: creadorNombreFinalMasa,
                    asignadoA: empleadoUsername,
                    asignadoANombre: `${empleado.primerNombre} ${empleado.primerApellido}`,
                    estado: 'pendiente',
                    prioridad: prioridad,
                    fechaCreacion: serverTimestamp(),
                    fechaVencimiento: fechaVencimiento,
                    comentarios: [],
                    fotos: []
                };
                
                // Agregar token CSRF antes de crear ticket
        if (window.csrfProtection) {
            window.csrfProtection.addTokenToData(ticketData);
        }
        
        await addDoc(collection(db, 'tickets'), ticketData);
                ticketsCreados++;
            } catch (error) {
                console.error(`Error creando ticket para ${checkbox.value}:`, error);
                ticketsError++;
            }
        }
        
        // Restaurar botón
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = textoOriginal;
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCrearTicketsMasa'));
        modal.hide();
        
        // Recargar datos
        await cargarTickets();
        mostrarEstadisticas();
        mostrarTickets();
        
        // Actualizar badge
        actualizarBadgeTickets();
        
        // Mostrar mensaje de éxito
        if (ticketsError === 0) {
            mostrarMensaje(`✅ ${ticketsCreados} ticket(s) creado(s) exitosamente`, 'success');
        } else {
            mostrarMensaje(`⚠️ ${ticketsCreados} ticket(s) creado(s), ${ticketsError} error(es)`, 'warning');
        }
        
    } catch (error) {
        console.error('❌ Error creando tickets en masa:', error);
        mostrarMensaje('Error creando los tickets', 'danger');
        
        // Restaurar botón
        const btnConfirmar = document.getElementById('btnConfirmarCrearMasa');
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check me-1"></i>Confirmar y Crear Tickets';
        }
    }
};
