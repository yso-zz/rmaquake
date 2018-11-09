const volcanoFilePath = './server/data/volerup.csv';
const quakesFilePath = './server/data/earthquake.usgs.gov.csv';
var csv = require('csvtojson');
var fs = require('fs')

var quakeJson;
var erupJson;
var geojsonQuakeCache = {};
var statisticsQuakeCache = {};

dataSource = {

    getQuakes: () => {
        return quakeJson;
    },

    getEruptions:  () =>  {
        return erupJson;
    },

    toGeoJsonQuakeRecords: (data) => {
        var features = [];        
        var i = 0;
        data.forEach(e => {
            if (e.place && parseFloat(e.mag) >= 6) {
                var date = new Date (Date.parse(e.time));
                if (date){
                    var obj = {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            'coordinates': [parseFloat(e.longitude), parseFloat(e.latitude)]
                        },
                        properties: {
                            name: e.place,
                            magnitude: e.mag,
                            year: date.getFullYear(),
                            month: date.getMonth(),
                            day: date.getDay()                       
                        }
                    };                
                    features[i] = obj;
                    i++;
                }
            }
        });
        features.sort((a,b,) => {            
            var monthDiff = b.properties.month - a.properties.month;
            var dayDiff = b.properties.day - a.properties.day;
            if (monthDiff === 0){
                return dayDiff;
            }
            return monthDiff;
        });
        return features;
    },

    toGeoJsonQuakesRaw: (data) => {
        var features = dataSource.toGeoJsonQuakeRecords(data);
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

    toGeoJsonEruptionsRaw: (data) => {
        var features = dataSource.toGeoJsonQuakeRecords(data);
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

    toGeoJson: (data) => {
        var geojsonObject = {
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: {
                    name: 'EPSG:4326'
                }
            },
            features: data
        };        
        return geojsonObject;
    },

    getGeoJsonQuakesPerYear: (data, year) => {
        var result = geojsonQuakeCache[year];
        if (result) {         
            return [statisticsQuakeCache[year], dataSource.toGeoJson(result)]; // cache lookup successful            
        }

        let geojsonRecords = dataSource.toGeoJsonQuakeRecords(data);
        let yearSet = [];
        var sumMag6 = 0;
        var sumMag7 = 0;
        var sumMag8 = 0;
        var sumMag9 = 0;
        var i = 0;
        geojsonRecords.forEach(g => {
            if (g.properties['year'] === year){
                yearSet[i] = g;
                if (g.properties['magnitude'] < 7.0){
                    sumMag6++;
                }
                else if (g.properties['magnitude'] < 8.0){
                    sumMag7++;
                }
                else if (g.properties['magnitude'] < 9.0){
                    sumMag8++;
                }
                else if (g.properties['magnitude'] >= 9.0){
                    sumMag9++;
                }
                i++;
            }
        });
        geojsonQuakeCache[year] = yearSet;
        statisticsQuakeCache[year] = {
            'year' : year,
            'mag6' : sumMag6,
            'mag7' : sumMag7,
            'mag8' : sumMag8,
            'mag9' : sumMag9
        };
        result = yearSet;
        if (result) {         
            return [statisticsQuakeCache[year], dataSource.toGeoJson(result)]; // cache lookup successful
        }

        return null; // there was no data for that year in the first place
    },

    loadAllQuakes: async () => {
        var jsonArray = await csv({ delimiter: ',' }).fromFile(quakesFilePath);
        return jsonArray;
    },

    saveAllData: async function (jsonArray, file) {
        var jsonString = JSON.stringify(jsonArray).replace(/\\u0000/gi, '');
        var jsonString = jsonString.replace('{', '{\n');
        var jsonString = jsonString.replace(',', ',\n');

        fs.writeFile(file, jsonString, function (err, data) {
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