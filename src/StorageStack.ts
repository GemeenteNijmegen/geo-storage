import * as crypto from 'crypto';
import {
  aws_s3 as s3,
  Stack,
  StackProps,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_cloudwatch as cloudwatch,
  Duration,
  Tags,
} from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface StorageStackProps extends Configurable, StackProps {}

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const replicationRoleArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmBackupRoleArn);
    const backupRole = iam.Role.fromRoleArn(this, 'backup-role', replicationRoleArn);

    const moveToInteligentStorageTier = [
      this.createInteligentTieringLifecycleRule(),
    ];

    // User for accessing the bucket
    const user = new iam.User(this, 'aanbesteding-user', {
      userName: 'aanbesteding-user',
    });

    const buckets: s3.Bucket[] = [];
    for (const bucketSettings of props.configuration.buckets) {

      const bucket = new s3.Bucket(this, bucketSettings.cdkId, {
        bucketName: bucketSettings.name,
        lifecycleRules: moveToInteligentStorageTier,
        ...bucketSettings.bucketConfiguration,
      });
      Tags.of(bucket).add('Contents', bucketSettings.description);

      if (bucketSettings.setupAccessForIamUser) {
        bucket.grantRead(user);
      }

      // if (bucketSettings.backupName) {
      //   const destinationBucketName = bucketSettings.backupName;
      //   const destinationAccount = props.configuration.backupEnvironment.account;
      //   const crossAccount = destinationAccount !== props.configuration.targetEnvironment.account;
      //   this.setupReplication(bucket, destinationBucketName, destinationAccount, replicationRoleArn, crossAccount);
      // }

      bucket.grantReadWrite(backupRole);

      buckets.push(bucket);
    }

    this.createBucketAccessPolicy(buckets);
    this.setupDataDownloadAlarms(buckets);

  }

  setupReplication(bucket: s3.IBucket, destinationBucketName: string, destinationAccount: string, backupRoleArn: string, crossAccount: boolean) {
    const cfnBucket = bucket.node.defaultChild as CfnBucket;
    cfnBucket.replicationConfiguration = {
      role: backupRoleArn,
      rules: [
        {
          id: 'CrossAccountBackupReplicationRule',
          priority: 1,
          filter: {},
          status: 'Enabled',
          destination: {
            bucket: `arn:aws:s3:::${destinationBucketName}`,
            accessControlTranslation: crossAccount ? {
              owner: 'Destination',
            } : undefined,
            account: crossAccount ? destinationAccount : undefined,
            storageClass: 'DEEP_ARCHIVE',
          },
          deleteMarkerReplication: {
            status: 'Disabled', // Prevent deletion for now
          },
        },
      ],
    };
  }

  createInteligentTieringLifecycleRule(): s3.LifecycleRule {
    return {
      enabled: true,
      transitions: [{
        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
        transitionAfter: Duration.days(0), // On create
      }],
    };
  }

  createBucketAccessPolicy(buckets: s3.IBucket[]) {
    const policy = new iam.ManagedPolicy(this, 'bucket-access-policy', {
      description: 'Allows read/write access to all GEO storage buckets',
      managedPolicyName: Statics.geoStorageOperatorrManagedPolicyName,
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowListBucketOnGeoBuckets',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket',
          ],
          resources: buckets.map(b => b.bucketArn),
        }),
        new iam.PolicyStatement({
          sid: 'AllowToManageObjectsInGeoBuckets',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:*Object', // Allow get, delete and put
          ],
          resources: buckets.map(b => b.bucketArn + '/*'),
        }),
        new iam.PolicyStatement({
          sid: 'AllowToListBuckets',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListAllMyBuckets',
          ],
          resources: ['*'],
        }),
      ],
    });

    new ssm.StringParameter(this, 'bucket-access-policy-ssm', {
      stringValue: policy.managedPolicyArn,
      parameterName: Statics.ssmGeoBucketsManagedPolicyArn,
    });

  }

  setupDataDownloadAlarms(buckets: s3.Bucket[]) {

    buckets.forEach(bucket => {
      // Enable download metric on bucket
      bucket.addMetric({
        id: 'BytesDownloaded',
      });

      // Use bucket.node.id as a dirty trick to get the buckets cdk id and hash it
      const cdkId = crypto.createHash('md5').update(bucket.node.id).digest('hex').substring(0, 7);

      // Setup alarm on download metric
      // For now use 1 GB / 12h to alarm
      new cloudwatch.Alarm(this, `s3-downloads-alarm-${cdkId}`, {
        alarmDescription: 'Alarm when a lot of data is downloaded from the storage buckets in this account.',
        metric: new cloudwatch.Metric({
          metricName: 'BytesDownloaded',
          namespace: 'AWS/S3',
          statistic: 'sum',
          period: Duration.hours(1),
          dimensionsMap: {
            BucketName: bucket.bucketName,
            FilterId: 'BytesDownloaded',
          },
        }),
        threshold: 1000000000, // 1GB in bytes
        evaluationPeriods: 12, // AWS metric in standard resolution is 1m periods (but this is in days?)
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    });
  }

}