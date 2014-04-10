define(["jquery"], function(jQuery) {

	if (typeof jQuery  === 'undefined') {
       throw "Can't use ajax call since jquery is not defined";
    }

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
});