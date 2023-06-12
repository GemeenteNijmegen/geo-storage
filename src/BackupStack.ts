import {
  Stack,
  StackProps,
  aws_s3 as s3,
  aws_iam as iam,
  Tags,
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

    for (const bucketSettings of props.configuration.buckets) {

      if (!bucketSettings.backupName) {
        // Only create buckets that are backedup!
        continue;
      }

      const bucket = new s3.Bucket(this, bucketSettings.cdkId, {
        bucketName: bucketSettings.backupName,
        lifecycleRules: undefined, // TODO check if needed or can be done using storage class
        ...bucketSettings.bucketConfiguration,
        encryption: s3.BucketEncryption.S3_MANAGED,
      });
      Tags.of(bucket).add('Contents', `${bucketSettings.description} backup`);

      bucket.grantReadWrite(replicationRole);

      this.allowReplicationToBucket(bucket, replicationRoleArn);

    }

  }

  allowReplicationToBucket(bucket: s3.Bucket, replicationRoleArn: string) {

    // allow the objects in the bucket to be replicated or deleted
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Set permissions for Objects',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(replicationRoleArn)],
        actions: ['s3:ReplicateObject', 's3:ReplicateDelete'],
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
          's3:ObjectOwnerOverrideToBucketOwner',
          's3:ReplicateTags',
          's3:GetObjectVersionTagging',
        ],
        resources: [`${bucket.bucketArn}/*`],
      }),
    );

  }

}