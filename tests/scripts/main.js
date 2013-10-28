require.config({
	"paths" : {
		"jquery" : "vendor/jquery/jquery",
		"server" : "vendor/server/server",
		"ajaxModule" : "modules/ajaxModule",
		"fileModule" : "modules/fileModule",
		"fakeModule" : "modules/fakeModule"
	}
});

require(["server, fakeModule"], function(server, fakeModule) {

	console.log("server has been initialized");
	
	server.init({
		modules: [fakeModule],
		serverUrl: 'url',
        useCache: true,
        dependencies: [],
        notificationDelegate: function(msg) {},
        errorDelegate: function(data) {},
        unhandledErrorDelegate: function(msg) {},
        messageDelegate: function(msg) {},
        offlineChangesAppliedDelegate: null,
        offlineChangesAddedDelegate: null,
        beforeServerCallDelegate: null,
        onAppOnlineDelegate: null,
        onAppOfflineDelegate: null,
        availableServices: [],
        techUsed: 'fake',
        showLoadingDelegate: null,
        hideLoadingDelegate: null
	});
	window.server = server;

});