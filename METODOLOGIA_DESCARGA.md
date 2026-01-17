# Metodología de Descarga del Sitio Web

## 📋 Resumen

**Respuesta directa:** Se descarga como **usuario público** desde `https://ecoplagas.online` o `https://cursorwebapp-f376d.web.app` **SIN necesidad de credenciales**.

Firebase Hosting sirve los archivos estáticos públicamente, por lo que cualquier herramienta de descarga (curl, wget, navegador) puede acceder sin autenticación.

## 🔧 Metodología Actual

### Opción 1: Script Automático (Recomendado)

Existen dos scripts bash en el directorio raíz del proyecto:

#### A) `download_from_hosting.sh` - Descarga selectiva
- Descarga solo archivos HTML principales específicos
- Pregunta antes de reemplazar archivos locales
- Útil para actualizar archivos específicos

**Uso:**
```bash
cd /ruta/al/proyecto/cursor_ai
chmod +x download_from_hosting.sh
./download_from_hosting.sh
```

#### B) `download_all_from_hosting.sh` - Descarga completa
- Descarga TODOS los archivos HTML, JS, CSS del sitio
- Reemplaza automáticamente los archivos locales
- Útil para sincronización completa

**Uso:**
```bash
cd /ruta/al/proyecto/cursor_ai
chmod +x download_all_from_hosting.sh
./download_all_from_hosting.sh
```

### Opción 2: Descarga Manual con curl/wget

Si necesitas descargar archivos específicos manualmente:

```bash
# Ejemplo: Descargar un archivo específico
curl -o public/empleados.html https://ecoplagas.online/empleados.html

# O usando wget
wget -O public/empleados.html https://ecoplagas.online/empleados.html
```

### Opción 3: Usando Cursor AI directamente

Cursor AI puede usar herramientas web para acceder al sitio y descargar archivos. La metodología es:

1. **Acceso público**: No se requieren credenciales
2. **URL base**: `https://ecoplagas.online` o `https://cursorwebapp-f376d.web.app`
3. **Herramientas**: curl, wget, o herramientas de navegación web

## 📝 Configuración para Otra Computadora con Cursor AI

### Paso 1: Clonar/Acceder al Proyecto

```bash
# Si tienes el proyecto en Git
git clone [URL_DEL_REPOSITORIO]
cd cursor_ai

# O si ya tienes el proyecto local
cd /ruta/al/proyecto/cursor_ai
```

### Paso 2: Hacer Ejecutables los Scripts

```bash
chmod +x download_from_hosting.sh
chmod +x download_all_from_hosting.sh
```

### Paso 3: Ejecutar el Script de Descarga

```bash
# Para descarga completa (recomendado la primera vez)
./download_all_from_hosting.sh

# O para descarga selectiva
./download_from_hosting.sh
```

### Paso 4: Verificar la Descarga

Los archivos se descargan en un directorio temporal y luego se copian a `public/`. Verifica que los archivos estén actualizados:

```bash
ls -la public/*.html
```

## 🔍 Detalles Técnicos

### URLs Disponibles

1. **Dominio personalizado**: `https://ecoplagas.online`
2. **Firebase Hosting**: `https://cursorwebapp-f376d.web.app`

Ambas URLs apuntan al mismo contenido y son accesibles públicamente.

### Estructura de Descarga

```
cursor_ai/
├── download_from_hosting.sh          # Script selectivo
├── download_all_from_hosting.sh      # Script completo
├── public/                            # Archivos descargados aquí
│   ├── empleados.html
│   ├── calendario.html
│   └── ...
└── temp_download_YYYYMMDD_HHMMSS/    # Directorio temporal
```

### Cómo Funcionan los Scripts

1. **Crea directorio temporal** con timestamp
2. **Descarga archivos** usando `curl` desde la URL pública
3. **Verifica** que los archivos se descargaron correctamente (HTTP 200)
4. **Reemplaza** archivos locales con los descargados
5. **Limpia** directorios temporales

### Ejemplo de Comando curl Interno

```bash
curl -s -o "temp_download/empleados.html" \
     -w "%{http_code}" \
     "https://ecoplagas.online/empleados.html"
```

## ⚠️ Consideraciones Importantes

1. **No se requieren credenciales**: Firebase Hosting es público por defecto
2. **Archivos estáticos**: Solo se pueden descargar archivos HTML, JS, CSS servidos estáticamente
3. **No incluye**: Configuraciones de Firebase, reglas de Firestore, etc. (esos están en el repo)
4. **Backup automático**: Los scripts crean directorios temporales antes de reemplazar

## 🚀 Para Cursor AI en Otra Computadora

### Instrucciones para Cursor AI:

```
Para descargar la última versión del sitio:

1. Usa el script: ./download_all_from_hosting.sh
2. O descarga manualmente desde: https://ecoplagas.online
3. NO se requieren credenciales - es acceso público
4. Los archivos se descargan a: public/
```

### Comando Directo para Cursor AI:

```bash
cd /ruta/al/proyecto/cursor_ai && \
chmod +x download_all_from_hosting.sh && \
./download_all_from_hosting.sh
```

## 📚 Referencias

- Scripts existentes: `download_from_hosting.sh`, `download_all_from_hosting.sh`
- URL pública: `https://ecoplagas.online`
- Directorio destino: `public/`
