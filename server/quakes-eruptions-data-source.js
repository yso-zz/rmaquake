const volcanoFilePath = './server/data/volerup.csv';
const quakesFilePath = './server/data/earthquake.usgs.gov.csv';
var csv = require('csvtojson');
var fs = require('fs')

var quakeJson;
var erupJson;
var geojsonQuakeCache = {};
var geojsonEruptionCache = {};
var statisticsQuakeCache = {};

dataSource = {

    getQuakes: () => {
        return quakeJson;
    },

    getEruptions: () => {
        return erupJson;
    },

    toGeoJsonQuakeRecords: (data) => {
        let features = [];
        let i = 0;
        data.forEach(e => {
            if (e.place && parseFloat(e.mag) >= 6) {
                let date = new Date(Date.parse(e.time));
                if (date) {
                    let obj = {
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
        features.sort((a, b) => { sortFeaturesByDate(a, b) });
        return features;
    },

    toGeoJsonEruptionRecords: (data) => {
        let features = [];
        let i = 0;
        data.forEach(e => {
            if (e.Year) {
                let obj = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        'coordinates': [parseFloat(e.Longitude), parseFloat(e.Latitude)]
                    },
                    properties: {
                        elevation: e.Elevation,
                        name: e.Name,
                        location: e.Location,
                        country: e.Country,
                        type: e.Type,
                        deaths: e.TOTAL_DEATHS,
                        year: parseInt(e.Year),
                        month: parseInt(e.Month),
                        day: parseInt(e.Day)
                    }
                };
                features[i] = obj;
                i++;
            }
        });
        features.sort((a, b) => { sortFeaturesByDate(a, b) });
        return features;
    },

    toGeoJsonQuakesRaw: (data) => {
        let features = dataSource.toGeoJsonQuakeRecords(data);
        let geojsonObject = {
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
        let features = dataSource.toGeoJsonEruptionRecords(data);
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
        let geojsonObject = {
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

        result = extractQuakeDataForYear(data, year);

        if (result) {
            return [statisticsQuakeCache[year], dataSource.toGeoJson(result)]; // cache lookup successful
        }

        return null; // there was no data for that year in the first place
    },

    getGeoJsonQuakesAndEruptionsPerYear: (qData, eData, year) => {
        let qResult = geojsonQuakeCache[year];
        let eResult = geojsonEruptionCache[year];
        if (qResult && eResult) {
            return [statisticsQuakeCache[year], dataSource.toGeoJson(qResult), dataSource.toGeoJson(eResult)]; // cache lookup successful            
        }

        qResult = extractQuakeDataForYear(qData, year);
        eResult = extractEruptionDataForYear(eData, year);

        if (qResult || eResult) {
            return [statisticsQuakeCache[year], dataSource.toGeoJson(qResult), dataSource.toGeoJson(eResult)]; // cache lookup successful
        }

        return null; // there was no data for that year in the first place
    },

    loadAllQuakes: async () => {
        let jsonArray = await csv({ delimiter: ',' }).fromFile(quakesFilePath);
        return jsonArray;
    },

    saveAllData: async function (jsonArray, file) {
        let jsonString = JSON.stringify(jsonArray).replace(/\\u0000/gi, '');
        jsonString = jsonString.replace('{', '{\n');
        jsonString = jsonString.replace(',', ',\n');

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
        let jsonArray = await csv({ delimiter: ';' }).fromFile(volcanoFilePath);
        return jsonArray;
    },

    loadAllData: async function () {
        quakeJson = await dataSource.loadAllQuakes();
        erupJson = await dataSource.loadAllEruptions();
    },

    initialize: function () {
        let dataPromise = new Promise(function (resolve, reject) {
            resolve(dataSource.loadAllData());
        });
        return dataPromise;
    }
};

module.exports = dataSource;

var extractQuakeDataForYear = (qData, year) => {
    let qGeoJsonRecords = dataSource.toGeoJsonQuakeRecords(qData);
    let yearSet = [];
    let sumMag6 = 0;
    let sumMag7 = 0;
    let sumMag8 = 0;
    let sumMag9 = 0;
    let i = 0;
    qGeoJsonRecords.forEach(g => {
        if (g.properties['year'] === year) {
            yearSet[i] = g;
            if (g.properties['magnitude'] < 7.0) {
                sumMag6++;
            }
            else if (g.properties['magnitude'] < 8.0) {
                sumMag7++;
            }
            else if (g.properties['magnitude'] < 9.0) {
                sumMag8++;
            }
            else if (g.properties['magnitude'] >= 9.0) {
                sumMag9++;
            }
            i++;
        }
    });
    geojsonQuakeCache[year] = yearSet;
    statisticsQuakeCache[year] = {
        'year': year,
        'mag6': sumMag6,
        'mag7': sumMag7,
        'mag8': sumMag8,
        'mag9': sumMag9
    };
    return yearSet;
};

var extractEruptionDataForYear = (eData, year) => {
    let eGeoJsonRecords = dataSource.toGeoJsonEruptionRecords(eData);
    let yearSet = [];
    let i = 0;
    eGeoJsonRecords.forEach(g => {
        if (g.properties['year'] === year) {
            yearSet[i] = g;
            i++;
        }
    });

    geojsonEruptionCache[year] = yearSet;
    return yearSet;
};

var sortFeaturesByDate = (a, b) => {
    let yearDiff = b.properties.year - a.properties.year;
    let monthDiff = b.properties.month - a.properties.month;
    let dayDiff = b.properties.day - a.properties.day;
    if (yearDiff !== 0) {
        return yearDiff;
    }
    if (monthDiff !== 0) {
        return monthDiff;
    }
    return dayDiff;
};