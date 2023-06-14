import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { getBucketConfig } from '../src/Configuration';
import { Statics } from '../src/Statics';
import { StorageStack } from '../src/StorageStack';

const testEnv = {
  account: '123456789012',
  region: 'eu-central-1',
};

test('StackHasBuckets', () => {
  const app = new App();
  const stack = new StorageStack(app, 'stack', {
    configuration: {
      branchName: 'test',
      codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
      deploymentEnvironment: testEnv,
      targetEnvironment: testEnv,
      backupEnvironment: testEnv,
      buckets: getBucketConfig('test'),
    },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::S3::Bucket', 7);
});


test('Bucket names (without backup)', () => {
  expect(Statics.cycloramaBucket('test', false)).toBe('gemeentenijmegen-geo-cyclorama-test');
  expect(Statics.obliekBucket('test', false)).toBe('gemeentenijmegen-geo-obliek-test');
  expect(Statics.orthoBucket('test', false)).toBe('gemeentenijmegen-geo-ortho-test');
  expect(Statics.lidarAirborneBucket('test', false)).toBe('gemeentenijmegen-geo-lidar-airborne-test');
  expect(Statics.lidarTerrestrischBucket('test', false)).toBe('gemeentenijmegen-geo-lidar-terrestrisch-test');
  expect(Statics.aanbestedingBucket('test', false)).toBe('gemeentenijmegen-aanbesteding-test');
});

test('Bucket names (with backup)', () => {
  expect(Statics.cycloramaBucket('test', true)).toBe('gemeentenijmegen-geo-cyclorama-test-backup');
  expect(Statics.obliekBucket('test', true)).toBe('gemeentenijmegen-geo-obliek-test-backup');
  expect(Statics.orthoBucket('test', true)).toBe('gemeentenijmegen-geo-ortho-test-backup');
  expect(Statics.lidarAirborneBucket('test', true)).toBe('gemeentenijmegen-geo-lidar-airborne-test-backup');
  expect(Statics.lidarTerrestrischBucket('test', true)).toBe('gemeentenijmegen-geo-lidar-terrestrisch-test-backup');
  expect(Statics.aanbestedingBucket('test', true)).toBe('gemeentenijmegen-aanbesteding-test-backup');
});