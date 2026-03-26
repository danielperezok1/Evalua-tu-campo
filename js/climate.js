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

        const yearlyData = Object.entries(yearlyPrecip).map(([year, total]) => ({
            year: parseInt(year),
            precip: Math.round(total)
        })).sort((a, b) => a.year - b.year);

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

    avg(arr) {
        if (!arr.length) return 0;
        return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    },

    sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
    }
};
