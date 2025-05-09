import { S3Client, GetBucketPolicyCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';

interface CloudFrontS3PolicyEvent {
  ResourceProperties: {
    BucketName: string;
    CloudfrontDistributionArn: string;
    RequestType: 'Create' | 'Update' | 'Delete';
  };
  PhysicalResourceId?: string;
}

interface HandlerResponse {
  PhysicalResourceId: string;
  Data: Record<string, any>;
}

export const handler = async (event: CloudFrontS3PolicyEvent): Promise<HandlerResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const s3Client = new S3Client();
  const {
    BucketName,
    CloudfrontDistributionArn,
    RequestType,
  } = event.ResourceProperties;

  // Skip if this is a delete event
  if (RequestType === 'Delete') {
    return {
      PhysicalResourceId: event.PhysicalResourceId || `s3-policy-${BucketName}`,
      Data: {},
    };
  }

  try {
    let policy = {
      Version: '2012-10-17',
      Statement: [],
    };

    // Try to get the current policy
    try {
      const getBucketPolicyCommand = new GetBucketPolicyCommand({
        Bucket: BucketName,
      });
      const currentPolicy = await s3Client.send(getBucketPolicyCommand);

      console.log('Current policy:', currentPolicy);

      // Parse the policy
      if (currentPolicy.Policy) {
        policy = JSON.parse(currentPolicy.Policy);
      }
    } catch (error: any) {
      // If there's no policy, we'll create one
      if (error.name === 'NoSuchBucketPolicy') {
        console.log('No existing bucket policy, creating a new one');
      } else {
        throw error;
      }
    }

    // Check if the policy already has our statement
    const hasStatement = policy.Statement.some((stmt: any) =>
      stmt.Sid === 'AllowCloudfrontToAccessBucket' &&
      stmt.Principal &&
      stmt.Principal.Service === 'cloudfront.amazonaws.com',
    );

    if (!hasStatement) {
      // Add our statement
      policy.Statement.push({
        Sid: 'AllowCloudfrontToAccessBucket',
        Effect: 'Allow',
        Principal: {
          Service: 'cloudfront.amazonaws.com',
        },
        Action: [
          's3:GetObject',
          's3:ListBucket',
        ],
        Resource: [
          `arn:aws:s3:::${BucketName}`,
          `arn:aws:s3:::${BucketName}/*`,
        ],
        Condition: {
          StringEquals: {
            'AWS:SourceArn': CloudfrontDistributionArn,
          },
        },
      });

      // Update the policy
      const putBucketPolicyCommand = new PutBucketPolicyCommand({
        Bucket: BucketName,
        Policy: JSON.stringify(policy),
      });
      await s3Client.send(putBucketPolicyCommand);

      console.log('Policy updated successfully');
    } else {
      console.log('Policy already has the required statement');
    }

    return {
      PhysicalResourceId: `s3-policy-${BucketName}`,
      Data: {},
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};