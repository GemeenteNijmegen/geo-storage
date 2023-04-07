import { aws_s3 as s3, Stack, StackProps, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Configurable } from "./Configuration";

export interface StorageStackProps extends Configurable, StackProps {}

export class StorageStack extends Stack {

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const cycloMediaBucket = new s3.Bucket(this, 'cyclomedia-bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
    Tags.of(cycloMediaBucket).add('description', 'Cyclomedia data');

  }
}