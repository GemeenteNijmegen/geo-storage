import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { getNodeVersion } from '@gemeentenijmegen/projen-project-type';
import { Aspects, Stack, StackProps, Tags, pipelines } from 'aws-cdk-lib';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';
import { StorageStage } from './StorageStage';

export interface PipelineStackProps extends StackProps, Configurable { }

export class PipelineStack extends Stack {

  branchName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect());

    this.branchName = props.configuration.branchName;

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    const pipeline = this.pipeline(props);

    const storageStage = new StorageStage(this, 'geo-storage', {
      env: props.configuration.targetEnvironment,
      configuration: props.configuration,
    });
    pipeline.addStage(storageStage);

  }

  pipeline(props: PipelineStackProps): pipelines.CodePipeline {

    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/geo-storage', this.branchName, {
      connectionArn: props.configuration.codeStarConnectionArn,
    });

    const pipeline = new pipelines.CodePipeline(this, `geo-storage-${this.branchName}`, {
      pipelineName: `geo-storage-${this.branchName}-pipeline`,
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        env: {
          BRANCH_NAME: this.branchName,
        },
        commands: [
          'npm ci',
          'npm run synth',
        ],
      }),
      pipelineType: PipelineType.V1,
      synthCodeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          phases: {
            install: {
              'runtime-versions': {
                nodejs: getNodeVersion(),
              },
            },
          },
        }),
      },
    });
    return pipeline;
  }
}
