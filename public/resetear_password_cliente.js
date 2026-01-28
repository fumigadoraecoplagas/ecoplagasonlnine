// Script para resetear contraseña desde el cliente (sin Firebase Admin SDK)
// Ejecutar en la consola de empleados.html o iniciar_sesion.html

(async function resetearPasswordCliente() {
    console.log('\n🔧 ========== RESETEAR CONTRASEÑA DESDE CLIENTE ==========\n');
    
    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const auth = window.firebaseAuth || getAuth();
        const db = window.db || getFirestore();
        
        const email = 'rh+jason.solis@ecoplagascr.com';
        const emailDestino = 'desarrolloecoplagas@gmail.com';
        
        console.log('📧 Enviando email de reseteo de contraseña...');
        console.log('Email del usuario:', email);
        console.log('⚠️  NOTA: El email se enviará a:', email);
        console.log('   (Firebase Auth solo puede enviar al email asociado con la cuenta)');
        console.log('');
        
        try {
            // Enviar email de reseteo
            await sendPasswordResetEmail(auth, email);
            
            console.log('✅ Email de reseteo enviado exitosamente');
            console.log('');
            console.log('📨 El email se envió a:', email);
            console.log('');
            console.log('💡 OPCIONES:');
            console.log('1. Si tienes acceso al email ' + email + ':');
            console.log('   - Revisa el correo');
            console.log('   - Haz clic en el link de reseteo');
            console.log('   - Establece la contraseña a: raiz2490');
            console.log('');
            console.log('2. Si NO tienes acceso al email ' + email + ':');
            console.log('   - Necesitas que alguien con acceso al email haga el reseteo');
            console.log('   - O necesitas acceso a Firebase Console para cambiar el email');
            console.log('   - O necesitas Firebase Admin SDK con clave de servicio');
            console.log('');
            
            // Actualizar documento con información
            const docRef = doc(db, 'empleados', 'jason.solis');
            await setDoc(docRef, {
                passwordResetEnviado: true,
                passwordResetEnviadoEn: new Date().toISOString(),
                passwordResetEmailDestino: email,
                fechaActualizacion: new Date().toISOString()
            }, { merge: true });
            
            console.log('✅ Documento actualizado con información del reseteo');
            
            alert('✅ Email de reseteo enviado!\n\n' +
                  'El email se envió a: ' + email + '\n\n' +
                  'Si tienes acceso a ese email:\n' +
                  '1. Revisa el correo\n' +
                  '2. Haz clic en el link de reseteo\n' +
                  '3. Establece la contraseña a: raiz2490\n\n' +
                  'Si NO tienes acceso, necesitas:\n' +
                  '- Que alguien con acceso al email haga el reseteo\n' +
                  '- O acceso a Firebase Console');
            
        } catch (error) {
            console.log('❌ Error enviando email:', error.code);
            console.log('Mensaje:', error.message);
            
            if (error.code === 'auth/user-not-found') {
                console.log('\n⚠️  El usuario no existe en Firebase Auth');
                alert('El usuario no existe en Firebase Auth');
            } else if (error.code === 'auth/invalid-email') {
                console.log('\n⚠️  El email es inválido');
                alert('El email es inválido');
            } else {
                console.log('\n⚠️  Error desconocido');
                alert('Error: ' + error.message);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
