// Script para intentar resetear contraseña usando la API de Firebase Auth
// Ejecutar en la consola del navegador (empleados.html)
// NOTA: Esto enviará el email de reseteo al email asociado con la cuenta

(async function intentarResetearPassword() {
    console.log('\n🔧 ========== INTENTANDO RESETEAR CONTRASEÑA ==========\n');
    
    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const auth = window.firebaseAuth || getAuth();
        const email = 'rh+jason.solis@ecoplagascr.com';
        
        console.log('📧 Enviando email de reseteo de contraseña...');
        console.log('Email:', email);
        console.log('\n⚠️  NOTA: El email se enviará a: ' + email);
        console.log('Si no tienes acceso a ese email, necesitas que alguien con acceso a Firebase Console resetee la contraseña.');
        console.log('');
        
        try {
            await sendPasswordResetEmail(auth, email);
            console.log('✅ Email de reseteo enviado exitosamente');
            console.log('\n📨 Revisa el correo: ' + email);
            console.log('Sigue las instrucciones en el email para resetear la contraseña.');
            console.log('\n💡 Después de resetear, usa la nueva contraseña para iniciar sesión.');
            
            alert('✅ Email de reseteo enviado!\n\n' +
                  'Revisa el correo: ' + email + '\n\n' +
                  'Sigue las instrucciones para resetear la contraseña.\n\n' +
                  'Después de resetear, podrás iniciar sesión con:\n' +
                  'Username: jason.solis\n' +
                  'Email: ' + email);
            
        } catch (error) {
            console.log('❌ Error:', error.code);
            console.log('Mensaje:', error.message);
            
            if (error.code === 'auth/user-not-found') {
                console.log('\n⚠️  El usuario no existe en Firebase Auth');
                alert('El usuario no existe en Firebase Auth.');
            } else if (error.code === 'auth/invalid-email') {
                console.log('\n⚠️  El email es inválido');
                alert('El email es inválido.');
            } else {
                console.log('\n⚠️  Error desconocido');
                alert('Error: ' + error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        alert('Error: ' + error.message);
    }
})();
