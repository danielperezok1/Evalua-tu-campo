# Guía de Setup - Evalúa tu Campo

## Opción 1: Ejecutar Localmente (para desarrollo)

### Requisitos
- Python 3 instalado
- O Node.js
- O PHP

### Pasos

#### Con Python 3 (recomendado en Windows)

```bash
# 1. Abrí la carpeta del proyecto en terminal
cd "C:\Users\tu-usuario\Desktop\Evalua tu campo"

# 2. Iniciá el servidor
python -m http.server 8000

# 3. Abrí en el navegador
# http://localhost:8000
```

#### Con Node.js

```bash
# 1. Instalá http-server si no lo tenés
npm install -g http-server

# 2. Iniciá el servidor
http-server -p 8000

# 3. Abrí en el navegador
# http://localhost:8000
```

#### Con PHP

```bash
php -S localhost:8000
```

---

## Opción 2: Publicar en GitHub Pages (GRATIS y permanente)

### Requisitos
- Cuenta de GitHub
- Git instalado
- Terminal/Command Prompt

### Pasos

#### 1. Creá un repositorio en GitHub

1. Ir a https://github.com/new
2. Nombre: `evalua-tu-campo` (o el que prefieras)
3. Descripción: "App web para informes de suelos · Córdoba, Argentina"
4. Marcar: **Public** (necesario para GitHub Pages)
5. Click: **Create repository**

#### 2. Configurá Git localmente

```bash
cd "C:\Users\tu-usuario\Desktop\Evalua tu campo"

# Si no lo hiciste ya, inicializar git
git init
git add .
git commit -m "Initial commit: Evalúa tu Campo MVP"

# Agregá el repositorio remoto (reemplazá tu-usuario)
git remote add origin https://github.com/tu-usuario/evalua-tu-campo.git

# Pushcá al repositorio
git branch -M main
git push -u origin main
```

#### 3. Habilitar GitHub Pages

1. Ir a https://github.com/tu-usuario/evalua-tu-campo/settings
2. En el menú lateral, buscar **Pages**
3. En "Build and deployment":
   - Source: **Deploy from a branch**
   - Branch: **main** / **/ (root)**
   - Click **Save**

#### 4. Esperar 1-2 minutos

GitHub compila y publica automáticamente. Tu app estará en:

```
https://tu-usuario.github.io/evalua-tu-campo/
```

#### 5. (Opcional) Configurar dominio personalizado

Si tenés un dominio:
1. En GitHub Settings → Pages
2. Custom domain: `midominio.com`
3. Agregá un registro CNAME en tu DNS que apunte a `tu-usuario.github.io`

---

## Opción 3: Otros servicios gratuitos

### Netlify (muy fácil, recomendado)

1. Ir a https://app.netlify.com/
2. Click: **New site from Git** (ó drag & drop la carpeta)
3. Conectar GitHub, seleccionar el repo
4. Dejar config por defecto
5. ¡Listo! URL automática: `tu-sitio.netlify.app`

### Vercel

1. Ir a https://vercel.com/new
2. Import Git Repository → conectar GitHub
3. Seleccionar `evalua-tu-campo`
4. Deploy
5. URL: `evalua-tu-campo.vercel.app`

### Surge.sh

```bash
npm install -g surge
surge

# Ingresar email y contraseña
# Especificar carpeta actual
# Se asigna URL automática o personalizá
```

---

## Próximos pasos

### 1. Expandir datos de suelo

Para agregar todas las hojas disponibles:

```bash
# Descargá manualmente desde https://suelos.cba.gov.ar
# Y colocá los GeoJSON en data/sheets/

# Actualizá data/sheets-index.json con los bounding boxes
```

### 2. Mejorar el UI

- Agregar más colores/temas
- Mejorar mapa temático
- Agregar gráficos de IP por unidad

### 3. Agregar más funcionalidades

- Comparación entre campos
- Historiales/favoritos (localStorage)
- Integración con datos de clima
- Análisis de sostenibilidad

---

## Solución de problemas

### Error: "python: command not found"

Instalá Python desde https://www.python.org/downloads/ y marca "Add Python to PATH"

### Error: "El campo no está en el área relevada"

- Verificá que el campo esté en Córdoba, Argentina
- Si está, puede que no haya hoja disponible para esa zona
- Agregá la hoja a `data/sheets-index.json` (requiere descargar de IDECOR)

### Error: CORS al cargar datos de IDECOR

- IDECOR puede bloquear requests desde navegador
- **Solución**: Pre-descargá los GeoJSON y hostealos en `data/sheets/`

```bash
# Script para descargar una hoja (ejemplo)
curl "https://suelos.cba.gov.ar/JOVITA/layers/Jovita-3563-8-9-10-EPSG4326.js" \
  -o data/sheets/Jovita.json
# Luego editá el JSON para quitar la variable JS
```

### GitHub Pages no actualiza

- Esperá 5 minutos (caché)
- Forzá refresh: Ctrl+F5
- Verificá que el branch sea `main`

---

## Contacto & Soporte

Si tenés problemas:
1. Verificá que los pasos de setup se hicieron correctamente
2. Abrí un issue en GitHub
3. Contactame directamente

¡Buena suerte! 🌾
