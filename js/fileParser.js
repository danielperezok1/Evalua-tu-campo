/**
 * fileParser.js - Parse uploaded field boundary files to GeoJSON
 * Supports: ZIP (Shapefile), KML, KMZ
 */
const FileParser = {

    async parse(file) {
        const name = file.name.toLowerCase();

        if (name.endsWith('.zip')) {
            return await this.parseShapefile(file);
        } else if (name.endsWith('.kml')) {
            return await this.parseKML(file);
        } else if (name.endsWith('.kmz')) {
            return await this.parseKMZ(file);
        } else {
            throw new Error('Formato no soportado. Usá ZIP (Shapefile), KML o KMZ.');
        }
    },

    async parseShapefile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const geojson = await shp(arrayBuffer);

        // shp() may return a single FeatureCollection or an array of them
        const fc = Array.isArray(geojson) ? geojson[0] : geojson;
        return this.validateAndExtractPolygons(fc);
    },

    async parseKML(file) {
        const text = await file.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');

        // toGeoJSON is available globally from the CDN as toGeoJSON
        // We'll use a minimal inline KML-to-GeoJSON converter
        const geojson = this.kmlToGeoJSON(xml);
        return this.validateAndExtractPolygons(geojson);
    },

    async parseKMZ(file) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Find the KML file inside the KMZ
        let kmlFile = null;
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (filename.toLowerCase().endsWith('.kml')) {
                kmlFile = zipEntry;
                break;
            }
        }

        if (!kmlFile) {
            throw new Error('No se encontró un archivo KML dentro del KMZ.');
        }

        const kmlText = await kmlFile.async('text');
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, 'text/xml');
        const geojson = this.kmlToGeoJSON(xml);
        return this.validateAndExtractPolygons(geojson);
    },

    /**
     * Minimal KML to GeoJSON converter for polygons
     */
    kmlToGeoJSON(xml) {
        const features = [];
        const placemarks = xml.getElementsByTagName('Placemark');

        for (const pm of placemarks) {
            const nameEl = pm.getElementsByTagName('name')[0];
            const name = nameEl ? nameEl.textContent : '';

            // Get polygon coordinates
            const polygons = pm.getElementsByTagName('Polygon');
            const points = pm.getElementsByTagName('Point');
            const lines = pm.getElementsByTagName('LineString');

            for (const polygon of polygons) {
                const coords = this.extractPolygonCoords(polygon);
                if (coords) {
                    features.push({
                        type: 'Feature',
                        properties: { name },
                        geometry: { type: 'Polygon', coordinates: coords }
                    });
                }
            }

            // Also handle MultiGeometry
            const multiGeoms = pm.getElementsByTagName('MultiGeometry');
            for (const mg of multiGeoms) {
                const innerPolygons = mg.getElementsByTagName('Polygon');
                const allCoords = [];
                for (const polygon of innerPolygons) {
                    const coords = this.extractPolygonCoords(polygon);
                    if (coords) {
                        allCoords.push(coords[0]); // outer ring
                    }
                }
                if (allCoords.length > 0) {
                    features.push({
                        type: 'Feature',
                        properties: { name },
                        geometry: { type: 'MultiPolygon', coordinates: allCoords.map(c => [c]) }
                    });
                }
            }
        }

        return { type: 'FeatureCollection', features };
    },

    extractPolygonCoords(polygon) {
        const outerBoundary = polygon.getElementsByTagName('outerBoundaryIs')[0];
        if (!outerBoundary) return null;

        const coordsEl = outerBoundary.getElementsByTagName('coordinates')[0];
        if (!coordsEl) return null;

        const ring = this.parseCoordinateString(coordsEl.textContent);
        const rings = [ring];

        // Inner boundaries (holes)
        const innerBoundaries = polygon.getElementsByTagName('innerBoundaryIs');
        for (const inner of innerBoundaries) {
            const innerCoordsEl = inner.getElementsByTagName('coordinates')[0];
            if (innerCoordsEl) {
                rings.push(this.parseCoordinateString(innerCoordsEl.textContent));
            }
        }

        return rings;
    },

    parseCoordinateString(str) {
        return str.trim().split(/\s+/).map(tuple => {
            const parts = tuple.split(',').map(Number);
            return [parts[0], parts[1]]; // [lon, lat], ignore altitude
        });
    },

    validateAndExtractPolygons(geojson) {
        if (!geojson || !geojson.features || geojson.features.length === 0) {
            throw new Error('El archivo no contiene geometrías válidas.');
        }

        // Filter to only polygons/multipolygons
        const polygonFeatures = geojson.features.filter(f =>
            f.geometry &&
            (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        );

        if (polygonFeatures.length === 0) {
            throw new Error('El archivo no contiene polígonos. Asegurate de subir el límite del campo como polígono.');
        }

        // Merge all polygons into one if multiple
        if (polygonFeatures.length === 1) {
            return {
                type: 'FeatureCollection',
                features: [polygonFeatures[0]]
            };
        }

        // Try to union multiple polygons
        try {
            let merged = polygonFeatures[0];
            for (let i = 1; i < polygonFeatures.length; i++) {
                merged = turf.union(
                    turf.featureCollection([merged, polygonFeatures[i]])
                );
            }
            return {
                type: 'FeatureCollection',
                features: [merged]
            };
        } catch (e) {
            // If union fails, return all polygons
            return {
                type: 'FeatureCollection',
                features: polygonFeatures
            };
        }
    }
};
