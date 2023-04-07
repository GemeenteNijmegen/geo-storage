import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { PermissionsBoundaryAspect } from './PermissionsBoundaryAspect';
import { StorageStack } from './StorageStack';


export interface StorageStageProps extends StageProps, Configurable {}

export class StorageStage extends Stage {

  constructor(scope: Construct, id: string, props: StorageStageProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect('/', 'landingzone-workload-permissions-boundary'));

    new StorageStack(this, 'data-stack', {
      configuration: props.configuration,
    });

  }

}