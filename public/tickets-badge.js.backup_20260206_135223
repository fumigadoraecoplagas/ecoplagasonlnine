// Script para actualizar badge de notificaciones de tickets
// Funciona desde cualquier página del sistema (legacy y secure)

// Importar Firebase
import { getFirestore, collection, query, getDocs, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Función para actualizar badge en el header
function actualizarBadgeEnHeader(count) {
    // Buscar el elemento de tickets en el header (legacy y secure)
    const ticketsNavItem = document.querySelector(
        '.mobile-nav-item[href="tickets.html"], ' +
        '.mobile-nav-item[href="tickets.html"], ' +
        '.mobile-nav-item[data-permission="tickets"]'
    );
    
    if (!ticketsNavItem) {
        return;
    }
    
    // Remover badge existente si existe
    const badgeExistente = ticketsNavItem.querySelector('.tickets-badge');
    if (badgeExistente) {
        badgeExistente.remove();
    }
    
    // Agregar badge si hay tickets pendientes (siempre mostrar si count > 0)
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'tickets-badge';
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.setAttribute('data-count', count);
        // Ajustar tamaño según el número de dígitos
        if (count >= 10) {
            badge.style.minWidth = '36px';
            badge.style.height = '36px';
            badge.style.fontSize = '17px';
        } else if (count >= 100) {
            badge.style.minWidth = '40px';
            badge.style.height = '40px';
            badge.style.fontSize = '18px';
        }
        ticketsNavItem.appendChild(badge);
    }
}

// Función para actualizar badge en el footer móvil
function actualizarBadgeEnFooter(count) {
    // Buscar el botón de tickets en el footer (legacy y secure)
    const ticketsFooterBtn = document.querySelector(
        '.footer-button[href="tickets.html"], ' +
        '.footer-button[href="tickets.html"], ' +
        '.footer-button[href*="tickets"]'
    );
    
    if (!ticketsFooterBtn) {
        return;
    }
    
    // Remover badge existente si existe
    const badgeExistente = ticketsFooterBtn.querySelector('.tickets-badge');
    if (badgeExistente) {
        badgeExistente.remove();
    }
    
    // Agregar badge si hay tickets pendientes (siempre mostrar si count > 0)
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'tickets-badge';
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.setAttribute('data-count', count);
        // Ajustar tamaño según el número de dígitos
        if (count >= 10) {
            badge.style.minWidth = '36px';
            badge.style.height = '36px';
            badge.style.fontSize = '17px';
        } else if (count >= 100) {
            badge.style.minWidth = '40px';
            badge.style.height = '40px';
            badge.style.fontSize = '18px';
        }
        ticketsFooterBtn.appendChild(badge);
    }
}

// Función principal para calcular tickets pendientes y actualizar badge
async function actualizarBadgeTickets() {
    try {
        // Detectar si estamos en el sistema secure
        const isSecure = window.location.pathname.includes('secure') || 
                        window.location.pathname.includes('loginsecure') ||
                        window.location.pathname.includes('indexsecure');
        
        // Obtener usuario actual - priorizar secureAuthManager si está disponible
        let authManager = null;
        if (isSecure && window.secureAuthManager && window.secureAuthManager.isAuthenticated()) {
            authManager = window.secureAuthManager;
        } else if (window.authManager && window.authManager.isAuthenticated()) {
            authManager = window.authManager;
        }
        
        if (!authManager) {
            return;
        }
        
        const user = authManager.getCurrentUser();
        if (!user || !user.username) {
            return;
        }
        
        // Obtener instancia de Firestore
        let dbInstance;
        try {
            // Intentar obtener db desde la app de Firebase
            const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
            const app = getApp();
            dbInstance = getFirestore(app);
        } catch (error) {
            console.error('Error obteniendo Firestore:', error);
            return;
        }
        
        // Cargar tickets desde Firestore
        const ticketsQuery = query(collection(dbInstance, 'tickets'), orderBy('fechaCreacion', 'desc'));
        const querySnapshot = await getDocs(ticketsQuery);
        const ticketsActualizados = [];
        querySnapshot.forEach(doc => {
            ticketsActualizados.push({ id: doc.id, ...doc.data() });
        });
        
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

// Hacer función global
window.actualizarBadgeTickets = actualizarBadgeTickets;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Detectar si estamos en el sistema secure
    const isSecure = window.location.pathname.includes('secure') || 
                    window.location.pathname.includes('loginsecure') ||
                    window.location.pathname.includes('indexsecure');
    
    // Esperar a que el authManager correcto esté disponible
    const waitForAuth = () => {
        let authManager = null;
        
        if (isSecure) {
            // Priorizar secureAuthManager en sistema secure
            if (window.secureAuthManager && window.secureAuthManager.isAuthenticated()) {
                authManager = window.secureAuthManager;
            } else if (window.authManager && window.authManager.isAuthenticated()) {
                authManager = window.authManager;
            }
        } else {
            // Sistema legacy
            if (window.authManager && window.authManager.isAuthenticated()) {
                authManager = window.authManager;
            }
        }
        
        if (authManager) {
            // Actualizar badge inmediatamente (múltiples intentos para asegurar que se muestre)
            setTimeout(() => {
                actualizarBadgeTickets();
            }, 500);
            setTimeout(() => {
                actualizarBadgeTickets();
            }, 1500);
            setTimeout(() => {
                actualizarBadgeTickets();
            }, 3000);
            
            // Actualizar badge cada 30 segundos
            setInterval(() => {
                actualizarBadgeTickets();
            }, 30000);
        } else {
            setTimeout(waitForAuth, 200);
        }
    };
    
    waitForAuth();
});

