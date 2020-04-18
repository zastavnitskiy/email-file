#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { EmailFileStack } from "../lib/email-file-stack";
const envDefault = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
new EmailFileStack(app, "EmailFileStack", {
  env: envDefault,
});
