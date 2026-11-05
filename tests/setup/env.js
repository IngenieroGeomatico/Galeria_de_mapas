// Mock mínimo de entorno navegador para cargar los IIFE de ext/ en Node.
'use strict';

const g = global;

if (!g.window) g.window = g;
if (!g.document) {
  g.document = {
    addEventListener: function () {},
    createElement: function () { return { style: {}, appendChild: function () {} }; },
    getElementsByTagName: function () { return []; },
    head: { appendChild: function () {} },
    baseURI: 'http://localhost:8765/'
  };
}
if (!g.IDEE) g.IDEE = { layer: {}, plugin: {} };
if (!g.M) g.M = g.IDEE;
g.IDEE.layer.Alphanumeric = g.IDEE.layer.Alphanumeric || function (o) { this._records = (o && (o.records || o.data)) || []; this._fields = (o && o.fields) || []; this.name = (o && o.name) || 'x'; this.legend = (o && o.legend) || this.name; this.getRecords = function () { return this._records; }; this.getFieldNames = function () { return this._fields.map(function (f) { return (typeof f === 'string') ? f : f.name; }); }; };
g.IDEE.layer.Alphanumeric.fromCSV = function (t, o) { return new g.IDEE.layer.Alphanumeric(Object.assign({ records: [] }, o)); };
g.IDEE.layer.Alphanumeric.fromJSON = function (d, o) { return new g.IDEE.layer.Alphanumeric(Object.assign({ records: Array.isArray(d) ? d : (d && (d.records || d.data || d.rows)) || [] }, o)); };
g.IDEE.layer.Alphanumeric.fromINE = function () { return new g.IDEE.layer.Alphanumeric({}); };
g.IDEE.layer.Alphanumeric.fromMadrid = function () { return new g.IDEE.layer.Alphanumeric({}); };
g.IDEE.layer.GeoJSON = function () {};
g.IDEE.layer.Vector = function () {};
g.IDEE.utils = { reproject: function (p) { return p; } };

if (typeof g.fetch === 'undefined') {
  g.fetch = async function () { return { ok: true, json: async function () { return []; }, text: async function () { return ''; } }; };
}

module.exports = g;
