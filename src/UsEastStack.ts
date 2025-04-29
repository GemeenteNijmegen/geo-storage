import { Stack, StackProps, Tags } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, HostedZoneAttributes, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Statics } from './Statics';

export interface UsEastStackProps extends StackProps {
  accountHostedZoneRegion: string;
}

export class UsEastStack extends Stack {

  constructor(scope: Construct, id: string, props: UsEastStackProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    const attributes = this.getZoneAttributesFromRegion(props);
    const accountHostedZone = HostedZone.fromHostedZoneAttributes(this, 'account-hosted-zone', attributes);
    //const hostedZone = this.setupProjectHostedZone(accountHostedZone);
    this.setupCertificate(accountHostedZone);

  }


  /**
   * Create a certificate for this project
   * @param hostedZone
   * @param props
   */
  setupCertificate(hostedZone: IHostedZone) {
    const validation = CertificateValidation.fromDns(hostedZone);

    const certificate = new Certificate(this, 'certificate', {
      domainName: hostedZone.zoneName,
      validation: validation,
    });

    new StringParameter(this, 'cert-arn', {
      stringValue: certificate.certificateArn,
      parameterName: Statics.certificateArn,
    });

  }

  /**
   * Finds the account hostedzone name and id in the given region
   * @param props
   * @returns
   */
  private getZoneAttributesFromRegion(props: UsEastStackProps): HostedZoneAttributes {
    const parameters = new RemoteParameters(this, 'parameters', {
      path: Statics.accountRootHostedZonePath,
      region: props.accountHostedZoneRegion,
    });
    const zoneId = parameters.get(Statics.accountHostedZoneId);
    const zoneName = parameters.get(Statics.accountHostedZoneName);
    return {
      hostedZoneId: zoneId,
      zoneName: zoneName,
    };
  }


}