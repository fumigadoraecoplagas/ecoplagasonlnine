/**
 * Módulo compartido para lógica de movimientos de inventario
 * Funciona tanto para productos como herramientas
 */

import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    addDoc, 
    serverTimestamp, 
    increment 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Actualiza el stock de una bodega para un producto o herramienta
 * @param {Object} db - Instancia de Firestore
 * @param {string} bodegaId - ID de la bodega
 * @param {string} itemId - ID del producto o herramienta
 * @param {number} cantidad - Cantidad a sumar/restar
 * @param {string} tipoItem - 'producto' o 'herramienta'
 * @param {boolean} esSuma - true para sumar, false para restar
 * @returns {Promise<void>}
 */
export async function actualizarStockBodega(db, bodegaId, itemId, cantidad, tipoItem, esSuma = true) {
    // Usar campos específicos: productoId o herramientaId (NO crear itemId)
    const campoId = tipoItem === 'herramienta' ? 'herramientaId' : 'productoId';
    const campoFiltro = tipoItem === 'herramienta' ? 'herramientaId' : 'productoId';
    
    console.log(`🔍 [actualizarStockBodega] Buscando stock: bodegaId=${bodegaId}, ${campoFiltro}=${itemId}, tipoItem=${tipoItem}, esSuma=${esSuma}, cantidad=${cantidad}`);
    
    const stockQuery = query(
        collection(db, 'stock_bodegas'),
        where('bodegaId', '==', bodegaId),
        where(campoFiltro, '==', itemId)
    );
    
    const stockSnapshot = await getDocs(stockQuery);
    
    console.log(`🔍 [actualizarStockBodega] Resultado query: ${stockSnapshot.empty ? 'VACÍO' : 'ENCONTRADO'} (${stockSnapshot.docs.length} docs)`);
    
    if (!stockSnapshot.empty) {
        // Actualizar stock existente
        const stockDoc = stockSnapshot.docs[0];
        const stockDataActual = stockDoc.data();
        const stockAnterior = stockDataActual.stockActual || 0;
        const cambio = esSuma ? increment(cantidad) : increment(-cantidad);
        
        const updateData = {
            stockActual: cambio,
            ultimaActualizacion: serverTimestamp()
        };
        
        // Agregar campo tipo si no existe (para reportes)
        if (!stockDataActual.tipo) {
            updateData.tipo = tipoItem; // 'producto' o 'herramienta'
        }
        
        await updateDoc(doc(db, 'stock_bodegas', stockDoc.id), updateData);
        
        // Calcular el nuevo stock esperado para el log
        const nuevoStockEsperado = esSuma ? (stockAnterior + cantidad) : (stockAnterior - cantidad);
        const operacion = esSuma ? '+' : '-';
        console.log(`✅ [${tipoItem.toUpperCase()}] Stock ${bodegaId} actualizado: ${stockAnterior} ${operacion} ${cantidad} = ${nuevoStockEsperado} (docId: ${stockDoc.id})`);
    } else if (esSuma) {
        // Crear nuevo registro solo si es suma (no podemos tener stock negativo)
        const stockData = {
            bodegaId: bodegaId,
            [campoId]: itemId, // productoId o herramientaId
            tipo: tipoItem, // Campo para diferenciación en reportes
            stockActual: cantidad,
            stockMinimo: 0,
            createdAt: serverTimestamp(),
            ultimaActualizacion: serverTimestamp()
        };
        
        const nuevoDocRef = await addDoc(collection(db, 'stock_bodegas'), stockData);
        console.log(`✅ [${tipoItem.toUpperCase()}] Nuevo stock creado en ${bodegaId}: ${cantidad} (docId: ${nuevoDocRef.id})`);
    } else {
        const errorMsg = `No se encontró stock en la bodega ${bodegaId} para ${tipoItem} ${itemId}`;
        console.error(`❌ [actualizarStockBodega] ${errorMsg}`);
        throw new Error(errorMsg);
    }
}

/**
 * Procesa un movimiento de inventario y actualiza stocks automáticamente
 * @param {Object} db - Instancia de Firestore
 * @param {Object} movimientoData - Datos del movimiento
 * @param {string} tipoItem - 'producto' o 'herramienta'
 * @returns {Promise<string>} ID del movimiento creado
 */
export async function procesarMovimientoInventario(db, movimientoData, tipoItem) {
    // Agregar campo tipo al movimiento para diferenciación en reportes
    if (!movimientoData.tipoItem) {
        movimientoData.tipoItem = tipoItem; // 'producto' o 'herramienta'
    }
    
    // 1. Crear movimiento
    const movimientoRef = await addDoc(collection(db, 'movimientos_inventario'), movimientoData);
    const movimientoId = movimientoRef.id;
    
    console.log(`✅ [${tipoItem.toUpperCase()}] Movimiento creado: ${movimientoId} (tipo: ${movimientoData.tipo})`);
    
    const itemId = tipoItem === 'herramienta' ? movimientoData.herramientaId : movimientoData.productoId;
    const cantidad = movimientoData.cantidad;
    
    // 2. Actualizar stocks según el tipo de movimiento
    switch (movimientoData.tipo) {
        case 'compra':
            // Compra: Proveedor → Bodega Destino
            // Aumentar stock en destino
            await actualizarStockBodega(db, movimientoData.destino, itemId, cantidad, tipoItem, true);
            break;
            
        case 'transferencia':
            // Transferencia: Bodega Origen → Bodega Destino
            // Reducir stock en origen, aumentar en destino
            // Validar que haya stock en origen antes de procesar
            console.log(`🔄 [TRANSFERENCIA] Procesando: origen=${movimientoData.origen}, destino=${movimientoData.destino}, itemId=${itemId}, tipoItem=${tipoItem}, cantidad=${cantidad}`);
            
            const campoFiltroOrigen = tipoItem === 'herramienta' ? 'herramientaId' : 'productoId';
            const stockOrigenQuery = query(
                collection(db, 'stock_bodegas'),
                where('bodegaId', '==', movimientoData.origen),
                where(campoFiltroOrigen, '==', itemId)
            );
            const stockOrigenSnapshot = await getDocs(stockOrigenQuery);
            
            console.log(`🔍 [TRANSFERENCIA] Query origen: bodegaId=${movimientoData.origen}, ${campoFiltroOrigen}=${itemId}, resultado=${stockOrigenSnapshot.empty ? 'VACÍO' : 'ENCONTRADO'} (${stockOrigenSnapshot.docs.length} docs)`);
            
            if (stockOrigenSnapshot.empty) {
                const errorMsg = `No hay stock disponible en la bodega origen para ${tipoItem === 'herramienta' ? 'herramienta' : 'producto'} ${itemId}`;
                console.error(`❌ [TRANSFERENCIA] ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            const stockOrigenData = stockOrigenSnapshot.docs[0].data();
            const stockDisponible = stockOrigenData.stockActual || 0;
            
            console.log(`📊 [TRANSFERENCIA] Stock disponible en origen: ${stockDisponible}, cantidad solicitada: ${cantidad}`);
            
            if (stockDisponible < cantidad) {
                const errorMsg = `Stock insuficiente en bodega origen. Disponible: ${stockDisponible}, Solicitado: ${cantidad}`;
                console.error(`❌ [TRANSFERENCIA] ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            console.log(`⬇️ [TRANSFERENCIA] Reduciendo stock en origen: ${movimientoData.origen}`);
            await actualizarStockBodega(db, movimientoData.origen, itemId, cantidad, tipoItem, false);
            
            console.log(`⬆️ [TRANSFERENCIA] Aumentando stock en destino: ${movimientoData.destino}`);
            await actualizarStockBodega(db, movimientoData.destino, itemId, cantidad, tipoItem, true);
            
            console.log(`✅ [TRANSFERENCIA] Transferencia completada exitosamente`);
            break;
            
        case 'gasto':
            // Gasto: Bodega Origen → Cuenta de Gasto
            // Reducir stock en origen
            await actualizarStockBodega(db, movimientoData.origen, itemId, cantidad, tipoItem, false);
            break;
            
        case 'reversion':
            // Reversión: Movimiento Original → Bodega Destino
            // Aumentar stock en destino
            await actualizarStockBodega(db, movimientoData.destino, itemId, cantidad, tipoItem, true);
            break;
            
        default:
            console.warn(`⚠️ Tipo de movimiento desconocido: ${movimientoData.tipo}`);
    }
    
    return movimientoId;
}

/**
 * Valida que haya stock suficiente antes de un movimiento
 * @param {Object} db - Instancia de Firestore
 * @param {string} bodegaId - ID de la bodega
 * @param {string} itemId - ID del producto o herramienta
 * @param {number} cantidadRequerida - Cantidad necesaria
 * @param {string} tipoItem - 'producto' o 'herramienta'
 * @returns {Promise<{valido: boolean, stockDisponible: number}>}
 */
export async function validarStockDisponible(db, bodegaId, itemId, cantidadRequerida, tipoItem) {
    // Usar campos específicos: productoId o herramientaId
    const campoFiltro = tipoItem === 'herramienta' ? 'herramientaId' : 'productoId';
    
    const stockQuery = query(
        collection(db, 'stock_bodegas'),
        where('bodegaId', '==', bodegaId),
        where(campoFiltro, '==', itemId)
    );
    
    const stockSnapshot = await getDocs(stockQuery);
    
    if (stockSnapshot.empty) {
        return { valido: false, stockDisponible: 0 };
    }
    
    const stockDoc = stockSnapshot.docs[0];
    const stockActual = stockDoc.data().stockActual || 0;
    
    return {
        valido: stockActual >= cantidadRequerida,
        stockDisponible: stockActual
    };
}

/**
 * Obtiene el nombre de un origen/destino (bodega, cuenta de gasto, proveedor)
 * @param {string} id - ID del origen/destino
 * @param {Array} bodegas - Lista de bodegas
 * @param {Array} cuentasGasto - Lista de cuentas de gasto
 * @param {Array} proveedores - Lista de proveedores
 * @returns {string} Nombre del origen/destino
 */
export function obtenerNombreOrigenDestino(id, bodegas = [], cuentasGasto = [], proveedores = []) {
    if (!id) return 'N/A';
    
    // Buscar en bodegas
    const bodega = bodegas.find(b => b.id === id);
    if (bodega) return bodega.nombre;
    
    // Buscar en cuentas de gasto
    const cuenta = cuentasGasto.find(c => c.id === id);
    if (cuenta) return cuenta.nombre;
    
    // Buscar en proveedores
    const proveedor = proveedores.find(p => p.id === id);
    if (proveedor) return proveedor.nombre;
    
    return id; // Si no se encuentra, devolver el ID
}

/**
 * Determina si un destino es una cuenta de gasto
 * @param {string} destinoId - ID del destino
 * @param {Array} cuentasGasto - Lista de cuentas de gasto
 * @returns {boolean}
 */
export function esCuentaGasto(destinoId, cuentasGasto = []) {
    return cuentasGasto.some(c => c.id === destinoId);
}

