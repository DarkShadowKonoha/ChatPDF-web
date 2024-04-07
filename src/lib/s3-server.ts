import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

export async function downloadFromS3(file_key: string): Promise<string | null> {
    try {
        AWS.config.update({
            accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY,
        });
        const s3 = new AWS.S3({
            params: {
                Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME,
            },
            region: 'ap-south-1'
        });
        const params = {
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME!,
            Key: file_key,
        };

        const obj = await s3.getObject(params).promise();

        // Create the "tmp" directory if it doesn't exist
        const tmpDir = path.join(__dirname, '..', 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir);
        }

        const file_name = `pdf-${Date.now()}.pdf`;
        const file_path = path.join(tmpDir, file_name);
        fs.writeFileSync(file_path, obj.Body as Buffer);
        
        return file_path;
    } catch (error) {
        console.error(error);
        return null;
    }
}
