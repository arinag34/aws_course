const AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-1' });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Events';

exports.handler = async (event) => {
    const { id } = event.arguments;
    const result = await dynamoDB
        .get({
            TableName: TABLE_NAME,
            Key: { id },
        })
        .promise();

    return result.Item || null;
};
