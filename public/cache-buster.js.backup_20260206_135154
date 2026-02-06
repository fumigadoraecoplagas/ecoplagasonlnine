// Sistema de Cache Busting Eco Plagas
// Genera versiones únicas para evitar cache del navegador

// Función para generar un timestamp único
function generateCacheBuster() {
    return Date.now();
}

// Función para actualizar todos los scripts y CSS con cache busting
function applyCacheBusting() {
    const cacheBuster = generateCacheBuster();
    
    // Actualizar todos los scripts
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && !src.includes('?v=') && !src.includes('firebase') && !src.includes('bootstrap') && !src.includes('leaflet') && !src.includes('font-awesome')) {
            const separator = src.includes('?') ? '&' : '?';
            script.setAttribute('src', src + separator + 'v=' + cacheBuster);
        }
    });
    
    // Actualizar todos los CSS
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"][href]');
    stylesheets.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.includes('?v=') && !href.includes('bootstrap') && !href.includes('leaflet') && !href.includes('font-awesome')) {
            const separator = href.includes('?') ? '&' : '?';
            link.setAttribute('href', href + separator + 'v=' + cacheBuster);
        }
    });
    
    // Actualizar meta tags para prevenir cache
    const metaCacheControl = document.querySelector('meta[http-equiv="Cache-Control"]');
    if (!metaCacheControl) {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Cache-Control');
        meta.setAttribute('content', 'no-cache, no-store, must-revalidate');
        document.head.appendChild(meta);
    }
    
    const metaPragma = document.querySelector('meta[http-equiv="Pragma"]');
    if (!metaPragma) {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Pragma');
        meta.setAttribute('content', 'no-cache');
        document.head.appendChild(meta);
    }
    
    const metaExpires = document.querySelector('meta[http-equiv="Expires"]');
    if (!metaExpires) {
        const meta = document.createElement('meta');
        meta.setAttribute('http-equiv', 'Expires');
        meta.setAttribute('content', '0');
        document.head.appendChild(meta);
    }
}

// Aplicar cache busting al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    applyCacheBusting();
});

// También aplicar cuando la página se carga completamente
window.addEventListener('load', function() {
    applyCacheBusting();
});

// Función para forzar recarga sin cache
function forceReload() {
    const cacheBuster = generateCacheBuster();
    const currentUrl = new URL(window.location);
    currentUrl.searchParams.set('_cb', cacheBuster);
    window.location.href = currentUrl.toString();
}

// Exportar funciones para uso global
window.applyCacheBusting = applyCacheBusting;
window.forceReload = forceReload;


