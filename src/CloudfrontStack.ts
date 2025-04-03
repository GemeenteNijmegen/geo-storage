import path from 'path';
import { StringParameter } from '@pepperize/cdk-ssm-parameters-cross-region';
import { Duration, Environment, aws_ssm } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution, Function, FunctionCode, FunctionEventType, PriceClass, S3OriginConfig, SecurityPolicyProtocol, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Statics } from './Statics';

interface CloudfrontDistributionProps {
  bucket: IBucket;
  originConfig: S3OriginConfig;
  env?: Environment;
  domainNames?: string[];
}

export class CloudfrontDistribution extends Construct {
  constructor(scope: Construct, id: string, props: CloudfrontDistributionProps) {
    super(scope, id);


    // Get the hosted zone
    const projectHostedZoneName = aws_ssm.StringParameter.valueForStringParameter(this, Statics.projectHostedZoneName);
    const projectHostedZoneId = aws_ssm.StringParameter.valueForStringParameter(this, Statics.projectHostedZoneId);

    // Get the certificate
    let certificate = undefined;
    if (props.domainNames) {
      const certificateArn = StringParameter.fromStringParameterName(this, 'certparam', 'us-east-1', Statics.certificateParameter).stringValue;
      certificate = Certificate.fromCertificateArn(this, 'certificate', certificateArn);
    }

    // Setup the distribution
    const distribution = new Distribution(this, 'cf-distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      certificate,
      domainNames: props.domainNames,
      defaultBehavior: {
        origin: new S3Origin(props.bucket, { originAccessIdentity: props.originConfig.originAccessIdentity }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{ eventType: FunctionEventType.VIEWER_REQUEST, function: this.indexRewriteFunction() }],
      },
      errorResponses: this.errorResponses(),
      logBucket: this.logBucket(),
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
    });


    this.addDnsRecords(distribution, projectHostedZoneId, projectHostedZoneName);

  }

  private indexRewriteFunction() {
    return new Function(this, 'rewrite-index', {
      code: FunctionCode.fromFile({ filePath: path.join(__dirname, 'rewriteIndexFunction.js') }),
    });
  }

  private errorResponses() {
    const errorCodes = [403, 404, 500];
    return errorCodes.map(code => {
      return {
        httpStatus: code,
        responseHttpStatus: code,
        responsePagePath: `/http-errors/${code}.html`,
      };
    });
  }

  /**
   * Create a bucket to hold cloudfront logs
   * @returns s3.Bucket
   */
  logBucket() {
    const cfLogBucket = new Bucket(this, 'CloudfrontLogs', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      eventBridgeEnabled: true,
      enforceSSL: true,
      encryption: BucketEncryption.S3_MANAGED,
      objectOwnership: ObjectOwnership.OBJECT_WRITER, // Neede for Cloudfront to write to the bucket
      lifecycleRules: [
        {
          id: 'delete objects after 180 days',
          enabled: true,
          expiration: Duration.days(180),
        },
      ],
    });
    return cfLogBucket;
  }

  /**
   * Add DNS records for cloudfront to the Route53 Zone
   *
   * Requests to the custom domain will correctly use cloudfront.
   *
   * @param distribution the cloudfront distribution
   */
  addDnsRecords(distribution: Distribution, hostedZoneId: string, hostedZoneName: string): void {
    const zone = HostedZone.fromHostedZoneAttributes(this, 'zone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    new ARecord(this, 'a-record', {
      zone: zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new AaaaRecord(this, 'aaaa-record', {
      zone: zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    new ARecord(this, 'a-record-www', {
      zone: zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `www.${zone.zoneName}`,
    });

    new AaaaRecord(this, 'aaaa-record-www', {
      zone: zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      recordName: `www.${zone.zoneName}`,
    });
  }
}