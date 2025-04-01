export class Statics {

  //Cloudfront
  static readonly certificatePath: string = '/cdk/yivi-issue-app/certificates';
  static readonly certificateArn: string = '/cdk/yivi-issue-app/certificates/certificate-arn';
  static readonly wafPath: string = '/cdk/yivi-issue-app/waf';
  static readonly ssmWafAclArn: string = '/cdk/yivi-issue-app/waf/acl-arn';
  static readonly ssmGeoPublicBucketsHost: string = '/cdk/yivi-issue-app/yivi-api-host';
  /**
     * Route53 Zone ID and name for the zone for geo public buckets. decouples stacks to not pass
     * the actual zone between stacks. This param is set by DNSStack and should not be modified after.
     */
  static readonly ssmZonePath: string = '/cdk/yivi-issue-app/zone';
  static readonly ssmZoneId: string = '/cdk/yivi-issue-app/zone/id';
  static readonly ssmZoneName: string = '/cdk/yivi-issue-app/zone/name';

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
  static readonly aliasBackupKmsKey = 'alias/geo-storage-backup-sse-key';

  // Bucket names
  static bucketBackupSuffix = (backup: boolean) => backup ? '-backup' : '';
  static cycloramaBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-cyclorama-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static meshBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-mesh-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static obliekBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-obliek-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static orthoBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-ortho-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarAirborneBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-airborne-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static lidarTerrestrischBucket = (branch: string, backup: boolean) => `gemeentenijmegen-geo-lidar-terrestrisch-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static aanbestedingBucket = (branch: string, backup: boolean) => `gemeentenijmegen-aanbesteding-${branch}${Statics.bucketBackupSuffix(backup)}`;
  static threedMeshBucket = (branch: string, backup: boolean) => `gemeentenijmegen-3d-mesh-${branch}${Statics.bucketBackupSuffix(backup)}`; //#909
  static kaartViewerDocsBucket = (branch: string, backup: boolean) => `gemeentenijmegen-kaartviewer-docs-${branch}${Statics.bucketBackupSuffix(backup)}`; //#909

  // Variable statics (pun intented)
  static readonly landingzonePlatformOperatorRoleArn = (accountId: string, region: string) => `arn:aws:iam::${accountId}:role/aws-reserved/sso.amazonaws.com/${region}/AWSReservedSSO_lz-platform-operator_*`;


}