const fs = require('fs');


const configDir = 'etc';
const globalConfig = configDir + '/config.json';
const launchConfigDir = configDir + '/LaunchConfigurations';

const globalConfigContents = JSON.parse(fs.readFileSync(globalConfig));

module.exports = {
   awsApiVersion: '2016-11-15',
   globalConfig: configDir + '/config.json',
   timezone: globalConfigContents.timezone,
   keyName: globalConfigContents.keyName,
   ipAccess: globalConfigContents.ipAccess,
   getLaunchConfigurations: function () {
      var result = {}
      fs.readdirSync(launchConfigDir).forEach(file => {
         if (file.endsWith('.json')) {
            const name = file.replace(/\.json$/, '');
            const contents = fs.readFileSync(launchConfigDir + '/' + file);
            // TODO: validate configuration
            result[name] = JSON.parse(contents);
         }
      });
      return result;
   }
};
