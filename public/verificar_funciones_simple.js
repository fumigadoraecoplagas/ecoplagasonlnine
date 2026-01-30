// Script simple para verificar funciones
// Ejecuta esto en la consola DESPUÉS de que la página haya cargado completamente

console.log('\n🔍 Verificando funciones...\n');

const funciones = [
    'actualizarResumenFinanciero',
    'actualizarResumenFinancieroNew',
    'actualizarPrecioTotalServicios',
    'obtenerServiciosSeleccionados',
    'obtenerProductosSeleccionados'
];

funciones.forEach(func => {
    if (typeof window[func] === 'function') {
        console.log(`✅ ${func}: DISPONIBLE`);
    } else {
        console.log(`❌ ${func}: NO DISPONIBLE`);
    }
});

console.log('\n💡 Si las funciones no están disponibles:');
console.log('   1. Recarga la página (F5)');
console.log('   2. Espera a que cargue completamente');
console.log('   3. Revisa la consola para errores de JavaScript');
console.log('   4. Vuelve a ejecutar este script\n');
