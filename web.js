// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var stripe = require('stripe');
var jsforce = require('jsforce');



var mongo = require('mongodb');
// var databaseUrl = 'stripeLogs'
// var collection = ['stripeReq']

// var db = mongo.connect(databaseUrl, collection)


// stripe.setApiKey('sk_test_bY22es5dN0RpWmJoJ5VlBQ5E')

var emitter = new EventEmitter;
var app = express();

app.use(express.bodyParser());

app.use(app.router);

app.use(logfmt.requestLogger());

// Salesforce Connection information
var conn = new jsforce.Connection({
  oauth2 : {
    clientId : '3MVG9y6x0357HleeZ5WRMCv.Ih7Uxos6mg6Y.7N3RdXzC15h..L4jxBOwzB79dpcRSxwpV3.OgbNXSSJiobQQ',
    clientSecret : '8923954381316425368',
    redirectUri : 'https://stripe2salesforce.herokuapp.com',
    //proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'

  },
//  proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
});

conn.login('keith@familiar-studio.com', 'KVWVXbwYUjbB33yDyh84HkGeL1fbW2ZDx0rnmu', function(err, res) {
  if (err) { return console.error(err); }
});



var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:27017/mydb';

app.get('/', function(reqest, res) {
	mongo.Db.connect(mongoUri, function(err, db) {
		console.log(db)
		db.collection('stripeLogs', function(er, collection) {
			collection.insert({'stripeReq':request.body})
		})
	});
});

app.post('/webhook', function(request, response){
	if (request.body.type === 'charge.succeeded') {
		fs.appendFile('wow.txt', JSON.stringify(request.body, null, 4), function(err){
			if (err) {
				console.log('error!', err);
			} else {
				console.log('yaaaaaayy!! saved!' )
			}
		});


	}else{
		console.log('noooooooo!!!!')
	}
	// console.log("RAW RESPONSE:", response);
	// console.log("request*******", request.body);
	response.send('OK');
	response.end()
});


app.get('/salesforce/read', function(request, response) {
  console.log('Read!' );
  conn.query('SELECT Id, FirstName, LastName FROM Contact limit 10', function(err, res) {
    if (err) { return console.error(err); }
    console.log(res);
  });

});

app.get('/salesforce/insert', function(request, response) {
  console.log('Insert!' );
  conn.sobject("Contact").create({ FirstName : 'Test2', LastName: 'Faker', Stripe_Customer_Id__c: 'cus_3oiBOE7BELbxj2' }, function(err, ret) {
    if (err || !ret.success) { return console.error(err, ret); }
    console.log("Created record id : " + ret.id);
    // ...
  });

});

var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
