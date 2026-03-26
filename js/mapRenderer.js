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
            seriesMap: this.renderMap(fieldGeoJSON, features, bbox, 'series'),
            ndviMap: this.renderNDVIMap(fieldGeoJSON, features, bbox)
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
    },

    /**
     * Render an interpolated NDVI/productivity map with smooth gradients
     * Uses IP as proxy for NDVI estimation, with gaussian blur for smooth look
     */
    renderNDVIMap(fieldGeoJSON, features, bbox) {
        const W = this.CANVAS_WIDTH;
        const H = this.CANVAS_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Dark background (satellite feel)
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        const proj = this.getProjection(bbox, W, H, this.PADDING);

        // Step 1: Draw soil units with NDVI gradient colors on a temp canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = W;
        tempCanvas.height = H;
        const tempCtx = tempCanvas.getContext('2d');

        for (const unit of features) {
            const geom = unit.geometry.geometry || unit.geometry;
            const ip = unit.ip || 0;
            // Convert IP (0-100) to estimated NDVI (0.1-0.75)
            const ndvi = 0.1 + (ip / 100) * 0.65;
            const color = this.ndviColor(ndvi);
            this.drawGeometry(tempCtx, geom, proj, color, null, 0);
        }

        // Step 2: Create field boundary mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = W;
        maskCanvas.height = H;
        const maskCtx = maskCanvas.getContext('2d');
        const fieldGeom = fieldGeoJSON.features[0].geometry;
        this.drawGeometry(maskCtx, fieldGeom, proj, '#fff', null, 0);

        // Step 3: Apply gaussian blur for smooth interpolated look
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = W;
        blurCanvas.height = H;
        const blurCtx = blurCanvas.getContext('2d');
        blurCtx.filter = 'blur(8px)';
        blurCtx.drawImage(tempCanvas, 0, 0);
        blurCtx.filter = 'none';

        // Step 4: Draw blurred colors, then sharp colors at lower opacity on top
        // Clip to field boundary
        ctx.save();
        this.clipToField(ctx, fieldGeom, proj);

        // Blurred base (smooth interpolation feel)
        ctx.drawImage(blurCanvas, 0, 0);

        // Sharp overlay at 50% for definition
        ctx.globalAlpha = 0.5;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1.0;

        ctx.restore();

        // Step 5: Draw thin unit boundaries (subtle)
        for (const unit of features) {
            const geom = unit.geometry.geometry || unit.geometry;
            this.drawGeometry(ctx, geom, proj, null, 'rgba(255,255,255,0.25)', 0.5);
        }

        // Step 6: Draw field boundary (strong)
        this.drawGeometry(ctx, fieldGeom, proj, null, '#ffffff', 2.5);

        // Step 7: Add IP labels on each unit
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const unit of features) {
            if (unit.percentage < 3) continue; // skip tiny units
            const geom = unit.geometry.geometry || unit.geometry;
            try {
                const centroid = turf.centroid(unit.geometry.geometry ? unit.geometry : turf.feature(geom));
                const [cx, cy] = proj.project(centroid.geometry.coordinates[0], centroid.geometry.coordinates[1]);
                const ip = unit.ip || 0;
                // Text shadow for readability
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillText(ip, cx + 1, cy + 1);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(ip, cx, cy);
            } catch (e) { /* skip */ }
        }

        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Mapa de NDVI / Productividad Estimada', W / 2, 8);
        ctx.font = '11px Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('Basado en IP del suelo (proxy de vigor vegetal)', W / 2, 28);

        // North arrow (white version)
        this.drawNorthArrowWhite(ctx, W - 30, 55);

        // Gradient legend bar
        this.drawNDVILegend(ctx, W, H);

        return canvas.toDataURL('image/png');
    },

    clipToField(ctx, fieldGeom, proj) {
        const type = fieldGeom.type;
        let coords;
        if (type === 'Polygon') {
            coords = [fieldGeom.coordinates[0]];
        } else if (type === 'MultiPolygon') {
            coords = fieldGeom.coordinates.map(p => p[0]);
        } else return;

        ctx.beginPath();
        for (const ring of coords) {
            const [x0, y0] = proj.project(ring[0][0], ring[0][1]);
            ctx.moveTo(x0, y0);
            for (let i = 1; i < ring.length; i++) {
                const [x, y] = proj.project(ring[i][0], ring[i][1]);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
        ctx.clip();
    },

    /**
     * NDVI color scale: brown -> yellow -> green (satellite style)
     */
    ndviColor(ndvi) {
        // Clamp
        const v = Math.max(0, Math.min(1, ndvi));
        // Color stops: 0.0=brown, 0.2=tan, 0.35=yellow, 0.5=lime, 0.65=green, 0.8=dark green
        const stops = [
            { at: 0.00, r: 139, g: 90, b: 43 },   // brown (bare soil)
            { at: 0.15, r: 189, g: 146, b: 72 },   // tan
            { at: 0.25, r: 215, g: 192, b: 88 },   // yellow-brown
            { at: 0.35, r: 232, g: 220, b: 80 },   // yellow
            { at: 0.45, r: 180, g: 210, b: 60 },   // yellow-green
            { at: 0.55, r: 100, g: 180, b: 50 },   // light green
            { at: 0.65, r: 40, g: 150, b: 40 },     // green
            { at: 0.80, r: 15, g: 110, b: 30 },     // dark green
            { at: 1.00, r: 0, g: 80, b: 20 }        // very dark green
        ];

        // Find segment
        let lo = stops[0], hi = stops[stops.length - 1];
        for (let i = 0; i < stops.length - 1; i++) {
            if (v >= stops[i].at && v <= stops[i + 1].at) {
                lo = stops[i];
                hi = stops[i + 1];
                break;
            }
        }

        const t = (hi.at === lo.at) ? 0 : (v - lo.at) / (hi.at - lo.at);
        const r = Math.round(lo.r + (hi.r - lo.r) * t);
        const g = Math.round(lo.g + (hi.g - lo.g) * t);
        const b = Math.round(lo.b + (hi.b - lo.b) * t);

        return `rgb(${r},${g},${b})`;
    },

    drawNDVILegend(ctx, canvasWidth, canvasHeight) {
        const barW = 20;
        const barH = 180;
        const x = canvasWidth - 55;
        const y = canvasHeight - barH - 50;

        // Background panel
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const panelW = 50;
        ctx.fillRect(x - 8, y - 25, panelW, barH + 55);

        // Title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NDVI', x + barW / 2, y - 10);

        // Gradient bar
        for (let i = 0; i < barH; i++) {
            const ndvi = 0.8 - (i / barH) * 0.7; // top=0.8, bottom=0.1
            ctx.fillStyle = this.ndviColor(ndvi);
            ctx.fillRect(x, y + i, barW, 1);
        }

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barW, barH);

        // Labels
        ctx.fillStyle = '#fff';
        ctx.font = '9px Arial, sans-serif';
        ctx.textAlign = 'left';
        const labels = [
            { val: '0.8', yPos: 0 },
            { val: '0.6', yPos: barH * 0.29 },
            { val: '0.4', yPos: barH * 0.57 },
            { val: '0.2', yPos: barH * 0.86 },
            { val: '0.1', yPos: barH }
        ];
        for (const lb of labels) {
            ctx.fillText(lb.val, x + barW + 3, y + lb.yPos + 3);
        }
    },

    drawNorthArrowWhite(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
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
