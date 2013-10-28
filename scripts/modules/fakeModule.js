define([], function() {

	//we want to return an object that has a call run method
	var module = function() {
		return {
			name: "fake",
			run: function(input, parameters, onSuccess, onError) {
				console.log("Fake module called with input");
				console.log(input);
				console.log(" and parameters");
				console.log(parameters);
				onSuccess({code: 0});
			}
		};
	};
	return module;
});