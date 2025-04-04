const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

AWS.config.update({ region: process.env.REGION });
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLES_TABLE = process.env.tables_table;
const RESERVATIONS_TABLE = process.env.reservations_table;
const USER_POOL_ID = process.env.cup_id;
const CLIENT_ID = process.env.cup_client_id;

async function signUpUser(event) {
    const body = JSON.parse(event.body);
    const { firstName, lastName, email, password } = body;

    const params = {
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'given_name', Value: firstName },
            { Name: 'family_name', Value: lastName }
        ],
        TemporaryPassword: password,
        MessageAction: "SUPPRESS"
    };

    try {
        await cognito.adminCreateUser(params).promise();
        return { statusCode: 200, body: JSON.stringify({ message: "Sign-up successful" }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

async function signInUser(event) {
    const body = JSON.parse(event.body);
    const params = {
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        AuthParameters: {
            USERNAME: body.email,
            PASSWORD: body.password
        }
    };

    try {
        const data = await cognito.adminInitiateAuth(params).promise();
        return { statusCode: 200, body: JSON.stringify({ idToken: data.AuthenticationResult.IdToken }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: "Authentication failed", details: error.message }) };
    }
}

async function getTables(event) {
    try {
        const result = await dynamoDB.scan({ TableName: TABLES_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify({ tables: result.Items }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

async function createTable(event) {
    const body = JSON.parse(event.body);

    try {
        await dynamoDB.put({ TableName: TABLES_TABLE, Item: body }).promise();
        return { statusCode: 200, body: JSON.stringify({ id: body.id }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

async function getTableById(event) {
    const tableId = event.pathParameters.tableId;
    try {
        const result = await dynamoDB.get({ TableName: TABLES_TABLE, Key: { id: tableId } }).promise();
        if (!result.Item) {
            return { statusCode: 400, body: JSON.stringify({ error: "Table not found" }) };
        }
        return { statusCode: 200, body: JSON.stringify(result.Item) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

async function createReservation(event) {
    const body = JSON.parse(event.body);
    body.reservationId = uuidv4();

    try {
        await dynamoDB.put({ TableName: RESERVATIONS_TABLE, Item: body }).promise();
        return { statusCode: 200, body: JSON.stringify({ reservationId: body.reservationId }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

async function getReservations(event) {
    try {
        const result = await dynamoDB.scan({ TableName: RESERVATIONS_TABLE }).promise();
        return { statusCode: 200, body: JSON.stringify({ reservations: result.Items }) };
    } catch (error) {
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
}

exports.handler = async (event) => {
    switch (event.resource) {
        case '/signup': return signUpUser(event);
        case '/signin': return signInUser(event);
        case '/tables':
            return event.httpMethod === 'GET' ? getTables(event) : createTable(event);
        case '/tables/{tableId}': return getTableById(event);
        case '/reservations':
            return event.httpMethod === 'GET' ? getReservations(event) : createReservation(event);
        default:
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid resource path" }) };
    }
};
