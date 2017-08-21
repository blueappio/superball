'use strict';

function Utility() {

    /* Defining DOM related variables for icons and circles */
    var noiseIcon = document.getElementById('noiseIcon');
    var noiseCircle = document.getElementById('noiseCircle');
    var ledImg = document.getElementById('ledImg');
    var image = document.getElementById('img');
    var agmIcon = document.getElementById('agmIcon');
    var agmCircle = document.getElementById('agmCircle');
    var battCircle = document.getElementById('battCircle');
    var battIcon = document.getElementById('battIcon');
    var motionAlarmPause = true;

    /* Initializing graph data */
    this.initializeGraphData = function (scope) {
        scope.graphData = {
            micGraph: [{ values: [], key: 'Microphone' }],
            tempGraph: [{ values: [], key: 'Temperature' }],
            accGraph: [{ values: [], key: 'G force' }],
            gyroGraph: [{ values: [], key: 'X' }, { values: [], key: 'Y' }, { values: [], key: 'Z' }]
        };
    };

    /* Updating graphs and icon colors */
    this.updateData = function (inputData, scope) {
        /* Calling functions for updating icon colors depending on sensor readouts */
        updateMicColor(scope);
        updateAgmColor(scope);
        updateBattColor(scope);

        if (scope.graphData.micGraph[0].values.length > 59) {
            scope.helper++;
        }

        /* Calling functions for preparing the graphs */
        prepareSingleGraph(inputData.micData, scope.graphData.micGraph, scope);
        prepareSingleGraph(inputData.envData.temperature, scope.graphData.tempGraph, scope);
        prepareSingleGraph(inputData.accGyroMag.accVector, scope.graphData.accGraph, scope);
        prepareTripletGraph(inputData.accGyroMag.gyro.x, inputData.accGyroMag.gyro.y, inputData.accGyroMag.gyro.z, scope.graphData.gyroGraph, scope);
        if (inputData.micData != '') {
            scope.time++;
        }
        scope.$apply();
    };

    /* Function for preparing single data graph */
    var prepareSingleGraph = function prepareSingleGraph(graphData, outputData, scope) {
        if (graphData != '' && !isNaN(graphData)) {
            pushSingleData(graphData, outputData, scope);
            if (outputData[0].values.length > 60) {
                outputData[0].values.shift();
            }
        }
    };

    /* Function for preparing triple data graph */
    var prepareTripletGraph = function prepareTripletGraph(graphData1, graphData2, graphData3, outputData, scope) {
        if (!isNaN(graphData1) && !isNaN(graphData2) && !isNaN(graphData3)) {
            pushTripletData(graphData1, graphData2, graphData3, outputData, scope);
            if (outputData[0].values.length > 60) {
                outputData[0].values.shift();
            }
            if (outputData[1].values.length > 60) {
                outputData[1].values.shift();
            }
            if (outputData[2].values.length > 60) {
                outputData[2].values.shift();
            }
        }
    };

    /* Storing single graph data */
    var pushSingleData = function pushSingleData(graphData, data, scope) {
        data[0].values.push({
            x: scope.time,
            y: graphData
        });
    };

    /* Storing triple graph data */
    var pushTripletData = function pushTripletData(graphData1, graphData2, graphData3, data, scope) {
        data[0].values.push({
            x: scope.time,
            y: graphData1
        });
        data[1].values.push({
            x: scope.time,
            y: graphData2
        });
        data[2].values.push({
            x: scope.time,
            y: graphData3
        });
    };

    /* Mic icon color update */
    var updateMicColor = function updateMicColor(scope) {
        if (scope.sensorFusion.data.micData != '') {
            switch (true) {
                case scope.sensorFusion.data.micData <= 40:
                    scope.speaker = "app/images/speaker-1.svg";
                    noiseIcon.style.backgroundColor = "#4fbb0d";
                    noiseCircle.style.backgroundColor = "#4fbb0d";
                    break;
                case scope.sensorFusion.data.micData <= 70 && scope.sensorFusion.data.micData > 40:
                    scope.speaker = "app/images/speaker-2.svg";
                    noiseIcon.style.backgroundColor = "#4fbb0d";
                    noiseCircle.style.backgroundColor = "#4fbb0d";
                    break;
                case scope.sensorFusion.data.micData > 70:
                    scope.speaker = "app/images/speaker-3.svg";
                    noiseIcon.style.backgroundColor = "#e22422";
                    noiseCircle.style.backgroundColor = "#e22422";
                    break;
            }
        }
    };

    /* Motion icon color update */
    var updateAgmColor = function updateAgmColor(scope) {
        if (scope.sensorFusion.data.accGyroMag.motionStatus != '') {
            switch (true) {
                case scope.sensorFusion.data.accGyroMag.motionStatus == 'Inactive':
                    agmIcon.style.backgroundColor = "#4fbb0d";
                    agmCircle.style.backgroundColor = "#4fbb0d";
                    break;
                case scope.sensorFusion.data.accGyroMag.motionStatus == 'Moving':
                    agmIcon.style.backgroundColor = "#4fbb0d";
                    agmCircle.style.backgroundColor = "#4fbb0d";
                    break;
                case scope.sensorFusion.data.accGyroMag.motionStatus == 'Impact':
                    agmIcon.style.backgroundColor = "#e22422";
                    agmCircle.style.backgroundColor = "#e22422";
                    break;
            }
        }
    };

    /* Battery icon color update */
    var updateBattColor = function updateBattColor(scope) {
        if (scope.sensorFusion.batteryLevel != '') {
            switch (true) {
                case scope.sensorFusion.batteryLevel < 20:
                    battCircle.style.backgroundColor = "#e22422";
                    battIcon.style.backgroundColor = "#e22422";
                    break;
                case scope.sensorFusion.batteryLevel >= 20:
                    battCircle.style.backgroundColor = "#4fbb0d";
                    battIcon.style.backgroundColor = "#4fbb0d";
                    break;
            }
        }
    };

    return this;
}