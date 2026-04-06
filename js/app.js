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

        // Show/hide campaign date section based on report type
        // Use click on labels (the visible elements in Bootstrap btn-check groups)
        const toggleCampaignSection = () => {
            const val = document.querySelector('input[name="reportType"]:checked')?.value;
            document.getElementById('campaignDatesSection').classList.toggle('d-none', val !== 'reclamo');
        };
        document.querySelectorAll('label[for^="type"]').forEach(lbl => {
            lbl.addEventListener('click', () => setTimeout(toggleCampaignSection, 0));
        });
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
            // Read options first — needed throughout the flow
            const options = {
                reportType: document.querySelector('input[name="reportType"]:checked').value,
                fieldName: document.getElementById('fieldName').value,
                detailLevel: document.getElementById('detailLevel').value
            };

            // Step 1: Load soil data (optional for Reclamo if outside IDECOR coverage)
            this.updateLoading('Buscando hojas de suelo...');
            const bbox = turf.bbox(this.fieldGeoJSON);
            let soilData = null;
            try {
                soilData = await SoilData.loadForBoundingBox(bbox);
            } catch (e) {
                if (options.reportType !== 'reclamo') throw e;
                console.warn('Datos de suelo no disponibles (fuera de cobertura):', e.message);
            }

            // Step 2: Spatial analysis (optional for Reclamo)
            if (soilData) {
                this.updateLoading('Analizando intersecciones espaciales...');
                try {
                    this.analysisResults = Analysis.analyze(this.fieldGeoJSON, soilData);
                } catch (e) {
                    if (options.reportType !== 'reclamo') throw e;
                    console.warn('Analisis espacial fallido:', e.message);
                    this.analysisResults = null;
                }
            } else {
                this.analysisResults = null;
            }

            // Fallback minimal results for Reclamo when outside IDECOR coverage
            if (!this.analysisResults) {
                if (options.reportType !== 'reclamo') throw new Error('No se encontraron datos de suelo para este campo.');
                const areaHa = turf.area(this.fieldGeoJSON) / 10000;
                this.analysisResults = {
                    totalAreaHa: areaHa,
                    weightedIP: null,
                    grouped: [],
                    soilUnits: [],
                    coveragePercent: 0,
                    observations: [{
                        type: 'warning',
                        text: `Campo fuera de la cobertura IDECOR (Cordoba). Superficie estimada: ${areaHa.toFixed(1)} ha. El informe muestra solo el analisis climatico.`
                    }]
                };
            }

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

            // Step 3b: Campaign climate for Reclamo type
            let campaignClimate = null;
            if (options.reportType === 'reclamo') {
                const startDate = document.getElementById('campaignStart').value;
                const endDate = document.getElementById('campaignEnd').value;
                if (startDate && endDate) {
                    this.updateLoading('Consultando clima de campana...');
                    try {
                        campaignClimate = await Climate.fetchCampaign(lat, lon, startDate, endDate);
                    } catch (e) {
                        console.warn('No se pudo obtener clima de campana:', e.message);
                    }
                }
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
                    // Pass actual years for report labels
                    mapImages.wettestYear = pa.wettest.year;
                    mapImages.wettestPrecip = pa.wettest.precip;
                    mapImages.driestYear = pa.driest.year;
                    mapImages.driestPrecip = pa.driest.precip;
                } catch (e) {
                    console.warn('No se pudieron capturar imagenes satelitales:', e.message);
                }
            }

            // Step 6b: NDVI greenness map from satellite imagery
            this.updateLoading('Generando mapa de verdor (NDVI)...');
            try {
                mapImages.ndviMap = await MapRenderer.renderNDVIMap(this.fieldGeoJSON);
            } catch (e) {
                console.warn('No se pudo generar mapa NDVI:', e.message);
            }

            // Step 7: NDVI chart or productivity chart
            if (satelliteData && climateData) {
                try {
                    if (satelliteData.ndvi) {
                        mapImages.ndviChart = MapRenderer.renderNDVIChart(satelliteData.ndvi, climateData);
                    } else if (satelliteData.productivity) {
                        mapImages.ndviChart = MapRenderer.renderProductivityChart(satelliteData.productivity, climateData);
                    }
                } catch (e) {
                    console.warn('No se pudo generar grafico:', e.message);
                }
            }

            // Step 8: Generate report
            this.updateLoading('Generando informe...');
            const reportHTML = Report.generate(this.analysisResults, options, climateData, mapImages, satelliteData, campaignClimate);

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

        // Step 1: Collect DOM break points BEFORE html2canvas
        const elementRect = element.getBoundingClientRect();
        const domBreakPoints = this.collectDOMBreakPoints(element, elementRect.top);

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

            // Map DOM positions to canvas positions
            const domHeight = elementRect.height;
            const scaleY = canvas.height / domHeight;
            const canvasBreaks = domBreakPoints.map(bp => Math.round(bp * scaleY));

            // Build page slices using DOM break points
            const slices = this.buildPageSlices(canvas, canvasBreaks, pageHeight, imgWidth);

            let pageNum = 0;
            for (let i = 0; i < slices.length; i++) {
                if (pageNum > 0) pdf.addPage();

                const srcY = slices[i].srcY;
                const srcH = slices[i].srcH;

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
     * Collect top positions of block elements that are safe page break candidates.
     * Returns array of Y offsets relative to the container top.
     */
    collectDOMBreakPoints(container, containerTop) {
        const breakPoints = [0]; // always start at 0
        // Select elements that represent section boundaries
        const selectors = 'h5, .row.g-2, .row.g-3, .table-responsive, .p-3, .observation-item, .alert, .mb-3, .border.rounded, hr, .mt-4, .mt-3';
        const elements = container.querySelectorAll(selectors);
        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const relTop = rect.top - containerTop;
            if (relTop > 10) {
                breakPoints.push(Math.round(relTop));
            }
        }
        // Deduplicate and sort
        return [...new Set(breakPoints)].sort((a, b) => a - b);
    },

    /**
     * Build page slices using DOM-derived break points.
     * Chooses the last break point that fits within each page.
     */
    buildPageSlices(canvas, breakPoints, pageHeightMm, imgWidthMm) {
        const canvasToMm = imgWidthMm / canvas.width;
        const pageHeightPx = Math.round(pageHeightMm / canvasToMm);
        const slices = [];
        let currentY = 0;

        while (currentY < canvas.height) {
            const remaining = canvas.height - currentY;

            if (remaining <= pageHeightPx * 1.05) {
                // Remaining content fits (with 5% tolerance)
                slices.push({ srcY: currentY, srcH: remaining });
                break;
            }

            const maxCut = currentY + pageHeightPx;

            // Find the last break point that is before maxCut
            // but at least 40% into the page (avoid tiny slices)
            const minCut = currentY + pageHeightPx * 0.4;
            let bestBreak = null;
            for (let i = breakPoints.length - 1; i >= 0; i--) {
                const bp = breakPoints[i];
                if (bp > currentY + 20 && bp <= maxCut && bp >= minCut) {
                    bestBreak = bp;
                    break;
                }
            }

            if (bestBreak !== null) {
                slices.push({ srcY: currentY, srcH: bestBreak - currentY });
                currentY = bestBreak;
            } else {
                // No DOM break found, fall back to page height
                slices.push({ srcY: currentY, srcH: pageHeightPx });
                currentY += pageHeightPx;
            }

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
