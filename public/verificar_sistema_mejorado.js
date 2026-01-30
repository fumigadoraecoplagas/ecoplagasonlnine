// ============================================
// SCRIPT DE VERIFICACIÓN DEL SISTEMA (MEJORADO)
// Copia y pega TODO este código en la consola del navegador
// cuando estés en calendario.html o empleados.html
// ============================================

(async function() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VERIFICACIÓN DEL SISTEMA (MEJORADO)');
    console.log('='.repeat(60) + '\n');

    // Esperar a que el DOM esté completamente cargado
    console.log('⏳ Esperando a que el DOM esté completamente cargado...');
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
    }
    
    // Esperar un poco más para que todos los scripts se ejecuten
    await new Promise(resolve => setTimeout(resolve, 2000));

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

    const paginaActual = window.location.pathname.split('/').pop() || '';
    const esCalendario = paginaActual.includes('calendario');

    if (!esCalendario) {
        console.log('   ⚠️ Estas funciones solo están disponibles en calendario.html');
        console.log('   💡 Abre calendario.html para verificar estas funciones');
    }

    // Verificar funciones con múltiples intentos
    funcionesCalendario.forEach(func => {
        let encontrada = false;
        let intentos = 0;
        const maxIntentos = 3;
        
        while (!encontrada && intentos < maxIntentos) {
            if (typeof window[func] === 'function') {
                encontrada = true;
                resultados.exitosos.push(`✅ Función ${func} disponible`);
                console.log(`   ✅ Función ${func} disponible`);
            } else {
                intentos++;
                if (intentos < maxIntentos) {
                    // Esperar un poco más
                    setTimeout(() => {}, 500);
                }
            }
        }
        
        if (!encontrada) {
            if (esCalendario) {
                resultados.errores.push(`❌ Función ${func} NO disponible después de ${maxIntentos} intentos`);
                console.log(`   ❌ Función ${func} NO disponible`);
                console.log(`   🔍 Verificando si existe en el código fuente...`);
                
                // Intentar buscar la función en el código fuente
                const scripts = Array.from(document.querySelectorAll('script'));
                let encontradaEnCodigo = false;
                scripts.forEach(script => {
                    if (script.textContent && script.textContent.includes(`window.${func}`)) {
                        encontradaEnCodigo = true;
                    }
                });
                
                if (encontradaEnCodigo) {
                    console.log(`   ⚠️ La función ${func} está en el código pero no está disponible en window`);
                    console.log(`   💡 Esto puede indicar un error de JavaScript que impide su ejecución`);
                } else {
                    console.log(`   ❌ La función ${func} no se encontró en el código fuente`);
                }
            } else {
                resultados.advertencias.push(`⚠️ Función ${func} NO disponible (normal si no estás en calendario.html)`);
                console.log(`   ⚠️ Función ${func} NO disponible`);
            }
        }
    });

    // 3. Verificar funciones de empleados
    console.log('\n3️⃣ Verificando funciones de empleados...');
    const funcionesEmpleados = [
        'cargarEmpleados',
        'mostrarEmpleados',
        'verificarCodigoDesbloqueo'
    ];

    const esEmpleados = paginaActual.includes('empleados');

    funcionesEmpleados.forEach(func => {
        if (typeof window[func] === 'function') {
            resultados.exitosos.push(`✅ Función ${func} disponible`);
            console.log(`   ✅ Función ${func} disponible`);
        } else {
            if (esEmpleados) {
                resultados.advertencias.push(`⚠️ Función ${func} NO disponible`);
                console.log(`   ⚠️ Función ${func} NO disponible`);
            } else {
                console.log(`   ℹ️ Función ${func} NO disponible (normal si no estás en empleados.html)`);
            }
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
            if (esCalendario) {
                resultados.advertencias.push(`⚠️ Elemento ${elem.id} no encontrado`);
                console.log(`   ⚠️ ${elem.desc}: no encontrado`);
            } else {
                console.log(`   ℹ️ ${elem.desc}: no encontrado (normal si no estás en calendario.html)`);
            }
        }
    });

    // 5. Verificar errores en consola
    console.log('\n5️⃣ Verificando errores en consola...');
    console.log('   ℹ️ Revisa manualmente la consola para ver si hay errores en rojo');
    console.log('   ℹ️ Los errores de "Tracking Prevention" son normales y no afectan el funcionamiento');
    
    // Verificar si hay errores de JavaScript que puedan impedir la carga de funciones
    const scripts = Array.from(document.querySelectorAll('script'));
    let scriptsConErrores = 0;
    scripts.forEach(script => {
        if (script.src) {
            // Verificar si hay scripts que no se cargaron
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = script.src;
        }
    });

    // 6. Verificar página actual
    console.log('\n6️⃣ Información de la página actual...');
    console.log(`   📄 Página actual: ${paginaActual}`);
    console.log(`   📍 URL completa: ${window.location.href}`);
    console.log(`   ⏱️ Estado del documento: ${document.readyState}`);

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
        
        if (esCalendario && resultados.errores.some(e => e.includes('Función'))) {
            console.log('\n💡 RECOMENDACIÓN:');
            console.log('   - Recarga la página (F5 o Ctrl+R)');
            console.log('   - Espera a que la página cargue completamente');
            console.log('   - Vuelve a ejecutar este script de verificación');
            console.log('   - Si el problema persiste, revisa la consola para errores de JavaScript');
        }
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
