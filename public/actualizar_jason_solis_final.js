// Script para actualizar jason.solis con los datos finales
// Ejecutar en la consola de empleados.html

(async function actualizarJasonSolisFinal() {
    console.log('\n🔧 ========== ACTUALIZANDO jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const db = window.db || getFirestore();
        
        const uid = 'PoIQzKLfLNdojEj1Htyw8dVY1vL2';
        const email = 'rh+jason.solis@ecoplagascr.com';
        const password = 'raiz2490';
        const username = 'jason.solis';
        
        console.log('📋 Datos a configurar:');
        console.log('   UID:', uid);
        console.log('   Email:', email);
        console.log('   Username:', username);
        console.log('   Password:', '[OCULTO]');
        console.log('');
        
        // Obtener documento actual para preservar otros campos
        const docRef = doc(db, 'empleados', 'jason.solis');
        const docSnap = await getDoc(docRef);
        
        let datosExistentes = {};
        if (docSnap.exists()) {
            datosExistentes = docSnap.data();
            console.log('📄 Datos existentes encontrados');
        }
        
        // Actualizar documento con los datos especificados
        console.log('📝 Actualizando documento...');
        await setDoc(docRef, {
            username: username,
            email: email,
            firebaseAuthEmail: email,
            firebaseAuthUID: uid,
            passwordPlain: password, // Guardar contraseña en texto plano para referencia
            firebaseAuthMigrated: true,
            firebaseAuthMigratedAt: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString(),
            // Preservar otros campos importantes
            primerNombre: datosExistentes.primerNombre || 'Jason',
            primerApellido: datosExistentes.primerApellido || 'Solis',
            estado: datosExistentes.estado || 'Activo',
            activo: datosExistentes.activo !== undefined ? datosExistentes.activo : true,
            permisos: datosExistentes.permisos || {},
            departamento: datosExistentes.departamento,
            cargo: datosExistentes.cargo,
            telefono: datosExistentes.telefono,
            vehiculoAsignado: datosExistentes.vehiculoAsignado,
            cedula: datosExistentes.cedula,
            tipoContrato: datosExistentes.tipoContrato,
            fechaCreacion: datosExistentes.fechaCreacion || new Date().toISOString(),
            creadoPor: datosExistentes.creadoPor || 'sistema'
        }, { merge: true });
        
        console.log('✅ Documento actualizado');
        
        // Verificación final
        console.log('\n🔍 Verificación final...');
        const docVerificado = await getDoc(docRef);
        if (docVerificado.exists()) {
            const datos = docVerificado.data();
            console.log('✅ Documento verificado');
            console.log('   Username:', datos.username);
            console.log('   Email:', datos.email);
            console.log('   Firebase Auth Email:', datos.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datos.firebaseAuthUID);
            console.log('   Estado:', datos.estado || datos.activo);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ ACTUALIZACIÓN COMPLETADA');
        console.log('='.repeat(60));
        console.log('UID:', uid);
        console.log('Email:', email);
        console.log('Username:', username);
        console.log('Password:', password);
        console.log('\n📋 Credenciales de acceso:');
        console.log('   Username: ' + username);
        console.log('   Email: ' + email);
        console.log('   Password: ' + password);
        console.log('='.repeat(60) + '\n');
        
        alert('✅ jason.solis actualizado exitosamente!\n\n' +
              'UID: ' + uid + '\n' +
              'Email: ' + email + '\n' +
              'Username: ' + username + '\n' +
              'Password: ' + password + '\n\n' +
              'Ahora puedes intentar iniciar sesión con estas credenciales.');
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('Error: ' + error.message);
    }
})();
