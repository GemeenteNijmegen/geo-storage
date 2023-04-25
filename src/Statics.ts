export class Statics {

  static readonly projectName = 'geo-storage';

  static readonly gnBuildCodeStarConnectionArn = 'arn:aws:codestar-connections:eu-central-1:836443378780:connection/9d20671d-91bc-49e2-8680-59ff96e2ab11';

  static readonly deploymentEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };

  static readonly acceptanceEnvironment = {
    account: '766983128454',
    region: 'eu-central-1',
  };

  static readonly productionEnvironment = {
    account: '549334216741',
    region: 'eu-central-1',
  };

  // SSM parameters
  static readonly ssmGeoBucketsManagedPolicyArn = '/geo-storage/policies/geo-buckets-managment';

  // Statics
  static readonly geoUserManagedPolicyName = 'geo-storage-operator-policy';

}