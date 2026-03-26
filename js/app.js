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
            }

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

            // Step 6: Generate report
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

        // Find natural break points: h5 headers, major sections, images
        const breakPoints = [];
        const elementTop = element.getBoundingClientRect().top;
        const breakSelectors = 'h5, .pdf-section-start, .bg-light, .table-responsive, img';
        element.querySelectorAll(breakSelectors).forEach(el => {
            const rect = el.getBoundingClientRect();
            const relativeTop = rect.top - elementTop;
            breakPoints.push(relativeTop);
        });
        breakPoints.sort((a, b) => a - b);

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
            const canvasToMm = imgWidth / canvas.width;
            const totalImgHeightMm = canvas.height * canvasToMm;

            // Scale breakpoints from pixels to mm (accounting for html2canvas scale=2)
            const elementHeight = element.scrollHeight;
            const scaleFactor = canvas.height / elementHeight;
            const breaksMm = breakPoints.map(bp => bp * scaleFactor * canvasToMm);

            // Find the best cut point near the page boundary
            const findBestBreak = (targetMm) => {
                // Search zone: 20% before the cut line
                const searchMin = targetMm - pageHeight * 0.2;
                let bestBreak = targetMm; // default: hard cut
                let bestDist = Infinity;

                for (const bp of breaksMm) {
                    if (bp >= searchMin && bp <= targetMm) {
                        const dist = targetMm - bp;
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestBreak = bp;
                        }
                    }
                }
                return bestBreak;
            };

            // Generate pages with smart breaks
            let currentPosMm = 0; // position in the total image (mm)
            let pageNum = 0;
            const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);

            while (currentPosMm < totalImgHeightMm) {
                if (pageNum > 0) pdf.addPage();

                const remainingMm = totalImgHeightMm - currentPosMm;
                let sliceHeightMm;

                if (remainingMm <= pageHeight) {
                    sliceHeightMm = remainingMm;
                } else {
                    const rawEnd = currentPosMm + pageHeight;
                    const bestBreak = findBestBreak(rawEnd);
                    sliceHeightMm = bestBreak - currentPosMm;
                    // Safety: minimum 30% of page
                    if (sliceHeightMm < pageHeight * 0.3) {
                        sliceHeightMm = pageHeight;
                    }
                }

                // Source coordinates in canvas pixels
                const srcY = Math.round(currentPosMm / canvasToMm);
                const srcH = Math.round(sliceHeightMm / canvasToMm);

                // Create slice canvas
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = Math.min(srcH, canvas.height - srcY);
                const sliceCtx = sliceCanvas.getContext('2d');
                sliceCtx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);

                const sliceImgH = sliceCanvas.height * canvasToMm;
                pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, imgWidth, sliceImgH);

                currentPosMm += sliceHeightMm;
                pageNum++;

                // Safety: max 20 pages
                if (pageNum > 20) break;
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
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
