import {
  Stack,
  StackProps,
  aws_s3 as s3,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { setupBuckets } from './utils';

export interface BackupStackProps extends Configurable, StackProps {}

export class BackupStack extends Stack {

  constructor(scope: Construct, id: string, props: BackupStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'temp-role', {
      assumedBy: new iam.AnyPrincipal(),
    });
    const replicationRoleArn = role.roleArn;
    // const replicationRoleArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmBackupRoleArn);

    const lifecycleRules = undefined;

    const {
      cycloramaBucket,
      obliekBucket,
      orthoBucket,
      lidarAirborneBucket,
      lidarTerrestrischBucket,
      aanbestedingBucket,
    } =
    setupBuckets(this, props.configuration.branchName, true, lifecycleRules);

    const buckets = [
      cycloramaBucket,
      obliekBucket,
      orthoBucket,
      lidarAirborneBucket,
      lidarTerrestrischBucket,
      aanbestedingBucket,
    ];

    buckets.forEach(bucket => this.allowReplicationToBucket(bucket, replicationRoleArn));

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