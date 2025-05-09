import * as cdk from 'aws-cdk-lib';
import { CustomResource } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { S3BucketPolicyUpdaterFunction } from './lambda/s3-bucket-policy-updater-function';

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
    const updatePolicyFunction = new S3BucketPolicyUpdaterFunction(this, 'KmsPolicyUpdaterFunction', {
      description: 'Updates the KMS key policy to allow CloudFront to decrypt with it',
      logRetention: logs.RetentionDays.ONE_WEEK,
      timeout: cdk.Duration.minutes(1),
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