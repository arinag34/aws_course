const https = require('https');

class OpenMeteoClient {
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.baseUrl = 'https://api.open-meteo.com/v1/forecast';
    }

    buildUrl() {
        const params = `?latitude=${this.latitude}&longitude=${this.longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`;
        return this.baseUrl + params;
    }

    fetchForecast() {
        return new Promise((resolve, reject) => {
            const url = this.buildUrl();
            https.get(url, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (error) {
                        reject('Failed to parse JSON response');
                    }
                });
            }).on('error', (err) => {
                reject(`Error fetching data: ${err.message}`);
            });
        });
    }
}

// Example usage:
const client = new OpenMeteoClient(52.52, 13.41);
client.fetchForecast()
    .then(data => {
        console.log('Current Weather:', data.current);
        console.log('Hourly Forecast:', data.hourly);
    })
    .catch(err => console.error('Error:', err));
