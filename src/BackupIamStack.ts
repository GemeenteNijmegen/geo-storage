import {
  Stack,
  StackProps,
  aws_iam as iam,
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface BackupIamStackProps extends Configurable, StackProps { }

export class BackupIamStack extends Stack {

  constructor(scope: Construct, id: string, props: BackupIamStackProps) {
    super(scope, id, props);

    const sourceBucketArns = props.configuration.buckets.filter(bucket => bucket.backupName).map(bucket => `arn:aws:s3:::${bucket.name}`);
    const backupBucketArns = props.configuration.buckets.filter(bucket => bucket.backupName).map(bucket => `arn:aws:s3:::${bucket.name}`);
    const sourceBucketContents = sourceBucketArns.map(arn => `${arn}/*`);
    const backupBucketContents = backupBucketArns.map(arn => `${arn}/*`);

    const role = new iam.Role(this, 'backup-role', {
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com'),
      description: 'Role used for replication objects in the geo buckets to the backup account',
    });

    // Also allow batch replication
    role.grantAssumeRole(new iam.ServicePrincipal('batchoperations.s3.amazonaws.com'));

    const crossAccountReplicationRolePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowGetObjectData',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket',
            's3:GetReplicationConfiguration',
            's3:GetObjectVersionForReplication',
            's3:GetObjectVersionAcl',
            's3:GetObjectVersionTagging',
            's3:GetObjectRetention',
            's3:GetObjectLegalHold',
          ],
          resources: sourceBucketArns.concat(backupBucketArns, sourceBucketContents, backupBucketContents),
        }),
        new iam.PolicyStatement({
          sid: 'AllowReplicateObjects',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ReplicateObject',
            's3:ReplicateDelete',
            's3:ReplicateTags',
            's3:ObjectOwnerOverrideToBucketOwner',
          ],
          resources: sourceBucketContents.concat(backupBucketContents),
        }),
      ],
    });

    // Attatch the policy to the role
    const policy = new iam.Policy(this, 'policy', {
      document: crossAccountReplicationRolePolicy,
    });
    role.attachInlinePolicy(policy);

    // Export role arn
    new ssm.StringParameter(this, 'ssm-backup-role-arn', {
      stringValue: role.roleArn,
      parameterName: Statics.ssmBackupRoleArn,
    });


  }

}