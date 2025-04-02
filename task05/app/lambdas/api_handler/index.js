const { v4: uuidv4 } = require('uuid');
const https = require('https');

const TABLE_NAME = process.env.table_name;
const REGION = process.env.region;
const DYNAMODB_ENDPOINT = `https://dynamodb.${REGION}.amazonaws.com`;

const sendRequest = (method, body) => {
    const options = {
        hostname: `dynamodb.${REGION}.amazonaws.com`,
        method: method,
        headers: {
            "Content-Type": "application/x-amz-json-1.0",
            "X-Amz-Target": "DynamoDB_20120810.PutItem"
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve(JSON.parse(data)));
        });
        req.on("error", (err) => reject(err));
        req.write(JSON.stringify(body));
        req.end();
    });
};

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { principalId, content } = body;

        if (!principalId || !content) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Invalid input data" })
            };
        }

        const eventId = uuidv4();
        const createdAt = new Date().toISOString();

        const eventItem = {
            id: { S: eventId },
            principalId: { N: principalId.toString() },
            createdAt: { S: createdAt },
            body: { S: JSON.stringify(content) }
        };

        const dynamoDBRequestBody = {
            TableName: TABLE_NAME,
            Item: eventItem
        };

        await sendRequest("POST", dynamoDBRequestBody);

        return {
            statusCode: 201,
            body: JSON.stringify({ statusCode: 201, event: {
                    id: eventId,
                    principalId,
                    createdAt,
                    body: content
                } })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to save event", details: error.message })
        };
    }
};
