const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Events';

exports.handler = async (event) => {
    const { userId, payLoad } = event.arguments;

    const newItem = {
        id: uuidv4(),
        userId,
        createdAt: new Date().toISOString(),
        payLoad: JSON.parse(payLoad)
    };

    const params = {
        TableName: TABLE_NAME,
        Item: newItem
    };

    try {
        await docClient.put(params).promise();
        return {
            id: newItem.id,
            createdAt: newItem.createdAt
        };
    } catch (error) {
        console.error('Error creating event:', error);
        throw new Error('Could not create event');
    }
};
