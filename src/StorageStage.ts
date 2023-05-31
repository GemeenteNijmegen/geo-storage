import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { StorageStack } from './StorageStack';
import { BackupIamStack } from './BackupIamStack';


export interface StorageStageProps extends StageProps, Configurable {}

export class StorageStage extends Stage {

  constructor(scope: Construct, id: string, props: StorageStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const backupIamStack = new BackupIamStack(this, `${props.configuration.branchName}-backup-iam`, {
      env: props.configuration.backupEnvironment,
      configuration: props.configuration,
    });

    const storageStack = new StorageStack(this, 'data-stack', {
      env: props.configuration.targetEnvironment,
      configuration: props.configuration,
    });
    storageStack.addDependency(backupIamStack);

    // new BackupStack(this, `${props.configuration.branchName}-backup`, {
    // });

  }

}