import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigw from "@aws-cdk/aws-apigateway";
import * as route53 from "@aws-cdk/aws-route53";
import * as targets from "@aws-cdk/aws-route53-targets";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import {
  DnsValidatedCertificate,
  ValidationMethod,
} from "@aws-cdk/aws-certificatemanager";
import { DynamoEventSource, SqsDlq } from "@aws-cdk/aws-lambda-event-sources";
import sqs = require("@aws-cdk/aws-sqs");
import { Bucket } from "@aws-cdk/aws-s3";

const domainName = "email-site.com";
const wwwRecordName = "www";
const cdnRecordName = "cdn";
const apiRecordName = "api";
const cdnDomainName = [cdnRecordName, domainName].join(".");
const wwwDomainName = [wwwRecordName, domainName].join(".");

export class EmailFileStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, "Hits", {
      partitionKey: { name: "path", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    const staticBucket = new Bucket(this, "MyFirstBucket", {
      bucketName: [wwwRecordName, domainName].join("."),
      publicReadAccess: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "404.html",
    });

    // defines an AWS Lambda resource
    const hello = new lambda.Function(this, "HelloHandler", {
      runtime: lambda.Runtime.NODEJS_12_X, // execution environment
      code: lambda.Code.fromAsset("lambda"), // code loaded from "lambda" directory
      handler: "hello.handler", // file is "hello", function is "handler"
      environment: {
        DOCS_TABLE_NAME: table.tableName,
      },
    });

    const processor = new lambda.Function(this, "Processor", {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "processor.handler",
      environment: {
        DOCS_TABLE_NAME: table.tableName,
        STATIC_BUCKET_NAME: staticBucket.bucketName,
      },
    });

    const deadLetterQueue = new sqs.Queue(this, "deadLetterQueue");

    processor.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1,
        bisectBatchOnError: true,
        onFailure: new SqsDlq(deadLetterQueue),
        retryAttempts: 10,
      })
    );

    table.grantReadWriteData(hello);
    table.grantReadData(processor);

    const zone = route53.HostedZone.fromLookup(this, "MyZone", {
      domainName,
    });

    const certificate = new DnsValidatedCertificate(
      this,
      "EndpointCertificate",
      {
        domainName,
        hostedZone: zone,
        validationMethod: ValidationMethod.EMAIL,
        subjectAlternativeNames: [cdnDomainName, wwwDomainName],
      }
    );

    const restApi = new apigw.LambdaRestApi(this, "Endpoint", {
      handler: hello,
      options: {
        domainName: {
          domainName,
          certificate,
        },
      },
    });

    new route53.ARecord(this, "APIAliasRecord", {
      zone,
      recordName: apiRecordName,
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(restApi)),
    });

    // CloudFront distribution that provides HTTPS
    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "CDNDistribution",
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: staticBucket,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
        viewerCertificate: cloudfront.ViewerCertificate.fromCloudFrontDefaultCertificate(
          cdnDomainName
        ),
      }
    );

    new route53.ARecord(this, "cdnAliasRecord", {
      zone,
      recordName: cdnRecordName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    new route53.ARecord(this, "wwwAliasRecord", {
      zone,
      recordName: wwwRecordName,
      target: route53.RecordTarget.fromAlias(
        new targets.BucketWebsiteTarget(staticBucket)
      ),
    });

    staticBucket.grantWrite(processor);
  }
}
