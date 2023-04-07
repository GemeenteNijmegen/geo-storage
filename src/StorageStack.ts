import { aws_s3 as s3, Stack, StackProps, Tags, aws_iam as iam, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface StorageStackProps extends Configurable, StackProps {}

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const cycloramaBucket = new s3.Bucket(this, 'cyclorama-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-cyclorama-${props.configuration.branchName}`,
    });
    Tags.of(cycloramaBucket).add('Contents', 'Cyclorama data');

    const obliekBucket = new s3.Bucket(this, 'obliek-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-obliek-${props.configuration.branchName}`,
    });
    Tags.of(obliekBucket).add('Contents', 'Obliek data');

    const orthoBucket = new s3.Bucket(this, 'ortho-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-ortho-${props.configuration.branchName}`,
    });
    Tags.of(orthoBucket).add('Contents', 'Obliek data');

    const lidarAirborneBucket = new s3.Bucket(this, 'lidar-airborne-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-lidar-airborne-${props.configuration.branchName}`,
    });
    Tags.of(lidarAirborneBucket).add('Contents', 'LiDAR airborne data');

    const lidarTerrestrischBucket = new s3.Bucket(this, 'lidar-terrestrisch-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-lidar-terrestrisch-${props.configuration.branchName}`,
    });
    Tags.of(lidarTerrestrischBucket).add('Contents', 'LiDAR terrestrisch data');

    const buckets = [
      cycloramaBucket,
      obliekBucket,
      orthoBucket,
      lidarAirborneBucket,
      lidarTerrestrischBucket,
    ];

    this.createBucketAccessPolicy(buckets);
    this.setupDataMonitoringForBuckets(buckets);

  }

  createBucketAccessPolicy(buckets: s3.IBucket[]) {
    const policy = new iam.ManagedPolicy(this, 'bucket-access-policy', {
      description: 'Allows read/write access to all GEO storage buckets',
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
      ],
    });

    new ssm.StringParameter(this, 'bucket-access-policy-ssm', {
      stringValue: policy.managedPolicyArn,
      parameterName: Statics.ssmGeoBucketsManagedPolicyArn,
    });

  }

  setupDataMonitoringForBuckets(_buckets: s3.IBucket[]) {
    // TODO implement
  }


}