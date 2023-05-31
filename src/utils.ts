import { aws_s3 as s3, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './Statics';

export function setupBuckets(scope: Construct, branchName: string, backup: boolean, lifecycleRules?: s3.LifecycleRule[]) {

  const cycloramaBucket = new s3.Bucket(scope, 'cyclorama-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.cycloramaBucket(branchName, backup),
    lifecycleRules: lifecycleRules,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });
  Tags.of(cycloramaBucket).add('Contents', 'Cyclorama data');

  const obliekBucket = new s3.Bucket(scope, 'obliek-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.obliekBucket(branchName, backup),
    lifecycleRules: lifecycleRules,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });
  Tags.of(obliekBucket).add('Contents', 'Obliek data');

  const orthoBucket = new s3.Bucket(scope, 'ortho-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.orthoBucket(branchName, backup),
    lifecycleRules: lifecycleRules,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
  });
  Tags.of(orthoBucket).add('Contents', 'Obliek data');

  const lidarAirborneBucket = new s3.Bucket(scope, 'lidar-airborne-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.lidarAirborneBucket(branchName, backup),
    lifecycleRules: lifecycleRules,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });
  Tags.of(lidarAirborneBucket).add('Contents', 'LiDAR airborne data');

  const lidarTerrestrischBucket = new s3.Bucket(scope, 'lidar-terrestrisch-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.lidarTerrestrischBucket(branchName, backup),
    lifecycleRules: lifecycleRules,
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });
  Tags.of(lidarTerrestrischBucket).add('Contents', 'LiDAR terrestrisch data');


  const aanbestedingBucket = new s3.Bucket(scope, 'aanbesteding-bucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    bucketName: Statics.aanbestedingBucket(branchName, backup),
    enforceSSL: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });
  Tags.of(aanbestedingBucket).add('Contents', 'Bucket voor aanbesteding beeldmateriaalviewer');

  return {
    cycloramaBucket,
    obliekBucket,
    orthoBucket,
    lidarAirborneBucket,
    lidarTerrestrischBucket,
    aanbestedingBucket,
  };

}

export function getBucketArns(branchName: string, backup: boolean) {
  return [
    Statics.cycloramaBucket(branchName, backup),
    Statics.obliekBucket(branchName, backup),
    Statics.orthoBucket(branchName, backup),
    Statics.lidarAirborneBucket(branchName, backup),
    Statics.lidarTerrestrischBucket(branchName, backup),
    Statics.aanbestedingBucket(branchName, backup),
  ];
}