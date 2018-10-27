import $ from 'jquery';
import 'bootstrap/dist/js/bootstrap.bundle.js'

import 'ol/ol.css';
import ol from 'ol';
import Feature from 'ol/Feature.js';
import Map from 'ol/map';
import View from 'ol/view';
import Tile from 'ol/layer/tile';
import VectorLayer from 'ol/layer/vector'
import VectorSource from 'ol/source/Vector.js';
import StamenSource from 'ol/source/Stamen';
import GeoJSON from 'ol/format/GeoJSON.js';
import Point from 'ol/geom/Point';
import ScaleLine from 'ol/control/ScaleLine';
import ZoomSlider from 'ol/control/ZoomSlider';
import { Circle as CircleStyle, Text as TextStyle, Fill, Stroke, Style } from 'ol/style.js';
import OSM from 'ol/source/osm';
import { fromLonLat } from 'ol/proj';

var styleCache = {};
var styleFunction = function (feature) {
    var magnitude = parseFloat(feature.get('magnitude'));
    if (magnitude < 5){
        console.log(feature.get('name'));
        console.log(magnitude);
    }
    var radius = 6 + 20 * (magnitude-6);
    var style = styleCache[radius];
    if (!style) {
        style = new Style({
            image: new CircleStyle({
                radius: radius,
                fill: new Fill({
                    color: 'rgba(255, 153, 0, 0.4)'
                }),
                stroke: new Stroke({
                    color: 'rgba(255, 204, 0, 0.2)',
                    width: 1
                })
            })
        });        
        styleCache[radius] = style;
    }

    var cache = {};
    var key = 'text' + feature.get('name') + feature.get('magnitude');
      if (!cache[key]) {
        cache[key] = new Style({
          text: new TextStyle({
            font: '10px sans-serif',
            text: feature.get('magnitude'),
            textBaseline: 'alphabetic',
            offsetY: 4,
            fill: new Fill({
              color: 'white'
            })
          })
        });
      }      
    return [style, cache[key]];
};

// fetch('http://localhost:4000/geojson/quakes/')    
//     .then(function (res) {
//         console.log('Earthquakes loaded');
//         return res.json();
//     })
//     .then(function (data) {
//         loadMap(data);
//     })
//     .catch(err => console.error(err));    

var loadMap = function (data) {

    const geojsonFormat = new GeoJSON({
        defaultDataProjection :'EPSG:4326',
        extractStyles: true
    });

    var image = new CircleStyle({
        radius: 20,
        fill: new Fill({ color: 'rgba(255, 153, 0, 0.4)' }),
        stroke: new Stroke({ color: 'red', width: 1 })
    });

    var pStyle = new Style({
        image: image
    });

    var vectorSource = new VectorSource({
        featureProjection: 'EPSG:3857',
        url: 'http://localhost:4000/geojson/quakes/',
        format: geojsonFormat
    });

    //vectorSource.addFeature(new Feature(new Point(fromLonLat([7.906754, 47.316216]))));

    var vectorLayer = new VectorLayer({
        source: vectorSource,
        renderBuffer: 1000,
        renderMode: 'vector',
        name: 'quakes',
        visible: true,
        style: styleFunction
    });

    function refresh() {
        vectorSource.refresh();
        console.log(' refresh');
    }

    //setInterval(function () { refresh(); }, 5000);

    var pos = function () {
        return fromLonLat([7.906754, 47.316216]);
    };

    var raster = new Tile({
        source: new StamenSource({
            layer: 'terrain'
        })
    });

    //raster.setZIndex(5);
    //vectorLayer.setZIndex(10);

    const map = new Map({
        target: 'map',
        layers: [
            //raster,
            new Tile({
                 source: new OSM()
             }),
                        
            vectorLayer            
        ],
        view: new View({
            projection: 'EPSG:3857',
            center: pos(),
            zoom: 2
        })
    });

    var scaleLineControl = new ScaleLine({
        units:'metric',
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
                .tooltip('fixTitle')
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

    map.on('click', function (evt) {
        displayFeatureInfo(evt.pixel);
    });
};

loadMap();


//  var geojsonObject; 

//   var vectorSource = new VectorSource({
//     features: (new GeoJSON()).readFeatures(geojsonObject)
//   });

//   vectorSource.addFeature(new Feature(new Circle([5e6, 7e6], 1e6)));

//   var vectorLayer = new VectorLayer({
//     source: vectorSource,
//     style: styleFunction
//   });


