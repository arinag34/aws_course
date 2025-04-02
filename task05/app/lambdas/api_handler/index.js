const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Events';

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { principalId, content } = body;

        if (!principalId || typeof content !== 'object') {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid request payload" })
            };
        }

        const newEvent = {
            id: uuidv4(),
            principalId,
            createdAt: new Date().toISOString(),
            body: content
        };

        await dynamoDB.put({
            TableName: TABLE_NAME,
            Item: newEvent
        }).promise();

        return {
            statusCode: 201,
            body: JSON.stringify({ event: newEvent })
        };
    } catch (error) {
        console.error("Error saving event:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};
