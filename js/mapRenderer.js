/**
 * mapRenderer.js - Render thematic maps to canvas for PDF export
 * Generates IP, Land Use Class, and Soil Series maps
 */
const MapRenderer = {

    CANVAS_WIDTH: 700,
    CANVAS_HEIGHT: 480,
    PADDING: 40,

    /**
     * Generate all three thematic maps
     * @param {GeoJSON} fieldGeoJSON - Field boundary
     * @param {Array} soilUnits - Analysis soil units with geometry
     * @returns {Object} { ipMap, classMap, seriesMap } as data URLs
     */
    generateAll(fieldGeoJSON, soilUnits) {
        const features = soilUnits.filter(u => u.geometry);
        const bbox = turf.bbox(fieldGeoJSON);

        return {
            ipMap: this.renderMap(fieldGeoJSON, features, bbox, 'ip'),
            classMap: this.renderMap(fieldGeoJSON, features, bbox, 'class'),
            seriesMap: this.renderMap(fieldGeoJSON, features, bbox, 'series')
        };
    },

    /**
     * Render a single thematic map
     */
    renderMap(fieldGeoJSON, features, bbox, type) {
        const canvas = document.createElement('canvas');
        canvas.width = this.CANVAS_WIDTH;
        canvas.height = this.CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate projection
        const proj = this.getProjection(bbox, canvas.width, canvas.height, this.PADDING);

        // Get color function and legend data
        const { colorFn, legend, title } = this.getTheme(type, features);

        // Draw soil unit polygons
        for (const unit of features) {
            const geom = unit.geometry.geometry || unit.geometry;
            const color = colorFn(unit);
            this.drawGeometry(ctx, geom, proj, color, '#555', 0.5);
        }

        // Draw field boundary on top
        const fieldGeom = fieldGeoJSON.features[0].geometry;
        this.drawGeometry(ctx, fieldGeom, proj, null, '#1b4332', 2.5);

        // Draw title
        ctx.fillStyle = '#1b4332';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 22);

        // Draw legend
        this.drawLegend(ctx, legend, canvas.width, canvas.height);

        // Draw north arrow
        this.drawNorthArrow(ctx, canvas.width - 30, 50);

        return canvas.toDataURL('image/png');
    },

    getProjection(bbox, width, height, padding) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        // Account for aspect ratio with lat correction
        const midLat = (minLat + maxLat) / 2;
        const latCorrFactor = Math.cos(midLat * Math.PI / 180);

        const geoWidth = (maxLon - minLon) * latCorrFactor;
        const geoHeight = maxLat - minLat;

        const availW = width - 2 * padding;
        const availH = height - 2 * padding - 30; // reserve space for title

        const scale = Math.min(availW / geoWidth, availH / geoHeight);

        const offsetX = padding + (availW - geoWidth * scale) / 2;
        const offsetY = padding + 30 + (availH - geoHeight * scale) / 2;

        return {
            project(lon, lat) {
                const x = offsetX + (lon - minLon) * latCorrFactor * scale;
                const y = offsetY + (maxLat - lat) * scale;
                return [x, y];
            }
        };
    },

    drawGeometry(ctx, geometry, proj, fillColor, strokeColor, lineWidth) {
        const type = geometry.type;
        let rings;

        if (type === 'Polygon') {
            rings = [geometry.coordinates];
        } else if (type === 'MultiPolygon') {
            rings = geometry.coordinates;
        } else {
            return;
        }

        for (const polygon of rings) {
            for (let ri = 0; ri < polygon.length; ri++) {
                const ring = polygon[ri];
                if (ring.length < 3) continue;

                ctx.beginPath();
                const [x0, y0] = proj.project(ring[0][0], ring[0][1]);
                ctx.moveTo(x0, y0);
                for (let i = 1; i < ring.length; i++) {
                    const [x, y] = proj.project(ring[i][0], ring[i][1]);
                    ctx.lineTo(x, y);
                }
                ctx.closePath();

                if (ri === 0 && fillColor) {
                    ctx.fillStyle = fillColor;
                    ctx.fill();
                }
                if (strokeColor) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = lineWidth || 1;
                    ctx.stroke();
                }
            }
        }
    },

    getTheme(type, features) {
        if (type === 'ip') {
            return {
                title: 'Mapa de Índice de Productividad (IP)',
                colorFn: (unit) => {
                    const ip = unit.ip;
                    if (ip == null || ip <= 0) return '#cccccc';
                    if (ip >= 65) return '#2d6a4f';
                    if (ip >= 50) return '#52b788';
                    if (ip >= 35) return '#ffd166';
                    return '#ef476f';
                },
                legend: [
                    { color: '#2d6a4f', label: 'IP ≥ 65 (Alto)' },
                    { color: '#52b788', label: 'IP 50-64 (Medio-Alto)' },
                    { color: '#ffd166', label: 'IP 35-49 (Medio)' },
                    { color: '#ef476f', label: 'IP < 35 (Bajo)' },
                    { color: '#cccccc', label: 'Sin dato' }
                ]
            };
        }

        if (type === 'class') {
            const classColors = {
                '1': '#1a9850', '2': '#66bd63', '3': '#a6d96a',
                '4': '#d9ef8b', '5': '#fee08b', '6': '#fdae61',
                '7': '#f46d43', '8': '#d73027'
            };
            return {
                title: 'Mapa de Clase de Uso de Suelo',
                colorFn: (unit) => classColors[String(unit.cu)] || '#cccccc',
                legend: [
                    { color: '#1a9850', label: 'Clase I' },
                    { color: '#66bd63', label: 'Clase II' },
                    { color: '#a6d96a', label: 'Clase III' },
                    { color: '#d9ef8b', label: 'Clase IV' },
                    { color: '#fee08b', label: 'Clase V' },
                    { color: '#fdae61', label: 'Clase VI' },
                    { color: '#f46d43', label: 'Clase VII' },
                    { color: '#d73027', label: 'Clase VIII' }
                ]
            };
        }

        if (type === 'series') {
            // Generate distinct colors for each unique unit
            const unitIds = [...new Set(features.map(f => f.textUserId))];
            const palette = [
                '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
                '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
                '#469990', '#dcbeff', '#9A6324', '#800000', '#aaffc3',
                '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#000000'
            ];
            const colorMap = {};
            unitIds.forEach((id, i) => { colorMap[id] = palette[i % palette.length]; });

            return {
                title: 'Mapa de Series de Suelo',
                colorFn: (unit) => colorMap[unit.textUserId] || '#cccccc',
                legend: unitIds.map((id, i) => ({
                    color: palette[i % palette.length],
                    label: id
                }))
            };
        }

        return { title: '', colorFn: () => '#ccc', legend: [] };
    },

    drawLegend(ctx, legend, canvasWidth, canvasHeight) {
        const itemH = 18;
        const boxSize = 12;
        const maxItems = Math.min(legend.length, 10);
        const legendH = maxItems * itemH + 16;
        const legendW = 160;
        const x = canvasWidth - legendW - 10;
        const y = canvasHeight - legendH - 10;

        // Background
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, legendW, legendH);
        ctx.strokeRect(x, y, legendW, legendH);

        // Items
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'left';
        for (let i = 0; i < maxItems; i++) {
            const item = legend[i];
            const iy = y + 10 + i * itemH;

            ctx.fillStyle = item.color;
            ctx.fillRect(x + 8, iy, boxSize, boxSize);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 8, iy, boxSize, boxSize);

            ctx.fillStyle = '#333';
            ctx.fillText(item.label, x + 8 + boxSize + 6, iy + 10);
        }

        if (legend.length > maxItems) {
            ctx.fillStyle = '#999';
            ctx.font = '10px Arial, sans-serif';
            ctx.fillText(`... y ${legend.length - maxItems} más`, x + 8, y + legendH - 4);
        }
    },

    drawNorthArrow(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#1b4332';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('N', x, y - 12);

        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x - 5, y + 4);
        ctx.lineTo(x, y + 1);
        ctx.lineTo(x + 5, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
};
