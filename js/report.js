/**
 * report.js - Generate HTML report from analysis results
 */
const Report = {

    generate(results, options, climateData) {
        const { reportType, fieldName, detailLevel } = options;

        const typeLabels = {
            alquiler: 'Alquiler',
            compra: 'Compra',
            manejo: 'Manejo'
        };

        let html = '';

        // Header
        html += `<h5><i class="bi bi-file-earmark-text me-1"></i> ${fieldName || 'Campo sin nombre'}</h5>`;
        html += `<p class="text-muted mb-3">Informe para <strong>${typeLabels[reportType]}</strong> &middot; ${new Date().toLocaleDateString('es-AR')}</p>`;

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
            html += this.summaryCard('Lluvia campaña', `${climateData.growingSeasonPrecip} mm`, 'bi-moisture');
            html += this.summaryCard('Temp. máx', `${climateData.avgTempMax}°C`, 'bi-thermometer-high');
            html += this.summaryCard('Temp. mín', `${climateData.avgTempMin}°C`, 'bi-thermometer-low');
            html += '</div>';
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
                ${climateData ? 'Clima: <a href="https://open-meteo.com" target="_blank">Open-Meteo</a> (datos históricos).' : ''}
                No reemplaza un estudio de suelos a campo.
            </div>
        `;

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
            html += '<th>Composición</th>';
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
        let html = '<h5 class="mt-4"><i class="bi bi-cloud-sun me-1"></i> Datos Climáticos Históricos</h5>';
        html += `<p class="text-muted small">Período: ${climate.period} · Fuente: Open-Meteo</p>`;

        // Monthly rainfall table
        html += '<div class="table-responsive"><table class="table table-sm">';
        html += '<thead><tr><th></th>';
        for (const m of climate.monthlyData) {
            html += `<th class="text-center">${m.month}</th>`;
        }
        html += '<th class="text-center fw-bold">Año</th>';
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
        html += '<tr><td><i class="bi bi-thermometer-high me-1"></i>T.máx (°C)</td>';
        for (const m of climate.monthlyData) {
            const bg = m.tempMax > 30 ? 'table-danger' : m.tempMax > 25 ? 'table-warning' : '';
            html += `<td class="text-center ${bg}">${m.tempMax}</td>`;
        }
        html += `<td class="text-center">${climate.avgTempMax}</td>`;
        html += '</tr>';

        // Min temp row
        html += '<tr><td><i class="bi bi-thermometer-low me-1"></i>T.mín (°C)</td>';
        for (const m of climate.monthlyData) {
            const bg = m.tempMin < 5 ? 'table-info' : '';
            html += `<td class="text-center ${bg}">${m.tempMin}</td>`;
        }
        html += `<td class="text-center">${climate.avgTempMin}</td>`;
        html += '</tr>';

        html += '</tbody></table></div>';

        // Rainfall bar chart (simple CSS bars)
        html += '<div class="mb-3"><strong>Distribución de lluvias mensuales</strong></div>';
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
        html += `<p class="mb-1"><strong>Precipitación media anual:</strong> ${climate.annualPrecip} mm</p>`;
        html += `<p class="mb-1"><strong>Lluvia campaña (Oct-Mar):</strong> ${climate.growingSeasonPrecip} mm (${Math.round(climate.growingSeasonPrecip / climate.annualPrecip * 100)}% del total)</p>`;
        html += `<p class="mb-0"><strong>Lluvia invernal (Abr-Sep):</strong> ${climate.winterPrecip} mm</p>`;

        if (reportType === 'alquiler' || reportType === 'manejo') {
            html += '<hr class="my-2">';
            if (climate.annualPrecip >= 800) {
                html += '<p class="mb-0 text-success"><i class="bi bi-check-circle me-1"></i>Régimen hídrico favorable para agricultura de secano.</p>';
            } else if (climate.annualPrecip >= 600) {
                html += '<p class="mb-0 text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Régimen hídrico moderado. Evaluar riesgo de sequía en años secos.</p>';
            } else {
                html += '<p class="mb-0 text-danger"><i class="bi bi-x-circle me-1"></i>Régimen hídrico limitante. Agricultura de secano riesgosa.</p>';
            }
        }

        html += '</div>';

        // Yearly rainfall trend
        if (climate.yearlyData && climate.yearlyData.length > 0) {
            html += '<div class="mt-3"><strong>Lluvia anual por año</strong></div>';
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
        let html = '<h5 class="mt-4"><i class="bi bi-key me-1"></i> Análisis para Alquiler</h5>';

        if (results.weightedIP !== null) {
            html += '<div class="p-3 bg-light rounded mb-2">';
            html += `<p class="mb-1">El <strong>Índice de Productividad promedio ponderado</strong> del campo es <span class="fw-bold fs-5">${results.weightedIP}</span>.</p>`;

            const classI_II = results.grouped.filter(g => g.cu && parseInt(g.cu) <= 2);
            const pctPremium = classI_II.reduce((sum, g) => sum + g.totalPercentage, 0);

            if (pctPremium > 50) {
                html += '<p class="mb-0 text-success">Más del 50% del campo tiene suelos Clase I-II. Buena base para negociar alquiler agrícola.</p>';
            } else {
                const classIII_IV = results.grouped.filter(g => g.cu && parseInt(g.cu) >= 3 && parseInt(g.cu) <= 4);
                const pctMid = classIII_IV.reduce((sum, g) => sum + g.totalPercentage, 0);
                if (pctMid > 30) {
                    html += '<p class="mb-0">El campo tiene suelos mixtos. Considerá ajustar el valor del alquiler según la proporción agrícola/ganadera.</p>';
                }
            }
            html += '</div>';
        }

        return html;
    },

    compraSection(results) {
        let html = '<h5 class="mt-4"><i class="bi bi-house-door me-1"></i> Análisis para Compra</h5>';
        html += '<div class="p-3 bg-light rounded mb-2">';

        html += `<p><strong>Superficie total:</strong> ${results.totalAreaHa.toFixed(1)} ha</p>`;

        if (results.weightedIP !== null) {
            html += `<p><strong>IP Promedio Ponderado:</strong> ${results.weightedIP}</p>`;
        }

        const limited = results.grouped.filter(g => g.cu && parseInt(g.cu) >= 5);
        if (limited.length > 0) {
            const pctLimited = limited.reduce((sum, g) => sum + g.totalPercentage, 0);
            html += `<p class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i> ${pctLimited.toFixed(0)}% del campo tiene suelos con limitaciones severas (Clase V+). Tené en cuenta esto en la valuación.</p>`;
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
        let html = '<h5 class="mt-4"><i class="bi bi-gear me-1"></i> Análisis para Manejo</h5>';
        html += '<div class="p-3 bg-light rounded mb-2">';

        if (results.grouped.length >= 3) {
            html += '<p><i class="bi bi-layers me-1"></i> El campo tiene variabilidad de suelos significativa. Considerá manejo por ambientes.</p>';
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
            3: 'Agricultura con limitaciones moderadas. Rotación con pasturas.',
            4: 'Agricultura ocasional con limitaciones severas. Priorizar pasturas.',
            5: 'No apto para agricultura. Ganadería sobre pasturas.',
            6: 'Ganadería extensiva. Pastizal natural.',
            7: 'Uso restringido. Forestación o conservación.',
            8: 'Sin aptitud agropecuaria. Conservación.'
        };
        return recs[cu] || 'Sin datos de clase de uso.';
    }
};
