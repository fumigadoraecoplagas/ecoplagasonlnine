// Script para resetear la contraseña de jason.solis
// Ejecutar en la consola de empleados.html

(async function resetearPasswordJason() {
    console.log('\n🔧 ========== RESETEAR CONTRASEÑA ==========\n');
    
    try {
        const { getAuth, sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        
        const auth = window.firebaseAuth || getAuth();
        const email = 'rh+jason.solis@ecoplagascr.com';
        
        console.log('📧 Enviando email de reseteo de contraseña...');
        console.log('Email:', email);
        
        try {
            await sendPasswordResetEmail(auth, email);
            console.log('✅ Email de reseteo enviado');
            console.log('Revisa el correo electrónico para resetear la contraseña');
            
            alert('✅ Email de reseteo enviado!\n\n' +
                  'Revisa el correo: ' + email + '\n' +
                  'Sigue las instrucciones para resetear la contraseña.\n\n' +
                  'Después de resetear, usa la nueva contraseña para iniciar sesión.');
        } catch (error) {
            console.log('❌ Error:', error.code);
            console.log('Mensaje:', error.message);
            
            if (error.code === 'auth/user-not-found') {
                alert('El usuario no existe en Firebase Auth.');
            } else {
                alert('Error: ' + error.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
})();
