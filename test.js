
var soap = require('./lib/soap-server');
var Promise = require('promise');

function MyTestObject(){
}
MyTestObject.prototype.strArg = '';
MyTestObject.prototype.intArg = 0;


function MyObject(){
}
MyObject.prototype.concated = '';
MyObject.prototype.incremented = 0;

function MyTestService(){
}
MyTestService.prototype.test1 = function(myArg1, myArg2){
	return new Promise(function (resolve, reject) {
		resolve(myArg1 + myArg2);
	});
};
MyTestService.prototype.test2 = function(myArg1, myArg2){
	return new Promise(function (resolve, reject) {
		resolve(myArg1 + myArg2);
	});
};
MyTestService.prototype.test3 = function(strArg, intArg){
	return new Promise(function (resolve, reject) {
		var ret = new MyObject();
		ret.concated = strArg + '[' + intArg + ']';
		ret.incremented = intArg + 1;
		resolve(ret);
	});
};
MyTestService.prototype.test4 = function(myTestObjectInstance){
	return new Promise(function (resolve, reject) {
		resolve(myTestObjectInstance.strArg + '[' + myTestObjectInstance.intArg + ']');
	});
};

MyTestService.prototype.test5 = function() {
	return new Promise(function (resolve, reject) {
		resolve("000-000-000");
	});
}

var soapServer = new soap.SoapServer({tns: 'KnockKnock.readify.net'});
var soapService = soapServer.addService('testService', new MyTestService());

var test2operation = soapService.getOperation('test2');
test2operation.setOutputType('number');
test2operation.setInputType('myArg1', {type: 'number'});
test2operation.setInputType('myArg2', {type: 'number'});
test2operation.addFault('ArgumentOutOfRangeException');
var test3operation = soapService.getOperation('test3');
test3operation.setOutputType(MyObject, 'MyObject');
test3operation.setInputType('intArg', {type: 'number'});

var test4operation = soapService.getOperation('test4');
test4operation.setInputType('myTestObjectInstance', MyTestObject);


soapServer.listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
