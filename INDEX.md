# 📚 Índice - Evalúa tu Campo

## 🎯 Empezar aquí

| Archivo | Descripción | Para quién |
|---------|-------------|-----------|
| **START.md** | ⚡ 3 pasos para empezar | Todos - comienza aquí |
| **WINDOWS.md** | 🪟 Guía específica para Windows | Usuarios Windows |
| **run.bat** | ▶️ Script para Windows | Hacer click y listo (Windows) |
| **run.sh** | ▶️ Script para Mac/Linux | Hacer click y listo (Mac/Linux) |

---

## 📖 Documentación

| Archivo | Propósito | Leer si... |
|---------|----------|-----------|
| **README.md** | Visión general del proyecto | Querés saber qué es esto |
| **SETUP.md** | Instalación en local + GitHub Pages | Tenés problemas al instalar |
| **GUIA_USO.md** | Manual completo de usuario | Querés aprender a usar la app |
| **COMPLETADO.md** | Detalles técnicos + roadmap | Sos desarrollador |
| **INDEX.md** | Este archivo | Buscas qué leer |

---

## 💻 Código fuente

### Página principal
- **index.html** - App web principal (interfaz completa)
- **test.html** - Página de debug para verificar que todo funciona

### Estilos
- **css/style.css** - Estilos CSS (tema agrícola profesional)

### Lógica (JavaScript)
- **js/app.js** - Orquestación principal (manejo de UI, eventos)
- **js/fileParser.js** - Parseo de archivos SHP/KML/KMZ
- **js/soilData.js** - Carga de datos de suelo IDECOR
- **js/analysis.js** - Análisis espacial (intersecciones, cálculos)
- **js/report.js** - Generación de informes HTML

### Datos
- **data/sheets-index.json** - Índice de hojas de suelo IDECOR

### Configuración
- **.gitignore** - Archivos ignorados por Git
- **.claude/launch.json** - Configuración de preview

---

## 📊 Estadísticas

- **Total commits**: 8
- **Archivos**: 18
- **Líneas de código**: ~2,500
- **Librerías CDN**: 6 (Leaflet, Turf, shpjs, JSZip, jsPDF, html2canvas)
- **Navegadores soportados**: Chrome, Firefox, Edge, Safari (no IE11)

---

## 🚀 Flujo de uso

```
START.md
    ↓
Ejecutar: python -m http.server 8000
    ↓
Abrir: http://localhost:8000
    ↓
Subir archivo (ZIP/KML/KMZ)
    ↓
Seleccionar opciones (tipo, detalle)
    ↓
Analizar suelos
    ↓
Ver informe + Exportar PDF
```

---

## 🛠️ Stack Tecnológico

### Frontend
```
HTML5 + CSS3 + JavaScript (vanilla)
Bootstrap 5 + Bootstrap Icons
```

### Librerías (vía CDN)
```
Leaflet 1.9        → Mapas interactivos
Turf.js 7          → Análisis espacial GIS
shpjs              → Parseo Shapefile
JSZip 3.10         → Extracción ZIP/KMZ
jsPDF 2.5          → Exportación PDF
html2canvas 1.4    → Captura HTML → imagen
```

### APIs
```
OpenStreetMap      → Capa base de mapa
IDECOR Córdoba     → Datos de suelo GeoJSON
```

---

## 🔄 Git Repository

### Commits principales
```
1acc78e - Add Windows-specific installation guide
d5af5b9 - Add startup scripts (run.bat, run.sh)
b0023bd - Add quick start guide (START.md)
7722ff9 - Final commit: Project completion summary
123cd5c - Add user guide (GUIA_USO.md)
fc0871c - Add test page for debugging
a099999 - Add documentation (README, SETUP)
bdf0127 - Initial commit: MVP
```

### Para publicar en GitHub
```bash
git remote add origin https://github.com/tu-usuario/evalua-tu-campo.git
git branch -M main
git push -u origin main
```

---

## 📋 Checklist de lectura

- [ ] Leí **START.md** - sé cómo empezar
- [ ] Leí **README.md** - entiendo qué es la app
- [ ] Ejecuté **run.bat** o **run.sh** - funciona en mi PC
- [ ] Subí un archivo y analicé - entiendo cómo funciona
- [ ] Leí **GUIA_USO.md** - sé todas las features
- [ ] (Opcional) Leí **COMPLETADO.md** - entiendo el código
- [ ] (Opcional) Publiqué en GitHub Pages - está online

---

## ❓ Preguntas rápidas

**¿Por dónde empiezo?**
→ Abrí **START.md**

**¿Cómo instalo?**
→ Si eres Windows: **WINDOWS.md**
→ Si eres Mac/Linux: **SETUP.md**

**¿Cómo uso la app?**
→ **GUIA_USO.md**

**¿Cómo publico en GitHub Pages?**
→ **SETUP.md** (Opción 2)

**¿Cómo expando el código?**
→ **COMPLETADO.md** (Roadmap)

---

## 📞 Soporte

1. **Verificá START.md** - Comienza aquí
2. **Verificá WINDOWS.md** (si eres Windows)
3. **Lee SETUP.md** - Instalación completa
4. **Abrí test.html** - Verifica que funciona
5. **Revisá GUIA_USO.md** - Manual de uso

---

## 🎉 ¡Listo!

Tu app está 100% completa y lista para:
- ✅ Ejecutar localmente
- ✅ Publicar en GitHub Pages
- ✅ Expandir y personalizar

**Próximo paso**: Abrí **START.md** y seguí los 3 pasos.

🌾
