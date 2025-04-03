import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: process.env.region });
const BUCKET_NAME = process.env.target_bucket;

export const handler = async () => {
    try {
        const ids = Array.from({ length: 10 }, () => uuidv4());

        const fileName = `${new Date().toISOString()}`;

        const fileContent = JSON.stringify({ ids }, null, 4);

        const putObjectCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: fileContent,
            ContentType: "application/json",
        });

        await s3.send(putObjectCommand);

        console.log(`File ${fileName} uploaded successfully to ${BUCKET_NAME}`);
    } catch (error) {
        console.error("Error uploading file to S3:", error);
    }
};
