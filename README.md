# Proyecto EcoPlagas - Sistema Web

Sistema web completo para gestión de empleados, inventario, reportes gerenciales y más.

## 🚀 Inicio Rápido

### Primera Vez - Configuración

1. **Crear repositorio en GitHub**:
   - Ve a [github.com](https://github.com) y crea un nuevo repositorio
   - Copia la URL del repositorio

2. **Configurar Git localmente**:
   ```bash
   cd /ruta/al/proyecto/cursor_ai
   ./setup_github.sh
   ```
   O sigue las instrucciones en `GUIA_GITHUB.md`

### Trabajo Diario

#### Al Iniciar el Día
```bash
git pull origin main
```

#### Al Finalizar el Día
```bash
git add .
git commit -m "Descripción de cambios"
git push origin main
firebase deploy --only hosting  # Si deseas desplegar
```

## 📚 Documentación

- **GUIA_GITHUB.md**: Guía completa para trabajar con GitHub desde múltiples computadoras
- **METODOLOGIA_DESCARGA.md**: Cómo descargar archivos desde el hosting

## 🛠️ Tecnologías

- Firebase Hosting
- Firebase Firestore
- Firebase Authentication
- HTML5, CSS3, JavaScript

## 📁 Estructura del Proyecto

```
cursor_ai/
├── public/              # Archivos del sitio web
├── firebase.json       # Configuración de Firebase
├── firestore.rules     # Reglas de seguridad Firestore
├── firestore.indexes.json  # Índices de Firestore
└── ...
```

## 🔐 Seguridad

- Las reglas de Firestore están en `firestore.rules`
- Las configuraciones sensibles NO deben subirse a GitHub
- Usa `.gitignore` para excluir archivos sensibles

## 📝 Scripts Disponibles

- `setup_github.sh`: Configuración inicial de GitHub
- `download_all_from_hosting.sh`: Descargar todos los archivos del hosting
- `download_from_hosting.sh`: Descargar archivos específicos
- `deploy.sh`: Desplegar a Firebase Hosting

## 🤝 Contribuir

Ver `GUIA_GITHUB.md` para el flujo de trabajo completo.
