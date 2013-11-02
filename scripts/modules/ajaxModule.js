define(["jQuery"], function(jQuery) {

	if (typeof jQuery  === 'undefined') {
       throw "Can't use ajax call since jquery is not defined";
    }

	//we want to return an object that has a call run method
	var module = function() {
		return {
			name: "ajax",
			run: function(data, parameters, onSuccess, onError) {
				jQuery.ajax({
					type: parameters.callType === 'GET' ? 'GET' : 'POST',
					dataType: parameters.dataType,
					data: JSON.stringify(data),
					url: parameters.urlToCall,
					timeout: parameters.timeout,
					contentType: parameters.contentType + "; charset=" + parameters.charset,
					success: function(data, textStatus, jqXHR) {
						onSuccess(data);
					},
					error: function(jqXHR, textStatus, errorThrown) {
						onError(jqXHR.status + " : " + jqXHR.statusText);
					}
				});
			}
		};
	};
	return module;
});