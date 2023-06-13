import * as crypto from 'crypto';
import {
  aws_s3 as s3,
  Stack,
  StackProps,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_cloudwatch as cloudwatch,
  aws_kms as kms,
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
    const sseKey = this.setupKmsSseKey();

    const moveToInteligentStorageTier = [
      this.createInteligentTieringLifecycleRule(),
      this.createRemoveOldVersionLifecycleRule(),
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
        encryptionKey: sseKey,
        encryption: s3.BucketEncryption.KMS,
        bucketKeyEnabled: true,
        ...bucketSettings.bucketConfiguration,
      });
      Tags.of(bucket).add('Contents', bucketSettings.description);

      if (bucketSettings.setupAccessForIamUser) {
        bucket.grantRead(user);
      }

      if (bucketSettings.backupName) {
        const destinationBucketName = bucketSettings.backupName;
        const destinationAccount = props.configuration.backupEnvironment.account;
        this.setupReplication(bucket, destinationBucketName, destinationAccount, replicationRoleArn);
      }

      bucket.grantRead(backupRole);
      buckets.push(bucket);
    }

    this.createBucketAccessPolicy(buckets, sseKey);
    this.setupDataDownloadAlarms(buckets);

  }

  setupKmsSseKey() {
    const key = new kms.Key(this, 'bucket-key', {
      description: 'SSE key for geo storage buckets',
      alias: 'geo-storage-sse-key',
    });

    // Allow lz-platform-operator read rights
    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;
    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowPlatformOperatorToUseKey',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey*',
      ],
      principals: [new iam.AnyPrincipal()],
      conditions: {
        ArnLike: {
          'aws:PrincipalArn': Statics.landingzonePlatformOperatorRoleArn(accountId, region),
        },
      },
    }));

    return key;
  }

  setupReplication(bucket: s3.IBucket, destinationBucketName: string, destinationAccount: string, backupRoleArn: string) {
    const cfnBucket = bucket.node.defaultChild as CfnBucket;
    cfnBucket.replicationConfiguration = {
      role: backupRoleArn,
      rules: [
        {
          id: 'CrossAccountBackupReplicationRule',
          priority: 0,
          filter: {
            prefix: '',
          },
          status: 'Enabled',
          destination: {
            bucket: `arn:aws:s3:::${destinationBucketName}`,
            accessControlTranslation: {
              owner: 'Destination',
            },
            account: destinationAccount,
            storageClass: 'DEEP_ARCHIVE',
          },
          deleteMarkerReplication: {
            status: 'Disabled', // Prevent deletion for now
          },
        },
      ],
    };
  }

  /**
   * Create a lifecycle rule that moves objects to the INTELLIGENT_TIERING
   * storage class after 0 days.
   * @returns the lifecyle rule
   */
  createInteligentTieringLifecycleRule(): s3.LifecycleRule {
    return {
      enabled: true,
      transitions: [{
        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
        transitionAfter: Duration.days(0), // On create
      }],
    };
  }

  /**
   * Create a lifecycle rule that removes non current versions
   * after 7 days.
   * @returns the lifecylce rule
   */
  createRemoveOldVersionLifecycleRule(): s3.LifecycleRule {
    return {
      enabled: true,
      noncurrentVersionExpiration: Duration.days(7),
    };
  }

  createBucketAccessPolicy(buckets: s3.IBucket[], key: kms.Key) {
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
        new iam.PolicyStatement({
          sid: 'AllowKmsKeyForBucket',
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Encrypt',
            'kms:Decrypt',
            'kms:ReEncrypt*',
            'kms:GenerateDataKey*',
            'kms:DescribeKey',
          ],
          resources: [key.keyArn],
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