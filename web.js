// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);
var jsforce = require('jsforce');

// requires mongo db for logging transactions
var mongo = require('mongodb');
// sets link to mongodb on heroku (and localhost???)
var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:5000/stripeLogs';


var emitter = new EventEmitter;
var app = express();

// converts json metadata into stripe transaction object
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
})

conn.login('keith@familiar-studio.com', 'KVWVXbwYUjbB33yDyh84HkGeL1fbW2ZDx0rnmu', function(err, res) {
  if (err) { return console.error(err); }
})


app.post('/webhook', function(request, response){

	var stripeCheckName = function(){
		var name = request.body.data.object.card.name;
		if (name !== null) {
			var name_array = name.split(' ');
			return {
				first_name: name_array[0], 
				last_name: name_array[name_array.length - 1]
			};
		} else {
			return {
				first_name: 'no first name listed',
				last_name: 'no last name listed'
			};
		};
	}


	var getStripeCustomer = function(option, stripe_id, sf_id) {
		console.log('GET STRIPE CUSTOMER', option)
		stripe.customers.retrieve(stripe_id, function(err, customer){
			console.log('EMAIL OBJECT', customer)
			if (option === 0){
				createNewSFContact(stripe_id, customer)
				// exit
			} else if (option === 1) {
				updateSFContactEmail(sf_id, stripe_id, customer)
				// exit
			}

		});

	}

	var createNewSFContact = function(stripe_id, customer){
		console.log("CREATE NEW SF CONTACT", customer.email)
		conn.sobject("Contact").create({ /* FirstName : stripeCheckName().first_name, LastName: stripeCheckName().last_name, */ Stripe_Customer_Id__c: stripe_id, Email: customer.email }, function(err, ret) {
	      if (err || !ret.success) { return console.error(err, ret); }
	      console.log("Created Contact With ID: " + ret.id);

	  });
	}


	var updateSFContactEmail = function(sf_id, stripe_id, customer){
		// console.log(">>>>>>>>> UPDATE SF CONTACT", customer.email)
		// console.log('>>>>>>>>> STRIPE_ID', stripe_id)
		// console.log('>>>>>>>>> SF_ID', sf_id)
		conn.sobject('Contact').update({
			Id: sf_id,
			Email: customer.email
		}, function(error, result){
			if (error || !ret.success) { return console.error(err, ret); }
			console.log('Updated Contact Email to:' + email);
		});
	}

	if (request.body.type === 'charge.succeeded') {
    var stripe_customer_id = request.body.data.object.customer;

		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_customer_id }, function(err, res) {
			if (res.length == 0) {
				// creates new user -- option 0
				getStripeCustomer(0, stripe_customer_id)
			} else {
				// updates existing user -- option 1
				getStripeCustomer(1, stripe_customer_id, res[0].Id)
			};
		});
	};
 
	if (request.body.type === 'customer.created' || request.body.type === 'customer.updated') {
		var stripeCustomerId = request.body.data.object.id
		var customer = request.body.data.object

		// console.log('========= CONTACT OBJECT:', customer)

		conn.sobject('Contact').query("SELECT Id, Name FROM Contact where Stripe_Customer_Id__c = "+stripeCustomerId+"", function(err, res) {

			console.log('SALES FORCE RESPONSE:', res )

			// console.log('========== RESPONSE EXISTENCE:', res.length)

			if (res.length == 0) {
				createNewSFContact(stripeCustomerId, customer);
			} else {
				updateSFContactEmail(res[0].Id, stripeCustomerId, customer);
			};
		});
	};

	response.send('OK');
	response.end();
});


var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
