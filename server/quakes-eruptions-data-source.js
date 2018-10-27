const volcanoFilePath = './server/data/volerup.csv';
const quakesFilePath = './server/data/earthquake.usgs.gov.csv';
var csv = require('csvtojson');
var fs = require('fs')

var quakeJson;
var erupJson;
var initialized = false;


dataSource = {

    getQuakes: function () {
        return quakeJson;
    },

    getEruptions: function () {
        return quakeJson;
    },

    toGeoJson: function (data) {
        var features = [];
        var i = 0;
        data.forEach(e => {
            if (e.place && parseFloat(e.mag) >= 6) {
                var obj = {
                    type: 'Feature',
                    //name: e.place,
                    //magnitude: e.mag,
                    geometry: {
                        type: 'Point',
                        'coordinates': [parseFloat(e.longitude), parseFloat(e.latitude)]
                    },
                    properties: {
                        name: e.place,
                        magnitude: e.mag
                      }
                };                
                features[i] = obj;
                i++;
            }
        });
        var geojsonObject = {
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: {
                    name: 'EPSG:4326'
                }
            },
            features: features
        };        
        return geojsonObject;
    },

    loadAllQuakes: async function () {
        var jsonArray = await csv({ delimiter: ',' }).fromFile(quakesFilePath);
        return jsonArray;
    },

    saveAllData: async function (jsonArray, file) {
        var jsonString = JSON.stringify(jsonArray).replace(/\\u0000/gi, '');
        var jsonString = JSON.stringify(jsonArray).replace('{', '{\n');
        var jsonString = JSON.stringify(jsonArray).replace(',', ',\n');

        fs.writeFile('file', jsonString, function (err, data) {
            if (err) {
                return console.error(err);
            } else {
                console.log(file + ' written successfully');
            }
        });

        return jsonArray;
    },

    loadAllEruptions: async function () {
        var jsonArray = await csv({ delimiter: ';' }).fromFile(volcanoFilePath);
        return jsonArray;
    },

    loadAllData: async function () {
        quakeJson = await dataSource.loadAllQuakes();
        erupJson = await dataSource.loadAllEruptions();
    },

    initialize: function () {
        var dataPromise = new Promise(function (resolve, reject) {
            resolve(dataSource.loadAllData());
        });
        return dataPromise;
    }
};

module.exports = dataSource;