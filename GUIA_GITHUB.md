# Guía de Trabajo con GitHub - Proyecto EcoPlagas

Esta guía explica cómo trabajar con el proyecto desde dos computadoras diferentes usando GitHub.

## 📋 Requisitos Previos

1. **Cuenta de GitHub**: Crea una cuenta en [github.com](https://github.com) si no tienes una
2. **Git instalado**: Verifica que Git esté instalado:
   ```bash
   git --version
   ```
   Si no está instalado, instálalo desde [git-scm.com](https://git-scm.com)

## 🚀 Configuración Inicial (Solo la Primera Vez)

### Paso 1: Crear Repositorio en GitHub

1. Ve a [github.com](https://github.com) e inicia sesión
2. Haz clic en el botón **"+"** (arriba derecha) → **"New repository"**
3. Configura el repositorio:
   - **Repository name**: `ecoplagas-web` (o el nombre que prefieras)
   - **Description**: "Sistema web EcoPlagas - Gestión de empleados, inventario y reportes"
   - **Visibility**: Private (recomendado) o Public
   - **NO marques** "Initialize with README" (ya tenemos archivos)
4. Haz clic en **"Create repository"**
5. **Copia la URL del repositorio** (ejemplo: `https://github.com/tu-usuario/ecoplagas-web.git`)

### Paso 2: Configurar Git en Esta Computadora

```bash
# 1. Navegar al proyecto
cd /Users/desarrollo/Documents/cursor_ai

# 2. Inicializar Git (si no está inicializado)
git init

# 3. Configurar tu identidad (si no lo has hecho antes)
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"

# 4. Agregar todos los archivos al repositorio
git add .

# 5. Hacer el primer commit
git commit -m "Commit inicial - Proyecto EcoPlagas completo"

# 6. Conectar con GitHub (reemplaza con tu URL)
git remote add origin https://github.com/TU-USUARIO/ecoplagas-web.git

# 7. Cambiar a rama main (si es necesario)
git branch -M main

# 8. Subir todo a GitHub
git push -u origin main
```

**Nota**: Si GitHub te pide autenticación, usa un **Personal Access Token** en lugar de tu contraseña:
- Ve a GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Genera un nuevo token con permisos `repo`
- Úsalo como contraseña cuando Git te la pida

## 🔄 Flujo de Trabajo Diario

### 📍 **COMPUTADORA 1** (Esta computadora)

#### Al Iniciar el Día (Obtener Cambios de la Otra Computadora)

```bash
cd /Users/desarrollo/Documents/cursor_ai

# 1. Obtener los últimos cambios de GitHub
git pull origin main

# 2. Verificar que todo esté actualizado
git status
```

#### Durante el Trabajo

Trabaja normalmente en tus archivos. Git rastrea los cambios automáticamente.

#### Al Finalizar el Turno (Guardar en GitHub)

```bash
cd /Users/desarrollo/Documents/cursor_ai

# 1. Ver qué archivos han cambiado
git status

# 2. Agregar todos los cambios
git add .

# 3. Hacer commit con un mensaje descriptivo
git commit -m "Descripción de los cambios realizados"

# 4. Subir cambios a GitHub
git push origin main
```

**Ejemplo de mensajes de commit:**
- `"Corregir inconsistencias en empleados.html - remover funciones obsoletas"`
- `"Actualizar estilos en reportes_gerenciales.html"`
- `"Agregar funcionalidad de tickets para administración"`

### 📍 **COMPUTADORA 2** (Otra Laptop)

#### Primera Vez (Clonar el Repositorio)

```bash
# 1. Navegar a donde quieres el proyecto (ej: Documents)
cd ~/Documents

# 2. Clonar el repositorio desde GitHub
git clone https://github.com/TU-USUARIO/ecoplagas-web.git cursor_ai

# 3. Entrar al directorio
cd cursor_ai

# 4. Instalar dependencias (si es necesario)
npm install
```

#### Al Iniciar el Día (Obtener Cambios de la Otra Computadora)

```bash
cd ~/Documents/cursor_ai

# 1. Obtener los últimos cambios de GitHub
git pull origin main

# 2. Verificar que todo esté actualizado
git status
```

#### Durante el Trabajo

Trabaja normalmente en tus archivos.

#### Al Finalizar el Turno (Guardar en GitHub)

```bash
cd ~/Documents/cursor_ai

# 1. Ver qué archivos han cambiado
git status

# 2. Agregar todos los cambios
git add .

# 3. Hacer commit con un mensaje descriptivo
git commit -m "Descripción de los cambios realizados"

# 4. Subir cambios a GitHub
git push origin main
```

## 🚨 Resolución de Conflictos

Si ambas computadoras modifican el mismo archivo, Git puede generar un conflicto.

### Si Ocurre un Conflicto al Hacer `git pull`:

```bash
# 1. Git te mostrará qué archivos tienen conflictos
git status

# 2. Abre los archivos con conflictos
# Verás marcadores como:
# <<<<<<< HEAD
# (cambios de esta computadora)
# =======
# (cambios de la otra computadora)
# >>>>>>> origin/main

# 3. Edita manualmente para resolver el conflicto
# Elimina los marcadores y deja el código correcto

# 4. Después de resolver todos los conflictos:
git add .
git commit -m "Resolver conflictos de merge"
git push origin main
```

## 📝 Comandos Útiles

### Ver el Historial de Cambios
```bash
git log --oneline
```

### Ver Cambios Específicos de un Archivo
```bash
git diff nombre-del-archivo.html
```

### Deshacer Cambios Locales (antes de hacer commit)
```bash
# Descartar cambios en un archivo específico
git checkout -- nombre-del-archivo.html

# Descartar todos los cambios
git checkout -- .
```

### Ver Estado Actual
```bash
git status
```

### Ver Diferencias Antes de Hacer Commit
```bash
git diff
```

## 🔐 Autenticación con GitHub

### Opción 1: Personal Access Token (Recomendado)

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Selecciona permisos: `repo` (todos los permisos de repositorio)
4. Copia el token generado
5. Úsalo como contraseña cuando Git te la pida

### Opción 2: SSH Keys (Más Seguro)

```bash
# 1. Generar clave SSH
ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"

# 2. Copiar la clave pública
cat ~/.ssh/id_ed25519.pub

# 3. Agregar la clave en GitHub:
# Settings → SSH and GPG keys → New SSH key
# Pega la clave pública

# 4. Cambiar la URL del repositorio a SSH
git remote set-url origin git@github.com:TU-USUARIO/ecoplagas-web.git
```

## 📦 Desplegar Cambios a Firebase

Después de hacer `git push`, puedes desplegar desde cualquier computadora:

```bash
cd /ruta/al/proyecto/cursor_ai

# Desplegar a Firebase Hosting
firebase deploy --only hosting
```

## ✅ Checklist de Trabajo

### Al Iniciar el Día:
- [ ] `git pull origin main` - Obtener últimos cambios
- [ ] Verificar que todo funcione correctamente

### Durante el Trabajo:
- [ ] Trabajar normalmente
- [ ] Hacer commits frecuentes (cada cambio importante)

### Al Finalizar el Turno:
- [ ] `git add .` - Agregar todos los cambios
- [ ] `git commit -m "mensaje descriptivo"` - Guardar cambios
- [ ] `git push origin main` - Subir a GitHub
- [ ] `firebase deploy --only hosting` - Desplegar (opcional)

## 🎯 Mejores Prácticas

1. **Haz commits frecuentes**: No esperes al final del día
2. **Mensajes descriptivos**: Explica qué cambiaste y por qué
3. **Siempre hacer pull antes de trabajar**: Evita conflictos
4. **No hacer push de archivos sensibles**: Usa `.gitignore`
5. **Revisa `git status` antes de hacer commit**: Asegúrate de incluir solo lo necesario

## 🆘 Solución de Problemas

### Error: "Updates were rejected"
```bash
# Esto significa que hay cambios en GitHub que no tienes localmente
git pull origin main
# Resuelve conflictos si los hay
git push origin main
```

### Error: "Authentication failed"
- Verifica tu Personal Access Token
- O configura SSH keys

### Perdí cambios locales
```bash
# Ver commits recientes
git log --oneline

# Recuperar un commit específico
git checkout <hash-del-commit>
```

## 📚 Recursos Adicionales

- [Documentación oficial de Git](https://git-scm.com/doc)
- [Guía de GitHub](https://docs.github.com)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
