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
   * Deploy EC2 migration instance for cyclorama data
   */
  deployEc2MigrationInstance?: boolean;

}


export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    deploymentEnvironment: Statics.deploymentEnvironment,
    targetEnvironment: Statics.acceptanceEnvironment,
    deployEc2MigrationInstance: true,
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}