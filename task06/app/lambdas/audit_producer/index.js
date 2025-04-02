const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const docClient = new AWS.DynamoDB.DocumentClient();

const auditTableName = process.env.table_name;

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        if (record.eventName === 'INSERT') {
            const newItem = record.dynamodb.NewImage;
            const auditEntry = {
                id: uuidv4(),
                itemKey: newItem.key.S,
                modificationTime: new Date().toISOString(),
                newValue: {
                    key: newItem.key.S,
                    value: parseInt(newItem.value.N)
                }
            };
            await putAuditItem(auditEntry);
        } else if (record.eventName === 'MODIFY') {
            const oldItem = record.dynamodb.OldImage;
            const newItem = record.dynamodb.NewImage;

            if (oldItem.value.N !== newItem.value.N) {
                const auditEntry = {
                    id: uuidv4(),
                    itemKey: newItem.key.S,
                    modificationTime: new Date().toISOString(),
                    updatedAttribute: "value",
                    oldValue: parseInt(oldItem.value.N),
                    newValue: parseInt(newItem.value.N)
                };
                await putAuditItem(auditEntry);
            }
        }
    }

    return { statusCode: 200, body: JSON.stringify('Successfully processed DynamoDB stream events.') };
};

const putAuditItem = async (auditEntry) => {
    const params = {
        TableName: auditTableName,
        Item: auditEntry
    };
    try {
        await docClient.put(params).promise();
        console.log('Audit entry added:', auditEntry);
    } catch (error) {
        console.error('Error inserting audit entry:', error);
        throw new Error('Error inserting audit entry');
    }
};
