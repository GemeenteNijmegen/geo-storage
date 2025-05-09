import { KMSClient, GetKeyPolicyCommand, PutKeyPolicyCommand } from '@aws-sdk/client-kms';

interface CloudFrontKmsPolicyEvent {
  ResourceProperties: {
    KeyId: string;
    CloudfrontDistributionArn: string;
    RequestType: 'Create' | 'Update' | 'Delete';
  };
  PhysicalResourceId?: string;
}

interface HandlerResponse {
  PhysicalResourceId: string;
  Data: Record<string, any>;
}

export const handler = async (event: CloudFrontKmsPolicyEvent): Promise<HandlerResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const kmsClient = new KMSClient();
  const {
    KeyId,
    CloudfrontDistributionArn,
    RequestType,
  } = event.ResourceProperties;

  // Skip if this is a delete event
  if (RequestType === 'Delete') {
    return {
      PhysicalResourceId: event.PhysicalResourceId || `kms-policy-${KeyId}`,
      Data: {},
    };
  }

  try {
    // Get the current policy
    const getKeyPolicyCommand = new GetKeyPolicyCommand({
      KeyId: KeyId,
      PolicyName: 'default',
    });
    const currentPolicy = await kmsClient.send(getKeyPolicyCommand);

    console.log('Current policy:', currentPolicy);

    // Parse the policy
    const policy = JSON.parse(currentPolicy.Policy);

    // Check if the policy already has our statement
    const hasStatement = policy.Statement.some(stmt =>
      stmt.Sid === 'AllowCloudfrontToDecryptWithKey' &&
      stmt.Principal &&
      stmt.Principal.Service === 'cloudfront.amazonaws.com',
    );

    if (!hasStatement) {
      // Add our statement
      policy.Statement.push({
        Sid: 'AllowCloudfrontToDecryptWithKey',
        Effect: 'Allow',
        Principal: {
          Service: 'cloudfront.amazonaws.com',
        },
        Action: [
          'kms:Decrypt',
          'kms:DescribeKey',
        ],
        Resource: '*',
        Condition: {
          StringEquals: {
            'AWS:SourceArn': CloudfrontDistributionArn,
          },
        },
      });

      // Update the policy
      const putKeyPolicyCommand = new PutKeyPolicyCommand({
        KeyId: KeyId,
        PolicyName: 'default',
        Policy: JSON.stringify(policy),
      });
      await kmsClient.send(putKeyPolicyCommand);

      console.log('Policy updated successfully');
    } else {
      console.log('Policy already has the required statement');
    }

    return {
      PhysicalResourceId: `kms-policy-${KeyId}`,
      Data: {},
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};