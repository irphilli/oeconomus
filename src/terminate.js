/*
 * Terminate an instance managed by Oeconomus
 */
const config = require('./includes/config');

const AWS = require('aws-sdk');

AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

exports.terminate = (event, callback) => {
   if (event.queryStringParameters && event.queryStringParameters.instanceId) {
      var instanceId = event.queryStringParameters.instanceId;
      var params = {
         InstanceIds: [ instanceId ],
         Filters: [
            {
               Name: 'instance-state-name',
               Values: [ 'pending', 'running', 'stopping', 'stopped' ]
            }
         ]
      }
      ec2.describeInstances(params, function(err, data) {
         if (data && data.Reservations.length != 0) {
            var spotInstanceRequestId = data.Reservations[0].Instances[0].SpotInstanceRequestId;
            if (spotInstanceRequestId) {
               ec2.cancelSpotInstanceRequests({ SpotInstanceRequestIds: [ spotInstanceRequestId ] }, function (err, data) {
                  if (err) {
                     callback('terminateInstances failed: ' + err);
                  }
                  else {
                     ec2.terminateInstances({ InstanceIds: [instanceId] }, function(err, data) {
                        if (err) {
                           callback('terminateInstances failed: ' + err);
                        }
                        else {
                           callback(null, instanceId);
                        }
                     });
                  }
               });
            }
            else {
               ec2.terminateInstances({ InstanceIds: [instanceId] }, function(err, data) {
                  if (err) {
                     callback('terminateInstances failed: ' + err);
                  }
                  else {
                     callback(null, instanceId);
                  }
               });
            }
         }
         else {
            callback(null, []);
         }
      });
   }
   else {
      callback(null, []);
   }
};
