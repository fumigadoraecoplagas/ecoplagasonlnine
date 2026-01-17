// Código para ejecutar directamente en la consola del navegador
// Copia y pega todo este código en la consola de https://ecoplagas.online/empleados.html

(async function() {
    console.group('🔧 Corrigiendo documento de Pablo Paniagua');
    
    try {
        const { getFirestore, doc, getDoc, collection, getDocs, setDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const db = getFirestore();
        
        const username = 'pablo.paniagua';
        const docRef = doc(db, 'empleados', username);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            // El documento existe, solo verificar y corregir permisos
            const documento = { id: docSnap.id, ...docSnap.data() };
            console.log('✅ Documento encontrado:', documento.id);
            
            let necesitaActualizacion = false;
            const actualizaciones = {};
            
            // Verificar permiso empleados
            if (!documento.permisos?.empleados) {
                console.log('📝 Agregando permiso "empleados: true"');
                actualizaciones.permisos = {
                    ...(documento.permisos || {}),
                    empleados: true
                };
                necesitaActualizacion = true;
            }
            
            // Verificar que tenga username
            if (!documento.username || documento.username !== username) {
                console.log('📝 Corrigiendo username');
                actualizaciones.username = username;
                necesitaActualizacion = true;
            }
            
            if (necesitaActualizacion) {
                await updateDoc(docRef, actualizaciones);
                console.log('✅ Documento actualizado correctamente');
                alert('✅ Documento de pablo.paniagua corregido exitosamente.\n\nRecarga la página y luego ejecuta: window.crearDocumentoSebastianTrejos()');
            } else {
                console.log('✅ El documento ya está correctamente configurado');
                alert('✅ El documento de pablo.paniagua ya está correctamente configurado.\n\nAhora puedes ejecutar: window.crearDocumentoSebastianTrejos()');
            }
        } else {
            // El documento no existe, buscar en todos los documentos
            console.log('🔍 Documento no encontrado, buscando en todos los documentos...');
            const empleadosSnapshot = await getDocs(collection(db, 'empleados'));
            
            let documentoEncontrado = null;
            empleadosSnapshot.forEach(doc => {
                const emp = { id: doc.id, ...doc.data() };
                if (emp.username === username || 
                    (emp.primerNombre === 'Pablo' && emp.primerApellido === 'Paniagua')) {
                    documentoEncontrado = emp;
                }
            });
            
            if (documentoEncontrado) {
                console.log('✅ Documento encontrado con ID diferente:', documentoEncontrado.id);
                console.log('📝 Creando nuevo documento con ID correcto...');
                
                // Crear nuevo documento con ID correcto
                const nuevoDocumento = {
                    ...documentoEncontrado,
                    username: username,
                    permisos: {
                        ...(documentoEncontrado.permisos || {}),
                        empleados: true
                    },
                    updatedAt: new Date().toISOString()
                };
                
                // Eliminar el campo id del objeto para no incluirlo en los datos
                delete nuevoDocumento.id;
                
                await setDoc(docRef, nuevoDocumento);
                console.log('✅ Nuevo documento creado con ID correcto');
                alert('✅ Documento de pablo.paniagua creado con ID correcto.\n\nRecarga la página y luego ejecuta: window.crearDocumentoSebastianTrejos()');
            } else {
                // No se encontró ningún documento, crear uno básico
                console.log('📝 No se encontró documento, creando uno básico...');
                const documentoBasico = {
                    primerNombre: 'Pablo',
                    primerApellido: 'Paniagua',
                    username: username,
                    estado: 'Activo',
                    tipoContrato: 'Mensual',
                    permisos: {
                        empleados: true,
                        calendario: true,
                        registro_horas: true,
                        tickets: true,
                        reportes_gerenciales: true,
                        operario_bodega: true,
                        administrador_bodega: true,
                        recursos_humanos: true
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                await setDoc(docRef, documentoBasico);
                console.log('✅ Documento básico creado');
                alert('✅ Documento básico de pablo.paniagua creado.\n\nRecarga la página y luego ejecuta: window.crearDocumentoSebastianTrejos()');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            alert('❌ Error de permisos: No tienes permisos para modificar documentos.\n\n' +
                  'Necesitas que un administrador con acceso directo a Firestore corrija el documento manualmente.\n\n' +
                  'O verifica que estés autenticado correctamente.');
        } else {
            alert('❌ Error: ' + error.message);
        }
    }
    
    console.groupEnd();
})();
