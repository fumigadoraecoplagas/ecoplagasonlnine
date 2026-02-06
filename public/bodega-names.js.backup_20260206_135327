/**
 * Lógica centralizada para "Friendly Aliases" de Bodegas.
 * Estandariza cómo se muestran los nombres e iconos en todo el sistema.
 */

export function obtenerFriendlyBodega(bodega, empleados = []) {
    if (!bodega) return { nombre: 'Desconocido', icono: 'fa-question', html: 'Desconocido', tipo: 'unknown' };

    let nombre = bodega.nombre || 'S/N';
    let icono = 'fa-warehouse';
    let tipo = bodega.tipo || 'bodega';
    let nombreCorto = nombre;
    let detalleHtml = nombre; // Versión con (Personal), (Especial), etc.

    // 1. Bodega Principal
    if (tipo === 'principal') {
        nombre = 'Bodega Principal';
        icono = 'fa-industry text-primary'; // Azul industrial
        detalleHtml = 'Bodega Principal';
        nombreCorto = 'Principal';
    }
    // 2. Bodega Especial
    else if (tipo === 'especial') {
        // Intentar resolver nombre de empleado si existe
        let nombreEmpleado = '';
        if (bodega.empleadoId) {
            const emp = empleados.find(e => e.username === bodega.empleadoId || e.email === bodega.empleadoId);
            if (emp) {
                nombreEmpleado = `${emp.primerNombre} ${emp.primerApellido.charAt(0)}.`;
            }
        }

        if (!nombreEmpleado) {
             nombreEmpleado = formatearNombreCorto(bodega.nombre);
        }

        nombre = nombreEmpleado;
        icono = 'fa-clock text-warning'; // Amarillo reloj
        detalleHtml = `${nombre} <span class="text-muted small" style="font-size: 0.75em;">(Especial)</span>`;
        nombreCorto = nombre;
    }
    // 3. Bodega Personal / Rutero
    else if (tipo === 'rutero') {
        let nombreEmpleado = '';
        if (bodega.empleadoId) {
            const emp = empleados.find(e => e.username === bodega.empleadoId || e.email === bodega.empleadoId);
            if (emp) {
                nombreEmpleado = `${emp.primerNombre} ${emp.primerApellido.charAt(0)}.`;
            }
        }

        if (!nombreEmpleado) {
             nombreEmpleado = formatearNombreCorto(bodega.nombre);
        }

        nombre = nombreEmpleado;
        icono = 'fa-user text-info'; // Cyan usuario
        detalleHtml = `${nombre} <span class="text-muted small" style="font-size: 0.75em;">(Personal)</span>`;
        nombreCorto = nombre;
    }
    // 4. APV
    else if (tipo === 'apv' || nombre.toLowerCase().includes('apv')) {
        icono = 'fa-truck text-success'; // Verde camión
        // APV suele usar el nombre completo de la bodega, ej: "APV - Placa 123"
        // Podríamos limpiarlo un poco si es muy largo
        nombreCorto = nombre.replace('APV - ', '').substring(0, 15);
        detalleHtml = nombre;
    }
    // 5. Gasto (Caso especial si se pasa como "bodega" simulada)
    else if (tipo === 'gasto') {
        icono = 'fa-money-bill-wave text-danger';
        detalleHtml = nombre;
    }

    return {
        nombre,          // Nombre amigable (ej: "Juan P.")
        nombreCorto,     // Versión muy corta para columnas estrechas
        nombreLargo: bodega.nombre, // Nombre original completo
        icono,           // Clase de FontAwesome con color (ej: "fa-user text-info")
        html: detalleHtml, // HTML para listas o selectores con tags
        tipo             // Tipo normalizado
    };
}

// Función auxiliar interna para limpiar nombres si no hay empleado asociado
function formatearNombreCorto(nombreCompleto) {
    if (!nombreCompleto) return 'S/N';
    
    let nombreLimpio = nombreCompleto;

    if (nombreCompleto.includes(' - ')) {
        const partes = nombreCompleto.split(' - ');
        nombreLimpio = partes[partes.length - 1].trim();
    } else {
        nombreLimpio = nombreCompleto
            .replace(/Insumos Diarios [A-Z]?/i, '')
            .replace(/Insumos D\.? [A-Z]?/i, '')
            .replace(/Personal [A-Z]?/i, '')
            .replace(/Bodega /i, '')
            .trim();
    }
        
    if (!nombreLimpio) return nombreCompleto.substring(0, 10) + '.';

    const palabras = nombreLimpio.split(' ').filter(p => p.length > 0);
    
    if (palabras.length >= 2) {
        return `${palabras[0]} ${palabras[1].charAt(0)}.`;
    } else if (palabras.length === 1) {
        return palabras[0];
    }
    
    return nombreLimpio.substring(0, 12);
}

