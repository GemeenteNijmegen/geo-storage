import {
  Stack,
  StackProps,
  aws_s3 as s3,
  aws_kms as kms,
  aws_iam as iam,
  Tags,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface BackupStackProps extends Configurable, StackProps {}

export class BackupStack extends Stack {

  constructor(scope: Construct, id: string, props: BackupStackProps) {
    super(scope, id, props);

    // Construct the role arn from the different account
    // Note: uses name as we do not want to get into cross-account parameters.
    const sourceAccount = props.configuration.targetEnvironment.account;
    const replicationRoleArn = `arn:aws:iam::${sourceAccount}:role/${Statics.backupRoleName}`;
    const replicationRole = iam.Role.fromRoleArn(this, 'replication-role', replicationRoleArn);

    const lifecycleRules = [
      this.createLifecycleRule(),
    ];


    const sseKey = this.setupKmsKeyForBackupBuckets(props);

    for (const bucketSettings of props.configuration.buckets) {

      if (!bucketSettings.backupName) {
        // Only create buckets that are backedup!
        continue;
      }

      const bucket = new s3.Bucket(this, bucketSettings.cdkId, {
        bucketName: bucketSettings.backupName,
        lifecycleRules: lifecycleRules,
        ...bucketSettings.bucketConfiguration,
        encryption: s3.BucketEncryption.KMS,
        encryptionKey: sseKey,
      });
      Tags.of(bucket).add('Contents', `${bucketSettings.description} backup`);

      bucket.grantReadWrite(replicationRole);

      this.allowReplicationToBucket(bucket, replicationRoleArn, props);

    }

  }

  setupKmsKeyForBackupBuckets(props: BackupStackProps) {
    const key = new kms.Key(this, 'backup-sse-key', {
      description: 'Key for S3 backup buckets SSE',
      alias: Statics.aliasBackupKmsKey,
    });

    key.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey', 'kms:GenerateDataKey*'],
        resources: ['*'],
        principals: [new iam.ArnPrincipal(`arn:aws:iam::${props.configuration.targetEnvironment.account}:role/${Statics.backupRoleName}`)],
      }),
    );

    return key;
  }

  /**
   * Create a lifecycle rule that:
   *  - removes non current versions after 7 days.
   * @returns the lifecyle rule
   */
  createLifecycleRule(): s3.LifecycleRule {
    return {
      enabled: true,
      noncurrentVersionExpiration: Duration.days(7),
    };
  }

  allowReplicationToBucket(bucket: s3.Bucket, replicationRoleArn: string, props: BackupStackProps) {

    // allow the objects in the bucket to be replicated or deleted
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Set permissions for Objects',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(replicationRoleArn)],
        actions: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
        ],
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

    // allow the objects in the bucket to change owner
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowChangeOwnershipOfAccounts',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountPrincipal(props.configuration.targetEnvironment.account)],
        actions: ['s3:ObjectOwnerOverrideToBucketOwner'],
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

    // allow the files in the bucket to be listed or versioned
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Set permissions on bucket',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(replicationRoleArn)],
        actions: [
          's3:List*',
          's3:GetBucketVersioning',
          's3:PutBucketVersioning',
        ],
        resources: [bucket.bucketArn],
      }),
    );

    // allows the ownership to change from the source bucket to the destination bucket
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Allow ownership change',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(replicationRoleArn)],
        actions: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
          's3:ReplicateTags',
          's3:GetObjectVersionTagging',
        ],
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

  }

}