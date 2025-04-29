import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BackupIamStack } from './BackupIamStack';
import { BackupStack } from './BackupStack';
import { CloudfrontStack } from './CloudfrontStack';
import { Configurable } from './Configuration';
import { StorageStack } from './StorageStack';
import { UsEastStack } from './UsEastStack';


export interface StorageStageProps extends StageProps, Configurable { }

export class StorageStage extends Stage {

  constructor(scope: Construct, id: string, props: StorageStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const backupIamStack = new BackupIamStack(this, `${props.configuration.branchName}-backup-iam`, {
      env: props.configuration.targetEnvironment,
      configuration: props.configuration,
    });

    //todo
    //add dns stack
    //add cert stack

    const storageStack = new StorageStack(this, 'data-stack', {
      env: props.configuration.targetEnvironment,
      configuration: props.configuration,
    });

    // Deploy resources that must exist in us-east-1
    const usEastStack = new UsEastStack(this, 'us-east-stack', {
      env: { region: 'us-east-1' },
      accountHostedZoneRegion: 'eu-central-1',
    });

    const cloudFrontStack = new CloudfrontStack(this, 'cloudfront-stack', {
      configuration: props.configuration,
    });

    const backupStack = new BackupStack(this, `${props.configuration.branchName}-backup`, {
      env: props.configuration.backupEnvironment,
      configuration: props.configuration,
    });

    storageStack.addDependency(backupIamStack);
    storageStack.addDependency(backupStack);
    cloudFrontStack.addDependency(storageStack);
    cloudFrontStack.addDependency(usEastStack);

  }

}