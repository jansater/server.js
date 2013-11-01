//a function that takes 2 parameters, the root object and a factory
//this function is directly called with a window or node as the root parameter
//and our server implementation as an anonymous function taking a jQuery object as parameter

//if define is defined the we return our server implementation by calling it with require jquery
//if not, then we call our server implemenation and hope that the root object has jQuery defined.
//We then set our server implementation on the root object.

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory); // expects that jquery has been defined somewhere 
    } else {
        // Browser globals
        root.server = factory(root.jQuery);
    }
}(this, function (jQuery) {
    // Just return a value to define the module export.
    // This example returns an object, but the module
    // can return a function as the exported value.

    var _this = this;
    var modules = null;
    var SERVER_URL = "/";
    var serviceNotificationDelegate = null;
    var serviceErrorDelegate = null;
    var unhandledErrorDelegate = null;
    var messageDelegate = null;
    var offlineChangesAppliedDelegate = null;
    var offlineChangesAddedDelegate = null;
    var beforeServerCallDelegate = null;
    var onAppOfflineDelegate = null;
    var onAppOnlineDelegate = null;
    var techUsed = 'ajax';
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
    var localStorage = null;
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        localStorage = (function() {
            
            var storage = {};

            return {
                getItem: function(key) {
                    var val = storage[key];
                    if (typeof val === 'undefined') {
                        return null;
                    }
                    return val;
                },
                setItem: function(key, value) {
                    storage[key] = value;
                },
                removeItem: function(key) {
                    storage[key] = null;
                }
            };
        })();
    }
    else {
        localStorage = window.localStorage;
    }

    try {
        var offlineItemsAsString = localStorage.getItem("offlinePackage");
        if (offlineItemsAsString !== null) {
            offlineItems = JSON.parse(offlineItemsAsString);
        }
    } catch (e) {
        console.log("Failed to read offlinePackage from local storage: " + e);
    }

    var offlinePackage = [];
    if (offlineItems !== null) {
        offlinePackage.concat(offlineItems);
    }

    //PRIVATE SCOPE
    var hashFunc = function(input) {
        var hash = 0, i, char;
        if (input.length === 0) return hash;
        for (i = 0, l = input.length; i < l; i++) {
            char  = input.charCodeAt(i);
            hash  = ((hash<<5)-hash)+char;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    var OfflineKey = function(address, params) {
        var _address = address;
        var _params = params;
        var _key = hashFunc(JSON.stringify({ address: address, params: params }));

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
        };
    };

        var handleSuccess = function (serverObj, orgCall, address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler) {

            var wasHandledUsingCache = (offlineKey === null && orgCall.callType === "GET");

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
                if (offlineKey !== null) {
                    if (writeToLog) {
                        console.log("Adding offlinekey to local storage: " + offlineKey.getCacheKey() + " to address: " + offlineKey.getAddress());
                    }

                    var storedAddressCache = localStorage.getItem(offlineKey.getAddress());
                    if (storedAddressCache === null) {
                        storedAddressCache = {};
                    }
                    else {
                        storedAddressCache = JSON.parse(storedAddressCache);
                    }

                    storedAddressCache[offlineKey.getCacheKey()] = { time: new Date(), data: data };
                    localStorage.setItem(offlineKey.getAddress(), JSON.stringify(storedAddressCache));
                }
            } catch (e) {
                console.log("Failed to save item to cache: " + e);
            }

            return;
        }
        

        /* Do we need to update our cache?...never remove cache if we are in offline mode since thats the only data we have to work with */
        if (serverObj.isOnline() && !wasHandledUsingCache) {
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
                if (offlineKey !== null) {

                    if (writeToLog) {
                        console.log("Adding offlinekey to local storage: " + offlineKey.getCacheKey() + " to address: " + offlineKey.getAddress());
                    }

                    var storedAddressCache = localStorage.getItem(offlineKey.getAddress());
                    if (storedAddressCache === null) {
                        storedAddressCache = {};
                    }
                    else {
                        storedAddressCache = JSON.parse(storedAddressCache);
                    }

                    storedAddressCache[offlineKey.getCacheKey()] = { time: new Date(), data: data };
                    localStorage.setItem(offlineKey.getAddress(), JSON.stringify(storedAddressCache));
                }
            } catch (e) {
                console.log("Failed to save item to cache: " + e);
            }

            data.wasHandledUsingCache = wasHandledUsingCache;

            if (!orgCall.forceUpdate && wasHandledUsingCache && serviceNotificationDelegate !== null) {
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

        if (data !== null) {
            showErrorMsg(Globalize.localize(data.code), elementId);
        }
        return false;
    };

    var sendOfflineItem = function (index) {
        var item = _this.getOfflinePackage().item(index);

        if (item === null) {
            if (offlineChangesAppliedDelegate) {
                offlineChangesAppliedDelegate();
            }
            return;
        }

        _this.call(
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
                            _this.getOfflinePackage().splice(index, 1);

                            //then start with the next one...should be the same index
                            _this.sendOfflineItem(index);
                        },
                        exceptionHandler: function (exception, elementId) {
                            console.log("Offline item: " + item + " failed miserably.");

                            //OPTION 1: try with the next one
                            //this.sendOfflineItem(index++, context);

                            //OPTION 2: remove and take the next one
                            _this.getOfflinePackage().slice(index, 1);
                            //then start with the next one...should be the same index
                            _this.sendOfflineItem(index);
                        },
                        unhandledErrorHandler: function (param1, param2, param3) {
                            console.log("Unhandled exception occurred while sending offline package to server: " + param1);
                            _this.sendOfflineItem(index++);
                        }
                    });
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

                if (cachedCallContainer !== null) {
                    cachedCallContainer = JSON.parse(cachedCallContainer);
                    cachedCall = cachedCallContainer[key.getCacheKey()];
                }

                if (cachedCall === null) {
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
                            localStorage.setItem(key.getAddress(), JSON.stringify(cachedCallContainer));

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
            if (!_this.isOnline()) {

                //if the server is offline then handled offline should always be true
                try {
                    offlinePackage.push({ time: new Date(), address: address, params: params });
                    //make sure to save the offlinePackage
                    localStorage.setItem("offlinePackage", JSON.stringify(offlinePackage));
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
            _this.sendOfflineItem(0);
            
        }
        else {
            console.log("Offline package is empty. Send aborted");
        }
    };

    //PUBLIC SCOPE

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
        */
        call: function (data) {
            
            var hideLoadingOnSuccess = true;
            var successHandler = data.successHandler;
            var exceptionHandler = data.exceptionHandler;
            var unhandledErrorHandler = data.unhandledErrorHandler;
            var writeToLog = data.writeToLog;
            var forceUpdate = false;
            var availableOffline = data.availableOffline;
            var techToUseForThisCall = techUsed;
            
            var settings = {
                callType: data.callType,
                address: data.address,
                params: data.params,
                waitMessage: data.waitMessage,
                errorContainer: null,
                offlineHandler: data.offlineHandler,
                timeout: data.timeout,
                serverMethodToCall: data.serverMethod,
                charset: data.charset,
                contentType: data.contentType,
                dataType: data.dataType
            };
            

            if (typeof modules === 'undefined' || modules === null) {
                throw new Error("You must call init at startup to configure the server component");
            }

            if (typeof settings.address === 'undefined' || settings.address === null || settings.address.constructor !== String) {
                throw new Error("address not set or is not a string");
            }

            if (typeof settings.params === 'undefined' || settings.params === null) {
                settings.params = {};
            }

            if (typeof settings.charset === 'undefined' || settings.charset === null) {
                settings.charset = "utf-8";
            }

            if (typeof settings.contentType === 'undefined' || settings.contentType === null) {
                settings.contentType = "application/json";
            }

            if (typeof settings.dataType === 'undefined' || settings.dataType === null) {
                settings.dataType = "json";
            }

            if (beforeServerCallDelegate) {
                if (!beforeServerCallDelegate(data)) {
                    //this call has been cancelled
                    return;
                }
            }
            
            if (data.useModule) {
                techToUseForThisCall = data.useModule;
            }

            if (!settings.timeout) {
                settings.timeout = 60000;
            }

            if (!writeToLog) {
                writeToLog = true;
            }
            
            if (data.hideLoadingOnSuccess && data.hideLoadingOnSuccess !== null) {
                hideLoadingOnSuccess = true;
            }

            if (data.errorContainer) {
                settings.errorContainer = data.errorContainer;
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
                    console.log("Starting new call while previous has not finished");
                }
            }

            //try and find a module we can use

            var callModuleToUse = null;
            for (var i = 0; i < modules.length; i++) {

                if (typeof modules[i].run === 'undefined') {
                    console.log("Module is missing run method");
                    continue;
                }

                if (typeof modules[i].name === 'undefined') {
                    console.log("Module is missing name");
                    continue;
                }

                if (techToUseForThisCall === modules[i].name) {
                    callModuleToUse = modules[i];
                    break;
                }
            }

            if (callModuleToUse === null) {
                throw new Error("No module found to make the call, make sure this has been setup when calling init (Module name must match the techUsed parameter)");
            }

            var errorElementId = settings.errorContainer;

            var offlineKey = null;
 
            //if a funtion is set to force update we still allow it to read from cache if the server is offline
            if (!forceUpdate || !this.isOnline()) { //ALWAYS TRY TO USE THE CACHE

                if (!availableOffline && !this.isOnline()) {

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

                var offlineResp = tryHandleOffline(callType, settings.address, settings.params, writeToLog, successHandler);
                if (offlineResp.handledOffline) {
                    if (callType != "POST") { //if post then we just added a package to be sent later
                        handleSuccess(this, data, settigns.address, offlineResp.data, null, writeToLog, errorElementId, successHandler, exceptionHandler);
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
                offlineKey = new OfflineKey(settings.address, settings.params);
            }

            //the call could not be handled offline...
            
            if (!this.isOnline()) {
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

            if (settings.waitMessage != null && showLoadingDelegate) {
                showLoadingDelegate(settings.waitMessage);
            }

            if (loggingEnabled && writeToLog) {
                console.log("Calling server method: " + settings.address + ". With params: ");
                console.log(params);
            }
            isBusy = true;
            var _this = this;
            var orgCallData = data;
            
            var urlToCall = SERVER_URL + settings.address;
            if (settings.address.indexOf('http') === 0 || settings.address.indexOf('HTTP') === 0)
            {
                if (loggingEnabled && writeToLog) {
                    console.log("Using absolute URL");
                }
            
                urlToCall = settings.address;
            }

            var onSuccess = function(data) {
                    isBusy = false;
                    if (data != null) {
                        handleSuccess(_this, orgCallData, settings.address, data, offlineKey, writeToLog, errorElementId, successHandler, exceptionHandler);
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
            };

            var onFailure = function(msg) {
                isBusy = false;
                    if (!unhandledErrorHandler) {
                        if (unhandledErrorDelegate) {
                            unhandledErrorDelegate(msg, settings.address);
                        }
                        else {
                            console.log("SERVER UNHANDLED ERROR (You should assign an unhandled error delegate): " + textStatus);
                        }
                    }
                    else {
                        unhandledErrorHandler(msg);
                    }
            };

            callModuleToUse.run(settings.params, settings, onSuccess, onFailure);
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
            
            if (_this.isOffline) {
                console.log("Clearing all cache");
                clearCache();
            }
            
            console.log("Server is now online");
            _this.isOffline = false;
            trySendOfflinePackage();
        },
        goOffline: function () {
            console.log("Server is now offline");
            _this.isOffline = true;
            if (onAppOfflineDelegate) {
                onAppOfflineDelegate();
            }
        },
        isOnline: function () {
            return !_this.isOffline;
        },
        defaultInput: {
            callType : 'GET',
            availableOffline : true,
            address : null,
            params : {},
            waitMessage : "",
            writeToLog : false,
            successHandler : null,
            exceptionHandler : null,
            unhandledErrorHandler : null,
            hideLoadingOnSuccess : true,
            forceUpdate : false,
            execNative : false,
            errorContainer : null,
            offlineHandler : null,
            timeout : 60000,
            techToUseForThisCall : undefined,
            serverMethodToCall : undefined,
            charset : 'utf-8',
            contentType : 'application/json',
            dataType : 'json'

        },
        init: function (settings) {

            if (typeof settings === 'undefined' || settings === null) {
                throw new Error("No settings passed in");
            }

            if (typeof settings.modules === 'undefined' || settings.modules === null) {
                throw new Error("At least 1 module for handling calls must be added");
            }

            if (typeof settings.serverUrl === 'undefined' || settings.serverUrl === null) {
                settings.serverUrl = "/";
            }

            if (typeof settings.dependencies === 'undefined' || settings.dependencies === null) {
                settings.dependencies = [];
            }

            modules = settings.modules;
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
    };
}));









