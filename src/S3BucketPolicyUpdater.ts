import * as cdk from 'aws-cdk-lib';
import { CustomResource } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface S3BucketPolicyUpdaterProps {
  /**
   * The bucket name to add the policy to
   */
  bucketName: string;

  /**
   * The CloudFront distribution ARN
   */
  cloudfrontDistributionArn: string;
}

/**
 * Custom resource that adds a policy to an S3 bucket allowing CloudFront to access it
 * without overwriting existing policies
 */
export class S3BucketPolicyUpdater extends Construct {
  constructor(scope: Construct, id: string, props: S3BucketPolicyUpdaterProps) {
    super(scope, id);

    // Create a Lambda function that will update the S3 bucket policy
    const updatePolicyFunction = new lambda.Function(this, 'UpdatePolicyFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { S3Client, GetBucketPolicyCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const s3Client = new S3Client();
          const { 
            BucketName, 
            CloudfrontDistributionArn,
            RequestType 
          } = event.ResourceProperties;
          
          // Skip if this is a delete event
          if (RequestType === 'Delete') {
            return {
              PhysicalResourceId: event.PhysicalResourceId || \`s3-policy-\${BucketName}\`,
              Data: {}
            };
          }
          
          try {
            let policy = {
              Version: '2012-10-17',
              Statement: []
            };
            
            // Try to get the current policy
            try {
              const getBucketPolicyCommand = new GetBucketPolicyCommand({
                Bucket: BucketName
              });
              const currentPolicy = await s3Client.send(getBucketPolicyCommand);
              
              console.log('Current policy:', currentPolicy);
              
              // Parse the policy
              if (currentPolicy.Policy) {
                policy = JSON.parse(currentPolicy.Policy);
              }
            } catch (error) {
              // If there's no policy, we'll create one
              if (error.name === 'NoSuchBucketPolicy') {
                console.log('No existing bucket policy, creating a new one');
              } else {
                throw error;
              }
            }
            
            // Check if the policy already has our statement
            const hasStatement = policy.Statement.some(stmt => 
              stmt.Sid === 'AllowCloudfrontToAccessBucket' && 
              stmt.Principal && 
              stmt.Principal.Service === 'cloudfront.amazonaws.com'
            );
            
            if (!hasStatement) {
              // Add our statement
              policy.Statement.push({
                Sid: 'AllowCloudfrontToAccessBucket',
                Effect: 'Allow',
                Principal: {
                  Service: 'cloudfront.amazonaws.com'
                },
                Action: [
                  's3:GetObject',
                  's3:ListBucket'
                ],
                Resource: [
                  \`arn:aws:s3:::\${BucketName}\`,
                  \`arn:aws:s3:::\${BucketName}/*\`
                ],
                Condition: {
                  StringEquals: {
                    'AWS:SourceArn': CloudfrontDistributionArn
                  }
                }
              });
              
              // Update the policy
              const putBucketPolicyCommand = new PutBucketPolicyCommand({
                Bucket: BucketName,
                Policy: JSON.stringify(policy)
              });
              await s3Client.send(putBucketPolicyCommand);
              
              console.log('Policy updated successfully');
            } else {
              console.log('Policy already has the required statement');
            }
            
            return {
              PhysicalResourceId: \`s3-policy-\${BucketName}\`,
              Data: {}
            };
          } catch (error) {
            console.error('Error:', error);
            throw error;
          }
        }
      `),
      timeout: cdk.Duration.minutes(5),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant the Lambda function permissions to manage S3 bucket policies
    updatePolicyFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:GetBucketPolicy',
        's3:PutBucketPolicy',
      ],
      resources: [`arn:aws:s3:::${props.bucketName}`],
    }));

    // Create a provider to handle the custom resource lifecycle
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: updatePolicyFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create a custom resource that will invoke the Lambda function
    new CustomResource(this, 'UpdateS3Policy', {
      serviceToken: provider.serviceToken,
      properties: {
        BucketName: props.bucketName,
        CloudfrontDistributionArn: props.cloudfrontDistributionArn,
      },
    });
  }
}