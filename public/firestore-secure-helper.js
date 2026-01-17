// Helper de Firestore para Módulos Secure - Eco Plagas
// Funciones helper para operaciones Firestore con protección CSRF
// NO afecta sistema legacy
// NOTA: Este archivo debe cargarse después de que Firebase Firestore esté inicializado
// y después de csrf-token.js

class FirestoreSecureHelper {
    constructor(db) {
        this.db = db;
        
        // Obtener funciones de Firestore del módulo cargado
        // Asumimos que Firebase Firestore ya está cargado
        // Si no, el código que usa este helper debe cargar los módulos primero
        // Obtener instancia de CSRF Protection
        this.csrfProtection = window.csrfProtection;
        
        if (!this.csrfProtection) {
            console.warn('⚠️ CSRF Protection no está disponible. Cargando csrf-token.js...');
            // Si no está disponible, intentar cargarlo
            const script = document.createElement('script');
            script.src = 'csrf-token.js';
            script.onload = () => {
                this.csrfProtection = window.csrfProtection;
                console.log('✅ CSRF Protection cargado');
            };
            document.head.appendChild(script);
        }
    }

    // Agregar token CSRF a datos
    addCSRFToken(data) {
        if (!this.csrfProtection) {
            console.warn('⚠️ CSRF Protection no disponible, continuando sin token');
            return data;
        }
        
        const dataWithCSRF = { ...data };
        this.csrfProtection.addTokenToData(dataWithCSRF);
        return dataWithCSRF;
    }

    // Validar token CSRF
    validateCSRFToken(token) {
        if (!this.csrfProtection) {
            console.warn('⚠️ CSRF Protection no disponible, saltando validación');
            return true;
        }
        
        return this.csrfProtection.validateToken(token);
    }

    // Agregar documento con CSRF
    // Requiere que Firebase Firestore esté cargado: import { collection, addDoc } from 'firebase/firestore'
    async addDocWithCSRF(collectionPath, data, firestoreModule = null) {
        try {
            // Si se proporciona el módulo, usarlo; si no, asumir que está en el scope global
            const { collection, addDoc } = firestoreModule || window.firestore || {};
            
            if (!collection || !addDoc) {
                throw new Error('Firebase Firestore no está disponible. Carga el módulo primero.');
            }
            
            // Agregar token CSRF
            const dataWithCSRF = this.addCSRFToken(data);
            
            // Validar origen de la request
            if (this.csrfProtection && !this.csrfProtection.validateOrigin()) {
                throw new Error('Origen de la request no válido');
            }
            
            const collectionRef = collection(this.db, collectionPath);
            const docRef = await addDoc(collectionRef, dataWithCSRF);
            
            console.log('✅ Documento agregado con CSRF:', docRef.id);
            return docRef;
        } catch (error) {
            console.error('❌ Error agregando documento con CSRF:', error);
            throw error;
        }
    }

    // Establecer documento con CSRF
    // Requiere que Firebase Firestore esté cargado
    async setDocWithCSRF(docPath, data, options = {}, firestoreModule = null) {
        try {
            const { doc, setDoc } = firestoreModule || window.firestore || {};
            
            if (!doc || !setDoc) {
                throw new Error('Firebase Firestore no está disponible.');
            }
            
            // Agregar token CSRF
            const dataWithCSRF = this.addCSRFToken(data);
            
            // Validar origen de la request
            if (this.csrfProtection && !this.csrfProtection.validateOrigin()) {
                throw new Error('Origen de la request no válido');
            }
            
            const docRef = doc(this.db, docPath);
            await setDoc(docRef, dataWithCSRF, options);
            
            console.log('✅ Documento establecido con CSRF:', docPath);
            return docRef;
        } catch (error) {
            console.error('❌ Error estableciendo documento con CSRF:', error);
            throw error;
        }
    }

    // Actualizar documento con CSRF
    // Requiere que Firebase Firestore esté cargado
    async updateDocWithCSRF(docPath, data, firestoreModule = null) {
        try {
            const { doc, updateDoc } = firestoreModule || window.firestore || {};
            
            if (!doc || !updateDoc) {
                throw new Error('Firebase Firestore no está disponible.');
            }
            
            // Agregar token CSRF
            const dataWithCSRF = this.addCSRFToken(data);
            
            // Validar origen de la request
            if (this.csrfProtection && !this.csrfProtection.validateOrigin()) {
                throw new Error('Origen de la request no válido');
            }
            
            const docRef = doc(this.db, docPath);
            await updateDoc(docRef, dataWithCSRF);
            
            console.log('✅ Documento actualizado con CSRF:', docPath);
            return docRef;
        } catch (error) {
            console.error('❌ Error actualizando documento con CSRF:', error);
            throw error;
        }
    }

    // Eliminar documento con validación CSRF
    // Requiere que Firebase Firestore esté cargado
    async deleteDocWithCSRF(docPath, csrfToken = null, firestoreModule = null) {
        try {
            const { doc, deleteDoc } = firestoreModule || window.firestore || {};
            
            if (!doc || !deleteDoc) {
                throw new Error('Firebase Firestore no está disponible.');
            }
            
            // Validar token CSRF si se proporciona
            if (csrfToken && !this.validateCSRFToken(csrfToken)) {
                throw new Error('Token CSRF inválido');
            }
            
            // Validar origen de la request
            if (this.csrfProtection && !this.csrfProtection.validateOrigin()) {
                throw new Error('Origen de la request no válido');
            }
            
            const docRef = doc(this.db, docPath);
            await deleteDoc(docRef);
            
            console.log('✅ Documento eliminado con validación CSRF:', docPath);
            return docRef;
        } catch (error) {
            console.error('❌ Error eliminando documento con CSRF:', error);
            throw error;
        }
    }

    // Obtener documento (sin CSRF, solo lectura)
    // Requiere que Firebase Firestore esté cargado
    async getDocSecure(docPath, firestoreModule = null) {
        try {
            const { doc, getDoc } = firestoreModule || window.firestore || {};
            
            if (!doc || !getDoc) {
                throw new Error('Firebase Firestore no está disponible.');
            }
            
            const docRef = doc(this.db, docPath);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            } else {
                return null;
            }
        } catch (error) {
            console.error('❌ Error obteniendo documento:', error);
            throw error;
        }
    }

    // Obtener documentos de una colección (sin CSRF, solo lectura)
    // Requiere que Firebase Firestore esté cargado
    async getDocsSecure(collectionPath, constraints = [], firestoreModule = null) {
        try {
            const { collection, query, where, orderBy, limit, getDocs } = firestoreModule || window.firestore || {};
            
            if (!collection || !query || !getDocs) {
                throw new Error('Firebase Firestore no está disponible.');
            }
            
            const collectionRef = collection(this.db, collectionPath);
            let q = query(collectionRef);
            
            // Aplicar constraints (where, orderBy, limit, etc.)
            constraints.forEach(constraint => {
                if (constraint.type === 'where' && where) {
                    q = query(q, where(constraint.field, constraint.operator, constraint.value));
                } else if (constraint.type === 'orderBy' && orderBy) {
                    q = query(q, orderBy(constraint.field, constraint.direction || 'asc'));
                } else if (constraint.type === 'limit' && limit) {
                    q = query(q, limit(constraint.value));
                }
            });
            
            const querySnapshot = await getDocs(q);
            const docs = [];
            querySnapshot.forEach(doc => {
                docs.push({ id: doc.id, ...doc.data() });
            });
            
            return docs;
        } catch (error) {
            console.error('❌ Error obteniendo documentos:', error);
            throw error;
        }
    }
}

// Exportar clase
window.FirestoreSecureHelper = FirestoreSecureHelper;

console.log('🛡️ Firestore Secure Helper cargado - Operaciones Firestore con CSRF activas');

