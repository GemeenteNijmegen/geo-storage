import { aws_s3 as s3, Stack, StackProps, Tags, aws_iam as iam, aws_ssm as ssm, aws_ec2 as ec2, Fn, Aws } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface StorageStackProps extends Configurable, StackProps { }

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

    if (props.configuration.deployEc2MigrationInstance) {
      this.setupEc2MigrationInstance(cycloramaBucket);
    }

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

    const instance = new ec2.Instance(this, 'ec2-migration-instance', {
      vpc, // By default in private subnet
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.genericLinux({
        'eu-central-1': 'ami-0750be70a912aa1e9', // Amazon linux 2023 AMI (ARM)
      }),
    });

    // Allow the ec2 instance to write to the bucket
    cycloramaBucket.grantReadWrite(instance);
    instance.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
  }


}