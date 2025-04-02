const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

AWS.config.update({ region: 'eu-west-1' });
const appsync = new AWS.AppSync();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'Events';

const typeDefs = `
  scalar AWSJSON

  type Event {
    id: String!
    userId: Int!
    createdAt: String!
    payLoad: AWSJSON!
  }

  type Mutation {
    createEvent(userId: Int!, payLoad: AWSJSON!): Event!
  }
`;

exports.handler = async (event) => {
    const { userId, payLoad } = event.arguments;
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const newEvent = {
        id,
        userId,
        createdAt,
        payLoad: JSON.parse(payLoad),
    };

    await dynamoDB
        .put({
            TableName: TABLE_NAME,
            Item: newEvent,
        })
        .promise();

    return newEvent;
};
