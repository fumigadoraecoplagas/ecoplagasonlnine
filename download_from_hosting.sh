#!/bin/bash

# Script para descargar archivos desde Firebase Hosting
# Reemplaza los archivos locales con los del hosting

# URL del hosting (puede usar cualquiera de las dos)
HOSTING_URL="https://ecoplagas.online"
# Alternativa: HOSTING_URL="https://cursorwebapp-f376d.web.app"

PUBLIC_DIR="public"
TEMP_DIR="temp_download"

echo "📥 Descargando archivos desde Firebase Hosting..."
echo "URL: $HOSTING_URL"
echo ""

# Crear directorio temporal
mkdir -p "$TEMP_DIR"

# Lista de archivos principales a descargar (basado en los archivos locales)
FILES=(
    "registro_horas.html"
    "inicio.html"
    "iniciar_sesion.html"
    "calendario.html"
    "empleados.html"
    "edicion_horas.html"
    "tickets.html"
    "encuesta.html"
    "reporte_encuestas.html"
    "reportes_gerenciales.html"
    "404.html"
)

# Descargar archivos HTML principales
echo "Descargando archivos HTML..."
for file in "${FILES[@]}"; do
    echo "  📄 Descargando $file..."
    curl -s -o "$TEMP_DIR/$file" "$HOSTING_URL/$file" 2>&1
    if [ $? -eq 0 ] && [ -s "$TEMP_DIR/$file" ]; then
        echo "    ✅ $file descargado"
    else
        echo "    ⚠️  No se pudo descargar $file (puede no existir en el hosting)"
        rm -f "$TEMP_DIR/$file"
    fi
done

# Preguntar si reemplazar
echo ""
echo "📋 Archivos descargados en: $TEMP_DIR"
echo ""
read -p "¿Deseas reemplazar los archivos locales con los descargados? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🔄 Reemplazando archivos..."
    for file in "${FILES[@]}"; do
        if [ -f "$TEMP_DIR/$file" ]; then
            cp "$TEMP_DIR/$file" "$PUBLIC_DIR/$file"
            echo "  ✅ $file reemplazado"
        fi
    done
    echo ""
    echo "✅ Archivos reemplazados exitosamente"
    echo "🗑️  Limpiando archivos temporales..."
    rm -rf "$TEMP_DIR"
else
    echo "❌ Operación cancelada. Los archivos están en: $TEMP_DIR"
fi
