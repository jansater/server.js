define([], function() {

	//we want to return an object that has a call run method
	
		return {
			name: "cordova",
			run: function(data, parameters, onSuccess, onError) {
				window.plugins.serverRequest.post(params, function(data) {
                        onSuccess(data);
                    }, function(data) {
                        onError(data.msg);
                    });
			}
		};
	
});