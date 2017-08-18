function Chart(scope) {
        scope.options = {
            chart: {
                type: 'lineChart',
                height: 250,
                margin: {
                    right: 20,
                    bottom: 40,
                    left: 85
                },
                x: function (d) {
                    return d.x;
                },
                y: function (d) {
                    return d.y;
                },
                showXAxis: false,
                useInteractiveGuideline: true,
                transitionDuration: 0,
                duration: 500,
                yAxis: {
                    tickFormat: function (d) {
                        return d3.format('.01f')(d);
                    }
                },
                xAxis: {
                    axisLabel: 'Time',
                    showMaxMin: false,
                    tickFormat: function (d){
                        return((scope.graphData.micGraph[0].values.length-parseInt(d)+scope.helper)+ " sec's ago");
                    }
                },
                noData: ("")
            }
        };
}