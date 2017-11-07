/*
 * Launch an instance to be managed by Oeconomus
 */

const config = require('./includes/config');

const AWS = require('aws-sdk');

const launchConfigurations = config.getLaunchConfigurations();
AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

/*
launchInstance('do-1', 'scrum', function(err, result) {
   console.error(err);
   console.log(result);
});
*/

/*
tagVolumes('i-0c307e6d37ace7a2e', 'do-1', function() {
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
         var launchConfig = {
            SpotPrice: launchConfiguration.bid,
            InstanceCount: 1,
            InstanceInterruptionBehavior: 'stop',
            Type: 'persistent',
            LaunchSpecification: {
               ImageId: launchConfiguration.ami,
               SecurityGroupIds: launchConfiguration.securityGroups,
               InstanceType: launchConfiguration.instanceType,
               SubnetId: subnet,
               UserData: launchConfiguration.userData,
               KeyName: config.keyName,
               IamInstanceProfile: {
                  Name: launchConfiguration.role
               }
            }
         };
         ec2.requestSpotInstances(launchConfig, function(err, data) {
            if (err) {
               callback(err);
            }
            else {
               var requestId = data.SpotInstanceRequests[0].SpotInstanceRequestId;
               var state = data.SpotInstanceRequests[0].State;
               if (state == 'cancelled' || data.state == 'failed') {
                  callback('Spot instance request failed');
               }
               else {
                  var tags = [
                     {
                        Key: 'Name',
                        Value: name
                     },
                     {
                        Key: 'os-config',
                        Value: launchConfigurationName
                     }
                  ];
                  tagSpotInstance(requestId, tags, function(err) {
                     callback(err, data);
                  });
               }
            }
         });
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
                  tagVolumes(data.Instances[0].InstanceId, name, function() {
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

function tagSpotInstance(requestId, tags, callback) {
   setTimeout(function() {
      var params = {
         SpotInstanceRequestIds: [
            requestId
         ]
      };
      ec2.describeSpotInstanceRequests(params, function(err, data) {
         if (err) {
            console.log(err);
            callback('Error tagging spot instance (notify DevOps)');
         }
         else {
            if (data.SpotInstanceRequests.length == 0) {
               console.log('No spot instances');
               callback('Error tagging spot instance (notify DevOps)');
               return;
            }

            var instanceId = data.SpotInstanceRequests[0].InstanceId;
            if (data.SpotInstanceRequests[0].Status.Code == 'pending-fulfillment') {
               tagSpotInstance(requestId, tags, callback);
               return;
            }

            var operations = [];
            operations.push(new Promise(function(resolve, reject) {
               var params = {
                  Resources: [
                     requestId
                  ],
                  Tags: tags
               };
               ec2.createTags(params, function(err, data) {
                  if (err) {
                     console.log(err);
                     reject('Error tagging spot instance (notify DevOps)');
                  }
                  else {
                     console.log('tags created for ' + requestId);
                     resolve();
                  }
               });
            }));

            operations.push(new Promise(function(resolve, reject) {
               var params = {
                  Resources: [
                     instanceId
                  ],
                  Tags: tags
               };
               ec2.createTags(params, function(err, data) {
                  if (err) {
                     console.log(err);
                     reject('Error tagging spot instance (notify DevOps)');
                  }
                  else {
                     console.log('tags created for ' + instanceId);
                     resolve();
                  }
               });
            }));

            tags.forEach(function(tag) {
               if (tag.Key == 'Name') {
                  operations.push(new Promise(function(resolve, reject) {
                     tagVolumes(instanceId, tag.Value, function() {
                        resolve();
                     });
                  }));
               }
            });

            Promise.all(operations).then(callback).catch(callback);
         }
      });
   }, 5000);
}

function tagVolumes(instanceId, name, callback) {
   setTimeout(function() {
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
