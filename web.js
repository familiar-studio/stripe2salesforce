// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var q = require('q'); 

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



var stripeCheckName = function(name){
	console.log("FULL NAME", name)
	if (typeof name == 'string') {
		var name_array = name.split(' ');

		if (name_array.length == 1) {
			return {first_name: '', last_name: name_array.join(' ')}
		} else {
			return {
				first_name: name_array.slice(0, (name_array.length - 1)).join(' '), 
				last_name: name_array[name_array.length - 1]
			};
		}
	} else {
		return {
			first_name: 'no first name listed',
			last_name: 'no last name listed'
		};
	};
}

var stripeId2SalesContact = function(stripe_id){
	console.log('CREATING / UPDATING CONTACT')
	var deferred = q.defer();

	stripe.customers.retrieve(stripe_id, function(err, customer){

		if (customer.metadata.email == null){
			var name = 'anonymous';
		} else {
			var name = customer.metadata.Name;
		}
		
		conn.sobject('Contact').find({ Stripe_Customer_Id__c : stripe_id }).limit(1).execute(function(err, res) {
	    if (res.length == 0) {
    		conn.sobject('Contact').find({ Email : customer.email }).limit(1).execute(function(err, res) {
    			if (res.length == 0){
  					conn.sobject("Contact").create({ 
  						FirstName : stripeCheckName(name).first_name, 
  						LastName: stripeCheckName(name).last_name,  
  						Stripe_Customer_Id__c: stripe_id, 
  						Email: customer.email,
  						RecordTypeId: client_ids.contactRecord,  
  					}, function(err, ret) {
  				    if (err || !ret.success) { return console.error(err, ret); }
  				    console.log("Created Contact With ID: " + ret.id, 'And Email:' + customer.email);
  				    deferred.resolve(ret);
				  	});
    			} else {
    				var sfContactId = res[0].Id
			    	conn.sobject('Contact').update({
	            Id: sfContactId,
	            FirstName : stripeCheckName(name).first_name,
	            LastName: stripeCheckName(name).last_name,
	            Stripe_Customer_Id__c : stripe_id,
	            RecordTypeId: client_ids.contactRecord
		        }, function(error, ret){
	            if (error || !ret.success) { return console.error(err, ret); }
	            console.log('Updated Customer found by Email:' + customer.email);
	            deferred.resolve(ret); 
		        });
    			};
				});			            	
	    } else {
	    	var sfExistingId = res[0].Id
	    	conn.sobject('Contact').update({
	        Id: sfExistingId,
	        Email: customer.email,
	        RecordTypeId: client_ids.contactRecord
	      }, function(error, ret){
					if (error || !ret.success) { return console.error(err, ret); }
					console.log('Updated Contact found by customer_id to:' + customer.email);
					deferred.resolve(ret);
	      });
	    };
	  });
  });
	return deferred.promise;
}


var createOpp = function(amount, charge_id, date, account_id, contract_id){
	console.log('CREATING OPPORTUNITY')
	console.log("THIS IS THE CONTRACT ID SENT FROM SUB", contract_id)
	console.log("1. amount", amount)
	console.log("2. stripe charge id", charge_id)
	console.log("3. date", date)
	console.log("4. account id", account_id)
	console.log("5. contact id", contract_id)
	console.log("6. record type", client_ids.opportunityRecord)
	if (contract_id){
		console.log("I AM A SUB TRYING TO MAKE AN OPP")
		conn.sobject("Opportunity").create({ 
			Amount: (amount/100), 
			Stripe_Charge_Id__c: charge_id, 
			Name: "Old Subscription, new charge",
			StageName: "Closed Won",
			CloseDate: date,
			AccountId: account_id,
			Contract__c: contract_id,
			RecordTypeId: client_ids.opportunityRecord

		}, function(error, ret){
			if (err || !ret.success) { return console.error(err, ret); }
			console.log('new opportunity created from new contract: ', ret.id)
		});

	}else{
		console.log("I AM A SINGLE OPP BEING MADE")
		conn.sobject("Opportunity").create({ 
			Amount: (amount/100), 
			Stripe_Charge_Id__c: charge_id, 
			Name: "single charge",
			StageName: "Closed Won",
			CloseDate: date,
			AccountId: account_id,
			RecordTypeId: client_ids.opportunityRecord 

		
		}, function(error, ret){
			if (err || !ret.success) { return console.error(err, ret); }
			console.log('single charge opportunity created')
		});
	};
}

	
var salesContact2Contract = function(chargeObj){
	console.log('MOVING FROM CONTACT TO CONTRACT')
	var stripe_id = chargeObj.customer;
	var invoice = chargeObj.invoice;
	var amount = chargeObj.amount;
	var charge_id = chargeObj.charge_id; 

	if (invoice !== null) {
		stripe.invoices.retrieve( invoice, function(err, response){
			var sub_id = response.subscription 

			conn.sobject('Contract').find({ Stripe_Subscription_Id__c : sub_id }).limit(1).execute(function(err, res){
				if (res.length === 0) {
	  			conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
	  			  conn.sobject('Contract').create({ 
	  			  	AccountId : res[0].AccountId, 
	  			  	Stripe_Subscription_Id__c : sub_id,
	  			  	RecordTypeId: client_ids.contractRecord 
	  			  }, function(err, ret){
	  			  	conn.sobject('Contract').find({ 'Id' : ret.id }).limit(1).execute(function(err, result) { 
								var contract_id = result[0].Id;		  
								var account_id = result[0].AccountId;
								var date = result[0].CreatedDate;

								createOpp(amount, charge_id, date, account_id, contract_id)
	  			  	});
	  			  });
	  			});
				} else {
					var contract_id = res[0].Id;
					var account_id = res[0].AccountId;
					var date = res[0].CreatedDate;

					createOpp(amount, charge_id, date, account_id, contract_id) //this is untestable a tthe moment
	  		};
	  	});
		});

	} else {
		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
	    var account_id = res[0].AccountId;
	   	var date = res[0].CreatedDate;

	   	createOpp(amount, charge_id, date, account_id);
		});
	};
}

// ========================================
//                   DEV
// ========================================

var conn;
var client_ids;
var stripe;

var loginDevelopment = function(){	
	var deferred = q.defer()

	stripe = require("stripe")(
	 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
	);

	conn = new jsforce.Connection({
	  oauth2 : {
	    clientId : '3MVG9y6x0357HleeZ5WRMCv.Ih7Uxos6mg6Y.7N3RdXzC15h..L4jxBOwzB79dpcRSxwpV3.OgbNXSSJiobQQ',
	    clientSecret : '8923954381316425368',
	    redirectUri : 'https://stripe2salesforce.herokuapp.com',
	    //proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'

	  },
	//  proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
	})

	conn.login('keith@familiar-studio.com', 'mNc67LcijiPhjWp5Mot26qP5mZAKlkZCyTIXSIE4', function(err, res) {
	  if (err) { return console.error("I AM BROKEN, YO"); } 
	  console.log("connected to DEVELOPMENT")
	  deferred.resolve(res)
	})
	return deferred.promise;
}



app.post('/webhook', function(request, response) {

	client_ids = {
		contactRecord : '012E00000005wuF',
		contractRecord : '012E00000005wsT',
		opportunityRecord : '012E00000005wqS'
	}

	if (request.body.type === 'charge.succeeded' ) {

		var chargeSucceeded = request.body

		loginDevelopment().then(function(){

			
			var chargeObj = {
				customer: chargeSucceeded.data.object.customer,
				invoice: chargeSucceeded.data.object.invoice,
				amount: chargeSucceeded.data.object.amount,
				charge_id: chargeSucceeded.data.object.id
			};

			conn.sobject('Opportunity').find({ 'Stripe_Charge_Id__c' : chargeObj.charge_id }).limit(1).execute(function(err, res) {
				if (res.length === 0){

					stripeId2SalesContact(chargeObj.customer).then(function(){

						salesContact2Contract(chargeObj);

					});
				} else {
					console.log('CHARGE ALREADY EXISTS IN SALES FORCE')
				};

			});

			mongo.Db.connect(mongoUri, function(err, db) {
				// may be viewed at bash$ heroku addons:open mongolab
	 			db.collection('stripeLogs', function(er, collection) {
	 				collection.insert({'stripeReq':chargeSucceeded}, function(err, result){
	 					console.log(err);

	 				});
				});
			});
		});
	};
//log error back to stripe
	response.send('OK');
	response.end();
});

// ========================================
//              CHANGE MACHINE
// ========================================

var loginChangeMachine = function(){
	var deferred = q.defer()

	stripe = require("stripe")(
	 "sk_test_GrcQGm7NZntXmQh2X2o9Krrf"
	);

	conn = new jsforce.Connection({
	  oauth2 : {
	    clientId : '3MVG9GiqKapCZBwGoBHg5mgHLOya8ZmSFbD__GwluFQ_oPkcjmNWdNClzSMTfxZIey7ZWtKMF3xGm5X3fqg2H',
	    clientSecret : '6117747355402425276',
	    redirectUri : 'https://stripe2salesforce.herokuapp.com',
	    loginUrl : 'https://test.salesforce.com',
	    //proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'

	  },
	//  proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
	})

	conn.login('keith+changemachine@familiar-studio.com.change', 'eEyfN6Yr8t2GEcATmMirLMR9TxZbPYnJ8X4', function(err, res) {
	  if (err) { return console.error("I AM BROKEN, YO", err); };
	  console.log("connected to CHANGE MACHINE");
	  deferred.resolve(res);
	})
	return deferred.promise;
}

app.post('/webhook/changeMachine', function(request, response) {

	client_ids = {
		contactRecord : '012G000000127om',
		contractRecord : '012Z0000000D284',
		opportunityRecord : '012Z0000000D289'
	};

	if (request.body.type === 'charge.succeeded' ) {
		var chargeSucceeded = request.body;
		loginChangeMachine().then(function(){

			console.log('EXECUTING SALES FORCE LOGIC')
			
			var chargeObj = {
				customer: chargeSucceeded.data.object.customer,
				invoice: chargeSucceeded.data.object.invoice,
				amount: chargeSucceeded.data.object.amount,
				charge_id: chargeSucceeded.data.object.id
			};

			console.log('CHARGE OBJ:', chargeObj)

			conn.sobject('Opportunity').find({ 'Stripe_Charge_Id__c' : chargeObj.charge_id }).limit(1).execute(function(err, res) {

				if (res.length === 0){
					// var stripe_id = chargeSucceeded.data.object.customer;

					stripeId2SalesContact(chargeObj.customer).then(function(){

						salesContact2Contract(chargeObj);

					});
				} else {
					console.log('CHARGE ALREADY EXISTS IN SALES FORCE');
				};

			});

			mongo.Db.connect(mongoUri, function(err, db) {
				// may be viewed at bash$ heroku addons:open mongolab
	 			db.collection('stripeLogs', function(er, collection) {
	 				collection.insert({'stripeReq':chargeSucceeded}, function(err, result){
	 					console.log(err);

	 				});
				});
			});
		});
	};

	response.send('OK');
	response.end();
})






var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
