// Script para preparar el cambio de email
// Ejecutar en la consola de empleados.html

(async function prepararCambioEmail() {
    console.log('\n🔧 ========== PREPARANDO CAMBIO DE EMAIL ==========\n');
    
    try {
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const db = window.db || getFirestore();
        const emailNuevo = 'desarrolloecoplagas@gmail.com';
        const uidExistente = 'PoIQzKLfLNdojEj1Htyw8dVY1vL2';
        
        console.log('📋 Preparando documento para cambio de email...');
        console.log('Email nuevo:', emailNuevo);
        console.log('UID:', uidExistente);
        
        // Actualizar documento con el email nuevo
        const docRef = doc(db, 'empleados', 'jason.solis');
        await setDoc(docRef, {
            username: 'jason.solis',
            email: emailNuevo,
            firebaseAuthEmail: emailNuevo, // Preparado para cuando se cambie en Firebase Auth
            firebaseAuthUID: uidExistente,
            emailPendienteCambio: true,
            emailAnterior: 'rh+jason.solis@ecoplagascr.com',
            emailNuevo: emailNuevo,
            fechaPreparacionCambio: new Date().toISOString(),
            firebaseAuthMigrated: true,
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
        console.log('✅ DOCUMENTO PREPARADO');
        console.log('='.repeat(60));
        console.log('\n⚠️  IMPORTANTE:');
        console.log('El documento está preparado con el email nuevo.');
        console.log('PERO necesitas cambiar el email en Firebase Auth usando:');
        console.log('1. Firebase Console (si obtienes acceso)');
        console.log('2. O Firebase Admin SDK con clave de servicio');
        console.log('\nPara usar Firebase Admin SDK:');
        console.log('1. Obtén la clave de servicio desde Firebase Console');
        console.log('2. Ejecuta: node cambiar_email_y_resetear.js');
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Documento preparado!\n\n' +
              'Email configurado: ' + emailNuevo + '\n\n' +
              '⚠️ IMPORTANTE:\n' +
              'Necesitas cambiar el email en Firebase Auth.\n' +
              'El documento está listo, pero el login seguirá usando el email viejo hasta que cambies el email en Firebase Auth.');
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
