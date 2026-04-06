/**
 * climate.js - Historical climate data from Open-Meteo API
 * Free, no API key needed
 */
const Climate = {

    /**
     * Fetch historical climate data for a location
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @returns {Object} Climate summary
     */
    async fetchHistorical(lat, lon) {
        // Get last 10 years of daily data
        const endYear = new Date().getFullYear() - 1;
        const startYear = endYear - 9;

        const url = `https://archive-api.open-meteo.com/v1/archive?` +
            `latitude=${lat}&longitude=${lon}` +
            `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
            `&timezone=America/Argentina/Cordoba`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

        const data = await response.json();
        return this.processClimateData(data, startYear, endYear);
    },

    /**
     * Fetch daily precipitation data for extreme event analysis
     */
    async fetchDaily(lat, lon) {
        const endYear = new Date().getFullYear() - 1;
        const startYear = endYear - 9;

        const url = `https://archive-api.open-meteo.com/v1/archive?` +
            `latitude=${lat}&longitude=${lon}` +
            `&start_date=${startYear}-01-01&end_date=${endYear}-12-31` +
            `&daily=precipitation_sum` +
            `&timezone=America/Argentina/Cordoba`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo daily HTTP ${response.status}`);

        const data = await response.json();
        if (!data.daily || !data.daily.time) return null;

        return {
            dates: data.daily.time,
            precip: data.daily.precipitation_sum
        };
    },

    processClimateData(data, startYear, endYear) {
        const daily = data.daily;
        if (!daily || !daily.time) return null;

        const n = daily.time.length;
        const months = Array.from({ length: 12 }, () => ({
            tempMax: [], tempMin: [], precip: []
        }));

        // Yearly totals
        const yearlyPrecip = {};

        for (let i = 0; i < n; i++) {
            const date = new Date(daily.time[i]);
            const month = date.getMonth();
            const year = date.getFullYear();

            if (daily.temperature_2m_max[i] != null) {
                months[month].tempMax.push(daily.temperature_2m_max[i]);
            }
            if (daily.temperature_2m_min[i] != null) {
                months[month].tempMin.push(daily.temperature_2m_min[i]);
            }
            if (daily.precipitation_sum[i] != null) {
                months[month].precip.push(daily.precipitation_sum[i]);
                if (!yearlyPrecip[year]) yearlyPrecip[year] = 0;
                yearlyPrecip[year] += daily.precipitation_sum[i];
            }
        }

        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                           'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        const monthlyData = months.map((m, i) => ({
            month: monthNames[i],
            tempMax: this.avg(m.tempMax),
            tempMin: this.avg(m.tempMin),
            precip: this.sum(m.precip) / ((endYear - startYear + 1) || 1)
        }));

        // Count days per year to detect incomplete data
        const yearDayCount = {};
        for (let i = 0; i < n; i++) {
            const year = new Date(daily.time[i]).getFullYear();
            if (!yearDayCount[year]) yearDayCount[year] = 0;
            if (daily.precipitation_sum[i] != null) yearDayCount[year]++;
        }

        const yearlyData = Object.entries(yearlyPrecip)
            .map(([year, total]) => ({
                year: parseInt(year),
                precip: Math.round(total),
                days: yearDayCount[parseInt(year)] || 0
            }))
            .filter(y => y.days >= 300 && y.precip >= 100) // Exclude incomplete years
            .sort((a, b) => a.year - b.year);

        const annualPrecip = this.avg(yearlyData.map(y => y.precip));

        // Growing season (Oct-Mar)
        const growingMonths = [9, 10, 11, 0, 1, 2]; // Oct-Mar
        const growingPrecip = growingMonths.reduce((sum, mi) => sum + monthlyData[mi].precip, 0);

        // Winter (Apr-Sep)
        const winterMonths = [3, 4, 5, 6, 7, 8];
        const winterPrecip = winterMonths.reduce((sum, mi) => sum + monthlyData[mi].precip, 0);

        return {
            period: `${startYear}-${endYear}`,
            monthlyData,
            yearlyData,
            annualPrecip: Math.round(annualPrecip),
            growingSeasonPrecip: Math.round(growingPrecip),
            winterPrecip: Math.round(winterPrecip),
            avgTempMax: this.avg(monthlyData.map(m => m.tempMax)),
            avgTempMin: this.avg(monthlyData.map(m => m.tempMin))
        };
    },

    /**
     * Fetch climate data for a specific campaign period (for Reclamo reports)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {string} startDate - YYYY-MM-DD
     * @param {string} endDate - YYYY-MM-DD
     */
    async fetchCampaign(lat, lon, startDate, endDate) {
        const url = `https://archive-api.open-meteo.com/v1/archive?` +
            `latitude=${lat}&longitude=${lon}` +
            `&start_date=${startDate}&end_date=${endDate}` +
            `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration` +
            `&timezone=America/Argentina/Cordoba`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Open-Meteo campana HTTP ${response.status}`);

        const data = await response.json();
        return this.processCampaignData(data, startDate, endDate);
    },

    processCampaignData(data, startDate, endDate) {
        const daily = data.daily;
        if (!daily || !daily.time) return null;

        const n = daily.time.length;
        const monthGroups = {};
        let totalFrostDays = 0, totalHotDays = 0, totalHeavyRainDays = 0;

        for (let i = 0; i < n; i++) {
            const date = new Date(daily.time[i] + 'T12:00:00');
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = {
                    label: date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
                    tempMax: [], tempMin: [], precip: [], et0: []
                };
            }

            const tmax = daily.temperature_2m_max[i];
            const tmin = daily.temperature_2m_min[i];
            const pr = daily.precipitation_sum[i];
            const et = daily.et0_fao_evapotranspiration ? daily.et0_fao_evapotranspiration[i] : null;

            if (tmax != null) { monthGroups[monthKey].tempMax.push(tmax); if (tmax > 35) totalHotDays++; }
            if (tmin != null) { monthGroups[monthKey].tempMin.push(tmin); if (tmin < 0) totalFrostDays++; }
            if (pr != null) { monthGroups[monthKey].precip.push(pr); if (pr > 40) totalHeavyRainDays++; }
            if (et != null) monthGroups[monthKey].et0.push(et);
        }

        const months = Object.entries(monthGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, m]) => {
                const avgTempMax = this.avg(m.tempMax);
                const avgTempMin = this.avg(m.tempMin);
                const totalPrecip = Math.round(this.sum(m.precip));
                const totalEt0 = Math.round(this.sum(m.et0));
                return {
                    key,
                    label: m.label,
                    tempMax: avgTempMax,
                    tempMin: avgTempMin,
                    thermalAmplitude: Math.round((avgTempMax - avgTempMin) * 10) / 10,
                    totalPrecip,
                    totalEt0,
                    waterBalance: totalPrecip - totalEt0
                };
            });

        const totalPrecip = months.reduce((s, m) => s + m.totalPrecip, 0);
        const totalEt0 = months.reduce((s, m) => s + m.totalEt0, 0);

        return {
            startDate,
            endDate,
            months,
            totalPrecip: Math.round(totalPrecip),
            totalEt0: Math.round(totalEt0),
            waterBalance: Math.round(totalPrecip - totalEt0),
            avgTempMax: this.avg(months.map(m => m.tempMax)),
            avgTempMin: this.avg(months.map(m => m.tempMin)),
            avgThermalAmplitude: this.avg(months.map(m => m.thermalAmplitude)),
            frostDays: totalFrostDays,
            hotDays: totalHotDays,
            heavyRainDays: totalHeavyRainDays
        };
    },

    avg(arr) {
        if (!arr.length) return 0;
        return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    },

    sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
    }
};
