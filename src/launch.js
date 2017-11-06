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

exports.launch = (event, callback) => {
   var parameters = event.queryStringParameters;
   if (parameters && parameters.name && parameters.launchConfig) {
      if (parameters.name.length > 0) {
         launchInstance(parameters.name, parameters.launchConfig, callback);
         return;
      }
   }
   callback('Invalid parameters');
};

//TODO: tag volumes
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
               callback(null, data);
            }
         });
      }
   }
   else {
      callback('Invalid launch configuration');
   }
}
