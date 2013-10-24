require.config({
	"paths" : {
		"jquery" : "vendor/jquery/jquery",
		"server" : "vendor/server/server"
	}
});

require(["server"], function(server) {

	console.log("server has been initialized");
	
	window.server = server;

});