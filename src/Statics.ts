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

  static readonly backupEnvironment = {
    account: '751076321715',
    region: 'eu-west-1', // Different region!
  };

  static readonly backupEnvironmentAcceptance = {
    account: '766983128454', // Same acceptance account!
    region: 'eu-west-1', // Different region!
  };


  // SSM parameters
  static readonly ssmGeoBucketsManagedPolicyArn = '/geo-storage/policies/geo-buckets-managment';
  static readonly ssmBackupPath = '/geo-storage/backup';
  static readonly ssmBackupRoleArn = '/geo-storage/backup/role-arn';

  // Statics
  static readonly backupRoleName = 'backup-replication-role';
  static readonly geoStorageOperatorrManagedPolicyName = 'geo-storage-operator-policy';
  static readonly landingzonePlatformOperatorRoleArn = 'arn:aws:iam::766983128454:role/aws-reserved/sso.amazonaws.com/eu-central-1/AWSReservedSSO_lz-platform-operator_*';

  // Bucket names
  static bucketBackupSuffix = (backup: boolean) => backup ? '-backup' : '';
  static cycloramaBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-cyclorama-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static obliekBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-obliek-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static orthoBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-ortho-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarAirborneBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-airborne-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarTerrestrischBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-terrestrisch-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static aanbestedingBucket = (branch: string, backup: boolean) => `gemeentenijmegen-aanbesteding-${branch}${Statics.bucketBackupSuffix(backup)}`;


}