const AWS = require('aws-sdk');

const docClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Events';

exports.handler = async (event) => {
    const { id } = event.arguments;

    const params = {
        TableName: TABLE_NAME,
        Key: { id }
    };

    try {
        const { Item } = await docClient.get(params).promise();
        if (!Item) {
            throw new Error('Event not found');
        }
        return Item;
    } catch (error) {
        console.error('Error fetching event:', error);
        throw new Error('Could not fetch event');
    }
};
