import './definitions.js'
import $ from 'jquery';
import 'bootstrap/dist/js/bootstrap.bundle.js'

import 'ol/ol.css';
import Map from 'ol/map';
import View from 'ol/view';
import Tile from 'ol/layer/tile';
import VectorLayer from 'ol/layer/vector'
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { easeOut, linear } from 'ol/easing.js';
import { unByKey } from 'ol/Observable.js';
import ScaleLine from 'ol/control/ScaleLine';
import ZoomSlider from 'ol/control/ZoomSlider';
import { Circle as CircleStyle, Text as TextStyle, Fill, Stroke, Style } from 'ol/style.js';
import OSM from 'ol/source/osm';
import { fromLonLat } from 'ol/proj';
import Chart from 'chart.js';

var barChartData = {
    labels: [],
    datasets: [{
        label: 'Magnitude: 6+',
        backgroundColor: window.chartColors.mag6,
        //yAxisID: 'y-axis-1',
        data: []
    }, {
        label: 'Magnitude: 7+',
        //yAxisID: 'y-axis-1',
        backgroundColor: window.chartColors.mag7,
        data: []
    },
    {
        label: 'Magnitude: 8+',
        //yAxisID: 'y-axis-1',
        backgroundColor: window.chartColors.mag8,
        data: []
    }, {
        label: 'Magnitude: 9+',
        //yAxisID: 'y-axis-1',
        backgroundColor: window.chartColors.mag9,
        data: []
    }
    ]
};

var loadchart = function () {
    var ctx = document.getElementById('overall-stats').getContext('2d');
    window.myBar = new Chart(ctx, {
        type: 'bar',
        data: barChartData,
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Full History'
            },
            tooltips: {
                mode: 'index',
                intersect: true
            },
            scales: {
                yAxes: [{
                    position: 'left',
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            legend: {
                position: 'left',
                labels: {
                    boxWidth: 20,
                    padding: 10
                }
            },
            maintainAspectRatio: false
        }
    });
};

loadchart();

var pos = function () {
    return fromLonLat([7.906754, 47.316216]);
};

const map = new Map({
    target: 'map',
    layers: [
        //raster,
        new Tile({
            source: new OSM()
        })
    ],
    view: new View({
        projection: 'EPSG:3857',
        center: pos(),
        zoom: 2,
        // extent: [-7435794.111581946, -8766409.899970295, 8688138.383006273, 9314310.518718438]
    })
});

var duration = 3000;
function flash(feature) {
    var start = new Date().getTime();
    var listenerKey = map.on('postcompose', animate);

    function animate(event) {
        var vectorContext = event.vectorContext;
        var frameState = event.frameState;
        var flashGeom = feature.getGeometry().clone();
        var elapsed = frameState.time - start;
        var elapsedRatio = elapsed / duration;
        var magnitude = parseFloat(feature.get('magnitude'));
        var radius = linear(elapsedRatio) * 30 * (magnitude - 6) + 5;
        var opacity = easeOut(1 - elapsedRatio);

        var style = new Style({
            image: new CircleStyle({
                radius: radius,
                stroke: new Stroke({
                    color: 'rgba(255, 0, 0, ' + opacity + ')',
                    width: 0.25 + opacity
                })
            })
        });

        vectorContext.setStyle(style);
        vectorContext.drawGeometry(flashGeom);
        if (elapsed > duration) {
            unByKey(listenerKey);
            return;
        }
        map.render();
    }
}

var scaleLineControl = new ScaleLine({
    units: 'metric',
    minWidth: 190
});

map.addControl(scaleLineControl);
map.addControl(new ZoomSlider());

var info = $('#info');
info.tooltip({
    animation: false,
    trigger: 'manual'
});

var displayFeatureInfo = function (pixel) {
    info.css({
        left: pixel[0] + 'px',
        top: (pixel[1] - 15) + 'px'
    });
    var feature = map.forEachFeatureAtPixel(pixel, function (feature) {
        return feature;
    });
    if (feature) {
        info.tooltip('hide')
            .attr('data-original-title', feature.get('name'))
            //.tooltip('fixTitle')
            .tooltip('show');
    } else {
        info.tooltip('hide');
    }
};

map.on('pointermove', function (evt) {
    if (evt.dragging) {
        info.tooltip('hide');
        return;
    }
    displayFeatureInfo(map.getEventPixel(evt.originalEvent));
});

$('.ol-zoom-in, .ol-zoom-out').tooltip({
    placement: 'right'
});
$('.ol-rotate-reset, .ol-attribution button[title]').tooltip({
    placement: 'left'
});

//map.on('click', function (evt) {
//    displayFeatureInfo(evt.pixel);
//});

var opacityAnimationFast = function (domElement) {
    domElement.animate(
        {
            opacity: "1"
        }, {
            duration: 1000,
            complete: function () {
            }
        }
    );
}


var fadeOutAnimation = function (domElement, text) {
    domElement.animate(
        {
            opacity: "0"
        }, {
            duration: 300,
            complete: function () {
                domElement.text(text);
            }
        }
    );
}

var opacityAnimationSlow = function (domElement) {
    domElement.animate(
        {
            opacity: "1"
        }, {
            duration: 2000,
            complete: function () {
            }
        }
    );
}

var initVectorSource = () => {
    var source = new VectorSource({
        featureProjection: 'EPSG:3857',
        format: geojsonFormat
    });
    source.on('addfeature', function (e) {
        flash(e.feature);
    });
    return source;
}

var styleCacheQuake = {};
var styleCacheQuakeText = {};
var styleFunction = function (feature) {
    var magnitude = parseFloat(feature.get('magnitude'));
    if (magnitude < 5) {
        console.log(feature.get('name'));
        console.log(magnitude);
    }
    var radius = 5 + 30 * (magnitude - 6);
    var style = styleCacheQuake[radius];
    var magFill;
    let magCategory = Math.trunc(magnitude);
    switch (magCategory) {
        case 6:
            magFill = new Fill({
                color: window.mapColors.mag6
            });
            break;
        case 7:
            magFill = new Fill({
                color: window.mapColors.mag7
            });
            break;
        case 8:
            magFill = new Fill({
                color: window.mapColors.mag8
            });
            break;
        case 9:
            magFill = new Fill({
                color: window.mapColors.mag9
            });
            break;
    };
    if (!style) {
        style = new Style({
            image: new CircleStyle({
                radius: radius,
                fill: magFill,
                stroke: new Stroke({
                    color: 'rgba(255, 204, 0, 0.2)',
                    width: 1
                })
            })
        });
        styleCacheQuake[radius] = style;
    }

    if (magnitude <= 8.0) {
        return style;
    }
    var key = 'text' + feature.get('name') + feature.get('magnitude');
    if (!styleCacheQuakeText[key]) {
        styleCacheQuakeText[key] = new Style({
            text: new TextStyle({
                font: '10px Verdana',
                text: feature.get('magnitude'),
                textBaseline: 'alphabetic',
                offsetY: 4,
                fill: new Fill({
                    color: 'black'
                })
            })
        });
    }
    return [style, styleCacheQuakeText[key]];
};

const geojsonFormat = new GeoJSON({
    defaultDataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
    extractStyles: true
});

var appendStatistics = function (year) {
    //extend statistics table and barchart
    var description = $("#data-description ");
    var yearStats = statistics[year];
    description.append("<div class='data-cell ys" + year + " hidden-opacity'>" + yearStats.year + "</div>");
    description.append("<div class='data-cell ys" + year + " hidden-opacity'>" + yearStats.mag6 + "</div>");
    description.append("<div class='data-cell ys" + year + " hidden-opacity'>" + yearStats.mag7 + "</div>");
    description.append("<div class='data-cell ys" + year + " hidden-opacity'>" + yearStats.mag8 + "</div>");
    description.append("<div class='data-cell last ys" + year + " hidden-opacity'>" + yearStats.mag9 + "</div>");

    var newStats = $(".ys" + year);
    opacityAnimationFast(newStats);

    barChartData.labels.push(year);
    barChartData.datasets[0].data.push(yearStats.mag6);
    barChartData.datasets[1].data.push(yearStats.mag7);
    barChartData.datasets[2].data.push(yearStats.mag8);
    barChartData.datasets[3].data.push(yearStats.mag9);
    myBar.update();
}

var yearCounter = 1900;
var currentVectorSource;
var currentFeatures = [];
var statistics = {};
var layerDictionary = {};

var fetchYear = (year) => {
    fetch('http://localhost:4000/geojson/quakes/' + year)
        .then(function (res) {
            console.log('Earthquakes for ' + year + ' loaded');
            return res.json();
        })
        .then(function (data) {
            statistics[year] = data[0];
            appendStatistics(year)
            currentFeatures = geojsonFormat.readFeatures(data[1]);
            currentVectorSource = initVectorSource();
            var quakeLayer = new VectorLayer({
                source: currentVectorSource,
                renderMode: 'vector',
                name: year,
                visible: true,
                simplifyFactor: 2,
                style: styleFunction
            });
            layerDictionary[year] = quakeLayer;
            map.addLayer(quakeLayer);
            var delta = year - 1900
            if (delta >= 5) {
                var target1 = layerDictionary[1900 + delta - 5];
                target1.setOpacity(0.5);
            }
            if (delta >= 10) {
                var target2 = layerDictionary[1900 + delta - 10];
                target2.setOpacity(0.2);
            }
            if (delta >= 15) {
                var key = 1900 + delta - 15;
                var removeTarget = layerDictionary[key];
                delete layerDictionary[key];
                delete statistics[key];
                map.removeLayer(removeTarget);
                $("#yb" + key).remove();
                $(".ys" + key).remove();
            }
        })
        .catch(err => console.error(err));
}

function draw() {
    if (currentFeatures.length > 0) {
        currentVectorSource.addFeature(currentFeatures[0]);
        currentFeatures.splice(0, 1);
    }
}

function refresh() {
    if (currentFeatures.length === 0) {
        if (yearCounter % 2019 === 0) {
            yearCounter = 1900
            for (let key in layerDictionary) {
                if (!layerDictionary.hasOwnProperty(key)) continue;
                map.removeLayer(layerDictionary[key]);
                delete layerDictionary[key];

                let selector = ".year-box";
                selector += yearCounter - 1;
                existing = $(selector);
                existing.remove();

                selector = "#header-data-row";
                existing = $(selector);
                existing.append("<div class='year-box hidden-opacity' id='init'><div class='year-info' id='init'>loading...</div>" + "</div>");
            }
            barChartData.labels = [];
            barChartData.datasets[0].data = [];
            barChartData.datasets[1].data = [];
            barChartData.datasets[2].data = [];
            barChartData.datasets[3].data = [];
            myBar.update();
            return;
        }

        fetchYear(yearCounter);

        //extend year indicators
        let existing = $("#init");

        if (yearCounter > 1900) {
            let selector = "#yb";
            selector += yearCounter - 1;
            existing = $(selector);
        }

        existing.after("<div class='year-box hidden-opacity' id='yb" + yearCounter + "'> <div class='year-info' id='yi" + yearCounter + "'></div>" + "</div>");
        existing.removeClass('highlight')
        let newBox = $("#yb" + yearCounter);
        newBox.addClass('highlight');
        opacityAnimationFast(newBox);

        if (yearCounter === 1900) {
            existing.remove();
        }

        let newYear = $("#yi" + yearCounter);
        fadeOutAnimation(newYear, yearCounter);
        opacityAnimationSlow(newYear);

        yearCounter++;
    }
}

var replaySpeed = 1;
var running = 0;

var initControls = () => {
    let playToggleButton = $("#play-toggle");
    playToggleButton.on('click', function (evt) {
        if (!running) {
            running = 1;
            $("#play-toggle").addClass('toggled');
            let selector = "#header-data-row";
            if (yearCounter === 1900) {
                let existing = $(selector);
                existing.append("<div class='year-box' id='init'><div class='year-info' id='init'>loading...</div>" + "</div>");
            }
        }
        else {
            running = 0;
            $("#play-toggle").removeClass('toggled');
        }
    });

    playToggleButton.hover(
        function () {
            $("#play-toggle").addClass('button-hover');
        },
        function () {
            $("#play-toggle").removeClass('button-hover');
        }
    );

    let playSpeedupButton = $("#play-speedup");
    playSpeedupButton.on('click', function (evt) {
        if (replaySpeed >= 1024) {
            replaySpeed = 1;
        }
        else {
            replaySpeed += replaySpeed;
        }
        $("#speed-indicator").text(replaySpeed + 'x');
    });

    playSpeedupButton.hover(
        function () {
            $("#play-speedup").addClass('button-hover');
        },
        function () {
            $("#play-speedup").removeClass('button-hover');
        }
    );

    let infoButton = $("#info-button");
    infoButton.on('click', function (evt) {
        if ($(".message-overlay").hasClass("hidden")) {
            $(".message-overlay").removeClass("hidden");
            $(".overlay-background").removeClass("collapsed");
            return;
        }
        $(".message-overlay").addClass("hidden");
    });

    infoButton.hover(
        function () {
            $("#play-speedup").addClass('button-hover');
        },
        function () {
            $("#play-speedup").removeClass('button-hover');
        }
    );

    var messageDialogHandler = function (evt) {
        if (!$(".message-overlay").hasClass("hidden")) {
            $(".message-overlay").addClass("hidden");
            $(".overlay-background").addClass("collapsed");
            return;
        }
    };

    let infoMessage = $(".message-overlay");    
    infoMessage.on('click', (evt) => messageDialogHandler(evt));

    let infoBackground = $(".overlay-background");    
    infoBackground.on('click', (evt) => messageDialogHandler(evt));
}

initControls();

// periodically check whether new data should be loaded
var refreshInterval = () => {
    if (running === 1) {
        refresh();
    }
    setTimeout(refreshInterval, 4096 / replaySpeed);
}

refreshInterval();

// draw earthquakes depending on speed  
var replayYear = () => {
    if (running === 1) {
        draw();
    }
    setTimeout(replayYear, 1024 / replaySpeed);
}

replayYear();

