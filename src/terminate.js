/*
 * Terminate an instance managed by Oeconomus
 */
//TODO: test with spot instance - will need to cancel spot request
//
const config = require('./includes/config');

const AWS = require('aws-sdk');

AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

exports.terminate = (event, callback) => {
   if (event.queryStringParameters && event.queryStringParameters.instanceId) {
      var instanceId = event.queryStringParameters.instanceId;
      ec2.terminateInstances({ InstanceIds: [instanceId] }, function(err, data) {
         if (err) {
            callback('terminateInstances failed: ' + err);
         }
         else {
            callback(null, instanceId);
         }
      });
   }
   else {
      callback(null, []);
   }
};
