/**
 * app.js - Main application logic
 */
const App = {

    fieldGeoJSON: null,
    map: null,
    analysisResults: null,
    soilLayer: null,
    currentBaseLayer: null,

    init() {
        this.setupMap();
        this.setupFileUpload();
        this.setupEventListeners();
    },

    setupMap() {
        this.map = L.map('map').setView([-32.5, -63.5], 7);

        // Base layers
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri, Maxar, Earthstar Geographics',
            maxZoom: 18
        });

        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenTopoMap',
            maxZoom: 17
        });

        osmLayer.addTo(this.map);
        this.currentBaseLayer = osmLayer;

        // Layer control
        const baseLayers = {
            'Calles': osmLayer,
            'Satelite': satelliteLayer,
            'Topografico': topoLayer
        };
        L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

        this.fieldLayer = L.featureGroup().addTo(this.map);
    },

    setupFileUpload() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) await this.handleFileSelect(file);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        document.getElementById('clearFile').addEventListener('click', () => {
            this.clearField();
        });
    },

    clearField() {
        this.fieldGeoJSON = null;
        this.analysisResults = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('fileInfo').classList.add('d-none');
        document.getElementById('analyzeBtn').disabled = true;
        document.getElementById('results').classList.add('d-none');
        this.fieldLayer.clearLayers();
        if (this.soilLayer) {
            this.map.removeLayer(this.soilLayer);
            this.soilLayer = null;
        }
        this.map.setView([-32.5, -63.5], 7);
    },

    setupEventListeners() {
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyze());
        document.getElementById('exportPdf').addEventListener('click', () => this.exportPDF());
    },

    async handleFileSelect(file) {
        const errorDiv = document.getElementById('fileError');
        errorDiv.classList.add('d-none');

        try {
            this.fieldGeoJSON = await FileParser.parse(file);

            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileInfo').classList.remove('d-none');

            this.fieldLayer.clearLayers();
            const geoJsonLayer = L.geoJSON(this.fieldGeoJSON, {
                style: {
                    color: '#2d6a4f',
                    weight: 3,
                    opacity: 0.9,
                    fillOpacity: 0.15,
                    fillColor: '#2d6a4f'
                }
            }).addTo(this.fieldLayer);

            this.map.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50] });
            document.getElementById('analyzeBtn').disabled = false;

        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
            console.error('Error parsing file:', error);
        }
    },

    async analyze() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        document.getElementById('results').classList.add('d-none');
        document.getElementById('loading').classList.remove('d-none');

        try {
            // Step 1: Load soil data
            this.updateLoading('Buscando hojas de suelo...');
            const bbox = turf.bbox(this.fieldGeoJSON);
            const soilData = await SoilData.loadForBoundingBox(bbox);

            // Step 2: Spatial analysis
            this.updateLoading('Analizando intersecciones espaciales...');
            this.analysisResults = Analysis.analyze(this.fieldGeoJSON, soilData);

            // Step 3: Climate data
            this.updateLoading('Consultando datos climaticos...');
            const centroid = turf.centroid(this.fieldGeoJSON);
            const [lon, lat] = centroid.geometry.coordinates;
            let climateData = null;
            try {
                climateData = await Climate.fetchHistorical(lat, lon);
                // Also fetch daily data for flood analysis
                try {
                    climateData.dailyData = await Climate.fetchDaily(lat, lon);
                } catch (e) {
                    console.warn('No se pudo obtener datos diarios:', e.message);
                }
            } catch (e) {
                console.warn('No se pudo obtener clima:', e.message);
            }

            // Step 4: Generate thematic maps
            this.updateLoading('Generando mapas tematicos...');
            let mapImages = null;
            try {
                mapImages = MapRenderer.generateAll(this.fieldGeoJSON, this.analysisResults.soilUnits);
            } catch (e) {
                console.warn('No se pudieron generar mapas:', e.message);
                mapImages = {};
            }
            if (!mapImages) mapImages = {};

            // Step 5: Satellite / historical analysis
            this.updateLoading('Analizando datos satelitales e historicos...');
            let satelliteData = null;
            try {
                satelliteData = await Satellite.analyze(
                    lat, lon,
                    climateData,
                    this.analysisResults.weightedIP
                );
            } catch (e) {
                console.warn('No se pudo completar analisis satelital:', e.message);
            }

            // Step 6: Satellite imagery captures (wet/dry year comparison)
            if (satelliteData && satelliteData.precipAnalysis) {
                this.updateLoading('Capturando imagenes satelitales...');
                try {
                    const pa = satelliteData.precipAnalysis;
                    const satCaptures = await MapRenderer.generateSatelliteCaptures(
                        this.fieldGeoJSON, pa.wettest.year, pa.driest.year
                    );
                    if (satCaptures.wetImage) mapImages.wetImage = satCaptures.wetImage;
                    if (satCaptures.dryImage) mapImages.dryImage = satCaptures.dryImage;
                } catch (e) {
                    console.warn('No se pudieron capturar imagenes satelitales:', e.message);
                }
            }

            // Step 7: NDVI chart (if data available)
            if (satelliteData && satelliteData.ndvi && climateData) {
                try {
                    mapImages.ndviChart = MapRenderer.renderNDVIChart(satelliteData.ndvi, climateData);
                } catch (e) {
                    console.warn('No se pudo generar grafico NDVI:', e.message);
                }
            }

            // Step 8: Generate report
            this.updateLoading('Generando informe...');
            const options = {
                reportType: document.querySelector('input[name="reportType"]:checked').value,
                fieldName: document.getElementById('fieldName').value,
                detailLevel: document.getElementById('detailLevel').value
            };

            const reportHTML = Report.generate(this.analysisResults, options, climateData, mapImages, satelliteData);

            // Show results
            document.getElementById('reportContent').innerHTML = reportHTML;
            document.getElementById('loading').classList.add('d-none');
            document.getElementById('results').classList.remove('d-none');

            // Add soil visualization to map
            this.visualizeSoilUnits(this.analysisResults);

            btn.disabled = false;

        } catch (error) {
            this.updateLoading(`Error: ${error.message}`);
            console.error('Analysis error:', error);
            setTimeout(() => {
                document.getElementById('loading').classList.add('d-none');
                btn.disabled = false;
            }, 3000);
        }
    },

    updateLoading(text) {
        document.getElementById('loadingText').textContent = text;
    },

    visualizeSoilUnits(results) {
        if (this.soilLayer) {
            this.map.removeLayer(this.soilLayer);
        }

        const ipColors = (ip) => {
            if (ip == null || ip <= 0) return '#999';
            if (ip >= 65) return '#2d6a4f';
            if (ip >= 50) return '#52b788';
            if (ip >= 35) return '#ffd166';
            return '#ef476f';
        };

        this.soilLayer = L.geoJSON({
            type: 'FeatureCollection',
            features: results.soilUnits.filter(u => u.geometry).map(u => ({
                type: 'Feature',
                geometry: u.geometry.geometry || u.geometry,
                properties: { ip: u.ip, unit: u.textUserId, cu: u.cu }
            }))
        }, {
            style: (feature) => ({
                fillColor: ipColors(feature.properties.ip),
                weight: 1,
                opacity: 0.6,
                color: '#333',
                fillOpacity: 0.4
            }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const cuRoman = Analysis.cuToRoman(p.cu);
                layer.bindPopup(
                    `<b>${p.unit}</b><br>IP: ${p.ip || 'S/D'}<br>Clase: ${cuRoman}`
                );
            }
        }).addTo(this.map);
    },

    exportPDF() {
        const element = document.getElementById('reportContent');
        const btn = document.getElementById('exportPdf');
        const origText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generando PDF...';
        btn.disabled = true;

        html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true
        }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            const imgWidth = 190;
            const pageHeight = 277;
            const margin = 10;

            // Find safe cut points by scanning canvas pixels for white/empty rows
            const cutPoints = this.findSafeCutPoints(canvas, pageHeight, imgWidth);

            let pageNum = 0;
            for (let i = 0; i < cutPoints.length; i++) {
                if (pageNum > 0) pdf.addPage();

                const srcY = cutPoints[i].srcY;
                const srcH = cutPoints[i].srcH;

                // Create slice canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = srcH;
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCtx.fillStyle = '#ffffff';
                sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                sliceCtx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

                const sliceImgH = srcH * (imgWidth / canvas.width);
                pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgWidth, sliceImgH);
                pageNum++;
            }

            const name = document.getElementById('fieldName').value || 'campo';
            pdf.save(`informe-suelo-${name}-${new Date().toISOString().slice(0, 10)}.pdf`);

            btn.innerHTML = origText;
            btn.disabled = false;
        }).catch(err => {
            console.error('Error generating PDF:', err);
            btn.innerHTML = origText;
            btn.disabled = false;
        });
    },

    /**
     * Scan canvas pixels to find safe horizontal cut points (white/empty rows)
     * Returns array of {srcY, srcH} slices
     */
    findSafeCutPoints(canvas, pageHeightMm, imgWidthMm) {
        const ctx = canvas.getContext('2d');
        const canvasToMm = imgWidthMm / canvas.width;
        const pageHeightPx = Math.round(pageHeightMm / canvasToMm);
        const slices = [];

        let currentY = 0;

        while (currentY < canvas.height) {
            const remaining = canvas.height - currentY;

            // If remaining fits in one page, take it all
            if (remaining <= pageHeightPx) {
                slices.push({ srcY: currentY, srcH: remaining });
                break;
            }

            // Target cut at full page height
            const targetCut = currentY + pageHeightPx;

            // Search backwards from target for a "safe" row (mostly white/light)
            // Search in the last 25% of the page
            const searchStart = Math.max(currentY + pageHeightPx * 0.7, currentY + 100);
            let bestCutY = targetCut;
            let bestScore = -1;

            // Sample every 4 pixels for speed
            for (let y = targetCut; y >= searchStart; y -= 4) {
                if (y >= canvas.height) continue;
                // Sample a horizontal strip (3 rows for stability)
                const stripH = Math.min(3, canvas.height - y);
                const rowData = ctx.getImageData(0, y, canvas.width, stripH);
                const pixels = rowData.data;

                let lightCount = 0;
                const totalPixels = (canvas.width * stripH);
                for (let i = 0; i < pixels.length; i += 16) { // sample every 4th pixel
                    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                    const brightness = (r + g + b) / 3;
                    if (brightness > 235) lightCount++;
                }
                const score = lightCount / (totalPixels / 4);

                if (score > bestScore) {
                    bestScore = score;
                    bestCutY = y;
                }
                // If we found a nearly all-white row, use it
                if (score > 0.92) break;
            }

            const sliceH = bestCutY - currentY;
            if (sliceH < pageHeightPx * 0.3) {
                // Safety: don't make slices too small
                slices.push({ srcY: currentY, srcH: pageHeightPx });
                currentY += pageHeightPx;
            } else {
                slices.push({ srcY: currentY, srcH: sliceH });
                currentY += sliceH;
            }

            // Safety: max 25 pages
            if (slices.length >= 25) {
                if (currentY < canvas.height) {
                    slices.push({ srcY: currentY, srcH: canvas.height - currentY });
                }
                break;
            }
        }

        return slices;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
