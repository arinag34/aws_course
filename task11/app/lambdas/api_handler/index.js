// index.js

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_POOL_ID = process.env.cup_id;
const USERS_CLIENT_ID = process.env.cup_client_id;
const TABLES_TABLE = process.env.tables_table;
const RESERVATIONS_TABLE = process.env.reservations_table;

exports.handler = async (event) => {
    const route = `${event.httpMethod} ${event.path}`;
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = {
        'Content-Type': 'application/json'
    };

    function response(statusCode, bodyObj) {
        return {
            statusCode,
            headers,
            body: JSON.stringify(bodyObj),
            isBase64Encoded: false,
        };
    }

    async function validateToken(authHeader) {
        if (!authHeader) throw 'Unauthorized';
        const token = authHeader.split(' ')[1];
        const decoded = await cognito.getUser({ AccessToken: token }).promise().catch(() => null);
        if (!decoded) throw 'Unauthorized';
        return decoded;
    }

    try {
        switch (route) {
            // 1. SIGN UP
            case 'POST /signup': {
                const { firstName, lastName, email, password } = body;
                if (!email || !password || password.length < 12 || !/^[\w$%^*-_]+$/.test(password)) {
                    return response(400, { message: 'Invalid input' });
                }

                await cognito.adminCreateUser({
                    UserPoolId: USERS_POOL_ID,
                    Username: email,
                    UserAttributes: [
                        { Name: 'email', Value: email },
                        { Name: 'email_verified', Value: 'true' },
                        { Name: 'given_name', Value: firstName },
                        { Name: 'family_name', Value: lastName },
                    ],
                    MessageAction: 'SUPPRESS'
                }).promise();

                await cognito.adminSetUserPassword({
                    UserPoolId: USERS_POOL_ID,
                    Username: email,
                    Password: password,
                    Permanent: true
                }).promise();

                return response(200, { message: 'User created' });
            }

            // 2. SIGN IN
            case 'POST /signin': {
                const { email, password } = body;
                const result = await cognito.initiateAuth({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    ClientId: USERS_CLIENT_ID,
                    AuthParameters: {
                        USERNAME: email,
                        PASSWORD: password
                    }
                }).promise();

                return response(200, { idToken: result.AuthenticationResult.IdToken });
            }

            // 3. GET TABLES
            case 'GET /tables': {
                await validateToken(event.headers.Authorization);
                const data = await dynamodb.scan({ TableName: TABLES_TABLE }).promise();
                return response(200, { tables: data.Items });
            }

            // 4. POST TABLE
            case 'POST /tables': {
                await validateToken(event.headers.Authorization);
                const { id, number, places, isVip, minOrder } = body;
                if (!id || !number || !places || typeof isVip !== 'boolean') {
                    return response(400, { message: 'Invalid input' });
                }

                const newItem = { id, number, places, isVip };
                if (minOrder !== undefined) newItem.minOrder = minOrder;

                await dynamodb.put({
                    TableName: TABLES_TABLE,
                    Item: newItem
                }).promise();

                return response(200, { id });
            }

            // 5. GET TABLE BY ID
            case 'GET /tables/{tableId}': {
                await validateToken(event.headers.Authorization);
                const { tableId } = event.pathParameters || {};
                if (!tableId) return response(400, { message: 'Missing table ID' });

                const data = await dynamodb.get({
                    TableName: TABLES_TABLE,
                    Key: { id: parseInt(tableId) }
                }).promise();

                return data.Item
                    ? response(200, data.Item)
                    : response(400, { message: 'Table not found' });
            }

            // 6. POST RESERVATION
            case 'POST /reservations': {
                await validateToken(event.headers.Authorization);
                const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = body;
                if (!tableNumber || !clientName || !phoneNumber || !date || !slotTimeStart || !slotTimeEnd) {
                    return response(400, { message: 'Invalid input' });
                }

                const reservationId = uuidv4();
                await dynamodb.put({
                    TableName: RESERVATIONS_TABLE,
                    Item: {
                        id: reservationId,
                        tableNumber,
                        clientName,
                        phoneNumber,
                        date,
                        slotTimeStart,
                        slotTimeEnd
                    }
                }).promise();

                return response(200, { reservationId });
            }

            // 7. GET RESERVATIONS
            case 'GET /reservations': {
                await validateToken(event.headers.Authorization);
                const data = await dynamodb.scan({ TableName: RESERVATIONS_TABLE }).promise();
                return response(200, { reservations: data.Items });
            }
        }
    } catch (err) {
        console.error('Error:', err);
        return response(400, { message: err.message || err });
    }
};
