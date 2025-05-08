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
  configuration: Configuration;
}
export interface cloudfrontConfig {
  /**
   * Cloudfront and certificate stuff
   */
  domainNamesCloudFront: string[];
  domainNamesCertificate: {
    domainName: string;
    alternativeNames: string[];
  };
  cnames: { [key: string]: string };

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

  /**
   * A list of KMS Key ARNs that the backup role
   * is allowed to user (in different AWS accounts).
   * @default no allow statment for kms keys is added
   */
  allowedToUseKmsKeyArns?: string[];
}


export interface CloudFrontBucketConfig {
  exposeTroughCloudfront: boolean; //default false
  cloudfrontBasePath: string; //base path for the url of the bucket-contents
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
  cloudfrontBucketConfig?: CloudFrontBucketConfig;
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
    allowedToUseKmsKeyArns: [
      'arn:aws:kms:eu-west-1:751076321715:key/0e9efe8a-71b6-4218-b94d-8f9df0262674',
    ],
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}


/**
 * Configuration for buckets
 * Note encryption is managed in stacks
 * @param branchName
 * @returns
 */
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
        versioned: true,
      },
    },
    {
      cdkId: 'mesh-bucket',
      name: Statics.meshBucket(branchName, false),
      backupName: Statics.meshBucket(branchName, true),
      description: 'Mesh data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        versioned: true,
      },
      cloudfrontBucketConfig: {
        exposeTroughCloudfront: true,
        cloudfrontBasePath: 'mesh/*',
      },
    },
    {
      cdkId: 'kaartviewer-docs-bucket',
      name: Statics.kaartViewerDocsBucket(branchName, false),
      backupName: Statics.kaartViewerDocsBucket(branchName, true),
      description: '3D Mesh data',
      bucketConfiguration: {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        versioned: true,
      },
      cloudfrontBucketConfig: {
        exposeTroughCloudfront: true,
        cloudfrontBasePath: 'kvdocs/*',
      },
    },
  ];
}