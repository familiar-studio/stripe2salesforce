var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);

// get email. in email callback, create new user, from create new user's callback, validate function






var getStripeEmail = function(option, stripe_id) {
	stripe.customers.retrieve(/* stripe_id, */ 'cus_3pPXbquFxtJsmH', function(err, customer){
		var email = customer.email
		if (option == 1){
			updateSFContact(email)
			break
		} else if (option == 2) {
			createSFcontatc(email)
			break
		}

	});

}