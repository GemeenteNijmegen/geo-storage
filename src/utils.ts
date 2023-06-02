import { Statics } from './Statics';

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