/**
 * report.js - Generate HTML report from analysis results
 */
const Report = {

    generate(results, options, climateData, mapImages, satelliteData, campaignClimate) {
        const { reportType, fieldName, detailLevel } = options;

        const typeLabels = {
            alquiler: 'Alquiler',
            compra: 'Compra',
            manejo: 'Manejo',
            reclamo: 'Reclamo'
        };

        let html = '';

        // Header with author
        html += `<div class="d-flex justify-content-between align-items-start mb-2">`;
        html += `<div>`;
        html += `<h5 class="mb-1"><i class="bi bi-file-earmark-text me-1"></i> ${fieldName || 'Campo sin nombre'}</h5>`;
        html += `<p class="text-muted mb-0">Informe para <strong>${typeLabels[reportType]}</strong> &middot; ${new Date().toLocaleDateString('es-AR')}</p>`;
        html += `</div>`;
        html += `<div class="text-end small text-muted">`;
        html += `<div>Evalua tu Campo</div>`;
        html += `</div>`;
        html += `</div>`;

        // Detectar si no hay datos de suelo (campo fuera de toda cobertura)
        const noSoilData = reportType === 'reclamo' && (!results.grouped || results.grouped.length === 0);
        const soilSource = results._soilSource || 'IDECOR';
        const isBASoil = soilSource === 'BA_50mil';

        // Summary cards — sin suelo: solo superficie
        html += '<div class="row g-2 mb-3">';
        html += this.summaryCard('Superficie', `${results.totalAreaHa.toFixed(1)} ha`, 'bi-rulers');
        if (!noSoilData) {
            html += this.summaryCard('IP Promedio', results.weightedIP !== null ? results.weightedIP : 'S/D', 'bi-speedometer2', this.ipClass(results.weightedIP));
            html += this.summaryCard('Unidades', results.grouped.length, 'bi-layers');
            html += this.summaryCard('Cobertura', `${results.coveragePercent.toFixed(0)}%`, 'bi-pie-chart');
        }
        html += '</div>';

        // Climate summary cards
        if (climateData) {
            html += '<div class="row g-2 mb-3">';
            html += this.summaryCard('Lluvia anual', `${climateData.annualPrecip} mm`, 'bi-cloud-rain');
            html += this.summaryCard('Lluvia campana', `${climateData.growingSeasonPrecip} mm`, 'bi-moisture');
            html += this.summaryCard('Temp. max', `${climateData.avgTempMax}\u00B0C`, 'bi-thermometer-high');
            html += this.summaryCard('Temp. min', `${climateData.avgTempMin}\u00B0C`, 'bi-thermometer-low');
            html += '</div>';
        }

        // Mapas temáticos y tabla de suelos: omitir si no hay datos de suelo
        if (!noSoilData) {
            if (mapImages && !isBASoil) {
                html += this.mapsSection(mapImages);
            }
            html += '<h5 class="mt-4"><i class="bi bi-table me-1"></i> Unidades de Suelo</h5>';
            if (isBASoil) {
                html += `<div class="alert alert-info py-1 px-2 small mb-2"><i class="bi bi-info-circle me-1"></i> Fuente: Carta de Suelos Prov. Buenos Aires 1:50.000 (INTA). IP no relevado en esta fuente (S/D).</div>`;
            }
            html += this.soilTable(results.grouped, detailLevel);
        }

        // Sección específica por tipo de informe
        if (reportType === 'alquiler') {
            html += this.alquilerSection(results);
        } else if (reportType === 'compra') {
            html += this.compraSection(results);
        } else if (reportType === 'manejo') {
            html += this.manejoSection(results);
        } else if (reportType === 'reclamo') {
            html += this.reclamoSection(results, campaignClimate, climateData);
        }

        // Clima histórico — para reclamo sin suelo se muestra como base de comparación
        if (climateData && reportType !== 'reclamo') {
            html += this.climateSection(climateData, reportType);
        }
        if (climateData && reportType === 'reclamo' && noSoilData) {
            html += this.climateSection(climateData, reportType);
        }

        // Clima de campaña (solo reclamo)
        if (reportType === 'reclamo' && campaignClimate) {
            html += this.campaignClimateSection(campaignClimate, climateData);
        } else if (reportType === 'reclamo' && !campaignClimate) {
            html += `<div class="alert alert-warning mt-3"><i class="bi bi-exclamation-triangle me-1"></i> No se cargaron las fechas de campana. Ingresa el periodo para obtener el analisis climatico.</div>`;
        }

        // Análisis satelital/NDVI: omitir si no hay datos de suelo
        if (satelliteData && !noSoilData) {
            html += this.satelliteSection(satelliteData, climateData);
        }

        // Observaciones
        html += '<h5 class="mt-4"><i class="bi bi-info-circle me-1"></i> Observaciones</h5>';
        for (const obs of results.observations) {
            const cls = obs.type === 'warning' ? 'warning' : '';
            const icon = obs.type === 'warning' ? 'bi-exclamation-triangle' : 'bi-check-circle';
            html += `<div class="observation-item ${cls}"><i class="bi ${icon} me-1"></i> ${obs.text}</div>`;
        }

        // Disclaimer
        let soilSourceNote = '';
        if (!noSoilData) {
            if (isBASoil) {
                soilSourceNote = 'Suelos: Carta de Suelos de la Prov. de Buenos Aires 1:50.000 (INTA). IP no disponible en esta fuente.';
            } else {
                soilSourceNote = 'Suelos: <a href="https://suelos.cba.gov.ar" target="_blank">Cartas de Suelo IDECOR</a> (escala semi-detallada, orientativo).';
            }
        }
        html += `
            <div class="alert alert-secondary mt-4 small">
                <i class="bi bi-shield-check me-1"></i>
                <strong>Nota:</strong>
                ${soilSourceNote}
                ${climateData ? 'Clima: <a href="https://open-meteo.com" target="_blank">Open-Meteo</a> (datos historicos).' : ''}
                ${satelliteData && satelliteData.ndvi && !noSoilData ? 'NDVI: MODIS MOD13Q1 (NASA/ORNL DAAC).' : ''}
                No reemplaza un estudio de suelos a campo.
            </div>
        `;

        // Author footer
        html += `
            <div class="text-center mt-3 pt-3 border-top">
                <small class="text-muted"><strong>Evalua tu Campo</strong></small>
            </div>
        `;

        return html;
    },

    // === MAPS SECTION ===
    mapsSection(mapImages) {
        let html = '<h5 class="mt-4"><i class="bi bi-map me-1"></i> Mapas Tematicos</h5>';

        // Satellite RGB comparison (wet vs dry year) - side by side
        if (mapImages.wetImage || mapImages.dryImage) {
            const wetLabel = mapImages.wettestYear ? `Ano lluvioso: ${mapImages.wettestYear} (${mapImages.wettestPrecip} mm)` : 'Ano lluvioso';
            const dryLabel = mapImages.driestYear ? `Ano seco: ${mapImages.driestYear} (${mapImages.driestPrecip} mm)` : 'Ano seco';
            html += `<p class="small text-muted mb-2"><i class="bi bi-info-circle me-1"></i>Imagenes satelitales comparativas. En el periodo critico (verano), las zonas con agua visible indican bajos anegables.</p>`;
            html += '<div class="row g-2 mb-2">';
            if (mapImages.wetImage) {
                html += `<div class="${mapImages.dryImage ? 'col-md-6' : 'col-12'}">`;
                html += `<div class="border rounded overflow-hidden shadow-sm">`;
                html += `<img src="${mapImages.wetImage}" class="w-100" alt="${wetLabel}" style="object-fit:contain;">`;
                html += `</div>`;
                html += `<small class="text-muted d-block text-center mt-1">${wetLabel}</small>`;
                html += `</div>`;
            }
            if (mapImages.dryImage) {
                html += `<div class="${mapImages.wetImage ? 'col-md-6' : 'col-12'}">`;
                html += `<div class="border rounded overflow-hidden shadow-sm">`;
                html += `<img src="${mapImages.dryImage}" class="w-100" alt="${dryLabel}" style="object-fit:contain;">`;
                html += `</div>`;
                html += `<small class="text-muted d-block text-center mt-1">${dryLabel}</small>`;
                html += `</div>`;
            }
            html += '</div>';
        }

        // NDVI greenness map (spatial)
        if (mapImages.ndviMap) {
            html += '<div class="mb-3">';
            html += `<div class="border rounded overflow-hidden shadow-sm">`;
            html += `<img src="${mapImages.ndviMap}" class="w-100" alt="Mapa NDVI" style="object-fit:contain;">`;
            html += `</div>`;
            html += `<small class="text-muted d-block text-center mt-1">Zonas verdes = mayor vigor vegetal. Zonas marrones = menor cobertura o suelo expuesto.</small>`;
            html += '</div>';
        }

        // NDVI/productivity chart (temporal)
        if (mapImages.ndviChart) {
            html += '<div class="mb-3">';
            html += `<div class="border rounded overflow-hidden shadow-sm">`;
            html += `<img src="${mapImages.ndviChart}" class="w-100" alt="Productividad Historica" style="object-fit:contain;background:#fafafa;">`;
            html += `</div>`;
            html += '</div>';
        }

        html += '<div class="row g-3 mb-3">';

        if (mapImages.ipMap) {
            html += '<div class="col-12">';
            html += `<div class="border rounded overflow-hidden">`;
            html += `<img src="${mapImages.ipMap}" class="w-100" alt="Mapa de IP" style="max-height:400px;object-fit:contain;background:#f8f9fa;">`;
            html += `</div>`;
            html += '</div>';
        }

        if (mapImages.classMap) {
            html += '<div class="col-md-6">';
            html += `<div class="border rounded overflow-hidden">`;
            html += `<img src="${mapImages.classMap}" class="w-100" alt="Mapa de Clase de Uso" style="max-height:350px;object-fit:contain;background:#f8f9fa;">`;
            html += `</div>`;
            html += '</div>';
        }

        if (mapImages.seriesMap) {
            html += '<div class="col-md-6">';
            html += `<div class="border rounded overflow-hidden">`;
            html += `<img src="${mapImages.seriesMap}" class="w-100" alt="Mapa de Series" style="max-height:350px;object-fit:contain;background:#f8f9fa;">`;
            html += `</div>`;
            html += '</div>';
        }

        html += '</div>';
        return html;
    },

    // === SATELLITE ANALYSIS SECTION ===
    satelliteSection(sat, climateData) {
        let html = '<h5 class="mt-4"><i class="bi bi-satellite me-1"></i> Analisis Historico Satelital</h5>';

        // NDVI Section
        if (sat.ndvi) {
            html += this.ndviSection(sat.ndvi);
        }

        // Precipitation analysis
        if (sat.precipAnalysis) {
            html += this.precipAnalysisSection(sat.precipAnalysis);
        }

        // Flood risk
        if (sat.floodRisk) {
            html += this.floodRiskSection(sat.floodRisk);
        }

        // Productivity estimation
        if (sat.productivity) {
            html += this.productivitySection(sat.productivity);
        }

        return html;
    },

    ndviSection(ndvi) {
        let html = '<div class="p-3 bg-light rounded mb-3">';
        html += `<h6><i class="bi bi-tree me-1"></i> NDVI - Indice de Vegetacion (${ndvi.source})</h6>`;
        html += `<p class="text-muted small mb-2">Periodo: ${ndvi.period}</p>`;

        // Average NDVI badge
        html += `<div class="mb-2">`;
        html += `<span class="fw-bold">NDVI Promedio: </span>`;
        const ndviColor = ndvi.avgNDVI >= 0.5 ? 'success' : ndvi.avgNDVI >= 0.3 ? 'warning' : 'danger';
        html += `<span class="badge bg-${ndviColor} fs-6">${ndvi.avgNDVI}</span>`;
        html += ` <span class="text-muted small">(${ndvi.greenClass})</span>`;
        html += `</div>`;

        // Monthly NDVI profile (bar chart)
        if (ndvi.monthlyProfile) {
            html += '<div class="mb-2"><strong class="small">Perfil mensual de NDVI</strong></div>';
            const maxNDVI = Math.max(...ndvi.monthlyProfile.filter(m => m.ndvi).map(m => m.ndvi), 0.1);
            const ndviBarMax = 60;
            html += '<div style="display:flex;align-items:flex-end;gap:1px;height:90px;">';
            for (const m of ndvi.monthlyProfile) {
                const val = m.ndvi || 0;
                const barH = Math.max(2, Math.round((val / maxNDVI) * ndviBarMax));
                const color = val >= 0.5 ? '#2d6a4f' : val >= 0.3 ? '#52b788' : '#b7e4c7';
                html += `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;">
                    <div style="font-size:0.55rem;color:#555;margin-bottom:1px;">${val.toFixed(2)}</div>
                    <div style="background:${color};width:75%;height:${barH}px;border-radius:3px 3px 0 0;"
                         title="${m.month}: ${val}"></div>
                    <small style="font-size:0.55rem;color:#888;margin-top:1px;">${m.month}</small>
                </div>`;
            }
            html += '</div>';
        }

        // Yearly NDVI trend table
        if (ndvi.yearlyAvg && ndvi.yearlyAvg.length > 0) {
            html += '<div class="mt-2"><strong class="small">NDVI promedio anual</strong></div>';
            html += '<div class="table-responsive"><table class="table table-sm mt-1 mb-0">';
            html += '<thead><tr>';
            for (const y of ndvi.yearlyAvg) {
                html += `<th class="text-center small">${y.year}</th>`;
            }
            html += '</tr></thead><tbody><tr>';
            for (const y of ndvi.yearlyAvg) {
                const bg = y.ndvi >= 0.5 ? 'table-success' : y.ndvi >= 0.3 ? '' : 'table-warning';
                html += `<td class="text-center small ${bg}">${y.ndvi}</td>`;
            }
            html += '</tr></tbody></table></div>';
        }

        html += '</div>';
        return html;
    },

    precipAnalysisSection(pa) {
        let html = '<div class="p-3 bg-light rounded mb-3">';
        html += `<h6><i class="bi bi-cloud-rain-heavy me-1"></i> Analisis de Precipitacion</h6>`;

        html += '<div class="row g-2 mb-2">';
        html += `<div class="col-6 col-md-3"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold text-primary">${pa.wettest.year}</div>
            <div class="fw-bold">${pa.wettest.precip} mm</div>
            <small class="text-muted">Ano mas lluvioso</small>
        </div></div>`;
        html += `<div class="col-6 col-md-3"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold text-warning">${pa.driest.year}</div>
            <div class="fw-bold">${pa.driest.precip} mm</div>
            <small class="text-muted">Ano mas seco</small>
        </div></div>`;
        html += `<div class="col-6 col-md-3"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold">${pa.variabilityIndex}%</div>
            <small class="text-muted">Variabilidad (CV)</small>
        </div></div>`;
        html += `<div class="col-6 col-md-3"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold">${pa.trendPerDecade > 0 ? '+' : ''}${pa.trendPerDecade} mm</div>
            <small class="text-muted">Tendencia / decada</small>
        </div></div>`;
        html += '</div>';

        // Classification
        if (pa.wetYears.length > 0) {
            html += `<p class="mb-1 small"><span class="badge bg-primary">Lluviosos</span> ${pa.wetYears.map(y => `${y.year} (${y.precip}mm)`).join(', ')}</p>`;
        }
        if (pa.dryYears.length > 0) {
            html += `<p class="mb-1 small"><span class="badge bg-warning text-dark">Secos</span> ${pa.dryYears.map(y => `${y.year} (${y.precip}mm)`).join(', ')}</p>`;
        }

        if (pa.maxConsecutiveDry >= 2) {
            html += `<p class="mb-0 small text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Se registraron ${pa.maxConsecutiveDry} anos secos consecutivos. Riesgo de sequia prolongada.</p>`;
        }

        html += '</div>';
        return html;
    },

    floodRiskSection(fr) {
        let html = '<div class="p-3 bg-light rounded mb-3">';
        html += `<h6><i class="bi bi-water me-1"></i> Indice de Riesgo de Anegamiento</h6>`;

        // Risk gauge
        html += `<div class="d-flex align-items-center mb-2">`;
        html += `<div class="me-3">`;
        html += `<span class="badge bg-${fr.riskColor} fs-5 px-3">${fr.floodScore}</span>`;
        html += `</div>`;
        html += `<div>`;
        html += `<div class="fw-bold">Riesgo ${fr.riskLevel}</div>`;
        html += `<div class="progress" style="width:200px;height:8px;">`;
        html += `<div class="progress-bar bg-${fr.riskColor}" style="width:${fr.floodScore}%"></div>`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;

        // Details
        html += '<div class="row g-2 mb-2">';
        html += `<div class="col-6 col-md-4"><small class="text-muted">Dias >50mm/ano:</small> <strong>${fr.extremeDays50}</strong></div>`;
        html += `<div class="col-6 col-md-4"><small class="text-muted">Dias >80mm/ano:</small> <strong>${fr.extremeDays80}</strong></div>`;
        html += `<div class="col-6 col-md-4"><small class="text-muted">Max diario:</small> <strong>${fr.maxDailyPrecip} mm</strong></div>`;
        html += `<div class="col-6 col-md-4"><small class="text-muted">Dias >100mm/ano:</small> <strong>${fr.extremeDays100}</strong></div>`;
        html += `<div class="col-6 col-md-4"><small class="text-muted">Max dias consecutivos lluvia:</small> <strong>${fr.maxConsecutiveWet}</strong></div>`;
        html += `<div class="col-6 col-md-4"><small class="text-muted">Periodos humedos/ano:</small> <strong>${fr.wetPeriods}</strong></div>`;
        html += '</div>';

        if (fr.floodMonths.length > 0) {
            html += `<p class="mb-0 small"><i class="bi bi-calendar-event me-1"></i>Meses con mayor riesgo: <strong>${fr.floodMonths.map(m => m.month).join(', ')}</strong></p>`;
        }

        html += '</div>';
        return html;
    },

    productivitySection(prod) {
        let html = '<div class="p-3 bg-light rounded mb-3">';
        html += `<h6><i class="bi bi-graph-up me-1"></i> Estimacion de Productividad Historica</h6>`;
        html += `<p class="text-muted small mb-2">Modelo basado en IP del suelo + precipitacion anual. Referencia orientativa.</p>`;

        // Summary
        html += '<div class="row g-2 mb-2">';
        html += `<div class="col-4"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold fs-5">${prod.avgScore}</div>
            <small class="text-muted">Score promedio</small>
        </div></div>`;
        html += `<div class="col-4"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold text-success">${prod.bestYear.year}</div>
            <div class="small">${prod.bestYear.productivityScore} pts</div>
            <small class="text-muted">Mejor ano</small>
        </div></div>`;
        html += `<div class="col-4"><div class="border rounded p-2 text-center bg-white">
            <div class="fw-bold text-danger">${prod.worstYear.year}</div>
            <div class="small">${prod.worstYear.productivityScore} pts</div>
            <small class="text-muted">Peor ano</small>
        </div></div>`;
        html += '</div>';

        // Yearly productivity table
        html += '<div class="table-responsive"><table class="table table-sm mt-1 mb-0">';
        html += '<thead><tr><th class="small">Ano</th><th class="small text-center">Lluvia</th><th class="small text-center">Factor</th><th class="small text-center">Score</th><th class="small text-center">Categoria</th></tr></thead><tbody>';
        for (const y of prod.yearlyProductivity) {
            const catColor = y.category === 'Buena' ? 'success' : y.category === 'Regular' ? 'warning' : 'danger';
            html += `<tr>`;
            html += `<td class="small">${y.year}</td>`;
            html += `<td class="text-center small">${y.precip} mm</td>`;
            html += `<td class="text-center small">${y.rainFactor}</td>`;
            html += `<td class="text-center small fw-bold">${y.productivityScore}</td>`;
            html += `<td class="text-center"><span class="badge bg-${catColor} small">${y.category}</span></td>`;
            html += `</tr>`;
        }
        html += '</tbody></table></div>';

        html += '</div>';
        return html;
    },

    summaryCard(label, value, icon, extraClass = '') {
        return `
            <div class="col-6 col-md-3">
                <div class="border rounded p-2 text-center h-100">
                    <i class="bi ${icon} text-muted"></i>
                    <div class="fw-bold fs-5 ${extraClass}">${value}</div>
                    <small class="text-muted">${label}</small>
                </div>
            </div>
        `;
    },

    ipClass(ip) {
        if (ip === null) return '';
        if (ip >= 65) return 'text-success';
        if (ip >= 40) return 'text-warning';
        return 'text-danger';
    },

    soilTable(grouped, detailLevel) {
        let html = '<div class="table-responsive"><table class="table table-sm table-hover soil-table">';
        html += '<thead><tr>';
        html += '<th>Unidad</th><th>Sup. (ha)</th><th>%</th><th>Clase Uso</th><th>IP</th>';
        if (detailLevel !== 'basico') {
            html += '<th>Composicion</th>';
        }
        html += '</tr></thead><tbody>';

        for (const g of grouped) {
            const cuRoman = Analysis.cuToRoman(g.cu);
            const scuText = g.scu ? `${cuRoman}${g.scu}` : cuRoman;
            html += '<tr>';
            html += `<td><strong>${g.textUserId}</strong></td>`;
            html += `<td>${g.totalAreaHa.toFixed(1)}</td>`;
            html += `<td>${g.totalPercentage.toFixed(1)}%</td>`;
            html += `<td>${scuText}</td>`;
            html += `<td>${g.ip != null ? g.ip : 'S/D'}</td>`;
            if (detailLevel !== 'basico') {
                html += `<td class="small">${g.composicion || '-'}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        return html;
    },

    seriesDetail(grouped) {
        let html = '<div class="table-responsive"><table class="table table-sm">';
        html += '<thead><tr><th>Unidad</th><th>Series</th></tr></thead><tbody>';

        for (const g of grouped) {
            if (g.series.length === 0) continue;
            const seriesText = g.series.map(s =>
                s.percentage ? `${s.name} (${s.percentage}%)` : s.name
            ).join(', ');
            html += `<tr><td><strong>${g.textUserId}</strong></td><td>${seriesText}</td></tr>`;
        }

        html += '</tbody></table></div>';
        return html;
    },

    climateSection(climate, reportType) {
        let html = '<h5 class="mt-4"><i class="bi bi-cloud-sun me-1"></i> Datos Climaticos Historicos</h5>';
        html += `<p class="text-muted small">Periodo: ${climate.period} &middot; Fuente: Open-Meteo</p>`;

        // Monthly rainfall table
        html += '<div class="table-responsive"><table class="table table-sm">';
        html += '<thead><tr><th></th>';
        for (const m of climate.monthlyData) {
            html += `<th class="text-center">${m.month}</th>`;
        }
        html += '<th class="text-center fw-bold">Ano</th>';
        html += '</tr></thead><tbody>';

        // Precipitation row
        html += '<tr><td><i class="bi bi-cloud-rain me-1"></i>Lluvia (mm)</td>';
        let totalPrecip = 0;
        for (const m of climate.monthlyData) {
            totalPrecip += m.precip;
            const bg = m.precip > 100 ? 'table-primary' : m.precip > 50 ? 'table-info' : m.precip < 20 ? 'table-warning' : '';
            html += `<td class="text-center ${bg}">${Math.round(m.precip)}</td>`;
        }
        html += `<td class="text-center fw-bold">${Math.round(totalPrecip)}</td>`;
        html += '</tr>';

        // Max temp row
        html += '<tr><td><i class="bi bi-thermometer-high me-1"></i>T.max (\u00B0C)</td>';
        for (const m of climate.monthlyData) {
            const bg = m.tempMax > 30 ? 'table-danger' : m.tempMax > 25 ? 'table-warning' : '';
            html += `<td class="text-center ${bg}">${m.tempMax}</td>`;
        }
        html += `<td class="text-center">${climate.avgTempMax}</td>`;
        html += '</tr>';

        // Min temp row
        html += '<tr><td><i class="bi bi-thermometer-low me-1"></i>T.min (\u00B0C)</td>';
        for (const m of climate.monthlyData) {
            const bg = m.tempMin < 5 ? 'table-info' : '';
            html += `<td class="text-center ${bg}">${m.tempMin}</td>`;
        }
        html += `<td class="text-center">${climate.avgTempMin}</td>`;
        html += '</tr>';

        html += '</tbody></table></div>';

        // Rainfall bar chart (pixel heights for reliable rendering)
        html += '<div class="mb-3"><strong>Distribucion de lluvias mensuales</strong></div>';
        const maxPrecip = Math.max(...climate.monthlyData.map(m => m.precip));
        const maxBarH = 100;
        html += '<div style="display:flex;align-items:flex-end;gap:2px;height:130px;">';
        for (const m of climate.monthlyData) {
            const barH = maxPrecip > 0 ? Math.max(2, Math.round((m.precip / maxPrecip) * maxBarH)) : 2;
            const color = m.precip > 100 ? '#2d6a4f' : m.precip > 50 ? '#52b788' : '#b7e4c7';
            html += `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;">
                <div style="font-size:0.6rem;color:#555;margin-bottom:2px;">${Math.round(m.precip)}</div>
                <div style="background:${color};width:70%;height:${barH}px;border-radius:3px 3px 0 0;"
                     title="${Math.round(m.precip)} mm"></div>
                <small style="font-size:0.65rem;color:#888;margin-top:2px;">${m.month}</small>
            </div>`;
        }
        html += '</div>';

        // Climate insights
        html += '<div class="p-3 bg-light rounded mt-3">';
        html += `<p class="mb-1"><strong>Precipitacion media anual:</strong> ${climate.annualPrecip} mm</p>`;
        html += `<p class="mb-1"><strong>Lluvia campana (Oct-Mar):</strong> ${climate.growingSeasonPrecip} mm (${Math.round(climate.growingSeasonPrecip / climate.annualPrecip * 100)}% del total)</p>`;
        html += `<p class="mb-0"><strong>Lluvia invernal (Abr-Sep):</strong> ${climate.winterPrecip} mm</p>`;

        if (reportType === 'alquiler' || reportType === 'manejo') {
            html += '<hr class="my-2">';
            if (climate.annualPrecip >= 800) {
                html += '<p class="mb-0 text-success"><i class="bi bi-check-circle me-1"></i>Regimen hidrico favorable para agricultura de secano.</p>';
            } else if (climate.annualPrecip >= 600) {
                html += '<p class="mb-0 text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Regimen hidrico moderado. Evaluar riesgo de sequia en anos secos.</p>';
            } else {
                html += '<p class="mb-0 text-danger"><i class="bi bi-x-circle me-1"></i>Regimen hidrico limitante. Agricultura de secano riesgosa.</p>';
            }
        }

        html += '</div>';

        // Yearly rainfall trend
        if (climate.yearlyData && climate.yearlyData.length > 0) {
            html += '<div class="mt-3"><strong>Lluvia anual por ano</strong></div>';
            html += '<div class="table-responsive"><table class="table table-sm mt-1">';
            html += '<thead><tr>';
            for (const y of climate.yearlyData) {
                html += `<th class="text-center small">${y.year}</th>`;
            }
            html += '</tr></thead><tbody><tr>';
            for (const y of climate.yearlyData) {
                const bg = y.precip > climate.annualPrecip * 1.2 ? 'table-primary' :
                           y.precip < climate.annualPrecip * 0.8 ? 'table-warning' : '';
                html += `<td class="text-center small ${bg}">${y.precip}</td>`;
            }
            html += '</tr></tbody></table></div>';
        }

        return html;
    },

    alquilerSection(results) {
        let html = '<h5 class="mt-4"><i class="bi bi-key me-1"></i> Analisis para Alquiler</h5>';

        if (results.weightedIP !== null) {
            html += '<div class="p-3 bg-light rounded mb-2">';
            html += `<p class="mb-1">El <strong>Indice de Productividad promedio ponderado</strong> del campo es <span class="fw-bold fs-5">${results.weightedIP}</span>.</p>`;

            const classI_II = results.grouped.filter(g => g.cu && parseInt(g.cu) <= 2);
            const pctPremium = classI_II.reduce((sum, g) => sum + g.totalPercentage, 0);

            if (pctPremium > 50) {
                html += '<p class="mb-0 text-success">Mas del 50% del campo tiene suelos Clase I-II. Buena base para negociar alquiler agricola.</p>';
            } else {
                const classIII_IV = results.grouped.filter(g => g.cu && parseInt(g.cu) >= 3 && parseInt(g.cu) <= 4);
                const pctMid = classIII_IV.reduce((sum, g) => sum + g.totalPercentage, 0);
                if (pctMid > 30) {
                    html += '<p class="mb-0">El campo tiene suelos mixtos. Considera ajustar el valor del alquiler segun la proporcion agricola/ganadera.</p>';
                }
            }
            html += '</div>';
        }

        return html;
    },

    compraSection(results) {
        let html = '<h5 class="mt-4"><i class="bi bi-house-door me-1"></i> Analisis para Compra</h5>';
        html += '<div class="p-3 bg-light rounded mb-2">';

        html += `<p><strong>Superficie total:</strong> ${results.totalAreaHa.toFixed(1)} ha</p>`;

        if (results.weightedIP !== null) {
            html += `<p><strong>IP Promedio Ponderado:</strong> ${results.weightedIP}</p>`;
        }

        const limited = results.grouped.filter(g => g.cu && parseInt(g.cu) >= 5);
        if (limited.length > 0) {
            const pctLimited = limited.reduce((sum, g) => sum + g.totalPercentage, 0);
            html += `<p class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i> ${pctLimited.toFixed(0)}% del campo tiene suelos con limitaciones severas (Clase V+). Tene en cuenta esto en la valuacion.</p>`;
        }

        const premium = results.grouped.filter(g => g.cu && parseInt(g.cu) <= 2);
        if (premium.length > 0) {
            const pctPremium = premium.reduce((sum, g) => sum + g.totalPercentage, 0);
            html += `<p class="text-success"><i class="bi bi-check-circle me-1"></i> ${pctPremium.toFixed(0)}% del campo tiene suelos de alta calidad (Clase I-II).</p>`;
        }

        html += '</div>';
        return html;
    },

    manejoSection(results) {
        let html = '<h5 class="mt-4"><i class="bi bi-gear me-1"></i> Analisis para Manejo</h5>';
        html += '<div class="p-3 bg-light rounded mb-2">';

        if (results.grouped.length >= 3) {
            html += '<p><i class="bi bi-layers me-1"></i> El campo tiene variabilidad de suelos significativa. Considera manejo por ambientes.</p>';
        }

        const byClass = {};
        for (const g of results.grouped) {
            const cls = g.cu || 'SD';
            if (!byClass[cls]) byClass[cls] = { pct: 0, units: [] };
            byClass[cls].pct += g.totalPercentage;
            byClass[cls].units.push(g.textUserId);
        }

        html += '<ul class="mb-0">';
        for (const [cls, data] of Object.entries(byClass).sort((a, b) => Number(a[0]) - Number(b[0]))) {
            const roman = Analysis.cuToRoman(Number(cls));
            const use = this.landUseRecommendation(Number(cls));
            html += `<li><strong>Clase ${roman}</strong> (${data.pct.toFixed(0)}%): ${use}</li>`;
        }
        html += '</ul>';

        html += '</div>';
        return html;
    },

    reclamoSection(results, campaignClimate, climateData) {
        let html = '<h5 class="mt-4"><i class="bi bi-exclamation-circle me-1"></i> Analisis para Reclamo</h5>';
        html += '<div class="p-3 bg-light rounded mb-2">';

        html += `<p class="mb-2">Este informe evalua si las condiciones climaticas durante la campana representaron una limitante para el desarrollo del cultivo.</p>`;

        if (results.weightedIP !== null) {
            html += `<p class="mb-1"><strong>Potencial del suelo (IP):</strong> ${results.weightedIP} — `;
            if (results.weightedIP >= 65) html += `<span class="text-success">suelo de alta productividad</span>.`;
            else if (results.weightedIP >= 40) html += `<span class="text-warning">suelo de productividad media</span>.`;
            else html += `<span class="text-danger">suelo con limitaciones significativas</span>.`;
            html += `</p>`;
        }

        if (!campaignClimate) {
            html += `<p class="text-warning mb-0"><i class="bi bi-calendar-x me-1"></i>Ingresa el periodo de campana para obtener el analisis climatico detallado.</p>`;
        } else {
            if (campaignClimate.frostDays > 0) {
                html += `<p class="mb-1 text-info"><i class="bi bi-snow me-1"></i><strong>Heladas:</strong> ${campaignClimate.frostDays} dias con T.min < 0°C.</p>`;
            }
            if (campaignClimate.hotDays > 0) {
                html += `<p class="mb-1 text-danger"><i class="bi bi-sun me-1"></i><strong>Calor extremo:</strong> ${campaignClimate.hotDays} dias con T.max > 35°C.</p>`;
            }
            if (campaignClimate.heavyRainDays > 0) {
                html += `<p class="mb-1 text-primary"><i class="bi bi-cloud-rain-heavy me-1"></i><strong>Lluvias intensas:</strong> ${campaignClimate.heavyRainDays} eventos > 40 mm/dia.</p>`;
            }

            // Compare to historical if available
            if (climateData) {
                const pctHist = Math.round(campaignClimate.totalPrecip / climateData.annualPrecip * 100);
                html += `<hr class="my-2">`;
                html += `<p class="mb-0 small text-muted">Lluvia de campana: ${campaignClimate.totalPrecip} mm vs. promedio historico anual: ${climateData.annualPrecip} mm (${pctHist}% del promedio).</p>`;
            }
        }

        html += '</div>';
        return html;
    },

    campaignClimateSection(cc, climateData) {
        const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

        let html = `<h5 class="mt-4"><i class="bi bi-cloud-sun-rain me-1"></i> Clima de Campana</h5>`;
        html += `<p class="text-muted small">Periodo: ${fmt(cc.startDate)} al ${fmt(cc.endDate)} &middot; Fuente: Open-Meteo / ERA5</p>`;

        // Summary cards (sin balance hidrico)
        html += '<div class="row g-2 mb-3">';
        html += this.summaryCard('Lluvia total', `${cc.totalPrecip} mm`, 'bi-cloud-rain');
        html += this.summaryCard('T.max prom.', `${cc.avgTempMax}\u00B0C`, 'bi-thermometer-high');
        html += this.summaryCard('T.min prom.', `${cc.avgTempMin}\u00B0C`, 'bi-thermometer-low');
        html += this.summaryCard('Amplitud term.', `${cc.avgThermalAmplitude}\u00B0C`, 'bi-arrows-expand');
        html += '</div>';

        // --- Grafico precipitaciones: barras campana + linea historico (canvas) ---
        html += '<div class="mb-1"><strong><i class="bi bi-bar-chart me-1"></i>Precipitaciones mensuales (mm)</strong></div>';
        try {
            const precipUrl = this.renderCampaignPrecipChart(cc, climateData);
            html += `<img src="${precipUrl}" class="w-100" style="max-height:230px;object-fit:contain;" alt="Grafico precipitaciones">`;
        } catch(e) {
            html += '<p class="text-muted small">No se pudo generar el grafico.</p>';
        }

        // --- Grafico temperaturas: barras rango campana + lineas historico (canvas) ---
        html += '<div class="mt-3 mb-1"><strong><i class="bi bi-thermometer me-1"></i>Temperaturas mensuales (\u00B0C)</strong></div>';
        try {
            const tempUrl = this.renderCampaignTempChart(cc, climateData);
            html += `<img src="${tempUrl}" class="w-100" style="max-height:230px;object-fit:contain;" alt="Grafico temperaturas">`;
        } catch(e) {
            html += '<p class="text-muted small">No se pudo generar el grafico.</p>';
        }

        // --- Interpretacion ---
        html += '<div class="p-3 bg-light rounded mt-3">';
        html += '<strong>Interpretacion del clima de campana:</strong>';
        html += '<ul class="mb-0 mt-2">';

        if (cc.totalPrecip < 200) {
            html += `<li class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i>Lluvia total muy baja (${cc.totalPrecip} mm): condicion de sequia severa durante la campana.</li>`;
        } else if (cc.totalPrecip < 400) {
            html += `<li class="text-warning"><i class="bi bi-exclamation-circle me-1"></i>Lluvia moderada (${cc.totalPrecip} mm): posible estres hidrico en etapas criticas.</li>`;
        } else {
            html += `<li class="text-success"><i class="bi bi-check-circle me-1"></i>Precipitacion suficiente durante la campana (${cc.totalPrecip} mm).</li>`;
        }

        if (cc.frostDays > 0) {
            html += `<li class="text-info"><i class="bi bi-snow me-1"></i>${cc.frostDays} dias con heladas (T.min < 0\u00B0C). Riesgo de dano en etapas sensibles del cultivo.</li>`;
        }
        if (cc.hotDays > 0) {
            html += `<li class="text-danger"><i class="bi bi-sun me-1"></i>${cc.hotDays} dias con calor extremo (T.max > 35\u00B0C). Posible impacto en floracion y llenado de grano.</li>`;
        }
        if (cc.heavyRainDays > 0) {
            html += `<li class="text-primary"><i class="bi bi-cloud-rain-heavy me-1"></i>${cc.heavyRainDays} eventos de lluvia intensa (> 40 mm/dia). Riesgo de anegamiento o perdida de suelo.</li>`;
        }
        if (cc.frostDays === 0 && cc.hotDays === 0 && cc.heavyRainDays === 0) {
            html += `<li class="text-success"><i class="bi bi-check-circle me-1"></i>No se detectaron eventos climaticos extremos significativos durante la campana.</li>`;
        }

        if (climateData) {
            const pct = Math.round(cc.totalPrecip / climateData.annualPrecip * 100);
            const histVerdict = pct < 60 ? 'muy por debajo' : pct < 85 ? 'por debajo' : pct > 115 ? 'por encima' : 'dentro';
            html += `<li class="text-muted"><i class="bi bi-bar-chart me-1"></i>La lluvia de campana representa el ${pct}% del promedio historico anual (${climateData.annualPrecip} mm) — ${histVerdict} de lo normal.</li>`;
        }

        html += '</ul></div>';

        // --- Recurso externo: humedad de suelo ---
        html += `
        <div class="alert alert-info mt-3 small">
            <i class="bi bi-droplet-fill me-1"></i>
            <strong>Humedad de suelo:</strong> Para consultar la evolucion de agua en suelo durante la campana,
            ingresar en <a href="https://sepa.inta.gob.ar/productos/geosepa/agua_en_suelo/pj/" target="_blank">SEPA INTA - Agua en Suelo</a>
            o en el visor
            <a href="https://patooricchio.users.earthengine.app/view/pj-10d" target="_blank">GEE % Agua en Suelo</a>
            y ubicar el punto correspondiente al campo.
        </div>`;

        return html;
    },

    // --- Canvas chart: Precipitaciones campana (barras) + historico (linea punteada) ---
    renderCampaignPrecipChart(cc, climateData) {
        const W = 680, H = 210;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const ML = 42, MR = 12, MT = 22, MB = 48;
        const cW = W - ML - MR, cH = H - MT - MB;
        const months = cc.months, n = months.length;
        const barW = cW / n;

        const histData = months.map(m => {
            const mi = parseInt(m.key.split('-')[1]) - 1;
            return Math.round(climateData?.monthlyData?.[mi]?.precip || 0);
        });
        const campData = months.map(m => m.totalPrecip);
        const maxVal = Math.max(...histData, ...campData, 10);
        const toY = v => MT + cH - (v / maxVal) * cH;
        const cx = i => ML + i * barW + barW / 2;

        // Fondo blanco
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);

        // Grilla y etiquetas eje Y
        ctx.strokeStyle = '#ebebeb'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = MT + (cH / 4) * i;
            ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + cW, y); ctx.stroke();
            ctx.fillStyle = '#aaa'; ctx.font = '10px Arial'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxVal * (1 - i / 4)), ML - 4, y + 4);
        }

        // Barras campana
        for (let i = 0; i < n; i++) {
            const camp = campData[i], hist = histData[i];
            const x = ML + i * barW + barW * 0.12;
            const bw = barW * 0.76;
            const bh = (camp / maxVal) * cH;
            const y = MT + cH - bh;
            ctx.fillStyle = camp < hist * 0.7 ? '#ef476f' : camp > hist * 1.3 ? '#0096c7' : '#52b788';
            ctx.fillRect(x, y, bw, bh);
            ctx.fillStyle = bh > 14 ? '#fff' : '#333';
            ctx.font = bh > 14 ? 'bold 10px Arial' : '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(camp, x + bw / 2, bh > 14 ? y + 12 : y - 3);
        }

        // Linea punteada: promedio historico
        if (climateData?.monthlyData) {
            ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                i === 0 ? ctx.moveTo(cx(i), toY(histData[i])) : ctx.lineTo(cx(i), toY(histData[i]));
            }
            ctx.stroke(); ctx.setLineDash([]);
            // Puntos y valores sobre la linea
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = '#444';
                ctx.beginPath(); ctx.arc(cx(i), toY(histData[i]), 3.5, 0, Math.PI * 2); ctx.fill();
                ctx.font = '9px Arial'; ctx.textAlign = 'center';
                ctx.fillText(histData[i], cx(i), toY(histData[i]) - 7);
            }
        }

        // Etiquetas eje X
        ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        for (let i = 0; i < n; i++) ctx.fillText(months[i].label, cx(i), MT + cH + 16);

        // Eje Y label
        ctx.save(); ctx.translate(11, MT + cH / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#888'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.fillText('mm', 0, 0); ctx.restore();

        // Leyenda
        const lY = H - 13;
        ctx.fillStyle = '#52b788'; ctx.fillRect(ML, lY - 9, 13, 10);
        ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Campana', ML + 16, lY);
        if (climateData?.monthlyData) {
            ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(ML + 80, lY - 4); ctx.lineTo(ML + 94, lY - 4); ctx.stroke();
            ctx.setLineDash([]); ctx.fillText('Historico prom.', ML + 98, lY);
        }
        ctx.fillStyle = '#ef476f'; ctx.fillRect(ML + 195, lY - 9, 13, 10);
        ctx.fillStyle = '#555'; ctx.fillText('Deficit', ML + 211, lY);
        ctx.fillStyle = '#0096c7'; ctx.fillRect(ML + 255, lY - 9, 13, 10);
        ctx.fillText('Exceso', ML + 271, lY);

        return canvas.toDataURL('image/png');
    },

    // --- Canvas chart: Temperaturas campana (rango barras) + historico (lineas punteadas) ---
    renderCampaignTempChart(cc, climateData) {
        const W = 680, H = 210;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');

        const ML = 42, MR = 12, MT = 22, MB = 48;
        const cW = W - ML - MR, cH = H - MT - MB;
        const months = cc.months, n = months.length;
        const barW = cW / n;

        const histMaxData = months.map(m => climateData?.monthlyData?.[parseInt(m.key.split('-')[1]) - 1]?.tempMax ?? null);
        const histMinData = months.map(m => climateData?.monthlyData?.[parseInt(m.key.split('-')[1]) - 1]?.tempMin ?? null);

        const allT = [...months.map(m => m.tempMax), ...months.map(m => m.tempMin),
                      ...histMaxData.filter(v => v !== null), ...histMinData.filter(v => v !== null)];
        const minT = Math.floor(Math.min(...allT)) - 2;
        const maxT = Math.ceil(Math.max(...allT)) + 2;
        const range = maxT - minT;
        const toY = v => MT + cH - ((v - minT) / range) * cH;
        const cx = i => ML + i * barW + barW / 2;

        // Fondo blanco
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

        // Grilla y eje Y
        ctx.strokeStyle = '#ebebeb'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = MT + (cH / 4) * i;
            ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + cW, y); ctx.stroke();
            ctx.fillStyle = '#aaa'; ctx.font = '10px Arial'; ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxT - (range / 4) * i) + '\u00B0', ML - 4, y + 4);
        }

        // Barras rango campana (Tmin → Tmax)
        for (let i = 0; i < n; i++) {
            const yMax = toY(months[i].tempMax);
            const yMin = toY(months[i].tempMin);
            const x = ML + i * barW + barW * 0.22;
            const bw = barW * 0.56;
            ctx.fillStyle = 'rgba(82,183,136,0.45)';
            ctx.fillRect(x, yMax, bw, yMin - yMax);
            ctx.strokeStyle = '#2d6a4f'; ctx.lineWidth = 1; ctx.setLineDash([]);
            ctx.strokeRect(x, yMax, bw, yMin - yMax);
            // Valores T.max (rojo) y T.min (azul)
            ctx.fillStyle = '#c1121f'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
            ctx.fillText(months[i].tempMax, cx(i), yMax - 4);
            ctx.fillStyle = '#023e8a';
            ctx.fillText(months[i].tempMin, cx(i), yMin + 11);
        }

        // Linea historica T.max
        if (histMaxData.some(v => v !== null)) {
            ctx.strokeStyle = '#c1121f'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (histMaxData[i] === null) continue;
                (i === 0 || histMaxData[i - 1] === null) ? ctx.moveTo(cx(i), toY(histMaxData[i])) : ctx.lineTo(cx(i), toY(histMaxData[i]));
            }
            ctx.stroke();
        }
        // Linea historica T.min
        if (histMinData.some(v => v !== null)) {
            ctx.strokeStyle = '#023e8a'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                if (histMinData[i] === null) continue;
                (i === 0 || histMinData[i - 1] === null) ? ctx.moveTo(cx(i), toY(histMinData[i])) : ctx.lineTo(cx(i), toY(histMinData[i]));
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Eje X
        ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        for (let i = 0; i < n; i++) ctx.fillText(months[i].label, cx(i), MT + cH + 16);

        // Eje Y label
        ctx.save(); ctx.translate(11, MT + cH / 2); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#888'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
        ctx.fillText('\u00B0C', 0, 0); ctx.restore();

        // Leyenda
        const lY = H - 13;
        ctx.fillStyle = 'rgba(82,183,136,0.45)'; ctx.fillRect(ML, lY - 9, 13, 10);
        ctx.strokeStyle = '#2d6a4f'; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.strokeRect(ML, lY - 9, 13, 10);
        ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Rango campaña', ML + 16, lY);
        if (histMaxData.some(v => v !== null)) {
            ctx.strokeStyle = '#c1121f'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(ML + 115, lY - 4); ctx.lineTo(ML + 129, lY - 4); ctx.stroke();
            ctx.fillStyle = '#c1121f'; ctx.fillText('T.max hist.', ML + 133, lY);
            ctx.strokeStyle = '#023e8a';
            ctx.beginPath(); ctx.moveTo(ML + 197, lY - 4); ctx.lineTo(ML + 211, lY - 4); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#023e8a'; ctx.fillText('T.min hist.', ML + 215, lY);
        }

        return canvas.toDataURL('image/png');
    },

    landUseRecommendation(cu) {
        const recs = {
            1: 'Apto para agricultura intensiva sin limitaciones.',
            2: 'Apto para agricultura con limitaciones leves. Manejar rotaciones.',
            3: 'Agricultura con limitaciones moderadas. Rotacion con pasturas.',
            4: 'Agricultura ocasional con limitaciones severas. Priorizar pasturas.',
            5: 'No apto para agricultura. Ganaderia sobre pasturas.',
            6: 'Ganaderia extensiva. Pastizal natural.',
            7: 'Uso restringido. Forestacion o conservacion.',
            8: 'Sin aptitud agropecuaria. Conservacion.'
        };
        return recs[cu] || 'Sin datos de clase de uso.';
    }
};
