// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var q = require('q'); 

var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);
var jsforce = require('jsforce');

var moment = require('moment');

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



conn.login('keith@familiar-studio.com', 'mNc67LcijiPhjWp5Mot26qP5mZAKlkZCyTIXSIE4', function(err, res) {

  if (err) { return console.error("I AM BROKEN, YO"); } console.log("connected!")
})


app.post('/webhook', function(request, response){

	var stripeCheckName = function(name){
		//adding swtich case
		
		console.log("THIS IS THE NAME", name)
		if (typeof name == 'string') {
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
		// TODO: get name from card for createOpportunity Invocation
	}




	var stripeId2SalesContact = function(stripe_id){
		console.log("hello, I am inside!")
		  var deferred = q.defer();
		conn.sobject('Contact').find({ Stripe_Customer_Id__c : stripe_id }).limit(1).execute(function(err, res) {
			console.log("RESULT", res.length)
			
	        if (res.length == 0) {
	        	console.log("this means no contact in SF")
	        	stripe.customers.retrieve(stripe_id, function(err, customer){
	        		console.log("this is the email:", customer.metadata.Email)
	        		conn.sobject('Contact').find({ Email : customer.metadata.Email }).limit(1).execute(function(err, res) {
	 					
	        			if (res.length == 0){
	        				console.log("this means no contact but checking for email")
        					conn.sobject("Contact").create({ FirstName : stripeCheckName(customer.metadata.Name).first_name, LastName: stripeCheckName(customer.metadata.Name).last_name,  Stripe_Customer_Id__c: stripe_id, Email: customer.email }, function(err, ret) {
        						console.log("%%%%RETURN", ret)
        				      if (err || !ret.success) { return console.error(err, ret); }
        				      console.log("Created Contact With ID: " + ret.id, 'And Email:' + customer.email);
        				      deferred.resolve(ret);
        				  	});
	        			}else{
	        				var sfContactId = res[0].Id

	        				console.log("there was email and now updating", sfContactId)


        					stripe.customers.retrieve(stripe_id, function(err, customer){
        				    	conn.sobject('Contact').update({
        				            Id: sfContactId,
        				            FirstName : stripeCheckName(customer.metadata.Name).first_name,
        				            LastName: stripeCheckName(customer.metadata.Name).last_name,
        				            Stripe_Customer_Id__c : stripe_id
        				        }, function(error, result){
        				            if (error || !ret.success) { return console.error(err, ret); }
        				            console.log('Updated Contact Email to:' + customer.metadata.Email);
        				            deferred.resolve(ret);
        				        });

        				   });
	        			}
					});			            	
	        	})
	        } else {
	        	var sfExistingId = res[0].Id
	        	console.log("CONTACT ALREADY EXITS")
	        	stripe.customers.retrieve(stripe_id, function(err, customer){
	            	conn.sobject('Contact').update({
	                    Id: sfExistingId,
	                    Email: customer.email
	                }, function(error, result){
	                    if (error || !ret.success) { return console.error(err, ret); }
	                    console.log('Updated Contact Email to:' + customer.metadata.Email);
	                     deferred.resolve(ret);
	                });
	           });
	        };
	    });
		return deferred.promise;
	}
		
	var salesContact2Account = function(stripe_id){
		console.log("HELO I AM INSIDE SALESCONTACT2ACCOUNT")
		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
        console.log("THIS IS THE ACCOUNT ID:###################", res[0].AccountId)
          return res[0].AccountId
        });

	}


		if (request.body.type === 'charge.succeeded') {
 			// WAIT UNTIL INVOKED BY CUSTOMER VALIDATION
 			var stripe_id = request.body.data.object.customer;
 			console.log("STRIPE ID", stripe_id)
 			stripeId2SalesContact(stripe_id).then(function(){salesContact2Account(stripe_id)})

 		};






	response.send('OK');
	response.end();
});


var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
