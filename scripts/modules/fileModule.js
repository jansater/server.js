define([], function() {

	//we want to return an object that has a call run method
	
		return {
			name: "file",
			run: function(input, parameters, onSuccess, onError) {
				var getParams = JSON.stringify(input);
				urlToCall += "?data=" + getParams;
				window.location = urlToCall;
			}
		};
	
});