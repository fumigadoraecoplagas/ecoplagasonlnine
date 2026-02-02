// SOLUCIÓN SIMPLE: Actualizar documento con el UID que ya tienes
// Ejecutar en la consola de empleados.html
// Esto asume que el UID en el documento es correcto

(async function solucionSimple() {
    console.log('\n🔧 ========== SOLUCIÓN SIMPLE ==========\n');
    
    try {
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const db = window.db || getFirestore();
        
        // El UID que ya está en el documento
        const uidExistente = 'PoIQzKLfLNdojEj1Htyw8dVY1vL2';
        const email = 'rh+jason.solis@ecoplagascr.com';
        
        console.log('📋 Usando UID existente del documento');
        console.log('UID:', uidExistente);
        console.log('Email:', email);
        
        // Actualizar documento asegurando que tiene los datos correctos
        console.log('\n📝 Actualizando documento...');
        const docRef = doc(db, 'empleados', 'jason.solis');
        
        await setDoc(docRef, {
            username: 'jason.solis',
            email: email,
            firebaseAuthEmail: email,
            firebaseAuthUID: uidExistente,
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString()
        }, { merge: true });
        
        console.log('✅ Documento actualizado');
        
        // Verificación
        const docVerificado = await getDoc(docRef);
        if (docVerificado.exists()) {
            const datos = docVerificado.data();
            console.log('\n📄 Datos del documento:');
            console.log('   Username:', datos.username);
            console.log('   Email:', datos.email);
            console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datos.firebaseAuthUID);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ DOCUMENTO ACTUALIZADO');
        console.log('='.repeat(60));
        console.log('\n⚠️  IMPORTANTE:');
        console.log('El documento ahora tiene el UID: ' + uidExistente);
        console.log('Si este UID es correcto, el login debería funcionar.');
        console.log('Si el login sigue fallando, necesitas:');
        console.log('1. Resetear la contraseña desde Firebase Console');
        console.log('2. O usar la contraseña correcta que está configurada');
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Documento actualizado!\n\n' +
              'UID configurado: ' + uidExistente + '\n\n' +
              'Si el login sigue fallando, necesitas resetear la contraseña.\n' +
              'El problema es que la contraseña "raiz2490" no es la correcta.');
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
