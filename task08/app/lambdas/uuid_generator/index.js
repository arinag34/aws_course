const AWS = require('aws-sdk');

const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.target_bucket;

exports.handler = async () => {
    try {
        const uuids = Array.from({ length: 10 }, () => uuidv4());

        const fileContent = JSON.stringify({ ids: uuids }, null, 4);

        const timestamp = new Date().toISOString();

        const params = {
            Bucket: BUCKET_NAME,
            Key: `${timestamp}`,
            Body: fileContent,
            ContentType: 'application/json'
        };

        await s3.putObject(params).promise();

        console.log(`File saved to S3: ${timestamp}`);

    } catch (error) {
        console.error('Error saving file to S3:', error);
        throw new Error('Failed to save UUIDs to S3');
    }
};
