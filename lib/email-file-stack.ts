import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { DnsValidatedCertificate, ValidationMethod } from '@aws-cdk/aws-certificatemanager';
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import sqs = require('@aws-cdk/aws-sqs');

const domainName = 'email-site.com';

export class EmailFileStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const table = new dynamodb.Table(this, 'Hits', {
      partitionKey: { name: 'path', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      stream: dynamodb.StreamViewType.NEW_IMAGE
    });

    // defines an AWS Lambda resource
    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,    // execution environment
      code: lambda.Code.fromAsset('lambda'),  // code loaded from "lambda" directory
      handler: 'hello.handler',               // file is "hello", function is "handler"
      environment: {
        DOCS_TABLE_NAME: table.tableName
      }
    });

    const processor = new lambda.Function(this, 'Processor', {
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'processor.handler',
      environment: {
        DOCS_TABLE_NAME: table.tableName
      }
    });

    const deadLetterQueue = new sqs.Queue(this, 'deadLetterQueue');

    processor.addEventSource(new DynamoEventSource(table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 1,
      bisectBatchOnError: true,
      onFailure: new SqsDlq(deadLetterQueue),
      retryAttempts: 10
    }))

    table.grantReadWriteData(hello);
    table.grantReadData(processor);

    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName
    })

    const certificate = new DnsValidatedCertificate(this, 'EndpointCertificate', {
      domainName,
      hostedZone: zone,
      validationMethod: ValidationMethod.EMAIL
    })
    
    const restApi = new apigw.LambdaRestApi(this, 'Endpoint', {
      handler: hello,
      options: {
        domainName: {
          domainName,
          certificate
        }
      }
    });

    

    new route53.ARecord(this, 'AliasRecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(restApi))
    });

    
  }
}