"use strict";
var FIRST_MOTION_TRIGGER = 0.1;
var SECOND_MOTION_TRIGGER = 0.5;

var SensorFusion = function () {
        /* Defining services and characteristics UUIDs */
    var ENVIRONMENTAL_CHAR1 = "00140000-0001-11e1-ac36-0002a5d5c51b";
    var SENSOR_SERVICE = "00000000-0001-11e1-9ab4-0002a5d5c51b";
    var ENVIRONMENTAL_CHAR2 = "001d0000-0001-11e1-ac36-0002a5d5c51b";
    var ACC_GYRO_MAG = "00e00000-0001-11e1-ac36-0002a5d5c51b";
    var MICROPHONE_CHAR = "04000000-0001-11e1-ac36-0002a5d5c51b";
    var BATTERY = "00020000-0001-11e1-ac36-0002a5d5c51b";
    var SENSOR_FUSION = "00000100-0001-11e1-ac36-0002a5d5c51b";

    var self;

    function SensorFusion(bluetooth) {
        self = this;
        self.bluetooth = bluetooth;
        self.initialize();
    }

    /* Initializing properties for SensorFusion class */
    SensorFusion.prototype.initialize = function () {
        var self = this;
        self.bluetoothDevice = undefined;
        self.connected=false;
        self.server = undefined;
        self.data = {
            micData: '',
            accGyroMag: {
                acc: {}, gyro: {}, mag: {}, accVector: '', gyroVector: '', magVector: '', motionStatus: ''
            },
            envData: {},
            accelerometerData: {
                orientation: '',
                events: '',
                supported: '',
                rawData: ''
            },
            ledData: {
                ledStatus: ''
            },
            fusionData: {}
        };
        self.gyroVectorArray = [];
        self.accVectorArray = [];
        self.accArray = [];
        self.gyroArray = [];
        self.topGforce = '';
        self.topAcc = '';
        self.minAcc = '';
        self.q00 = undefined;
        self.q11 = undefined;
        self.q22 = undefined;
        self.q33 = undefined;
        self.sensorFusionReady = false;
        self.fusionLicenseEnabled = undefined;
    };

    /* Defining function for connecting to the device */
    SensorFusion.prototype.connect = function () {
        var options = {filters: [{name: 'BM2V210'}, {name: 'BM2V220'},{services: [SENSOR_SERVICE]}]};
        if (navigator.bluetooth) {
            return navigator.bluetooth.requestDevice(options)
            /* Connecting to the device */
                .then(function (device) {
                    self.bluetoothDevice = device;
                    return device.gatt.connect();
                })
                .then(function (server) {
                    console.log("Discovering services");
                    self.server = server;
                    self.connected = true;
                    /* Adding disconnection listener */
                    // self.bluetoothDevice.on("gattserverdisconnected", function (event) {
                    //     console.log("Device disconnected");
                    //     self.onError('Device disconnected');
                    //     self.connected = false;
                    //     self.initialize();
                    //     self.disconnectIndicator();
                    // });

                    /* Getting sensor service */
                    return server.getPrimaryService(SENSOR_SERVICE)
                        .then(function (service) {
                            Promise.all([
                                /* Getting environmetnal characteristic (ver 1. firmware) */
                                service.getCharacteristic(ENVIRONMENTAL_CHAR1)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    extractEnvironmentalData(parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    }),
                                /* Getting environmetnal characteristic (ver 2. firmware) */
                                service.getCharacteristic(ENVIRONMENTAL_CHAR2)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    extractEnvironmentalData(parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    }),
                                /* Getting accelerometer/gyroscope/magnetometer characteristic */
                                service.getCharacteristic(ACC_GYRO_MAG)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    extractAccGyroMagData(self, parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    }),
                                /* Getting microphone characteristic */
                                service.getCharacteristic(MICROPHONE_CHAR)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    extractMicrophoneData(self, parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    }),

                                /* Getting sensor fusion characteristic */
                                service.getCharacteristic(SENSOR_FUSION)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                sensorFusion.sensorFusionReady = true;
                                                var dataReceived = false;
                                                setTimeout(function () {
                                                    if (sensorFusion.fusionLicenseEnabled == undefined) {
                                                        sensorFusion.fusionLicenseEnabled = false;
                                                    }
                                                }, 5000);
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    if (!dataReceived) {
                                                        sensorFusion.fusionLicenseEnabled = true;
                                                        dataReceived = true;
                                                    }
                                                    extractSensorFusionData(self, parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    }),
                                /* Getting battery characteristic */
                                service.getCharacteristic(BATTERY)
                                    .then(function (characteristic) {
                                        return characteristic.startNotifications()
                                            .then(function () {
                                                characteristic.addEventListener('characteristicvaluechanged', function (value) {
                                                    extractBatteryData(parseResponse(value.target.value.buffer));
                                                    sensorFusion.updateUI();
                                                });
                                            });
                                    })
                            ]).catch(function (err) {
                                console.log(err);
                            });
                        });
                    /* Error handling function */
                }, function (error) {
                    console.warn('Service not found ' + error);
                    self.onError('Timed out');
                    Promise.resolve(true);
                })
        } else {
            console.log('Bluetooth not available');
        }
    };

    window.sensorFusion = new SensorFusion();
}();

/* Function for handling microphone readout data */
var extractMicrophoneData = function (self, value) {
    self.data.micData = parseInt(value[2], 16);
};

/* Helper variables */
var startTime;
var endTime;
var started = false;
var ended = false;
var accArray = [];

/* Function for handling accelerometer/gyroscope/magnetometer readout data */
var extractAccGyroMagData = function(self, value) {
    /* Parsing motion data and storing into data object */
    self.data.accGyroMag.acc.x = twosComplementFromData(value.slice(2, 4)) / 1000;
    self.data.accGyroMag.acc.y = twosComplementFromData(value.slice(4, 6)) / 1000;
    self.data.accGyroMag.acc.z = twosComplementFromData(value.slice(6, 8)) / 1000;
    self.data.accGyroMag.gyro.x = twosComplementFromData(value.slice(8, 10)) / 10;
    self.data.accGyroMag.gyro.y = twosComplementFromData(value.slice(10, 12)) / 10;
    self.data.accGyroMag.gyro.z = twosComplementFromData(value.slice(12, 14)) / 10;
    self.data.accGyroMag.mag.x = twosComplementFromData(value.slice(14, 16));
    self.data.accGyroMag.mag.y = twosComplementFromData(value.slice(16, 18));
    self.data.accGyroMag.mag.z = twosComplementFromData(value.slice(18, 20));

    /* Calculating sum of acceleration vectors and storing that into array */
    self.data.accGyroMag.accVector = sumOfVectors(self.data.accGyroMag.acc.x, self.data.accGyroMag.acc.y, self.data.accGyroMag.acc.z);
    var currentAccVector = self.data.accGyroMag.accVector;
    self.accVectorArray.push(self.data.accGyroMag.accVector.toFixed(4));
    self.data.accGyroMag.accVector = self.data.accGyroMag.accVector.toFixed(1);
    if (self.gyroVectorArray.length > 600) {
        self.gyroVectorArray.shift();
    }

    /* Calculating top acceleration force */
    if (self.accVectorArray.length > 0) {
        self.topGforce = Math.max.apply(null, self.accVectorArray);
    }

    /* Calculating sum of gyroscope vectors and storing that into array */
    self.data.accGyroMag.gyroVector = sumOfVectors(self.data.accGyroMag.gyro.x, self.data.accGyroMag.gyro.y, self.data.accGyroMag.gyro.z);
    self.gyroVectorArray.push(self.data.accGyroMag.gyroVector);
    if (self.gyroVectorArray.length > 2) {
        self.gyroVectorArray.shift();
    }

    self.accArray.push(currentAccVector);
    if (self.accArray.length > 200) {
        self.accArray.shift();
    }

    /* Calculating max acceleration from last 10 seconds */
    if (self.accArray.length > 0) {
        self.topAcc = Math.max.apply(null, self.accArray);
    }

    /* Calculating min acceleration from last 10 seconds */
    if (self.accArray.length > 0) {
        self.minAcc = Math.min.apply(null, self.accArray);
    }

    if (self.gyroVectorArray.length > 1) {
        self.gyroArray.push(Math.abs(self.gyroVectorArray[1] - self.gyroVectorArray[0]));
    }

    if (self.gyroArray.length > 200) {
        self.gyroArray.shift();
    }

    /* Calculating top gyro difference */
    if (self.gyroArray.length > 0) {
        self.topGyroDiff = Math.max.apply(null, self.gyroArray);
    }

    /* Displaying current movement status */
    if (!isNaN(self.data.accGyroMag.accVector) && !isNaN(self.gyroVectorArray[0] && !isNaN(self.gyroVectorArray[1]) && !isNaN(self.topAcc) && !isNaN(self.topGyroDiff))) {
        if (self.topAcc && self.topAcc > 1 + SECOND_MOTION_TRIGGER || self.minAcc && self.minAcc < 1 - SECOND_MOTION_TRIGGER) {
            self.data.accGyroMag.motionStatus = 'Impact';
        } else if (self.topAcc && self.topAcc > 1 + FIRST_MOTION_TRIGGER || self.minAcc && self.minAcc < 1 - FIRST_MOTION_TRIGGER || self.topGyroDiff && self.topGyroDiff > 5) {
            self.data.accGyroMag.motionStatus = 'Moving';
        } else if (self.topAcc && self.topAcc < 1 + FIRST_MOTION_TRIGGER && self.minAcc && self.minAcc > 1 - FIRST_MOTION_TRIGGER && self.topGyroDiff && self.topGyroDiff < 5.01) {
            self.data.accGyroMag.motionStatus = 'Inactive';
        }
    }
};

/* Function for handling environment readout data */
var extractEnvironmentalData = function extractEnvironmentalData(value) {
    /* Parsing environment data and storing into data object */
    window.sensorFusion.data.envData.pressure = parseArray(value.slice(2, 6)) / 100;
    window.sensorFusion.data.envData.temperature = (parseArray(value.slice(value.length - 2, value.length)) / 10 * 9 / 5 + 32).toFixed(2);
};

var recipNorm;

/* Function for handling sensor fusion readout data */
var extractSensorFusionData = function(self, value) {
    /* Parsing sensor fusion data and storing into data object */
    self.q11 = hex2SingleFloat(value.slice(14,16).join('')) / 10000;
    self.q22 = hex2SingleFloat(value.slice(16,18).join('')) / 10000;
    self.q33 = hex2SingleFloat(value.slice(18,20).join('')) / 10000;
    self.q00 = getQs(self.q11, self.q22, self.q33);
    recipNorm = Math.pow(self.q00 * self.q00 + self.q11 * self.q11 + self.q22 * self.q22 + self.q33 * self.q33, -0.5);
    self.q00 *= recipNorm;
    self.q11 *= recipNorm;
    self.q22 *= recipNorm;
    self.q33 *= recipNorm;
};

/* Function for handling battery readout data */
var extractBatteryData = function (value) {
    /* Parsing battery data and storing into data object */
    sensorFusion.batteryLevel = hex2SingleFloat(value.slice(2,4).join('')) / 10;
};

/* Helper function for parsing array */
var parseArray = function parseArray(array) {
    var lenght = array.length;
    var newArray = [];
    var x = 1;
    for (var i = 0; i < lenght; i++) {
        newArray[i] = array[lenght - x];
        x++;
    }
    var str = newArray.join("");
    return parseInt(str, 16);
};

/* Helper function for calculating twos complement from data */
var twosComplementFromData = function twosComplementFromData(data) {
    var result = parseArray(data);
    var value = '';
    if (result > 32767) {
        var dec = parseInt(result.toString(2).replace(/[01]/g, function (n) {
            return 1 - n;
        }), 2);
        return -(dec + 1);
    } else {
        return result;
    }
};

/* Helper function for calculating twos complement */
var twosComplement = function twosComplement(result) {
    if (result > 32767) {
        return -(parseInt(result.toString(2).replace(/[01]/g, function (n) {
            return 1 - n;
        }), 2) + 1);
    } else {
        return result;
    }
};

/* Helper function for calculating sum of vectors */
var sumOfVectors = function sumOfVectors(x, y, z) {
    return Math.sqrt(x * x + y * y + z * z);
};

/* Helper functions for parsing the buffer data  */
var swap16 = function swap16(val) {
    return (val & 0xFF) << 8 | val >> 8 & 0xFF;
};

var buffer = new ArrayBuffer(4);
var bytes = new Int8Array(buffer);
var single = new Uint16Array(buffer);

var hex2SingleFloat = function hex2SingleFloat(hex) {
    bytes[1] = '0x' + hex.match(/.{1,2}/g)[0];
    bytes[0] = '0x' + hex.match(/.{1,2}/g)[1];

    var int16 = swap16(single[0]);
    return twosComplement(int16);
};

var getQs = function getQs(q1, q2, q3) {
    return 1 - (q1 * q1 + q2 * q2 + q3 * q3) > 0 ? Math.sqrt(1 - (q1 * q1 + q2 * q2 + q3 * q3)) : 0;
};

/* Helper function for decoding string */
var decode = function (value) {
    var decoder = new TextDecoder();
    var result = decoder.decode(value);
    return result.replace(/\0/g, '');
};

var parseResponse = function (response) {
    var tmpArray = new Uint8Array(response);
    var result = '';
    for (var i = 0; i < tmpArray.length; i++) {
        var hex = tmpArray[i].toString(16);
        if (hex.length == 1) {
            hex = '0' + hex;
        }
        result = result + hex;
    }
    var data_array = result.match(/.{1,2}/g);
    var numOfData = parseInt(data_array[0], 16);
    return data_array;
};