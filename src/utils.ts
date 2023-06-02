import { Statics } from './Statics';

export function getBucketArns(branchName: string, backup: boolean) {
  const names = [
    Statics.cycloramaBucket(branchName, backup),
    Statics.obliekBucket(branchName, backup),
    Statics.orthoBucket(branchName, backup),
    Statics.lidarAirborneBucket(branchName, backup),
    Statics.lidarTerrestrischBucket(branchName, backup),
    Statics.aanbestedingBucket(branchName, backup),
  ];
  return names.map(name => `arn:aws:s3:::${name}`);
}