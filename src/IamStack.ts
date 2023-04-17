import { Stack, StackProps, aws_iam as iam, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface IamStackProps extends Configurable, StackProps {}

export class IamStack extends Stack {

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'role', {
      description: 'Assumable role for GEO specialists of GemeenteNijmegen',
      assumedBy: new iam.AnyPrincipal(),
    });

    const geoBucketsPolicyArn = ssm.StringParameter.valueForStringParameter(this, Statics.ssmGeoBucketsManagedPolicyArn);
    const geoBucketsPolicy = iam.ManagedPolicy.fromManagedPolicyArn(this, 'policy', geoBucketsPolicyArn);
    role.addManagedPolicy(geoBucketsPolicy);

  }


}