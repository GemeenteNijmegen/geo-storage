import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
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
    },
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::S3::Bucket', 5);
});
