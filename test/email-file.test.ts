import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import EmailFile = require('../lib/email-file-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new EmailFile.EmailFileStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
