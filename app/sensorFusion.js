"use strict";

(function () {

    var gattip = null;

    /* Defining services and characteristics UUIDs */
    var ENVIRONMENTAL_CHAR1 = "00140000-0001-11E1-AC36-0002A5D5C51B";
    var SENSOR_SERVICE = "00000000-0001-11E1-9AB4-0002A5D5C51B";
    var ENVIRONMENTAL_CHAR2 = "001D0000-0001-11E1-AC36-0002A5D5C51B";
    var ACC_GYRO_MAG = "00E00000-0001-11E1-AC36-0002A5D5C51B";
    var ACCELEROMETER_EVENT_CHAR = "00000400-0001-11E1-AC36-0002A5D5C51B";
    var LED_CHAR = "20000000-0001-11E1-AC36-0002A5D5C51B";
    var MICROPHONE_CHAR = "04000000-0001-11E1-AC36-0002A5D5C51B";
    var CONSOLE_SERVICE = "00000000-000E-11E1-9AB4-0002A5D5C51B";
    var TERMINAL_CHAR = "00000001-000E-11E1-AC36-0002A5D5C51B";
    var STD_ERR_CHAR = "00000002-000E-11E1-AC36-0002A5D5C51B";
    var CONFIGURATION_SERVICE = "00000000-000F-11E1-9AB4-0002A5D5C51B";
    var CONFIGURATION_CHAR = "00000002-000F-11E1-AC36-0002A5D5C51B";
    var BATTERY = "00020000-0001-11E1-AC36-0002A5D5C51B";
    var SENSOR_FUSION = "00000100-0001-11E1-AC36-0002A5D5C51B";
    var ACTIVITY = "00000010-0001-11E1-AC36-0002A5D5C51B";
    var CARRY_POSITION = "00000008-0001-11E1-AC36-0002A5D5C51B";
    var MEMS_GESTURE = "00000002-0001-11E1-AC36-0002A5D5C51B";

    var SensorFusion = function SensorFusion() {
        /* Initializing properties for Sensor Fusion class */
        this.connected = false;
        this.data = {
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
        this.gyroVectorArray = [];
        this.accVectorArray = [];
        this.accArray = [];
        this.gyroArray = [];
        this.topGforce = '';
        this.topAcc = '';
        this.minAcc = '';
        this.motionFirstTrigger = 0.1;
        this.motionSecondTrigger = 0.5;
        this.q00 = undefined;
        this.q11 = undefined;
        this.q22 = undefined;
        this.q33 = undefined;
        this.sensorFusionReady = false;
        this.disconnected = false;
        this.fusionLicenseEnabled = undefined;

        this.peripheral = {};

        /* Taking gattip from navigator object */
        gattip = navigator.bluetooth.gattip;

        /* Function for connecting to the device */
        gattip.once('ready', function (gateway) {
            function onScan(peripheral) {
                sensorFusion.peripheral = peripheral;
                console.log('Found peripheral', peripheral.name);
                sensorFusion.connected = true;
                sensorFusion.wasConnected = true;
                gateway.removeListener('scan', onScan);
                /* Stopping the scan when device is found */
                gateway.stopScan(function () {
                    /* Connecting to the device */
                    peripheral.connect(function () {
                        /* Disconnection listener */
                        peripheral.on('disconnected', function () {
                            sensorFusion.clearData();
                            sensorFusion.onError('Device disconnected');
                            sensorFusion.disconnected = true;
                            sensorFusion.disconnectIndicator();
                            console.log('device disconnected');
                        });
                        /* Calling function for using data from the device */
                        readCharacteristicValues(peripheral);
                        sensorFusion.onSuccess('Connected with ' + peripheral.name);
                    });
                });
            }

            /* Calling scan function */
            gateway.scan();
            gateway.on('scan', onScan);
        });

        /* Error handling function */
        gattip.on('error', function (err) {
            console.log(err);
        });

        /* ------- SensorFusion Handling Functions ------- */

        /* Function for handling microphone readout data */
        this.enableNotifyMicrophoneChar = function () {
            var value = '';
            /* Getting microphone characteristic from primary service */
            var notify_char = getCharacteristic(SENSOR_SERVICE, MICROPHONE_CHAR);
            if (notify_char) {
                /* Event listener for microphone data changes */
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using microphone data */
                    extractMicrophoneData(notify_char.value);
                    sensorFusion.updateUI();
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
            }
        };

        /* Function for handling accelerometer/gyroscope/magnetometer readout data */
        this.enableNotifyAccGyroMagChar = function () {
            var value = '';
            /* Getting motion characteristic from primary service */
            var notify_char = getCharacteristic(SENSOR_SERVICE, ACC_GYRO_MAG);
            if (notify_char) {
                /* Event listener for motion data changes */
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using motion data */
                    extractAccGyroMagData(notify_char.value);
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
            }
        };

        /* Function for handling environmental readout data */
        this.enableNotifyEnvironmentalChar = function () {
            var value = '';
            /* Getting environmental characteristic from primary service */
            var notify_char = getCharacteristic(SENSOR_SERVICE, ENVIRONMENTAL_CHAR1);
            if (notify_char) {
                /* Event listener for environmental data changes */
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using environmental data */
                    extractEnvironmentalData(notify_char.value);
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
            } else {
                /* If first characteristic not found, trying to get environmental characteristic from primary service with second UUID*/
                notify_char = getCharacteristic(SENSOR_SERVICE, ENVIRONMENTAL_CHAR2);
                /* Event listener for environmental data changes */
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using environmental data */
                    extractEnvironmentalData(notify_char.value);
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
            }
        };

        /* Function for handling sensor fusion readout data */
        this.enableSensorFusionChar = function () {
            var value = '';
            /* Getting sensor fusion characteristic from primary service */
            var notify_char = getCharacteristic(SENSOR_SERVICE, SENSOR_FUSION);
            if (notify_char) {
                /* Event listener for sensor fusion data changes */
                sensorFusion.sensorFusionReady = true;
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using sensor fusion data */
                    extractSensorFusionData(notify_char.value);
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
                /* Reading sensor fusion status. If reading all zeros, sensor fusion is disabled */
                setTimeout(function () {
                    var readLicense = setInterval(function () {
                        var readout = notify_char.value;
                        if (readout != undefined) {
                            sensorFusion.fusionLicenseEnabled = !(readout.substr(28, 12) == '000000000000');
                            clearInterval(readLicense);
                        }
                    }, 10);
                }, 2000);
            }
        };

        /* Function for handling battery readout data */
        this.enableBatteryChar = function () {
            var value = '';
            /* Getting battery characteristic from primary service */
            var notify_char = getCharacteristic(SENSOR_SERVICE, BATTERY);
            if (notify_char) {
                /* Event listener for battery data changes */
                notify_char.on('valueChange', function (notify_char) {
                    /* Calling function for using battery data */
                    extractBatteryData(notify_char.value);
                }, value);
                notify_char.enableNotifications(function (notify_char, value) {}, true);
            }
        };
    };
    window.sensorFusion = new SensorFusion();
})();

/* Function for initiating notifications from all characteristics */
var readCharacteristicValues = function readCharacteristicValues() {
    sensorFusion.enableNotifyMicrophoneChar();
    sensorFusion.enableNotifyAccGyroMagChar();
    sensorFusion.enableNotifyEnvironmentalChar();
    sensorFusion.enableSensorFusionChar();
    sensorFusion.enableBatteryChar();
};

/* Function for getting characteristic from service */
var getCharacteristic = function getCharacteristic(serv, characteristic) {
    var service = sensorFusion.peripheral.findService(serv);
    if (service) {
        return service.findCharacteristic(characteristic);
    }
};

/* Function for handling microphone readout data */
var extractMicrophoneData = function extractMicrophoneData(value) {
    sensorFusion.data.micData = parseInt(value.substr(4, 2), 16);
};

/* Helper variables */
var startTime;
var endTime;
var started = false;
var ended = false;
var accArray = [];

/* Function for handling accelerometer/gyroscope/magnetometer readout data */
var extractAccGyroMagData = function extractAccGyroMagData(value) {
    var agmArray = dataToArray(value);
    /* Parsing motion data and storing into data object */
    sensorFusion.data.accGyroMag.acc.x = twosComplementFromData(agmArray.slice(2, 4)) / 1000;
    sensorFusion.data.accGyroMag.acc.y = twosComplementFromData(agmArray.slice(4, 6)) / 1000;
    sensorFusion.data.accGyroMag.acc.z = twosComplementFromData(agmArray.slice(6, 8)) / 1000;
    sensorFusion.data.accGyroMag.gyro.x = twosComplementFromData(agmArray.slice(8, 10)) / 10;
    sensorFusion.data.accGyroMag.gyro.y = twosComplementFromData(agmArray.slice(10, 12)) / 10;
    sensorFusion.data.accGyroMag.gyro.z = twosComplementFromData(agmArray.slice(12, 14)) / 10;
    sensorFusion.data.accGyroMag.mag.x = twosComplementFromData(agmArray.slice(14, 16));
    sensorFusion.data.accGyroMag.mag.y = twosComplementFromData(agmArray.slice(16, 18));
    sensorFusion.data.accGyroMag.mag.z = twosComplementFromData(agmArray.slice(18, 20));

    /* Calculating sum of acceleration vectors and storing that into array */
    sensorFusion.data.accGyroMag.accVector = sumOfVectors(sensorFusion.data.accGyroMag.acc.x, sensorFusion.data.accGyroMag.acc.y, sensorFusion.data.accGyroMag.acc.z);
    var currentAccVector = sensorFusion.data.accGyroMag.accVector;
    sensorFusion.accVectorArray.push(sensorFusion.data.accGyroMag.accVector.toFixed(4));
    sensorFusion.data.accGyroMag.accVector = sensorFusion.data.accGyroMag.accVector.toFixed(1);
    if (sensorFusion.gyroVectorArray.length > 600) {
        sensorFusion.gyroVectorArray.shift();
    }

    /* Calculating top acceleration force */
    if (sensorFusion.accVectorArray.length > 0) {
        sensorFusion.topGforce = Math.max.apply(null, sensorFusion.accVectorArray);
    }

    /* Calculating sum of gyroscope vectors and storing that into array */
    sensorFusion.data.accGyroMag.gyroVector = sumOfVectors(sensorFusion.data.accGyroMag.gyro.x, sensorFusion.data.accGyroMag.gyro.y, sensorFusion.data.accGyroMag.gyro.z);
    sensorFusion.gyroVectorArray.push(sensorFusion.data.accGyroMag.gyroVector);
    if (sensorFusion.gyroVectorArray.length > 2) {
        sensorFusion.gyroVectorArray.shift();
    }

    sensorFusion.accArray.push(currentAccVector);
    if (sensorFusion.accArray.length > 200) {
        sensorFusion.accArray.shift();
    }

    /* Calculating max acceleration from last 10 seconds */
    if (sensorFusion.accArray.length > 0) {
        sensorFusion.topAcc = Math.max.apply(null, sensorFusion.accArray);
    }

    /* Calculating min acceleration from last 10 seconds */
    if (sensorFusion.accArray.length > 0) {
        sensorFusion.minAcc = Math.min.apply(null, sensorFusion.accArray);
    }

    if (sensorFusion.gyroVectorArray.length > 1) {
        sensorFusion.gyroArray.push(Math.abs(sensorFusion.gyroVectorArray[1] - sensorFusion.gyroVectorArray[0]));
    }

    if (sensorFusion.gyroArray.length > 200) {
        sensorFusion.gyroArray.shift();
    }

    /* Calculating top gyro difference */
    if (sensorFusion.gyroArray.length > 0) {
        sensorFusion.topGyroDiff = Math.max.apply(null, sensorFusion.gyroArray);
    }

    /* Displaying current movement status */
    if (!isNaN(sensorFusion.data.accGyroMag.accVector) && !isNaN(sensorFusion.gyroVectorArray[0] && !isNaN(sensorFusion.gyroVectorArray[1]) && !isNaN(sensorFusion.topAcc) && !isNaN(sensorFusion.topGyroDiff))) {
        if (sensorFusion.topAcc && sensorFusion.topAcc > 1 + sensorFusion.motionSecondTrigger || sensorFusion.minAcc && sensorFusion.minAcc < 1 - sensorFusion.motionSecondTrigger) {
            sensorFusion.data.accGyroMag.motionStatus = 'Impact';
        } else if (sensorFusion.topAcc && sensorFusion.topAcc > 1 + sensorFusion.motionFirstTrigger || sensorFusion.minAcc && sensorFusion.minAcc < 1 - sensorFusion.motionFirstTrigger || sensorFusion.topGyroDiff && sensorFusion.topGyroDiff > 5) {
            sensorFusion.data.accGyroMag.motionStatus = 'Moving';
        } else if (sensorFusion.topAcc && sensorFusion.topAcc < 1 + sensorFusion.motionFirstTrigger && sensorFusion.minAcc && sensorFusion.minAcc > 1 - sensorFusion.motionFirstTrigger && sensorFusion.topGyroDiff && sensorFusion.topGyroDiff < 5.01) {
            sensorFusion.data.accGyroMag.motionStatus = 'Inactive';
        }
    }
};

/* Function for handling environment readout data */
var extractEnvironmentalData = function extractEnvironmentalData(value) {
    var envArray = dataToArray(value);
    /* Parsing environment data and storing into data object */
    sensorFusion.data.envData.pressure = parseArray(envArray.slice(2, 6)) / 100;
    sensorFusion.data.envData.temperature = (parseArray(envArray.slice(envArray.length - 2, envArray.length)) / 10 * 9 / 5 + 32).toFixed(2);
};

var recipNorm;

/* Function for handling sensor fusion readout data */
var extractSensorFusionData = function extractSensorFusionData(value) {
    /* Parsing sensor fusion data and storing into data object */
    sensorFusion.q11 = hex2SingleFloat(value.substr(28, 4)) / 10000;
    sensorFusion.q22 = hex2SingleFloat(value.substr(32, 4)) / 10000;
    sensorFusion.q33 = hex2SingleFloat(value.substr(36, 4)) / 10000;
    sensorFusion.q00 = getQs(sensorFusion.q11, sensorFusion.q22, sensorFusion.q33);
    recipNorm = Math.pow(sensorFusion.q00 * sensorFusion.q00 + sensorFusion.q11 * sensorFusion.q11 + sensorFusion.q22 * sensorFusion.q22 + sensorFusion.q33 * sensorFusion.q33, -0.5);
    sensorFusion.q00 *= recipNorm;
    sensorFusion.q11 *= recipNorm;
    sensorFusion.q22 *= recipNorm;
    sensorFusion.q33 *= recipNorm;
};

/* Function for handling battery readout data */
var extractBatteryData = function extractBatteryData(value) {
    /* Parsing battery data and storing into data object */
    sensorFusion.batteryLevel = hex2SingleFloat(value.substr(4, 4)) / 10;
};

/* Helper function for parsing the data */
var dataToArray = function dataToArray(data) {
    return data.match(/.{1,2}/g);
};

/* Helper function for parsing array */
var parseArray = function parseArray(array) {
    var lenght = array.length;
    var newArray = [];
    var x = 1;
    for (i = 0; i < lenght; i++) {
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