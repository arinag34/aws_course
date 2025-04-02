const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

const dynamoDb = new DynamoDBClient({ region: process.env.region });
const TABLE_NAME = process.env.table_name;

exports.handler = async (event) => {
    try {
        const { principalId, content } = JSON.parse(event.body);

        if (!principalId || typeof content !== "object") {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid request payload" }),
            };
        }

        const newEvent = {
            id: { S: uuidv4() },
            principalId: { N: principalId.toString() },
            createdAt: { S: new Date().toISOString() },
            body: { S: JSON.stringify(content) },
        };

        await dynamoDb.send(new PutItemCommand({ TableName: TABLE_NAME, Item: newEvent }));

        return {
            statusCode: 201,
            body: JSON.stringify({
                event: {
                    id: newEvent.id.S,
                    principalId: parseInt(newEvent.principalId.N, 10),
                    createdAt: newEvent.createdAt.S,
                    body: JSON.parse(newEvent.body.S),
                },
            }),
        };
    } catch (error) {
        console.error("Error saving event:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error" }),
        };
    }
};
