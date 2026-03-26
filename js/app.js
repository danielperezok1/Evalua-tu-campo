/**
 * app.js - Main application logic
 */
const App = {

    fieldGeoJSON: null,
    map: null,
    analysisResults: null,
    soilLayer: null,

    init() {
        this.setupMap();
        this.setupFileUpload();
        this.setupEventListeners();
    },

    setupMap() {
        this.map = L.map('map').setView([-32.5, -63.5], 7);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

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
            // bbox is [minLon, minLat, maxLon, maxLat] - pass as array
            const soilData = await SoilData.loadForBoundingBox(bbox);

            // Step 2: Spatial analysis
            this.updateLoading('Analizando intersecciones espaciales...');
            this.analysisResults = Analysis.analyze(this.fieldGeoJSON, soilData);

            // Step 3: Climate data
            this.updateLoading('Consultando datos climáticos...');
            const centroid = turf.centroid(this.fieldGeoJSON);
            const [lon, lat] = centroid.geometry.coordinates;
            let climateData = null;
            try {
                climateData = await Climate.fetchHistorical(lat, lon);
            } catch (e) {
                console.warn('No se pudo obtener clima:', e.message);
            }

            // Step 4: Generate report
            this.updateLoading('Generando informe...');
            const options = {
                reportType: document.querySelector('input[name="reportType"]:checked').value,
                fieldName: document.getElementById('fieldName').value,
                detailLevel: document.getElementById('detailLevel').value
            };

            const reportHTML = Report.generate(this.analysisResults, options, climateData);

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
                properties: { ip: u.ip, unit: u.textUserId }
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
                layer.bindPopup(`<b>${p.unit}</b><br>IP: ${p.ip || 'S/D'}`);
            }
        }).addTo(this.map);
    },

    exportPDF() {
        const element = document.getElementById('reportContent');

        html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');

            const imgWidth = 190;
            const pageHeight = 277;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 10;

            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight + 10;
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 10, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const name = document.getElementById('fieldName').value || 'campo';
            pdf.save(`informe-suelo-${name}-${new Date().toISOString().slice(0, 10)}.pdf`);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
