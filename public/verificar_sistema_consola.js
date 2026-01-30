// Script de verificación del sistema
// Ejecutar en la consola del navegador cuando estés en cualquier página del sistema (calendario.html, empleados.html, etc.)

(async function verificarSistema() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VERIFICACIÓN DEL SISTEMA');
    console.log('='.repeat(60) + '\n');

    const resultados = {
        exitosos: [],
        errores: [],
        advertencias: []
    };

    // 1. Verificar Firebase
    console.log('1️⃣ Verificando Firebase...');
    try {
        if (typeof firebase !== 'undefined' || window.db) {
            resultados.exitosos.push('✅ Firebase SDK cargado');
            console.log('   ✅ Firebase SDK cargado');
        } else {
            resultados.errores.push('❌ Firebase SDK no está disponible');
            console.log('   ❌ Firebase SDK no está disponible');
        }
    } catch (error) {
        resultados.errores.push(`❌ Error verificando Firebase: ${error.message}`);
        console.log(`   ❌ Error: ${error.message}`);
    }

    // 2. Verificar funciones de calendario
    console.log('\n2️⃣ Verificando funciones de calendario...');
    const funcionesCalendario = [
        'actualizarResumenFinanciero',
        'actualizarResumenFinancieroNew',
        'actualizarPrecioTotalServicios',
        'obtenerServiciosSeleccionados',
        'obtenerProductosSeleccionados'
    ];

    funcionesCalendario.forEach(func => {
        if (typeof window[func] === 'function') {
            resultados.exitosos.push(`✅ Función ${func} disponible`);
            console.log(`   ✅ Función ${func} disponible`);
        } else {
            resultados.errores.push(`❌ Función ${func} NO disponible`);
            console.log(`   ❌ Función ${func} NO disponible`);
        }
    });

    // 3. Verificar funciones de empleados
    console.log('\n3️⃣ Verificando funciones de empleados...');
    const funcionesEmpleados = [
        'cargarEmpleados',
        'mostrarEmpleados',
        'verificarCodigoDesbloqueo'
    ];

    funcionesEmpleados.forEach(func => {
        if (typeof window[func] === 'function') {
            resultados.exitosos.push(`✅ Función ${func} disponible`);
            console.log(`   ✅ Función ${func} disponible`);
        } else {
            resultados.advertencias.push(`⚠️ Función ${func} NO disponible (puede ser normal si no estás en empleados.html)`);
            console.log(`   ⚠️ Función ${func} NO disponible`);
        }
    });

    // 4. Verificar elementos DOM críticos
    console.log('\n4️⃣ Verificando elementos DOM...');
    const elementosCriticos = [
        { id: 'editPrecioTotalServicios', desc: 'Input precio total servicios (editar)' },
        { id: 'newPrecioTotalServicios', desc: 'Input precio total servicios (nuevo)' },
        { id: 'editCostoServicio', desc: 'Input costo servicio (editar)' },
        { id: 'newCostoServicio', desc: 'Input costo servicio (nuevo)' },
        { id: 'totalServicios', desc: 'Display total servicios' },
        { id: 'totalCostos', desc: 'Display total costos' },
        { id: 'netoVenta', desc: 'Display neto venta' }
    ];

    elementosCriticos.forEach(elem => {
        const elemento = document.getElementById(elem.id);
        if (elemento) {
            resultados.exitosos.push(`✅ Elemento ${elem.id} encontrado`);
            console.log(`   ✅ ${elem.desc}: encontrado`);
        } else {
            resultados.advertencias.push(`⚠️ Elemento ${elem.id} no encontrado (puede ser normal si no estás en calendario.html)`);
            console.log(`   ⚠️ ${elem.desc}: no encontrado`);
        }
    });

    // 5. Verificar errores en consola (capturar los últimos)
    console.log('\n5️⃣ Verificando errores en consola...');
    const erroresConsola = [];
    const warningsConsola = [];

    // Interceptar console.error y console.warn temporalmente
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = function(...args) {
        erroresConsola.push(args.join(' '));
        originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
        warningsConsola.push(args.join(' '));
        originalWarn.apply(console, args);
    };

    // Esperar un momento para capturar errores
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Restaurar funciones originales
    console.error = originalError;
    console.warn = originalWarn;

    if (erroresConsola.length === 0 && warningsConsola.length === 0) {
        resultados.exitosos.push('✅ No se encontraron errores nuevos en la consola');
        console.log('   ✅ No se encontraron errores nuevos en la consola');
    } else {
        if (erroresConsola.length > 0) {
            resultados.errores.push(`❌ Se encontraron ${erroresConsola.length} errores en la consola`);
            console.log(`   ❌ Se encontraron ${erroresConsola.length} errores:`);
            erroresConsola.slice(0, 3).forEach(err => {
                console.log(`      - ${err.substring(0, 100)}...`);
            });
        }
        if (warningsConsola.length > 0) {
            resultados.advertencias.push(`⚠️ Se encontraron ${warningsConsola.length} advertencias`);
            console.log(`   ⚠️ Se encontraron ${warningsConsola.length} advertencias`);
        }
    }

    // 6. Verificar página actual
    console.log('\n6️⃣ Información de la página actual...');
    const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
    resultados.exitosos.push(`📄 Página actual: ${paginaActual}`);
    console.log(`   📄 Página actual: ${paginaActual}`);

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN');
    console.log('='.repeat(60));
    console.log(`✅ Exitosos: ${resultados.exitosos.length}`);
    console.log(`❌ Errores: ${resultados.errores.length}`);
    console.log(`⚠️ Advertencias: ${resultados.advertencias.length}`);
    console.log('='.repeat(60));

    if (resultados.errores.length === 0) {
        console.log('\n✅ El sistema está funcionando correctamente');
    } else {
        console.log('\n❌ Se encontraron errores que requieren atención:');
        resultados.errores.forEach(err => console.log(`   ${err}`));
    }

    if (resultados.advertencias.length > 0) {
        console.log('\n⚠️ Advertencias:');
        resultados.advertencias.forEach(adv => console.log(`   ${adv}`));
    }

    console.log('\n💡 NOTA: Algunas funciones y elementos solo están disponibles en páginas específicas.');
    console.log('   - Funciones de calendario: solo en calendario.html');
    console.log('   - Funciones de empleados: solo en empleados.html');
    console.log('   - Para verificar Firebase Auth, necesitas estar autenticado\n');

    return resultados;
})();
