const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USERS_POOL_ID = process.env.cup_id;
const USERS_CLIENT_ID = process.env.cup_client_id;
const TABLES_TABLE = process.env.tables_table;
const RESERVATIONS_TABLE = process.env.reservations_table;

exports.handler = async (event) => {
    const path = event?.path;
    const method = event?.httpMethod
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = {
        'Content-Type': 'application/json'
    };
    console.log(`PATH: ${path}, METHOD: ${method}, BODY: ${JSON.stringify(body)}`);

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
        const result = await cognito.getUser({ AccessToken: token }).promise().catch(() => null);
        if (!result) throw 'Unauthorized';
        return result;
    }

    try {
        if (method === 'POST' && path === '/signup') {
            const { firstName, lastName, email, password } = body;

            if (
                !email ||
                !password ||
                password.length < 12 ||
                !/^[A-Za-z0-9$%^*\-_]+$/.test(password)
            ) {
                return response(400, { message: 'Invalid input' });
            }

            await cognito.adminCreateUser({
                UserPoolId: USERS_POOL_ID,
                Username: email,
                UserAttributes: [
                    { Name: 'email', Value: email },
                    { Name: 'email_verified', Value: 'true' },
                    { Name: 'given_name', Value: firstName },
                    { Name: 'family_name', Value: lastName }
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

        if (method === 'POST' && path === '/signin') {
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

        if (method === 'GET' && path === '/tables') {
            await validateToken(event.headers.Authorization);

            const data = await dynamodb.scan({ TableName: TABLES_TABLE }).promise();
            return response(200, { tables: data.Items });
        }

        if (method === 'POST' && path === '/tables') {
            await validateToken(`Bearer ${event.headers.Authorization}`);
            console.log(`TOKEN: ${event.headers.Authorization}`);
            const { id, number, places, isVip, minOrder } = body;

            if (
                typeof id !== 'number' ||
                typeof number !== 'number' ||
                typeof places !== 'number' ||
                typeof isVip !== 'boolean'
            ) {
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

        if (method === 'GET' && path.match(/^\/tables\/\d+$/)) {
            await validateToken(event.headers.Authorization);
            const tableId = parseInt(path.split('/')[2]);

            const data = await dynamodb.get({
                TableName: TABLES_TABLE,
                Key: { id: tableId }
            }).promise();

            return data.Item
                ? response(200, data.Item)
                : response(400, { message: 'Table not found' });
        }

        if (method === 'POST' && path === '/reservations') {
            await validateToken(event.headers.Authorization);

            const {
                tableNumber,
                clientName,
                phoneNumber,
                date,
                slotTimeStart,
                slotTimeEnd
            } = body;

            if (
                !tableNumber || !clientName || !phoneNumber ||
                !date || !slotTimeStart || !slotTimeEnd
            ) {
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

        if (method === 'GET' && path === '/reservations') {
            await validateToken(event.headers.Authorization);

            const data = await dynamodb.scan({ TableName: RESERVATIONS_TABLE }).promise();
            return response(200, { reservations: data.Items });
        }

        return response(400, { message: `Unsupported route DEFAULT ${path} ${method}` });

    } catch (err) {
        console.error('Error:', err);
        return response(400, { message: err.message || err });
    }
};
