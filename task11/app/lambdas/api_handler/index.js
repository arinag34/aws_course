const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

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

    const client = jwksClient({
        jwksUri: `https://cognito-idp.${process.env.region}.amazonaws.com/${USERS_POOL_ID}/.well-known/jwks.json`
    });

    function getKey(header, callback) {
        client.getSigningKey(header.kid, function (err, key) {
            const signingKey = key.getPublicKey();
            callback(null, signingKey);
        });
    }

    async function validateToken(authHeader) {
        if (!authHeader) throw 'Unauthorized';
        const token = authHeader.split(' ')[1];
        return await new Promise((resolve, reject) => {
            jwt.verify(token, getKey, {
                audience: USERS_CLIENT_ID,
                issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${USERS_POOL_ID}`,
                algorithms: ['RS256']
            }, (err, decoded) => {
                if (err) return reject('Unauthorized');
                resolve(decoded);
            });
        });
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
            await validateToken(event.headers.Authorization);
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

            const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = body;

            const tableCheck = await dynamodb.scan({
                TableName: TABLES_TABLE,
                FilterExpression: '#number = :number',
                ExpressionAttributeNames: { '#number': 'number' },
                ExpressionAttributeValues: { ':number': tableNumber }
            }).promise();

            if (!tableCheck.Items || tableCheck.Items.length === 0) {
                return response(400, { message: 'Table not found' });
            }

            const reservationsCheck = await dynamodb.scan({
                TableName: RESERVATIONS_TABLE,
                FilterExpression: 'tableNumber = :tableNumber AND #date = :date',
                ExpressionAttributeNames: { '#date': 'date' },
                ExpressionAttributeValues: {
                    ':tableNumber': tableNumber,
                    ':date': date
                }
            }).promise();

            const overlaps = reservationsCheck.Items.some(r => {
                const existingStart = r.slotTimeStart;
                const existingEnd = r.slotTimeEnd;

                return !(slotTimeEnd <= existingStart || slotTimeStart >= existingEnd);
            });

            if (overlaps) {
                return response(400, { message: 'Overlapping reservation exists' });
            }

            const reservationId = uuidv4();
            const item = {
                id: reservationId,
                tableNumber,
                clientName,
                phoneNumber,
                date,
                slotTimeStart,
                slotTimeEnd
            };

            await dynamodb.put({
                TableName: RESERVATIONS_TABLE,
                Item: item
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
