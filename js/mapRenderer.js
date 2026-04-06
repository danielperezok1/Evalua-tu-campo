/**
 * mapRenderer.js - Render thematic maps and satellite captures to canvas
 */
const MapRenderer = {

    CANVAS_WIDTH: 700,
    CANVAS_HEIGHT: 480,
    PADDING: 40,

    /**
     * Generate thematic maps (synchronous)
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
     * Generate satellite RGB captures for wet/dry year comparison (async)
     */
    async generateSatelliteCaptures(fieldGeoJSON, wettestYear, driestYear) {
        const results = {};

        // Available S2 cloudless years from EOX (2018-2023)
        // Sentinel-2 10m resolution at zoom 14
        const eoxYears = [2018, 2019, 2020, 2021, 2022, 2023];

        // Find closest EOX years, ensuring they are DIFFERENT
        let wetYear = this.findClosestYear(wettestYear, eoxYears);
        let dryYear = this.findClosestYear(driestYear, eoxYears);

        if (wetYear === dryYear) {
            const sortedByWet = [...eoxYears].sort((a, b) => Math.abs(a - wettestYear) - Math.abs(b - wettestYear));
            const sortedByDry = [...eoxYears].sort((a, b) => Math.abs(a - driestYear) - Math.abs(b - driestYear));
            wetYear = sortedByWet[0];
            dryYear = sortedByDry.find(y => y !== wetYear) || sortedByDry[1] || sortedByDry[0];
            if (wetYear === dryYear) {
                wetYear = eoxYears[eoxYears.length - 1];
                dryYear = eoxYears[0];
            }
        }

        // Esri fallback (always works with CORS)
        const esriTile = (z, y, x) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

        // EOX Sentinel-2 cloudless by year (10m native resolution)
        const eoxTile = (year) => (z, y, x) =>
            `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`;

        const hiResOpts = { hiRes: true };

        // Try wet year - Sentinel-2 10m
        try {
            results.wetImage = await this.renderSatelliteView(
                fieldGeoJSON, eoxTile(wetYear),
                `Sentinel-2 (10m) - Ano Lluvioso ${wettestYear} (composito S2 ${wetYear})`,
                hiResOpts
            );
            results.wetYear = wetYear;
            results.source = 'Sentinel-2';
        } catch (e) {
            console.warn('EOX wet failed, trying Esri:', e.message);
            try {
                results.wetImage = await this.renderSatelliteView(
                    fieldGeoJSON, esriTile,
                    `Imagen Satelital - Ano Lluvioso ${wettestYear}`,
                    hiResOpts
                );
                results.wetYear = wettestYear;
                results.source = 'Esri';
            } catch (e2) { console.warn('Wet capture failed:', e2.message); }
        }

        // Try dry year - Sentinel-2 10m
        try {
            results.dryImage = await this.renderSatelliteView(
                fieldGeoJSON, eoxTile(dryYear),
                `Sentinel-2 (10m) - Ano Seco ${driestYear} (composito S2 ${dryYear})`,
                hiResOpts
            );
            results.dryYear = dryYear;
        } catch (e) {
            console.warn('EOX dry failed, trying Esri:', e.message);
            try {
                results.dryImage = await this.renderSatelliteView(
                    fieldGeoJSON, esriTile,
                    `Imagen Satelital - Ano Seco ${driestYear}`,
                    hiResOpts
                );
                results.dryYear = driestYear;
            } catch (e2) { console.warn('Dry capture failed:', e2.message); }
        }

        return results;
    },

    findClosestYear(target, available) {
        return available.reduce((prev, curr) =>
            Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev
        );
    },

    /**
     * Capture satellite imagery for a field from tile service
     * @param {Object} fieldGeoJSON
     * @param {Function} tileUrlFn - (z, y, x) => url
     * @param {string} title
     * @param {Object} opts - { hiRes: true } for 10m Sentinel-2 resolution
     */
    async renderSatelliteView(fieldGeoJSON, tileUrlFn, title, opts) {
        const hiRes = opts && opts.hiRes;
        const W = hiRes ? 900 : this.CANVAS_WIDTH;
        const H = hiRes ? 620 : this.CANVAS_HEIGHT;
        const bbox = turf.bbox(fieldGeoJSON);

        // Expand bbox for context
        const expandFactor = hiRes ? 0.1 : 0.2;
        const expandLon = (bbox[2] - bbox[0]) * expandFactor;
        const expandLat = (bbox[3] - bbox[1]) * expandFactor;
        const viewBbox = [
            bbox[0] - expandLon, bbox[1] - expandLat,
            bbox[2] + expandLon, bbox[3] + expandLat
        ];

        // For hi-res: allow more tiles (up to 36) to get zoom 14 (~10m/px)
        const maxTiles = hiRes ? 36 : 20;
        const zoom = this.getZoomForBbox(viewBbox, W, H, maxTiles);
        const minTile = this.lonLatToTile(viewBbox[0], viewBbox[3], zoom);
        const maxTile = this.lonLatToTile(viewBbox[2], viewBbox[1], zoom);

        // Create tile canvas
        const tilesX = maxTile.x - minTile.x + 1;
        const tilesY = maxTile.y - minTile.y + 1;
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tilesX * 256;
        tileCanvas.height = tilesY * 256;
        const tileCtx = tileCanvas.getContext('2d');

        tileCtx.fillStyle = '#2a2a3a';
        tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

        // Load all tiles in parallel
        const promises = [];
        let loadedCount = 0;
        for (let tx = minTile.x; tx <= maxTile.x; tx++) {
            for (let ty = minTile.y; ty <= maxTile.y; ty++) {
                const url = tileUrlFn(zoom, ty, tx);
                const px = (tx - minTile.x) * 256;
                const py = (ty - minTile.y) * 256;
                promises.push(
                    this.loadTileImg(url).then(img => {
                        tileCtx.drawImage(img, px, py, 256, 256);
                        loadedCount++;
                    }).catch(() => {})
                );
            }
        }
        await Promise.all(promises);

        if (loadedCount === 0) throw new Error('No tiles loaded');

        // Create output canvas
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Map tile canvas to output
        const srcTL = this.lonLatToPixelInGrid(viewBbox[0], viewBbox[3], zoom, minTile.x, minTile.y);
        const srcBR = this.lonLatToPixelInGrid(viewBbox[2], viewBbox[1], zoom, minTile.x, minTile.y);
        const srcW = srcBR[0] - srcTL[0];
        const srcH = srcBR[1] - srcTL[1];

        ctx.drawImage(tileCanvas, srcTL[0], srcTL[1], srcW, srcH, 0, 0, W, H);

        // Projection for overlay
        const proj = {
            project: (lon, lat) => {
                const px = this.lonLatToPixelInGrid(lon, lat, zoom, minTile.x, minTile.y);
                return [(px[0] - srcTL[0]) / srcW * W, (px[1] - srcTL[1]) / srcH * H];
            }
        };

        // Field boundary (white + green double line)
        const fieldGeom = fieldGeoJSON.features[0].geometry;
        this.drawGeometry(ctx, fieldGeom, proj, null, 'rgba(255,255,255,0.8)', 3.5);
        this.drawGeometry(ctx, fieldGeom, proj, null, '#2d6a4f', 1.5);

        // Semi-transparent mask OUTSIDE the field
        this.drawOutsideMask(ctx, fieldGeom, proj, W, H);

        // Title bar
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, 32);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, W / 2, 16);

        // North arrow + attribution
        this.drawNorthArrowWhite(ctx, W - 25, 52);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '9px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Sentinel-2 / Esri', W - 8, H - 6);

        return canvas.toDataURL('image/jpeg', 0.92);
    },

    drawOutsideMask(ctx, fieldGeom, proj, W, H) {
        ctx.save();
        ctx.beginPath();
        // Outer rectangle (full canvas)
        ctx.rect(0, 0, W, H);

        // Inner path (field boundary) - counter-clockwise to create a hole
        const rings = fieldGeom.type === 'Polygon' ?
            [fieldGeom.coordinates[0]] :
            fieldGeom.coordinates.map(p => p[0]);

        for (const ring of rings) {
            for (let i = ring.length - 1; i >= 0; i--) {
                const [x, y] = proj.project(ring[i][0], ring[i][1]);
                if (i === ring.length - 1) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        }

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill('evenodd');
        ctx.restore();
    },

    /**
     * Render NDVI time series chart on canvas
     */
    renderNDVIChart(ndviData, precipData) {
        const W = this.CANVAS_WIDTH, H = 380;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, W, H);

        if (!ndviData || !ndviData.yearlyAvg || ndviData.yearlyAvg.length === 0) {
            ctx.fillStyle = '#999';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Datos NDVI no disponibles', W / 2, H / 2);
            return canvas.toDataURL('image/png');
        }

        const years = ndviData.yearlyAvg;
        const margin = { top: 50, right: 60, bottom: 55, left: 55 };
        const chartW = W - margin.left - margin.right;
        const chartH = H - margin.top - margin.bottom;

        // Y axis: NDVI 0 to 0.8
        const yMin = 0, yMax = 0.8;
        const toX = (i) => margin.left + (i + 0.5) / years.length * chartW;
        const toY = (v) => margin.top + (1 - (v - yMin) / (yMax - yMin)) * chartH;

        // Grid lines
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let v = 0; v <= 0.8; v += 0.1) {
            const y = toY(v);
            ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(W - margin.right, y); ctx.stroke();
        }

        // Bars
        const barW = Math.min(40, chartW / years.length * 0.7);
        for (let i = 0; i < years.length; i++) {
            const yr = years[i];
            const x = toX(i) - barW / 2;
            const y = toY(yr.ndvi);
            const h = toY(yMin) - y;

            // Bar gradient
            const grad = ctx.createLinearGradient(x, y, x, toY(yMin));
            if (yr.ndvi >= 0.5) {
                grad.addColorStop(0, '#2d6a4f');
                grad.addColorStop(1, '#52b788');
            } else if (yr.ndvi >= 0.35) {
                grad.addColorStop(0, '#52b788');
                grad.addColorStop(1, '#95d5b2');
            } else {
                grad.addColorStop(0, '#d4a373');
                grad.addColorStop(1, '#e9c46a');
            }

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, h);

            // Border
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, barW, h);

            // NDVI value on top
            ctx.fillStyle = '#333';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(yr.ndvi.toFixed(2), toX(i), y - 6);

            // Year label
            ctx.fillStyle = '#666';
            ctx.font = '11px Arial';
            ctx.fillText(yr.year, toX(i), toY(yMin) + 16);
        }

        // Average line
        if (ndviData.avgNDVI) {
            const avgY = toY(ndviData.avgNDVI);
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#e63946';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(margin.left, avgY); ctx.lineTo(W - margin.right, avgY); ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#e63946';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`Prom: ${ndviData.avgNDVI}`, W - margin.right + 5, avgY + 4);
        }

        // Precipitation overlay (if available) - line chart on secondary axis
        if (precipData && precipData.yearlyData && precipData.yearlyData.length === years.length) {
            const precips = precipData.yearlyData;
            const maxPrecip = Math.max(...precips.map(p => p.precip));
            const minPrecip = Math.min(...precips.map(p => p.precip));
            const precipToY = (v) => margin.top + (1 - (v - minPrecip * 0.8) / (maxPrecip * 1.1 - minPrecip * 0.8)) * chartH;

            ctx.strokeStyle = '#4895ef';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < precips.length; i++) {
                const x = toX(i);
                const y = precipToY(precips[i].precip);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Precip dots
            for (let i = 0; i < precips.length; i++) {
                const x = toX(i);
                const y = precipToY(precips[i].precip);
                ctx.fillStyle = '#4895ef';
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();

                // Precip value
                ctx.fillStyle = '#4895ef';
                ctx.font = '9px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${precips[i].precip}mm`, x, y - 10);
            }

            // Right Y axis label for precip
            ctx.save();
            ctx.fillStyle = '#4895ef';
            ctx.font = '11px Arial';
            ctx.translate(W - 10, margin.top + chartH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText('Precipitacion (mm)', 0, 0);
            ctx.restore();
        }

        // Y axis label
        ctx.save();
        ctx.fillStyle = '#2d6a4f';
        ctx.font = '11px Arial';
        ctx.translate(15, margin.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('NDVI', 0, 0);
        ctx.restore();

        // Y axis ticks
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        for (let v = 0; v <= 0.8; v += 0.2) {
            ctx.fillText(v.toFixed(1), margin.left - 8, toY(v) + 4);
        }

        // Title
        ctx.fillStyle = '#1b4332';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NDVI Historico vs Precipitacion Anual', W / 2, 20);

        // Subtitle
        ctx.fillStyle = '#888';
        ctx.font = '11px Arial';
        ctx.fillText(`${ndviData.source} | Periodo: ${ndviData.period}`, W / 2, 36);

        // Legend
        const legX = margin.left + 10;
        const legY = H - 18;
        ctx.fillStyle = '#2d6a4f';
        ctx.fillRect(legX, legY - 8, 12, 8);
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('NDVI', legX + 16, legY);

        ctx.strokeStyle = '#4895ef'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(legX + 65, legY - 4); ctx.lineTo(legX + 80, legY - 4); ctx.stroke();
        ctx.fillStyle = '#555';
        ctx.fillText('Lluvia', legX + 85, legY);

        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#e63946'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(legX + 130, legY - 4); ctx.lineTo(legX + 148, legY - 4); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#555';
        ctx.fillText('Promedio NDVI', legX + 153, legY);

        return canvas.toDataURL('image/png');
    },

    /**
     * Generate NDVI-like greenness map from satellite RGB tiles.
     * Computes vegetation index per pixel inside the field boundary.
     */
    async renderNDVIMap(fieldGeoJSON) {
        const W = 900, H = 620; // High res canvas for 10m detail
        const bbox = turf.bbox(fieldGeoJSON);

        // Tight bbox for maximum detail
        const expandLon = (bbox[2] - bbox[0]) * 0.1;
        const expandLat = (bbox[3] - bbox[1]) * 0.1;
        const viewBbox = [
            bbox[0] - expandLon, bbox[1] - expandLat,
            bbox[2] + expandLon, bbox[3] + expandLat
        ];

        // Use higher zoom (up to 36 tiles) for ~10m/px Sentinel-2 detail
        const zoom = this.getZoomForBbox(viewBbox, W, H, 36);
        const minTile = this.lonLatToTile(viewBbox[0], viewBbox[3], zoom);
        const maxTile = this.lonLatToTile(viewBbox[2], viewBbox[1], zoom);

        // Load satellite tiles - try EOX Sentinel-2 first, fallback to Esri
        const tilesX = maxTile.x - minTile.x + 1;
        const tilesY = maxTile.y - minTile.y + 1;
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tilesX * 256;
        tileCanvas.height = tilesY * 256;
        const tileCtx = tileCanvas.getContext('2d');
        tileCtx.fillStyle = '#2a2a3a';
        tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

        // Try Sentinel-2 cloudless (2023 = most recent), fallback to Esri
        const eoxTile = (z, y, x) =>
            `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`;
        const esriTile = (z, y, x) =>
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

        let tileSource = 'Sentinel-2 (10m)';

        // Try EOX Sentinel-2 first
        let loadedCount = 0;
        const loadTiles = async (tileFn) => {
            const promises = [];
            loadedCount = 0;
            // Clear canvas for retry
            tileCtx.fillStyle = '#2a2a3a';
            tileCtx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
            for (let tx = minTile.x; tx <= maxTile.x; tx++) {
                for (let ty = minTile.y; ty <= maxTile.y; ty++) {
                    const url = tileFn(zoom, ty, tx);
                    const px = (tx - minTile.x) * 256;
                    const py = (ty - minTile.y) * 256;
                    promises.push(
                        this.loadTileImg(url).then(img => {
                            tileCtx.drawImage(img, px, py, 256, 256);
                            loadedCount++;
                        }).catch(() => {})
                    );
                }
            }
            await Promise.all(promises);
        };

        // Try Sentinel-2 first
        await loadTiles(eoxTile);
        if (loadedCount === 0) {
            // Fallback to Esri
            tileSource = 'Esri World Imagery';
            await loadTiles(esriTile);
        }
        if (loadedCount === 0) throw new Error('No tiles loaded for NDVI map');

        // Create output canvas
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Map tiles to output
        const srcTL = this.lonLatToPixelInGrid(viewBbox[0], viewBbox[3], zoom, minTile.x, minTile.y);
        const srcBR = this.lonLatToPixelInGrid(viewBbox[2], viewBbox[1], zoom, minTile.x, minTile.y);
        const srcW = srcBR[0] - srcTL[0];
        const srcH = srcBR[1] - srcTL[1];

        // Draw satellite base (dimmed)
        ctx.drawImage(tileCanvas, srcTL[0], srcTL[1], srcW, srcH, 0, 0, W, H);

        // Get pixel data to compute vegetation index
        const imgData = ctx.getImageData(0, 0, W, H);
        const pixels = imgData.data;

        // Build field mask using canvas path
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = W; maskCanvas.height = H;
        const maskCtx = maskCanvas.getContext('2d');

        const proj = {
            project: (lon, lat) => {
                const px = this.lonLatToPixelInGrid(lon, lat, zoom, minTile.x, minTile.y);
                return [(px[0] - srcTL[0]) / srcW * W, (px[1] - srcTL[1]) / srcH * H];
            }
        };

        // Draw field polygon on mask
        const fieldGeom = fieldGeoJSON.features[0].geometry;
        const rings = fieldGeom.type === 'Polygon' ?
            [fieldGeom.coordinates[0]] :
            fieldGeom.coordinates.map(p => p[0]);

        maskCtx.fillStyle = '#fff';
        for (const ring of rings) {
            maskCtx.beginPath();
            for (let i = 0; i < ring.length; i++) {
                const [x, y] = proj.project(ring[i][0], ring[i][1]);
                if (i === 0) maskCtx.moveTo(x, y);
                else maskCtx.lineTo(x, y);
            }
            maskCtx.closePath();
            maskCtx.fill();
        }
        const maskData = maskCtx.getImageData(0, 0, W, H).data;

        // Compute vegetation index for pixels inside field
        // Using ExG (Excess Green): 2*G - R - B, normalized to 0-1
        const viValues = [];
        for (let i = 0; i < pixels.length; i += 4) {
            const maskVal = maskData[i]; // R channel of mask
            if (maskVal > 128) {
                const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                const total = r + g + b;
                if (total > 30) { // Skip very dark pixels
                    const exg = (2 * g - r - b + 255) / 510; // Normalize to 0-1
                    viValues.push({ idx: i, vi: exg });
                }
            }
        }

        // Compute percentiles for better color mapping
        const sorted = viValues.map(v => v.vi).sort((a, b) => a - b);
        const p5 = sorted[Math.floor(sorted.length * 0.05)] || 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
        const range = Math.max(p95 - p5, 0.01);

        // Apply NDVI color palette to field pixels
        // Outside field: dim satellite
        const outCanvas = document.createElement('canvas');
        outCanvas.width = W; outCanvas.height = H;
        const outCtx = outCanvas.getContext('2d');

        // Draw dimmed satellite base
        outCtx.drawImage(canvas, 0, 0);
        outCtx.fillStyle = 'rgba(0,0,0,0.5)';
        outCtx.fillRect(0, 0, W, H);

        const outData = outCtx.getImageData(0, 0, W, H);
        const outPixels = outData.data;

        // NDVI gradient: brown -> yellow -> light green -> dark green
        const ndviPalette = [
            [139, 90, 43],    // 0.0 - brown (bare soil)
            [189, 146, 62],   // 0.15
            [220, 200, 80],   // 0.3 - yellow
            [170, 210, 80],   // 0.45
            [100, 180, 60],   // 0.6 - green
            [50, 140, 50],    // 0.75
            [30, 100, 40],    // 0.9 - dark green
            [20, 70, 30]      // 1.0
        ];

        for (const { idx, vi } of viValues) {
            const norm = Math.max(0, Math.min(1, (vi - p5) / range));
            const palIdx = norm * (ndviPalette.length - 1);
            const lo = Math.floor(palIdx);
            const hi = Math.min(lo + 1, ndviPalette.length - 1);
            const t = palIdx - lo;

            outPixels[idx] = ndviPalette[lo][0] + (ndviPalette[hi][0] - ndviPalette[lo][0]) * t;
            outPixels[idx + 1] = ndviPalette[lo][1] + (ndviPalette[hi][1] - ndviPalette[lo][1]) * t;
            outPixels[idx + 2] = ndviPalette[lo][2] + (ndviPalette[hi][2] - ndviPalette[lo][2]) * t;
            outPixels[idx + 3] = 255;
        }
        outCtx.putImageData(outData, 0, 0);

        // Field boundary
        this.drawGeometry(outCtx, fieldGeom, proj, null, 'rgba(255,255,255,0.8)', 2.5);
        this.drawGeometry(outCtx, fieldGeom, proj, null, '#1b4332', 1.5);

        // Title bar
        outCtx.fillStyle = 'rgba(0,0,0,0.65)';
        outCtx.fillRect(0, 0, W, 32);
        outCtx.fillStyle = '#ffffff';
        outCtx.font = 'bold 14px Arial, sans-serif';
        outCtx.textAlign = 'center';
        outCtx.textBaseline = 'middle';
        outCtx.fillText(`Mapa de Verdor / NDVI estimado - ${tileSource} - Zoom ${zoom}`, W / 2, 16);

        // North arrow
        this.drawNorthArrowWhite(outCtx, W - 25, 52);

        // Legend
        const legW = 25, legH = 150;
        const legX = W - legW - 50, legY = H - legH - 40;

        // Gradient bar
        for (let y = 0; y < legH; y++) {
            const norm = 1 - y / legH; // Top = high, bottom = low
            const palIdx = norm * (ndviPalette.length - 1);
            const lo = Math.floor(palIdx);
            const hi = Math.min(lo + 1, ndviPalette.length - 1);
            const t = palIdx - lo;
            const r = ndviPalette[lo][0] + (ndviPalette[hi][0] - ndviPalette[lo][0]) * t;
            const g = ndviPalette[lo][1] + (ndviPalette[hi][1] - ndviPalette[lo][1]) * t;
            const b = ndviPalette[lo][2] + (ndviPalette[hi][2] - ndviPalette[lo][2]) * t;
            outCtx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
            outCtx.fillRect(legX, legY + y, legW, 1);
        }
        outCtx.strokeStyle = '#fff'; outCtx.lineWidth = 1;
        outCtx.strokeRect(legX, legY, legW, legH);

        // Legend labels
        outCtx.fillStyle = '#fff'; outCtx.font = '11px Arial'; outCtx.textAlign = 'left';
        outCtx.fillText('Alto', legX + legW + 5, legY + 10);
        outCtx.fillText('Medio', legX + legW + 5, legY + legH / 2 + 4);
        outCtx.fillText('Bajo', legX + legW + 5, legY + legH - 2);

        // Label
        outCtx.fillStyle = '#fff'; outCtx.font = 'bold 11px Arial'; outCtx.textAlign = 'center';
        outCtx.fillText('Verdor', legX + legW / 2, legY - 8);

        // Attribution
        outCtx.fillStyle = 'rgba(255,255,255,0.5)';
        outCtx.font = '9px Arial'; outCtx.textAlign = 'right';
        outCtx.fillText(`Verdor calculado desde ${tileSource} (RGB)`, W - 8, H - 6);

        return outCanvas.toDataURL('image/jpeg', 0.92);
    },

    /**
     * Render productivity chart as fallback when NDVI data unavailable
     */
    renderProductivityChart(prodData, precipData) {
        const W = this.CANVAS_WIDTH, H = 380;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, W, H);

        if (!prodData || !prodData.yearlyProductivity || prodData.yearlyProductivity.length === 0) {
            ctx.fillStyle = '#999'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Datos de productividad no disponibles', W / 2, H / 2);
            return canvas.toDataURL('image/png');
        }

        const years = prodData.yearlyProductivity;
        const margin = { top: 50, right: 60, bottom: 55, left: 55 };
        const chartW = W - margin.left - margin.right;
        const chartH = H - margin.top - margin.bottom;

        const yMin = 0, yMax = 100;
        const toX = (i) => margin.left + (i + 0.5) / years.length * chartW;
        const toY = (v) => margin.top + (1 - (v - yMin) / (yMax - yMin)) * chartH;

        // Grid
        ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 0.5;
        for (let v = 0; v <= 100; v += 20) {
            const y = toY(v);
            ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(W - margin.right, y); ctx.stroke();
        }

        // Bars
        const barW = Math.min(40, chartW / years.length * 0.7);
        for (let i = 0; i < years.length; i++) {
            const yr = years[i];
            const x = toX(i) - barW / 2;
            const y = toY(yr.productivityScore);
            const h = toY(yMin) - y;

            const grad = ctx.createLinearGradient(x, y, x, toY(yMin));
            if (yr.category === 'Buena') { grad.addColorStop(0, '#2d6a4f'); grad.addColorStop(1, '#52b788'); }
            else if (yr.category === 'Regular') { grad.addColorStop(0, '#e9c46a'); grad.addColorStop(1, '#f4e285'); }
            else { grad.addColorStop(0, '#e76f51'); grad.addColorStop(1, '#f4a261'); }

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, h);
            ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, barW, h);

            ctx.fillStyle = '#333'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
            ctx.fillText(yr.productivityScore, toX(i), y - 6);

            ctx.fillStyle = '#666'; ctx.font = '11px Arial';
            ctx.fillText(yr.year, toX(i), toY(yMin) + 16);
        }

        // Average line
        const avgY = toY(prodData.avgScore);
        ctx.setLineDash([6, 4]); ctx.strokeStyle = '#e63946'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(margin.left, avgY); ctx.lineTo(W - margin.right, avgY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e63946'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'left';
        ctx.fillText(`Prom: ${prodData.avgScore}`, W - margin.right + 5, avgY + 4);

        // Precip overlay
        if (precipData && precipData.yearlyData) {
            const precips = precipData.yearlyData;
            const maxP = Math.max(...precips.map(p => p.precip));
            const minP = Math.min(...precips.map(p => p.precip));
            const pToY = (v) => margin.top + (1 - (v - minP * 0.8) / (maxP * 1.1 - minP * 0.8)) * chartH;

            ctx.strokeStyle = '#4895ef'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < Math.min(precips.length, years.length); i++) {
                const x = toX(i), y = pToY(precips[i].precip);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            for (let i = 0; i < Math.min(precips.length, years.length); i++) {
                const x = toX(i), y = pToY(precips[i].precip);
                ctx.fillStyle = '#4895ef';
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
                ctx.font = '9px Arial'; ctx.textAlign = 'center';
                ctx.fillText(`${precips[i].precip}mm`, x, y - 10);
            }

            ctx.save(); ctx.fillStyle = '#4895ef'; ctx.font = '11px Arial';
            ctx.translate(W - 10, margin.top + chartH / 2);
            ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
            ctx.fillText('Precipitacion (mm)', 0, 0); ctx.restore();
        }

        // Y axis
        ctx.save(); ctx.fillStyle = '#2d6a4f'; ctx.font = '11px Arial';
        ctx.translate(15, margin.top + chartH / 2);
        ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
        ctx.fillText('Productividad (IP x Lluvia)', 0, 0); ctx.restore();

        ctx.fillStyle = '#888'; ctx.font = '10px Arial'; ctx.textAlign = 'right';
        for (let v = 0; v <= 100; v += 20) ctx.fillText(v, margin.left - 8, toY(v) + 4);

        // Title
        ctx.fillStyle = '#1b4332'; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Productividad Historica vs Precipitacion', W / 2, 20);
        ctx.fillStyle = '#888'; ctx.font = '11px Arial';
        ctx.fillText('Modelo: IP suelo x factor lluvia | Fuente precipitacion: Open-Meteo', W / 2, 36);

        // Legend
        const legX = margin.left + 10, legY = H - 18;
        ctx.fillStyle = '#2d6a4f'; ctx.fillRect(legX, legY - 8, 12, 8);
        ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Productividad', legX + 16, legY);
        ctx.strokeStyle = '#4895ef'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(legX + 95, legY - 4); ctx.lineTo(legX + 110, legY - 4); ctx.stroke();
        ctx.fillStyle = '#555'; ctx.fillText('Lluvia', legX + 115, legY);
        ctx.setLineDash([4, 3]); ctx.strokeStyle = '#e63946'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(legX + 155, legY - 4); ctx.lineTo(legX + 173, legY - 4); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#555'; ctx.fillText('Promedio', legX + 178, legY);

        return canvas.toDataURL('image/png');
    },

    // === THEMATIC MAP RENDERING (existing) ===

    renderMap(fieldGeoJSON, features, bbox, type) {
        const canvas = document.createElement('canvas');
        canvas.width = this.CANVAS_WIDTH;
        canvas.height = this.CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#e8ecef';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const proj = this.getProjection(bbox, canvas.width, canvas.height, this.PADDING);
        const { colorFn, legend, title } = this.getTheme(type, features);

        // Clip rendering to field boundary so external polygons don't bleed out
        const fieldGeom = fieldGeoJSON.features[0].geometry;
        ctx.save();
        this._clipToField(ctx, fieldGeom, proj);

        for (const unit of features) {
            const geom = unit.geometry.geometry || unit.geometry;
            const color = colorFn(unit);
            this.drawGeometry(ctx, geom, proj, color, 'rgba(80,80,80,0.4)', 0.5);
        }
        ctx.restore();

        // Field border on top (outside clip)
        this.drawGeometry(ctx, fieldGeom, proj, null, '#1b4332', 2.5);

        // Dim area outside field
        this.drawOutsideMask(ctx, fieldGeom, proj, canvas.width, canvas.height);

        // Re-draw border over mask so it stays sharp
        this.drawGeometry(ctx, fieldGeom, proj, null, '#1b4332', 2);

        ctx.fillStyle = '#1b4332';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 22);

        this.drawLegend(ctx, legend, canvas.width, canvas.height);
        this.drawNorthArrow(ctx, canvas.width - 30, 50);

        return canvas.toDataURL('image/png');
    },

    /** Set a canvas clip path matching the field polygon */
    _clipToField(ctx, fieldGeom, proj) {
        const rings = fieldGeom.type === 'Polygon'
            ? [fieldGeom.coordinates[0]]
            : fieldGeom.coordinates.map(p => p[0]);
        ctx.beginPath();
        for (const ring of rings) {
            for (let i = 0; i < ring.length; i++) {
                const [x, y] = proj.project(ring[i][0], ring[i][1]);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
        ctx.clip();
    },

    // === PROJECTION & GEOMETRY ===

    getProjection(bbox, width, height, padding) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        const midLat = (minLat + maxLat) / 2;
        const latCorrFactor = Math.cos(midLat * Math.PI / 180);

        const geoWidth = (maxLon - minLon) * latCorrFactor;
        const geoHeight = maxLat - minLat;

        const availW = width - 2 * padding;
        const availH = height - 2 * padding - 30;
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
        if (type === 'Polygon') rings = [geometry.coordinates];
        else if (type === 'MultiPolygon') rings = geometry.coordinates;
        else return;

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
                if (ri === 0 && fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
                if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
            }
        }
    },

    // === TILE HELPERS ===

    lonLatToTile(lon, lat, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
    },

    lonLatToPixelInGrid(lon, lat, zoom, minTileX, minTileY) {
        const n = Math.pow(2, zoom);
        const x = ((lon + 180) / 360 * n - minTileX) * 256;
        const latRad = lat * Math.PI / 180;
        const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - minTileY) * 256;
        return [x, y];
    },

    getZoomForBbox(bbox, width, height, maxTiles) {
        const maxT = maxTiles || 20; // default 4x5=20
        const maxPerAxis = Math.ceil(Math.sqrt(maxT));
        for (let z = 16; z >= 1; z--) {
            const tl = this.lonLatToTile(bbox[0], bbox[3], z);
            const br = this.lonLatToTile(bbox[2], bbox[1], z);
            const tilesX = br.x - tl.x + 1;
            const tilesY = br.y - tl.y + 1;
            if (tilesX * tilesY <= maxT && tilesX <= maxPerAxis + 2 && tilesY <= maxPerAxis + 2) return z;
        }
        return 10;
    },

    loadTileImg(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const timeout = setTimeout(() => reject(new Error('timeout')), 8000);
            img.onload = () => { clearTimeout(timeout); resolve(img); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('load error')); };
            img.src = url;
        });
    },

    // === THEME DEFINITIONS ===

    getTheme(type, features) {
        if (type === 'ip') {
            return {
                title: 'Mapa de Indice de Productividad (IP)',
                colorFn: (unit) => {
                    const ip = unit.ip;
                    if (ip == null || ip <= 0) return '#cccccc';
                    if (ip >= 65) return '#2d6a4f';
                    if (ip >= 50) return '#52b788';
                    if (ip >= 35) return '#ffd166';
                    return '#ef476f';
                },
                legend: [
                    { color: '#2d6a4f', label: 'IP >= 65 (Alto)' },
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
                    { color: '#1a9850', label: 'Clase I' }, { color: '#66bd63', label: 'Clase II' },
                    { color: '#a6d96a', label: 'Clase III' }, { color: '#d9ef8b', label: 'Clase IV' },
                    { color: '#fee08b', label: 'Clase V' }, { color: '#fdae61', label: 'Clase VI' },
                    { color: '#f46d43', label: 'Clase VII' }, { color: '#d73027', label: 'Clase VIII' }
                ]
            };
        }
        if (type === 'series') {
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
                legend: unitIds.map((id, i) => ({ color: palette[i % palette.length], label: id }))
            };
        }
        return { title: '', colorFn: () => '#ccc', legend: [] };
    },

    // === DECORATIONS ===

    drawLegend(ctx, legend, canvasWidth, canvasHeight) {
        const itemH = 18, boxSize = 12;
        const maxItems = Math.min(legend.length, 10);
        const legendH = maxItems * itemH + 16;
        const legendW = 160;
        const x = canvasWidth - legendW - 10;
        const y = canvasHeight - legendH - 10;

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
        ctx.fillRect(x, y, legendW, legendH);
        ctx.strokeRect(x, y, legendW, legendH);

        ctx.font = '11px Arial, sans-serif'; ctx.textAlign = 'left';
        for (let i = 0; i < maxItems; i++) {
            const item = legend[i];
            const iy = y + 10 + i * itemH;
            ctx.fillStyle = item.color;
            ctx.fillRect(x + 8, iy, boxSize, boxSize);
            ctx.strokeStyle = '#666'; ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 8, iy, boxSize, boxSize);
            ctx.fillStyle = '#333';
            ctx.fillText(item.label, x + 8 + boxSize + 6, iy + 10);
        }
        if (legend.length > maxItems) {
            ctx.fillStyle = '#999'; ctx.font = '10px Arial';
            ctx.fillText(`... y ${legend.length - maxItems} mas`, x + 8, y + legendH - 4);
        }
    },

    drawNorthArrow(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#1b4332';
        ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('N', x, y - 12);
        ctx.beginPath();
        ctx.moveTo(x, y - 8); ctx.lineTo(x - 5, y + 4);
        ctx.lineTo(x, y + 1); ctx.lineTo(x + 5, y + 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    },

    drawNorthArrowWhite(ctx, x, y) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
        ctx.fillText('N', x, y - 12);
        ctx.beginPath();
        ctx.moveTo(x, y - 8); ctx.lineTo(x - 5, y + 4);
        ctx.lineTo(x, y + 1); ctx.lineTo(x + 5, y + 4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
};
