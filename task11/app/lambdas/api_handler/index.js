const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Инициализация
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamo = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.cup_id;
const CLIENT_ID = process.env.cup_client_id;

const TABLES_TABLE = process.env.tables_table;
const RESERVATIONS_TABLE = process.env.reservations_table;

exports.handler = async (event) => {
    const path = event?.path;
    const httpMethod = event?.method;
    const body = event?.body;
    const headers = event?.headers;
    const parsedBody = body ? JSON.parse(body) : null;

    try {
        // === SIGNUP ===
        if (path === '/signup' && httpMethod === 'POST') {
            const { firstName, lastName, email, password } = parsedBody;

            const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            const isValidPassword = (password) => /^[A-Za-z0-9$%^*\-_]{12,}$/.test(password);

            if (!email || !isValidEmail(email)) {
                return response(400, 'Invalid email');
            }

            if (!password || !isValidPassword(password)) {
                return response(400, 'Invalid password');
            }

            try {
                await cognito.adminCreateUser({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    TemporaryPassword: password,
                    MessageAction: 'SUPPRESS',
                    UserAttributes: [
                        { Name: 'email', Value: email },
                        { Name: 'given_name', Value: firstName },
                        { Name: 'family_name', Value: lastName }
                    ]
                }).promise();

                await cognito.adminSetUserPassword({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    Password: password,
                    Permanent: true
                }).promise();

                return response(200, { message: 'User created' });
            } catch (err) {
                console.error(err);
                return response(400, 'User creation failed');
            }
        }

            // === SIGNIN ===
        if (path === '/signin' && httpMethod === 'POST') {
            const { email, password } = parsedBody;

            try {
                const authResult = await cognito.initiateAuth({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    ClientId: CLIENT_ID,
                    AuthParameters: {
                        USERNAME: email,
                        PASSWORD: password
                    }
                }).promise();

                return response(200, { idToken: authResult.AuthenticationResult.IdToken });
            } catch (err) {
                console.error(err);
                return response(400, 'Sign-in failed');
            }
        }

        // === AUTHORIZED ROUTES ===
        const token = headers?.Authorization?.split(' ')[1];
        if (!token) return response(400, 'Missing Authorization token');

        // === TABLES ===
        if (path === '/tables' && httpMethod === 'GET') {
            const result = await dynamo.scan({ TableName: TABLES_TABLE }).promise();
            return response(200, { tables: result.Items });
        }

        if (path === '/tables' && httpMethod === 'POST') {
            const table = parsedBody;
            await dynamo.put({ TableName: TABLES_TABLE, Item: table }).promise();
            return response(200, { id: table.id });
        }

        const tableIdMatch = path.match(/^\/tables\/(\d+)$/);
        if (tableIdMatch && httpMethod === 'GET') {
            const id = parseInt(tableIdMatch[1]);
            const result = await dynamo.get({ TableName: TABLES_TABLE, Key: { id } }).promise();
            if (!result.Item) return response(400, 'Table not found');
            return response(200, result.Item);
        }

        // === RESERVATIONS ===
        if (path === '/reservations' && httpMethod === 'POST') {
            const reservation = {
                id: uuidv4(),
                ...parsedBody
            };
            await dynamo.put({ TableName: RESERVATIONS_TABLE, Item: reservation }).promise();
            return response(200, { id: reservation.id });
        }

        if (path === '/reservations' && httpMethod === 'GET') {
            const result = await dynamo.scan({ TableName: RESERVATIONS_TABLE }).promise();
            return response(200, { reservations: result.Items });
        }

        return response(400, 'Invalid route');
    } catch (err) {
        console.error(err);
        return response(400, err.message || 'Internal error');
    }
};

// ==== UTILS ====
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(typeof body === 'string' ? { message: body } : body)
});
