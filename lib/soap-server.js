"use strict";

var http = require('http'),
	util = require('util'),
	events = require('events'),
	parseXml = require('xml2js').parseString;


function SoapServiceException(faultCode, faultString, faultName) {
   this.name = 'SoapServerException';
   this.faultCode = faultCode;
   this.faultString = faultString;
   this.faultName = faultName;
}
SoapServiceException.OPERATION_NOT_SPECIFIED = 'OPERATION_NOT_SPECIFIED';
SoapServiceException.MISSING_REQUIRED_INPUT = 'MISSING_REQUIRED_INPUT';
SoapServiceException.INVALID_INPUT_TYPE = 'INVALID_INPUT_TYPE';

function SoapServerException(type, message) {
   this.name = 'SoapServerException';
   this.type = type;
   this.message = message;
}
SoapServerException.FILE_NOT_FOUND = 'FILE_NOT_FOUND';
SoapServerException.SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND';
SoapServerException.MISSING_REQUEST = 'MISSING_REQUEST';

function SoapOperation(name, service, operation){
	this.name = name;
	this.service = service;
	this.operation = operation;
	this.inputs = {};
	this.faults = [];
	this.output = {type: 'string'};

	var regex = /\(([^)]+)\)/;
	var operationString = operation + '';
	var matches = regex.exec(operationString);
	if (matches)
	{
		var args = matches[1].split(',');
		
		for(var i in args)
			this.addInput(args[i].trim(), 'string');
	}
}
SoapOperation.prototype.getType = function(options){
	if(options === null)
		options = 'string';

	if('string' == typeof options)
		options = {type: options};

	if('function' == typeof options){

		var membersObject = options.prototype;
	
		options = {
			type: 'object',
			objectType: options.name,
			constructor: options,
			members: {}
		};
		
		for(var member in membersObject){
			if('function' == typeof membersObject[member] && membersObject[member].name){
				options.members[member] = this.getType(membersObject[member]);
			}
			else{
				var type = 'string';
				if(membersObject[member] !== null)
					type = typeof membersObject[member];
				
				options.members[member] = {type: type};
			}
		}
	}
	return options;
};
SoapOperation.prototype.setOutputType = function(options){
	options = this.getType(options);
	this.output = options;
};
SoapOperation.prototype.addInput = function(name, options){
	if('string' == typeof options)
		options = {type: options};
		
	this.inputs[name] = options;
};

SoapOperation.prototype.addFault = function(name) {
	this.faults.push(name);
}

SoapOperation.prototype.setInputType = function(name, options){
	options = this.getType(options);
	this.inputs[name] = options;
};
SoapOperation.prototype.exec = function(){
	return this.operation.apply(this.service, arguments);
};
SoapOperation.prototype.getObjects = function(){
	var objects = {};

	if(this.output.type == 'object'){
		objects[this.output.objectType] = this.output.members;
	}
	
	for(var inputName in this.inputs){
		var input = this.inputs[inputName];
		if(input.type == 'object'){
			objects[input.objectType] = input.members;
		}
	}
	
	return objects;
};


function SoapService(server, name, service){
	this.server = server;
	this.name = name;
	this.service = service;
	this.operations = {};
	
	for (let attribute of Object.getOwnPropertyNames(Object.getPrototypeOf(service)))
	{
	//for(var attribute in service){
		if(attribute != 'constructor' && 'function' == typeof service[attribute]){
			this.addOperation(attribute, service[attribute]);
		}
	}
}
SoapService.prototype.addOperation = function(name, operation, scope){
	this.operations[name] = new SoapOperation(name, scope ? scope : this.service, operation);
	return this.operations[name];
};
SoapService.prototype.getOperation = function(name){
	return this.operations[name];
};
SoapService.prototype.getObjects = function(){
	var objects = {};
	for(var operationName in this.operations){
		var operationObjects = this.operations[operationName].getObjects();
		for(var objectName in operationObjects){
			objects[objectName] = operationObjects[objectName];
		}
	}
	return objects;
};

function SoapServer(options){
	if(!options){
		options = {
			tns: 'server.soap.com'
		};
	}
	
	this.options = options;
	this.services = {};
}

util.inherits(SoapServer, events.EventEmitter);
exports.SoapServer = SoapServer;
exports.SoapServerException = SoapServerException;

SoapServer.prototype.addService = function(name, service){
	this.services[name] = new SoapService(this.server, name, service);
	return this.services[name];
};

SoapServer.prototype.castArgument = function(inputName, requestArgument, options){
	
	switch(options.type){
		case 'object':
			if('object' != typeof requestArgument)
				throw new SoapServiceException(SoapServiceException.INVALID_INPUT_TYPE, 'Invalid input [' + inputName + '] type ' + typeof requestArgument + ', expected ' + options.type);

			var requestObject = new options.constructor();
			requestArgument = requestArgument[0];
			for(var requestObjectAttribute in requestArgument){
				var requestAttribute = requestArgument[requestObjectAttribute][0]._; 
				
				if('undefined' == typeof options.members || 'undefined' == typeof options.members[requestObjectAttribute]){
					requestObject[requestObjectAttribute] = String(requestAttribute);
				}
				else{
					requestObject[requestObjectAttribute] = this.castArgument(inputName + '.' + requestObjectAttribute, requestAttribute, options.members[requestObjectAttribute]);
				}
			}
			return requestObject;

		case 'number':
			var requestInteger = Number(requestArgument);
			if((requestInteger + '') != requestArgument)
				throw new SoapServiceException(SoapServiceException.INVALID_INPUT_TYPE, 'Invalid input [' + inputName + '] type ' + typeof requestArgument + ', expected ' + options.type);
			return requestInteger;

		case 'boolean':
			return Boolean(requestArgument);

		default:
			return String(requestArgument);
	}
};
SoapServer.prototype.handleOperationRequest = function(service, soapRequest){
	let envelopeElementName, bodyElementName;
	//Object.getOwnPropertyNames(Object.getPrototypeOf(service)
	for (let iKey in soapRequest)
	{
		if (iKey.includes('Envelope'))
		{
			envelopeElementName = iKey;
			for (let jKey in soapRequest[envelopeElementName])
			{
				if (jKey.includes('Body'))
				{
					bodyElementName = jKey;
				}
			}
		}		
	}
	if (!envelopeElementName && !bodyElementName)
		throw new SoapServiceException(SoapServiceException.INVALID_INPUT_TYPE, 'Could not determine envelope/body format');
	var operationRequest = soapRequest[envelopeElementName][bodyElementName][0];
	for(var operationRequestName in operationRequest){
		if (operationRequestName == '$')
			continue;
		var operationName = operationRequestName.substr(operationRequestName.indexOf(':') + 1);
		var requestArguments = operationRequest[operationRequestName][0];
		delete requestArguments.$;
		var operation = service.getOperation(operationName);
		if('undefined' == typeof operation)
			throw new SoapServiceException(SoapServiceException.OPERATION_NOT_FOUND, 'Operation [' + operationName + '] not found');
			
		
		let inputNamePrefix = '';
		let firstRequestArgumentKey = Object.keys(requestArguments)[0];
		inputNamePrefix = firstRequestArgumentKey.substr(0, firstRequestArgumentKey.length - (firstRequestArgumentKey.length - firstRequestArgumentKey.indexOf(':')) +1);

		var operationArguments = [];
		for(var inputName in operation.inputs){			
			var input = operation.inputs[inputName];
			if('undefined' == requestArguments[inputName]){
				if(input.required)
					throw new SoapServiceException(SoapServiceException.MISSING_REQUIRED_INPUT, 'Missing required input [' + inputName + ']');
				
				operationArguments.push(null);
				continue;
			}
			
			var requestArgument = this.castArgument(inputName, requestArguments[inputNamePrefix+inputName], input);
			operationArguments.push(requestArgument);
		}
		
		/*
		console.log('Operation: ' + operationName + ':');
		console.dir(operationArguments);
		*/
		
		var operationResponse = operation.exec.apply(operation, operationArguments);
		var response = {};
		var responseName = operationName + 'Response';
		response[responseName] = {[operationName + 'Result']: operationResponse};
		return response;
	}
	
	throw new SoapServerException(SoapServerException.OPERATION_NOT_SPECIFIED, 'Operation not specified');
};

SoapServer.prototype.js2xml = function(js, namespace, indentLevel){
	var ret = '';
	var indent = '';
	
	for(var i = 0; i < indentLevel; i++)
		indent += '	';
	
	for(var node in js){
		var element = node;
		if(namespace)
			element = namespace + ':' + node;

		
		if('object' == typeof js[node]){
			ret += indent + '<' + element + '>\n';
			ret += this.js2xml(js[node], namespace, indentLevel + 1);
			ret += indent + '</' + element + '>\n';
		}
		else{
			ret += indent + '<' + element + '>' + js[node] + '</' + element + '>\n';
		}
			
	}
	return ret;
};

SoapServer.prototype.listen = function(port, host, cp){
	var This = this;
	var httpServer = http.createServer(function (req, res) {
		This.handleRequest(req, res);
	}).listen(port, host, cp);
};

SoapServer.prototype.handleRequest = function(req, res){
	try{
		this.handleSoapRequest(req, function(response){
			res.writeHead(200, {'Content-Type': 'text/xml'});
			res.end(response);
		});
	}
	catch(exception){
		if(exception.name == 'SoapServerException'){
			if(exception.type == SoapServerException.SERVICE_NOT_FOUND){
				res.writeHead(404, {'Content-Type': 'text/plain'});
			}
			else{
				res.writeHead(500, {'Content-Type': 'text/plain'});
			}
			res.end(exception.message);
		}
		else{
			res.writeHead(500, {'Content-Type': 'text/plain'});
			if('string' == typeof exception){
				res.end(exception);
			}
			else if('string' == typeof exception.message){
				res.end(exception.message);
			}
			else{
				res.end(exception + '');
			}
		}
	}
};

SoapServer.prototype.handleSoapRequest = function(req, callback){
	//console.log('Request url: ' + req.url);
	
	var This = this;
	var service = null;
	var serviceName = null;
	
	if (req.method == 'POST') {
		
		serviceName = req.url.substr(1);
		if(serviceName.indexOf('/') >= 0)
			throw new SoapServerException(SoapServerException.FILE_NOT_FOUND, 'Path [' + req.url + '] not found');

		service = this.services[serviceName];
		if('undefined' == typeof service)
			throw new SoapServerException(SoapServerException.SERVICE_NOT_FOUND, 'Service [' + path + '] not found');
			
		var body = '';
		req.on('data', function (data) {
			body += data;
		});
		req.on('end', function () {

			//console.log('Request XML: ' + body);
			parseXml(body, function (err, soapRequest) {
				if(err){
					//console.dir('Request parse error: ' + err);
					throw err;
				}

				var responseXml = '<soap:Envelope\n';
				responseXml += '	xmlns:soap="http://www.w3.org/2001/12/soap-envelope"\n';
				responseXml += '	soap:encodingStyle="http://www.w3.org/2001/12/soap-encoding">\n';
				responseXml += '	<soap:Body>\n';
				
				try{
					var soapResponse = This.handleOperationRequest(service, soapRequest);
					//console.dir(soapResponse);
					responseXml += This.js2xml(soapResponse, null, 2);
				}
				catch(exception){
					if(exception.name != 'SoapServiceException')
						throw exception;

					responseXml += '	<soap:Fault>\n';
					responseXml += '		<soap:faultcode>' + exception.faultCode + '</soap:faultcode>\n';
					responseXml += '		<soap:faultstring>' + exception.faultString + '</soap:faultstring>\n';
					responseXml += '		<detail>\n';
					responseXml += '			<'+exception.faultName+'></'+exception.faultName+'>\n'; 
					responseXml += '		</detail>\n';
					responseXml += '	</soap:Fault>\n';
				}

				responseXml += '	</soap:Body>\n';
				responseXml += '</soap:Envelope>';
				
				//console.log('Soap response: ' + responseXml);
				callback.apply(null, [responseXml]);
			});
		});
		
		return;
	}
	
	if(req.url.indexOf('?') < 0)
		throw new SoapServerException(SoapServerException.MISSING_REQUEST, 'No query string supplied');
		
	var urlParts = req.url.split('?');
	serviceName = urlParts[0].substr(1);
	
	if(serviceName.indexOf('/') >= 0)
		throw new SoapServerException(SoapServerException.FILE_NOT_FOUND, 'Path [' + urlParts[0] + '] not found');
	
	service = this.services[serviceName];
	if('undefined' == typeof service)
		throw new SoapServerException(SoapServerException.SERVICE_NOT_FOUND, 'Service [' + path + '] not found');
		
	if(urlParts[1] == 'wsdl'){
		var wsdl = this.getWsdl(req.headers.host, service);
		callback.apply(null, [wsdl]);
	}
};

SoapServer.prototype.getType = function(options){
	if(options.type == 'object')
		return options.objectType;
	
	if(options.type == 'number')
		return 'int';
	
	return options.type;
};

SoapServer.prototype.getXsdElement = function(name, options, indentLevel){
	var indent = '';

	for(var i = 0; i < indentLevel; i++)
		indent += '	';
	
	if(options.type != 'object')
		return indent + '<xsd:element name="' + name + '" type="xsd:' + this.getType(options) + '" minOccurs="0" />\n';

	var ret = indent + '<xsd:element name="' + name + '"  minOccurs="0">\n';
	ret += indent + '	<xsd:complexType>\n';
	ret += indent + '		<xsd:sequence>\n';

	for(var memberName in options.members){
		ret += this.getXsdElement(memberName, options.members[memberName], indentLevel + 3);
	}
	
	ret += indent + '		</xsd:sequence>\n';
	ret += indent + '	</xsd:complexType>\n';
	ret += indent + '</xsd:element>\n';
	
	return ret;
};

SoapServer.prototype.getWsdl = function(host, service){
	if('object' != typeof service || service.constructor.name != 'SoapService')
		throw 'getWsdl expect service or type SoapService';

	var wsdl = '<?xml version="1.0" ?>\n';
	wsdl += '	<definitions\n'
	// wsdl += '	xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"\n';
	// wsdl += '	xmlns:wsp="http://www.w3.org/ns/ws-policy"\n';
	// wsdl += '	xmlns:wsp1_2="http://schemas.xmlsoap.org/ws/2004/09/policy"\n';
	 wsdl += '	xmlns:tns="http://' + this.options.tns + '/"\n';
	 wsdl += '	xmlns:xsd="http://www.w3.org/2001/XMLSchema"\n';
	// wsdl += '	xmlns:wsam="http://www.w3.org/2007/05/addressing/metadata"\n';
	wsdl += '	xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"\n';
	wsdl += '	xmlns="http://schemas.xmlsoap.org/wsdl/"\n';
	wsdl += '	targetNamespace="http://' + this.options.tns + '/"\n';
	wsdl += '	name="' + service.name+'">\n';
	
	wsdl += '	<types>\n';
	wsdl += '		<xsd:schema version="1.0" targetNamespace="http://' + this.options.tns + '/">\n';
	
	var objects = service.getObjects();
	for(var objectTypeName in objects){
		var object = objects[objectTypeName];

		wsdl += '			<xsd:element name="' + objectTypeName + '" type="tns:' + objectTypeName + '" />\n';
		wsdl += '			<xsd:complexType name="' + objectTypeName + '">\n';
		wsdl += '				<xsd:sequence>\n';
		
		for(var memberName in object){
			wsdl += this.getXsdElement(memberName, object[memberName], 5);
		}
		
		wsdl += '				</xsd:sequence>\n';
		wsdl += '			</xsd:complexType>\n';
	}
	
	wsdl += '		</xsd:schema>\n';
	wsdl += '	</types>\n';
	
	var operationName;
	for(operationName in service.operations){
		var operation = service.getOperation(operationName);
		
		wsdl += '	<message name="' + operationName + '">\n';
		for(var inputName in operation.inputs){
			var input = operation.inputs[inputName];
			if(input.type == 'object'){
				wsdl += '		<part name="' + inputName + '" type="tns:' + this.getType(input) + '" />\n';
			}
			else{
				wsdl += '		<part name="' + inputName + '" type="xsd:' + this.getType(input) + '" />\n';
			}
		}
		wsdl += '	</message>\n';
		
		wsdl += '	<message name="' + operationName + 'Response">\n';
		if(operation.output.type == 'object'){
			wsdl += '		<part name="'+operationName+'Result" type="tns:' + this.getType(operation.output) + '" />\n';
		}
		else{
			wsdl += '		<part name="'+operationName+'Result" type="xsd:' + this.getType(operation.output) + '" />\n';
		}
		wsdl += '	</message>\n';
		
		if (operation.faults.length > 0)
		{
			wsdl += '	<message name="' + operationName +'Fault">\n';
			for (let faultName of operation.faults)
			{				
				wsdl += '		<part name="' + faultName +'" type="tns:'+faultName+'Fault" />\n'				
			}
			wsdl += '	</message>\n';
		}
	}

	wsdl += '	<portType name="' + service.name + '_PortType">\n';
	for(operationName in service.operations){
		var operation = service.getOperation(operationName);
		
		wsdl += '		<operation name="' + operationName + '">\n';
		wsdl += '			<input message="tns:' + operationName + '"/>\n';
		wsdl += '			<output\n';
		wsdl += '				message="tns:' + operationName + 'Response"/>\n';
		if (operation.faults.length > 0)
		{
			for (let faultName of operation.faults)
			{
				wsdl += '			<fault name="'+faultName+'" message="'+operationName+'Fault"/>\n'
			}
		}
		wsdl += '		</operation>\n';
	}
	wsdl += '	</portType>\n';

	wsdl += '	<binding name="' + service.name + '_Binding" type="tns:' + service.name + '_PortType">\n';
	wsdl += '		<soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"\n';
	wsdl += '			 />\n';
	for(operationName in service.operations){
		wsdl += '		<operation name="' + operationName + '">\n';
		wsdl += '			<soap:operation soapAction="' + operationName + '" />\n';
		wsdl += '			<input>\n';
		wsdl += '				<soap:body\n';
		wsdl += '					encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"\n '; 
		wsdl += '					namespace="urn:examples:'+service.name+'"\n';
		wsdl += '					use="encoded"/>\n';
		wsdl += '			</input>\n';
		wsdl += '			<output>\n';
		wsdl += '				<soap:body';
		wsdl += '					encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"\n ';
		wsdl += '					namespace="urn:examples:'+service.name+'" \n';
		wsdl += '					use="encoded"/>\n';
		wsdl += '			</output>\n';
		if (service.operations[operationName].faults.length > 0)
		{
			wsdl += '			<fault>\n'
			wsdl += '				<soap:fault name="'+operationName+'Fault" \n';
			wsdl += '					encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"\n ';
			wsdl += '					namespace="urn:examples:'+service.name+'" \n';
			wsdl += '					use="encoded"/>\n';
			wsdl += '			</fault>\n'
		}
		wsdl += '		</operation>\n';
	}
	wsdl += '	</binding>\n';
	
	wsdl += '	<service name="' + service.name + '">\n';
	wsdl += '		<port name="' + service.name + '_Port" binding="tns:' + service.name + '_Binding">\n';
	wsdl += '			<soap:address location="http://' + host + '/' + service.name + '" />\n';
	wsdl += '		</port>\n';
	wsdl += '	</service>\n';
	wsdl += '</definitions>';

	return wsdl;
};


