## This is a fork!

FYI - this is a fork of node-soap-server by rbransby
[https://github.com/rbransby/node-soap-server](https://github.com/rbransby/node-soap-server)

I changed the return result using [Promises/A+](https://github.com/then/promise)

The rest of this readme is a replica from the original repo and changed to return Promise async style!

---
soap-server
---

Soap server, using pure javascript for node.js.

## Simple example

```js
var soap = require('soap-server');

function MyTestService(){
}
MyTestService.prototype.test1 = function(myArg1, myArg2){
    return new Promise(function (resolve, reject) {
        resolve(myArg1 + myArg2);
    });
};

var soapServer = new soap.SoapServer();
var soapService = soapServer.addService('testService', new MyTestService());

soapServer.listen(1337, '127.0.0.1');
```

The WSDL at http://127.0.0.1:1337/testService?wsdl would be:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://server.soap.com/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://server.soap.com/" name="testService">
    <types>
        <xsd:schema version="1.0" targetNamespace="http://server.soap.com/" />
    </types>
    <message name="test1">
        <part name="myArg1" type="xsd:string" />
        <part name="myArg2" type="xsd:string" />
    </message>
    <message name="test1Response">
        <part name="test1Result" type="xsd:string" />
    </message>
    <portType name="testService_PortType">
        <operation name="test1">
            <input message="tns:test1" />
            <output message="tns:test1Response" />
        </operation>
    </portType>
    <binding name="testService_Binding" type="tns:testService_PortType">
        <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http" />
        <operation name="test1">
            <soap:operation soapAction="test1" />
            <input>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </input>
            <output>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </output>
        </operation>
    </binding>
    <service name="testService">
        <port name="testService_Port" binding="tns:testService_Binding">
            <soap:address location="http://127.0.0.1:1337/testService" />
        </port>
    </service>
</definitions>
```

## Forcing arguments and returned types

```js
var soap = require('soap-server');

function MyTestService(){
}
MyTestService.prototype.test2 = function(myArg1, myArg2){
    return new Promise(function (resolve, reject) {
        resolve(myArg1 + myArg2);
    });
};

var soapServer = new soap.SoapServer();
var soapService = soapServer.addService('testService', new MyTestService());

var test2operation = soapService.getOperation('test2');
test2operation.setOutputType('number');
test2operation.setInputType('myArg1', {type: 'number'});
test2operation.setInputType('myArg2', {type: 'number'});

soapServer.listen(1337, '127.0.0.1');
```

The WSDL at http://127.0.0.1:1337/testService?wsdl would be:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://server.soap.com/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://server.soap.com/" name="testService">
    <types>
        <xsd:schema version="1.0" targetNamespace="http://server.soap.com/" />
    </types>
    <message name="test2">
        <part name="myArg1" type="xsd:int" />
        <part name="myArg2" type="xsd:int" />
    </message>
    <message name="test2Response">
        <part name="test2Result" type="xsd:int" />
    </message>
    <portType name="testService_PortType">
        <operation name="test2">
            <input message="tns:test2" />
            <output message="tns:test2Response" />
        </operation>
    </portType>
    <binding name="testService_Binding" type="tns:testService_PortType">
        <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http" />
        <operation name="test2">
            <soap:operation soapAction="test2" />
            <input>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </input>
            <output>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </output>
        </operation>
    </binding>
    <service name="testService">
        <port name="testService_Port" binding="tns:testService_Binding">
            <soap:address location="http://127.0.0.1:1337/testService" />
        </port>
    </service>
</definitions>
```

## Object type response

```js
var soap = require('soap-server');

function MyObject(){
}
MyObject.prototype.concated = '';
MyObject.prototype.incremented = 0;

function MyTestService(){
}
MyTestService.prototype.test3 = function(strArg, intArg){
    return new Promise(function (resolve, reject) {
        var ret = new MyObject();
        ret.concated = strArg + '[' + intArg + ']';
        ret.incremented = intArg + 1;
        resolve(ret);
    });
};

var soapServer = new soap.SoapServer();
var soapService = soapServer.addService('testService', new MyTestService());

var test3operation = soapService.getOperation('test3');
test3operation.setOutputType(MyObject, 'MyObject');
test3operation.setInputType('intArg', {type: 'number'});

soapServer.listen(1337, '127.0.0.1');
```

The WSDL at http://127.0.0.1:1337/testService?wsdl would be:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://server.soap.com/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://server.soap.com/" name="testService">
    <types>
        <xsd:schema version="1.0" targetNamespace="http://server.soap.com/">
            <xsd:element name="MyObject" type="tns:MyObject">
                <xsd:complexType name="MyObject">
                    <xsd:sequence>
                        <xsd:element name="concated" type="xsd:string" minOccurs="0" />
                        <xsd:element name="incremented" type="xsd:int" minOccurs="0" />
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
        </xsd:schema>
    </types>
    <message name="test3">
        <part name="strArg" type="xsd:string" />
        <part name="intArg" type="xsd:int" />
    </message>
    <message name="test3Response">
        <part name="test3Result" type="tns:MyObject" />
    </message>
    <portType name="testService_PortType">
        <operation name="test3">
            <input message="tns:test3" />
            <output message="tns:test3Response" />
        </operation>
    </portType>
    <binding name="testService_Binding" type="tns:testService_PortType">
        <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http" />
        <operation name="test3">
            <soap:operation soapAction="test3" />
            <input>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </input>
            <output>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </output>
        </operation>
    </binding>
    <service name="testService">
        <port name="testService_Port" binding="tns:testService_Binding">
            <soap:address location="http://127.0.0.1:1337/testService" />
        </port>
    </service>
</definitions>
```

## Object type request

```js
var soap = require('soap-server');

var soap = require('soap-server');

function MyTestObject(){
}
MyTestObject.prototype.strArg = '';
MyTestObject.prototype.intArg = 0;

function MyTestService(){
}
MyTestService.prototype.test4 = function(myTestObjectInstance){
    return new Promise(function (resolve, reject) {
        resolve(myTestObjectInstance.strArg + '[' + myTestObjectInstance.intArg + ']');
    });
};

var soapServer = new soap.SoapServer();
var soapService = soapServer.addService('testService', new MyTestService());

var test4operation = soapService.getOperation('test4');
test4operation.setInputType('myTestObjectInstance', MyTestObject);

soapServer.listen(1337, '127.0.0.1');
```

The WSDL at http://127.0.0.1:1337/testService?wsdl would be:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://server.soap.com/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://server.soap.com/" name="testService">
    <types>
        <xsd:schema version="1.0" targetNamespace="http://server.soap.com/">
            <xsd:element name="MyTestObject" type="tns:MyTestObject">
                <xsd:complexType name="MyTestObject">
                    <xsd:sequence>
                        <xsd:element name="strArg" type="xsd:string" minOccurs="0" />
                        <xsd:element name="intArg" type="xsd:int" minOccurs="0" />
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
        </xsd:schema>
    </types>
    <message name="test4">
        <part name="myTestObjectInstance" type="tns:MyTestObject" />
    </message>
    <message name="test4Response">
        <part name="test4Result" type="xsd:string" />
    </message>
    <portType name="testService_PortType">
        <operation name="test4">
            <input message="tns:test4" />
            <output message="tns:test4Response" />
        </operation>
    </portType>
    <binding name="testService_Binding" type="tns:testService_PortType">
        <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http" />
        <operation name="test4">
            <soap:operation soapAction="test4" />
            <input>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </input>
            <output>
                <soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:testService" use="encoded" />
            </output>
        </operation>
    </binding>
    <service name="testService">
        <port name="testService_Port" binding="tns:testService_Binding">
            <soap:address location="http://127.0.0.1:1337/testService" />
        </port>
    </service>
</definitions>
```
