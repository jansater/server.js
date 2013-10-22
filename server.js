function OfflineKey(address, params) {
    var _address = address;
    var _params = params;
    var _key = calcMD5(ko.toJSON({ address: address, params: params }));

    return {

        getCacheKey : function() {
            return _key;
        },
        getAddress : function() {
            return _address;
        },
        getParams : function() {
            return _params;
        }
    }
}

function serverPrototype() {

    var SERVER_URL = "not_set/";
    var serviceNotificationDelegate = null;
    var serviceErrorDelegate = null;
    var unhandledErrorDelegate = null;
    var messageDelegate = null;
    var offlineChangesAppliedDelegate = null;
    var offlineChangesAddedDelegate = null;
    var beforeServerCallDelegate = null;
    var onAppOfflineDelegate = null;
    var onAppOnlineDelegate = null;
    var techUsed = 'ajax'
    var loggingEnabled = true;
    var serviceUseCache = true;
    var offlineItems = null;
    var showLoadingDelegate = null;
    var hideLoadingDelegate = null;
    var currentServerCall = null;
    var isOffline = false;
    var allServices = [];
    var serviceDependencies = [];
    var isBusy = false;
    
    try {
        var offlineItemsAsString = localStorage.getItem("offlinePackage");
        if (offlineItemsAsString != null) {
            offlineItems = JSON.parse(offlineItemsAsString);
        }
    } catch (e) {
        console.log("Failed to read offlinePackage from local storage: " + e);
    }

    var offlinePackage = new Array();
    if (offlineItems != null) {
        offlinePackage.concat(offlineItems);
    }
    
    var abortAnyPendingServerCalls = function () {
        if (currentServerCall && currentServerCall.readyState != 4) {
            currentServerCall.abort();
            currentServerCall = null;
        }
        isBusy = false;
    };

    var handleSuccess = function (orgCall, address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler) {

        var wasHandledUsingCache = (offlineKey == null && orgCall.callType == "GET");

        if (loggingEnabled && writeToLog) {
            console.log("Got result for " + address + ":" + data);
        }

        
        if (data.code > 0) {

            if (exceptionHandler) {
                var handled = exceptionHandler(Globalize.localize(data.code), errorElementId, data.code, '');
                if (!handled) {
                    internalHandleError(data, errorElementId);
                }
                else {
                    if (hideLoadingDelegate) {
                        hideLoadingDelegate();
                    }
                }
            }
            else {
                internalHandleError(data, errorElementId);
            }

            //The call returned an error code but we still want to add this call to the cache so that we can keep working in offline mode
            try {
                if (offlineKey != null) {
                    if (writeToLog) {
                        console.log("Adding offlinekey to local storage: " + offlineKey.getCacheKey() + " to address: " + offlineKey.getAddress());
                    }

                    var storedAddressCache = localStorage.getItem(offlineKey.getAddress());
                    if (storedAddressCache == null) {
                        storedAddressCache = {};
                    }
                    else {
                        storedAddressCache = JSON.parse(storedAddressCache);
                    }

                    storedAddressCache[offlineKey.getCacheKey()] = { time: new Date(), data: data };
                    localStorage.setItem(offlineKey.getAddress(), ko.toJSON(storedAddressCache));
                }
            } catch (e) {
                console.log("Failed to save item to cache: " + e);
            }

            return;
        }
        

        /* Do we need to update our cache?...never remove cache if we are in offline mode since thats the only data we have to work with */
        if (server.isOnline() && !wasHandledUsingCache) {
            for (var i = 0; i < serviceDependencies.length; i++) {
                var dependency = serviceDependencies[i];
                if (dependency.name == address) {
                    //clear the cache for the dependent services
                    for (var j = 0; j < dependency.dependentServices.length; j++) {
                        var dependentService = dependency.dependentServices[j];
                        //will remove all cached items under this address
                        if (writeToLog) {
                            console.log("Removing cache for service: " + dependentService);
                        }
                        localStorage.removeItem(dependentService); //this will remove all service calls against this address
                    }
                }
            }
        }

        if (successHandler) {

            try {
                if (offlineKey != null) {

                    if (writeToLog) {
                        console.log("Adding offlinekey to local storage: " + offlineKey.getCacheKey() + " to address: " + offlineKey.getAddress());
                    }

                    var storedAddressCache = localStorage.getItem(offlineKey.getAddress());
                    if (storedAddressCache == null) {
                        storedAddressCache = {};
                    }
                    else {
                        storedAddressCache = JSON.parse(storedAddressCache);
                    }

                    storedAddressCache[offlineKey.getCacheKey()] = { time: new Date(), data: data };
                    localStorage.setItem(offlineKey.getAddress(), ko.toJSON(storedAddressCache));
                }
            } catch (e) {
                console.log("Failed to save item to cache: " + e);
            }

            data.wasHandledUsingCache = wasHandledUsingCache;

            if (!orgCall.forceUpdate && wasHandledUsingCache && serviceNotificationDelegate != null) {
                serviceNotificationDelegate(orgCall);
            }

            successHandler(data);
        }
    };

    var internalHandleError = function(data, elementId) {
        if (hideLoadingDelegate) {
            hideLoadingDelegate();
        }

        if (serviceErrorDelegate != null) {
            var handled = serviceErrorDelegate(data.code, data.ErrorMessage);
            if (handled) {
                return;
            }
        }

        if (data != null) {
            showErrorMsg(Globalize.localize(data.code), elementId);
        }
        return false;
    };

    var sendOfflineItem = function (index) {
            var item = server.getOfflinePackage().item(index);

            if (item == null) {
                if (offlineChangesAppliedDelegate) {
                    offlineChangesAppliedDelegate();
                }
                return;
            }

            server.call(
            {
                callType: "POST",
                availableOffline: false,
                address: item.address,
                params: item.params,
                waitMessage: "gen_saving",
                writeToLog: false,
                successHandler: function (data) {
                    console.log("Offline item: " + item + " went though successfully.");

                            //ok the item went through...remove it from the source
                            server.getOfflinePackage().splice(index, 1);

                            //then start with the next one...should be the same index
                            server.sendOfflineItem(index);
                        },
                        exceptionHandler: function (exception, elementId) {
                            console.log("Offline item: " + item + " failed miserably.");

                            //OPTION 1: try with the next one
                            //server.sendOfflineItem(index++, context);

                            //OPTION 2: remove and take the next one
                            server.getOfflinePackage().slice(index, 1);
                            //then start with the next one...should be the same index
                            server.sendOfflineItem(index);
                        },
                        unhandledErrorHandler: function (param1, param2, param3) {
                            console.log("Unhandled exception occurred while sending offline package to server: " + param1);
                            server.sendOfflineItem(index++);
                        }
                    }
                    );
        };

    /*
    * CallType: [GET or POST:string]
    * Returns: { handledOffline: bool, offlineKey: string, data: json }
    */
    var tryHandleOffline = function (callType, address, params, writeToLog, successHandler) {

        var returnVal = {
            handledOffline: false,
            offlineKey: null,
            data: null
        };

        //1. if this is a GET call then try to get from cache
        //2. if this is a POST call then add it to a queue

        if (callType == "GET") {
            var key = new OfflineKey(address, params);
            if (writeToLog) {
                console.log("Offline key: " + key.getCacheKey());
            }

            //do we have this in storage?
            var cachedCallContainer = localStorage.getItem(key.getAddress());

            /*if (writeToLog) {
                console.log("Cache container currently contains: " + cachedCallContainer);
            }*/
            
            try {
                var cachedCall = null;

                if (cachedCallContainer != null) {
                    cachedCallContainer = JSON.parse(cachedCallContainer);
                    cachedCall = cachedCallContainer[key.getCacheKey()];
                }

                if (cachedCall == null) {
                    if (writeToLog) {
                        console.log("Key does not exist in local storage: " + key.getCacheKey());
                        console.log("Cache container currently contains the following data for that address: " + cachedCallContainer);
                        console.log("Currently calling with params: " + params);
                    }
                    returnVal.offlineKey = key;
                    return returnVal;
                }
                else {
                    if (cachedCall.time != null && cachedCall.data != null) { //check if too old
                        var whenToRemoveFromCache = new Date(cachedCall.time).addMinutes(MINUTES_BEFORE_CACHE_IS_CLEARED);
                        if (whenToRemoveFromCache.isBefore(new Date())) {

                            //this cache is old...remove
                            if (writeToLog) {
                                console.log("Key time: " + whenToRemoveFromCache + " has expired. Item will be removed from cache");
                            }

                            cachedCallContainer[key.getCacheKey()] = null;
                            localStorage.setItem(key.getAddress(), ko.toJSON(cachedCallContainer));

                            returnVal.offlineKey = key;
                            return returnVal;
                        }
                        else {
                            if (writeToLog) {
                                console.log("Key exist in local storage...returning data: " + cachedCall.data);
                            }
                            returnVal.data = cachedCall.data;
                            returnVal.handledOffline = true;
                        }
                    }
                }
            } catch (e) {
                console.log("Error trying to get from cache: " + e);
            }

        }
        else if (callType == "POST") {
            //ok. lets try and add this to our current package
            if (!server.isOnline()) {

                //if the server is offline then handled offline should always be true
                try {
                    offlinePackage.push({ time: new Date(), address: address, params: params });
                    //make sure to save the offlinePackage
                    localStorage.setItem("offlinePackage", ko.toJSON(offlinePackage));
                    if (offlineChangesAddedDelegate) {
                        offlineChangesAddedDelegate();
                    }
                    returnVal.handledOffline = true;
                } catch (e) {
                    console.log("Failed to save the offline package (WHAT SHOULD WE DO HERE?): " + e);
                }

                if (writeToLog) {
                    console.log("OFFLINE PACKAGE CURRENTLY CONTAINS:" + offlinePackage);
                }    
            }
        }
        return returnVal;
    };

    var clearCache = function () {
        for (var j = 0; j < allServices.length; j++) {
            var service = allServices[j];
            //will remove all cached items under this address
            console.log("Removing cache for service: " + service);
            localStorage.removeItem(service); //this will remove all service calls against this address
        }
    };

    var trySendOfflinePackage = function () {
        if (offlinePackage.length > 0) {
            console.log("Sending " + offlinePackage.length + " cached calls to the server.");
            server.sendOfflineItem(0);
            
        }
        else {
            console.log("Offline package is empty. Send aborted");
        }
    };

    return {
        /*
        * Parameters (a single json object that defines the following)
        * callType: GET or POST, (string)
        * availableOffine: true or false (default true)
        * address: The server address (string)
        * waitMessage: The message to show while waiting for a response (string)
        * writeToLog: If the data returned from the server should be written to the console log
        * successHandler: The function to call when a successful call to the server was made and the operation was a success. You get the data returned as as parameter
        * errorHandler: The function to call when an unhandled error occurred (You get the normal ajax error params:jqXHR, textStatus, errorThrown )
        *
        * Example:
        {
        callType: "GET",
        availableOffine: true,
        address: 'address',
        params: {json object},
        waitMessage: 'waiting',
        writeToLog: true,
        successHandler: func,
        exceptionHandler: func,
        unhandledErrorHandler: func,
        hideLoadingOnSuccess: default (false), if the loading screen should be closed on a success return from the server,
        forceUpdate: default(false) force a call to the server
        }
    
        *
        */
        call: function (data) {
            console.log(data.address);

            var callType = data.callType;
            var availableOffline = data.availableOffline;
            var address = data.address;
            var params = data.params;
            var waitMessage = data.waitMessage;
            var writeToLog = data.writeToLog;
            var successHandler = data.successHandler;
            var exceptionHandler = data.exceptionHandler;
            var unhandledErrorHandler = data.unhandledErrorHandler;
            var hideLoadingOnSuccess = true;
            var forceUpdate = false;
            var execNative = false;
            var errorContainer = null;
            var offlineHandler = data.offlineHandler;
            var timeout = data.timeout;
            var techToUseForThisCall = techUsed;
            var serverMethodToCall = data.serverMethod;
            var charset = data.charset;
            var contentType = data.contentType;
            var dataType = data.dataType;

            if (typeof address === 'undefined' || address.constructor !== String) {
                throw "address not set or is not a string";
            }

            if (typeof params === 'undefined' || params === null) {
                params = {};
            }

            if (typeof charset === 'undefined') {
                charset = "utf-8";
            }

            if (typeof contentType === 'undefined') {
                contentType = "application/json";
            }

            if (typeof dataType === 'undefined') {
                dataType = "json";
            }

            if (beforeServerCallDelegate) {
                if (!beforeServerCallDelegate(data)) {
                    //this call has been cancelled
                    return;
                }
            }
            
            if (data.useTech) {
                techToUseForThisCall = data.useTech;
            }

            if (!timeout) {
                timeout = 60000;
            }

            if (!writeToLog) {
                writeToLog = true;
            }
            
            if (data.hideLoadingOnSuccess != null && data.hideLoadingOnSuccess) {
                hideLoadingOnSuccess = true;
            }

            if (data.errorContainer) {
                errorContainer = data.errorContainer;
            }
            
            if (data.forceUpdate || !serviceUseCache) {
                forceUpdate = true;
            }

            //set default values
            if (availableOffline == null) {
                availableOffline = true;
            }

            if (isBusy) {
                if (writeToLog) {
                    console.log("Aborting previous server call.");
                }
                abortAnyPendingServerCalls();
                //return;
            }

            var errorElementId = errorContainer;

            var offlineKey = null;

            if (data.execNative) {
                execNative = data.execNative;
            }
            
            //if a funtion is set to force update we still allow it to read from cache of the server is offline
            if (!forceUpdate || !server.isOnline()) { //ALWAYS TRY TO USE THE CACHE

                if (!availableOffline && !server.isOnline()) {

                    var offlineHandlerTookCareOfIt = false;
                    if (offlineHandler != null) {
                        offlineHandlerTookCareOfIt = offlineHandler(); //give the client the possibility to do something when a post was handled offline
                    }
                    
                    if (!offlineHandlerTookCareOfIt) {
                        //show a message?
                        if (messageDelegate != null) {
                            messageDelegate("gen_not_supported_offline");
                        }
                        else {
                            console.log("You are currently offline and this method does not support offline mode");
                        }
                    }
                    return;
                }

                var offlineResp = tryHandleOffline(callType, address, params, writeToLog, successHandler);
                if (offlineResp.handledOffline) {
                    if (callType != "POST") { //if post then we just added a package to be send later

                        handleSuccess(data, address, offlineResp.data, null, writeToLog, errorElementId, successHandler, exceptionHandler);
                    }
                    else {
                        if (offlineHandler != null) {
                            offlineHandler(); //give the client the possibility to do something when a post was handled offline
                        }
                    }
                    return;
                }
                else {
                    offlineKey = offlineResp.offlineKey;
                }
            }
            else {
                //we still need a key that we can update 
                offlineKey = new OfflineKey(address, params);
            }

            //the call could not be handled offline...
            
            if (!server.isOnline()) {
                //if the server is not online, let see if there is an offline handler ... if not then lets show a message
                var offlineHandlerTookCareOfIt = false;
                if (offlineHandler != null) {
                    offlineHandlerTookCareOfIt = offlineHandler(); //give the client the possibility to do something when a post was handled offline
                }
                if (!offlineHandlerTookCareOfIt) {
                    if (messageDelegate != null) {
                        messageDelegate("gen_not_supported_offline");
                    }
                    else {
                        console.log("You are currently offline and this method does not support offline mode");
                    }
                }
                return;
            }

            if (waitMessage != null && showLoadingDelegate) {
                var localized = Globalize.localize(waitMessage);
                if (localized) {
                    showLoadingDelegate(localized);
                }
                else {
                    showLoadingDelegate(waitMessage);
                }
            }

            if (loggingEnabled && writeToLog) {
                console.log("Calling server method: " + SERVER_URL + address + ". With params: " + params);
            }
            isBusy = true;
            var _this = this;
            var orgCallData = data;
            
            if (data.execNative) {

                if (!BROWSER) {
                    params.address = SERVER_URL + address;
                    window.plugins.serverRequest.post(params, function(data) {
                        isBusy = false;
                        if (data != null) {
                            handleSuccess(orgCallData, address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler);
                            if (hideLoadingOnSuccess) {
                                if (hideLoadingDelegate) {
                                    hideLoadingDelegate();
                                }
                            }
                        }
                        else {
                            if (hideLoadingDelegate) {
                                hideLoadingDelegate();
                            }
                        }
                    }, function(data) {
                        if (hideLoadingDelegate) {
                            hideLoadingDelegate();
                        }
                    });
                    return;
                }
            }
            
            if (techToUseForThisCall == 'signalr') {
                if (!serverMethodToCall) {
                    console.log("ERROR - you have not defined serverMethod for the server.call method so there is no method to call on the server side.");
                    return;
                }

                serverMethodToCall(params).done(function (data) {
                    isBusy = false;
                    if (data != null) {
                        handleSuccess(orgCallData, address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler);
                        if (hideLoadingOnSuccess) {
                            if (hideLoadingDelegate) {
                                hideLoadingDelegate();
                            }
                        }
                    }
                    else {
                        if (hideLoadingDelegate) {
                            hideLoadingDelegate();
                        }
                    }
                }).fail(function (errorThrown) {
                    isBusy = false;
                    if (hideLoadingDelegate) {
                        hideLoadingDelegate();
                    }

                    if (!unhandledErrorHandler) {
                        if (unhandledErrorDelegate) {
                            unhandledErrorDelegate(address, {}, {}, errorThrown);
                        }
                        else {
                            console.log("SERVER UNHANDLED ERROR (You should assign an unhandled error delegate): " + textStatus);
                        }
                    }
                    else {
                        unhandledErrorHandler(errorThrown);
                    }
                });

                return;
            }
            
            var urlToCall = address;
            if (address.indexOf('http') === 0 || address.indexOf('HTTP') === 0) {
                 if (loggingEnabled && writeToLog) {
                    console.log("Using absolute URL");
                 }
                urlToCall = SERVER_URL + address;
            }
            
            if (callType == "FILE") {
                var getParams = ko.toJSON(params);
                urlToCall += "?data=" + getParams;
                window.location = urlToCall;
                hideLoading();
                return;
            }

            if (typeof jquery  === 'undefined') {
                throw "Can't fallback on ajax since jquery is not defined"
            }
            //fallback ajax post
            currentServerCall = jquery.ajax({
                type: callType === 'GET' ? 'GET' : 'POST',
                dataType: dataType,
                data: ko.toJSON(params),
                url: urlToCall,
                timeout: timeout,
                contentType: contentType + "; charset=" + charset, //
                complete: function () {
                    isBusy = false;
                    //hideLoading();
                },
                success: function (data, textStatus, jqXHR) {
                    isBusy = false;
                    if (data != null) {
                        handleSuccess(orgCallData, address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler);
                        if (hideLoadingOnSuccess) {
                            if (hideLoadingDelegate) {
                                hideLoadingDelegate();
                            }
                        }
                    }
                    else {
                        if (hideLoadingDelegate) {
                            hideLoadingDelegate();
                        }
                    }

                },
                error: function (jqXHR, textStatus, errorThrown) {
                    isBusy = false;
                    if (!unhandledErrorHandler) {
                        if (unhandledErrorDelegate) {
                            unhandledErrorDelegate(address, jqXHR, textStatus, errorThrown);
                        }
                        else {
                            console.log("SERVER UNHANDLED ERROR (You should assign an unhandled error delegate): " + textStatus);
                        }
                    }
                    else {
                        unhandledErrorHandler(errorThrown);
                    }

                }
            });
},
getOfflinePackageSize: function () {
    return offlinePackage.length;
},
getOfflinePackage: function () {
            return offlinePackage.slice(0); //clone it
        },
        
goOnline: function () {

            //first of all check that we have internet connectivity
            if (onAppOnlineDelegate) {
                if (!onAppOnlineDelegate()) {
                    return;
                }
            }
            
            if (this.isOffline) {
                console.log("Clearing all cache");
                clearCache();   
            }
            
            console.log("Server is now online");
            this.isOffline = false;
            trySendOfflinePackage();
        },
        goOffline: function () {
            console.log("Server is now offline");
            this.isOffline = true;
            if (onAppOfflineDelegate) {
                onAppOfflineDelegate();
            }
        },
        isOnline: function () {
            return !this.isOffline;
        },
        init: function (settings) {

            if (typeof settings === 'undefined' || settings === null) {
                throw "No settings passed in";
            }

            if (typeof settings.serverUrl === 'undefined' || settings.serverUrl === null) {
                settings.serverUrl = "/";
            }

            SERVER_URL = settings.serverUrl;
            serviceUseCache = settings.useCache;
            serviceDependencies = settings.dependencies;
            serviceNotificationDelegate = settings.notificationDelegate;
            serviceErrorDelegate = settings.errorDelegate;
            unhandledErrorDelegate = settings.unhandledErrorDelegate;
            messageDelegate = settings.messageDelegate;
            offlineChangesAppliedDelegate = settings.offlineChangesAppliedDelegate;
            offlineChangesAddedDelegate = settings.offlineChangesAddedDelegate;
            beforeServerCallDelegate = settings.beforeServerCallDelegate;
            onAppOnlineDelegate = settings.onAppOnlineDelegate;
            onAppOfflineDelegate = settings.onAppOfflineDelegate;
            
            if (settings.availableServices) {
                allServices = settings.availableServices;
            }

            if (typeof $  !== 'undefined') {
                if (typeof($.connection) !== 'undefined' && $.connection.hub) {
                    $.connection.hub.logging = false;

                    $.connection.hub.stateChanged(function (change) {
                        if (change.newState === $.signalR.connectionState.reconnecting) {
                            console.log('Client re-connecting');
                        }
                        else if (change.newState === $.signalR.connectionState.connected) {
                            console.log('The server is online');
                        }
                        else {
                            console.log('new state = ' + change.newState);
                        }
                    });

                    $.connection.hub.error(function (error) {
                        //unhandled signalr exception...
                        showErrorMsg("A connection problem occurred during the last operation", "error");

                        //call the normal unhandled error handler
                        if (unhandledErrorDelegate) {
                            unhandledErrorDelegate("SignalR", {}, {}, error);
                        }

                    });

                    $.connection.hub.starting = function () {
                        console.log("on starting");
                    };

                    $.connection.hub.received = function () {
                        console.log("on received");
                    };

                    $.connection.hub.connectionSlow = function () {
                        console.log("on connection slow");
                        //let the user know that we are having some problems with the connection
                    };

                    $.connection.hub.reconnecting = function () {
                        console.log("on reconnecting");
                    };

                    $.connection.hub.reconnected(function () {
                        console.log('Client reconnected');
                    });

                    $.connection.hub.disconnected(function () {

                    });
            }
        }
        if (settings.techUsed) {
            techUsed = settings.techUsed;
        }

        if (!settings.loggingEnabled) {
            loggingEnabled = false;
        }
        else {
            loggingEnabled = true;
        }
        showLoadingDelegate = settings.showLoadingDelegate;
        hideLoadingDelegate = settings.hideLoadingDelegate;
    }
}
}

window.server = serverPrototype();






