import { APIGatewayEvent, APIGatewayEventRequestContext } from "aws-lambda";
const { DynamoDB, S3 } = require("aws-sdk");

exports.handler = async function (
  event: APIGatewayEvent,
  context: APIGatewayEventRequestContext
) {
  console.log("request:", JSON.stringify(event, undefined, 2));
  console.log("context:", JSON.stringify(context, undefined, 2));
  const path = event.path.split("/").pop();
  const docClient = new DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });
  const s3 = new S3({ apiVersion: "2006-03-01" });

  const key = path;

  const item = await docClient
    .get({
      TableName: process.env.DOCS_TABLE_NAME,
      Key: {
        key: path,
      },
    })
    .promise();

  const email = await s3
    .getObject({
      Bucket: process.env.EMAIL_BUCKET_NAME,
      Key: key,
    })
    .promise();

  return {
    statusCode: 200,
    body: `
    <html>
      <body>${email.Body.toString("utf8")}</body>
    </html>`,
  };
  //
  // const { Records } = event;

  // if (Records.length > 1) {
  //   throw new Error("Hello handler can only process one record at a time");
  // }

  // let from = "unknown_sender";
  // const { ses } = Records[0];
  // if (ses) {
  //   from = ses.mail.headers.find(({ name }) => (name = "From")).value;
  // }

  // try {
  //   const item = await docClient
  //     .put({
  //       TableName: process.env.DOCS_TABLE_NAME,
  //       Item: {
  //         user: from,
  //         timestamp: Date.now(),
  //         ses,
  //       },
  //     })
  //     .promise();

  //   return {
  //     statusCode: 200,
  //     item,
  //   };
  // } catch (error) {
  //   return {
  //     statusCode: 500,
  //     error,
  //   };
  // }
};
