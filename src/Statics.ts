export class Statics {

  /**
     * Cloudfront and Route53 Zone ID and name for the zone for geo public buckets. decouples stacks to not pass
     * the actual zone between stacks. This param is set by DNSStack and should not be modified after.
     */
  static readonly accountHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';
  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone';
  static readonly certificateArn: string = '/geo-storage/cloudfront/certificate/arn';
  static readonly certificatePath: string = '/geo-storage/cloudfront/certificate';

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
  static readonly ssmBackupRoleArn = '/geo-storage/backup/role-arn';
  static readonly ssmCloudfrontdomainName = '/geo-storage/cloudfront/domainName';
  static readonly ssmCloudfrontDistributionId = '/geo-storage/cloudfront/distributionId';
  static readonly ssmGeoStorageKmsKeyArn = '/geo-storage/kmskey/arn';

  // Statics
  static readonly backupRoleName = 'backup-replication-role';
  static readonly geoStorageOperatorrManagedPolicyName = 'geo-storage-operator-policy';
  static readonly aliasBackupKmsKey = 'alias/geo-storage-backup-sse-key';

  // Bucket names
  static bucketBackupSuffix = (backup: boolean) => backup ? '-backup' : '';
  static cycloramaBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-cyclorama-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static meshBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-mesh-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static obliekBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-obliek-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static orthoBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-ortho-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarAirborneBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-airborne-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarTerrestrischBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-terrestrisch-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static kaartViewerDocsBucket = (branch: string, backup: boolean) => `gemeentenijmegen-kaartviewer-docs-${branch}${Statics.bucketBackupSuffix(backup)}`; //#909

  // Variable statics (pun intented)
  static readonly landingzonePlatformOperatorRoleArn = (accountId: string, region: string) => `arn:aws:iam::${accountId}:role/aws-reserved/sso.amazonaws.com/${region}/AWSReservedSSO_lz-platform-operator_*`;


}