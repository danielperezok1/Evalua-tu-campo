/**
 * soilData.js - Load IDECOR soil data
 */
const SoilData = {

    // Cache for loaded sheets
    cache: {},

    /**
     * Load soil data for sheets that intersect with field boundary
     * @param {Object} fieldBbox - {minLon, minLat, maxLon, maxLat}
     * @returns {Promise<GeoJSON>} Combined FeatureCollection of intersecting soil units
     */
    async loadForBoundingBox(fieldBbox) {
        const sheetsIndex = await this.getIndex();

        // Find sheets that intersect
        const intersectingSheets = sheetsIndex.filter(sheet =>
            this.bboxIntersect(fieldBbox, sheet.bbox)
        );

        if (intersectingSheets.length === 0) {
            throw new Error('El campo no se encuentra en el área relevada por IDECOR Córdoba.');
        }

        // Load and combine all sheets
        const allFeatures = [];
        for (const sheet of intersectingSheets) {
            try {
                const geojson = await this.loadSheet(sheet);
                if (geojson && geojson.features) {
                    allFeatures.push(...geojson.features);
                }
            } catch (e) {
                console.warn(`No se pudo cargar la hoja ${sheet.name}:`, e);
            }
        }

        if (allFeatures.length === 0) {
            throw new Error('No se encontraron datos de suelo. Verificá la conexión.');
        }

        return {
            type: 'FeatureCollection',
            features: allFeatures
        };
    },

    /**
     * Get or load the sheets index
     */
    async getIndex() {
        if (this._indexPromise) {
            return this._indexPromise;
        }

        this._indexPromise = (async () => {
            try {
                const response = await fetch('data/sheets-index.json');
                if (!response.ok) throw new Error('No se encontró sheets-index.json');
                return await response.json();
            } catch (e) {
                console.error('Error cargando índice:', e);
                return this.getDefaultIndex();
            }
        })();

        return this._indexPromise;
    },

    /**
     * Load a single sheet's GeoJSON
     */
    async loadSheet(sheet) {
        if (this.cache[sheet.name]) {
            return this.cache[sheet.name];
        }

        try {
            // Try to load from local data/sheets/ folder first
            const localPath = `data/sheets/${sheet.filename || sheet.name}.json`;
            const response = await fetch(localPath);
            if (response.ok) {
                const data = await response.json();
                this.cache[sheet.name] = data;
                return data;
            }
        } catch (e) {
            // Fall through to remote
        }

        try {
            // Try to fetch from IDECOR directly
            const url = `https://suelos.cba.gov.ar/${sheet.name}/layers/${sheet.layerFile}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const text = await response.text();

            // Extract JSON from JavaScript file (e.g., var json_Hoja = {...})
            const geojson = this.parseJSToJSON(text);
            this.cache[sheet.name] = geojson;
            return geojson;
        } catch (e) {
            console.error(`Error cargando ${sheet.name}:`, e);
            return null;
        }
    },

    /**
     * Parse JavaScript variable assignment to JSON
     * e.g.: "var json_Hoja = { ... }" -> { ... }
     */
    parseJSToJSON(jsText) {
        try {
            // Match var name = {...} or var name = [...]
            const match = jsText.match(/var\s+\w+\s*=\s*(\{[\s\S]*\}|\[[\s\S]*\])\s*;?/);
            if (!match) {
                throw new Error('Could not parse JS structure');
            }
            const jsonStr = match[1];
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Error parsing JS to JSON:', e);
            return null;
        }
    },

    /**
     * Check if two bounding boxes intersect
     */
    bboxIntersect(bbox1, bbox2) {
        return !(bbox1[2] < bbox2[0] || bbox1[0] > bbox2[2] ||
                 bbox1[3] < bbox2[1] || bbox1[1] > bbox2[3]);
    },

    /**
     * Default index for MVP - can be expanded
     * bbox: [minLon, minLat, maxLon, maxLat]
     */
    getDefaultIndex() {
        return [
            {
                name: 'JOVITA',
                code: '3563-8-9-10',
                bbox: [-62.32, -32.82, -61.98, -32.48],
                layerFile: 'Jovita-3563-8-9-10-EPSG4326.js',
                filename: 'Jovita'
            },
            {
                name: 'LABOULAYE',
                code: '3461-3462',
                bbox: [-63.92, -34.32, -63.28, -33.68],
                layerFile: 'Laboulaye-3461-3462-EPSG4326.js',
                filename: 'Laboulaye'
            },
            {
                name: 'RIOCUARTO',
                code: '3360-3361',
                bbox: [-64.32, -33.72, -63.68, -33.08],
                layerFile: 'RioCuarto-3360-3361-EPSG4326.js',
                filename: 'RioCuarto'
            },
            {
                name: 'ONCATIVO',
                code: '3362-3362',
                bbox: [-64.02, -33.42, -63.38, -32.78],
                layerFile: 'Oncativo-3362-3362-EPSG4326.js',
                filename: 'Oncativo'
            },
            {
                name: 'BALNEARIA',
                code: '3462-3462',
                bbox: [-63.58, -33.58, -62.94, -32.94],
                layerFile: 'Balnearia-3462-3462-EPSG4326.js',
                filename: 'Balnearia'
            }
        ];
    }
};
