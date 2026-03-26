/**
 * satellite.js - Historical satellite & climate analysis
 * NDVI via MODIS (MOD13Q1) + Enhanced precipitation analysis
 * Flooding risk, drought assessment, productivity estimation
 */
const Satellite = {

    /**
     * Run full satellite/historical analysis
     * @param {number} lat - Field centroid latitude
     * @param {number} lon - Field centroid longitude
     * @param {Object} climateData - Climate data from climate.js (with dailyData)
     * @param {number} fieldIP - Weighted IP from soil analysis
     * @returns {Object} Satellite analysis results
     */
    async analyze(lat, lon, climateData, fieldIP) {
        const results = {};

        // 1. Enhanced precipitation analysis (wet/dry years, extremes)
        if (climateData && climateData.yearlyData) {
            results.precipAnalysis = this.analyzePrecipitation(climateData);
        }

        // 2. Flooding risk from daily precipitation
        if (climateData && climateData.dailyData) {
            results.floodRisk = this.analyzeFloodRisk(climateData.dailyData);
        }

        // 3. Productivity estimation (IP + rainfall correlation)
        if (climateData && fieldIP) {
            results.productivity = this.estimateProductivity(climateData, fieldIP);
        }

        // 4. Try to fetch NDVI from MODIS
        try {
            results.ndvi = await this.fetchNDVI(lat, lon);
        } catch (e) {
            console.warn('NDVI no disponible:', e.message);
            results.ndvi = null;
        }

        return results;
    },

    /**
     * Enhanced precipitation analysis - identify wet/dry years
     */
    analyzePrecipitation(climateData) {
        const years = climateData.yearlyData;
        if (!years || years.length < 3) return null;

        const avg = climateData.annualPrecip;
        const sorted = [...years].sort((a, b) => b.precip - a.precip);

        // Standard deviation
        const variance = years.reduce((sum, y) => sum + Math.pow(y.precip - avg, 2), 0) / years.length;
        const stdDev = Math.round(Math.sqrt(variance));

        // Classify years
        const wetYears = years.filter(y => y.precip > avg * 1.15).sort((a, b) => b.precip - a.precip);
        const dryYears = years.filter(y => y.precip < avg * 0.85).sort((a, b) => a.precip - b.precip);
        const normalYears = years.filter(y => y.precip >= avg * 0.85 && y.precip <= avg * 1.15);

        // Consecutive dry years (risk)
        let maxConsecutiveDry = 0;
        let currentDry = 0;
        for (const y of years) {
            if (y.precip < avg * 0.85) { currentDry++; maxConsecutiveDry = Math.max(maxConsecutiveDry, currentDry); }
            else { currentDry = 0; }
        }

        // Trend (linear regression slope)
        const n = years.length;
        const sumX = years.reduce((s, y, i) => s + i, 0);
        const sumY = years.reduce((s, y) => s + y.precip, 0);
        const sumXY = years.reduce((s, y, i) => s + i * y.precip, 0);
        const sumX2 = years.reduce((s, y, i) => s + i * i, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const trendPerDecade = Math.round(slope * 10);

        return {
            avg,
            stdDev,
            wettest: sorted[0],
            driest: sorted[sorted.length - 1],
            wetYears,
            dryYears,
            normalYears,
            maxConsecutiveDry,
            trendPerDecade,
            variabilityIndex: Math.round((stdDev / avg) * 100) // CV%
        };
    },

    /**
     * Analyze flooding risk from daily precipitation data
     */
    analyzeFloodRisk(dailyData) {
        if (!dailyData || !dailyData.dates) return null;

        const { dates, precip } = dailyData;
        const n = dates.length;

        // Count extreme daily events
        let extremeDays50 = 0;  // > 50mm/day
        let extremeDays80 = 0;  // > 80mm/day
        let extremeDays100 = 0; // > 100mm/day
        let maxDailyPrecip = 0;
        let maxDailyDate = '';

        // Count wet periods (>5 consecutive days with >5mm)
        let consecutiveWet = 0;
        let maxConsecutiveWet = 0;
        let wetPeriods = 0; // periods >7 days

        // Seasonal flooding analysis
        const monthlyExtremes = Array.from({ length: 12 }, () => ({ count: 0, total: 0 }));

        for (let i = 0; i < n; i++) {
            const p = precip[i] || 0;
            const date = dates[i];
            const month = new Date(date).getMonth();

            if (p > 50) { extremeDays50++; monthlyExtremes[month].count++; }
            if (p > 80) extremeDays80++;
            if (p > 100) extremeDays100++;
            if (p > maxDailyPrecip) { maxDailyPrecip = p; maxDailyDate = date; }

            if (p > 5) {
                consecutiveWet++;
                if (consecutiveWet > maxConsecutiveWet) maxConsecutiveWet = consecutiveWet;
            } else {
                if (consecutiveWet >= 7) wetPeriods++;
                consecutiveWet = 0;
            }
        }

        const totalYears = n / 365.25;

        // Flooding risk score (0-100)
        let floodScore = 0;
        floodScore += Math.min(30, (extremeDays50 / totalYears) * 5);
        floodScore += Math.min(25, (extremeDays80 / totalYears) * 10);
        floodScore += Math.min(20, (extremeDays100 / totalYears) * 15);
        floodScore += Math.min(15, (wetPeriods / totalYears) * 5);
        floodScore += Math.min(10, maxConsecutiveWet * 1);
        floodScore = Math.round(Math.min(100, floodScore));

        // Risk level
        let riskLevel, riskColor;
        if (floodScore >= 60) { riskLevel = 'Alto'; riskColor = 'danger'; }
        else if (floodScore >= 35) { riskLevel = 'Moderado'; riskColor = 'warning'; }
        else { riskLevel = 'Bajo'; riskColor = 'success'; }

        // Most flood-prone months
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const floodMonths = monthlyExtremes
            .map((m, i) => ({ month: monthNames[i], count: m.count }))
            .filter(m => m.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        return {
            floodScore,
            riskLevel,
            riskColor,
            extremeDays50: Math.round(extremeDays50 / totalYears * 10) / 10,
            extremeDays80: Math.round(extremeDays80 / totalYears * 10) / 10,
            extremeDays100: Math.round(extremeDays100 / totalYears * 10) / 10,
            maxDailyPrecip: Math.round(maxDailyPrecip),
            maxDailyDate,
            maxConsecutiveWet,
            wetPeriods: Math.round(wetPeriods / totalYears * 10) / 10,
            floodMonths
        };
    },

    /**
     * Estimate productivity based on IP + climate
     */
    estimateProductivity(climateData, fieldIP) {
        const years = climateData.yearlyData;
        if (!years || years.length === 0) return null;

        // Simple productivity model: IP * rainfall factor
        // Optimal rainfall ~800mm for Córdoba pampeana
        const optimalRain = 850;

        const yearlyProductivity = years.map(y => {
            // Rainfall factor: peaks at optimal, decreases for too dry or too wet
            let rainFactor;
            if (y.precip <= optimalRain) {
                rainFactor = y.precip / optimalRain;
            } else {
                // Excess rain reduces productivity slightly (waterlogging)
                const excess = (y.precip - optimalRain) / optimalRain;
                rainFactor = Math.max(0.6, 1 - excess * 0.3);
            }

            // Productivity score (0-100)
            const score = Math.round(fieldIP * rainFactor);
            return {
                year: y.year,
                precip: y.precip,
                rainFactor: Math.round(rainFactor * 100) / 100,
                productivityScore: Math.min(100, score),
                category: score >= 55 ? 'Buena' : score >= 35 ? 'Regular' : 'Baja'
            };
        });

        const avgScore = Math.round(yearlyProductivity.reduce((s, y) => s + y.productivityScore, 0) / yearlyProductivity.length);
        const bestYear = [...yearlyProductivity].sort((a, b) => b.productivityScore - a.productivityScore)[0];
        const worstYear = [...yearlyProductivity].sort((a, b) => a.productivityScore - b.productivityScore)[0];

        return {
            yearlyProductivity,
            avgScore,
            bestYear,
            worstYear
        };
    },

    /**
     * Fetch NDVI data from MODIS (MOD13Q1) via ORNL DAAC
     * Falls back gracefully if unavailable
     */
    async fetchNDVI(lat, lon) {
        const endYear = new Date().getFullYear() - 1;
        const startYear = endYear - 9;

        // MODIS ORNL DAAC API
        const baseUrl = `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset`;
        const params = `?latitude=${lat}&longitude=${lon}` +
            `&band=250m_16_days_NDVI&startDate=A${startYear}001&endDate=A${endYear}365` +
            `&kmAboveBelow=0&kmLeftRight=0`;

        // Try direct fetch first, then CORS proxy
        let response;
        try {
            response = await fetch(baseUrl + params, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000)
            });
        } catch (e) {
            // Try CORS proxy
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl + params)}`;
            response = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
        }

        if (!response.ok) throw new Error(`MODIS HTTP ${response.status}`);

        const data = await response.json();
        return this.processNDVI(data, startYear, endYear);
    },

    processNDVI(data, startYear, endYear) {
        if (!data.subset || data.subset.length === 0) return null;

        // MODIS NDVI scale factor: 0.0001
        const scaleFactor = 0.0001;
        const yearlyNDVI = {};
        const monthlyNDVI = Array.from({ length: 12 }, () => []);

        for (const entry of data.subset) {
            // Calendar date format: A2024001 (Julian day)
            const dateStr = entry.calendar_date || entry.modis_date;
            if (!dateStr) continue;

            let year, month;
            if (dateStr.startsWith('A')) {
                year = parseInt(dateStr.substring(1, 5));
                const doy = parseInt(dateStr.substring(5));
                const d = new Date(year, 0, doy);
                month = d.getMonth();
            } else {
                const d = new Date(dateStr);
                year = d.getFullYear();
                month = d.getMonth();
            }

            const ndviRaw = parseFloat(entry.data || entry.value);
            if (isNaN(ndviRaw) || ndviRaw < -2000 || ndviRaw > 10000) continue;

            const ndvi = ndviRaw * scaleFactor;
            if (ndvi < 0 || ndvi > 1) continue;

            if (!yearlyNDVI[year]) yearlyNDVI[year] = [];
            yearlyNDVI[year].push(ndvi);
            monthlyNDVI[month].push(ndvi);
        }

        // Yearly averages (growing season: Oct-Mar)
        const yearlyAvg = Object.entries(yearlyNDVI).map(([year, values]) => ({
            year: parseInt(year),
            ndvi: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
            maxNDVI: Math.round(Math.max(...values) * 1000) / 1000
        })).sort((a, b) => a.year - b.year);

        // Monthly profile
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthlyProfile = monthlyNDVI.map((values, i) => ({
            month: monthNames[i],
            ndvi: values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000 : null
        }));

        const allValues = Object.values(yearlyNDVI).flat();
        const avgNDVI = allValues.length > 0 ?
            Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 1000) / 1000 : null;

        // Greenness assessment
        let greenClass;
        if (avgNDVI >= 0.6) greenClass = 'Alta cobertura vegetal';
        else if (avgNDVI >= 0.4) greenClass = 'Cobertura vegetal moderada';
        else if (avgNDVI >= 0.2) greenClass = 'Cobertura vegetal baja';
        else greenClass = 'Suelo descubierto o muy baja cobertura';

        return {
            yearlyAvg,
            monthlyProfile,
            avgNDVI,
            greenClass,
            period: `${startYear}-${endYear}`,
            source: 'MODIS MOD13Q1 (250m)'
        };
    }
};
