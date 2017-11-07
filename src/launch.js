/*
 * Launch an instance to be managed by Oeconomus
 */

const config = require('./includes/config');

const AWS = require('aws-sdk');

const launchConfigurations = config.getLaunchConfigurations();
AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

/*
launchInstance('do-1', 'developer', function(err, result) {
   console.error(err);
   console.log(result);
});
*/

/*
tagVolumes('do-1', 'i-0c307e6d37ace7a2e', function() {
   console.log('done');
});
*/

/*
checkCanLaunchInstance('pphillips', 'developer', function(canLaunch, reason) {
   console.log(canLaunch);
   console.log(reason);
});
*/

exports.launch = (event, callback) => {
   var parameters = event.queryStringParameters;
   if (parameters && parameters.name && parameters.launchConfig) {
      if (parameters.name.length > 0) {
         checkCanLaunchInstance(parameters.name, parameters.launchConfig, function(canLaunch, reason) {
            if (canLaunch) {
               launchInstance(parameters.name, parameters.launchConfig, callback);
            }
            else {
               callback(reason);
            }
         });
      }
      else {
         callback('Invalid parameters');
      }
   }
   else {
      callback('Invalid parameters');
   }
};

function checkCanLaunchInstance(name, launchConfigurationName, callback) {
   var launchConfiguration = launchConfigurations[launchConfigurationName];
   if (launchConfiguration) {
      var result = false;
      var reason = 'unknown';

      // First, check that name matches config constraints
      if (launchConfiguration.nameMatch) {
         var nameMatchPass = false;
         launchConfiguration.nameMatch.forEach(function(regexString) {
            var regex = new RegExp(regexString);
            if (regex.test(name)) {
               nameMatchPass = true;
            }
         });

         if (!nameMatchPass) {
            callback(false, 'Invalid name: ' + name);
            return;
         }
      }

      // Make sure instance doesn't already exist
      var operations = [];

      var params = {
         Filters: [
            {
               Name: 'tag:Name',
               Values: [ name ]
            },
            {
               Name: 'instance-state-name',
               Values: [ 'pending', 'running', 'stopping', 'stopped' ]
            }
         ]
      };

      operations.push(new Promise(function(resolve, reject) {
         ec2.describeInstances(params, function(err, data) {
            if (err) {
               reason = err;
            }
            else {
               if (data.Reservations.length == 0) {
                  result = true;
               }
               else {
                  reason = 'Instance with name ' + name + ' already exists.';
               }
            }
            resolve();
         });
      }));

      Promise.all(operations).then(function() {
         callback(result, reason);
      });
   }
   else {
      callback(false, 'Invalid launch configuration');
   }
}

function launchInstance(name, launchConfigurationName, callback) {
   var launchConfiguration = launchConfigurations[launchConfigurationName];
   if (launchConfiguration) {
      // get a random subnet id
      var subnet = launchConfiguration.subnets[Math.floor(Math.random()*launchConfiguration.subnets.length)];

      if (launchConfiguration.spot) {
      }
      else
      {
         var launchConfig = {
            ImageId: launchConfiguration.ami,
            MaxCount: 1,
            MinCount: 1,
            SecurityGroupIds: launchConfiguration.securityGroups,
            InstanceType: launchConfiguration.instanceType,
            SubnetId: subnet,
            UserData: launchConfiguration.userData,
            KeyName: config.keyName,
            IamInstanceProfile: {
               Name: launchConfiguration.role
            },
            TagSpecifications: [
               {
                  ResourceType: 'instance',
                  Tags: [
                     {
                        Key: 'Name',
                        Value: name
                     },
                     {
                        Key: 'os-config',
                        Value: launchConfigurationName
                     }
                  ]
               }
            ]
         };
         ec2.runInstances(launchConfig, function(err, data) {
            if (err) {
               callback('runInstances failed: ' + err);
            }
            else {
               var operations = [];
               operations.push(new Promise(function(resolve, reject) {
                  tagVolumes(name, data.Instances[0].InstanceId, function() {
                     resolve();
                  });
               }));
               Promise.all(operations).then(function() {
                  callback(null, data);
               });
            }
         });
      }
   }
   else {
      callback('Invalid launch configuration');
   }
}

function tagVolumes(name, instanceId, callback) {
   var params = {
      Filters: [
         {
            Name: "attachment.instance-id",
            Values: [
               instanceId
            ]
         }
      ]
   };

   setTimeout(function() {
      ec2.describeVolumes(params, function(err, data) {
         if (err) {
            // Log, but continue
            console.error(err);
            callback();
         }
         else {
            var operations = [];
            data.Volumes.forEach(function(volume) {
               operations.push(new Promise(function(resolve, reject) {
                  var params = {
                     Resources: [
                        volume.VolumeId
                     ],
                     Tags: [
                        {
                           Key: "Name",
                           Value: name
                        }
                     ]
                  };
                  ec2.createTags(params, function(err, data) {
                     if (err) {
                        // Log, but continue
                        console.error(err);
                        resolve();
                     }
                     else {
                        console.log('tag created for ' + volume.VolumeId);
                        resolve();
                     }
                  });
               }));
            });
            Promise.all(operations).then(function() {
               callback();
            });
         }
      });
   }, 3000);
}
