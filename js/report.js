/**
 * report.js - Generate HTML report from analysis results
 */
const Report = {

    generate(results, options) {
        const { reportType, fieldName, detailLevel } = options;

        const typeLabels = {
            alquiler: 'Alquiler',
            compra: 'Compra',
            manejo: 'Manejo'
        };

        let html = '';

        // Header
        html += `<h5><i class="bi bi-file-earmark-text me-1"></i> ${fieldName || 'Campo sin nombre'}</h5>`;
        html += `<p class="text-muted mb-3">Informe para <strong>${typeLabels[reportType]}</strong> · ${new Date().toLocaleDateString('es-AR')}</p>`;

        // Summary cards
        html += '<div class="row g-2 mb-3">';
        html += this.summaryCard('Superficie', `${results.totalAreaHa.toFixed(1)} ha`, 'bi-rulers');
        html += this.summaryCard('IP Promedio', results.weightedIP !== null ? results.weightedIP : 'S/D', 'bi-speedometer2', this.ipClass(results.weightedIP));
        html += this.summaryCard('Unidades', results.grouped.length, 'bi-layers');
        html += this.summaryCard('Cobertura', `${results.coveragePercent.toFixed(0)}%`, 'bi-pie-chart');
        html += '</div>';

        // Soil units table
        html += '<h5 class="mt-4"><i class="bi bi-table me-1"></i> Unidades de Suelo</h5>';
        html += this.soilTable(results.grouped, detailLevel, reportType);

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
                <strong>Nota:</strong> Este informe se genera a partir de las Cartas de Suelo de IDECOR (Córdoba).
                Los datos tienen escala semi-detallada y son orientativos. No reemplazan un estudio de suelos a campo.
                Fuente: <a href="https://suelos.cba.gov.ar" target="_blank">suelos.cba.gov.ar</a>
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

    soilTable(grouped, detailLevel, reportType) {
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
                html += `<td>${g.composicion || '-'}</td>`;
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

    alquilerSection(results) {
        let html = '<h5 class="mt-4"><i class="bi bi-key me-1"></i> Análisis para Alquiler</h5>';

        if (results.weightedIP !== null) {
            html += '<div class="p-3 bg-light rounded mb-2">';
            html += `<p class="mb-1">El <strong>Índice de Productividad promedio ponderado</strong> del campo es <span class="fw-bold fs-5">${results.weightedIP}</span>.</p>`;

            // Rough rental reference
            const classI_II = results.grouped.filter(g => g.cu && g.cu <= 2);
            const pctPremium = classI_II.reduce((sum, g) => sum + g.totalPercentage, 0);

            if (pctPremium > 50) {
                html += '<p class="mb-0 text-success">Más del 50% del campo tiene suelos Clase I-II. Buena base para negociar alquiler agrícola.</p>';
            } else {
                const classIII_IV = results.grouped.filter(g => g.cu && g.cu >= 3 && g.cu <= 4);
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

        // Limitations
        const limited = results.grouped.filter(g => g.cu && g.cu >= 5);
        if (limited.length > 0) {
            const pctLimited = limited.reduce((sum, g) => sum + g.totalPercentage, 0);
            html += `<p class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i> ${pctLimited.toFixed(0)}% del campo tiene suelos con limitaciones severas (Clase V+). Tené en cuenta esto en la valuación.</p>`;
        }

        const premium = results.grouped.filter(g => g.cu && g.cu <= 2);
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

        // Group by land use class
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
