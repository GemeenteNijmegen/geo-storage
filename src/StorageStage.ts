import { Stage, StageProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Configurable } from "./Configuration";
import { StorageStack } from "./StorageStack";


export interface StorageStageProps extends StageProps, Configurable {}

export class StorageStage extends Stage {

  constructor(scope: Construct, id: string, props: StorageStageProps){
    super(scope, id, props);

    new StorageStack(this, 'data-stack', {
      configuration: props.configuration,
    })

  }

}