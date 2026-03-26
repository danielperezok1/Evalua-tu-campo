/**
 * analysis.js - Spatial intersection and soil calculations
 */
const Analysis = {

    /**
     * Main analysis: intersect field with soil data and compute statistics
     * @param {GeoJSON} fieldGeoJSON - The field boundary
     * @param {GeoJSON} soilGeoJSON - Combined soil FeatureCollection
     * @returns {Object} Analysis results
     */
    analyze(fieldGeoJSON, soilGeoJSON) {
        const fieldFeature = fieldGeoJSON.features[0];
        const totalAreaM2 = turf.area(fieldFeature);
        const totalAreaHa = totalAreaM2 / 10000;

        const soilUnits = [];
        let coveredAreaM2 = 0;

        for (const soilFeature of soilGeoJSON.features) {
            try {
                const intersection = turf.intersect(
                    turf.featureCollection([fieldFeature, soilFeature])
                );

                if (!intersection) continue;

                const interAreaM2 = turf.area(intersection);
                if (interAreaM2 < 1) continue; // skip tiny slivers

                coveredAreaM2 += interAreaM2;

                soilUnits.push({
                    geometry: intersection,
                    areaM2: interAreaM2,
                    areaHa: interAreaM2 / 10000,
                    percentage: (interAreaM2 / totalAreaM2) * 100,
                    textUserId: soilFeature.properties.TEXTUSERID || 'S/D',
                    cu: soilFeature.properties.CU,
                    scu: soilFeature.properties.SCU,
                    ip: soilFeature.properties.IP,
                    composicion: soilFeature.properties.COMPOSIC || '',
                    tipoUnidad: soilFeature.properties.TIPO_UNID || '',
                    series: this.extractSeries(soilFeature.properties)
                });
            } catch (e) {
                console.warn('Error en intersección:', e);
            }
        }

        // Group by soil unit (TEXTUSERID)
        const grouped = this.groupByUnit(soilUnits);

        // Weighted average IP
        const weightedIP = this.calcWeightedIP(soilUnits);

        // Coverage quality
        const coveragePercent = (coveredAreaM2 / totalAreaM2) * 100;

        // Observations
        const observations = this.generateObservations(
            coveragePercent, grouped, weightedIP, totalAreaHa
        );

        return {
            totalAreaHa,
            totalAreaM2,
            soilUnits,
            grouped,
            weightedIP,
            coveragePercent,
            observations
        };
    },

    extractSeries(props) {
        const series = [];
        for (let i = 1; i <= 8; i++) {
            const serieName = props[`SERIE_${i}`];
            const porcKey = `PORC_${i}`;
            const porc = props[porcKey];
            if (serieName && serieName.trim()) {
                series.push({ name: serieName.trim(), percentage: porc || null });
            }
        }
        return series;
    },

    groupByUnit(soilUnits) {
        const groups = {};

        for (const unit of soilUnits) {
            const key = unit.textUserId;
            if (!groups[key]) {
                groups[key] = {
                    textUserId: key,
                    cu: unit.cu,
                    scu: unit.scu,
                    ip: unit.ip,
                    composicion: unit.composicion,
                    tipoUnidad: unit.tipoUnidad,
                    series: unit.series,
                    totalAreaHa: 0,
                    totalPercentage: 0,
                    count: 0
                };
            }
            groups[key].totalAreaHa += unit.areaHa;
            groups[key].totalPercentage += unit.percentage;
            groups[key].count++;
        }

        // Sort by percentage descending
        return Object.values(groups).sort((a, b) => b.totalPercentage - a.totalPercentage);
    },

    calcWeightedIP(soilUnits) {
        let sumIP = 0;
        let sumArea = 0;

        for (const unit of soilUnits) {
            if (unit.ip != null && unit.ip > 0) {
                sumIP += unit.ip * unit.areaM2;
                sumArea += unit.areaM2;
            }
        }

        if (sumArea === 0) return null;
        return Math.round(sumIP / sumArea);
    },

    cuToRoman(cu) {
        const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII' };
        return map[cu] || (cu ? String(cu) : 'S/D');
    },

    generateObservations(coveragePercent, grouped, weightedIP, totalAreaHa) {
        const obs = [];

        if (coveragePercent < 50) {
            obs.push({
                type: 'warning',
                text: `Solo se encontró información de suelos para el ${coveragePercent.toFixed(0)}% del campo. El resultado puede no ser representativo. Verificá que el campo esté dentro del área relevada por IDECOR.`
            });
        } else if (coveragePercent < 90) {
            obs.push({
                type: 'warning',
                text: `La cobertura de datos de suelo es del ${coveragePercent.toFixed(0)}%. Algunas áreas del campo no tienen información disponible.`
            });
        } else {
            obs.push({
                type: 'info',
                text: `Cobertura de datos: ${coveragePercent.toFixed(0)}% del campo. Buena representatividad.`
            });
        }

        if (weightedIP !== null) {
            if (weightedIP >= 65) {
                obs.push({ type: 'info', text: `IP ${weightedIP}: Suelos de alta aptitud agrícola.` });
            } else if (weightedIP >= 40) {
                obs.push({ type: 'info', text: `IP ${weightedIP}: Suelos de aptitud agrícola moderada.` });
            } else {
                obs.push({ type: 'info', text: `IP ${weightedIP}: Suelos de baja aptitud agrícola. Evaluar uso ganadero o mixto.` });
            }
        } else {
            obs.push({
                type: 'warning',
                text: 'No se encontró Índice de Productividad (IP) en los datos disponibles.'
            });
        }

        if (grouped.length > 5) {
            obs.push({
                type: 'info',
                text: `El campo presenta ${grouped.length} unidades de suelo distintas, indicando alta variabilidad espacial.`
            });
        }

        if (totalAreaHa < 10) {
            obs.push({
                type: 'warning',
                text: 'Superficie pequeña. La escala de la carta de suelos puede no ser adecuada para este nivel de detalle.'
            });
        }

        return obs;
    }
};
