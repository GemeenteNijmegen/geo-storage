import { Duration, RemovalPolicy, Stack, aws_ssm, StackProps } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution, PriceClass, SecurityPolicyProtocol, AccessLevel, ViewerProtocolPolicy, CachePolicy, AllowedMethods } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { Configurable, Configuration } from './Configuration';
import { Statics } from './Statics';

// interface CloudfrontDistributionProps {
//   bucket: IBucket;
//   originConfig: S3OriginConfig;
//   env?: Environment;
//   domainNames?: string[];
// }

export interface CloudfrontStackProps extends Configurable, StackProps { }
export class CloudfrontStack extends Stack {

  //constructor(scope: Construct, id: string, props: CloudfrontDistributionProps) {
  constructor(scope: Construct, id: string, props: CloudfrontStackProps) {
    super(scope, id, props);


    // Get the hosted zone
    const projectHostedZoneName = aws_ssm.StringParameter.valueForStringParameter(this, Statics.accountHostedZoneName);
    const projectHostedZoneId = aws_ssm.StringParameter.valueForStringParameter(this, Statics.accountHostedZoneId);

    // Get the certificate
    const remoteCertificateArn = new RemoteParameters(this, 'remote-certificate-arn', {
      path: Statics.certificatePath,
      region: 'us-east-1',
      timeout: Duration.seconds(10),
    });
    const certificate = Certificate.fromCertificateArn(this, 'certificate', remoteCertificateArn.get(Statics.certificateArn));


    //bucket for the security.txt file, also the default behaviour
    //TODO redirect naar de default op nijmegen.nl
    const defaultBucket = new Bucket(this, 'securityTxtBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const s3Origin = S3BucketOrigin.withOriginAccessControl(defaultBucket, {
      originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],

    });
    new BucketDeployment(this, 'Deployment', {
      sources: [Source.asset('./src/static-resources/')],
      destinationBucket: defaultBucket,
      retainOnDelete: false,
    });


    // Setup the distribution
    const distribution = new Distribution(this, 'cf-distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      certificate,
      domainNames: [projectHostedZoneName],
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
      errorResponses: this.errorResponses(),
      logBucket: this.logBucket(),
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
    });


    this.addDnsRecords(distribution, projectHostedZoneId, projectHostedZoneName);

    this.addPublicBuckets(props.configuration, distribution);

    //export for importing the distribution in the storageStack
    new StringParameter(this, 'cf-domain', {
      stringValue: distribution.distributionDomainName,
      parameterName: Statics.ssmCloudfrontdomainName,
    });
    new StringParameter(this, 'cf-id', {
      stringValue: distribution.distributionId,
      parameterName: Statics.ssmCloudfrontDistributionId,
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


  private addPublicBuckets(configuration: Configuration, distribution: Distribution) {
    const customCachePolicy = new CachePolicy(this, 'ThreeMonthCachePolicy', {
      cachePolicyName: 'ThreeMonthCachePolicy',
      defaultTtl: Duration.seconds(60 * 60 * 24 * 90), // 3 months
      minTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });


    for (const bucketSettings of configuration.buckets) {
      if (bucketSettings.cloudfrontBucketConfig && bucketSettings.cloudfrontBucketConfig.exposeTroughCloudfront) {
        const bucket = Bucket.fromBucketName(this, 'cfBucket', bucketSettings.name);
        const s3Origin = S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
        });

        this.addBucketPolicyForCloudfront(bucket);

        distribution.addBehavior(bucketSettings.cloudfrontBucketConfig.cloudfrontBasePath, s3Origin, {
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: customCachePolicy,
          compress: true,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD,

        });
      }

    }
  }


  private addBucketPolicyForCloudfront(bucket: IBucket) {

    bucket.addToResourcePolicy(new PolicyStatement({
      resources: [
        '${bucket.bucketArn}',
        '${bucket.bucketArn}/*',
      ],
      actions: [
        's3:GetObject',
        's3:ListBucket',
      ],
      effect: Effect.ALLOW,
      conditions: { StringEquals: { 'AWS:SourceArn': 'arn:aws:cloudfront::766983128454:distribution/E2TPB5GUJ7UGKA' } },
      //principals: [originAccessIdentity.grantPrincipal],
    }),
    );
  }

  /**
  private addBucketPolicyForCloudfront(bucket: IBucket) {
    // Explicitly add Bucket Policy
    const policyStatement = new PolicyStatement();
    //policyStatement.addActions('s3:GetBucket*');
    policyStatement.addActions('s3:GetObject');
    policyStatement.addActions('s3:ListBucket');
    policyStatement.addResources(bucket.bucketArn);
    policyStatement.addResources(`${bucket.bucketArn}/*`);
    policyStatement.addServicePrincipal('cloudfront.amazonaws.com');
    policyStatement.addCondition('StringEquals', { 'AWS:SourceArn': 'arn:aws:cloudfront::766983128454:distribution/E2TPB5GUJ7UGKA' });


    if ( !bucket.policy ) {
      new BucketPolicy(this, 'Policy', { bucket: bucket }).document.addStatements(policyStatement);
    } else {
      bucket.policy.document.addStatements(policyStatement);
    }
  }
     */


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
      objectOwnership: ObjectOwnership.OBJECT_WRITER, // Needed for Cloudfront to write to the bucket
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