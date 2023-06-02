import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Statics } from './Statics';

/**
 * Custom Environment with obligatory accountId and region
 */
export interface Environment {
  account: string;
  region: string;
}

export interface Configurable {
  configuration : Configuration;
}

export interface Configuration {
  /**
   * The git branch name to which this configuration applies.
   */
  branchName: string;


  /**
   * Code star connection arn in the deployment environment
   */
  codeStarConnectionArn: string;

  /**
   * Deployment environment
   */
  deploymentEnvironment: Environment;

  /**
   * Target environment
   */
  targetEnvironment: Environment;

  /**
   * The environment to replicate objects to
   */
  backupEnvironment: Environment;

  /**
   * Setup the buckets used for geo storage
   */
  buckets: GeoBucketConfig[];

}

export interface GeoBucketConfig {
  cdkId: string;
  name: string;
  /**
   * If undefined no backup is configured for this bucket
   */
  backupName?: string;
  description: string;
  bucketConfiguration: s3.BucketProps;

  /**
   * @default false
   */
  setupAccessForIamUser?: boolean;
}


export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    deploymentEnvironment: Statics.deploymentEnvironment,
    targetEnvironment: Statics.acceptanceEnvironment,
    backupEnvironment: Statics.backupEnvironmentAcceptance,
    buckets: getBucketConfig('acceptance'),
  },
  main: {
    branchName: 'main',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    deploymentEnvironment: Statics.deploymentEnvironment,
    targetEnvironment: Statics.productionEnvironment,
    backupEnvironment: Statics.backupEnvironment,
    buckets: getBucketConfig('main'),
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}


export function getBucketConfig(branchName: string) {
  return [
    {
      cdkId: 'cyclorama-bucket',
      name: Statics.cycloramaBucket(branchName, false),
      backupName: Statics.cycloramaBucket(branchName, true),
      description: 'Cyclorama data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
    {
      cdkId: 'obliek-bucket',
      name: Statics.obliekBucket(branchName, false),
      backupName: Statics.obliekBucket(branchName, true),
      description: 'Obliek data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
    {
      cdkId: 'ortho-bucket',
      name: Statics.orthoBucket(branchName, false),
      backupName: Statics.orthoBucket(branchName, true),
      description: 'Ortho data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
    {
      cdkId: 'lidar-airborne-bucket',
      name: Statics.lidarAirborneBucket(branchName, false),
      backupName: Statics.lidarAirborneBucket(branchName, true),
      description: 'LiDAR airborne data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
    {
      cdkId: 'lidar-terrestrisch-bucket',
      name: Statics.lidarTerrestrischBucket(branchName, false),
      backupName: Statics.lidarTerrestrischBucket(branchName, true),
      description: 'LiDAR terrestrisch data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
    {
      cdkId: 'aanbesteding-bucket',
      name: Statics.aanbestedingBucket(branchName, false),
      backupName: undefined, // NO BACKUP!
      description: 'Bucket voor aanbesteding beeldmateriaalviewer',
      setupAccessForIamUser: true, // ALLOW IAM user to read bucket!
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      },
    },
  ];
}