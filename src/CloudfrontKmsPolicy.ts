import * as cdk from 'aws-cdk-lib';
import { CustomResource } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { KmsPolicyUpdaterFunction } from './lambda/kms-policy-updater-function';

export interface CloudfrontKmsPolicyProps {
  /**
   * The KMS key to add the policy to
   */
  kmsKey: kms.IKey;

  /**
   * The CloudFront distribution ARN
   */
  cloudfrontDistributionArn: string;
}

/**
 * Custom resource that adds a policy to a KMS key allowing CloudFront to decrypt with it
 * Importing the key in another stack and changing the policy doesn't work
 */
export class CloudfrontKmsPolicy extends Construct {
  constructor(scope: Construct, id: string, props: CloudfrontKmsPolicyProps) {
    super(scope, id);

    // Create a Lambda function that will update the KMS key policy
    const updatePolicyFunction = new KmsPolicyUpdaterFunction(this, 'KmsPolicyUpdaterFunction', {
      description: 'Updates the KMS key policy to allow CloudFront to decrypt with it',
      logRetention: logs.RetentionDays.ONE_WEEK,
      timeout: cdk.Duration.minutes(1),
    });

    // Grant the Lambda function permissions to manage KMS key policies
    props.kmsKey.grant(updatePolicyFunction, 'kms:GetKeyPolicy', 'kms:PutKeyPolicy');

    // Create a provider to handle the custom resource lifecycle
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: updatePolicyFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create a custom resource that will invoke the Lambda function
    new CustomResource(this, 'UpdateKmsPolicy', {
      serviceToken: provider.serviceToken,
      properties: {
        KeyId: props.kmsKey.keyId,
        CloudfrontDistributionArn: props.cloudfrontDistributionArn,
      },
    });
  }
}