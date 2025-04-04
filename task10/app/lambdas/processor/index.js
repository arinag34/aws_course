const axios = require('axios');
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.target_table;

exports.handler = async (event) => {
    const path = '/weather';
    const method = 'GET';

    if (path === '/weather' && method === 'GET') {
        try {
            const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
                params: {
                    latitude: 52.52,
                    longitude: 13.41,
                    current_weather: true,
                    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
                },
            });

            const weatherData = response.data;

            const weatherRecord = {
                id: uuidv4(),
                forecast: {
                    elevation: parseInt(weatherData.elevation),
                    generationtime_ms: parseInt(weatherData.generationtime_ms),
                    hourly: {
                        temperature_2m: parseInt(weatherData.hourly.temperature_2m),
                        time: weatherData.hourly.time,
                    },
                    hourly_units: {
                        temperature_2m: weatherData.hourly_units.temperature_2m,
                        time: weatherData.hourly_units.time,
                    },
                    latitude: parseInt(weatherData.latitude),
                    longitude: parseInt(weatherData.longitude),
                    timezone: weatherData.timezone,
                    timezone_abbreviation: weatherData.timezone_abbreviation,
                    utc_offset_seconds: parseInt(weatherData.utc_offset_seconds),

                }
            };

            const params = {
                TableName: TABLE_NAME,
                Item: weatherRecord
            };

            await docClient.put(params).promise();

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Weather data saved successfully!',
                    data: weatherRecord,
                }),
                headers: {
                    'content-type': 'application/json',
                },
                isBase64Encoded: false,
            };
        } catch (error) {
            console.error('Error fetching weather data:', error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    statusCode: 500,
                    message: 'Internal Server Error',
                }),
                headers: {
                    'content-type': 'application/json',
                },
                isBase64Encoded: false,
            };
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            statusCode: 400,
            message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
        }),
        headers: {
            'content-type': 'application/json',
        },
        isBase64Encoded: false,
    };
};
