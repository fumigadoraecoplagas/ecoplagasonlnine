// Cargar script de badge de tickets globalmente para que siempre esté disponible
if (!window.ticketsBadgeLoaded) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'tickets-badge.js';
    script.onerror = function() {
        console.warn('⚠️ No se pudo cargar tickets-badge.js');
        this.remove();
    };
    document.head.appendChild(script);
    window.ticketsBadgeLoaded = true;
}

// Cargador de Header Unificado - Eco Plagas
const HEADER_LOGS_ENABLED = Boolean(window?.HEADER_LOGS_ENABLED);
const headerLog = (...args) => {
    if (!HEADER_LOGS_ENABLED) return;
    console.log(...args);
};
const headerWarn = (...args) => {
    if (!HEADER_LOGS_ENABLED) return;
    console.warn(...args);
};

// Helper para escapar HTML (prevenir XSS)
// Guardar referencia a función global existente ANTES de definir la nuestra
const globalEscapeHTML = (window.escapeHTML && typeof window.escapeHTML === 'function') ? window.escapeHTML : null;

function escapeHTML(text) {
    // Si hay una función global definida ANTES de esta, usarla
    if (globalEscapeHTML && globalEscapeHTML !== escapeHTML) {
        return globalEscapeHTML(text);
    }
    // Si no, usar nuestra implementación
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

// Evitar declaración múltiple
if (typeof HeaderLoader === 'undefined') {
    window.HeaderLoader = class HeaderLoader {
    constructor() {
        this.headerContainer = null;
        this.pageConfigs = {
            'index.html': {
                title: '<i class="fas fa-home me-2"></i>Sistema de Gestión',
                subtitle: 'Fumigadora EcoPlagas - Control de Plagas Profesional'
            },
            'calendario.html': {
                title: '<i class="fas fa-calendar-alt me-2"></i>Calendario de Servicios',
                subtitle: 'Vista de calendario por día y vehículo - Eco Plagas'
            },
            'empleados.html': {
                title: '<i class="fas fa-users me-2"></i>Gestión de Empleados',
                subtitle: 'Administra la información del personal de Fumigadora EcoPlagas'
            },
            'registro_horas.html': {
                title: '<i class="fas fa-clock me-2"></i>Registro de Horas',
                subtitle: 'Control de jornada laboral - Eco Plagas'
            },
            'edicion_horas.html': {
                title: '<i class="fas fa-edit me-2"></i>Edición de Horas',
                subtitle: 'Gestionar y editar registros de horas trabajadas'
            },
            'reporte_ventas.html': {
                title: '<i class="fas fa-chart-line me-2"></i>Reporte de Ventas',
                subtitle: 'Análisis de ventas y citas del mes actual'
            },
            'operario_bodega.html': {
                title: '<i class="fas fa-boxes me-2"></i>Mi Bodeguita',
                subtitle: 'Gestión de inventario personal'
            },
            'administrador_bodega.html': {
                title: '<i class="fas fa-warehouse me-2"></i>Administrador de Bodega',
                subtitle: 'Gestión completa de inventario'
            },
            'tickets.html': {
                title: '<i class="fas fa-ticket-alt me-2"></i>Tickets Internos',
                subtitle: 'Sistema de solicitudes entre empleados'
            },
            'recursos_humanos_modulos.html': {
                title: '<i class="fas fa-users-cog me-2"></i>Recursos Humanos',
                subtitle: 'Capacitación, Procedimientos y Gestión de Vacaciones'
            },
            'vacaciones.html': {
                title: '<i class="fas fa-calendar-check me-2"></i>Solicitud de Vacaciones',
                subtitle: 'Gestionar solicitudes de vacaciones'
            }
        };
    }

    async loadHeader() {
        try {
            headerLog('🚀 Iniciando carga de header...');
            // Agregar favicon si no existe
            this.ensureFavicon();
            
            headerLog('🔍 Buscando header-container...');
            const existingContainer = document.getElementById('header-container');
            if (existingContainer) {
                headerLog('✅ header-container encontrado');
                this.headerContainer = existingContainer;
            } else {
                headerWarn('⚠️ header-container no encontrado, creando uno nuevo');
                this.headerContainer = document.createElement('div');
                this.headerContainer.id = 'header-container';
                document.body.insertBefore(this.headerContainer, document.body.firstChild);
            }
            
            // Obtener el nombre del archivo actual
            const currentPage = this.getCurrentPageName();
            headerLog('📄 Página actual:', currentPage);
            
            // Cargar el header HTML (SISTEMA SEGURO)
            headerLog('📥 Cargando header.html...');
            const response = await fetch('header.html');
            if (!response.ok) {
                throw new Error('No se pudo cargar el header');
            }
            
            const headerHTML = await response.text();
            headerLog('✅ header.html cargado, longitud:', headerHTML.length);
            this.headerContainer.innerHTML = headerHTML;
            
            // Forzar visibilidad
            this.headerContainer.style.display = 'block';
            this.headerContainer.style.visibility = 'visible';
            const mobileHeader = this.headerContainer.querySelector('.mobile-header');
            if (mobileHeader) {
                mobileHeader.style.display = 'block';
                mobileHeader.style.visibility = 'visible';
                headerLog('✅ mobile-header encontrado y visible');
            } else {
                console.error('❌ mobile-header NO encontrado en el HTML cargado');
            }
            
            // Extraer el footer del header y moverlo al final del body
            const footer = this.headerContainer.querySelector('.mobile-footer');
            if (footer) {
                footer.remove();
                document.body.appendChild(footer);
            }
            
            // Insertar el header al inicio del main-container
            const mainContainer = document.querySelector('.main-container');
            if (mainContainer) {
                headerLog('✅ main-container encontrado, insertando header');
                mainContainer.insertBefore(this.headerContainer, mainContainer.firstChild);
            } else {
                headerWarn('⚠️ main-container no encontrado, header ya está en body');
            }
            
            headerLog('✅ Header cargado exitosamente');
            
            // Configurar el header según la página actual
            this.configureHeaderForPage(currentPage);
            
            // Inicializar funcionalidades del header
            this.initializeHeaderFunctions();
            
            // Forzar actualización del usuario después de cargar el header
            setTimeout(() => {
                this.showUserInfo();
            }, 100);
            
            // Actualizar badge de tickets después de cargar el header
            // Intentar múltiples veces para asegurar que el script esté cargado
            const actualizarBadge = () => {
                if (window.actualizarBadgeTickets) {
                    window.actualizarBadgeTickets();
                } else {
                    // Reintentar después de un breve delay
                    setTimeout(actualizarBadge, 200);
                }
            };
            setTimeout(actualizarBadge, 500);
            // También actualizar después de más tiempo por si el script tarda en cargar
            setTimeout(actualizarBadge, 2000);
            
            // Generar footer después de cargar el header
            setTimeout(() => {
                if (window.generateMobileFooter) {
                    window.generateMobileFooter();
                }
            }, 400);
            
        } catch (error) {
            console.error('Error cargando header:', error);
            this.showFallbackHeader();
        }
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        const pageName = path.split('/').pop() || 'index.html';
        return pageName;
    }

    ensureFavicon() {
        // Verificar si ya existe un favicon
        const existingFavicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
        if (!existingFavicon) {
            const head = document.head || document.getElementsByTagName('head')[0];
            
            // Usar SVG inline para evitar 404 (favicon con emoji de caja)
            const faviconSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E📦%3C/text%3E%3C/svg%3E";
            
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.type = 'image/svg+xml';
            favicon.href = faviconSvg;
            head.appendChild(favicon);
            
            // También agregar shortcut icon para compatibilidad
            const shortcutIcon = document.createElement('link');
            shortcutIcon.rel = 'shortcut icon';
            shortcutIcon.href = faviconSvg;
            head.appendChild(shortcutIcon);
        }
    }

    configureHeaderForPage(pageName) {
        const config = this.pageConfigs[pageName];
        if (!config) return;

        const titleElement = document.getElementById('page-title');
        const subtitleElement = document.getElementById('page-subtitle');

        if (titleElement && config.title) {
            titleElement.innerHTML = config.title;
        }

        if (subtitleElement && config.subtitle) {
            subtitleElement.textContent = config.subtitle;
        }
    }

    initializeHeaderFunctions() {
        // Inicializar el toggle del menú hamburguesa
        this.initializeHamburgerMenu();
        
        // Esperar a que secureAuthManager o authManager esté disponible Y autenticado
        const checkAuthManager = () => {
            let authMgr = null;
            let isReady = false;
            
            // Priorizar secureAuthManager para sistema seguro
            if (window.secureAuthManager) {
                // Verificar si está autenticado
                if (window.secureAuthManager.isAuthenticated()) {
                    authMgr = window.secureAuthManager;
                    window.authManager = window.secureAuthManager; // Compatibilidad
                    isReady = true;
                    // secureAuthManager está autenticado, inicializando funciones del header
                } else {
                    // secureAuthManager existe pero aún no está autenticado, esperando...
                }
            } else if (window.authManager && window.authManager.isAuthenticated()) {
                authMgr = window.authManager;
                isReady = true;
                // authManager (legacy) está autenticado, inicializando funciones del header
            }
            
            if (isReady && authMgr) {
                this.showUserInfo();
                this.addLogoutButton();
                this.filterModulesByPermissions();
            } else {
                // Reintentar en 200ms (más tiempo para que secureAuthManager se inicialice)
                setTimeout(checkAuthManager, 200);
            }
        };
        
        // Iniciar verificación después de un pequeño delay para dar tiempo a que los módulos se carguen
        setTimeout(checkAuthManager, 300);
    }

    initializeHamburgerMenu() {
        const mobileNavigation = document.getElementById('mobile-navigation');
        
        if (!mobileNavigation) {
            return;
        }
        
        // Asegurar que el menú esté siempre visible (botón hamburguesa removido)
        mobileNavigation.classList.add('show');
        mobileNavigation.style.display = 'block';
    }

    showUserInfo() {
        // Buscar tanto en elementos con clase .user-info como con id mobile-user-info
        const userInfoElements = document.querySelectorAll('.user-info, #mobile-user-info');
        
        if (userInfoElements.length === 0) {
            // Si no hay elementos, reintentar después de un breve delay
            setTimeout(() => this.showUserInfo(), 200);
            return;
        }
        
        // Detectar si estamos usando el sistema seguro (Firebase Auth)
        const isSecureSystem = window.firebaseAuth && window.firebaseAuth.currentUser;
        
        // Priorizar secureAuthManager
        let authMgr = null;
        let user = null;
        
        // Intentar obtener usuario de secureAuthManager primero
        if (window.secureAuthManager) {
            // Verificar si está autenticado
            if (window.secureAuthManager.isAuthenticated()) {
                authMgr = window.secureAuthManager;
                user = authMgr.getCurrentUser();
            } else if (window.firebaseAuth && window.firebaseAuth.currentUser) {
                // Si Firebase Auth tiene usuario pero secureAuthManager aún no está listo,
                // esperar un poco y reintentar
                setTimeout(() => this.showUserInfo(), 300);
                return;
            }
        }
        
        // Fallback a authManager legacy
        if (!user && window.authManager && window.authManager.isAuthenticated()) {
            authMgr = window.authManager;
            user = authMgr.getCurrentUser();
        }
        
        // Si tenemos usuario, mostrar información
        if (user && user.nombre) {
            userInfoElements.forEach(userInfoElement => {
                if (userInfoElement) {
                    // Usar el formato correcto para mobile-user-info (sin me-2)
                    const nombreEscapado = escapeHTML(user.nombre || 'Usuario');
                    if (userInfoElement.id === 'mobile-user-info') {
                        userInfoElement.innerHTML = `<i class="fas fa-user"></i><span>${nombreEscapado}</span>`;
                    } else {
                        userInfoElement.innerHTML = `<i class="fas fa-user me-2"></i>${nombreEscapado}`;
                    }
                }
            });
        } else {
            // Si no hay usuario, mostrar "Invitado" pero solo si realmente no hay autenticación
            // Si estamos en sistema secure y Firebase Auth tiene usuario, esperar un poco más
            if (isSecureSystem && !user) {
                setTimeout(() => this.showUserInfo(), 500);
                return;
            }
            
            userInfoElements.forEach(userInfoElement => {
                if (userInfoElement) {
                    if (userInfoElement.id === 'mobile-user-info') {
                        userInfoElement.innerHTML = `<i class="fas fa-user"></i><span>Invitado</span>`;
                    } else {
                        userInfoElement.innerHTML = `<i class="fas fa-user me-2"></i>Invitado`;
                    }
                }
            });
        }
    }

    addLogoutButton() {
        // Buscar tanto en elementos con clase .logout-btn como con id mobile-logout-btn
        const logoutButtons = document.querySelectorAll('.logout-btn, #mobile-logout-btn');
        logoutButtons.forEach(logoutBtn => {
            if (logoutBtn) {
                // Remover listeners existentes para evitar duplicados
                logoutBtn.replaceWith(logoutBtn.cloneNode(true));
                const newLogoutBtn = document.querySelector(logoutBtn.id ? `#${logoutBtn.id}` : `.${logoutBtn.className}`);
                
                newLogoutBtn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    headerLog('🔒 [HEADER] Iniciando logout...');
                    
                    try {
                        // Determinar si estamos en el sistema seguro o el antiguo
                        // Todas las páginas renombradas son "secure" (ya no tienen "secure" en el nombre)
                        const path = window.location.pathname.toLowerCase();
                        const isSecureSystem = !path.includes('login.html') || path.includes('iniciar_sesion') || 
                                             path.includes('inicio') || path.includes('registro_horas') ||
                                             path.includes('calendario') || path.includes('empleados') ||
                                             path.includes('edicion_horas') || path.includes('administrador_bodega') ||
                                             path.includes('operario_bodega') || path.includes('tickets') ||
                                             path.includes('reportes_gerenciales');
                        
                        // Usar secureAuthManager si estamos en sistema seguro y está disponible
                        if (isSecureSystem && window.secureAuthManager && window.secureAuthManager.isAuthenticated()) {
                            await window.secureAuthManager.logout();
                            headerLog('✅ [HEADER] Logout exitoso con secureAuthManager');
                            if (!window.location.pathname.includes('iniciar_sesion.html')) {
                                window.location.replace('iniciar_sesion.html');
                            }
                        } else if (window.authManager) {
                            // Sistema antiguo o fallback
                            if (typeof window.authManager.logout === 'function') {
                                await window.authManager.logout();
                            }
                            headerLog('✅ [HEADER] Logout exitoso con authManager');
                            const targetUrl = isSecureSystem ? 'iniciar_sesion.html' : 'login.html';
                            if (!window.location.pathname.includes(targetUrl)) {
                                window.location.replace(targetUrl);
                            }
                        } else {
                            // Sin manager, redirigir directamente
                            headerWarn('⚠️ [HEADER] No hay manager disponible, redirigiendo directamente');
                            const targetUrl = isSecureSystem ? 'iniciar_sesion.html' : 'login.html';
                            if (!window.location.pathname.includes(targetUrl)) {
                                window.location.replace(targetUrl);
                            }
                        }
                    } catch (error) {
                        console.error('❌ [HEADER] Error en logout:', error);
                        // Redirigir de todas formas
                        // Todas las páginas renombradas son "secure"
                        const path = window.location.pathname.toLowerCase();
                        const isSecureSystem = !path.includes('login.html') || path.includes('iniciar_sesion');
                        const targetUrl = isSecureSystem ? 'iniciar_sesion.html' : 'login.html';
                        if (!window.location.pathname.includes(targetUrl)) {
                            window.location.replace(targetUrl);
                        }
                    }
                });
            }
        });
    }

    async filterModulesByPermissions() {
        const navGrid = document.getElementById('mobile-nav-grid');
        if (!navGrid) {
            // Reintentar si el elemento no está disponible aún
            setTimeout(() => this.filterModulesByPermissions(), 200);
            return;
        }

        // Priorizar secureAuthManager para sistema seguro
        let authMgr = null;
        if (window.secureAuthManager && window.secureAuthManager.isAuthenticated()) {
            authMgr = window.secureAuthManager;
        } else if (window.authManager && window.authManager.isAuthenticated()) {
            authMgr = window.authManager;
        }

        // Refrescar permisos antes de filtrar
        if (authMgr) {
            try {
                if (typeof authMgr.refreshUserPermissions === 'function') {
                    await authMgr.refreshUserPermissions();
                }
            } catch (error) {
                if (window.safeLogger) {
                    window.safeLogger.error('Error refrescando permisos', error);
                }
            }
        }

        const navItems = navGrid.querySelectorAll('.mobile-nav-item');
        
        // Ocultar todos los módulos por defecto
        navItems.forEach(item => {
            item.style.display = 'none';
        });
        
        // Solo mostrar módulos si hay un usuario autenticado
        if (authMgr) {
            const user = authMgr.getCurrentUser();
            
            if (user && user.permisos) {
                navItems.forEach((item) => {
                    const permission = item.getAttribute('data-permission');
                    
                    // Si no tiene atributo data-permission, mostrar siempre (ej: mapas)
                    if (!permission) {
                        item.style.display = 'flex';
                        return;
                    }
                    
                    const hasPermission = user.permisos[permission] === true;
                    
                    if (hasPermission) {
                        item.style.display = 'flex';
                    }
                });
            }
        }
    }

    showFallbackHeader() {
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer) {
            const fallbackHeader = document.createElement('div');
            fallbackHeader.className = 'header-section';
            fallbackHeader.innerHTML = `
                <div class="header-content">
                    <img src="Logo Eco Plagas.png" alt="Eco Plagas Logo" class="logo">
                    <div class="header-text">
                        <h1 class="header-title">Sistema de Gestión</h1>
                        <p class="header-subtitle">Fumigadora EcoPlagas</p>
                    </div>
                </div>
            `;
            mainContainer.insertBefore(fallbackHeader, mainContainer.firstChild);
        }
    }
    }; // Fin de la clase HeaderLoader
} // Fin del if (typeof HeaderLoader === 'undefined')

// Inicializar el cargador de header cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Evitar múltiples inicializaciones
    if (window.headerLoaderInitialized) {
        return;
    }
    
    // Esperar a que HeaderLoader esté disponible
    if (typeof HeaderLoader === 'undefined') {
        console.error('❌ HeaderLoader no está definido');
        return;
    }
    
    window.headerLoaderInitialized = true;
    
    const headerLoader = new HeaderLoader();
    // Guardar instancia globalmente para acceso desde otros módulos
    window.HeaderLoader.instance = headerLoader;
    headerLoader.loadHeader().then(() => {
        // Inicializar menú hamburguesa después de cargar el header con un pequeño delay
        // Menú siempre visible, no necesita inicialización de toggle
    }).catch(error => {
        console.error('❌ Error cargando header:', error);
        window.headerLoaderInitialized = false; // Permitir reintento en caso de error
    });
});

// Escuchar cuando la autenticación segura esté lista para refrescar el header
window.addEventListener('secure-auth-ready', () => {
    // Evento secure-auth-ready recibido
    // Intentar obtener el loader de diferentes formas
    let loader = null;
    if (window.HeaderLoader && window.HeaderLoader.instance) {
        loader = window.HeaderLoader.instance;
        // Loader obtenido desde HeaderLoader.instance
    } else if (window.headerLoader) {
        loader = window.headerLoader;
        // Loader obtenido desde window.headerLoader
    } else {
        // Loader no disponible, reintentando...
    }
    
    if (loader) {
        // Esperar un poco para asegurar que secureAuthManager esté completamente listo
        setTimeout(() => {
            // Refrescando header después de secure-auth-ready
            loader.showUserInfo();
            loader.addLogoutButton();
            loader.filterModulesByPermissions();
        }, 500);
    } else {
        // Si no hay loader, reintentar después de un delay
        setTimeout(() => {
            // Reintentando secure-auth-ready...
            window.dispatchEvent(new Event('secure-auth-ready'));
        }, 500);
    }
});

// Función para inicializar el menú móvil (ya no necesaria, se maneja en initializeHamburgerMenu)
function initializeMobileMenu() {
    // Esta función ya no es necesaria, el menú se maneja en initializeHamburgerMenu()
    // Se mantiene por compatibilidad pero no hace nada
}
