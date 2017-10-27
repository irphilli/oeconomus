/*
 * Gets info about all instances managed by Oeconomus
 */

const config = require('./includes/config');

const AWS = require('aws-sdk');

const launchConfigurations = config.getLaunchConfigurations();
AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

exports.get = (callback) => {
   var result = {
      launchConfigurations: launchConfigurations,
      instances: {}
   };
   var promises = [];
   for (var launchName in launchConfigurations) {
      result['instances'][launchName] = [];
      var params = {
         Filters: [
            {
               Name: 'tag:os-config',
               Values: [ launchName ]
            },
            {
               Name: 'instance-state-name',
               Values: [ 'running' ]
            }
         ]
      };
      promises.push(new Promise(function(resolve, reject) { 
         var currentLaunchName = launchName;
         ec2.describeInstances(params, function(err, data) {
            if (err) {
               reject(err.stack);
            }
            else {
               for (var reservationKey in data) {
                  var reservation = data[reservationKey];
                  for (var instanceKey in reservation) {
                     reservation[instanceKey]['Instances'].forEach(function(instance) {
                        result['instances'][currentLaunchName].push(instance);
                     });
                  }
               }
               resolve();
            }
         });
      }));
   };

   Promise.all(promises).then(function() {
      callback(null, {
         statusCode: 200,
         body: JSON.stringify(result)
      });
   }).catch(function(err) {
      callback(null, {
         statusCode: 400,
         body: err
      });
   });
};
