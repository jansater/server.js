define(["jquery"], function(jQuery) {

	if (typeof jQuery  !== 'undefined') {
		if (typeof(jQuery.connection) !== 'undefined' && jQuery.connection.hub) {
			jQuery.connection.hub.logging = false;

			jQuery.connection.hub.stateChanged(function (change) {
				if (change.newState === jQuery.signalR.connectionState.reconnecting) {
					console.log('Client re-connecting');
				}
				else if (change.newState === jQuery.signalR.connectionState.connected) {
					console.log('The server is online');
				}
				else {
					console.log('new state = ' + change.newState);
				}
			});

			jQuery.connection.hub.error(function (error) {
                        //unhandled signalr exception...
                        showErrorMsg("A connection problem occurred during the last operation", "error");

                        //call the normal unhandled error handler
                        if (unhandledErrorDelegate) {
                        	unhandledErrorDelegate(error, "SignalR");
                        }

                    });

			jQuery.connection.hub.starting = function () {
				console.log("on starting");
			};

			jQuery.connection.hub.received = function () {
				console.log("on received");
			};

			jQuery.connection.hub.connectionSlow = function () {
				console.log("on connection slow");
                        //let the user know that we are having some problems with the connection
                    };

                    jQuery.connection.hub.reconnecting = function () {
                    	console.log("on reconnecting");
                    };

                    jQuery.connection.hub.reconnected(function () {
                    	console.log('Client reconnected');
                    });

                    jQuery.connection.hub.disconnected(function () {

                    });
                }
            }

	//we want to return an object that has a call run method
	var module = function() {
		return {
			name: "signalr",
			run: function(input, parameters, onSuccess, onError) {
				if (!parameters.serverMethodToCall) {
					console.log("ERROR - you have not defined serverMethod for the server.call method so there is no method to call on the server side.");
					return;
				}

				parameters.serverMethodToCall(input).done(function (data) {
					onSuccess(data);
				}).fail(function (errorThrown) {
					onError(errorThrown.msg);
				});
			}
		};
	};
	return module;
});