import * as crypto from 'crypto';
import {
  aws_route53 as Route53,
  aws_ssm as SSM,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface DnsStackProps extends StackProps, Configurable {}

export class DnsStack extends Stack {
  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const projectHostedZone = this.projectHostedZone();
    this.setSsmParametersForHostedZone(projectHostedZone);
    this.addCnameRecords(projectHostedZone, props.configuration.cnames);
  }

  /**
   * Creates a new hosted zone that is a subdomain of the accountHostedZone
   * @param accountHostedZone
   */
  private projectHostedZone() {
    const hostedZone = new Route53.HostedZone(this, 'projectzone', {
      zoneName: `${Statics.projectName}.nl`,
      comment: `${Statics.projectName} hosted zone`,
    });

    return hostedZone;
  }

  /**
   * Sets the SSM parameters for the hosted zone
   * @param hostedZone
   */
  private setSsmParametersForHostedZone(hostedZone: Route53.HostedZone) {
    const hostedZoneName = hostedZone.zoneName;
    const hostedZoneId = hostedZone.hostedZoneId;

    new SSM.StringParameter(this, 'hostedZoneName', {
      parameterName: Statics.projectHostedZoneName,
      stringValue: hostedZoneName,
    });

    new SSM.StringParameter(this, 'hostedZoneId', {
      parameterName: Statics.projectHostedZoneId,
      stringValue: hostedZoneId,
    });
  }

  private addCnameRecords(hostedZone: Route53.HostedZone, cnames?: {[key:string]:string}) {
    if (!cnames) {
      return;
    }
    Object.entries(cnames).forEach((cname) => {
      const combination = `${cname[0]}${cname[1]}`;
      const hash = crypto.createHash('sha256').update(combination).digest('hex').substring(0, 8);
      new Route53.CnameRecord(this, `cname-${hash}`, {
        recordName: cname[0],
        domainName: cname[1],
        zone: hostedZone,
      });
    });
  }

}