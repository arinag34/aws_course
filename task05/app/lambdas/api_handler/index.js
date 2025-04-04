const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.target_table;

exports.handler = async (event) => {
    const path = '/events';
    const method = 'POST';

    if (path === '/events' && method === 'POST') {
        try {
            const requestBody = JSON.parse(event.body);

            const eventRecord = {
                id: uuidv4(),
                principalId: requestBody.principalId,
                createdAt: new Date().toISOString(),
                body: requestBody.content
            };

            const params = {
                TableName: TABLE_NAME,
                Item: eventRecord
            };

            await docClient.put(params).promise();

            return {
                statusCode: 201,
                body: JSON.stringify({
                    statusCode: 201,
                    event: eventRecord,
                }),
            };
        } catch (error) {
            console.error('Error fetching event data:', error.message);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    statusCode: 500,
                    message: 'Internal Server Error',
                }),
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