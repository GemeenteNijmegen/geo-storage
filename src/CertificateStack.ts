import { Stack, StackProps, aws_ssm as ssm, aws_certificatemanager as acm } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './Statics';

export interface CertificateStackProps extends StackProps, Configurable {}

export class CertificateStack extends Stack {
  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const certificate = new Certificate(this, 'certificate', {
      domainName: props.configuration.domainNamesCertificate.domainName,
      subjectAlternativeNames: props.configuration.domainNamesCertificate.alternativeNames,
      validation: acm.CertificateValidation.fromDns(), // Do not provide hosted zones (will not work with external domain names)
    });

    new ssm.StringParameter(this, 'cert-arn', {
      stringValue: certificate.certificateArn,
      parameterName: Statics.certificateParameter,
    });

  }
}