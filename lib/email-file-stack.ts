import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import {Certificate} from '@aws-cdk/aws-certificatemanager';

const domainName = 'email.zastavnitskiy.dev';

export class EmailFileStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // defines an AWS Lambda resource
    const hello = new lambda.Function(this, 'HelloHandler', {
      runtime: lambda.Runtime.NODEJS_10_X,    // execution environment
      code: lambda.Code.fromAsset('lambda'),  // code loaded from "lambda" directory
      handler: 'hello.handler'                // file is "hello", function is "handler"
    });

    const certificate = new Certificate(this, 'EndpointCertificate', {
      domainName
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

    /**
     * Once deployed, point your subdomain nameservers to 
     * the AWS ones. You can find them in Route53 console,
     * in the properties of the created hosted zone.
     */
    const zone = new route53.PublicHostedZone(this, 'HostedZone', {
      zoneName: domainName
    })

    new route53.ARecord(this, 'AliasRecord', {
      zone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(restApi))
    });
  }
}