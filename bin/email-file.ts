#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EmailFileStack } from '../lib/email-file-stack';

const app = new cdk.App();
new EmailFileStack(app, 'EmailFileStack');
