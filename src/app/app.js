'use strict';

var app;
(function () {
    /* Angular module initialization */
    app = angular.module('sensorFusion', ['ngMaterial', 'ngMdIcons', 'nvd3']).config(function ($mdThemingProvider) {
        /* Palette setup */
        $mdThemingProvider.theme('default').primaryPalette('blue').accentPalette('pink');
        $mdThemingProvider.theme('success-toast');
        $mdThemingProvider.theme('error-toast');

        $mdThemingProvider.alwaysWatchTheme(true);
    });
})();

app.run(['$document', '$window', function ($document, $window) {
    var document = $document[0];
    document.addEventListener('click', function (event) {
        var hasFocus = document.hasFocus();
        if (!hasFocus) $window.focus();
    });
}]);

app.controller('mainController', function ($scope, $mdDialog, $mdToast) {
    /* Initializing controller variables */
    $scope.sensorFusion = window.sensorFusion;

    var utility = new Utility();
    var chart = new Chart($scope);
    utility.initializeGraphData($scope);
    $scope.displayTemp = false;
    $scope.displayAcc = false;
    $scope.displayGyro = false;
    $scope.displayMag = false;
    $scope.displayMic = false;
    $scope.time = 0;
    $scope.helper = 0;
    $scope.micAudio = '';
    $scope.motionAudio = '';
    $scope.objectLoaded = false;
    var accArrayY = [];
    var accArrayZ = [];
    var acc = document.getElementsByClassName("accordion");
    var i;
    var loadWidth;
    var height;
    var orientation;
    var camera, renderer, scene, myObj;

    // Disabling the mouse right click event
    document.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });

    /* Accordion setup */
    for (i = 0; i < acc.length; i++) {
        acc[i].onclick = function () {
            this.classList.toggle("active");
            this.nextElementSibling.classList.toggle("show");
        };
    }

    /* Calling function for updating graphs and icon colors every second */
    setInterval(function () {
        if(sensorFusion.connected){
            utility.updateData($scope.sensorFusion.data, $scope);
        }
    }, 1000);

    /* Defining on success toast */
    $scope.sensorFusion.onSuccess = function (message) {
        $mdToast.show($mdToast.simple().content(message).parent(document.querySelectorAll('#toaster')).position('top right').hideDelay(2500).theme("success-toast"));
    };

    /* Defining on error toast */
    $scope.sensorFusion.onError = function (message) {
        $mdToast.show($mdToast.simple().content(message).parent(document.querySelectorAll('#toaster')).position('top right').hideDelay(2500).theme("error-toast"));
    };

    function showLoadingIndicator($event, text) {
        var parentEl = angular.element(document.body);
        $mdDialog.show({
            parent: parentEl,
            targetEvent: $event,
            clickOutsideToClose: false,
            template: '<md-dialog style="width: 250px;top:95px;margin-top: -170px;" aria-label="loadingDialog" ng-cloak>' +
            '<md-dialog-content>' +
            '<div layout="row" layout-align="center" style="padding: 40px;">' +
            '<div style="padding-bottom: 20px;">' +
                '<img src="app/images/loader.gif" width="80px" height="80px">' +
            // '<md-progress-circular md-mode="indeterminate" md-diameter="120" style="right: 10px;bottom: 5px;">' +
            // '</md-progress-circular>' +
            '</div>' +
            '</div>' +
            '<div layout="row" layout-align="center" style="padding-bottom: 20px;">' +
            '<label>' + text + '</label>' +
            '</div>' +
            '</md-dialog-content>' +
            '</md-dialog>',
            locals: {
                items: $scope.items
            },
            controller: DialogController
        });

        function DialogController($scope, $mdDialog, items) {
            $scope.items = items;
            $scope.closeDialog = function () {
                $mdDialog.hide();
            }
        }
    }
    
    /* Defining function for display update*/
    $scope.sensorFusion.updateUI = function () {
        $scope.$apply();
    };

    /* Defining function for reset all sensor fusion variables */
    $scope.sensorFusion.clearData = function () {
        $scope.sensorFusion.connected = false;
        $scope.sensorFusion.data = {
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
        $scope.sensorFusion.gyroVectorArray = [];
        $scope.sensorFusion.accVectorArray = [];
        $scope.sensorFusion.accArray = [];
        $scope.sensorFusion.gyroArray = [];
        $scope.sensorFusion.topGforce = '';
        $scope.sensorFusion.topAcc = '';
        $scope.sensorFusion.minAcc = '';
        $scope.sensorFusion.motionFirstTrigger = 0.1;
        $scope.sensorFusion.motionSecondTrigger = 0.5;
        $scope.sensorFusion.q00 = undefined;
        $scope.sensorFusion.q11 = undefined;
        $scope.sensorFusion.q22 = undefined;
        $scope.sensorFusion.q33 = undefined;
        $scope.sensorFusion.sensorFusionReady = false;
        $scope.sensorFusion.batteryLevel = undefined;
        document.getElementById('noiseIcon').style.backgroundColor = "#e6e6e6";
        document.getElementById('noiseCircle').style.backgroundColor = "#e6e6e6";
        document.getElementById('battIcon').style.backgroundColor = "#e6e6e6";
        document.getElementById('battCircle').style.backgroundColor = "#e6e6e6";
    };

    /* Calling functions for rendering ball 3d object */
    setTimeout(function () {
        var loadObject = setInterval(function () {
            if ($scope.sensorFusion.sensorFusionReady && $scope.sensorFusion.fusionLicenseEnabled != undefined) {
                clearInterval(loadObject);
                if ($scope.sensorFusion.fusionLicenseEnabled) {
                    init();
                } else {
                    loadImage();
                }
            }
        }, 10);
    },1000);

    /* Function for rendering ball 3d object */
    var init = function init() {
        try {
            /* Initializing webGL renderer */
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            });
            /* Defining object container */
            var container = document.getElementById('canvas');
            var pivot;
            /* Setting container dimensions */
            var width = loadWidth = document.getElementById('canvas').offsetWidth;
            var loadHeight = window.innerHeight;
            var portrait = loadHeight > loadWidth;

            var ratio = 800 / 400;
            if (loadWidth < 640 && portrait) {
                height = width / ratio * 2.2;
            } else {
                height = width / ratio;
            }

            renderer.setClearColor(0xFAFAFA, 0);
            renderer.setSize(width, height-50);
            container.appendChild(renderer.domElement);

            /* Setting object perspective */
            camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
            camera.position.z = 52;
            scene = new THREE.Scene();
            scene.background = new THREE.Color('#FAFAFA');

            /* Setting object loading manager */
            var manager = new THREE.LoadingManager();
            manager.onProgress = function (item, loaded, total) {
                // console.log( item, loaded, total );
            };

            /* Setting object texture */
            var texture = new THREE.Texture();
            var onProgress = function onProgress(xhr) {
                if (xhr.lengthComputable) {
                    var percentComplete = xhr.loaded / xhr.total * 100;
                }
            };

            var onError = function onError(xhr) {};

            /* Importing image loader */
            var loader = new THREE.ImageLoader(manager);
            loader.load('app/images/ballTexture.png', function (image) {
                texture.image = image;
                texture.needsUpdate = true;
            });

            /* Importing ball 3d object */
            var material = new THREE.MeshBasicMaterial({ color: '', side: THREE.DoubleSide });
            var loader = new THREE.OBJLoader(manager);
            loader.load('app/images/ballObject.obj', function (object) {
                myObj = object;
                object.traverse(function (child) {
                    if (child instanceof THREE.Mesh) {
                        child.material = material;
                        child.material.map = texture;
                    }
                });
                /* Setting object position */
                object.position.x = 0;
                object.position.y = 0;
                object.position.z = 0;
                scene.add(object);
            }, onProgress, onError);
        
            /* Rendering object to the selected div */
            var loadObject = setInterval(function () {
                if (typeof myObj != 'undefined') {
                    $scope.objectLoaded = true;
                    pivot = new THREE.Object3D();
                    pivot.add(myObj);
                    if ($scope.sensorFusion.sensorFusionReady) {
                        clearInterval(loadObject);
                        $scope.sensorFusion.readyToDisplay = true;
                        scene.add(pivot);
                        render();
                    }
                }
            }, 10);

            /* Listener for screen resize */
            window.addEventListener('resize', onWindowResize, false);

            /* Logic for rotating the object */
            setTimeout(function () {
                setInterval(function () {
                    /* Taking sensor fusion data, and setting them to quaternion properties for ball rotation */
                    pivot.quaternion.set($scope.sensorFusion.q22, $scope.sensorFusion.q33, $scope.sensorFusion.q11, $scope.sensorFusion.q00);
                    render();
                }, 10);
            }, 2000);
        } catch (err) {
            loadImage();
        }
    };

    /* Loading image in case WebGL not supported or sensor fusion characteristic disabled */
    var loadImage = function() {
        var img = document.createElement("img");
        img.src = "app/images/22.png";
        var src = document.getElementById("canvas");
        src.appendChild(img);
        $scope.sensorFusion.readyToDisplay = true;
        updateImage();
    };

    /* Updating the image in case WebGL not supported or sensor fusion characteristic disabled */
    var updateImage = function updateImage() {
        /* Taking data from acceleration and render proper image depending of acceleration readouts */
        setInterval(function () {
            accArrayY.unshift($scope.sensorFusion.data.accGyroMag.acc.y);
            if (accArrayY.length > 3) {
                accArrayY.pop();
            }

            var sum2 = 0;
            for (var j = 0; j < accArrayY.length; j++) {
                sum2 += accArrayY[j];
            }

            var avgY = sum2 / accArrayY.length;
            accArrayZ.unshift($scope.sensorFusion.data.accGyroMag.acc.z);
            if (accArrayZ.length > 3) {
                accArrayZ.pop();
            }

            var sum3 = 0;
            for (var k = 0; k < accArrayZ.length; k++) {
                sum3 += accArrayZ[k];
            }

            var avgZ = sum3 / accArrayZ.length;

            if (Math.abs(avgY) > 0.8 && Math.abs(avgY) < 1.2) {
                if (avgY > 0) {
                    document.getElementById('canvas').getElementsByTagName('img')[0].src = 'app/images/44.png';
                } else {
                    document.getElementById('canvas').getElementsByTagName('img')[0].src = 'app/images/33.png';
                }
            }

            if (Math.abs(avgZ) > 0.8 && Math.abs(avgZ) < 1.2) {
                if (avgZ > 0) {
                    document.getElementById('canvas').getElementsByTagName('img')[0].src = 'app/images/22.png';
                } else {
                    document.getElementById('canvas').getElementsByTagName('img')[0].src = 'app/images/11.png';
                }
            }
        }, 10);
    };

    /* Change object dimension on window resize event  */
    var onWindowResize = function () {
        var width = document.getElementById('canvas').offsetWidth;
        var loadHeight = window.innerHeight;
        var portrait = loadHeight > loadWidth;
        var ratio = 800 / 400;
        if (loadWidth < 640 && portrait) {
            height = width / ratio * 2.2;
        } else {
            height = width / ratio;
        }
        renderer.setSize(width, height-50);
    };

    /* Render function  */
    var render = function render() {
        renderer.render(scene, camera);
    };
    function dismissLoadingIndicator() {
        $mdDialog.cancel();
    }

    $scope.onConnect = function () {
        showLoadingIndicator('', 'Connecting ....');
        $scope.sensorFusion.connect()
            .then(function () {
                dismissLoadingIndicator();
                if($scope.sensorFusion.connected){
                    $scope.sensorFusion.onSuccess('Connected...');
                }
                $scope.$apply();
            })
            .catch(function (error) {
                dismissLoadingIndicator();
                console.error('Argh!', error, error.stack ? error.stack : '');
            });
    };
});