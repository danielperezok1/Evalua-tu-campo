/**
 * app.js - Main application logic
 */
const App = {

    fieldGeoJSON: null,
    map: null,
    analysisResults: null,

    init() {
        this.setupMap();
        this.setupFileUpload();
        this.setupEventListeners();
    },

    setupMap() {
        this.map = L.map('map').setView([-32.0, -63.5], 8);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
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
            this.fieldGeoJSON = null;
            fileInput.value = '';
            document.getElementById('fileInfo').classList.add('d-none');
            document.getElementById('analyzeBtn').disabled = true;
            this.fieldLayer.clearLayers();
            this.map.setView([-32.0, -63.5], 8);
        });
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

            // Show file info
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileInfo').classList.remove('d-none');

            // Add to map
            this.fieldLayer.clearLayers();
            const geoJsonLayer = L.geoJSON(this.fieldGeoJSON, {
                style: {
                    color: '#2d6a4f',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.2
                }
            }).addTo(this.fieldLayer);

            // Zoom to bounds
            const bounds = geoJsonLayer.getBounds();
            this.map.fitBounds(bounds, { padding: [50, 50] });

            // Enable analyze button
            document.getElementById('analyzeBtn').disabled = false;

        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
            console.error(error);
        }
    },

    async analyze() {
        const btn = document.getElementById('analyzeBtn');
        btn.disabled = true;

        document.getElementById('results').classList.add('d-none');
        document.getElementById('loading').classList.remove('d-none');

        try {
            document.getElementById('loadingText').textContent = 'Cargando datos de suelo...';

            // Get bounding box of field
            const bounds = turf.bbox(this.fieldGeoJSON);
            const fieldBbox = {
                minLon: bounds[0],
                minLat: bounds[1],
                maxLon: bounds[2],
                maxLat: bounds[3]
            };

            // Load soil data
            const soilData = await SoilData.loadForBoundingBox(fieldBbox);

            document.getElementById('loadingText').textContent = 'Analizando intersecciones...';

            // Analyze
            this.analysisResults = Analysis.analyze(this.fieldGeoJSON, soilData);

            // Generate report
            const options = {
                reportType: document.querySelector('input[name="reportType"]:checked').value,
                fieldName: document.getElementById('fieldName').value,
                detailLevel: document.getElementById('detailLevel').value
            };

            const reportHTML = Report.generate(this.analysisResults, options);

            // Show results
            document.getElementById('loadingText').textContent = 'Completado.';
            document.getElementById('reportContent').innerHTML = reportHTML;
            document.getElementById('loading').classList.add('d-none');
            document.getElementById('results').classList.remove('d-none');

            // Update map with soil units (overlay)
            this.visualizeSoilUnits(this.analysisResults);

        } catch (error) {
            document.getElementById('loadingText').textContent = `Error: ${error.message}`;
            console.error(error);
            setTimeout(() => {
                document.getElementById('loading').classList.add('d-none');
                btn.disabled = false;
            }, 2000);
        }
    },

    visualizeSoilUnits(results) {
        // Optional: add soil unit visualization to map
        // For now, keep it simple with just the field boundary
    },

    exportPDF() {
        const element = document.getElementById('reportContent');
        const opt = {
            margin: 10,
            filename: `informe-suelo-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        };

        html2pdf().set(opt).from(element).save();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
