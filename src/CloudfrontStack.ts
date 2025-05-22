import { Duration, RemovalPolicy, Stack, aws_ssm, StackProps, aws_ssm as ssm } from 'aws-cdk-lib';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Distribution, PriceClass, SecurityPolicyProtocol, AccessLevel, ViewerProtocolPolicy, CachePolicy, AllowedMethods, ResponseHeadersPolicy, HeadersFrameOption, HeadersReferrerPolicy, OriginRequestPolicy, OriginRequestHeaderBehavior, OriginRequestCookieBehavior, OriginRequestQueryStringBehavior } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Key } from 'aws-cdk-lib/aws-kms';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { RemoteParameters } from 'cdk-remote-stack';
import { Construct } from 'constructs';
import { CloudfrontKmsPolicy } from './CloudfrontKmsPolicy';
import { Configurable, Configuration } from './Configuration';
import { S3BucketPolicyUpdater } from './S3BucketPolicyUpdater';
import { Statics } from './Statics';

export interface CloudfrontStackProps extends Configurable, StackProps { }
export class CloudfrontStack extends Stack {
  private corsHeadersPolicy: ResponseHeadersPolicy;
  private noAmzHeadersPolicy: OriginRequestPolicy;

  //constructor(scope: Construct, id: string, props: CloudfrontDistributionProps) {
  constructor(scope: Construct, id: string, props: CloudfrontStackProps) {
    super(scope, id, props);

    // Create CORS headers policy for allowed domains
    this.corsHeadersPolicy = new ResponseHeadersPolicy(this, 'CorsHeadersPolicy', {
      responseHeadersPolicyName: 'GeoStorageCorsPolicy',
      corsBehavior: {
        accessControlAllowOrigins: [
          '*.nijmegen.nl',
          '*.kaartviewer.nl',
          '*.karelstad.nl',
        ],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowHeaders: ['*'],
        accessControlMaxAge: Duration.seconds(600),
        originOverride: true,
        accessControlAllowCredentials: false,
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.seconds(31536000),
          includeSubdomains: true,
          override: true,
        },
      },
    });

    // Create Origin Request Policy that excludes all headers to prevent leaking of S3 bucket info
    this.noAmzHeadersPolicy = new OriginRequestPolicy(this, 'NoXAmzHeadersPolicy', {
      originRequestPolicyName: 'NoXAmzHeadersPolicy',
      comment: 'Do not forward any headers, cookies or query strings',
      headerBehavior: OriginRequestHeaderBehavior.none(), // Exclude all headers
      cookieBehavior: OriginRequestCookieBehavior.none(),
      queryStringBehavior: OriginRequestQueryStringBehavior.none(),
    });


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


    // Create an S3 bucket for error pages and other static content
    const staticContentBucket = new Bucket(this, 'staticContentBucket', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy static content to the bucket
    new BucketDeployment(this, 'StaticContentDeployment', {
      sources: [Source.asset('./src/static-resources/')],
      destinationBucket: staticContentBucket,
      retainOnDelete: false,
    });

    const s3Origin = S3BucketOrigin.withOriginAccessControl(staticContentBucket, {
      originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
    });

    const webAclId = this.wafAclId();
    // Setup the distribution with redirect to nijmegen.nl security.txt as default behavior
    const distribution = new Distribution(this, 'cf-distribution', {
      priceClass: PriceClass.PRICE_CLASS_100,
      certificate,
      webAclId,
      domainNames: [projectHostedZoneName],
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        responseHeadersPolicy: this.corsHeadersPolicy,
      },
      errorResponses: this.errorResponses(),
      logBucket: this.logBucket(),
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    //redirect as default behaviour isn't possible, no cache to ensure the latest version is served
    distribution.addBehavior(
      '/.well-known/security.txt',
      new HttpOrigin('nijmegen.nl'),
      {
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
    );


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
      defaultTtl: Duration.days(365),
      minTtl: Duration.days(365),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });


    // Retrieve KMS key and add CloudFront access policy
    const key = Key.fromKeyArn(this, 'EncryptionKey',
      ssm.StringParameter.valueForStringParameter(this, Statics.ssmGeoStorageKmsKeyArn));

    // Create custom resource to add policy to KMS key allowing CloudFront to decrypt
    new CloudfrontKmsPolicy(this, 'KmsPolicy', {
      kmsKey: key,
      cloudfrontDistributionArn: distribution.distributionArn,
    });

    for (const bucketSettings of configuration.buckets) {
      if (bucketSettings.cloudfrontBucketConfig && bucketSettings.cloudfrontBucketConfig.exposeTroughCloudfront) {
        // Use a unique ID for each bucket to avoid conflicts
        const uniqueId = `${bucketSettings.cdkId}-cf`;
        const bucket = Bucket.fromBucketAttributes(this, uniqueId, {
          bucketName: bucketSettings.name,
          encryptionKey: Key.fromKeyArn(this, `${uniqueId}-key`, ssm.StringParameter.valueForStringParameter(this, Statics.ssmGeoStorageKmsKeyArn)),
        });

        const s3Origin = S3BucketOrigin.withOriginAccessControl(bucket, {
          originAccessLevels: [AccessLevel.READ, AccessLevel.LIST],
        });

        this.addBucketPolicyForCloudfront(bucket, distribution);

        // Create a custom response headers policy with Cache-Control header
        //instructs the browser to cache the download for max 1 year.
        const responseHeadersPolicy = new ResponseHeadersPolicy(this, `CacheControlPolicy-${uniqueId}`, {
          responseHeadersPolicyName: `GeoStorageCacheControlPolicy-${bucketSettings.name}`,
          customHeadersBehavior: {
            customHeaders: [
              {
                header: 'Cache-Control',
                value: 'public, max-age=31536000, immutable',
                override: true,
              },
            ],
          },
        });

        distribution.addBehavior(bucketSettings.cloudfrontBucketConfig.cloudfrontBasePath, s3Origin, {
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: customCachePolicy,
          compress: true,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
          responseHeadersPolicy: responseHeadersPolicy,
          originRequestPolicy: this.noAmzHeadersPolicy,
        });


      }
    }
  }


  private addBucketPolicyForCloudfront(bucket: IBucket, distribution: Distribution) {
    // Instead of directly modifying the bucket policy, use our custom resource
    // that safely adds the CloudFront policy without overwriting existing policies
    new S3BucketPolicyUpdater(this, `S3PolicyUpdater-${bucket.node.id}`, {
      bucketName: bucket.bucketName,
      cloudfrontDistributionArn: distribution.distributionArn,
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

  /**
   * Get the certificate ARN from parameter store in us-east-1
   * @returns string Certificate ARN
   */
  private wafAclId() {
    const parameters = new RemoteParameters(this, 'waf-params', {
      path: `${Statics.wafPath}/`,
      region: 'us-east-1',
      timeout: Duration.seconds(30),
    });
    const wafAclId = parameters.get(Statics.ssmWafAclArn);
    return wafAclId;
  }
}