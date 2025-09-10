import * as crypto from 'crypto';
import {
  aws_cloudwatch as cloudwatch,
  Duration,
  aws_iam as iam,
  aws_kms as kms,
  aws_s3 as s3,
  aws_ssm as ssm,
  Stack,
  StackProps,
  Tags,
} from 'aws-cdk-lib';
import { PolicyStatement, User } from 'aws-cdk-lib/aws-iam';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Configurable, Configuration } from './Configuration';
import { Statics } from './Statics';

export interface StorageStackProps extends Configurable, StackProps { }

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const replicationRoleArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmBackupRoleArn);
    const backupRole = iam.Role.fromRoleArn(this, 'backup-role', replicationRoleArn);
    const sseKey = this.setupKmsSseKey(backupRole);

    const lifecycleRules = [
      this.createLifecycleRule(),
    ];

    const thirdPartyUser = this.setupThirdPartyAccessUser();

    // Setup defined users
    let users: Record<string, User> = {};
    if (props.configuration.users) {
      props.configuration.users.forEach(userId => {
        users[userId] = this.setupUser(userId);
      });
    }

    this.setupInventoryReportsBucket(backupRole);

    const buckets: s3.Bucket[] = [];
    for (const bucketSettings of props.configuration.buckets) {

      const bucket = new s3.Bucket(this, bucketSettings.cdkId, {
        bucketName: bucketSettings.name,
        lifecycleRules: lifecycleRules,
        encryptionKey: sseKey,
        encryption: s3.BucketEncryption.KMS,
        bucketKeyEnabled: true,
        ...bucketSettings.bucketConfiguration,
      });
      Tags.of(bucket).add('Contents', bucketSettings.description);

      // Allow read access to all buckets
      bucket.grantRead(thirdPartyUser);


      // Provide access for defined users
      if (bucketSettings.iamUserAccess) {
        Object.entries(bucketSettings.iamUserAccess).forEach(([userId, rights]) => {
          const user = users[userId];
          if (!user) {
            throw Error(`Undefined user in bucket settings for bucket ${bucketSettings.cdkId}`);
          }
          if (rights == 'r') {
            bucket.grantRead(user);
          } else if (rights == 'w') {
            bucket.grantWrite(user);
          } else if (rights == 'rw') {
            bucket.grantReadWrite(user);
          }
        });
      }


      if (bucketSettings.backupName) {
        const destinationBucketName = bucketSettings.backupName;
        this.setupReplication(
          bucket,
          destinationBucketName,
          replicationRoleArn,
          props.configuration,
        );
      }

      // Stoped inventory reports as we do not need them currently (inventory bucket still exists)
      // this.setupBucketInventoryReport(bucket, inventoryBucket, bucketSettings.name);

      bucket.grantReadWrite(backupRole); // Allow to copy resources to same bucket (changing the KMS key used for sse)
      buckets.push(bucket);

    }

    // If we use grantRead and grantPut methods the policy will be too big
    const bucketArns = buckets.map(bucket => bucket.bucketArn);
    this.setupManagementUser(bucketArns, sseKey.keyArn);

    this.createBucketAccessPolicy(buckets, sseKey);
    this.setupDataDownloadAlarms(buckets);

  }

  setupKmsSseKey(backupRole: iam.IRole) {
    const key = new kms.Key(this, 'bucket-key', {
      description: 'SSE key for geo storage buckets',
      alias: 'geo-storage-sse-key',
    });
    new ssm.StringParameter(this, 'ssm-kmskey-arn', {
      stringValue: key.keyArn,
      parameterName: Statics.ssmGeoStorageKmsKeyArn,
    });

    // Allow lz-platform-operator read rights
    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;

    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowPlatformOperatorToUseKey',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey',
      ],
      resources: ['*'],
      principals: [new iam.AnyPrincipal()],
      conditions: {
        ArnLike: {
          'aws:PrincipalArn': Statics.landingzonePlatformOperatorRoleArn(accountId, region),
        },
      },
    }));
    key.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowBackupRoleToUseKey',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Decrypt',
        'kms:GenerateDataKey',
      ],
      resources: ['*'],
      principals: [new iam.ArnPrincipal(backupRole.roleArn)],
    }));

    return key;
  }

  setupReplication(bucket: s3.IBucket, destinationBucketName: string, backupRoleArn: string, configuration: Configuration) {

    const backupEnvironment = configuration.backupEnvironment;

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
            // accessControlTranslation: { // Disabled as the target buckets enforce ownership by default
            //   owner: 'Destination',
            // },
            account: backupEnvironment.account,
            storageClass: 'DEEP_ARCHIVE', // Move objects to DEEP_ARCHIVE storage tier
            encryptionConfiguration: {
              replicaKmsKeyId: `arn:aws:kms:${backupEnvironment.region}:${backupEnvironment.account}:${Statics.aliasBackupKmsKey}`,
            },
          },
          sourceSelectionCriteria: {
            sseKmsEncryptedObjects: {
              status: 'Enabled', // Replicate objects that are SSE-KMS encrypted
            },
          },
          deleteMarkerReplication: {
            status: 'Disabled', // Prevent deletion for now
          },
        },
      ],
    };
  }

  setupInventoryReportsBucket(backupRole: iam.IRole) {
    // Bucket for storing CSV inventory reports (for use with s3 batch operations)
    const inventoryBucket = new s3.Bucket(this, 'inventory-report-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // Allow backup role to read manifests
    inventoryBucket.grantRead(backupRole);

    // Add policy to allow s3 inventory to put reports
    inventoryBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowInventoryReports',
      actions: [
        's3:PutObject',
      ],
      effect: iam.Effect.ALLOW,
      principals: [
        new iam.ServicePrincipal('s3.amazonaws.com'),
      ],
      resources: [
        `${inventoryBucket.bucketArn}/*`,
      ],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': Stack.of(this).account,
        },
      },
    }));

    return inventoryBucket;
  }

  /**
   * Creates an S3 inventory report for the bucket and stores it
   * in a different bucket. Report can be used for S3 batch operations.
   * @param bucket the bucket to setup an inventory report for
   * @param inventoryBucket the buckets store the reports in
   */
  setupBucketInventoryReport(bucket: s3.Bucket, inventoryBucket: s3.Bucket, bucketName: string) {
    // Do not use bucket.* properties here as it causes jest to crash...
    const cfnBucket = bucket.node.defaultChild as CfnBucket;
    cfnBucket.inventoryConfigurations = [{
      destination: {
        bucketArn: inventoryBucket.bucketArn,
        format: 'CSV',
        prefix: `inventory-${bucketName}`,
      },
      enabled: true,
      id: 'InventoryForBatchOperations',
      includedObjectVersions: 'All',
      scheduleFrequency: 'Daily',
    }];
  }

  /**
   * Create a lifecycle rule that:
   *  - moves objects to the INTELLIGENT_TIERING storage class after 0 days.
   *  - removes non current versions after 7 days.
   * @returns the lifecyle rule
   */
  createLifecycleRule(): s3.LifecycleRule {
    return {
      enabled: true,
      transitions: [{
        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
        transitionAfter: Duration.days(0), // On create
      }],
      noncurrentVersionExpiration: Duration.days(1),
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
            'kms:GenerateDataKey',
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


  setupThirdPartyAccessUser() {
    const user = new iam.User(this, 'third-party-user');
    const key = new iam.AccessKey(this, 'third-part-user-key', {
      user: user,
    });
    new Secret(this, 'third-party-user-secret', {
      secretStringValue: key.secretAccessKey,
    });

    user.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowToListTheBucketsInTheAccount',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListAllMyBuckets'],
      resources: ['*'],
    }));

    return user;
  }

  setupUser(id: string) {
    const user = new iam.User(this, `${id}-user`);
    const key = new iam.AccessKey(this, `${id}-user-key`, {
      user: user,
    });
    new Secret(this, `${id}-user-secret`, {
      secretStringValue: key.secretAccessKey,
    });
    user.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowToListTheBucketsInTheAccount',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListAllMyBuckets'],
      resources: ['*'],
    }));
    return user;
  }

  setupManagementUser(bucketArns: string[], sseKeyArn: string) {
    const user = new iam.User(this, 'management-user');
    const key = new iam.AccessKey(this, 'management-user-key', {
      user: user,
    });
    new Secret(this, 'management-user-secret', {
      secretStringValue: key.secretAccessKey,
    });
    user.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowToListTheBucketsInTheAccount',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListAllMyBuckets'],
      resources: ['*'],
    }));
    user.addToPolicy(new PolicyStatement({
      actions: [
        'kms:Decrypt',
        'kms:DescribeKey',
        'kms:Encrypt',
        'kms:ReEncrypt*',
        'kms:GenerateDataKey*',
      ],
      effect: iam.Effect.ALLOW,
      resources: [sseKeyArn],
    }));

    user.addToPolicy(new PolicyStatement({
      actions: [
        's3:PutObject',
        's3:PutObjectLegalHold',
        's3:PutObjectRetention',
        's3:PutObjectTagging',
        's3:PutObjectVersionTagging',
        's3:Abort*',
        's3:GetObject*',
        's3:GetBucket*',
        's3:List*',
      ],
      effect: iam.Effect.ALLOW,
      resources: [
        ...bucketArns,
        ...bucketArns.map(arn => `${arn}/*`),
      ],
    }));
    return user;
  }

}