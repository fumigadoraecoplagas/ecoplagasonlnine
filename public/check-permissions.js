// Sistema de Verificación de Permisos Eco Plagas
// Este archivo debe ser incluido en todas las páginas para verificar permisos

// Mapeo de páginas a módulos requeridos
var PAGE_PERMISSIONS = {
    'calendario.html': 'calendario',
    'empleados.html': 'empleados',
    'edicion_horas.html': 'edicion_horas',
    'operario_bodega.html': 'operario_bodega',
    'administrador_bodega.html': 'administrador_bodega',
    'tickets.html': 'tickets',
    'reportes_gerenciales.html': 'reportes_gerenciales',
    'registro_horas.html': 'registro_horas',
    'recursos_humanos_modulos.html': 'recursos_humanos'
};

function isSecurePage() {
    // Todas las páginas renombradas son "secure" (ya no tienen "secure" en el nombre)
    // Las páginas legacy tienen "login.html" (sin "secure")
    const path = window.location.pathname.toLowerCase();
    // Si contiene "login.html" (sin secure) es legacy, de lo contrario es secure
    if (path.includes('login.html') && !path.includes('secure')) {
        return false;
    }
    // Todas las demás páginas son secure (renombradas)
    return true;
}

function getActiveAuthManager() {
    if (isSecurePage() && window.secureAuthManager) {
        window.authManager = window.secureAuthManager;
        return window.secureAuthManager;
    }
    return window.authManager;
}

// Función para verificar permisos de página
async function checkPagePermissions() {
    const currentPage = window.location.pathname.split('/').pop();
    const requiredModule = PAGE_PERMISSIONS[currentPage];
    
    if (!requiredModule) {
        return true;
    }
    
    // Verificar si el usuario está autenticado
    const authMgr = getActiveAuthManager();
    if (authMgr?.waitForCurrentUser) {
        await authMgr.waitForCurrentUser();
    } else if (authMgr?.loadUserFromStorage) {
        authMgr.loadUserFromStorage();
    }

    if (!authMgr || !authMgr.isAuthenticated()) {
        redirectToLogin();
        return false;
    }
    
    // Refrescar permisos antes de verificar
    try {
        await authMgr.refreshUserPermissions();
    } catch (error) {
        console.error('Error refrescando permisos:', error);
        // Continuar con la verificación aunque falle el refresh
    }
    
    const user = authMgr.getCurrentUser();
    const hasPermission = authMgr.hasPermission(requiredModule);
    
    if (!hasPermission) {
        if (window.securityLogger && typeof window.securityLogger.logUnauthorizedAccess === 'function') {
            window.securityLogger.logUnauthorizedAccess(requiredModule, { 
                username: user.username,
                nombre: user.nombre 
            });
        }
        showAccessDenied();
        return false;
    }
    
    return true;
}

// Función para redirigir al login
function redirectToLogin() {
    const target = isSecurePage() ? 'iniciar_sesion.html' : 'login.html';
    try {
        const alreadyOnLogin = window.location.pathname.includes('login');
        if (target.includes('iniciar_sesion.html') && !alreadyOnLogin) {
            sessionStorage.setItem('postLoginRedirect', window.location.href);
        }
    } catch (error) {
        console.warn('No se pudo guardar la URL para post-login:', error);
    }
    window.location.href = target;
}

// Función para mostrar mensaje de acceso denegado
function showAccessDenied() {
    const targetLogin = isSecurePage() ? 'iniciar_sesion.html' : 'login.html';
    document.body.innerHTML = `
        <div class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="card border-danger">
                        <div class="card-header bg-danger text-white">
                            <h4 class="mb-0">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Acceso Denegado
                            </h4>
                        </div>
                        <div class="card-body text-center">
                            <i class="fas fa-lock fa-3x text-danger mb-3"></i>
                            <h5>No tienes permisos para acceder a esta página</h5>
                            <p class="text-muted">Contacta al administrador si crees que esto es un error.</p>
                            <button class="btn btn-primary" onclick="window.location.href='${targetLogin}'">
                                <i class="fas fa-sign-in-alt me-2"></i>
                                Volver al Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Función para verificar si el usuario tiene acceso a otros módulos (para header)
async function hasAccessToOtherModules() {
    const authMgr = getActiveAuthManager();
    if (authMgr?.waitForCurrentUser) {
        await authMgr.waitForCurrentUser();
    } else if (authMgr?.loadUserFromStorage) {
        authMgr.loadUserFromStorage();
    }

    if (!authMgr || !authMgr.isAuthenticated()) {
        return false;
    }
    
    // Refrescar permisos antes de verificar
    try {
        await authMgr.refreshUserPermissions();
    } catch (error) {
        console.error('Error refrescando permisos en hasAccessToOtherModules:', error);
    }
    
    const user = authMgr.getCurrentUser();
    if (!user || !user.permisos) {
        return false;
    }
    
    const modulesToCheck = [
        'calendario', 
        'empleados',
        'registro_horas',
        'edicion_horas',
        'operario_bodega',
        'administrador_bodega',
        'tickets',
        'reportes_gerenciales',
        'recursos_humanos'
    ];
    
    for (const module of modulesToCheck) {
        if (user.permisos[module] === true) {
            return true;
        }
    }
    
    return false;
}

// Ejecutar verificación al cargar la página
document.addEventListener('DOMContentLoaded', async function() {
    // No verificar en la página de login
    if (window.location.pathname.includes('login.html')) {
        return;
    }
    if (window.location.pathname.includes('iniciar_sesion.html')) {
        return;
    }
    
    // Esperar a que authManager esté disponible
    const waitForAuthManager = async () => {
        let attempts = 0;
        // 75 intentos * 200ms = 15 segundos de espera máxima
        const maxAttempts = 75; 
        
        const check = async () => {
            const authMgr = getActiveAuthManager();
            if (authMgr?.waitForCurrentUser) {
                await authMgr.waitForCurrentUser();
            }
            if (authMgr && authMgr.isAuthenticated()) {
                await checkPagePermissions();
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 200);
                } else {
                    console.warn('⚠️ [CHECK-PERMISSIONS] Timeout esperando autenticación (15s)');
                    redirectToLogin();
                }
            }
        };
        check();
    };
    
    await waitForAuthManager();
    
    // Refrescar permisos periódicamente cada 2 minutos y actualizar header
    const periodicAuthManager = getActiveAuthManager();
    if (periodicAuthManager && periodicAuthManager.isAuthenticated()) {
        setInterval(async () => {
            try {
                await periodicAuthManager.refreshUserPermissions();
                console.log('🔄 Permisos refrescados automáticamente');
                
                // Actualizar el menú del header si existe
                if (window.HeaderLoader && window.HeaderLoader.instance) {
                    await window.HeaderLoader.instance.filterModulesByPermissions();
                }
                
                // Actualizar badge de tickets
                if (window.actualizarBadgeTickets) {
                    window.actualizarBadgeTickets();
                }
            } catch (error) {
                console.error('Error en refresh automático de permisos:', error);
            }
        }, 120000); // 2 minutos
    }
    
    // Actualizar badge de tickets periódicamente cada 30 segundos
    if (periodicAuthManager && periodicAuthManager.isAuthenticated()) {
        // Actualizar inmediatamente
        setTimeout(() => {
            if (window.actualizarBadgeTickets) {
                window.actualizarBadgeTickets();
            }
        }, 1000);
        
        // Actualizar cada 30 segundos
        setInterval(() => {
            if (window.actualizarBadgeTickets) {
                window.actualizarBadgeTickets();
            }
        }, 30000);
    }
});

// Exportar funciones para uso global
window.checkPagePermissions = checkPagePermissions;
window.hasAccessToOtherModules = hasAccessToOtherModules;


