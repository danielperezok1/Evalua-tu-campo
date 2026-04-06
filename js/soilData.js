/**
 * soilData.js - Load IDECOR soil data with BA fallback
 * Tries: 1) IDECOR local tiles  2) IDECOR direct fetch  3) BA 1:50.000 tiles
 */
const SoilData = {

    cache: {},
    _indexPromise: null,
    _baIndexPromise: null,

    async loadForBoundingBox(fieldBbox) {
        // fieldBbox is [minLon, minLat, maxLon, maxLat]
        const sheetsIndex = await this.getIndex();

        const intersecting = sheetsIndex.filter(sheet =>
            sheet.bbox && this.bboxIntersect(fieldBbox, sheet.bbox)
        );

        console.log(`Campo bbox: [${fieldBbox}]`);
        console.log(`Hojas IDECOR que intersectan: ${intersecting.map(s => s.name).join(', ') || 'ninguna'}`);

        if (intersecting.length > 0) {
            const allFeatures = [];
            const errors = [];

            for (const sheet of intersecting) {
                try {
                    const geojson = await this.loadSheet(sheet);
                    if (geojson && geojson.features) {
                        allFeatures.push(...geojson.features);
                        console.log(`✓ ${sheet.name}: ${geojson.features.length} features`);
                    }
                } catch (e) {
                    errors.push(sheet.name);
                    console.warn(`✗ ${sheet.name}:`, e.message);
                }
            }

            if (allFeatures.length > 0) {
                const fc = { type: 'FeatureCollection', features: allFeatures };
                fc._source = 'IDECOR';
                return fc;
            }
        }

        // Fallback: try Buenos Aires 1:50.000 tiles
        console.log('Intentando datos de Buenos Aires 1:50.000...');
        try {
            const baResult = await this.loadForBoundingBoxBA(fieldBbox);
            if (baResult && baResult.features && baResult.features.length > 0) {
                baResult._source = 'BA_50mil';
                return baResult;
            }
        } catch (e) {
            console.warn('Sin cobertura BA tampoco:', e.message);
        }

        throw new Error(
            'El campo no se encuentra en el área relevada. ' +
            'Cobertura disponible: Córdoba (IDECOR) y Buenos Aires (INTA 1:50.000).'
        );
    },

    async loadForBoundingBoxBA(fieldBbox) {
        const baIndex = await this.getBAIndex();
        const intersecting = baIndex.filter(tile =>
            tile.bbox && this.bboxIntersect(fieldBbox, tile.bbox)
        );

        console.log(`Tiles BA que intersectan: ${intersecting.map(t => t.file).join(', ') || 'ninguno'}`);

        if (intersecting.length === 0) {
            throw new Error('Fuera de cobertura BA.');
        }

        const allFeatures = [];
        for (const tile of intersecting) {
            try {
                const key = 'ba_' + tile.file;
                if (!this.cache[key]) {
                    const response = await fetch(`data/sheets-ba/${tile.file}`);
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    const data = await response.json();
                    this.cache[key] = data;
                }
                const geojson = this.cache[key];
                if (geojson && geojson.features) {
                    allFeatures.push(...geojson.features);
                    console.log(`✓ BA tile ${tile.file}: ${geojson.features.length} features`);
                }
            } catch (e) {
                console.warn(`✗ BA tile ${tile.file}:`, e.message);
            }
        }

        if (allFeatures.length === 0) {
            throw new Error('No se pudieron cargar tiles BA.');
        }

        return { type: 'FeatureCollection', features: allFeatures };
    },

    async getBAIndex() {
        if (this._baIndexPromise) return this._baIndexPromise;
        this._baIndexPromise = (async () => {
            try {
                const response = await fetch('data/sheets-ba-index.json');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                console.log(`Índice BA cargado: ${data.length} tiles`);
                return data;
            } catch (e) {
                console.warn('No se pudo cargar índice BA:', e.message);
                return [];
            }
        })();
        return this._baIndexPromise;
    },

    async getIndex() {
        if (this._indexPromise) return this._indexPromise;

        this._indexPromise = (async () => {
            try {
                const response = await fetch('data/sheets-index.json');
                if (!response.ok) throw new Error('HTTP ' + response.status);
                const data = await response.json();
                console.log(`Índice cargado: ${data.length} hojas`);
                return data;
            } catch (e) {
                console.warn('Usando índice por defecto:', e.message);
                return this.getDefaultIndex();
            }
        })();

        return this._indexPromise;
    },

    async loadSheet(sheet) {
        if (this.cache[sheet.name]) return this.cache[sheet.name];

        // Strategy 1: Try local pre-downloaded JSON
        try {
            const localPath = `data/sheets/${sheet.name}.json`;
            const response = await fetch(localPath);
            if (response.ok) {
                const text = await response.text();
                const data = text.trimStart().startsWith('var ')
                    ? this.parseJSToJSON(text)
                    : JSON.parse(text);
                if (data) {
                    this.cache[sheet.name] = data;
                    return data;
                }
            }
        } catch (e) { /* fall through */ }

        // Strategy 2: Fetch directly from IDECOR
        try {
            const url = `https://suelos.cba.gov.ar/${sheet.name}/${sheet.layerFile}`;
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const data = this.parseJSToJSON(text);
            if (data) {
                this.cache[sheet.name] = data;
                return data;
            }
        } catch (e) {
            console.warn(`CORS/fetch falló para ${sheet.name}, intentando no-cors...`);
        }

        // Strategy 3: Try with a CORS proxy
        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
                `https://suelos.cba.gov.ar/${sheet.name}/${sheet.layerFile}`
            )}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
            const text = await response.text();
            const data = this.parseJSToJSON(text);
            if (data) {
                this.cache[sheet.name] = data;
                return data;
            }
        } catch (e) {
            throw new Error(`No se pudo cargar ${sheet.name}: ${e.message}`);
        }

        return null;
    },

    parseJSToJSON(jsText) {
        try {
            // Remove "var json_Hoja =" prefix
            const cleaned = jsText.replace(/^\s*var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
            return JSON.parse(cleaned);
        } catch (e) {
            // Try regex approach for more complex cases
            try {
                const match = jsText.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
                if (match) return JSON.parse(match[1]);
            } catch (e2) { /* ignore */ }
            console.error('Error parsing JS to JSON:', e.message);
            return null;
        }
    },

    bboxIntersect(a, b) {
        // Both are [minLon, minLat, maxLon, maxLat]
        return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
    },

    getDefaultIndex() {
        // Fallback with approximate bboxes for key sheets
        return [
            { name: "VIAMONTE", layerFile: "layers/Viamonte-3363-EPSG4326.js", bbox: [-62.5, -33.9, -62.0, -33.4], filename: "VIAMONTE" },
            { name: "BELLVILLE", layerFile: "layers/BellVille-3363-10-EPSG4326.js", bbox: [-62.9, -33.2, -62.3, -32.7], filename: "BELLVILLE" },
            { name: "MARCOSJUAREZ", layerFile: "layers/MarcosJuarez-3363-17-EPSG4326.js", bbox: [-62.5, -33.0, -61.9, -32.5], filename: "MARCOSJUAREZ" },
            { name: "VILLAMARIA", layerFile: "layers/VillaMaria-3363-9-EPSG4326.js", bbox: [-63.5, -32.7, -63.0, -32.2], filename: "VILLAMARIA" },
            { name: "ONCATIVO", layerFile: "layers/Oncativo-3163-32-EPSG4326.js", bbox: [-63.7, -32.2, -63.2, -31.7], filename: "ONCATIVO" },
            { name: "RIOCUARTO", layerFile: "layers/RioCuarto-3363-19-EPSG4326.js", bbox: [-64.7, -33.4, -64.1, -32.9], filename: "RIOCUARTO" },
            { name: "LABOULAYE", layerFile: "layers/Laboulaye-3563-3-EPSG4326.js", bbox: [-63.7, -34.4, -63.1, -33.9], filename: "LABOULAYE" },
            { name: "JOVITA", layerFile: "layers/Jovita-3563-8-9-10-EPSG4326.js", bbox: [-64.0, -34.3, -63.3, -33.7], filename: "JOVITA" },
            { name: "CANALS", layerFile: "layers/Canals-3363-28-EPSG4326.js", bbox: [-62.7, -33.8, -62.1, -33.3], filename: "CANALS" },
            { name: "CORRALDEBUSTOS", layerFile: "layers/CorralDeBustos-3363-23-EPSG4326.js", bbox: [-62.4, -33.6, -61.8, -33.1], filename: "CORRALDEBUSTOS" },
            { name: "LACARLOTA", layerFile: "layers/LaCarlota-3363-27-EPSG4326.js", bbox: [-63.6, -33.8, -63.0, -33.3], filename: "LACARLOTA" },
            { name: "UCACHA", layerFile: "layers/Ucacha-3363-20-EPSG4326.js", bbox: [-63.7, -33.3, -63.1, -32.8], filename: "UCACHA" },
            { name: "HERNANDO", layerFile: "layers/Hernando-3363-8-EPSG4326.js", bbox: [-63.8, -32.6, -63.2, -32.1], filename: "HERNANDO" },
            { name: "LABORDE", layerFile: "layers/Laborde-3363-22-EPSG4326.js", bbox: [-62.9, -33.4, -62.3, -32.9], filename: "LABORDE" },
            { name: "POSSE", layerFile: "layers/JustinianoPosse-3363-16-EPSG4326.js", bbox: [-62.6, -33.2, -62.0, -32.7], filename: "POSSE" },
            { name: "PASCANAS", layerFile: "layers/Pascanas-3363-21-EPSG4326.js", bbox: [-63.1, -33.5, -62.5, -33.0], filename: "PASCANAS" }
        ];
    }
};
