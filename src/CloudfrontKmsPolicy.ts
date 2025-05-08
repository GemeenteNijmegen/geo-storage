import * as cdk from 'aws-cdk-lib';
import { CustomResource } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

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
    const updatePolicyFunction = new lambda.Function(this, 'UpdatePolicyFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { KMSClient, GetKeyPolicyCommand, PutKeyPolicyCommand } = require('@aws-sdk/client-kms');
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const kmsClient = new KMSClient();
          const { 
            KeyId, 
            CloudfrontDistributionArn,
            RequestType 
          } = event.ResourceProperties;
          
          // Skip if this is a delete event
          if (RequestType === 'Delete') {
            return {
              PhysicalResourceId: event.PhysicalResourceId || \`kms-policy-\${KeyId}\`,
              Data: {}
            };
          }
          
          try {
            // Get the current policy
            const getKeyPolicyCommand = new GetKeyPolicyCommand({
              KeyId: KeyId,
              PolicyName: 'default'
            });
            const currentPolicy = await kmsClient.send(getKeyPolicyCommand);
            
            console.log('Current policy:', currentPolicy);
            
            // Parse the policy
            const policy = JSON.parse(currentPolicy.Policy);
            
            // Check if the policy already has our statement
            const hasStatement = policy.Statement.some(stmt => 
              stmt.Sid === 'AllowCloudfrontToDecryptWithKey' && 
              stmt.Principal && 
              stmt.Principal.Service === 'cloudfront.amazonaws.com'
            );
            
            if (!hasStatement) {
              // Add our statement
              policy.Statement.push({
                Sid: 'AllowCloudfrontToDecryptWithKey',
                Effect: 'Allow',
                Principal: {
                  Service: 'cloudfront.amazonaws.com'
                },
                Action: [
                  'kms:Decrypt',
                  'kms:DescribeKey'
                ],
                Resource: '*',
                Condition: {
                  StringEquals: {
                    'AWS:SourceArn': CloudfrontDistributionArn
                  }
                }
              });
              
              // Update the policy
              const putKeyPolicyCommand = new PutKeyPolicyCommand({
                KeyId: KeyId,
                PolicyName: 'default',
                Policy: JSON.stringify(policy)
              });
              await kmsClient.send(putKeyPolicyCommand);
              
              console.log('Policy updated successfully');
            } else {
              console.log('Policy already has the required statement');
            }
            
            return {
              PhysicalResourceId: \`kms-policy-\${KeyId}\`,
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