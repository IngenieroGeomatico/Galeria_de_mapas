// Mock mínimo de entorno navegador para cargar los IIFE de ext/ en Node.
'use strict';

const g = global;

if (!g.window) g.window = g;
if (!g.document) {
  g.document = {
    addEventListener: function () {},
    createElement: function (tag) {
      return {
        tagName: tag,
        style: {},
        classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} },
        appendChild: function (c) { this._children = this._children || []; this._children.push(c); return c; },
        setAttribute: function () {},
        getAttribute: function () { return null; },
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        addEventListener: function () {}
      };
    },
    createElementNS: function (ns, tag) {
      return {
        tagName: tag,
        style: {},
        classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} },
        appendChild: function (c) { this._children = this._children || []; this._children.push(c); return c; },
        setAttribute: function () {},
        getAttribute: function () { return null; },
        addEventListener: function () {}
      };
    },
    getElementsByTagName: function () { return []; },
    head: { appendChild: function () {} },
    body: { appendChild: function () {} },
    baseURI: 'http://localhost:8765/'
  };
}
if (!g.IDEE) g.IDEE = { layer: {}, plugin: {}, ui: {} };
if (!g.IDEE.ui) g.IDEE.ui = {};
if (!g.IDEE.ui.Panel) {
  g.IDEE.ui.Panel = function (id, opts) {
    this.id = id;
    this.options = opts || {};
    this._el = {
      className: opts.className || '',
      style: {},
      classList: { add: function () {}, remove: function () {}, contains: function () { return false; }, toggle: function () {} },
      querySelector: function () { return { appendChild: function () {} }; }
    };
    this.getElement = function () { return this._el; };
    this.open = function () {};
    this.close = function () {};
  };
}
if (!g.M) g.M = g.IDEE;
g.IDEE.layer.Alphanumeric = g.IDEE.layer.Alphanumeric || function (o) { this._records = (o && (o.records || o.data)) || []; this._fields = (o && o.fields) || []; this.name = (o && o.name) || 'x'; this.legend = (o && o.legend) || this.name; this.getRecords = function () { return this._records; }; this.getFieldNames = function () { return this._fields.map(function (f) { return (typeof f === 'string') ? f : f.name; }); }; };
g.IDEE.layer.Alphanumeric.fromCSV = function (t, o) { return new g.IDEE.layer.Alphanumeric(Object.assign({ records: [] }, o)); };
g.IDEE.layer.Alphanumeric.fromJSON = function (d, o) { return new g.IDEE.layer.Alphanumeric(Object.assign({ records: Array.isArray(d) ? d : (d && (d.records || d.data || d.rows)) || [] }, o)); };
g.IDEE.layer.Alphanumeric.fromINE = function () { return new g.IDEE.layer.Alphanumeric({}); };
g.IDEE.layer.Alphanumeric.fromMadrid = function () { return new g.IDEE.layer.Alphanumeric({}); };
g.IDEE.layer.GeoJSON = function (opts, config) {
  this.name = opts && opts.name;
  this.legend = opts && opts.legend;
  this.displayInLayerSwitcher = opts && opts.displayInLayerSwitcher;
  this.options = opts;
  this.config = config;
  this._visible = true;
  this.setVisible = function (v) { this._visible = v !== false; return this; };
  this.isVisible = function () { return this._visible; };
  this.getMaxExtent = function () { return [-10, 35, 5, 45]; };
  this.getImpl = function () { return {}; };
};
g.IDEE.layer.Vector = function () {};
g.IDEE.utils = { reproject: function (p) { return p; } };

if (typeof g.fetch === 'undefined') {
  g.fetch = async function () { return { ok: true, json: async function () { return []; }, text: async function () { return ''; } }; };
}

module.exports = g;
