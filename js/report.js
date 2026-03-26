/**
 * report.js - Generate HTML report from analysis results
 */
const Report = {

    generate(results, options, climateData, mapImages, satelliteData) {
        const { reportType, fieldName, detailLevel } = options;

        const typeLabels = {
            alquiler: 'Alquiler',
            compra: 'Compra',
            manejo: 'Manejo'
        };

        let html = '';

        // Header with author
        html += `<div class="d-flex justify-content-between align-items-start mb-2">`;
        html += `<div>`;
        html += `<h5 class="mb-1"><i class="bi bi-file-earmark-text me-1"></i> ${fieldName || 'Campo sin nombre'}</h5>`;
        html += `<p class="text-muted mb-0">Informe para <strong>${typeLabels[reportType]}</strong> &middot; ${new Date().toLocaleDateString('es-AR')}</p>`;
        html += `</div>`;
        html += `<div class="text-end small text-muted">`;
        html += `<div><strong>Autor:</strong> Daniel Perez</div>`;
        html += `<div><i class="bi bi-twitter-x"></i> @daniel_pperez</div>`;
        html += `</div>`;
        html += `</div>`;

        // Summary cards
        html += '<div class="row g-2 mb-3">';
        html += this.summaryCard('Superficie', `${results.totalAreaHa.toFixed(1)} ha`, 'bi-rulers');
        html += this.summaryCard('IP Promedio', results.weightedIP !== null ? results.weightedIP : 'S/D', 'bi-speedometer2', this.ipClass(results.weightedIP));
        html += this.summaryCard('Unidades', results.grouped.length, 'bi-layers');
        html += this.summaryCard('Cobertura', `${results.coveragePercent.toFixed(0)}%`, 'bi-pie-chart');
        html += '</div>';

        // Climate summary cards (if available)
        if (climateData) {
            html += '<div class="row g-2 mb-3">';
            html += this.summaryCard('Lluvia anual', `${climateData.annualPrecip} mm`, 'bi-cloud-rain');
            html += this.summaryCard('Lluvia campana', `${climateData.growingSeasonPrecip} mm`, 'bi-moisture');
            html += this.summaryCard('Temp. max', `${climateData.avgTempMax}\u00B0C`, 'bi-thermometer-high');
            html += this.summaryCard('Temp. min', `${climateData.avgTempMin}\u00B0C`, 'bi-thermometer-low');
            html += '</div>';
        }

        // === THEMATIC MAPS ===
        if (mapImages) {
            html += this.mapsSection(mapImages);
        }

        // Soil units table
        html += '<h5 class="mt-4"><i class="bi bi-table me-1"></i> Unidades de Suelo</h5>';
        html += this.soilTable(results.grouped, detailLevel);

        // Series detail (for compra and detallado)
        if ((reportType === 'compra' || detailLevel === 'detallado') && results.grouped.some(g => g.series.length > 0)) {
            html += '<h5 class="mt-4"><i class="bi bi-list-nested me-1"></i> Detalle de Series</h5>';
            html += this.seriesDetail(results.grouped);
        }

        // Report-type specific sections
        if (reportType === 'alquiler') {
            html += this.alquilerSection(results);
        } else if (reportType === 'compra') {
            html += this.compraSection(results);
        } else if (reportType === 'manejo') {
            html += this.manejoSection(results);
        }

        // Climate section
        if (climateData) {
            html += this.climateSection(climateData, reportType);
        }

        // === SATELLITE / HISTORICAL ANALYSIS ===
        if (satelliteData) {
            html += this.satelliteSection(satelliteData, climateData);
        }

        // Observations
        html += '<h5 class="mt-4"><i class="bi bi-info-circle me-1"></i> Observaciones</h5>';
        for (const obs of results.observations) {
            const cls = obs.type === 'warning' ? 'warning' : '';
            const icon = obs.type === 'warning' ? 'bi-exclamation-triangle' : 'bi-check-circle';
            html += `<div class="observation-item ${cls}"><i class="bi ${icon} me-1"></i> ${obs.text}</div>`;
        }

        // Disclaimer
        html += `
            <div class="alert alert-secondary mt-4 small">
                <i class="bi bi-shield-check me-1"></i>
                <strong>Nota:</strong> Suelos: <a href="https://suelos.cba.gov.ar" target="_blank">Cartas de Suelo IDECOR</a> (escala semi-detallada, orientativo).
                ${climateData ? 'Clima: <a href="https://open-meteo.com" target="_blank">Open-Meteo</a> (datos historicos).' : ''}
                ${satelliteData && satelliteData.ndvi ? 'NDVI: MODIS MOD13Q1 (NASA/ORNL DAAC).' : ''}
                No reemplaza un estudio de suelos a campo.
            </div>
        `;

        // Author footer
        html += `
            <div class="text-center mt-3 pt-3 border-top">
                <small class="text-muted">
                    <strong>Evalua tu Campo</strong> &middot; Autor: <strong>Daniel Perez</strong>
                    &middot; <i class="bi bi-twitter-x"></i> <a href="https://x.com/daniel_pperez" target="_blank">@daniel_pperez</a>
                </small>
            </div>
        `;

        return html;
    },

    // === MAPS SECTION ===
    mapsSection(mapImages) {
        let html = '<h5 class="mt-4 pdf-section-start"><i class="bi bi-map me-1"></i> Mapas Tematicos</h5>';

        // NDVI map first - full width, prominent
        if (mapImages.ndviMap) {
            html += '<div class="mb-3">';
            html += `<div class="border rounded overflow-hidden shadow-sm">`;
            html += `<img src="${mapImages.ndviMap}" class="w-100" alt="Mapa NDVI / Productividad" style="max-height:420px;object-fit:contain;background:#1a1a2e;">`;
            html += `</div>`;
            html += '</div>';
        }

        html += '<div class="row g-3 mb-3">';

        if (mapImages.ipMap) {
            html += '<div class="col-12 pdf-section-start">';
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
            html += '<div class="d-flex align-items-end justify-content-between" style="height:80px;">';
            const maxNDVI = Math.max(...ndvi.monthlyProfile.filter(m => m.ndvi).map(m => m.ndvi), 0.1);
            for (const m of ndvi.monthlyProfile) {
                const val = m.ndvi || 0;
                const pct = (val / maxNDVI) * 100;
                const color = val >= 0.5 ? '#2d6a4f' : val >= 0.3 ? '#52b788' : '#b7e4c7';
                html += `<div class="text-center" style="flex:1;">
                    <div style="background:${color};height:${pct}%;min-height:2px;border-radius:3px 3px 0 0;margin:0 1px;"
                         title="${m.month}: ${val}"></div>
                    <small class="d-block text-muted" style="font-size:0.6rem;">${m.month}</small>
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

        // Rainfall bar chart (simple CSS bars)
        html += '<div class="mb-3"><strong>Distribucion de lluvias mensuales</strong></div>';
        html += '<div class="d-flex align-items-end justify-content-between" style="height:120px;">';
        const maxPrecip = Math.max(...climate.monthlyData.map(m => m.precip));
        for (const m of climate.monthlyData) {
            const pct = maxPrecip > 0 ? (m.precip / maxPrecip) * 100 : 0;
            const color = m.precip > 100 ? '#2d6a4f' : m.precip > 50 ? '#52b788' : '#b7e4c7';
            html += `<div class="text-center" style="flex:1;">
                <div style="background:${color};height:${pct}%;min-height:2px;border-radius:3px 3px 0 0;margin:0 2px;"
                     title="${Math.round(m.precip)} mm"></div>
                <small class="d-block text-muted" style="font-size:0.65rem;">${m.month}</small>
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
