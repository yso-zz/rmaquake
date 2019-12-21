import 'bootstrap/dist/js/bootstrap.bundle.js'
import $ from 'jquery';


import 'ol/ol.css';
import './definitions.js'
import Map from 'ol/map';
import View from 'ol/view';
import Tile from 'ol/layer/tile';
import VectorLayer from 'ol/layer/vector'
import VectorSource from 'ol/source/Vector.js';
import Stamen from 'ol/source/Stamen.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { easeOut, linear } from 'ol/easing.js';
import { unByKey } from 'ol/Observable.js';
import ScaleLine from 'ol/control/ScaleLine';
import ZoomSlider from 'ol/control/ZoomSlider';
import { Circle as CircleStyle, Text as TextStyle, Icon as IconStyle, Fill, Stroke, Style } from 'ol/style.js';
import OSM from 'ol/source/osm';
import { fromLonLat } from 'ol/proj';
import Chart from 'chart.js';
import { asArray } from 'ol/color';

const volcanoIcon = require('../../img/volcano3.svg');
const volcanoSound = require('../../sound/yasur-small-eruption-ultrashort2.mp3');

// global variables and helper functions
var replaySpeed = 1;
var running = 0;
var showEruptions = false;
var showEarthQuakes = true;

var pos = function () {
    return fromLonLat([7.906754, 47.316216]);
};

// bar chart data template with empty data arrays to filled later
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

// loads the bar chart with the empty data template
var loadchart = function () {
    var ctx = document.getElementById('overall-stats').getContext('2d');
    window.myBar = new Chart(ctx, {
        type: 'bar',
        data: barChartData,
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Earthquake History'
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

var initVolcanoVectorSource = () => {
    var source = new VectorSource({
        url: 'http://localhost:4000/geojson/eruptions/all',
        featureProjection: 'EPSG:3857',
        format: geojsonFormat
    });
    source.forEachFeature(element => {
        element.setStyle(volcanoStyle);
    });
    return source;
}

var initEruptionVectorSource = () => {
    var source = new VectorSource({
        featureProjection: 'EPSG:3857',
        format: geojsonFormat
    });
    source.on('addfeature', function (e) {
        explode(e);
    });
    return source;
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

var osmLayer = new Tile({
    source: new OSM(),
    zIndex: 0
})

var stamenTonerLayer = new Tile({
    source: new Stamen({
        layer: 'toner'
    }),
    zIndex: 0
})

var stamenTerrainLayer = new Tile({
    source: new Stamen({
        layer: 'terrain'
    }),
    zIndex: 0
})

var stamenTerrainLabelsLayer = new Tile({
    source: new Stamen({
        layer: 'terrain-labels'
    }),
    zIndex: 1
})

var selectedLayer = osmLayer

const map = new Map({
    renderer: 'webgl',
    target: 'map',
    layers: [
        selectedLayer
    ],
    view: new View({
        projection: 'EPSG:3857',
        center: pos(),
        zoom: 2
    })
});

//Create the eruption sound
var soundFile = document.createElement("audio");
soundFile.preload = "auto";
var src = document.createElement("source");
src.src = volcanoSound;
soundFile.appendChild(src);
soundFile.load();
soundFile.volume = 0.000000;

//Plays the boom
function playBoom() {
    //Set the current time for the audio file to the beginning
    soundFile.currentTime = 0.01;
    soundFile.volume = 0.8;
    setTimeout(function () { soundFile.play(); }, 1);
}

// animation function for the map layer displaying the red rings extending from the center of an earthquake
var duration = 3000;
function flash(feature) {
    var start = new Date().getTime();
    let listenerKey = map.on('postcompose', animate);

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


// Show an explosion for a feature
function explode(e) {
    playBoom();

    var start = new Date().getTime();
    var anim = new Explode(
        {
            coordinates: e.feature.getGeometry().getCoordinates(),
            radius: 40,
            duration: 200000,
            easing: easeOut,
            start: start
        });

    let listenerKey = map.on('postcompose', animate);

    function animate(e) {
        let elapsed = (e.frameState.time - start) / 6000;
        var currentEasing = anim.easing(elapsed);
        if (currentEasing) {
            e.context.save();
            let ratio = e.frameState.pixelRatio;
            let m = e.frameState.coordinateToPixelTransform;
            let dx = m[0] * anim.coordinates[0] + m[1] * anim.coordinates[1] + m[4];
            let dy = m[2] * anim.coordinates[0] + m[3] * anim.coordinates[1] + m[5];

            e.context.globalCompositeOperation = "lighter";
            e.context.fillStyle = anim.gradient;
            e.context.scale(ratio, ratio);

            let ds, r;
            for (let i = 0, p; p = anim.particles[i]; i++) {
                ds = (currentEasing - p.tmin) / p.dt;
                if (ds > 0 && ds <= 1) {
                    e.context.save();
                    e.context.translate(dx + p.x, dy + p.y);
                    r = ds * p.radius / this.radius;
                    e.context.scale(r, r);
                    e.context.globalAlpha = 1 - ds;
                    e.context.fillRect(-p.radius, -p.radius, 2 * p.radius, 2 * p.radius);
                    e.context.restore();
                }
            }
            e.context.restore();
            map.render();
        }
        if (elapsed > anim.duration) {
            unByKey(listenerKey);
            return;
        }
    }
}

function Explode(options) {
    options = options || {};

    this.radius = options.radius || 500;
    this.duration = options.duration || 10000;
    this.easing = options.easing;
    this.coordinates = options.coordinates;

    // Create gradient
    var c = document.createElement('canvas');
    c.width = c.height = 10;
    var ctx = c.getContext("2d");
    this.gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);

    function mask(value, mask) {
        return ((value * mask / 255) | 0);
    }

    var exColor = asArray(options.color || "#431")
    var r = exColor[0], g = exColor[1], b = exColor[2], a = exColor[3];

    this.gradient.addColorStop(0, 'rgba(' + [mask(r, 255), mask(g, 255), mask(b, 255), a] + ')');
    this.gradient.addColorStop(0.3, 'rgba(' + [mask(r, 254), mask(g, 239), mask(b, 29), a] + ')');
    this.gradient.addColorStop(0.4, 'rgba(' + [mask(r, 254), mask(g, 88), mask(b, 29), a] + ')');
    this.gradient.addColorStop(0.6, 'rgba(' + [mask(r, 239), mask(g, 27), mask(b, 51), a * .05] + ')');
    this.gradient.addColorStop(0.88, 'rgba(' + [mask(r, 153), mask(g, 10), mask(b, 27), a * .05] + ')');
    this.gradient.addColorStop(0.92, 'rgba(' + [mask(r, 254), mask(g, 39), mask(b, 17), a * .1] + ')');
    this.gradient.addColorStop(0.98, 'rgba(' + [mask(r, 254), mask(g, 254), mask(b, 183), a * .2] + ')');
    this.gradient.addColorStop(1, 'rgba(' + [mask(r, 254), mask(g, 39), mask(b, 17), 0] + ')');

    var dispersion = options.dispersion || (this.radius / 3);
    this.particles = [{ tmin: 0, dt: 1, radius: this.radius, x: 0, y: 0 }];
    var length = 16;
    for (var i = 0; i < length; i++) {
        this.particles.push(
            {
                tmin: Math.random() * 0.6,
                dt: 0.2 + Math.random() * 0.3,
                radius: this.radius * (0.3 + Math.random() * 5),
                x: dispersion * (Math.random() - 0.5),
                y: dispersion * (Math.random() * 1.4 - 0.9)
            });
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

// display additional information when hovering over an earthquake
var displayFeatureInfo = function (pixel) {
    let heightOffset = 155;
    info.css({
        left: pixel[0] + 'px',
        top: (pixel[1] + heightOffset) + 'px'
    });
    var feature = map.forEachFeatureAtPixel(pixel, function (feature) {
        return feature;
    });

    if (feature) {
        if (feature.get('magnitude')) {
            info.tooltip('hide')
                .attr('data-original-title', "Earthquake: "                 
                + feature.get('year') + ", "
                + feature.get('name') 
                + ', magnitude: ' 
                + feature.get('magnitude'))
                .tooltip('show');
        } else {
            info.tooltip('hide')
                .attr('data-original-title', "Volcano: " + feature.get('name') + ', ' + feature.get('country'))
                .tooltip('show');
        }
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

// style definitions with caching for the filled circles on the map 
var styleCacheQuake = {};
var styleCacheQuakeText = {};
var styleFunction = function (feature) {
    var magnitude = parseFloat(feature.get('magnitude'));
    if (magnitude < 5) {
        console.log(feature.get('name'));
        console.log(magnitude);
    }
    var radius = 5 + 10 * (magnitude - 6) * (magnitude - 6);
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

    if (magnitude <= 7.0) {
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

// style for displaying all the volcanoes active during the holocene era
var volcanoStyle = new Style({
    image: new IconStyle({
        src: volcanoIcon
    })
});

// geo mapping is all about projections and correctly applying them, or the map won't show anything
const geojsonFormat = new GeoJSON({
    defaultDataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:3857',
    extractStyles: true
});

// variables to store data we load from the backend
var yearCounter = 1900;
var initialOffset = yearCounter;
var currentQuakeVectorSource;
var currentQuakeFeatures = [];
var volcanoVectorSource = initVolcanoVectorSource();
var currentEruptionFeatures = [];
var statistics = {};
var layerDictionary = {};

// extends the statistics table and bar chart with new data for a year 
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

// asynchronously loads data for a single year from the backend
var fetchYear = (year) => {
    fetch('http://localhost:4000/geojson/quake-eruptions/' + year)
        .then(function (res) {
            console.log('Earthquakes for ' + year + ' loaded');
            return res.json();
        })
        .then(function (data) {
            statistics[year] = data[0];
            appendStatistics(year)
            currentQuakeFeatures = geojsonFormat.readFeatures(data[1]);
            currentEruptionFeatures = geojsonFormat.readFeatures(data[2]);
            addEarthquakeLayer(year);
        })
        .catch(err => console.error(err));
}

var addEarthquakeLayer = (year) => {
    currentQuakeVectorSource = initVectorSource();
    var quakeLayer = new VectorLayer({
        source: currentQuakeVectorSource,
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
        if (target1) target1.setOpacity(0.5);
    }
    if (delta >= 10) {
        var target2 = layerDictionary[1900 + delta - 10];
        if (target2) target2.setOpacity(0.2);
    }
    if (delta >= 15) {
        var key = 1900 + delta - 15;
        var removeTarget = layerDictionary[key];
        if (removeTarget) {
            delete layerDictionary[key];
            delete statistics[key];
            map.removeLayer(removeTarget);
            $("#yb" + key).remove();
            $(".ys" + key).remove();
        }
    }
}

var volcanoLayer = new VectorLayer({
    source: volcanoVectorSource,
    renderMode: 'image',
    name: 'volcanos',
    visible: true,
    simplifyFactor: 2,
    zIndex: 200,
    opacity: 0.5,
    style: volcanoStyle
});

map.addLayer(volcanoLayer);

var eruptionsVectorSource = initEruptionVectorSource();
var eruptionLayer = new VectorLayer({
    source: eruptionsVectorSource,
    renderMode: 'vector',
    name: 'eruptions',
    visible: true,
    simplifyFactor: 2,
    zIndex: 500,
    style: new Style({
        image: new CircleStyle({
            radius: 4,
            stroke: new Stroke({
                color: 'rgba(55, 20, 20, ' + 0.5 + ')',
                width: 2.25
            }),
            fill: new Fill({
                color: 'rgba(255, 80, 55, ' + 1 + ')',
            })
        })
    })
});

map.addLayer(eruptionLayer);

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

// adds a single earthquake feature and optional eruption to the layers on the map
function draw() {
    if (currentQuakeFeatures.length > 0) {
        let currentQuake = currentQuakeFeatures[0];
        if (currentEruptionFeatures.length > 0) {
            let nextEruption = currentEruptionFeatures[0];
            if (currentQuake.get('month') > nextEruption.get('month') ||
                (currentQuake.get('month') == nextEruption.get('month') &&
                 currentQuake.get('day') > nextEruption.get('day'))
                 ) {
                if (showEruptions) {
                    //$("#yb-month").text(nextEruption.get('month'));
                    //$("#yb-day").text(nextEruption.get('day') );
                    eruptionsVectorSource.addFeature(currentEruptionFeatures[0]);
                }
                currentEruptionFeatures.splice(0, 1);
            } else {
                if (showEarthQuakes) {
                    //$("#yb-month").text(currentQuake.get('month'));
                    //$("#yb-day").text(currentQuake.get('day') );
                    currentQuakeVectorSource.addFeature(currentQuake);
                }
                currentQuakeFeatures.splice(0, 1);
            }
        } else {
            if (showEarthQuakes) {
                //$("#yb-month").text(currentQuake.get('month'));
                //$("#yb-day").text(currentQuake.get('day') );
                currentQuakeVectorSource.addFeature(currentQuake);
            }
            currentQuakeFeatures.splice(0, 1);
        }
    } else if (currentEruptionFeatures.length > 0) {
        if (showEruptions) {
            //let nextEruption = currentEruptionFeatures[0];
            //$("#yb-month").text(nextEruption.get('month'));
            //$("#yb-day").text(nextEruption.get('day') );
            eruptionsVectorSource.addFeature(currentEruptionFeatures[0]);
        }
        currentEruptionFeatures.splice(0, 1);
    }
}


function clearYearIndicators() {
    let yearBoxes = $(".year-box");
    yearBoxes.remove();
}

function clearBarChart() {
    barChartData.labels = [];
    barChartData.datasets[0].data = [];
    barChartData.datasets[1].data = [];
    barChartData.datasets[2].data = [];
    barChartData.datasets[3].data = [];
    myBar.update();
}

function clearDataCells() {
    let dataCells = $(".data-cell");
    dataCells.remove();
}

// removes all data and several indicators from the UI, so that the replay can start from scratch
var cleanUpAll = () => {
    // clear the map
    for (let key in layerDictionary) {
        if (!layerDictionary.hasOwnProperty(key)) continue;
        map.removeLayer(layerDictionary[key]);
        delete layerDictionary[key];
    }

    // clear the year indicators
    clearYearIndicators();

    // clear the data cells in the table display
    clearDataCells();

    // clear barchart
    clearBarChart();
    
    yearCounter = 1900
    return;
}

// adds new indicators for the years visible on the map and in the table
var extendYearIndicators = () => {
    //extend year indicators
    let existingYearBox = $("#init");
    // $("#yb-month").remove();
    // $("#yb-day").remove();

    if (yearCounter !== initialOffset) {
        let selector = ".year-box";
        existingYearBox = $(selector);
    }
    
    existingYearBox.removeClass('highlight')
    $('#header-data-row').append("<div class='year-box hidden-opacity' id='yb" + yearCounter + "'> <div class='year-info' id='yi" + yearCounter + "'></div>" + "</div>");
    let newBox = $("#yb" + yearCounter);
    newBox.addClass('highlight');
    opacityAnimationFast(newBox);

    // newBox.after("<div class='year-box hidden-opacity' id='yb-month'> <div class='year-info' id='yi-month'>-</div>" + "</div>");
    // let newMonthBox = $("#yb-month");
    // newMonthBox.addClass('highlight');
    // opacityAnimationFast(newMonthBox);

    // newBox.after("<div class='year-box hidden-opacity' id='yb-day'> <div class='year-info' id='yi-day'>-</div>" + "</div>");
    // let newDayBox = $("#yb-day");
    // newDayBox.addClass('highlight');
    // opacityAnimationFast(newDayBox);

    if (yearCounter === initialOffset) {
        existingYearBox.remove();
    }

    let newYear = $("#yi" + yearCounter);
    fadeOutAnimation(newYear, yearCounter);
    opacityAnimationSlow(newYear);
}




// refreshes the application with new data, unless a cleanup is required
function refresh() {
    if (currentQuakeFeatures.length === 0) {
        fetchYear(yearCounter);
        extendYearIndicators();
        yearCounter++;
    }
}

// periodically check whether new data should be loaded
var refreshInterval = () => {
    if (running === 1) {
        refresh();
    }
    if (yearCounter % 2019 === 0) {
        running = 0;
        $("#play-toggle").removeClass('toggled');
        return;
    }
    setTimeout(refreshInterval, 1024 / replaySpeed);
}

refreshInterval();

// draw earthquakes depending on speed  
var replayYear = () => {
    if (running === 1 || yearCounter === 2019) {
        draw();
    }
    setTimeout(replayYear, 4096 / replaySpeed);
}

replayYear();

// initializes the various interactive controls
var initControls = () => {
    let layerSelector = $("#layer-selector");
    layerSelector.change(
        (evt) => {
            let newLayer;
            switch (evt.currentTarget.value) {
                case 'OSM':
                    newLayer = osmLayer
                    break;
                case 'Toner':
                    newLayer = stamenTonerLayer
                    break;
                case 'Terrain':
                    newLayer = stamenTerrainLayer
                    break;
                default:
                    newLayer = osmLayer
                    break;
            }

            if (newLayer === selectedLayer) {
                return;
            }

            map.removeLayer(selectedLayer);
            map.addLayer(newLayer);
            selectedLayer = newLayer;
        }
    )

    let toggleEarthquakesCheckBox = $('#toggle-earthquakes');
    toggleEarthquakesCheckBox.change(function () {
        if ($(this).is(':checked')) {
            showEarthQuakes = true;
        } else {
            showEarthQuakes = false;
        }
    });

    let toggleEruptionsCheckBox = $('#toggle-eruptions');
    toggleEruptionsCheckBox.change(function () {
        if ($(this).is(':checked')) {
            showEruptions = true;
        } else {
            showEruptions = false;
        }
    });

    let playToggleButton = $("#play-toggle");
    playToggleButton.on('click', function (evt) {
        if (!running) {
            running = 1;
            $("#play-toggle").addClass('toggled');
            
            if (yearCounter >= 2019) {
                yearCounter = initialOffset = 1900
                cleanUpAll();
                setTimeout(refreshInterval, 1024 / replaySpeed);
            }
            
            let selector = "#header-data-row";
            if (yearCounter === initialOffset) {
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
        replaySpeed += replaySpeed;

        if (replaySpeed > 256) {
            replaySpeed = 1;
            return;
        }

        if (replaySpeed == 256) {
            $("#speed-indicator").text("max");
            return;
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

    let playSkipButton = $("#play-skip-forward");
    playSkipButton.on('click', function (evt) {
        if (yearCounter === initialOffset) {
            initialOffset += 20;
        }
        clearDataCells();
        yearCounter += 20;
    });

    playSkipButton.hover(
        function () {
            $("#play-skip-forward").addClass('button-hover');
        },
        function () {
            $("#play-skip-forward").removeClass('button-hover');
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


