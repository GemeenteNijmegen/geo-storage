import * as crypto from 'crypto';
import {
  aws_s3 as s3,
  Stack,
  StackProps,
  Tags,
  aws_iam as iam,
  aws_ssm as ssm,
  aws_ec2 as ec2,
  aws_cloudwatch as cloudwatch,
  Fn,
  Aws,
  Duration,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface StorageStackProps extends Configurable, StackProps { }

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // Note no need to use inteligentTieringConfiguration (see https://github.com/aws/aws-cdk/issues/20937)
    // Instead supply a lifecycle rule that moves objects on creation to the Inteligent tiering storage class
    // const optimalGeoStorage = this.createInteligentTieringConfigurations();

    const moveToInteligentStorageTier = this.createInteligentTieringLifecycleRule();

    const cycloramaBucket = new s3.Bucket(this, 'cyclorama-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-cyclorama-${props.configuration.branchName}`,
      lifecycleRules: [moveToInteligentStorageTier],
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    Tags.of(cycloramaBucket).add('Contents', 'Cyclorama data');

    const obliekBucket = new s3.Bucket(this, 'obliek-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-obliek-${props.configuration.branchName}`,
      lifecycleRules: [moveToInteligentStorageTier],
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    Tags.of(obliekBucket).add('Contents', 'Obliek data');

    const orthoBucket = new s3.Bucket(this, 'ortho-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-ortho-${props.configuration.branchName}`,
      lifecycleRules: [moveToInteligentStorageTier],
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    Tags.of(orthoBucket).add('Contents', 'Obliek data');

    const lidarAirborneBucket = new s3.Bucket(this, 'lidar-airborne-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-lidar-airborne-${props.configuration.branchName}`,
      lifecycleRules: [moveToInteligentStorageTier],
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    Tags.of(lidarAirborneBucket).add('Contents', 'LiDAR airborne data');

    const lidarTerrestrischBucket = new s3.Bucket(this, 'lidar-terrestrisch-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: `gemeentenijmegen-geo-lidar-terrestrisch-${props.configuration.branchName}`,
      lifecycleRules: [moveToInteligentStorageTier],
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
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

    if (props.configuration.deployEc2MigrationInstance) {
      this.setupEc2MigrationInstance(cycloramaBucket);
    }

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

  setupDataMonitoringForBuckets(buckets: s3.Bucket[]) {

    buckets.forEach(bucket => {
      // Enable download metric on bucket
      bucket.addMetric({
        id: 'BytesDownloaded',
      });
      // Setup alarm on download metric
      // For now use 1 GB / 12h to alarm
      const cdkId = crypto.createHash('md5').update(bucket.bucketName).digest('hex').substring(0, 7);
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


  setupEc2MigrationInstance(cycloramaBucket: s3.IBucket) {

    // Import vpc config (only public and private subnets)
    const vpcId = ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/vpc-id');
    const availabilityZones = [0, 1, 2].map(i => Fn.select(i, Fn.getAzs(Aws.REGION)));
    const publicSubnetRouteTableIds = Array(3).fill(ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/route-table-public-subnets-id'));
    const privateSubnetRouteTableIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/route-table-private-subnet-${i}-id`));
    const publicSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/public-subnet-${i}-id`));
    const privateSubnetIds = [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-id`));

    const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId,
      availabilityZones,
      privateSubnetRouteTableIds,
      publicSubnetRouteTableIds,
      publicSubnetIds,
      privateSubnetIds,
    });

    const elasticIp = new ec2.CfnEIP(this, 'elastic-ip');

    const instance = new ec2.Instance(this, 'ec2-migration-instance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.genericLinux({
        'eu-central-1': 'ami-0750be70a912aa1e9', // Amazon linux 2023 AMI (ARM)
      }),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // Place in public subnet for Session manager access without SSM VPC endpoint.
      },
    });

    // Attatch the elastic ip to the ec2 instance
    new ec2.CfnEIPAssociation(this, 'elastic-ip-instance', {
      instanceId: instance.instanceId,
      eip: elasticIp.ref,
    });

    // Allow the ec2 instance to write to the bucket
    cycloramaBucket.grantReadWrite(instance);
    instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
  }


}