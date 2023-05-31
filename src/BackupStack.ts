import {
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { setupBuckets } from './utils';

export interface StorageStackProps extends Configurable, StackProps {}

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const lifecycleRules = undefined;

    // const {
    //   cycloramaBucket,
    //   obliekBucket,
    //   orthoBucket,
    //   lidarAirborneBucket,
    //   lidarTerrestrischBucket,
    //   aanbestedingBucket,
    // } =
    setupBuckets(this, props.configuration.branchName, true, lifecycleRules);

    // const buckets = [
    //   cycloramaBucket,
    //   obliekBucket,
    //   orthoBucket,
    //   lidarAirborneBucket,
    //   lidarTerrestrischBucket,
    //   aanbestedingBucket,
    // ];


  }

}