// Script para actualizar SOLO el documento en Firestore
// NO crea usuarios en Firebase Auth, solo actualiza el documento

(async function actualizarDocumentoJasonSolis() {
    console.log('\n🔧 ========== ACTUALIZANDO DOCUMENTO jason.solis ==========\n');
    
    try {
        const { getFirestore, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        
        const db = window.db || getFirestore();
        
        // 1. Obtener documento actual
        console.log('1️⃣ Obteniendo documento actual...');
        const docRef = doc(db, 'empleados', 'jose.solis');
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            console.log('❌ Documento no encontrado');
            alert('Documento no encontrado');
            return;
        }
        
        const datosActuales = docSnap.data();
        console.log('   ✅ Documento encontrado');
        console.log('   Username actual:', datosActuales.username);
        console.log('   Email actual:', datosActuales.email);
        console.log('   Firebase Auth Email actual:', datosActuales.firebaseAuthEmail);
        console.log('   Firebase Auth UID:', datosActuales.firebaseAuthUID || 'N/A');
        
        // 2. Preparar datos actualizados
        console.log('\n2️⃣ Preparando datos actualizados...');
        
        const datosActualizados = {
            username: 'jason.solis', // Cambiar username
            email: 'rh+jason.solis@ecoplagascr.com', // Cambiar email
            firebaseAuthEmail: 'rh+jason.solis@ecoplagascr.com', // Cambiar Firebase Auth Email
            fechaActualizacion: new Date().toISOString()
        };
        
        // Mantener todos los demás campos
        const camposAMantener = [
            'primerNombre', 'primerApellido', 'cedula', 'telefono', 'departamento', 
            'cargo', 'estado', 'activo', 'permisos', 'vehiculoAsignado',
            'firebaseAuthUID', 'firebaseAuthMigrated', 'firebaseAuthMigratedAt',
            'passwordPlain', 'password', 'passwordEncrypted', 'fechaCreacion',
            'creadoPor', 'tipoContrato', 'salario', 'fechaIngreso'
        ];
        
        camposAMantener.forEach(campo => {
            if (datosActuales[campo] !== undefined) {
                datosActualizados[campo] = datosActuales[campo];
            }
        });
        
        console.log('   Username nuevo:', datosActualizados.username);
        console.log('   Email nuevo:', datosActualizados.email);
        console.log('   Firebase Auth Email nuevo:', datosActualizados.firebaseAuthEmail);
        
        // 3. Actualizar documento existente
        console.log('\n3️⃣ Actualizando documento existente...');
        await setDoc(docRef, datosActualizados, { merge: true });
        console.log('   ✅ Documento actualizado (ID: jose.solis)');
        
        // 4. Crear documento con ID correcto (jason.solis)
        console.log('\n4️⃣ Creando documento con ID correcto...');
        const docCorrecto = doc(db, 'empleados', 'jason.solis');
        await setDoc(docCorrecto, {
            ...datosActualizados,
            idDocumentoOriginal: 'jose.solis',
            migradoDesde: 'jose.solis',
            fechaMigracion: new Date().toISOString()
        }, { merge: true });
        console.log('   ✅ Documento creado con ID: jason.solis');
        
        // 5. Verificación
        console.log('\n5️⃣ Verificación...');
        const docVerificado = await getDoc(docCorrecto);
        if (docVerificado.exists()) {
            const datosVerificados = docVerificado.data();
            console.log('   ✅ Documento verificado');
            console.log('   Username:', datosVerificados.username);
            console.log('   Email:', datosVerificados.email);
            console.log('   Firebase Auth Email:', datosVerificados.firebaseAuthEmail);
            console.log('   Firebase Auth UID:', datosVerificados.firebaseAuthUID || 'N/A');
        }
        
        // 6. Resumen
        console.log('\n' + '='.repeat(60));
        console.log('✅ ACTUALIZACIÓN COMPLETADA');
        console.log('='.repeat(60));
        console.log('Documento actualizado:');
        console.log('   ID del documento original: jose.solis (mantenido)');
        console.log('   ID del documento nuevo: jason.solis (creado)');
        console.log('   Username: jason.solis');
        console.log('   Email: rh+jason.solis@ecoplagascr.com');
        console.log('   Firebase Auth Email: rh+jason.solis@ecoplagascr.com');
        console.log('\n⚠️  NOTA:');
        console.log('   El sistema buscará por username, así que usará el documento con ID: jason.solis');
        console.log('   El documento con ID jose.solis se mantiene por compatibilidad');
        console.log('='.repeat(60) + '\n');
        
        alert('✅ Documento actualizado!\n\n' +
              'Username: jason.solis\n' +
              'Email: rh+jason.solis@ecoplagascr.com\n' +
              'Firebase Auth Email: rh+jason.solis@ecoplagascr.com\n\n' +
              'Documentos:\n' +
              '- jose.solis (actualizado)\n' +
              '- jason.solis (creado con ID correcto)');
        
    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('   Código:', error.code);
        console.error('   Mensaje:', error.message);
        alert('Error: ' + error.message);
    }
})();
