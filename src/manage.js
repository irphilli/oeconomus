/*
 * Stops/starts instances managed by Oeconomus
 */

const config = require('./includes/config');

const AWS = require('aws-sdk');
const time = require('time');

const launchConfigurations = config.getLaunchConfigurations();
AWS.config.loadFromPath(config.globalConfig);
const ec2 = new AWS.EC2({apiVersion: config.awsApiVersion});

var now = new time.Date();
now.setTimezone(config.timezone);

var hour = now.getHours();
var minute = now.getMinutes();

var result = {
   start: [],
   stop: []
};
var promises = [];
var mode;
for (var launchName in launchConfigurations) {
   mode = null;
   var schedule = launchConfigurations[launchName]['schedule'];
   if (schedule) {
      var startTime = new time.Date('1970-01-01T' + schedule['start']);
      var startHour = startTime.getUTCHours();
      var startMinute = startTime.getUTCMinutes();
      if (hour == startHour && minute == startMinute) {
         mode = 'start';
      }
      else {
         var stopTime = new time.Date('1970-01-01T' + schedule['stop']);
         var stopHour = stopTime.getUTCHours();
         var stopMinute = stopTime.getUTCMinutes();

         if (hour == stopHour && minute == stopMinute) {
            mode = 'stop';
         }
      }
   }

   if (mode != null) {
      var filterState = (mode == 'start') ? 'stopped' : 'running';
      var params = {
         Filters: [
            {
               Name: 'tag:os-config',
               Values: [
                  launchName
               ]
            },
            {
               Name: 'instance-state-name',
               Values: [ filterState ]
            }
         ]
      };
      var currentMode = mode;
      promises.push(new Promise(function(resolve, reject) {
         ec2.describeInstances(params, function(err, data) {
            if (err) {
               reject(err.stack);
            }
            else {
               for (var reservationKey in data) {
                  var reservation = data[reservationKey];
                  for (var instanceKey in reservation) {
                     reservation[instanceKey]['Instances'].forEach(function(instance) {
                        result[currentMode].push(instance.InstanceId);
                     });
                  }
               }
               resolve();
            }
         });
      }));
   }
}

Promise.all(promises).then(function() {
   var operations = [];
   if (result.start.length != 0) {
      var params = {
         InstanceIds: result.start,
         DryRun: false,
         Force: false
      };
      operations.push(new Promise(function(resolve, reject) {
         ec2.startInstances(params, function(err, data) {
            if (err) {
               reject(err);
            }
            else {
               resolve();
            }
         });
      }));
   }

   if (result.stop.length != 0) {
      var params = {
         InstanceIds: result.stop,
         DryRun: false,
         Force: false
      };
      operations.push(new Promise(function(resolve, reject) {
         ec2.stopInstances(params, function(err, data) {
            if (err) {
               reject(err);
            }
            else {
               resolve();
            }
         });
      }));
   }

   Promise.all(operations).then(function() {
      console.log(result);
   }).catch(console.error);
}).catch(console.error);
