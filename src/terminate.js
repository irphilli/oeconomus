/*
 * Terminate an instance managed by Oeconomus
 */
//TODO: test with spot instance - will need to cancel spot request
//
const config = require('./includes/config');

const AWS = require('aws-sdk');

const launchConfigurations = config.getLaunchConfigurations();
AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

/*
terminateInstance('do-1', 'developer', function(err, result) {
   console.error(err);
   console.log(result);
});
*/

function terminateInstance(name, launchConfigurationName, callback) {
   var launchConfiguration = launchConfigurations[launchConfigurationName];
   if (launchConfiguration) {
      // Get instance with name + tagged by oeconomus
      var params = {
         Filters: [
            {
               Name: 'tag:os-config',
               Values: [ launchConfigurationName ]
            },
            {
               Name: 'tag:Name',
               Values: [ name ]
            },
            {
               Name: 'instance-state-name',
               Values: [ 'stopped', 'running' ]
            }
         ]
      };
      ec2.describeInstances(params, function(err, data) {
         if (err) {
            callback('describeInstances failed: ' + err);
         }
         else {
            var operations = [];
            var instanceIds = [];
            for (var reservationKey in data) {
               var reservation = data[reservationKey];
               for (var instanceKey in reservation) {
                  reservation[instanceKey]['Instances'].forEach(function(instance) {
                     instanceIds.push(instance.InstanceId);
                  });
               }
               if (instanceIds.length != 0) {
                  ec2.terminateInstances({ InstanceIds: instanceIds }, function(err, data) {
                     if(err) {
                        callback('terminateInstances failed: ' + err);
                     }
                     else {
                        callback(null, instanceIds);
                     }
                  });
               }
               else {
                  callback(null, instanceIds);
               }
            }
         }
      });
   }
   else {
      callback('Launch configuration not found: ' + launchConfigurationName);
   }
}
