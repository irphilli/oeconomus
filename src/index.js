/*
 *  Lambda index module
 */

const rangeCheck = require('range_check');
const config = require('./includes/config');

exports.handler = (event, context, callback) => {
   // Check access
   var hasAccess = false;
   if (!config.ipAccess || config.ipAccess.length == 0) {
      hasAccess = true;
   }
   else if (event.requestContext && event.requestContext.identity) {
      var ip = event.requestContext.identity.sourceIp;
      if (ip == 'test-invoke-source-ip') {
         hasAccess = true;
      }
      else if (rangeCheck.inRange(ip, config.ipAccess)) {
         hasAccess = true;
      }
   }

   if (hasAccess) {
      var action;
      if (event.pathParameters) {
         action = event.pathParameters.action;
      }
      switch (action) {
         case 'get':
            const get = require('./get');
            get.get(function(err, res) {
               sendResponse(err, res, callback);
            });
            break;
         case 'terminate':
            const terminate = require('./terminate');
            terminate.terminate(event, function(err, res) {
               sendResponse(err, res, callback);
            });
            break;
         case 'launch':
            const launch = require('./launch');
            launch.launch(event, function(err, res) {
               sendResponse(err, res, callback);
            });
            break;
         default:
            callback(null, {
               statusCode: 400,
               body: 'unknown action ' + event.pathParameters.action,
               headers: {
                  'Access-Control-Allow-Origin': '*'
               }
//               body: JSON.stringify(event)
            });
      }
   }
   else {
      callback(null, {
         statusCode: 403,
         body: 'Access denied',
         headers: {
            'Access-Control-Allow-Origin': '*'
         }
      });
   }
};

function sendResponse(err, res, callback) {
   if (err) {
      callback(null, {
         statusCode: 400,
         body: JSON.stringify(err),
         headers: {
            'Access-Control-Allow-Origin': '*'
         }
      });
   }
   else {
      callback(null, {
         statusCode: 200,
         body: JSON.stringify(res),
         headers: {
            'Access-Control-Allow-Origin': '*'
         }
      });
   }
}

/*
var event = {
   pathParameters: { action: 'get' }
}
exports.handler(event, null, function(err, res) {
   console.log(err);
   console.log(res);
});
*/
