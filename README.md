# Evalúa tu Campo 🌾

Una app web para obtener informes de suelos basados en las Cartas de Suelo de IDECOR (Córdoba, Argentina).

## Características

✅ Subí el límite de tu campo (ZIP/Shapefile, KML o KMZ)
✅ Obtené informe de suelos automático
✅ Información detallada por unidad de suelo
✅ IP (Índice de Productividad) promedio ponderado
✅ Informes específicos para alquiler, compra o manejo
✅ Exportá a PDF
✅ 100% gratuito, sin servidor

## Cómo usar

### Localmente (desarrollo)

1. Clonă o descargă este repositorio
2. Iniciá un servidor web local:

```bash
# Con Python 3
python3 -m http.server 8000

# O con Node.js
npx http-server -p 8000

# O con PHP
php -S localhost:8000
```

3. Abrí http://localhost:8000 en tu navegador

### En GitHub Pages (hosting gratuito)

1. Pushcá este repo a GitHub
2. En Settings → Pages, habilitar GitHub Pages desde main
3. La app estará en `https://tu-usuario.github.io/evalua-tu-campo/`

## Estructura

```
├── index.html              Página principal
├── css/
│   └── style.css          Estilos
├── js/
│   ├── app.js             Lógica principal
│   ├── fileParser.js      Parseo de SHP/KML/KMZ
│   ├── soilData.js        Carga de datos IDECOR
│   ├── analysis.js        Análisis espacial
│   └── report.js          Generación de informes
├── data/
│   ├── sheets-index.json  Índice de hojas de suelo
│   └── sheets/            (opcional) GeoJSON pre-descargados
└── README.md              Este archivo
```

## Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **Mapas**: [Leaflet](https://leafletjs.com/)
- **SIG**: [Turf.js](https://turfjs.org/)
- **Parseo**: [shpjs](https://github.com/calvinmetcalf/shapefile), [jszip](https://github.com/Stuk/jszip)
- **Exportación**: jsPDF, html2canvas
- **UI**: Bootstrap 5

## Datos de suelo

Los datos provienen de:
- **Cartas de Suelo IDECOR**: https://suelos.cba.gov.ar/

La app carga dinámicamente los GeoJSON de las hojas que intersectan con el campo subido.

## MVP vs. Futuro

### MVP (actual)
- ✅ Carga de archivos (ZIP/KML/KMZ)
- ✅ Análisis básico de intersección
- ✅ Informe en 3 tipos (alquiler/compra/manejo)
- ✅ Exportación a PDF
- ✅ 5 hojas de suelo principales

### Próximas versiones
- [ ] Todas las 48+ hojas de Córdoba
- [ ] Mapa temático con colores por IP/Clase de Uso
- [ ] Análisis de variabilidad espacial
- [ ] Comparación entre campos
- [ ] Integración con datos de clima/topografía

## Limitaciones conocidas

- ⚠️ **Escala semi-detallada**: Las cartas IDECOR no son para estudio a nivel predial (1:50,000)
- ⚠️ **Cobertura parcial**: Actualización de IDECOR puede variar
- ⚠️ **CORS**: Si IDECOR bloquea, se usan datos pre-descargados
- ⚠️ **No valida**: Este informe es orientativo. Siempre verificá con un agrónomo.

## Cómo expandir

### Agregar más hojas de suelo
1. Descargá manualmente los GeoJSON desde https://suelos.cba.gov.ar
2. Guardálos en `data/sheets/{nombre}.json`
3. Actualizá `data/sheets-index.json` con los bbox correctos

### Cambiar el origen de datos
Si querés integrar otras fuentes de suelo:
1. Modificá `soilData.js` para cargar desde otra URL/API
2. Asegurate que devuelva GeoJSON con propiedades `TEXTUSERID`, `IP`, `CU`, etc.

## Problemas comunes

**P: "El campo no está en el área relevada"**
R: Verificá que el campo esté en Córdoba. Si está, puede que no haya hoja de suelo disponible. Agregala a `sheets-index.json`.

**P: "Error al cargar datos de suelo"**
R: Probablemente CORS esté bloqueando el acceso a IDECOR. Solución: pre-descargá los GeoJSON y hostealos localmente en `data/sheets/`.

**P: El PDF se ve mal**
R: Probá reduciendo el nivel de detalle del informe o exportando como JPG desde el navegador (Ctrl+P).

## Licencia

MIT. Usado bajo esos términos.

## Autor

Creado para productores y asesores de Córdoba, Argentina. 🇦🇷

---

¿Preguntas? Abrí un issue o contactame.
