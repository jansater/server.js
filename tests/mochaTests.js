var assert = require("assert");
var server = require("../server").server;

var fakeModule = {
        name: 'fake',
        run: function(input, parameters, onSuccess, onError) {
            console.log("Fake module called with input");
            console.log(input);
            console.log(" and parameters");
            console.log(parameters);
            onSuccess({code: 0});
        }
};

describe('server.js', function(){
  describe('#call()', function(){
        it('should throw exception when init has not been called', function() {

            assert.throws(function()
            {
                 server.call({
                     address: "test",
                     data: { id: 1 }
                 });
            }, /You must call init at startup/);
        });

        it('should call success handler when call complete', function() {
            server.init({ modules: [fakeModule] });
            var successCalled = false;
            server.call({
                address: "some url",
                data: { id: 4 },
                useModule: 'fake',
                successHandler: function(data) {
                  successCalled = true;
                }
            });

            if (!successCalled) {
              assert.fail("Success wasnt called");
            }
        });
    });

  describe('#init()', function(){
    it('shold throw exception if no settings object is passed in', function() {
            assert.throws(function()
            {
                 server.init();
            }, /No settings passed in/);
    });

    it('should throw exception if no module has been defined', function() {
        assert.throws(function()
            {
                 server.init({});
            }, /At least 1 module/);
    });
  });

});