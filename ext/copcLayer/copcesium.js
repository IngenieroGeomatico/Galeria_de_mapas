/*
 * copcesium.js
 * ---------------------------------------------------------------------------
 * copcesium 1.4.0 (MIT), bundle de lectura directa de COPC sobre CesiumJS.
 *
 * Origen:   https://cdn.jsdelivr.net/npm/copcesium@1.4.0/dist/copc-cesium.mjs
 * Proyecto: https://github.com/connormanning/copcesium
 *
 * Transformacion local, sin tocar el codigo de la libreria:
 *   1. El bundle ESM se envuelve en una funcion para que se pueda recargar
 *      cuando la API cambia de bundle 2D/3D. Si no, el "const e" de nivel
 *      superior choca al ejecutar el script por segunda vez.
 *   2. "import * as e from \"cesium\";" -> parametro "e" de la envoltura,
 *      alimentado con window.Cesium. La API-IDEE carga Cesium como global.
 *   3. "export { Vs as CopcDataSource, Ds as WorkerPool };" ->
 *      "window.copcesium = { CopcDataSource: Vs, WorkerPool: Ds };"
 *
 * El resto del bundle se conserva byte a byte. No editar a mano: si se sube
 * de version, repetir la transformacion. Licencias de terceros en
 * THIRD_PARTY_LICENSES.md.
 */
(function (e) {
//#region \0rolldown/runtime.js
var t = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports);
//#endregion
//#region node_modules/proj4/lib/global.js
function n(e) {
	e("EPSG:4326", "+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees"), e("EPSG:4269", "+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees"), e("EPSG:3857", "+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs");
	for (var t = 1; t <= 60; ++t) e("EPSG:" + (32600 + t), "+proj=utm +zone=" + t + " +datum=WGS84 +units=m"), e("EPSG:" + (32700 + t), "+proj=utm +zone=" + t + " +south +datum=WGS84 +units=m");
	e("EPSG:5041", "+title=WGS 84 / UPS North (E,N) +proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m"), e("EPSG:5042", "+title=WGS 84 / UPS South (E,N) +proj=stere +lat_0=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m"), e.WGS84 = e["EPSG:4326"], e["EPSG:3785"] = e["EPSG:3857"], e.GOOGLE = e["EPSG:3857"], e["EPSG:900913"] = e["EPSG:3857"], e["EPSG:102113"] = e["EPSG:3857"];
}
//#endregion
//#region node_modules/proj4/lib/constants/values.js
var r = 6378137, i = 6356752.314, a = .0066943799901413165, o = 484813681109536e-20, s = Math.PI / 2, c = .16666666666666666, l = .04722222222222222, u = .022156084656084655, d = 1e-10, f = .017453292519943295, p = 57.29577951308232, m = Math.PI / 4, h = Math.PI * 2, g = 3.14159265359, _ = {};
_.greenwich = 0, _.lisbon = -9.131906111111, _.paris = 2.337229166667, _.bogota = -74.080916666667, _.madrid = -3.687938888889, _.rome = 12.452333333333, _.bern = 7.439583333333, _.jakarta = 106.807719444444, _.ferro = -17.666666666667, _.brussels = 4.367975, _.stockholm = 18.058277777778, _.athens = 23.7163375, _.oslo = 10.722916666667;
//#endregion
//#region node_modules/proj4/lib/constants/units.js
var v = {
	mm: { to_meter: .001 },
	cm: { to_meter: .01 },
	ft: { to_meter: .3048 },
	"us-ft": { to_meter: 1200 / 3937 },
	fath: { to_meter: 1.8288 },
	kmi: { to_meter: 1852 },
	"us-ch": { to_meter: 20.1168402336805 },
	"us-mi": { to_meter: 1609.34721869444 },
	km: { to_meter: 1e3 },
	"ind-ft": { to_meter: .30479841 },
	"ind-yd": { to_meter: .91439523 },
	mi: { to_meter: 1609.344 },
	yd: { to_meter: .9144 },
	ch: { to_meter: 20.1168 },
	link: { to_meter: .201168 },
	dm: { to_meter: .1 },
	in: { to_meter: .0254 },
	"ind-ch": { to_meter: 20.11669506 },
	"us-in": { to_meter: .025400050800101 },
	"us-yd": { to_meter: .914401828803658 }
}, y = /[\s_\-\/\(\)]/g;
function b(e, t) {
	if (e[t]) return e[t];
	for (var n = Object.keys(e), r = t.toLowerCase().replace(y, ""), i = -1, a, o; ++i < n.length;) if (a = n[i], o = a.toLowerCase().replace(y, ""), o === r) return e[a];
}
//#endregion
//#region node_modules/proj4/lib/projString.js
function x(e) {
	var t = {}, n = e.split("+").map(function(e) {
		return e.trim();
	}).filter(function(e) {
		return e;
	}).reduce(function(e, t) {
		var n = t.split("=");
		return n.push(!0), e[n[0].toLowerCase()] = n[1], e;
	}, {}), r, i, a, o = {
		proj: "projName",
		datum: "datumCode",
		rf: function(e) {
			t.rf = parseFloat(e);
		},
		lat_0: function(e) {
			t.lat0 = e * f;
		},
		lat_1: function(e) {
			t.lat1 = e * f;
		},
		lat_2: function(e) {
			t.lat2 = e * f;
		},
		lat_ts: function(e) {
			t.lat_ts = e * f;
		},
		lon_0: function(e) {
			t.long0 = e * f;
		},
		lon_1: function(e) {
			t.long1 = e * f;
		},
		lon_2: function(e) {
			t.long2 = e * f;
		},
		alpha: function(e) {
			t.alpha = parseFloat(e) * f;
		},
		gamma: function(e) {
			t.rectified_grid_angle = parseFloat(e) * f;
		},
		lonc: function(e) {
			t.longc = e * f;
		},
		x_0: function(e) {
			t.x0 = parseFloat(e);
		},
		y_0: function(e) {
			t.y0 = parseFloat(e);
		},
		k_0: function(e) {
			t.k0 = parseFloat(e);
		},
		k: function(e) {
			t.k0 = parseFloat(e);
		},
		a: function(e) {
			t.a = parseFloat(e);
		},
		b: function(e) {
			t.b = parseFloat(e);
		},
		r: function(e) {
			t.a = t.b = parseFloat(e);
		},
		r_a: function() {
			t.R_A = !0;
		},
		zone: function(e) {
			t.zone = parseInt(e, 10);
		},
		south: function() {
			t.utmSouth = !0;
		},
		towgs84: function(e) {
			t.datum_params = e.split(",").map(function(e) {
				return parseFloat(e);
			});
		},
		to_meter: function(e) {
			t.to_meter = parseFloat(e);
		},
		units: function(e) {
			t.units = e;
			var n = b(v, e);
			n && (t.to_meter = n.to_meter);
		},
		from_greenwich: function(e) {
			t.from_greenwich = e * f;
		},
		pm: function(e) {
			t.from_greenwich = (b(_, e) || parseFloat(e)) * f;
		},
		nadgrids: function(e) {
			e === "@null" ? t.datumCode = "none" : t.nadgrids = e;
		},
		axis: function(e) {
			var n = "ewnsud";
			e.length === 3 && n.indexOf(e.substr(0, 1)) !== -1 && n.indexOf(e.substr(1, 1)) !== -1 && n.indexOf(e.substr(2, 1)) !== -1 && (t.axis = e);
		},
		approx: function() {
			t.approx = !0;
		},
		over: function() {
			t.over = !0;
		}
	};
	for (r in n) i = n[r], r in o ? (a = o[r], typeof a == "function" ? a(i) : t[a] = i) : t[r] = i;
	return typeof t.datumCode == "string" && t.datumCode !== "WGS84" && (t.datumCode = t.datumCode.toLowerCase()), t.projStr = e, t;
}
//#endregion
//#region node_modules/wkt-parser/PROJJSONBuilderBase.js
var S = class {
	static getId(e) {
		let t = e.find((e) => Array.isArray(e) && e[0] === "ID");
		return t && t.length >= 3 ? {
			authority: t[1],
			code: parseInt(t[2], 10)
		} : null;
	}
	static convertUnit(e, t = "unit") {
		if (!e || e.length < 3) return {
			type: t,
			name: "unknown",
			conversion_factor: null
		};
		let n = e[1], r = parseFloat(e[2]) || null, i = e.find((e) => Array.isArray(e) && e[0] === "ID");
		return {
			type: t,
			name: n,
			conversion_factor: r,
			id: i ? {
				authority: i[1],
				code: parseInt(i[2], 10)
			} : null
		};
	}
	static convertAxis(e) {
		let t = e[1] || "Unknown", n, r = t.match(/^\((.)\)$/);
		if (r) {
			let t = r[1].toUpperCase();
			if (t === "E") n = "east";
			else if (t === "N") n = "north";
			else if (t === "U") n = "up";
			else if (e[2]) n = e[2];
			else throw Error(`Unknown axis abbreviation: ${t}`);
		} else n = e[2] || "unknown";
		let i = e.find((e) => Array.isArray(e) && e[0] === "ORDER"), a = i ? parseInt(i[1], 10) : null, o = e.find((e) => Array.isArray(e) && (e[0] === "LENGTHUNIT" || e[0] === "ANGLEUNIT" || e[0] === "SCALEUNIT")), s = this.convertUnit(o);
		return {
			name: t,
			direction: n,
			unit: s,
			order: a
		};
	}
	static extractAxes(e) {
		return e.filter((e) => Array.isArray(e) && e[0] === "AXIS").map((e) => this.convertAxis(e)).sort((e, t) => (e.order || 0) - (t.order || 0));
	}
	static convert(e, t = {}) {
		switch (e[0]) {
			case "PROJCRS":
				t.type = "ProjectedCRS", t.name = e[1], t.base_crs = e.find((e) => Array.isArray(e) && e[0] === "BASEGEOGCRS") ? this.convert(e.find((e) => Array.isArray(e) && e[0] === "BASEGEOGCRS")) : null, t.conversion = e.find((e) => Array.isArray(e) && e[0] === "CONVERSION") ? this.convert(e.find((e) => Array.isArray(e) && e[0] === "CONVERSION")) : null;
				let n = e.find((e) => Array.isArray(e) && e[0] === "CS");
				n && (t.coordinate_system = {
					type: n[1],
					axis: this.extractAxes(e)
				});
				let r = e.find((e) => Array.isArray(e) && e[0] === "LENGTHUNIT");
				if (r) {
					let e = this.convertUnit(r);
					t.coordinate_system.unit = e;
				}
				t.id = this.getId(e);
				break;
			case "BASEGEOGCRS":
			case "GEOGCRS":
			case "GEODCRS":
				t.type = e[0] === "GEODCRS" ? "GeodeticCRS" : "GeographicCRS", t.name = e[1];
				let i = e.find((e) => Array.isArray(e) && (e[0] === "DATUM" || e[0] === "ENSEMBLE"));
				if (i) {
					let n = this.convert(i);
					i[0] === "ENSEMBLE" ? t.datum_ensemble = n : t.datum = n;
					let r = e.find((e) => Array.isArray(e) && e[0] === "PRIMEM");
					r && r[1] !== "Greenwich" && (n.prime_meridian = {
						name: r[1],
						longitude: parseFloat(r[2])
					});
				}
				t.coordinate_system = {
					type: "ellipsoidal",
					axis: this.extractAxes(e)
				}, t.id = this.getId(e);
				break;
			case "DATUM":
				t.type = "GeodeticReferenceFrame", t.name = e[1], t.ellipsoid = e.find((e) => Array.isArray(e) && e[0] === "ELLIPSOID") ? this.convert(e.find((e) => Array.isArray(e) && e[0] === "ELLIPSOID")) : null;
				break;
			case "ENSEMBLE":
				t.type = "DatumEnsemble", t.name = e[1], t.members = e.filter((e) => Array.isArray(e) && e[0] === "MEMBER").map((e) => ({
					type: "DatumEnsembleMember",
					name: e[1],
					id: this.getId(e)
				}));
				let a = e.find((e) => Array.isArray(e) && e[0] === "ENSEMBLEACCURACY");
				a && (t.accuracy = parseFloat(a[1]));
				let o = e.find((e) => Array.isArray(e) && e[0] === "ELLIPSOID");
				o && (t.ellipsoid = this.convert(o)), t.id = this.getId(e);
				break;
			case "ELLIPSOID":
				t.type = "Ellipsoid", t.name = e[1], t.semi_major_axis = parseFloat(e[2]), t.inverse_flattening = parseFloat(e[3]), e.find((e) => Array.isArray(e) && e[0] === "LENGTHUNIT") && this.convert(e.find((e) => Array.isArray(e) && e[0] === "LENGTHUNIT"), t);
				break;
			case "CONVERSION":
				t.type = "Conversion", t.name = e[1], t.method = e.find((e) => Array.isArray(e) && e[0] === "METHOD") ? this.convert(e.find((e) => Array.isArray(e) && e[0] === "METHOD")) : null, t.parameters = e.filter((e) => Array.isArray(e) && e[0] === "PARAMETER").map((e) => this.convert(e));
				break;
			case "METHOD":
				t.type = "Method", t.name = e[1], t.id = this.getId(e);
				break;
			case "PARAMETER":
				t.type = "Parameter", t.name = e[1], t.value = parseFloat(e[2]), t.unit = this.convertUnit(e.find((e) => Array.isArray(e) && (e[0] === "LENGTHUNIT" || e[0] === "ANGLEUNIT" || e[0] === "SCALEUNIT"))), t.id = this.getId(e);
				break;
			case "BOUNDCRS":
				t.type = "BoundCRS";
				let s = e.find((e) => Array.isArray(e) && e[0] === "SOURCECRS");
				if (s) {
					let e = s.find((e) => Array.isArray(e));
					t.source_crs = e ? this.convert(e) : null;
				}
				let c = e.find((e) => Array.isArray(e) && e[0] === "TARGETCRS");
				if (c) {
					let e = c.find((e) => Array.isArray(e));
					t.target_crs = e ? this.convert(e) : null;
				}
				let l = e.find((e) => Array.isArray(e) && e[0] === "ABRIDGEDTRANSFORMATION");
				l ? t.transformation = this.convert(l) : t.transformation = null;
				break;
			case "ABRIDGEDTRANSFORMATION":
				if (t.type = "Transformation", t.name = e[1], t.method = e.find((e) => Array.isArray(e) && e[0] === "METHOD") ? this.convert(e.find((e) => Array.isArray(e) && e[0] === "METHOD")) : null, t.parameters = e.filter((e) => Array.isArray(e) && (e[0] === "PARAMETER" || e[0] === "PARAMETERFILE")).map((e) => {
					if (e[0] === "PARAMETER") return this.convert(e);
					if (e[0] === "PARAMETERFILE") return {
						name: e[1],
						value: e[2],
						id: {
							authority: "EPSG",
							code: 8656
						}
					};
				}), t.parameters.length === 7) {
					let e = t.parameters[6];
					e.name === "Scale difference" && (e.value = Math.round((e.value - 1) * 0xe8d4a51000) / 1e6);
				}
				t.id = this.getId(e);
				break;
			case "AXIS":
				t.coordinate_system ||= {
					type: "unspecified",
					axis: []
				}, t.coordinate_system.axis.push(this.convertAxis(e));
				break;
			case "LENGTHUNIT":
				let u = this.convertUnit(e, "LinearUnit");
				t.coordinate_system && t.coordinate_system.axis && t.coordinate_system.axis.forEach((e) => {
					e.unit ||= u;
				}), u.conversion_factor && u.conversion_factor !== 1 && (t.semi_major_axis &&= {
					value: t.semi_major_axis,
					unit: u
				});
				break;
			default:
				t.keyword = e[0];
				break;
		}
		return t;
	}
}, C = class extends S {
	static convert(e, t = {}) {
		return super.convert(e, t), t.coordinate_system && t.coordinate_system.subtype === "Cartesian" && delete t.coordinate_system, t.usage && delete t.usage, t;
	}
}, w = class extends S {
	static convert(e, t = {}) {
		super.convert(e, t);
		let n = e.find((e) => Array.isArray(e) && e[0] === "CS");
		n && (t.coordinate_system = {
			subtype: n[1],
			axis: this.extractAxes(e)
		});
		let r = e.find((e) => Array.isArray(e) && e[0] === "USAGE");
		if (r) {
			let e = r.find((e) => Array.isArray(e) && e[0] === "SCOPE"), n = r.find((e) => Array.isArray(e) && e[0] === "AREA"), i = r.find((e) => Array.isArray(e) && e[0] === "BBOX");
			t.usage = {}, e && (t.usage.scope = e[1]), n && (t.usage.area = n[1]), i && (t.usage.bbox = i.slice(1));
		}
		return t;
	}
};
//#endregion
//#region node_modules/wkt-parser/buildPROJJSON.js
function T(e) {
	return e.find((e) => Array.isArray(e) && e[0] === "USAGE") ? "2019" : (e.find((e) => Array.isArray(e) && e[0] === "CS") || e[0] === "BOUNDCRS" || e[0] === "PROJCRS" || e[0], "2015");
}
function E(e) {
	return (T(e) === "2019" ? w : C).convert(e);
}
//#endregion
//#region node_modules/wkt-parser/detectWKTVersion.js
function D(e) {
	let t = e.toUpperCase();
	return t.includes("PROJCRS") || t.includes("GEOGCRS") || t.includes("BOUNDCRS") || t.includes("VERTCRS") || t.includes("LENGTHUNIT") || t.includes("ANGLEUNIT") || t.includes("SCALEUNIT") ? "WKT2" : (t.includes("PROJCS") || t.includes("GEOGCS") || t.includes("LOCAL_CS") || t.includes("VERT_CS") || t.includes("UNIT"), "WKT1");
}
//#endregion
//#region node_modules/wkt-parser/parser.js
var ee = ce, te = 1, O = 2, k = 3, ne = 4, re = 5, A = -1, j = /\s/, ie = /[A-Za-z]/, ae = /[A-Za-z84_]/, oe = /[,\]]/, se = /[\d\.E\-\+]/;
function M(e) {
	if (typeof e != "string") throw Error("not a string");
	this.text = e.trim(), this.level = 0, this.place = 0, this.root = null, this.stack = [], this.currentObject = null, this.state = te;
}
M.prototype.readCharicter = function() {
	var e = this.text[this.place++];
	if (this.state !== ne) for (; j.test(e);) {
		if (this.place >= this.text.length) return;
		e = this.text[this.place++];
	}
	switch (this.state) {
		case te: return this.neutral(e);
		case O: return this.keyword(e);
		case ne: return this.quoted(e);
		case re: return this.afterquote(e);
		case k: return this.number(e);
		case A: return;
	}
}, M.prototype.afterquote = function(e) {
	if (e === "\"") {
		this.word += "\"", this.state = ne;
		return;
	}
	if (oe.test(e)) {
		this.word = this.word.trim(), this.afterItem(e);
		return;
	}
	throw Error("havn't handled \"" + e + "\" in afterquote yet, index " + this.place);
}, M.prototype.afterItem = function(e) {
	if (e === ",") {
		this.word !== null && this.currentObject.push(this.word), this.word = null, this.state = te;
		return;
	}
	if (e === "]") {
		this.level--, this.word !== null && (this.currentObject.push(this.word), this.word = null), this.state = te, this.currentObject = this.stack.pop(), this.currentObject || (this.state = A);
		return;
	}
}, M.prototype.number = function(e) {
	if (se.test(e)) {
		this.word += e;
		return;
	}
	if (oe.test(e)) {
		this.word = parseFloat(this.word), this.afterItem(e);
		return;
	}
	throw Error("havn't handled \"" + e + "\" in number yet, index " + this.place);
}, M.prototype.quoted = function(e) {
	if (e === "\"") {
		this.state = re;
		return;
	}
	this.word += e;
}, M.prototype.keyword = function(e) {
	if (ae.test(e)) {
		this.word += e;
		return;
	}
	if (e === "[") {
		var t = [];
		t.push(this.word), this.level++, this.root === null ? this.root = t : this.currentObject.push(t), this.stack.push(this.currentObject), this.currentObject = t, this.state = te;
		return;
	}
	if (oe.test(e)) {
		this.afterItem(e);
		return;
	}
	throw Error("havn't handled \"" + e + "\" in keyword yet, index " + this.place);
}, M.prototype.neutral = function(e) {
	if (ie.test(e)) {
		this.word = e, this.state = O;
		return;
	}
	if (e === "\"") {
		this.word = "", this.state = ne;
		return;
	}
	if (se.test(e)) {
		this.word = e, this.state = k;
		return;
	}
	if (oe.test(e)) {
		this.afterItem(e);
		return;
	}
	throw Error("havn't handled \"" + e + "\" in neutral yet, index " + this.place);
}, M.prototype.output = function() {
	for (; this.place < this.text.length;) this.readCharicter();
	if (this.state === A) return this.root;
	throw Error("unable to parse string \"" + this.text + "\". State is " + this.state);
};
function ce(e) {
	return new M(e).output();
}
//#endregion
//#region node_modules/wkt-parser/process.js
function le(e, t, n) {
	Array.isArray(t) && (n.unshift(t), t = null);
	var r = t ? {} : e, i = n.reduce(function(e, t) {
		return ue(t, e), e;
	}, r);
	t && (e[t] = i);
}
function ue(e, t) {
	if (!Array.isArray(e)) {
		t[e] = !0;
		return;
	}
	var n = e.shift();
	if (n === "PARAMETER" && (n = e.shift()), e.length === 1) {
		if (Array.isArray(e[0])) {
			t[n] = {}, ue(e[0], t[n]);
			return;
		}
		t[n] = e[0];
		return;
	}
	if (!e.length) {
		t[n] = !0;
		return;
	}
	if (n === "TOWGS84") {
		t[n] = e;
		return;
	}
	if (n === "AXIS") {
		n in t || (t[n] = []), t[n].push(e);
		return;
	}
	Array.isArray(n) || (t[n] = {});
	var r;
	switch (n) {
		case "UNIT":
		case "PRIMEM":
		case "VERT_DATUM":
			t[n] = {
				name: e[0].toLowerCase(),
				convert: e[1]
			}, e.length === 3 && ue(e[2], t[n]);
			return;
		case "SPHEROID":
		case "ELLIPSOID":
			t[n] = {
				name: e[0],
				a: e[1],
				rf: e[2]
			}, e.length === 4 && ue(e[3], t[n]);
			return;
		case "EDATUM":
		case "ENGINEERINGDATUM":
		case "LOCAL_DATUM":
		case "DATUM":
		case "VERT_CS":
		case "VERTCRS":
		case "VERTICALCRS":
			e[0] = ["name", e[0]], le(t, n, e);
			return;
		case "COMPD_CS":
		case "COMPOUNDCRS":
		case "FITTED_CS":
		case "PROJECTEDCRS":
		case "PROJCRS":
		case "GEOGCS":
		case "GEOCCS":
		case "PROJCS":
		case "LOCAL_CS":
		case "GEODCRS":
		case "GEODETICCRS":
		case "GEODETICDATUM":
		case "ENGCRS":
		case "ENGINEERINGCRS":
			e[0] = ["name", e[0]], le(t, n, e), t[n].type = n;
			return;
		default:
			for (r = -1; ++r < e.length;) if (!Array.isArray(e[r])) return ue(e, t[n]);
			return le(t, n, e);
	}
}
//#endregion
//#region node_modules/wkt-parser/util.js
var de = .017453292519943295;
function N(e) {
	return e * de;
}
function fe(e) {
	let t = (e.projName || "").toLowerCase().replace(/_/g, " ");
	e.long0 === void 0 && e.longc !== void 0 && (e.long0 = e.longc), !e.lat_ts && e.lat1 && (t === "stereographic south pole" || t === "polar stereographic (variant b)") ? (e.lat0 = N(e.lat1 > 0 ? 90 : -90), e.lat_ts = e.lat1, delete e.lat1) : !e.lat_ts && e.lat0 && (t === "polar stereographic" || t === "polar stereographic (variant a)") && (e.lat_ts = e.lat0, e.lat0 = N(e.lat0 > 0 ? 90 : -90), delete e.lat1);
}
//#endregion
//#region node_modules/wkt-parser/transformPROJJSON.js
function pe(e) {
	let t = {
		units: null,
		to_meter: void 0
	};
	return typeof e == "string" ? (t.units = e.toLowerCase(), t.units === "metre" && (t.units = "meter"), t.units === "meter" && (t.to_meter = 1)) : e && e.name && (t.units = e.name.toLowerCase(), t.units === "metre" && (t.units = "meter"), t.to_meter = e.conversion_factor), t;
}
function me(e) {
	return typeof e == "object" ? e.value * e.unit.conversion_factor : e;
}
function he(e, t) {
	e.ellipsoid.radius ? (t.a = e.ellipsoid.radius, t.rf = 0) : (t.a = me(e.ellipsoid.semi_major_axis), e.ellipsoid.inverse_flattening === void 0 ? e.ellipsoid.semi_major_axis !== void 0 && e.ellipsoid.semi_minor_axis !== void 0 && (t.rf = t.a / (t.a - me(e.ellipsoid.semi_minor_axis))) : t.rf = e.ellipsoid.inverse_flattening);
}
function ge(e, t = {}) {
	return !e || typeof e != "object" ? e : e.type === "BoundCRS" ? (ge(e.source_crs, t), e.transformation && (e.transformation.method && e.transformation.method.name === "NTv2" ? t.nadgrids = e.transformation.parameters[0].value : t.datum_params = e.transformation.parameters.map((e) => e.value)), t) : (Object.keys(e).forEach((n) => {
		let r = e[n];
		if (r !== null) switch (n) {
			case "name":
				if (t.srsCode) break;
				t.name = r, t.srsCode = r;
				break;
			case "type":
				r === "GeographicCRS" ? t.projName = "longlat" : r === "GeodeticCRS" ? e.coordinate_system && e.coordinate_system.subtype === "Cartesian" ? t.projName = "geocent" : t.projName = "longlat" : r === "ProjectedCRS" && e.conversion && e.conversion.method && (t.projName = e.conversion.method.name);
				break;
			case "datum":
			case "datum_ensemble":
				r.ellipsoid && (t.ellps = r.ellipsoid.name, he(r, t)), r.prime_meridian && (t.from_greenwich = r.prime_meridian.longitude * Math.PI / 180);
				break;
			case "ellipsoid":
				t.ellps = r.name, he(r, t);
				break;
			case "prime_meridian":
				t.long0 = (r.longitude || 0) * Math.PI / 180;
				break;
			case "coordinate_system":
				if (r.axis) {
					let e = {
						east: "e",
						north: "n",
						west: "w",
						south: "s",
						up: "u",
						down: "d",
						geocentricx: "e",
						geocentricy: "n",
						geocentricz: "u"
					}, n = r.axis.map((t) => e[t.direction.toLowerCase()]);
					if (n.every(Boolean) && (t.axis = n.join(""), t.axis.length === 2 && (t.axis += "u")), r.unit) {
						let { units: e, to_meter: n } = pe(r.unit);
						t.units = e, t.to_meter = n;
					} else if (r.axis[0] && r.axis[0].unit) {
						let { units: e, to_meter: n } = pe(r.axis[0].unit);
						t.units = e, t.to_meter = n;
					}
				}
				break;
			case "id":
				r.authority && r.code && (t.title = r.authority + ":" + r.code);
				break;
			case "conversion":
				r.method && r.method.name && (t.projName = r.method.name), r.parameters && r.parameters.forEach((e) => {
					let n = e.name.toLowerCase().replace(/\s+/g, "_"), r = e.value;
					e.unit && e.unit.conversion_factor ? t[n] = r * e.unit.conversion_factor : e.unit === "degree" ? t[n] = r * Math.PI / 180 : t[n] = r;
				});
				break;
			case "unit":
				r.name && (t.units = r.name.toLowerCase(), t.units === "metre" && (t.units = "meter")), r.conversion_factor && (t.to_meter = r.conversion_factor);
				break;
			case "base_crs":
				ge(r, t), t.datumCode = r.id ? r.id.authority + "_" + r.id.code : r.name;
				break;
			default: break;
		}
	}), t.latitude_of_false_origin !== void 0 && (t.lat0 = t.latitude_of_false_origin), t.longitude_of_false_origin !== void 0 && (t.long0 = t.longitude_of_false_origin), t.latitude_of_standard_parallel !== void 0 && (t.lat0 = t.latitude_of_standard_parallel, t.lat1 = t.latitude_of_standard_parallel), t.latitude_of_1st_standard_parallel !== void 0 && (t.lat1 = t.latitude_of_1st_standard_parallel), t.latitude_of_2nd_standard_parallel !== void 0 && (t.lat2 = t.latitude_of_2nd_standard_parallel), t.latitude_of_projection_centre !== void 0 && (t.lat0 = t.latitude_of_projection_centre), t.longitude_of_projection_centre !== void 0 && (t.longc = t.longitude_of_projection_centre), t.easting_at_false_origin !== void 0 && (t.x0 = t.easting_at_false_origin), t.northing_at_false_origin !== void 0 && (t.y0 = t.northing_at_false_origin), t.latitude_of_natural_origin !== void 0 && (t.lat0 = t.latitude_of_natural_origin), t.longitude_of_natural_origin !== void 0 && (t.long0 = t.longitude_of_natural_origin), t.longitude_of_origin !== void 0 && (t.long0 = t.longitude_of_origin), t.false_easting !== void 0 && (t.x0 = t.false_easting), t.easting_at_projection_centre && (t.x0 = t.easting_at_projection_centre), t.false_northing !== void 0 && (t.y0 = t.false_northing), t.northing_at_projection_centre && (t.y0 = t.northing_at_projection_centre), t.standard_parallel_1 !== void 0 && (t.lat1 = t.standard_parallel_1), t.standard_parallel_2 !== void 0 && (t.lat2 = t.standard_parallel_2), t.scale_factor_at_natural_origin !== void 0 && (t.k0 = t.scale_factor_at_natural_origin), t.scale_factor_at_projection_centre !== void 0 && (t.k0 = t.scale_factor_at_projection_centre), t.scale_factor_on_pseudo_standard_parallel !== void 0 && (t.k0 = t.scale_factor_on_pseudo_standard_parallel), t.azimuth !== void 0 && (t.alpha = t.azimuth), t.azimuth_at_projection_centre !== void 0 && (t.alpha = t.azimuth_at_projection_centre), t.angle_from_rectified_to_skew_grid && (t.rectified_grid_angle = t.angle_from_rectified_to_skew_grid), fe(t), t);
}
//#endregion
//#region node_modules/wkt-parser/index.js
var _e = [
	"PROJECTEDCRS",
	"PROJCRS",
	"GEOGCS",
	"GEOCCS",
	"PROJCS",
	"LOCAL_CS",
	"GEODCRS",
	"GEODETICCRS",
	"GEODETICDATUM",
	"ENGCRS",
	"ENGINEERINGCRS"
];
function ve(e, t) {
	var n = t[0], r = t[1];
	!(n in e) && r in e && (e[n] = e[r], t.length === 3 && (e[n] = t[2](e[n])));
}
function ye(e) {
	for (var t = Object.keys(e), n = 0, r = t.length; n < r; ++n) {
		var i = t[n];
		_e.indexOf(i) !== -1 && be(e[i]), typeof e[i] == "object" && ye(e[i]);
	}
}
function be(e) {
	if (e.AUTHORITY) {
		var t = Object.keys(e.AUTHORITY)[0];
		t && t in e.AUTHORITY && (e.title = t + ":" + e.AUTHORITY[t]);
	}
	if (e.type === "GEOGCS" ? e.projName = "longlat" : e.type === "LOCAL_CS" ? (e.projName = "identity", e.local = !0) : typeof e.PROJECTION == "object" ? e.projName = Object.keys(e.PROJECTION)[0] : e.projName = e.PROJECTION, e.AXIS) {
		for (var n = "", r = 0, i = e.AXIS.length; r < i; ++r) {
			var a = [e.AXIS[r][0].toLowerCase(), e.AXIS[r][1].toLowerCase()];
			a[0].indexOf("north") !== -1 || (a[0] === "y" || a[0] === "lat") && a[1] === "north" ? n += "n" : a[0].indexOf("south") !== -1 || (a[0] === "y" || a[0] === "lat") && a[1] === "south" ? n += "s" : a[0].indexOf("east") !== -1 || (a[0] === "x" || a[0] === "lon") && a[1] === "east" ? n += "e" : (a[0].indexOf("west") !== -1 || (a[0] === "x" || a[0] === "lon") && a[1] === "west") && (n += "w");
		}
		n.length === 2 && (n += "u"), n.length === 3 && (e.axis = n);
	}
	e.UNIT && (e.units = e.UNIT.name.toLowerCase(), e.units === "metre" && (e.units = "meter"), e.UNIT.convert && (e.type === "GEOGCS" ? e.DATUM && e.DATUM.SPHEROID && (e.to_meter = e.UNIT.convert * e.DATUM.SPHEROID.a) : e.to_meter = e.UNIT.convert));
	var o = e.GEOGCS;
	e.type === "GEOGCS" && (o = e), o && (o.PRIMEM && o.PRIMEM.convert && (e.from_greenwich = N(o.PRIMEM.convert)), o.DATUM ? e.datumCode = o.DATUM.name.toLowerCase() : e.datumCode = o.name.toLowerCase(), e.datumCode.slice(0, 2) === "d_" && (e.datumCode = e.datumCode.slice(2)), e.datumCode === "new_zealand_1949" && (e.datumCode = "nzgd49"), (e.datumCode === "wgs_1984" || e.datumCode === "world_geodetic_system_1984") && (e.PROJECTION === "Mercator_Auxiliary_Sphere" && (e.sphere = !0), e.datumCode = "wgs84"), e.datumCode === "belge_1972" && (e.datumCode = "rnb72"), o.DATUM && o.DATUM.SPHEROID && (e.ellps = o.DATUM.SPHEROID.name.replace("_19", "").replace(/[Cc]larke\_18/, "clrk"), e.ellps.toLowerCase().slice(0, 13) === "international" && (e.ellps = "intl"), e.a = o.DATUM.SPHEROID.a, e.rf = parseFloat(o.DATUM.SPHEROID.rf)), o.DATUM && o.DATUM.TOWGS84 && (e.datum_params = o.DATUM.TOWGS84), ~e.datumCode.indexOf("osgb_1936") && (e.datumCode = "osgb36"), ~e.datumCode.indexOf("osni_1952") && (e.datumCode = "osni52"), (~e.datumCode.indexOf("tm65") || ~e.datumCode.indexOf("geodetic_datum_of_1965")) && (e.datumCode = "ire65"), e.datumCode === "ch1903+" && (e.datumCode = "ch1903"), ~e.datumCode.indexOf("israel") && (e.datumCode = "isr93")), e.b && !isFinite(e.b) && (e.b = e.a), e.rectified_grid_angle &&= N(e.rectified_grid_angle);
	function s(t) {
		return t * (e.to_meter || 1);
	}
	[
		["standard_parallel_1", "Standard_Parallel_1"],
		["standard_parallel_1", "Latitude of 1st standard parallel"],
		["standard_parallel_2", "Standard_Parallel_2"],
		["standard_parallel_2", "Latitude of 2nd standard parallel"],
		["false_easting", "False_Easting"],
		["false_easting", "False easting"],
		["false-easting", "Easting at false origin"],
		["false_northing", "False_Northing"],
		["false_northing", "False northing"],
		["false_northing", "Northing at false origin"],
		["central_meridian", "Central_Meridian"],
		["central_meridian", "Longitude of natural origin"],
		["central_meridian", "Longitude of false origin"],
		["latitude_of_origin", "Latitude_Of_Origin"],
		["latitude_of_origin", "Central_Parallel"],
		["latitude_of_origin", "Latitude of natural origin"],
		["latitude_of_origin", "Latitude of false origin"],
		["scale_factor", "Scale_Factor"],
		["k0", "scale_factor"],
		["latitude_of_center", "Latitude_Of_Center"],
		["latitude_of_center", "Latitude_of_center"],
		[
			"lat0",
			"latitude_of_center",
			N
		],
		["longitude_of_center", "Longitude_Of_Center"],
		["longitude_of_center", "Longitude_of_center"],
		[
			"longc",
			"longitude_of_center",
			N
		],
		[
			"x0",
			"false_easting",
			s
		],
		[
			"y0",
			"false_northing",
			s
		],
		[
			"long0",
			"central_meridian",
			N
		],
		[
			"lat0",
			"latitude_of_origin",
			N
		],
		[
			"lat0",
			"standard_parallel_1",
			N
		],
		[
			"lat1",
			"standard_parallel_1",
			N
		],
		[
			"lat2",
			"standard_parallel_2",
			N
		],
		["azimuth", "Azimuth"],
		[
			"alpha",
			"azimuth",
			N
		],
		["srsCode", "name"]
	].forEach(function(t) {
		return ve(e, t);
	}), fe(e);
}
function P(e) {
	if (typeof e == "object") return ge(e);
	let t = D(e);
	var n = ee(e);
	if (t === "WKT2") return ge(E(n));
	var r = n[0], i = {};
	return ue(n, i), ye(i), i[r];
}
//#endregion
//#region node_modules/proj4/lib/defs.js
function F(e) {
	var t = this;
	if (arguments.length === 2) {
		var n = arguments[1];
		typeof n == "string" ? n.charAt(0) === "+" ? F[e] = x(arguments[1]) : F[e] = P(arguments[1]) : n && typeof n == "object" && !("projName" in n) ? F[e] = P(arguments[1]) : (F[e] = n, n || delete F[e]);
	} else if (arguments.length === 1) {
		if (Array.isArray(e)) return e.map(function(e) {
			return Array.isArray(e) ? F.apply(t, e) : F(e);
		});
		if (typeof e == "string") {
			if (e in F) return F[e];
		} else "EPSG" in e ? F["EPSG:" + e.EPSG] = e : "ESRI" in e ? F["ESRI:" + e.ESRI] = e : "IAU2000" in e ? F["IAU2000:" + e.IAU2000] = e : console.log(e);
		return;
	}
}
n(F);
//#endregion
//#region node_modules/proj4/lib/parseCode.js
function xe(e) {
	return typeof e == "string";
}
function Se(e) {
	return e in F;
}
function Ce(e) {
	return e.indexOf("+") !== 0 && e.indexOf("[") !== -1 || typeof e == "object" && !("srsCode" in e);
}
var I = [
	"3857",
	"900913",
	"3785",
	"102113"
];
function L(e) {
	if (e.title) return e.title.toLowerCase().indexOf("epsg:") === 0 && I.indexOf(e.title.substr(5)) > -1;
	var t = b(e, "authority");
	if (t) {
		var n = b(t, "epsg");
		return n && I.indexOf(n) > -1;
	}
}
function we(e) {
	var t = b(e, "extension");
	if (t) return b(t, "proj4");
}
function Te(e) {
	return e[0] === "+";
}
function Ee(e) {
	let t;
	if (xe(e)) if (Se(e)) t = F[e];
	else if (Ce(e)) {
		t = P(e);
		var n = we(t);
		n && (t = x(n));
	} else Te(e) && (t = x(e));
	else t = "projName" in e ? e : P(e);
	return t && L(t) ? F["EPSG:3857"] : t;
}
//#endregion
//#region node_modules/proj4/lib/extend.js
function R(e, t) {
	e ||= {};
	var n, r;
	if (!t) return e;
	for (r in t) n = t[r], n !== void 0 && (e[r] = n);
	return e;
}
//#endregion
//#region node_modules/proj4/lib/common/msfnz.js
function z(e, t, n) {
	var r = e * t;
	return n / Math.sqrt(1 - r * r);
}
//#endregion
//#region node_modules/proj4/lib/common/sign.js
function De(e) {
	return e < 0 ? -1 : 1;
}
//#endregion
//#region node_modules/proj4/lib/common/adjust_lon.js
function B(e, t) {
	return t || Math.abs(e) <= 3.14159265359 ? e : e - De(e) * h;
}
//#endregion
//#region node_modules/proj4/lib/common/tsfnz.js
function V(e, t, n) {
	var r = e * n, i = .5 * e;
	return r = ((1 - r) / (1 + r)) ** i, Math.tan(.5 * (s - t)) / r;
}
//#endregion
//#region node_modules/proj4/lib/common/phi2z.js
function Oe(e, t) {
	for (var n = .5 * e, r, i, a = s - 2 * Math.atan(t), o = 0; o <= 15; o++) if (r = e * Math.sin(a), i = s - 2 * Math.atan(t * ((1 - r) / (1 + r)) ** n) - a, a += i, Math.abs(i) <= 1e-10) return a;
	return -9999;
}
//#endregion
//#region node_modules/proj4/lib/projections/merc.js
function ke() {
	var e = this.b / this.a;
	this.es = 1 - e * e, "x0" in this || (this.x0 = 0), "y0" in this || (this.y0 = 0), this.e = Math.sqrt(this.es), this.lat_ts ? this.sphere ? this.k0 = Math.cos(this.lat_ts) : this.k0 = z(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)) : this.k0 || (this.k ? this.k0 = this.k : this.k0 = 1);
}
function Ae(e) {
	var t = e.x, n = e.y;
	if (n * 57.29577951308232 > 90 && n * 57.29577951308232 < -90 && t * 57.29577951308232 > 180 && t * 57.29577951308232 < -180) return null;
	var r, i;
	if (Math.abs(Math.abs(n) - s) <= 1e-10) return null;
	if (this.sphere) r = this.x0 + this.a * this.k0 * B(t - this.long0, this.over), i = this.y0 + this.a * this.k0 * Math.log(Math.tan(m + .5 * n));
	else {
		var a = Math.sin(n), o = V(this.e, n, a);
		r = this.x0 + this.a * this.k0 * B(t - this.long0, this.over), i = this.y0 - this.a * this.k0 * Math.log(o);
	}
	return e.x = r, e.y = i, e;
}
function je(e) {
	var t = e.x - this.x0, n = e.y - this.y0, r, i;
	if (this.sphere) i = s - 2 * Math.atan(Math.exp(-n / (this.a * this.k0)));
	else {
		var a = Math.exp(-n / (this.a * this.k0));
		if (i = Oe(this.e, a), i === -9999) return null;
	}
	return r = B(this.long0 + t / (this.a * this.k0), this.over), e.x = r, e.y = i, e;
}
var Me = {
	init: ke,
	forward: Ae,
	inverse: je,
	names: [
		"Mercator",
		"Popular Visualisation Pseudo Mercator",
		"Mercator_1SP",
		"Mercator_Auxiliary_Sphere",
		"Mercator_Variant_A",
		"merc"
	]
};
//#endregion
//#region node_modules/proj4/lib/projections/longlat.js
function Ne() {}
function Pe(e) {
	return e;
}
var Fe = ["longlat", "identity"], Ie = [Me, {
	init: Ne,
	forward: Pe,
	inverse: Pe,
	names: Fe
}], Le = {}, Re = [];
function H(e, t) {
	var n = Re.length;
	return e.names ? (Re[n] = e, e.names.forEach(function(e) {
		Le[e.toLowerCase()] = n;
	}), this) : (console.log(t), !0);
}
function ze(e) {
	return e.replace(/[-\(\)\s]+/g, " ").trim().replace(/ /g, "_");
}
function Be(e) {
	if (!e) return !1;
	var t = e.toLowerCase();
	if (Le[t] !== void 0 && Re[Le[t]] || (t = ze(t), t in Le && Re[Le[t]])) return Re[Le[t]];
}
function Ve() {
	Ie.forEach(H);
}
var He = {
	start: Ve,
	add: H,
	get: Be
}, Ue = {
	MERIT: {
		a: 6378137,
		rf: 298.257,
		ellipseName: "MERIT 1983"
	},
	SGS85: {
		a: 6378136,
		rf: 298.257,
		ellipseName: "Soviet Geodetic System 85"
	},
	GRS80: {
		a: 6378137,
		rf: 298.257222101,
		ellipseName: "GRS 1980(IUGG, 1980)"
	},
	IAU76: {
		a: 6378140,
		rf: 298.257,
		ellipseName: "IAU 1976"
	},
	airy: {
		a: 6377563.396,
		b: 6356256.91,
		ellipseName: "Airy 1830"
	},
	APL4: {
		a: 6378137,
		rf: 298.25,
		ellipseName: "Appl. Physics. 1965"
	},
	NWL9D: {
		a: 6378145,
		rf: 298.25,
		ellipseName: "Naval Weapons Lab., 1965"
	},
	mod_airy: {
		a: 6377340.189,
		b: 6356034.446,
		ellipseName: "Modified Airy"
	},
	andrae: {
		a: 6377104.43,
		rf: 300,
		ellipseName: "Andrae 1876 (Den., Iclnd.)"
	},
	aust_SA: {
		a: 6378160,
		rf: 298.25,
		ellipseName: "Australian Natl & S. Amer. 1969"
	},
	GRS67: {
		a: 6378160,
		rf: 298.247167427,
		ellipseName: "GRS 67(IUGG 1967)"
	},
	bessel: {
		a: 6377397.155,
		rf: 299.1528128,
		ellipseName: "Bessel 1841"
	},
	bess_nam: {
		a: 6377483.865,
		rf: 299.1528128,
		ellipseName: "Bessel 1841 (Namibia)"
	},
	clrk66: {
		a: 6378206.4,
		b: 6356583.8,
		ellipseName: "Clarke 1866"
	},
	clrk80: {
		a: 6378249.145,
		rf: 293.4663,
		ellipseName: "Clarke 1880 mod."
	},
	clrk80ign: {
		a: 6378249.2,
		b: 6356515,
		rf: 293.4660213,
		ellipseName: "Clarke 1880 (IGN)"
	},
	clrk58: {
		a: 6378293.645208759,
		rf: 294.2606763692654,
		ellipseName: "Clarke 1858"
	},
	CPM: {
		a: 6375738.7,
		rf: 334.29,
		ellipseName: "Comm. des Poids et Mesures 1799"
	},
	delmbr: {
		a: 6376428,
		rf: 311.5,
		ellipseName: "Delambre 1810 (Belgium)"
	},
	engelis: {
		a: 6378136.05,
		rf: 298.2566,
		ellipseName: "Engelis 1985"
	},
	evrst30: {
		a: 6377276.345,
		rf: 300.8017,
		ellipseName: "Everest 1830"
	},
	evrst48: {
		a: 6377304.063,
		rf: 300.8017,
		ellipseName: "Everest 1948"
	},
	evrst56: {
		a: 6377301.243,
		rf: 300.8017,
		ellipseName: "Everest 1956"
	},
	evrst69: {
		a: 6377295.664,
		rf: 300.8017,
		ellipseName: "Everest 1969"
	},
	evrstSS: {
		a: 6377298.556,
		rf: 300.8017,
		ellipseName: "Everest (Sabah & Sarawak)"
	},
	fschr60: {
		a: 6378166,
		rf: 298.3,
		ellipseName: "Fischer (Mercury Datum) 1960"
	},
	fschr60m: {
		a: 6378155,
		rf: 298.3,
		ellipseName: "Fischer 1960"
	},
	fschr68: {
		a: 6378150,
		rf: 298.3,
		ellipseName: "Fischer 1968"
	},
	helmert: {
		a: 6378200,
		rf: 298.3,
		ellipseName: "Helmert 1906"
	},
	hough: {
		a: 6378270,
		rf: 297,
		ellipseName: "Hough"
	},
	intl: {
		a: 6378388,
		rf: 297,
		ellipseName: "International 1909 (Hayford)"
	},
	kaula: {
		a: 6378163,
		rf: 298.24,
		ellipseName: "Kaula 1961"
	},
	lerch: {
		a: 6378139,
		rf: 298.257,
		ellipseName: "Lerch 1979"
	},
	mprts: {
		a: 6397300,
		rf: 191,
		ellipseName: "Maupertius 1738"
	},
	new_intl: {
		a: 6378157.5,
		b: 6356772.2,
		ellipseName: "New International 1967"
	},
	plessis: {
		a: 6376523,
		rf: 6355863,
		ellipseName: "Plessis 1817 (France)"
	},
	krass: {
		a: 6378245,
		rf: 298.3,
		ellipseName: "Krassovsky, 1942"
	},
	SEasia: {
		a: 6378155,
		b: 6356773.3205,
		ellipseName: "Southeast Asia"
	},
	walbeck: {
		a: 6376896,
		b: 6355834.8467,
		ellipseName: "Walbeck"
	},
	WGS60: {
		a: 6378165,
		rf: 298.3,
		ellipseName: "WGS 60"
	},
	WGS66: {
		a: 6378145,
		rf: 298.25,
		ellipseName: "WGS 66"
	},
	WGS7: {
		a: 6378135,
		rf: 298.26,
		ellipseName: "WGS 72"
	},
	WGS84: {
		a: 6378137,
		rf: 298.257223563,
		ellipseName: "WGS 84"
	},
	sphere: {
		a: 6370997,
		b: 6370997,
		ellipseName: "Normal Sphere (r=6370997)"
	}
}, We = Ue.WGS84;
function Ge(e, t, n, r) {
	var i = e * e, a = t * t, o = (i - a) / i, s = 0;
	r ? (e *= 1 - o * (c + o * (l + o * u)), i = e * e, o = 0) : s = Math.sqrt(o);
	var d = (i - a) / a;
	return {
		es: o,
		e: s,
		ep2: d
	};
}
function Ke(e, t, n, r, i) {
	if (!e) {
		var a = b(Ue, r);
		a ||= We, e = a.a, t = a.b, n = a.rf;
	}
	return n && !t && (t = (1 - 1 / n) * e), (n === 0 || Math.abs(e - t) < 1e-10) && (i = !0, t = e), {
		a: e,
		b: t,
		rf: n,
		sphere: i
	};
}
//#endregion
//#region node_modules/proj4/lib/constants/Datum.js
var qe = {
	wgs84: {
		towgs84: "0,0,0",
		ellipse: "WGS84",
		datumName: "WGS84"
	},
	ch1903: {
		towgs84: "674.374,15.056,405.346",
		ellipse: "bessel",
		datumName: "swiss"
	},
	ggrs87: {
		towgs84: "-199.87,74.79,246.62",
		ellipse: "GRS80",
		datumName: "Greek_Geodetic_Reference_System_1987"
	},
	nad83: {
		towgs84: "0,0,0",
		ellipse: "GRS80",
		datumName: "North_American_Datum_1983"
	},
	nad27: {
		nadgrids: "@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat",
		ellipse: "clrk66",
		datumName: "North_American_Datum_1927"
	},
	potsdam: {
		towgs84: "598.1,73.7,418.2,0.202,0.045,-2.455,6.7",
		ellipse: "bessel",
		datumName: "Potsdam Rauenberg 1950 DHDN"
	},
	carthage: {
		towgs84: "-263.0,6.0,431.0",
		ellipse: "clark80",
		datumName: "Carthage 1934 Tunisia"
	},
	hermannskogel: {
		towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
		ellipse: "bessel",
		datumName: "Hermannskogel"
	},
	mgi: {
		towgs84: "577.326,90.129,463.919,5.137,1.474,5.297,2.4232",
		ellipse: "bessel",
		datumName: "Militar-Geographische Institut"
	},
	osni52: {
		towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
		ellipse: "airy",
		datumName: "Irish National"
	},
	ire65: {
		towgs84: "482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15",
		ellipse: "mod_airy",
		datumName: "Ireland 1965"
	},
	rassadiran: {
		towgs84: "-133.63,-157.5,-158.62",
		ellipse: "intl",
		datumName: "Rassadiran"
	},
	nzgd49: {
		towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993",
		ellipse: "intl",
		datumName: "New Zealand Geodetic Datum 1949"
	},
	osgb36: {
		towgs84: "446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894",
		ellipse: "airy",
		datumName: "Ordnance Survey of Great Britain 1936"
	},
	s_jtsk: {
		towgs84: "589,76,480",
		ellipse: "bessel",
		datumName: "S-JTSK (Ferro)"
	},
	beduaram: {
		towgs84: "-106,-87,188",
		ellipse: "clrk80",
		datumName: "Beduaram"
	},
	gunung_segara: {
		towgs84: "-403,684,41",
		ellipse: "bessel",
		datumName: "Gunung Segara Jakarta"
	},
	rnb72: {
		towgs84: "106.869,-52.2978,103.724,-0.33657,0.456955,-1.84218,1",
		ellipse: "intl",
		datumName: "Reseau National Belge 1972"
	},
	EPSG_5451: { towgs84: "6.41,-49.05,-11.28,1.5657,0.5242,6.9718,-5.7649" },
	IGNF_LURESG: { towgs84: "-192.986,13.673,-39.309,-0.4099,-2.9332,2.6881,0.43" },
	EPSG_4614: { towgs84: "-119.4248,-303.65872,-11.00061,1.164298,0.174458,1.096259,3.657065" },
	EPSG_4615: { towgs84: "-494.088,-312.129,279.877,-1.423,-1.013,1.59,-0.748" },
	ESRI_37241: { towgs84: "-76.822,257.457,-12.817,2.136,-0.033,-2.392,-0.031" },
	ESRI_37249: { towgs84: "-440.296,58.548,296.265,1.128,10.202,4.559,-0.438" },
	ESRI_37245: { towgs84: "-511.151,-181.269,139.609,1.05,2.703,1.798,3.071" },
	EPSG_4178: { towgs84: "24.9,-126.4,-93.2,-0.063,-0.247,-0.041,1.01" },
	EPSG_4622: { towgs84: "-472.29,-5.63,-304.12,0.4362,-0.8374,0.2563,1.8984" },
	EPSG_4625: { towgs84: "126.93,547.94,130.41,-2.7867,5.1612,-0.8584,13.8227" },
	EPSG_5252: { towgs84: "0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439" },
	EPSG_4314: { towgs84: "597.1,71.4,412.1,0.894,0.068,-1.563,7.58" },
	EPSG_4282: { towgs84: "-178.3,-316.7,-131.5,5.278,6.077,10.979,19.166" },
	EPSG_4231: { towgs84: "-83.11,-97.38,-117.22,0.005693,-0.044698,0.044285,0.1218" },
	EPSG_4274: { towgs84: "-230.994,102.591,25.199,0.633,-0.239,0.9,1.95" },
	EPSG_4134: { towgs84: "-180.624,-225.516,173.919,-0.81,-1.898,8.336,16.71006" },
	EPSG_4254: { towgs84: "18.38,192.45,96.82,0.056,-0.142,-0.2,-0.0013" },
	EPSG_4159: { towgs84: "-194.513,-63.978,-25.759,-3.4027,3.756,-3.352,-0.9175" },
	EPSG_4687: { towgs84: "0.072,-0.507,-0.245,0.0183,-0.0003,0.007,-0.0093" },
	EPSG_4227: { towgs84: "-83.58,-397.54,458.78,-17.595,-2.847,4.256,3.225" },
	EPSG_4746: { towgs84: "599.4,72.4,419.2,-0.062,-0.022,-2.723,6.46" },
	EPSG_4745: { towgs84: "612.4,77,440.2,-0.054,0.057,-2.797,2.55" },
	EPSG_6311: { towgs84: "8.846,-4.394,-1.122,-0.00237,-0.146528,0.130428,0.783926" },
	EPSG_4289: { towgs84: "565.7381,50.4018,465.2904,-0.395026,0.330772,-1.876073,4.07244" },
	EPSG_4230: { towgs84: "-68.863,-134.888,-111.49,-0.53,-0.14,0.57,-3.4" },
	EPSG_4154: { towgs84: "-123.02,-158.95,-168.47" },
	EPSG_4156: { towgs84: "570.8,85.7,462.8,4.998,1.587,5.261,3.56" },
	EPSG_4299: { towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15" },
	EPSG_4179: { towgs84: "33.4,-146.6,-76.3,-0.359,-0.053,0.844,-0.84" },
	EPSG_4313: { towgs84: "-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747" },
	EPSG_4194: { towgs84: "163.511,127.533,-159.789" },
	EPSG_4195: { towgs84: "105,326,-102.5" },
	EPSG_4196: { towgs84: "-45,417,-3.5" },
	EPSG_4611: { towgs84: "-162.619,-276.959,-161.764,0.067753,-2.243648,-1.158828,-1.094246" },
	EPSG_4633: { towgs84: "137.092,131.66,91.475,-1.9436,-11.5993,-4.3321,-7.4824" },
	EPSG_4641: { towgs84: "-408.809,366.856,-412.987,1.8842,-0.5308,2.1655,-121.0993" },
	EPSG_4643: { towgs84: "-480.26,-438.32,-643.429,16.3119,20.1721,-4.0349,-111.7002" },
	EPSG_4300: { towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15" },
	EPSG_4188: { towgs84: "482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15" },
	EPSG_4660: { towgs84: "982.6087,552.753,-540.873,6.681627,-31.611492,-19.848161,16.805" },
	EPSG_4662: { towgs84: "97.295,-263.247,310.882,-1.5999,0.8386,3.1409,13.3259" },
	EPSG_3906: { towgs84: "577.88891,165.22205,391.18289,4.9145,-0.94729,-13.05098,7.78664" },
	EPSG_4307: { towgs84: "-209.3622,-87.8162,404.6198,0.0046,3.4784,0.5805,-1.4547" },
	EPSG_6892: { towgs84: "-76.269,-16.683,68.562,-6.275,10.536,-4.286,-13.686" },
	EPSG_4690: { towgs84: "221.597,152.441,176.523,2.403,1.3893,0.884,11.4648" },
	EPSG_4691: { towgs84: "218.769,150.75,176.75,3.5231,2.0037,1.288,10.9817" },
	EPSG_4629: { towgs84: "72.51,345.411,79.241,-1.5862,-0.8826,-0.5495,1.3653" },
	EPSG_4630: { towgs84: "165.804,216.213,180.26,-0.6251,-0.4515,-0.0721,7.4111" },
	EPSG_4692: { towgs84: "217.109,86.452,23.711,0.0183,-0.0003,0.007,-0.0093" },
	EPSG_9333: { towgs84: "0,0,0,-0.008393,0.000749,-0.010276,0" },
	EPSG_9059: { towgs84: "0,0,0" },
	EPSG_4312: { towgs84: "601.705,84.263,485.227,4.7354,1.3145,5.393,-2.3887" },
	EPSG_4123: { towgs84: "-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496" },
	EPSG_4309: { towgs84: "-124.45,183.74,44.64,-0.4384,0.5446,-0.9706,-2.1365" },
	ESRI_104106: { towgs84: "-283.088,-70.693,117.445,-1.157,0.059,-0.652,-4.058" },
	EPSG_4281: { towgs84: "-219.247,-73.802,269.529" },
	EPSG_4322: { towgs84: "0,0,4.5" },
	EPSG_4324: { towgs84: "0,0,1.9" },
	EPSG_4284: { towgs84: "43.822,-108.842,-119.585,1.455,-0.761,0.737,0.549" },
	EPSG_4277: { towgs84: "446.448,-125.157,542.06,0.15,0.247,0.842,-20.489" },
	EPSG_4207: { towgs84: "-282.1,-72.2,120,-1.529,0.145,-0.89,-4.46" },
	EPSG_4688: { towgs84: "347.175,1077.618,2623.677,33.9058,-70.6776,9.4013,186.0647" },
	EPSG_4689: { towgs84: "410.793,54.542,80.501,-2.5596,-2.3517,-0.6594,17.3218" },
	EPSG_4720: { towgs84: "0,0,4.5" },
	EPSG_4273: { towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21" },
	EPSG_4240: { towgs84: "204.64,834.74,293.8" },
	EPSG_4817: { towgs84: "278.3,93,474.5,7.889,0.05,-6.61,6.21" },
	ESRI_104131: { towgs84: "426.62,142.62,460.09,4.98,4.49,-12.42,-17.1" },
	EPSG_4265: { towgs84: "-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68" },
	EPSG_4263: { towgs84: "-111.92,-87.85,114.5,1.875,0.202,0.219,0.032" },
	EPSG_4298: { towgs84: "-689.5937,623.84046,-65.93566,-0.02331,1.17094,-0.80054,5.88536" },
	EPSG_4270: { towgs84: "-253.4392,-148.452,386.5267,0.15605,0.43,-0.1013,-0.0424" },
	EPSG_4229: { towgs84: "-121.8,98.1,-10.7" },
	EPSG_4220: { towgs84: "-55.5,-348,-229.2" },
	EPSG_4214: { towgs84: "12.646,-155.176,-80.863" },
	EPSG_4232: { towgs84: "-345,3,223" },
	EPSG_4238: { towgs84: "-1.977,-13.06,-9.993,0.364,0.254,0.689,-1.037" },
	EPSG_4168: { towgs84: "-170,33,326" },
	EPSG_4131: { towgs84: "199,931,318.9" },
	EPSG_4152: { towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0" },
	EPSG_5228: { towgs84: "572.213,85.334,461.94,4.9732,1.529,5.2484,3.5378" },
	EPSG_8351: { towgs84: "485.021,169.465,483.839,7.786342,4.397554,4.102655,0" },
	EPSG_4683: { towgs84: "-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06" },
	EPSG_4133: { towgs84: "0,0,0" },
	EPSG_7373: { towgs84: "0.819,-0.5762,-1.6446,-0.00378,-0.03317,0.00318,0.0693" },
	EPSG_9075: { towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0" },
	EPSG_9072: { towgs84: "-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0" },
	EPSG_9294: { towgs84: "1.16835,-1.42001,-2.24431,-0.00822,-0.05508,0.01818,0.23388" },
	EPSG_4212: { towgs84: "-267.434,173.496,181.814,-13.4704,8.7154,7.3926,14.7492" },
	EPSG_4191: { towgs84: "-44.183,-0.58,-38.489,2.3867,2.7072,-3.5196,-8.2703" },
	EPSG_4237: { towgs84: "52.684,-71.194,-13.975,-0.312,-0.1063,-0.3729,1.0191" },
	EPSG_4740: { towgs84: "-1.08,-0.27,-0.9" },
	EPSG_4124: { towgs84: "419.3836,99.3335,591.3451,0.850389,1.817277,-7.862238,-0.99496" },
	EPSG_5681: { towgs84: "584.9636,107.7175,413.8067,1.1155,0.2824,-3.1384,7.9922" },
	EPSG_4141: { towgs84: "23.772,17.49,17.859,-0.3132,-1.85274,1.67299,-5.4262" },
	EPSG_4204: { towgs84: "-85.645,-273.077,-79.708,2.289,-1.421,2.532,3.194" },
	EPSG_4319: { towgs84: "226.702,-193.337,-35.371,-2.229,-4.391,9.238,0.9798" },
	EPSG_4200: { towgs84: "24.82,-131.21,-82.66" },
	EPSG_4130: { towgs84: "0,0,0" },
	EPSG_4127: { towgs84: "-82.875,-57.097,-156.768,-2.158,1.524,-0.982,-0.359" },
	EPSG_4149: { towgs84: "674.374,15.056,405.346" },
	EPSG_4617: { towgs84: "-0.991,1.9072,0.5129,0.02579,0.00965,0.01166,0" },
	EPSG_4663: { towgs84: "-210.502,-66.902,-48.476,2.094,-15.067,-5.817,0.485" },
	EPSG_4664: { towgs84: "-211.939,137.626,58.3,-0.089,0.251,0.079,0.384" },
	EPSG_4665: { towgs84: "-105.854,165.589,-38.312,-0.003,-0.026,0.024,-0.048" },
	EPSG_4666: { towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43" },
	EPSG_4756: { towgs84: "-192.873,-39.382,-111.202,-0.00205,-0.0005,0.00335,0.0188" },
	EPSG_4723: { towgs84: "-179.483,-69.379,-27.584,-7.862,8.163,6.042,-13.925" },
	EPSG_4726: { towgs84: "8.853,-52.644,180.304,-0.393,-2.323,2.96,-24.081" },
	EPSG_4267: { towgs84: "-8.0,160.0,176.0" },
	EPSG_5365: { towgs84: "-0.16959,0.35312,0.51846,0.03385,-0.16325,0.03446,0.03693" },
	EPSG_4218: { towgs84: "304.5,306.5,-318.1" },
	EPSG_4242: { towgs84: "-33.722,153.789,94.959,-8.581,-4.478,4.54,8.95" },
	EPSG_4216: { towgs84: "-292.295,248.758,429.447,4.9971,2.99,6.6906,1.0289" },
	ESRI_104105: { towgs84: "631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43" },
	ESRI_104129: { towgs84: "0,0,0" },
	EPSG_4673: { towgs84: "174.05,-25.49,112.57" },
	EPSG_4202: { towgs84: "-124,-60,154" },
	EPSG_4203: { towgs84: "-117.763,-51.51,139.061,0.292,0.443,0.277,-0.191" },
	EPSG_3819: { towgs84: "595.48,121.69,515.35,4.115,-2.9383,0.853,-3.408" },
	EPSG_8694: { towgs84: "-93.799,-132.737,-219.073,-1.844,0.648,-6.37,-0.169" },
	EPSG_4145: { towgs84: "275.57,676.78,229.6" },
	EPSG_4283: { towgs84: "0.06155,-0.01087,-0.04019,0.039492,0.032722,0.032898,-0.009994" },
	EPSG_4317: { towgs84: "2.3287,-147.0425,-92.0802,-0.309248,0.324822,0.497299,5.689063" },
	EPSG_4272: { towgs84: "59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993" },
	EPSG_4248: { towgs84: "-307.7,265.3,-363.5" },
	EPSG_5561: { towgs84: "24,-121,-76" },
	EPSG_5233: { towgs84: "-0.293,766.95,87.713,0.195704,1.695068,3.473016,-0.039338" },
	ESRI_104130: { towgs84: "-86,-98,-119" },
	ESRI_104102: { towgs84: "682,-203,480" },
	ESRI_37207: { towgs84: "7,-10,-26" },
	EPSG_4675: { towgs84: "59.935,118.4,-10.871" },
	ESRI_104109: { towgs84: "-89.121,-348.182,260.871" },
	ESRI_104112: { towgs84: "-185.583,-230.096,281.361" },
	ESRI_104113: { towgs84: "25.1,-275.6,222.6" },
	IGNF_WGS72G: { towgs84: "0,12,6" },
	IGNF_NTFG: { towgs84: "-168,-60,320" },
	IGNF_EFATE57G: { towgs84: "-127,-769,472" },
	IGNF_PGP50G: { towgs84: "324.8,153.6,172.1" },
	IGNF_REUN47G: { towgs84: "94,-948,-1262" },
	IGNF_CSG67G: { towgs84: "-186,230,110" },
	IGNF_GUAD48G: { towgs84: "-467,-16,-300" },
	IGNF_TAHI51G: { towgs84: "162,117,154" },
	IGNF_TAHAAG: { towgs84: "65,342,77" },
	IGNF_NUKU72G: { towgs84: "84,274,65" },
	IGNF_PETRELS72G: { towgs84: "365,194,166" },
	IGNF_WALL78G: { towgs84: "253,-133,-127" },
	IGNF_MAYO50G: { towgs84: "-382,-59,-262" },
	IGNF_TANNAG: { towgs84: "-139,-967,436" },
	IGNF_IGN72G: { towgs84: "-13,-348,292" },
	IGNF_ATIGG: { towgs84: "1118,23,66" },
	IGNF_FANGA84G: { towgs84: "150.57,158.33,118.32" },
	IGNF_RUSAT84G: { towgs84: "202.13,174.6,-15.74" },
	IGNF_KAUE70G: { towgs84: "126.74,300.1,-75.49" },
	IGNF_MOP90G: { towgs84: "-10.8,-1.8,12.77" },
	IGNF_MHPF67G: { towgs84: "338.08,212.58,-296.17" },
	IGNF_TAHI79G: { towgs84: "160.61,116.05,153.69" },
	IGNF_ANAA92G: { towgs84: "1.5,3.84,4.81" },
	IGNF_MARQUI72G: { towgs84: "330.91,-13.92,58.56" },
	IGNF_APAT86G: { towgs84: "143.6,197.82,74.05" },
	IGNF_TUBU69G: { towgs84: "237.17,171.61,-77.84" },
	IGNF_STPM50G: { towgs84: "11.363,424.148,373.13" },
	EPSG_4150: { towgs84: "674.374,15.056,405.346" },
	EPSG_4754: { towgs84: "-208.4058,-109.8777,-2.5764" },
	ESRI_104101: { towgs84: "372.87,149.23,585.29" },
	EPSG_4693: { towgs84: "0,-0.15,0.68" },
	EPSG_6207: { towgs84: "293.17,726.18,245.36" },
	EPSG_4153: { towgs84: "-133.63,-157.5,-158.62" },
	EPSG_4132: { towgs84: "-241.54,-163.64,396.06" },
	EPSG_4221: { towgs84: "-154.5,150.7,100.4" },
	EPSG_4266: { towgs84: "-80.7,-132.5,41.1" },
	EPSG_4193: { towgs84: "-70.9,-151.8,-41.4" },
	EPSG_5340: { towgs84: "-0.41,0.46,-0.35" },
	EPSG_4246: { towgs84: "-294.7,-200.1,525.5" },
	EPSG_4318: { towgs84: "-3.2,-5.7,2.8" },
	EPSG_4121: { towgs84: "-199.87,74.79,246.62" },
	EPSG_4223: { towgs84: "-260.1,5.5,432.2" },
	EPSG_4158: { towgs84: "-0.465,372.095,171.736" },
	EPSG_4285: { towgs84: "-128.16,-282.42,21.93" },
	EPSG_4613: { towgs84: "-404.78,685.68,45.47" },
	EPSG_4607: { towgs84: "195.671,332.517,274.607" },
	EPSG_4475: { towgs84: "-381.788,-57.501,-256.673" },
	EPSG_4208: { towgs84: "-157.84,308.54,-146.6" },
	EPSG_4743: { towgs84: "70.995,-335.916,262.898" },
	EPSG_4710: { towgs84: "-323.65,551.39,-491.22" },
	EPSG_7881: { towgs84: "-0.077,0.079,0.086" },
	EPSG_4682: { towgs84: "283.729,735.942,261.143" },
	EPSG_4739: { towgs84: "-156,-271,-189" },
	EPSG_4679: { towgs84: "-80.01,253.26,291.19" },
	EPSG_4750: { towgs84: "-56.263,16.136,-22.856" },
	EPSG_4644: { towgs84: "-10.18,-350.43,291.37" },
	EPSG_4695: { towgs84: "-103.746,-9.614,-255.95" },
	EPSG_4292: { towgs84: "-355,21,72" },
	EPSG_4302: { towgs84: "-61.702,284.488,472.052" },
	EPSG_4143: { towgs84: "-124.76,53,466.79" },
	EPSG_4606: { towgs84: "-153,153,307" },
	EPSG_4699: { towgs84: "-770.1,158.4,-498.2" },
	EPSG_4247: { towgs84: "-273.5,110.6,-357.9" },
	EPSG_4160: { towgs84: "8.88,184.86,106.69" },
	EPSG_4161: { towgs84: "-233.43,6.65,173.64" },
	EPSG_9251: { towgs84: "-9.5,122.9,138.2" },
	EPSG_9253: { towgs84: "-78.1,101.6,133.3" },
	EPSG_4297: { towgs84: "-198.383,-240.517,-107.909" },
	EPSG_4269: { towgs84: "0,0,0" },
	EPSG_4301: { towgs84: "-147,506,687" },
	EPSG_4618: { towgs84: "-59,-11,-52" },
	EPSG_4612: { towgs84: "0,0,0" },
	EPSG_4678: { towgs84: "44.585,-131.212,-39.544" },
	EPSG_4250: { towgs84: "-130,29,364" },
	EPSG_4144: { towgs84: "214,804,268" },
	EPSG_4147: { towgs84: "-17.51,-108.32,-62.39" },
	EPSG_4259: { towgs84: "-254.1,-5.36,-100.29" },
	EPSG_4164: { towgs84: "-76,-138,67" },
	EPSG_4211: { towgs84: "-378.873,676.002,-46.255" },
	EPSG_4182: { towgs84: "-422.651,-172.995,84.02" },
	EPSG_4224: { towgs84: "-143.87,243.37,-33.52" },
	EPSG_4225: { towgs84: "-205.57,168.77,-4.12" },
	EPSG_5527: { towgs84: "-67.35,3.88,-38.22" },
	EPSG_4752: { towgs84: "98,390,-22" },
	EPSG_4310: { towgs84: "-30,190,89" },
	EPSG_9248: { towgs84: "-192.26,65.72,132.08" },
	EPSG_4680: { towgs84: "124.5,-63.5,-281" },
	EPSG_4701: { towgs84: "-79.9,-158,-168.9" },
	EPSG_4706: { towgs84: "-146.21,112.63,4.05" },
	EPSG_4805: { towgs84: "682,-203,480" },
	EPSG_4201: { towgs84: "-165,-11,206" },
	EPSG_4210: { towgs84: "-157,-2,-299" },
	EPSG_4183: { towgs84: "-104,167,-38" },
	EPSG_4139: { towgs84: "11,72,-101" },
	EPSG_4668: { towgs84: "-86,-98,-119" },
	EPSG_4717: { towgs84: "-2,151,181" },
	EPSG_4732: { towgs84: "102,52,-38" },
	EPSG_4280: { towgs84: "-377,681,-50" },
	EPSG_4209: { towgs84: "-138,-105,-289" },
	EPSG_4261: { towgs84: "31,146,47" },
	EPSG_4658: { towgs84: "-73,46,-86" },
	EPSG_4721: { towgs84: "265.025,384.929,-194.046" },
	EPSG_4222: { towgs84: "-136,-108,-292" },
	EPSG_4601: { towgs84: "-255,-15,71" },
	EPSG_4602: { towgs84: "725,685,536" },
	EPSG_4603: { towgs84: "72,213.7,93" },
	EPSG_4605: { towgs84: "9,183,236" },
	EPSG_4621: { towgs84: "137,248,-430" },
	EPSG_4657: { towgs84: "-28,199,5" },
	EPSG_4316: { towgs84: "103.25,-100.4,-307.19" },
	EPSG_4642: { towgs84: "-13,-348,292" },
	EPSG_4698: { towgs84: "145,-187,103" },
	EPSG_4192: { towgs84: "-206.1,-174.7,-87.7" },
	EPSG_4311: { towgs84: "-265,120,-358" },
	EPSG_4135: { towgs84: "58,-283,-182" },
	ESRI_104138: { towgs84: "198,-226,-347" },
	EPSG_4245: { towgs84: "-11,851,5" },
	EPSG_4142: { towgs84: "-125,53,467" },
	EPSG_4213: { towgs84: "-106,-87,188" },
	EPSG_4253: { towgs84: "-133,-77,-51" },
	EPSG_4129: { towgs84: "-132,-110,-335" },
	EPSG_4713: { towgs84: "-77,-128,142" },
	EPSG_4239: { towgs84: "217,823,299" },
	EPSG_4146: { towgs84: "295,736,257" },
	EPSG_4155: { towgs84: "-83,37,124" },
	EPSG_4165: { towgs84: "-173,253,27" },
	EPSG_4672: { towgs84: "175,-38,113" },
	EPSG_4236: { towgs84: "-637,-549,-203" },
	EPSG_4251: { towgs84: "-90,40,88" },
	EPSG_4271: { towgs84: "-2,374,172" },
	EPSG_4175: { towgs84: "-88,4,101" },
	EPSG_4716: { towgs84: "298,-304,-375" },
	EPSG_4315: { towgs84: "-23,259,-9" },
	EPSG_4744: { towgs84: "-242.2,-144.9,370.3" },
	EPSG_4244: { towgs84: "-97,787,86" },
	EPSG_4293: { towgs84: "616,97,-251" },
	EPSG_4714: { towgs84: "-127,-769,472" },
	EPSG_4736: { towgs84: "260,12,-147" },
	EPSG_6883: { towgs84: "-235,-110,393" },
	EPSG_6894: { towgs84: "-63,176,185" },
	EPSG_4205: { towgs84: "-43,-163,45" },
	EPSG_4256: { towgs84: "41,-220,-134" },
	EPSG_4262: { towgs84: "639,405,60" },
	EPSG_4604: { towgs84: "174,359,365" },
	EPSG_4169: { towgs84: "-115,118,426" },
	EPSG_4620: { towgs84: "-106,-129,165" },
	EPSG_4184: { towgs84: "-203,141,53" },
	EPSG_4616: { towgs84: "-289,-124,60" },
	EPSG_9403: { towgs84: "-307,-92,127" },
	EPSG_4684: { towgs84: "-133,-321,50" },
	EPSG_4708: { towgs84: "-491,-22,435" },
	EPSG_4707: { towgs84: "114,-116,-333" },
	EPSG_4709: { towgs84: "145,75,-272" },
	EPSG_4712: { towgs84: "-205,107,53" },
	EPSG_4711: { towgs84: "124,-234,-25" },
	EPSG_4718: { towgs84: "230,-199,-752" },
	EPSG_4719: { towgs84: "211,147,111" },
	EPSG_4724: { towgs84: "208,-435,-229" },
	EPSG_4725: { towgs84: "189,-79,-202" },
	EPSG_4735: { towgs84: "647,1777,-1124" },
	EPSG_4722: { towgs84: "-794,119,-298" },
	EPSG_4728: { towgs84: "-307,-92,127" },
	EPSG_4734: { towgs84: "-632,438,-609" },
	EPSG_4727: { towgs84: "912,-58,1227" },
	EPSG_4729: { towgs84: "185,165,42" },
	EPSG_4730: { towgs84: "170,42,84" },
	EPSG_4733: { towgs84: "276,-57,149" },
	ESRI_37218: { towgs84: "230,-199,-752" },
	ESRI_37240: { towgs84: "-7,215,225" },
	ESRI_37221: { towgs84: "252,-209,-751" },
	ESRI_4305: { towgs84: "-123,-206,219" },
	ESRI_104139: { towgs84: "-73,-247,227" },
	EPSG_4748: { towgs84: "51,391,-36" },
	EPSG_4219: { towgs84: "-384,664,-48" },
	EPSG_4255: { towgs84: "-333,-222,114" },
	EPSG_4257: { towgs84: "-587.8,519.75,145.76" },
	EPSG_4646: { towgs84: "-963,510,-359" },
	EPSG_6881: { towgs84: "-24,-203,268" },
	EPSG_6882: { towgs84: "-183,-15,273" },
	EPSG_4715: { towgs84: "-104,-129,239" },
	IGNF_RGF93GDD: { towgs84: "0,0,0" },
	IGNF_RGM04GDD: { towgs84: "0,0,0" },
	IGNF_RGSPM06GDD: { towgs84: "0,0,0" },
	IGNF_RGTAAF07GDD: { towgs84: "0,0,0" },
	IGNF_RGFG95GDD: { towgs84: "0,0,0" },
	IGNF_RGNCG: { towgs84: "0,0,0" },
	IGNF_RGPFGDD: { towgs84: "0,0,0" },
	IGNF_ETRS89G: { towgs84: "0,0,0" },
	IGNF_RGR92GDD: { towgs84: "0,0,0" },
	EPSG_4173: { towgs84: "0,0,0" },
	EPSG_4180: { towgs84: "0,0,0" },
	EPSG_4619: { towgs84: "0,0,0" },
	EPSG_4667: { towgs84: "0,0,0" },
	EPSG_4075: { towgs84: "0,0,0" },
	EPSG_6706: { towgs84: "0,0,0" },
	EPSG_7798: { towgs84: "0,0,0" },
	EPSG_4661: { towgs84: "0,0,0" },
	EPSG_4669: { towgs84: "0,0,0" },
	EPSG_8685: { towgs84: "0,0,0" },
	EPSG_4151: { towgs84: "0,0,0" },
	EPSG_9702: { towgs84: "0,0,0" },
	EPSG_4758: { towgs84: "0,0,0" },
	EPSG_4761: { towgs84: "0,0,0" },
	EPSG_4765: { towgs84: "0,0,0" },
	EPSG_8997: { towgs84: "0,0,0" },
	EPSG_4023: { towgs84: "0,0,0" },
	EPSG_4670: { towgs84: "0,0,0" },
	EPSG_4694: { towgs84: "0,0,0" },
	EPSG_4148: { towgs84: "0,0,0" },
	EPSG_4163: { towgs84: "0,0,0" },
	EPSG_4167: { towgs84: "0,0,0" },
	EPSG_4189: { towgs84: "0,0,0" },
	EPSG_4190: { towgs84: "0,0,0" },
	EPSG_4176: { towgs84: "0,0,0" },
	EPSG_4659: { towgs84: "0,0,0" },
	EPSG_3824: { towgs84: "0,0,0" },
	EPSG_3889: { towgs84: "0,0,0" },
	EPSG_4046: { towgs84: "0,0,0" },
	EPSG_4081: { towgs84: "0,0,0" },
	EPSG_4558: { towgs84: "0,0,0" },
	EPSG_4483: { towgs84: "0,0,0" },
	EPSG_5013: { towgs84: "0,0,0" },
	EPSG_5264: { towgs84: "0,0,0" },
	EPSG_5324: { towgs84: "0,0,0" },
	EPSG_5354: { towgs84: "0,0,0" },
	EPSG_5371: { towgs84: "0,0,0" },
	EPSG_5373: { towgs84: "0,0,0" },
	EPSG_5381: { towgs84: "0,0,0" },
	EPSG_5393: { towgs84: "0,0,0" },
	EPSG_5489: { towgs84: "0,0,0" },
	EPSG_5593: { towgs84: "0,0,0" },
	EPSG_6135: { towgs84: "0,0,0" },
	EPSG_6365: { towgs84: "0,0,0" },
	EPSG_5246: { towgs84: "0,0,0" },
	EPSG_7886: { towgs84: "0,0,0" },
	EPSG_8431: { towgs84: "0,0,0" },
	EPSG_8427: { towgs84: "0,0,0" },
	EPSG_8699: { towgs84: "0,0,0" },
	EPSG_8818: { towgs84: "0,0,0" },
	EPSG_4757: { towgs84: "0,0,0" },
	EPSG_9140: { towgs84: "0,0,0" },
	EPSG_8086: { towgs84: "0,0,0" },
	EPSG_4686: { towgs84: "0,0,0" },
	EPSG_4737: { towgs84: "0,0,0" },
	EPSG_4702: { towgs84: "0,0,0" },
	EPSG_4747: { towgs84: "0,0,0" },
	EPSG_4749: { towgs84: "0,0,0" },
	EPSG_4674: { towgs84: "0,0,0" },
	EPSG_4755: { towgs84: "0,0,0" },
	EPSG_4759: { towgs84: "0,0,0" },
	EPSG_4762: { towgs84: "0,0,0" },
	EPSG_4763: { towgs84: "0,0,0" },
	EPSG_4764: { towgs84: "0,0,0" },
	EPSG_4166: { towgs84: "0,0,0" },
	EPSG_4170: { towgs84: "0,0,0" },
	EPSG_5546: { towgs84: "0,0,0" },
	EPSG_7844: { towgs84: "0,0,0" },
	EPSG_4818: { towgs84: "589,76,480" },
	EPSG_10328: { towgs84: "0,0,0" },
	EPSG_9782: { towgs84: "0,0,0" },
	EPSG_9777: { towgs84: "0,0,0" },
	EPSG_10690: { towgs84: "0,0,0" },
	EPSG_10639: { towgs84: "0,0,0" },
	EPSG_10739: { towgs84: "0,0,0" },
	EPSG_7686: { towgs84: "0,0,0" },
	EPSG_8900: { towgs84: "0,0,0" },
	EPSG_5886: { towgs84: "0,0,0" },
	EPSG_7683: { towgs84: "0,0,0" },
	EPSG_6668: { towgs84: "0,0,0" },
	EPSG_20046: { towgs84: "0,0,0" },
	EPSG_10299: { towgs84: "0,0,0" },
	EPSG_10310: { towgs84: "0,0,0" },
	EPSG_10475: { towgs84: "0,0,0" },
	EPSG_4742: { towgs84: "0,0,0" },
	EPSG_10671: { towgs84: "0,0,0" },
	EPSG_10762: { towgs84: "0,0,0" },
	EPSG_10725: { towgs84: "0,0,0" },
	EPSG_10791: { towgs84: "0,0,0" },
	EPSG_10800: { towgs84: "0,0,0" },
	EPSG_10305: { towgs84: "0,0,0" },
	EPSG_10941: { towgs84: "0,0,0" },
	EPSG_10968: { towgs84: "0,0,0" },
	EPSG_10875: { towgs84: "0,0,0" },
	EPSG_6318: { towgs84: "0,0,0" },
	EPSG_10910: { towgs84: "0,0,0" }
};
for (var U in qe) {
	var Je = qe[U];
	Je.datumName && (qe[Je.datumName] = Je);
}
//#endregion
//#region node_modules/proj4/lib/datum.js
function Ye(e, t, n, r, i, a, s) {
	var c = {};
	return c.datum_type = 5, t && (c.datum_type = 4, c.datum_params = t.map(parseFloat), (c.datum_params[0] !== 0 || c.datum_params[1] !== 0 || c.datum_params[2] !== 0) && (c.datum_type = 1), c.datum_params.length > 3 && (c.datum_params[3] !== 0 || c.datum_params[4] !== 0 || c.datum_params[5] !== 0 || c.datum_params[6] !== 0) && (c.datum_type = 2, c.datum_params[3] *= o, c.datum_params[4] *= o, c.datum_params[5] *= o, c.datum_params[6] = c.datum_params[6] / 1e6 + 1)), s && (c.datum_type = 3, c.grids = s), c.a = n, c.b = r, c.es = i, c.ep2 = a, c;
}
//#endregion
//#region node_modules/proj4/lib/nadgrid.js
var Xe = {};
function Ze(e, t, n) {
	return t instanceof ArrayBuffer ? Qe(e, t, n) : { ready: $e(e, t) };
}
function Qe(e, t, n) {
	var r = !0;
	n !== void 0 && n.includeErrorFields === !1 && (r = !1);
	var i = new DataView(t), a = it(i), o = at(i, a), s = {
		header: o,
		subgrids: st(i, o, a, r)
	};
	return Xe[e] = s, s;
}
async function $e(e, t) {
	for (var n = [], r = await t.getImageCount(), i = r - 1; i >= 0; i--) {
		var a = await t.getImage(i), o = await a.readRasters(), s = [a.getWidth(), a.getHeight()], c = a.getBoundingBox().map(nt), l = typeof a.fileDirectory.getValue == "function" ? a.fileDirectory.getValue("ModelPixelScale") : a.fileDirectory.ModelPixelScale, u = [l[0], l[1]].map(nt), d = c[0] + (s[0] - 1) * u[0], f = c[3] - (s[1] - 1) * u[1], p = o[0], m = o[1], h = [];
		for (let e = s[1] - 1; e >= 0; e--) for (let t = s[0] - 1; t >= 0; t--) {
			var g = e * s[0] + t;
			h.push([-rt(m[g]), rt(p[g])]);
		}
		n.push({
			del: u,
			lim: s,
			ll: [-d, f],
			cvs: h
		});
	}
	var _ = {
		header: { nSubgrids: r },
		subgrids: n
	};
	return Xe[e] = _, _;
}
function et(e) {
	return e === void 0 ? null : e.split(",").map(tt);
}
function tt(e) {
	if (e.length === 0) return null;
	var t = e[0] === "@";
	return t && (e = e.slice(1)), e === "null" ? {
		name: "null",
		mandatory: !t,
		grid: null,
		isNull: !0
	} : {
		name: e,
		mandatory: !t,
		grid: Xe[e] || null,
		isNull: !1
	};
}
function nt(e) {
	return e * Math.PI / 180;
}
function rt(e) {
	return e / 3600 * Math.PI / 180;
}
function it(e) {
	var t = e.getInt32(8, !1);
	return t === 11 ? !1 : (t = e.getInt32(8, !0), t !== 11 && console.warn("Failed to detect nadgrid endian-ness, defaulting to little-endian"), !0);
}
function at(e, t) {
	return {
		nFields: e.getInt32(8, t),
		nSubgridFields: e.getInt32(24, t),
		nSubgrids: e.getInt32(40, t),
		shiftType: ot(e, 56, 64).trim(),
		fromSemiMajorAxis: e.getFloat64(120, t),
		fromSemiMinorAxis: e.getFloat64(136, t),
		toSemiMajorAxis: e.getFloat64(152, t),
		toSemiMinorAxis: e.getFloat64(168, t)
	};
}
function ot(e, t, n) {
	return String.fromCharCode.apply(null, new Uint8Array(e.buffer.slice(t, n)));
}
function st(e, t, n, r) {
	for (var i = 176, a = [], o = 0; o < t.nSubgrids; o++) {
		var s = lt(e, i, n), c = ut(e, i, s, n, r), l = Math.round(1 + (s.upperLongitude - s.lowerLongitude) / s.longitudeInterval), u = Math.round(1 + (s.upperLatitude - s.lowerLatitude) / s.latitudeInterval);
		a.push({
			ll: [rt(s.lowerLongitude), rt(s.lowerLatitude)],
			del: [rt(s.longitudeInterval), rt(s.latitudeInterval)],
			lim: [l, u],
			count: s.gridNodeCount,
			cvs: ct(c)
		});
		var d = 16;
		r === !1 && (d = 8), i += 176 + s.gridNodeCount * d;
	}
	return a;
}
function ct(e) {
	return e.map(function(e) {
		return [rt(e.longitudeShift), rt(e.latitudeShift)];
	});
}
function lt(e, t, n) {
	return {
		name: ot(e, t + 8, t + 16).trim(),
		parent: ot(e, t + 24, t + 24 + 8).trim(),
		lowerLatitude: e.getFloat64(t + 72, n),
		upperLatitude: e.getFloat64(t + 88, n),
		lowerLongitude: e.getFloat64(t + 104, n),
		upperLongitude: e.getFloat64(t + 120, n),
		latitudeInterval: e.getFloat64(t + 136, n),
		longitudeInterval: e.getFloat64(t + 152, n),
		gridNodeCount: e.getInt32(t + 168, n)
	};
}
function ut(e, t, n, r, i) {
	var a = t + 176, o = 16;
	i === !1 && (o = 8);
	for (var s = [], c = 0; c < n.gridNodeCount; c++) {
		var l = {
			latitudeShift: e.getFloat32(a + c * o, r),
			longitudeShift: e.getFloat32(a + c * o + 4, r)
		};
		i !== !1 && (l.latitudeAccuracy = e.getFloat32(a + c * o + 8, r), l.longitudeAccuracy = e.getFloat32(a + c * o + 12, r)), s.push(l);
	}
	return s;
}
//#endregion
//#region node_modules/proj4/lib/Proj.js
function W(e, t) {
	if (!(this instanceof W)) return new W(e);
	this.forward = null, this.inverse = null, this.init = null, this.name, this.axis, this.names = null, this.title, t ||= function(e) {
		if (e) throw e;
	};
	var n = Ee(e);
	if (typeof n != "object") {
		t("Could not parse to valid json: " + e);
		return;
	}
	var r = W.projections.get(n.projName);
	if (!r) {
		t("Could not get projection name from: " + e);
		return;
	}
	if (n.datumCode && n.datumCode !== "none") {
		var i = b(qe, n.datumCode);
		i && (n.datum_params = n.datum_params || (i.towgs84 ? i.towgs84.split(",") : null), n.ellps = i.ellipse, n.datumName = i.datumName ? i.datumName : n.datumCode);
	}
	n.k0 = n.k0 || 1, n.axis = n.axis || "enu", n.ellps = n.ellps || "wgs84", n.lat1 = n.lat1 || n.lat0;
	var a = Ke(n.a, n.b, n.rf, n.ellps, n.sphere), o = Ge(a.a, a.b, a.rf, n.R_A), s = et(n.nadgrids), c = n.datum || Ye(n.datumCode, n.datum_params, a.a, a.b, o.es, o.ep2, s);
	R(this, n), R(this, r), this.a = a.a, this.b = a.b, this.rf = a.rf, this.sphere = a.sphere, this.es = o.es, this.e = o.e, this.ep2 = o.ep2, this.datum = c, "init" in this && typeof this.init == "function" && this.init(), t(null, this);
}
W.projections = He, W.projections.start();
//#endregion
//#region node_modules/proj4/lib/datumUtils.js
function dt(e, t) {
	return e.datum_type === t.datum_type ? e.a !== t.a || Math.abs(e.es - t.es) > 5e-11 ? !1 : e.datum_type === 1 ? e.datum_params[0] === t.datum_params[0] && e.datum_params[1] === t.datum_params[1] && e.datum_params[2] === t.datum_params[2] : e.datum_type !== 2 || e.datum_params[0] === t.datum_params[0] && e.datum_params[1] === t.datum_params[1] && e.datum_params[2] === t.datum_params[2] && e.datum_params[3] === t.datum_params[3] && e.datum_params[4] === t.datum_params[4] && e.datum_params[5] === t.datum_params[5] && e.datum_params[6] === t.datum_params[6] : !1;
}
function ft(e, t, n) {
	var r = e.x, i = e.y, a = e.z ? e.z : 0, o, c, l, u;
	if (i < -s && i > -1.001 * s) i = -s;
	else if (i > s && i < 1.001 * s) i = s;
	else if (i < -s) return {
		x: -Infinity,
		y: -Infinity,
		z: e.z
	};
	else if (i > s) return {
		x: Infinity,
		y: Infinity,
		z: e.z
	};
	return r > Math.PI && (r -= 2 * Math.PI), c = Math.sin(i), u = Math.cos(i), l = c * c, o = n / Math.sqrt(1 - t * l), {
		x: (o + a) * u * Math.cos(r),
		y: (o + a) * u * Math.sin(r),
		z: (o * (1 - t) + a) * c
	};
}
function pt(e, t, n, r) {
	var i = 1e-12, a = i * i, o = 30, c, l, u, d, f, p, m, h, g, _, v, y, b, x = e.x, S = e.y, C = e.z ? e.z : 0, w, T, E;
	if (c = Math.sqrt(x * x + S * S), l = Math.sqrt(x * x + S * S + C * C), c / n < i) {
		if (w = 0, l / n < i) return T = s, E = -r, {
			x: e.x,
			y: e.y,
			z: e.z
		};
	} else w = Math.atan2(S, x);
	u = C / l, d = c / l, f = 1 / Math.sqrt(1 - t * (2 - t) * d * d), h = d * (1 - t) * f, g = u * f, b = 0;
	do
		b++, m = n / Math.sqrt(1 - t * g * g), E = c * h + C * g - m * (1 - t * g * g), p = t * m / (m + E), f = 1 / Math.sqrt(1 - p * (2 - p) * d * d), _ = d * (1 - p) * f, v = u * f, y = v * h - _ * g, h = _, g = v;
	while (y * y > a && b < o);
	return T = Math.atan(v / Math.abs(_)), {
		x: w,
		y: T,
		z: E
	};
}
function mt(e, t, n) {
	if (t === 1) return {
		x: e.x + n[0],
		y: e.y + n[1],
		z: e.z + n[2]
	};
	if (t === 2) {
		var r = n[0], i = n[1], a = n[2], o = n[3], s = n[4], c = n[5], l = n[6];
		return {
			x: l * (e.x - c * e.y + s * e.z) + r,
			y: l * (c * e.x + e.y - o * e.z) + i,
			z: l * (-s * e.x + o * e.y + e.z) + a
		};
	}
}
function ht(e, t, n) {
	if (t === 1) return {
		x: e.x - n[0],
		y: e.y - n[1],
		z: e.z - n[2]
	};
	if (t === 2) {
		var r = n[0], i = n[1], a = n[2], o = n[3], s = n[4], c = n[5], l = n[6], u = (e.x - r) / l, d = (e.y - i) / l, f = (e.z - a) / l;
		return {
			x: u + c * d - s * f,
			y: -c * u + d + o * f,
			z: s * u - o * d + f
		};
	}
}
//#endregion
//#region node_modules/proj4/lib/datum_transform.js
function gt(e) {
	return e === 1 || e === 2;
}
function _t(e, t, n) {
	if (dt(e, t) || e.datum_type === 5 || t.datum_type === 5) return n;
	var o = e.a, s = e.es;
	if (e.datum_type === 3) {
		if (vt(e, !1, n) !== 0) return;
		o = r, s = a;
	}
	var c = t.a, l = t.b, u = t.es;
	if (t.datum_type === 3 && (c = r, l = i, u = a), s === u && o === c && !gt(e.datum_type) && !gt(t.datum_type) || (n = ft(n, s, o), gt(e.datum_type) && (n = mt(n, e.datum_type, e.datum_params)), gt(t.datum_type) && (n = ht(n, t.datum_type, t.datum_params)), n = pt(n, u, c, l), !(t.datum_type === 3 && vt(t, !0, n) !== 0))) return n;
}
function vt(e, t, n) {
	if (e.grids === null || e.grids.length === 0) return console.log("Grid shift grids not found"), -1;
	var r = {
		x: -n.x,
		y: n.y
	}, i = {
		x: NaN,
		y: NaN
	}, a = [];
	outer: for (var o = 0; o < e.grids.length; o++) {
		var s = e.grids[o];
		if (a.push(s.name), s.isNull) {
			i = r;
			break;
		}
		if (s.grid === null) {
			if (s.mandatory) return console.log("Unable to find mandatory grid '" + s.name + "'"), -1;
			continue;
		}
		for (var c = s.grid.subgrids, l = 0, u = c.length; l < u; l++) {
			var d = c[l], f = (Math.abs(d.del[1]) + Math.abs(d.del[0])) / 1e4, m = d.ll[0] - f, h = d.ll[1] - f, g = d.ll[0] + (d.lim[0] - 1) * d.del[0] + f, _ = d.ll[1] + (d.lim[1] - 1) * d.del[1] + f;
			if (!(h > r.y || m > r.x || _ < r.y || g < r.x) && (i = yt(r, t, d), !isNaN(i.x))) break outer;
		}
	}
	return isNaN(i.x) ? (console.log("Failed to find a grid shift table for location '" + -r.x * p + " " + r.y * p + " tried: '" + a + "'"), -1) : (n.x = -i.x, n.y = i.y, 0);
}
function yt(e, t, n) {
	var r = {
		x: NaN,
		y: NaN
	};
	if (isNaN(e.x)) return r;
	var i = {
		x: e.x,
		y: e.y
	};
	i.x -= n.ll[0], i.y -= n.ll[1], i.x = B(i.x - Math.PI) + Math.PI;
	var a = bt(i, n);
	if (t) {
		if (isNaN(a.x)) return r;
		a.x = i.x - a.x, a.y = i.y - a.y;
		var o = 9, s = 1e-12, c, l;
		do {
			if (l = bt(a, n), isNaN(l.x)) {
				console.log("Inverse grid shift iteration failed, presumably at grid edge.  Using first approximation.");
				break;
			}
			c = {
				x: i.x - (l.x + a.x),
				y: i.y - (l.y + a.y)
			}, a.x += c.x, a.y += c.y;
		} while (o-- && Math.abs(c.x) > s && Math.abs(c.y) > s);
		if (o < 0) return console.log("Inverse grid shift iterator failed to converge."), r;
		r.x = B(a.x + n.ll[0]), r.y = a.y + n.ll[1];
	} else isNaN(a.x) || (r.x = e.x + a.x, r.y = e.y + a.y);
	return r;
}
function bt(e, t) {
	var n = {
		x: e.x / t.del[0],
		y: e.y / t.del[1]
	}, r = {
		x: Math.floor(n.x),
		y: Math.floor(n.y)
	}, i = {
		x: n.x - 1 * r.x,
		y: n.y - 1 * r.y
	}, a = {
		x: NaN,
		y: NaN
	}, o;
	if (r.x < 0 || r.x >= t.lim[0] || r.y < 0 || r.y >= t.lim[1]) return a;
	o = r.y * t.lim[0] + r.x;
	var s = {
		x: t.cvs[o][0],
		y: t.cvs[o][1]
	};
	o++;
	var c = {
		x: t.cvs[o][0],
		y: t.cvs[o][1]
	};
	o += t.lim[0];
	var l = {
		x: t.cvs[o][0],
		y: t.cvs[o][1]
	};
	o--;
	var u = {
		x: t.cvs[o][0],
		y: t.cvs[o][1]
	}, d = i.x * i.y, f = i.x * (1 - i.y), p = (1 - i.x) * (1 - i.y), m = (1 - i.x) * i.y;
	return a.x = p * s.x + f * c.x + m * u.x + d * l.x, a.y = p * s.y + f * c.y + m * u.y + d * l.y, a;
}
//#endregion
//#region node_modules/proj4/lib/adjust_axis.js
var xt = [
	"x",
	"y",
	"z"
];
function St(e, t) {
	let n = {};
	for (let r = 0, i = e.axis.length; r < i; r++) {
		if (r === 2 && t.z === void 0) continue;
		let i = t[xt[r]];
		switch (e.axis[r]) {
			case "e":
				n.x = i;
				break;
			case "w":
				n.x = -i;
				break;
			case "n":
				n.y = i;
				break;
			case "s":
				n.y = -i;
				break;
			case "u":
				n.z = i;
				break;
			case "d":
				n.z = -i;
				break;
			default: return null;
		}
	}
	return n;
}
function Ct(e, t) {
	let n = {};
	for (let r = 0, i = e.axis.length; r < i; r++) if (!(r === 2 && t.z === void 0)) switch (e.axis[r]) {
		case "e":
			n[xt[r]] = t.x;
			break;
		case "w":
			n[xt[r]] = -t.x;
			break;
		case "n":
			n[xt[r]] = t.y;
			break;
		case "s":
			n[xt[r]] = -t.y;
			break;
		case "u":
			n[xt[r]] = t.z;
			break;
		case "d":
			n[xt[r]] = -t.z;
			break;
		default: return null;
	}
	return n;
}
//#endregion
//#region node_modules/proj4/lib/common/toPoint.js
function wt(e) {
	var t = {
		x: e[0],
		y: e[1]
	};
	return e.length > 2 && (t.z = e[2]), e.length > 3 && (t.m = e[3]), t;
}
//#endregion
//#region node_modules/proj4/lib/checkSanity.js
function Tt(e) {
	Et(e.x), Et(e.y);
}
function Et(e) {
	if (typeof Number.isFinite == "function") {
		if (Number.isFinite(e)) return;
		throw TypeError("coordinates must be finite numbers");
	}
	if (typeof e != "number" || e !== e || !isFinite(e)) throw TypeError("coordinates must be finite numbers");
}
//#endregion
//#region node_modules/proj4/lib/transform.js
function Dt(e, t) {
	return (e.datum.datum_type === 1 || e.datum.datum_type === 2 || e.datum.datum_type === 3) && t.datumCode !== "WGS84" || (t.datum.datum_type === 1 || t.datum.datum_type === 2 || t.datum.datum_type === 3) && e.datumCode !== "WGS84";
}
function Ot(e, t, n, r) {
	var i, a = n.z !== void 0;
	if (Tt(n), e.datum && t.datum && Dt(e, t) && (i = new W("WGS84"), n = Ot(e, i, n, r), e = i), r && e.axis !== "enu" && (n = St(e, n)), e.projName === "longlat") n = {
		x: n.x * f,
		y: n.y * f,
		z: n.z || 0
	};
	else if (e.to_meter && (n = {
		x: n.x * e.to_meter,
		y: n.y * e.to_meter,
		z: n.z || 0
	}), n = e.inverse(n), !n) return;
	if (e.from_greenwich && (n.x += e.from_greenwich), n = _t(e.datum, t.datum, n), n) return n = n, t.from_greenwich && (n = {
		x: n.x - t.from_greenwich,
		y: n.y,
		z: n.z || 0
	}), t.projName === "longlat" ? n = {
		x: n.x * p,
		y: n.y * p,
		z: n.z || 0
	} : (n = t.forward(n), t.to_meter && (n = {
		x: n.x / t.to_meter,
		y: n.y / t.to_meter,
		z: n.z || 0
	})), r && t.axis !== "enu" ? Ct(t, n) : (n && !a && t.projName !== "geocent" && delete n.z, n);
}
function kt(e, t, n, r) {
	return Ot(e, t, Array.isArray(n) ? wt(n) : {
		x: n.x,
		y: n.y,
		z: n.z,
		m: n.m
	}, r);
}
//#endregion
//#region node_modules/proj4/lib/core.js
var At = W("WGS84");
function jt(e, t, n, r) {
	var i, a, o;
	return Array.isArray(n) ? (i = Ot(e, t, wt(n), r) || {
		x: NaN,
		y: NaN
	}, n.length > 2 ? (a = e.name !== void 0 && e.name === "geocent" || t.name !== void 0 && t.name === "geocent", a ? typeof i.z == "number" ? [
		i.x,
		i.y,
		i.z
	].concat(n.slice(3)) : [
		i.x,
		i.y,
		n[2]
	].concat(n.slice(3)) : r && typeof i.z == "number" ? [
		i.x,
		i.y,
		i.z
	].concat(n.slice(3)) : [i.x, i.y].concat(n.slice(2))) : [i.x, i.y]) : (i = Ot(e, t, {
		x: n.x,
		y: n.y,
		z: n.z,
		m: n.m
	}, r) || {
		x: NaN,
		y: NaN
	}, o = Object.keys(n), o.length === 2 ? i : (a = e.name !== void 0 && e.name === "geocent" || t.name !== void 0 && t.name === "geocent", o.forEach(function(e) {
		e === "x" || e === "y" || e === "z" && (a || r) || (i[e] = n[e]);
	}), i));
}
function Mt(e) {
	return e instanceof W ? e : typeof e == "object" && "oProj" in e ? e.oProj : W(e);
}
function Nt(e, t, n) {
	var r, i, a = !1, o;
	return t === void 0 ? (i = Mt(e), r = At, a = !0) : (t.x !== void 0 || Array.isArray(t)) && (n = t, i = Mt(e), r = At, a = !0), r ||= Mt(e), i ||= Mt(t), n ? jt(r, i, n) : (o = {
		forward: function(e, t) {
			return jt(r, i, e, t);
		},
		inverse: function(e, t) {
			return jt(i, r, e, t);
		}
	}, a && (o.oProj = i), o);
}
//#endregion
//#region node_modules/mgrs/mgrs.js
var Pt = 6, Ft = "AJSAJS", It = "AFAFAF", Lt = 65, G = 73, K = 79, Rt = 86, zt = 90, Bt = {
	forward: Vt,
	inverse: Ht,
	toPoint: Ut
};
function Vt(e, t) {
	return t ||= 5, Yt(Kt({
		lat: e[1],
		lon: e[0]
	}), t);
}
function Ht(e) {
	var t = qt($t(e.toUpperCase()));
	return t.lat && t.lon ? [
		t.lon,
		t.lat,
		t.lon,
		t.lat
	] : [
		t.left,
		t.bottom,
		t.right,
		t.top
	];
}
function Ut(e) {
	var t = qt($t(e.toUpperCase()));
	return t.lat && t.lon ? [t.lon, t.lat] : [(t.left + t.right) / 2, (t.top + t.bottom) / 2];
}
function Wt(e) {
	return Math.PI / 180 * e;
}
function Gt(e) {
	return e / Math.PI * 180;
}
function Kt(e) {
	var t = e.lat, n = e.lon, r = 6378137, i = .00669438, a = .9996, o, s, c, l, u, d, f, p = Wt(t), m = Wt(n), h, g = Math.floor((n + 180) / 6) + 1;
	n === 180 && (g = 60), t >= 56 && t < 64 && n >= 3 && n < 12 && (g = 32), t >= 72 && t < 84 && (n >= 0 && n < 9 ? g = 31 : n >= 9 && n < 21 ? g = 33 : n >= 21 && n < 33 ? g = 35 : n >= 33 && n < 42 && (g = 37)), o = (g - 1) * 6 - 180 + 3, h = Wt(o), s = i / (1 - i), c = r / Math.sqrt(1 - i * Math.sin(p) * Math.sin(p)), l = Math.tan(p) * Math.tan(p), u = s * Math.cos(p) * Math.cos(p), d = Math.cos(p) * (m - h), f = r * ((1 - i / 4 - 3 * i * i / 64 - 5 * i * i * i / 256) * p - (3 * i / 8 + 3 * i * i / 32 + 45 * i * i * i / 1024) * Math.sin(2 * p) + (15 * i * i / 256 + 45 * i * i * i / 1024) * Math.sin(4 * p) - 35 * i * i * i / 3072 * Math.sin(6 * p));
	var _ = a * c * (d + (1 - l + u) * d * d * d / 6 + (5 - 18 * l + l * l + 72 * u - 58 * s) * d * d * d * d * d / 120) + 5e5, v = a * (f + c * Math.tan(p) * (d * d / 2 + (5 - l + 9 * u + 4 * u * u) * d * d * d * d / 24 + (61 - 58 * l + l * l + 600 * u - 330 * s) * d * d * d * d * d * d / 720));
	return t < 0 && (v += 1e7), {
		northing: Math.round(v),
		easting: Math.round(_),
		zoneNumber: g,
		zoneLetter: Jt(t)
	};
}
function qt(e) {
	var t = e.northing, n = e.easting, r = e.zoneLetter, i = e.zoneNumber;
	if (i < 0 || i > 60) return null;
	var a = .9996, o = 6378137, s = .00669438, c, l = (1 - Math.sqrt(1 - s)) / (1 + Math.sqrt(1 - s)), u, d, f, p, m, h, g, _, v, y = n - 5e5, b = t;
	r < "N" && (b -= 1e7), g = (i - 1) * 6 - 180 + 3, c = s / (1 - s), h = b / a, _ = h / (o * (1 - s / 4 - 3 * s * s / 64 - 5 * s * s * s / 256)), v = _ + (3 * l / 2 - 27 * l * l * l / 32) * Math.sin(2 * _) + (21 * l * l / 16 - 55 * l * l * l * l / 32) * Math.sin(4 * _) + 151 * l * l * l / 96 * Math.sin(6 * _), u = o / Math.sqrt(1 - s * Math.sin(v) * Math.sin(v)), d = Math.tan(v) * Math.tan(v), f = c * Math.cos(v) * Math.cos(v), p = o * (1 - s) / (1 - s * Math.sin(v) * Math.sin(v)) ** 1.5, m = y / (u * a);
	var x = v - u * Math.tan(v) / p * (m * m / 2 - (5 + 3 * d + 10 * f - 4 * f * f - 9 * c) * m * m * m * m / 24 + (61 + 90 * d + 298 * f + 45 * d * d - 252 * c - 3 * f * f) * m * m * m * m * m * m / 720);
	x = Gt(x);
	var S = (m - (1 + 2 * d + f) * m * m * m / 6 + (5 - 2 * f + 28 * d - 3 * f * f + 8 * c + 24 * d * d) * m * m * m * m * m / 120) / Math.cos(v);
	S = g + Gt(S);
	var C;
	if (e.accuracy) {
		var w = qt({
			northing: e.northing + e.accuracy,
			easting: e.easting + e.accuracy,
			zoneLetter: e.zoneLetter,
			zoneNumber: e.zoneNumber
		});
		C = {
			top: w.lat,
			right: w.lon,
			bottom: x,
			left: S
		};
	} else C = {
		lat: x,
		lon: S
	};
	return C;
}
function Jt(e) {
	var t = "Z";
	return 84 >= e && e >= 72 ? t = "X" : 72 > e && e >= 64 ? t = "W" : 64 > e && e >= 56 ? t = "V" : 56 > e && e >= 48 ? t = "U" : 48 > e && e >= 40 ? t = "T" : 40 > e && e >= 32 ? t = "S" : 32 > e && e >= 24 ? t = "R" : 24 > e && e >= 16 ? t = "Q" : 16 > e && e >= 8 ? t = "P" : 8 > e && e >= 0 ? t = "N" : 0 > e && e >= -8 ? t = "M" : -8 > e && e >= -16 ? t = "L" : -16 > e && e >= -24 ? t = "K" : -24 > e && e >= -32 ? t = "J" : -32 > e && e >= -40 ? t = "H" : -40 > e && e >= -48 ? t = "G" : -48 > e && e >= -56 ? t = "F" : -56 > e && e >= -64 ? t = "E" : -64 > e && e >= -72 ? t = "D" : -72 > e && e >= -80 && (t = "C"), t;
}
function Yt(e, t) {
	var n = "00000" + e.easting, r = "00000" + e.northing;
	return e.zoneNumber + e.zoneLetter + Xt(e.easting, e.northing, e.zoneNumber) + n.substr(n.length - 5, t) + r.substr(r.length - 5, t);
}
function Xt(e, t, n) {
	var r = Zt(n);
	return Qt(Math.floor(e / 1e5), Math.floor(t / 1e5) % 20, r);
}
function Zt(e) {
	var t = e % Pt;
	return t === 0 && (t = Pt), t;
}
function Qt(e, t, n) {
	var r = n - 1, i = Ft.charCodeAt(r), a = It.charCodeAt(r), o = i + e - 1, s = a + t, c = !1;
	return o > zt && (o = o - zt + Lt - 1, c = !0), (o === G || i < G && o > G || (o > G || i < G) && c) && o++, (o === K || i < K && o > K || (o > K || i < K) && c) && (o++, o === G && o++), o > zt && (o = o - zt + Lt - 1), s > Rt ? (s = s - Rt + Lt - 1, c = !0) : c = !1, (s === G || a < G && s > G || (s > G || a < G) && c) && s++, (s === K || a < K && s > K || (s > K || a < K) && c) && (s++, s === G && s++), s > Rt && (s = s - Rt + Lt - 1), String.fromCharCode(o) + String.fromCharCode(s);
}
function $t(e) {
	if (e && e.length === 0) throw "MGRSPoint coverting from nothing";
	for (var t = e.length, n = null, r = "", i, a = 0; !/[A-Z]/.test(i = e.charAt(a));) {
		if (a >= 2) throw "MGRSPoint bad conversion from: " + e;
		r += i, a++;
	}
	var o = parseInt(r, 10);
	if (a === 0 || a + 3 > t) throw "MGRSPoint bad conversion from: " + e;
	var s = e.charAt(a++);
	if (s <= "A" || s === "B" || s === "Y" || s >= "Z" || s === "I" || s === "O") throw "MGRSPoint zone letter " + s + " not handled: " + e;
	n = e.substring(a, a += 2);
	for (var c = Zt(o), l = q(n.charAt(0), c), u = en(n.charAt(1), c); u < tn(s);) u += 2e6;
	var d = t - a;
	if (d % 2 != 0) throw "MGRSPoint has to have an even number \nof digits after the zone letter and two 100km letters - front \nhalf for easting meters, second half for \nnorthing meters" + e;
	var f = d / 2, p = 0, m = 0, h, g, _, v, y;
	return f > 0 && (h = 1e5 / 10 ** f, g = e.substring(a, a + f), p = parseFloat(g) * h, _ = e.substring(a + f), m = parseFloat(_) * h), v = p + l, y = m + u, {
		easting: v,
		northing: y,
		zoneLetter: s,
		zoneNumber: o,
		accuracy: h
	};
}
function q(e, t) {
	for (var n = Ft.charCodeAt(t - 1), r = 1e5, i = !1; n !== e.charCodeAt(0);) {
		if (n++, n === G && n++, n === K && n++, n > zt) {
			if (i) throw "Bad character: " + e;
			n = Lt, i = !0;
		}
		r += 1e5;
	}
	return r;
}
function en(e, t) {
	if (e > "V") throw "MGRSPoint given invalid Northing " + e;
	for (var n = It.charCodeAt(t - 1), r = 0, i = !1; n !== e.charCodeAt(0);) {
		if (n++, n === G && n++, n === K && n++, n > Rt) {
			if (i) throw "Bad character: " + e;
			n = Lt, i = !0;
		}
		r += 1e5;
	}
	return r;
}
function tn(e) {
	var t;
	switch (e) {
		case "C":
			t = 11e5;
			break;
		case "D":
			t = 2e6;
			break;
		case "E":
			t = 28e5;
			break;
		case "F":
			t = 37e5;
			break;
		case "G":
			t = 46e5;
			break;
		case "H":
			t = 55e5;
			break;
		case "J":
			t = 64e5;
			break;
		case "K":
			t = 73e5;
			break;
		case "L":
			t = 82e5;
			break;
		case "M":
			t = 91e5;
			break;
		case "N":
			t = 0;
			break;
		case "P":
			t = 8e5;
			break;
		case "Q":
			t = 17e5;
			break;
		case "R":
			t = 26e5;
			break;
		case "S":
			t = 35e5;
			break;
		case "T":
			t = 44e5;
			break;
		case "U":
			t = 53e5;
			break;
		case "V":
			t = 62e5;
			break;
		case "W":
			t = 7e6;
			break;
		case "X":
			t = 79e5;
			break;
		default: t = -1;
	}
	if (t >= 0) return t;
	throw "Invalid zone letter: " + e;
}
//#endregion
//#region node_modules/proj4/lib/Point.js
function nn(e, t, n) {
	if (!(this instanceof nn)) return new nn(e, t, n);
	if (Array.isArray(e)) this.x = e[0], this.y = e[1], this.z = e[2] || 0;
	else if (typeof e == "object") this.x = e.x, this.y = e.y, this.z = e.z || 0;
	else if (typeof e == "string" && t === void 0) {
		var r = e.split(",");
		this.x = parseFloat(r[0]), this.y = parseFloat(r[1]), this.z = parseFloat(r[2]) || 0;
	} else this.x = e, this.y = t, this.z = n || 0;
	console.warn("proj4.Point will be removed in version 3, use proj4.toPoint");
}
nn.fromMGRS = function(e) {
	return new nn(Ut(e));
}, nn.prototype.toMGRS = function(e) {
	return Vt([this.x, this.y], e);
};
//#endregion
//#region node_modules/proj4/lib/common/pj_enfn.js
var rn = 1, an = .25, on = .046875, sn = .01953125, cn = .01068115234375, ln = .75, un = .46875, dn = .013020833333333334, fn = .007120768229166667, pn = .3645833333333333, mn = .005696614583333333, hn = .3076171875;
function gn(e) {
	var t = [];
	t[0] = rn - e * (an + e * (on + e * (sn + e * cn))), t[1] = e * (ln - e * (on + e * (sn + e * cn)));
	var n = e * e;
	return t[2] = n * (un - e * (dn + e * fn)), n *= e, t[3] = n * (pn - e * mn), t[4] = n * e * hn, t;
}
//#endregion
//#region node_modules/proj4/lib/common/pj_mlfn.js
function _n(e, t, n, r) {
	return n *= t, t *= t, r[0] * e - n * (r[1] + t * (r[2] + t * (r[3] + t * r[4])));
}
//#endregion
//#region node_modules/proj4/lib/common/pj_inv_mlfn.js
var vn = 20;
function yn(e, t, n) {
	for (var r = 1 / (1 - t), i = e, a = vn; a; --a) {
		var o = Math.sin(i), s = 1 - t * o * o;
		if (s = (_n(i, o, Math.cos(i), n) - e) * (s * Math.sqrt(s)) * r, i -= s, Math.abs(s) < 1e-10) return i;
	}
	return i;
}
//#endregion
//#region node_modules/proj4/lib/projections/tmerc.js
function bn() {
	this.x0 = this.x0 === void 0 ? 0 : this.x0, this.y0 = this.y0 === void 0 ? 0 : this.y0, this.long0 = this.long0 === void 0 ? 0 : this.long0, this.lat0 = this.lat0 === void 0 ? 0 : this.lat0, this.es && (this.en = gn(this.es), this.ml0 = _n(this.lat0, Math.sin(this.lat0), Math.cos(this.lat0), this.en));
}
function xn(e) {
	var t = e.x, n = e.y, r = B(t - this.long0, this.over), i, a, o, s = Math.sin(n), c = Math.cos(n);
	if (this.es) {
		var l = c * r, u = l ** 2, d = this.ep2 * c ** 2, f = d ** 2, p = (Math.abs(c) > 1e-10 ? Math.tan(n) : 0) ** 2, m = p ** 2;
		i = 1 - this.es * s ** 2, l /= Math.sqrt(i);
		var h = _n(n, s, c, this.en);
		a = this.a * (this.k0 * l * (1 + u / 6 * (1 - p + d + u / 20 * (5 - 18 * p + m + 14 * d - 58 * p * d + u / 42 * (61 + 179 * m - m * p - 479 * p))))) + this.x0, o = this.a * (this.k0 * (h - this.ml0 + s * r * l / 2 * (1 + u / 12 * (5 - p + 9 * d + 4 * f + u / 30 * (61 + m - 58 * p + 270 * d - 330 * p * d + u / 56 * (1385 + 543 * m - m * p - 3111 * p)))))) + this.y0;
	} else {
		var g = c * Math.sin(r);
		if (Math.abs(Math.abs(g) - 1) < 1e-10) return 93;
		if (a = .5 * this.a * this.k0 * Math.log((1 + g) / (1 - g)) + this.x0, o = c * Math.cos(r) / Math.sqrt(1 - g ** 2), g = Math.abs(o), g >= 1) {
			if (g - 1 > 1e-10) return 93;
			o = 0;
		} else o = Math.acos(o);
		n < 0 && (o = -o), o = this.a * this.k0 * (o - this.lat0) + this.y0;
	}
	return e.x = a, e.y = o, e;
}
function Sn(e) {
	var t, n, r, i, a = (e.x - this.x0) * (1 / this.a), o = (e.y - this.y0) * (1 / this.a);
	if (!this.es) {
		var c = Math.exp(a / this.k0), l = .5 * (c - 1 / c), u = this.lat0 + o / this.k0, d = Math.cos(u);
		t = Math.sqrt((1 - d ** 2) / (1 + l ** 2)), r = Math.asin(t), o < 0 && (r = -r), i = l === 0 && d === 0 ? 0 : B(Math.atan2(l, d) + this.long0, this.over);
	} else if (t = this.ml0 + o / this.k0, n = yn(t, this.es, this.en), Math.abs(n) < s) {
		var f = Math.sin(n), p = Math.cos(n), m = Math.abs(p) > 1e-10 ? Math.tan(n) : 0, h = this.ep2 * p ** 2, g = h ** 2, _ = m ** 2, v = _ ** 2;
		t = 1 - this.es * f ** 2;
		var y = a * Math.sqrt(t) / this.k0, b = y ** 2;
		t *= m, r = n - t * b / (1 - this.es) * .5 * (1 - b / 12 * (5 + 3 * _ - 9 * h * _ + h - 4 * g - b / 30 * (61 + 90 * _ - 252 * h * _ + 45 * v + 46 * h - b / 56 * (1385 + 3633 * _ + 4095 * v + 1574 * v * _)))), i = B(this.long0 + y * (1 - b / 6 * (1 + 2 * _ + h - b / 20 * (5 + 28 * _ + 24 * v + 8 * h * _ + 6 * h - b / 42 * (61 + 662 * _ + 1320 * v + 720 * v * _)))) / p, this.over);
	} else r = s * De(o), i = 0;
	return e.x = i, e.y = r, e;
}
var Cn = {
	init: bn,
	forward: xn,
	inverse: Sn,
	names: ["Fast_Transverse_Mercator", "Fast Transverse Mercator"]
};
//#endregion
//#region node_modules/proj4/lib/common/sinh.js
function wn(e) {
	var t = Math.exp(e);
	return t = (t - 1 / t) / 2, t;
}
//#endregion
//#region node_modules/proj4/lib/common/hypot.js
function J(e, t) {
	e = Math.abs(e), t = Math.abs(t);
	var n = Math.max(e, t), r = Math.min(e, t) / (n || 1);
	return n * Math.sqrt(1 + r ** 2);
}
//#endregion
//#region node_modules/proj4/lib/common/log1py.js
function Tn(e) {
	var t = 1 + e, n = t - 1;
	return n === 0 ? e : e * Math.log(t) / n;
}
//#endregion
//#region node_modules/proj4/lib/common/asinhy.js
function En(e) {
	var t = Math.abs(e);
	return t = Tn(t * (1 + t / (J(1, t) + 1))), e < 0 ? -t : t;
}
//#endregion
//#region node_modules/proj4/lib/common/gatg.js
function Dn(e, t) {
	for (var n = 2 * Math.cos(2 * t), r = e.length - 1, i = e[r], a = 0, o; --r >= 0;) o = -a + n * i + e[r], a = i, i = o;
	return t + o * Math.sin(2 * t);
}
//#endregion
//#region node_modules/proj4/lib/common/clens.js
function On(e, t) {
	for (var n = 2 * Math.cos(t), r = e.length - 1, i = e[r], a = 0, o; --r >= 0;) o = -a + n * i + e[r], a = i, i = o;
	return Math.sin(t) * o;
}
//#endregion
//#region node_modules/proj4/lib/common/cosh.js
function kn(e) {
	var t = Math.exp(e);
	return t = (t + 1 / t) / 2, t;
}
//#endregion
//#region node_modules/proj4/lib/common/clens_cmplx.js
function An(e, t, n) {
	for (var r = Math.sin(t), i = Math.cos(t), a = wn(n), o = kn(n), s = 2 * i * o, c = -2 * r * a, l = e.length - 1, u = e[l], d = 0, f = 0, p = 0, m, h; --l >= 0;) m = f, h = d, f = u, d = p, u = -m + s * f - c * d + e[l], p = -h + c * f + s * d;
	return s = r * o, c = i * a, [s * u - c * p, s * p + c * u];
}
//#endregion
//#region node_modules/proj4/lib/projections/etmerc.js
function jn() {
	if (!this.approx && (isNaN(this.es) || this.es <= 0)) throw Error("Incorrect elliptical usage. Try using the +approx option in the proj string, or PROJECTION[\"Fast_Transverse_Mercator\"] in the WKT.");
	this.approx && (Cn.init.apply(this), this.forward = Cn.forward, this.inverse = Cn.inverse), this.x0 = this.x0 === void 0 ? 0 : this.x0, this.y0 = this.y0 === void 0 ? 0 : this.y0, this.long0 = this.long0 === void 0 ? 0 : this.long0, this.lat0 = this.lat0 === void 0 ? 0 : this.lat0, this.cgb = [], this.cbg = [], this.utg = [], this.gtu = [];
	var e = this.es / (1 + Math.sqrt(1 - this.es)), t = e / (2 - e), n = t;
	this.cgb[0] = t * (2 + t * (-2 / 3 + t * (-2 + t * (116 / 45 + t * (26 / 45 + -2854 / 675 * t))))), this.cbg[0] = t * (-2 + t * (2 / 3 + t * (4 / 3 + t * (-82 / 45 + t * (32 / 45 + 4642 / 4725 * t))))), n *= t, this.cgb[1] = n * (7 / 3 + t * (-8 / 5 + t * (-227 / 45 + t * (2704 / 315 + 2323 / 945 * t)))), this.cbg[1] = n * (5 / 3 + t * (-16 / 15 + t * (-13 / 9 + t * (904 / 315 + -1522 / 945 * t)))), n *= t, this.cgb[2] = n * (56 / 15 + t * (-136 / 35 + t * (-1262 / 105 + 73814 / 2835 * t))), this.cbg[2] = n * (-26 / 15 + t * (34 / 21 + t * (8 / 5 + -12686 / 2835 * t))), n *= t, this.cgb[3] = n * (4279 / 630 + t * (-332 / 35 + -399572 / 14175 * t)), this.cbg[3] = n * (1237 / 630 + t * (-12 / 5 + -24832 / 14175 * t)), n *= t, this.cgb[4] = n * (4174 / 315 + -144838 / 6237 * t), this.cbg[4] = n * (-734 / 315 + 109598 / 31185 * t), n *= t, this.cgb[5] = 601676 / 22275 * n, this.cbg[5] = 444337 / 155925 * n, n = t ** 2, this.Qn = this.k0 / (1 + t) * (1 + n * (1 / 4 + n * (1 / 64 + n / 256))), this.utg[0] = t * (-.5 + t * (2 / 3 + t * (-37 / 96 + t * (1 / 360 + t * (81 / 512 + -96199 / 604800 * t))))), this.gtu[0] = t * (.5 + t * (-2 / 3 + t * (5 / 16 + t * (41 / 180 + t * (-127 / 288 + 7891 / 37800 * t))))), this.utg[1] = n * (-1 / 48 + t * (-1 / 15 + t * (437 / 1440 + t * (-46 / 105 + 1118711 / 3870720 * t)))), this.gtu[1] = n * (13 / 48 + t * (-3 / 5 + t * (557 / 1440 + t * (281 / 630 + -1983433 / 1935360 * t)))), n *= t, this.utg[2] = n * (-17 / 480 + t * (37 / 840 + t * (209 / 4480 + -5569 / 90720 * t))), this.gtu[2] = n * (61 / 240 + t * (-103 / 140 + t * (15061 / 26880 + 167603 / 181440 * t))), n *= t, this.utg[3] = n * (-4397 / 161280 + t * (11 / 504 + 830251 / 7257600 * t)), this.gtu[3] = n * (49561 / 161280 + t * (-179 / 168 + 6601661 / 7257600 * t)), n *= t, this.utg[4] = n * (-4583 / 161280 + 108847 / 3991680 * t), this.gtu[4] = n * (34729 / 80640 + -3418889 / 1995840 * t), n *= t, this.utg[5] = -20648693 / 638668800 * n, this.gtu[5] = 212378941 / 319334400 * n;
	var r = Dn(this.cbg, this.lat0);
	this.Zb = -this.Qn * (r + On(this.gtu, 2 * r));
}
function Mn(e) {
	var t = B(e.x - this.long0, this.over), n = e.y;
	n = Dn(this.cbg, n);
	var r = Math.sin(n), i = Math.cos(n), a = Math.sin(t), o = Math.cos(t);
	n = Math.atan2(r, o * i), t = Math.atan2(a * i, J(r, i * o)), t = En(Math.tan(t));
	var s = An(this.gtu, 2 * n, 2 * t);
	n += s[0], t += s[1];
	var c, l;
	return Math.abs(t) <= 2.623395162778 ? (c = this.a * (this.Qn * t) + this.x0, l = this.a * (this.Qn * n + this.Zb) + this.y0) : (c = Infinity, l = Infinity), e.x = c, e.y = l, e;
}
function Nn(e) {
	var t = (e.x - this.x0) * (1 / this.a), n = (e.y - this.y0) * (1 / this.a);
	n = (n - this.Zb) / this.Qn, t /= this.Qn;
	var r, i;
	if (Math.abs(t) <= 2.623395162778) {
		var a = An(this.utg, 2 * n, 2 * t);
		n += a[0], t += a[1], t = Math.atan(wn(t));
		var o = Math.sin(n), s = Math.cos(n), c = Math.sin(t), l = Math.cos(t);
		n = Math.atan2(o * l, J(c, l * s)), t = Math.atan2(c, l * s), r = B(t + this.long0, this.over), i = Dn(this.cgb, n);
	} else r = Infinity, i = Infinity;
	return e.x = r, e.y = i, e;
}
var Pn = {
	init: jn,
	forward: Mn,
	inverse: Nn,
	names: [
		"Extended_Transverse_Mercator",
		"Extended Transverse Mercator",
		"etmerc",
		"Transverse_Mercator",
		"Transverse Mercator",
		"Gauss Kruger",
		"Gauss_Kruger",
		"tmerc"
	]
};
//#endregion
//#region node_modules/proj4/lib/common/adjust_zone.js
function Fn(e, t) {
	if (e === void 0) {
		if (e = Math.floor((B(t) + Math.PI) * 30 / Math.PI) + 1, e < 0) return 0;
		if (e > 60) return 60;
	}
	return e;
}
//#endregion
//#region node_modules/proj4/lib/projections/utm.js
var In = "etmerc";
function Ln() {
	var e = Fn(this.zone, this.long0);
	if (e === void 0) throw Error("unknown utm zone");
	this.lat0 = 0, this.long0 = (6 * Math.abs(e) - 183) * f, this.x0 = 5e5, this.y0 = this.utmSouth ? 1e7 : 0, this.k0 = .9996, Pn.init.apply(this), this.forward = Pn.forward, this.inverse = Pn.inverse;
}
var Rn = {
	init: Ln,
	names: ["Universal Transverse Mercator System", "utm"],
	dependsOn: In
};
//#endregion
//#region node_modules/proj4/lib/common/srat.js
function zn(e, t) {
	return ((1 - e) / (1 + e)) ** t;
}
//#endregion
//#region node_modules/proj4/lib/projections/gauss.js
var Bn = 20;
function Vn() {
	var e = Math.sin(this.lat0), t = Math.cos(this.lat0);
	t *= t, this.rc = Math.sqrt(1 - this.es) / (1 - this.es * e * e), this.C = Math.sqrt(1 + this.es * t * t / (1 - this.es)), this.phic0 = Math.asin(e / this.C), this.ratexp = .5 * this.C * this.e, this.K = Math.tan(.5 * this.phic0 + m) / (Math.tan(.5 * this.lat0 + m) ** +this.C * zn(this.e * e, this.ratexp));
}
function Hn(e) {
	var t = e.x, n = e.y;
	return e.y = 2 * Math.atan(this.K * Math.tan(.5 * n + m) ** +this.C * zn(this.e * Math.sin(n), this.ratexp)) - s, e.x = this.C * t, e;
}
function Un(e) {
	for (var t = 1e-14, n = e.x / this.C, r = e.y, i = (Math.tan(.5 * r + m) / this.K) ** (1 / this.C), a = Bn; a > 0 && (r = 2 * Math.atan(i * zn(this.e * Math.sin(e.y), -.5 * this.e)) - s, !(Math.abs(r - e.y) < t)); --a) e.y = r;
	return a ? (e.x = n, e.y = r, e) : null;
}
var Wn = {
	init: Vn,
	forward: Hn,
	inverse: Un,
	names: ["gauss"]
};
//#endregion
//#region node_modules/proj4/lib/projections/sterea.js
function Gn() {
	Wn.init.apply(this), this.rc && (this.sinc0 = Math.sin(this.phic0), this.cosc0 = Math.cos(this.phic0), this.R2 = 2 * this.rc, this.title ||= "Oblique Stereographic Alternative");
}
function Kn(e) {
	var t, n, r, i;
	return e.x = B(e.x - this.long0, this.over), Wn.forward.apply(this, [e]), t = Math.sin(e.y), n = Math.cos(e.y), r = Math.cos(e.x), i = this.k0 * this.R2 / (1 + this.sinc0 * t + this.cosc0 * n * r), e.x = i * n * Math.sin(e.x), e.y = i * (this.cosc0 * t - this.sinc0 * n * r), e.x = this.a * e.x + this.x0, e.y = this.a * e.y + this.y0, e;
}
function qn(e) {
	var t, n, r, i, a;
	if (e.x = (e.x - this.x0) / this.a, e.y = (e.y - this.y0) / this.a, e.x /= this.k0, e.y /= this.k0, a = J(e.x, e.y)) {
		var o = 2 * Math.atan2(a, this.R2);
		t = Math.sin(o), n = Math.cos(o), i = Math.asin(n * this.sinc0 + e.y * t * this.cosc0 / a), r = Math.atan2(e.x * t, a * this.cosc0 * n - e.y * this.sinc0 * t);
	} else i = this.phic0, r = 0;
	return e.x = r, e.y = i, Wn.inverse.apply(this, [e]), e.x = B(e.x + this.long0, this.over), e;
}
var Jn = {
	init: Gn,
	forward: Kn,
	inverse: qn,
	names: [
		"Stereographic_North_Pole",
		"Oblique_Stereographic",
		"sterea",
		"Oblique Stereographic Alternative",
		"Double_Stereographic"
	]
};
//#endregion
//#region node_modules/proj4/lib/projections/stere.js
function Yn(e, t, n) {
	return t *= n, Math.tan(.5 * (s + e)) * ((1 - t) / (1 + t)) ** (.5 * n);
}
function Xn() {
	this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.coslat0 = Math.cos(this.lat0), this.sinlat0 = Math.sin(this.lat0), this.sphere ? this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= 1e-10 && (this.k0 = .5 * (1 + De(this.lat0) * Math.sin(this.lat_ts))) : (Math.abs(this.coslat0) <= 1e-10 && (this.lat0 > 0 ? this.con = 1 : this.con = -1), this.cons = Math.sqrt((1 + this.e) ** +(1 + this.e) * (1 - this.e) ** (1 - this.e)), this.k0 === 1 && !isNaN(this.lat_ts) && Math.abs(this.coslat0) <= 1e-10 && Math.abs(Math.cos(this.lat_ts)) > 1e-10 && (this.k0 = .5 * this.cons * z(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)) / V(this.e, this.con * this.lat_ts, this.con * Math.sin(this.lat_ts))), this.ms1 = z(this.e, this.sinlat0, this.coslat0), this.X0 = 2 * Math.atan(Yn(this.lat0, this.sinlat0, this.e)) - s, this.cosX0 = Math.cos(this.X0), this.sinX0 = Math.sin(this.X0));
}
function Zn(e) {
	var t = e.x, n = e.y, r = Math.sin(n), i = Math.cos(n), a, o, c, l, u, d, f = B(t - this.long0, this.over);
	return Math.abs(Math.abs(t - this.long0) - Math.PI) <= 1e-10 && Math.abs(n + this.lat0) <= 1e-10 ? (e.x = NaN, e.y = NaN, e) : this.sphere ? (a = 2 * this.k0 / (1 + this.sinlat0 * r + this.coslat0 * i * Math.cos(f)), e.x = this.a * a * i * Math.sin(f) + this.x0, e.y = this.a * a * (this.coslat0 * r - this.sinlat0 * i * Math.cos(f)) + this.y0, e) : (o = 2 * Math.atan(Yn(n, r, this.e)) - s, l = Math.cos(o), c = Math.sin(o), Math.abs(this.coslat0) <= 1e-10 ? (u = V(this.e, n * this.con, this.con * r), d = 2 * this.a * this.k0 * u / this.cons, e.x = this.x0 + d * Math.sin(t - this.long0), e.y = this.y0 - this.con * d * Math.cos(t - this.long0), e) : (Math.abs(this.sinlat0) < 1e-10 ? (a = 2 * this.a * this.k0 / (1 + l * Math.cos(f)), e.y = a * c) : (a = 2 * this.a * this.k0 * this.ms1 / (this.cosX0 * (1 + this.sinX0 * c + this.cosX0 * l * Math.cos(f))), e.y = a * (this.cosX0 * c - this.sinX0 * l * Math.cos(f)) + this.y0), e.x = a * l * Math.sin(f) + this.x0, e));
}
function Qn(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t, n, r, i, a, o = Math.sqrt(e.x * e.x + e.y * e.y);
	if (this.sphere) {
		var c = 2 * Math.atan(o / (2 * this.a * this.k0));
		return t = this.long0, n = this.lat0, o <= 1e-10 ? (e.x = t, e.y = n, e) : (n = Math.asin(Math.cos(c) * this.sinlat0 + e.y * Math.sin(c) * this.coslat0 / o), t = Math.abs(this.coslat0) < 1e-10 ? this.lat0 > 0 ? B(this.long0 + Math.atan2(e.x, -1 * e.y), this.over) : B(this.long0 + Math.atan2(e.x, e.y), this.over) : B(this.long0 + Math.atan2(e.x * Math.sin(c), o * this.coslat0 * Math.cos(c) - e.y * this.sinlat0 * Math.sin(c)), this.over), e.x = t, e.y = n, e);
	} else if (Math.abs(this.coslat0) <= 1e-10) {
		if (o <= 1e-10) return n = this.lat0, t = this.long0, e.x = t, e.y = n, e;
		e.x *= this.con, e.y *= this.con, r = o * this.cons / (2 * this.a * this.k0), n = this.con * Oe(this.e, r), t = this.con * B(this.con * this.long0 + Math.atan2(e.x, -1 * e.y), this.over);
	} else i = 2 * Math.atan(o * this.cosX0 / (2 * this.a * this.k0 * this.ms1)), t = this.long0, o <= 1e-10 ? a = this.X0 : (a = Math.asin(Math.cos(i) * this.sinX0 + e.y * Math.sin(i) * this.cosX0 / o), t = B(this.long0 + Math.atan2(e.x * Math.sin(i), o * this.cosX0 * Math.cos(i) - e.y * this.sinX0 * Math.sin(i)), this.over)), n = -1 * Oe(this.e, Math.tan(.5 * (s + a)));
	return e.x = t, e.y = n, e;
}
var $n = {
	init: Xn,
	forward: Zn,
	inverse: Qn,
	names: [
		"stere",
		"Stereographic_South_Pole",
		"Polar_Stereographic_variant_A",
		"Polar_Stereographic_variant_B",
		"Polar_Stereographic"
	],
	ssfn_: Yn
};
//#endregion
//#region node_modules/proj4/lib/projections/somerc.js
function er() {
	var e = this.lat0;
	this.lambda0 = this.long0;
	var t = Math.sin(e), n = this.a, r = 1 / this.rf, i = 2 * r - r ** 2, a = this.e = Math.sqrt(i);
	this.R = this.k0 * n * Math.sqrt(1 - i) / (1 - i * t ** 2), this.alpha = Math.sqrt(1 + i / (1 - i) * Math.cos(e) ** 4), this.b0 = Math.asin(t / this.alpha);
	var o = Math.log(Math.tan(Math.PI / 4 + this.b0 / 2)), s = Math.log(Math.tan(Math.PI / 4 + e / 2)), c = Math.log((1 + a * t) / (1 - a * t));
	this.K = o - this.alpha * s + this.alpha * a / 2 * c;
}
function tr(e) {
	var t = Math.log(Math.tan(Math.PI / 4 - e.y / 2)), n = this.e / 2 * Math.log((1 + this.e * Math.sin(e.y)) / (1 - this.e * Math.sin(e.y))), r = -this.alpha * (t + n) + this.K, i = 2 * (Math.atan(Math.exp(r)) - Math.PI / 4), a = this.alpha * (e.x - this.lambda0), o = Math.atan(Math.sin(a) / (Math.sin(this.b0) * Math.tan(i) + Math.cos(this.b0) * Math.cos(a))), s = Math.asin(Math.cos(this.b0) * Math.sin(i) - Math.sin(this.b0) * Math.cos(i) * Math.cos(a));
	return e.y = this.R / 2 * Math.log((1 + Math.sin(s)) / (1 - Math.sin(s))) + this.y0, e.x = this.R * o + this.x0, e;
}
function nr(e) {
	for (var t = e.x - this.x0, n = e.y - this.y0, r = t / this.R, i = 2 * (Math.atan(Math.exp(n / this.R)) - Math.PI / 4), a = Math.asin(Math.cos(this.b0) * Math.sin(i) + Math.sin(this.b0) * Math.cos(i) * Math.cos(r)), o = Math.atan(Math.sin(r) / (Math.cos(this.b0) * Math.cos(r) - Math.sin(this.b0) * Math.tan(i))), s = this.lambda0 + o / this.alpha, c = 0, l = a, u = -1e3, d = 0; Math.abs(l - u) > 1e-7;) {
		if (++d > 20) return;
		c = 1 / this.alpha * (Math.log(Math.tan(Math.PI / 4 + a / 2)) - this.K) + this.e * Math.log(Math.tan(Math.PI / 4 + Math.asin(this.e * Math.sin(l)) / 2)), u = l, l = 2 * Math.atan(Math.exp(c)) - Math.PI / 2;
	}
	return e.x = s, e.y = l, e;
}
var rr = {
	init: er,
	forward: tr,
	inverse: nr,
	names: ["somerc"]
}, ir = 1e-7;
function ar(e) {
	var t = [
		"Hotine_Oblique_Mercator",
		"Hotine_Oblique_Mercator_variant_A",
		"Hotine_Oblique_Mercator_Azimuth_Natural_Origin"
	], n = typeof e.projName == "object" ? Object.keys(e.projName)[0] : e.projName;
	return "no_uoff" in e || "no_off" in e || t.indexOf(n) !== -1 || t.indexOf(ze(n)) !== -1;
}
function or() {
	var e, t, n, r, i, a, o, c, l, u, d = 0, f, p = 0, g = 0, _ = 0, v = 0, y = 0, b = 0;
	this.no_off = ar(this), this.no_rot = "no_rot" in this;
	var x = !1;
	"alpha" in this && (x = !0);
	var S = !1;
	if ("rectified_grid_angle" in this && (S = !0), x && (b = this.alpha), S && (d = this.rectified_grid_angle, x ||= (b = 0, !0)), x || S) p = this.longc;
	else if (g = this.long1, v = this.lat1, _ = this.long2, y = this.lat2, Math.abs(v - y) <= ir || (e = Math.abs(v)) <= ir || Math.abs(e - s) <= ir || Math.abs(Math.abs(this.lat0) - s) <= ir || Math.abs(Math.abs(y) - s) <= ir) throw Error();
	var C = 1 - this.es;
	t = Math.sqrt(C), Math.abs(this.lat0) > 1e-10 ? (c = Math.sin(this.lat0), n = Math.cos(this.lat0), e = 1 - this.es * c * c, this.B = n * n, this.B = Math.sqrt(1 + this.es * this.B * this.B / C), this.A = this.B * this.k0 * t / e, r = this.B * t / (n * Math.sqrt(e)), i = r * r - 1, i <= 0 ? i = 0 : (i = Math.sqrt(i), this.lat0 < 0 && (i = -i)), this.E = i += r, this.E *= V(this.e, this.lat0, c) ** +this.B) : (this.B = 1 / t, this.A = this.k0, this.E = r = i = 1), x || S ? (x ? (f = Math.asin(Math.sin(b) / r), S || (d = b)) : (f = d, b = Math.asin(r * Math.sin(f))), this.lam0 = p - Math.asin(.5 * (i - 1 / i) * Math.tan(f)) / this.B) : (a = V(this.e, v, Math.sin(v)) ** +this.B, o = V(this.e, y, Math.sin(y)) ** +this.B, i = this.E / a, l = (o - a) / (o + a), u = this.E * this.E, u = (u - o * a) / (u + o * a), e = g - _, e < -Math.PI ? _ -= h : e > Math.PI && (_ += h), this.lam0 = B(.5 * (g + _) - Math.atan(u * Math.tan(.5 * this.B * (g - _)) / l) / this.B, this.over), f = Math.atan(2 * Math.sin(this.B * B(g - this.lam0, this.over)) / (i - 1 / i)), d = b = Math.asin(r * Math.sin(f))), this.singam = Math.sin(f), this.cosgam = Math.cos(f), this.sinrot = Math.sin(d), this.cosrot = Math.cos(d), this.rB = 1 / this.B, this.ArB = this.A * this.rB, this.BrA = 1 / this.ArB, this.no_off ? this.u_0 = 0 : (this.u_0 = Math.abs(this.ArB * Math.atan(Math.sqrt(r * r - 1) / Math.cos(b))), this.lat0 < 0 && (this.u_0 = -this.u_0)), i = .5 * f, this.v_pole_n = this.ArB * Math.log(Math.tan(m - i)), this.v_pole_s = this.ArB * Math.log(Math.tan(m + i));
}
function sr(e) {
	var t = {}, n, r, i, a, o, c, l, u;
	if (e.x -= this.lam0, Math.abs(Math.abs(e.y) - s) > 1e-10) {
		if (o = this.E / V(this.e, e.y, Math.sin(e.y)) ** +this.B, c = 1 / o, n = .5 * (o - c), r = .5 * (o + c), a = Math.sin(this.B * e.x), i = (n * this.singam - a * this.cosgam) / r, Math.abs(Math.abs(i) - 1) < 1e-10) throw Error();
		u = .5 * this.ArB * Math.log((1 - i) / (1 + i)), c = Math.cos(this.B * e.x), l = Math.abs(c) < ir ? this.A * e.x : this.ArB * Math.atan2(n * this.cosgam + a * this.singam, c);
	} else u = e.y > 0 ? this.v_pole_n : this.v_pole_s, l = this.ArB * e.y;
	return this.no_rot ? (t.x = l, t.y = u) : (l -= this.u_0, t.x = u * this.cosrot + l * this.sinrot, t.y = l * this.cosrot - u * this.sinrot), t.x = this.a * t.x + this.x0, t.y = this.a * t.y + this.y0, t;
}
function cr(e) {
	var t, n, r, i, a, o, c, l = {};
	if (e.x = (e.x - this.x0) * (1 / this.a), e.y = (e.y - this.y0) * (1 / this.a), this.no_rot ? (n = e.y, t = e.x) : (n = e.x * this.cosrot - e.y * this.sinrot, t = e.y * this.cosrot + e.x * this.sinrot + this.u_0), r = Math.exp(-this.BrA * n), i = .5 * (r - 1 / r), a = .5 * (r + 1 / r), o = Math.sin(this.BrA * t), c = (o * this.cosgam + i * this.singam) / a, Math.abs(Math.abs(c) - 1) < 1e-10) l.x = 0, l.y = c < 0 ? -s : s;
	else {
		if (l.y = this.E / Math.sqrt((1 + c) / (1 - c)), l.y = Oe(this.e, l.y ** (1 / this.B)), l.y === Infinity) throw Error();
		l.x = -this.rB * Math.atan2(i * this.cosgam - o * this.singam, Math.cos(this.BrA * t));
	}
	return l.x += this.lam0, l;
}
var lr = {
	init: or,
	forward: sr,
	inverse: cr,
	names: [
		"Hotine_Oblique_Mercator",
		"Hotine Oblique Mercator",
		"Hotine_Oblique_Mercator_variant_A",
		"Hotine_Oblique_Mercator_Variant_B",
		"Hotine_Oblique_Mercator_Azimuth_Natural_Origin",
		"Hotine_Oblique_Mercator_Two_Point_Natural_Origin",
		"Hotine_Oblique_Mercator_Azimuth_Center",
		"Oblique_Mercator",
		"omerc"
	]
};
//#endregion
//#region node_modules/proj4/lib/projections/lcc.js
function ur() {
	if (this.lat2 ||= this.lat1, this.k0 ||= 1, this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, !(Math.abs(this.lat1 + this.lat2) < 1e-10)) {
		var e = this.b / this.a;
		this.e = Math.sqrt(1 - e * e);
		var t = Math.sin(this.lat1), n = Math.cos(this.lat1), r = z(this.e, t, n), i = V(this.e, this.lat1, t), a = Math.sin(this.lat2), o = Math.cos(this.lat2), c = z(this.e, a, o), l = V(this.e, this.lat2, a), u = Math.abs(Math.abs(this.lat0) - s) < 1e-10 ? 0 : V(this.e, this.lat0, Math.sin(this.lat0));
		Math.abs(this.lat1 - this.lat2) > 1e-10 ? this.ns = Math.log(r / c) / Math.log(i / l) : this.ns = t, isNaN(this.ns) && (this.ns = t), this.f0 = r / (this.ns * i ** +this.ns), this.rh = this.a * this.f0 * u ** +this.ns, this.title ||= "Lambert Conformal Conic";
	}
}
function dr(e) {
	var t = e.x, n = e.y;
	Math.abs(2 * Math.abs(n) - Math.PI) <= 1e-10 && (n = De(n) * (s - 2 * d));
	var r = Math.abs(Math.abs(n) - s), i, a;
	if (r > 1e-10) i = V(this.e, n, Math.sin(n)), a = this.a * this.f0 * i ** +this.ns;
	else {
		if (r = n * this.ns, r <= 0) return null;
		a = 0;
	}
	var o = this.ns * B(t - this.long0, this.over);
	return e.x = this.k0 * (a * Math.sin(o)) + this.x0, e.y = this.k0 * (this.rh - a * Math.cos(o)) + this.y0, e;
}
function fr(e) {
	var t, n, r, i, a, o = (e.x - this.x0) / this.k0, c = this.rh - (e.y - this.y0) / this.k0;
	this.ns > 0 ? (t = Math.sqrt(o * o + c * c), n = 1) : (t = -Math.sqrt(o * o + c * c), n = -1);
	var l = 0;
	if (t !== 0 && (l = Math.atan2(n * o, n * c)), t !== 0 || this.ns > 0) {
		if (n = 1 / this.ns, r = (t / (this.a * this.f0)) ** +n, i = Oe(this.e, r), i === -9999) return null;
	} else i = -s;
	return a = B(l / this.ns + this.long0, this.over), e.x = a, e.y = i, e;
}
var pr = {
	init: ur,
	forward: dr,
	inverse: fr,
	names: [
		"Lambert Tangential Conformal Conic Projection",
		"Lambert_Conformal_Conic",
		"Lambert_Conformal_Conic_1SP",
		"Lambert_Conformal_Conic_2SP",
		"lcc",
		"Lambert Conic Conformal (1SP)",
		"Lambert Conic Conformal (2SP)"
	]
};
//#endregion
//#region node_modules/proj4/lib/projections/krovak.js
function mr() {
	this.a = 6377397.155, this.es = .006674372230614, this.e = Math.sqrt(this.es), this.lat0 ||= .863937979737193, this.long0 ||= .4334234309119251, this.k0 ||= .9999, this.s45 = .785398163397448, this.s90 = 2 * this.s45, this.fi0 = this.lat0, this.e2 = this.es, this.e = Math.sqrt(this.e2), this.alfa = Math.sqrt(1 + this.e2 * Math.cos(this.fi0) ** 4 / (1 - this.e2)), this.uq = 1.04216856380474, this.u0 = Math.asin(Math.sin(this.fi0) / this.alfa), this.g = ((1 + this.e * Math.sin(this.fi0)) / (1 - this.e * Math.sin(this.fi0))) ** (this.alfa * this.e / 2), this.k = Math.tan(this.u0 / 2 + this.s45) / Math.tan(this.fi0 / 2 + this.s45) ** +this.alfa * this.g, this.k1 = this.k0, this.n0 = this.a * Math.sqrt(1 - this.e2) / (1 - this.e2 * Math.sin(this.fi0) ** 2), this.s0 = 1.37008346281555, this.n = Math.sin(this.s0), this.ro0 = this.k1 * this.n0 / Math.tan(this.s0), this.ad = this.s90 - this.uq;
}
function hr(e) {
	var t, n, r, i, a, o, s, c = e.x, l = e.y, u = B(c - this.long0, this.over);
	return t = ((1 + this.e * Math.sin(l)) / (1 - this.e * Math.sin(l))) ** (this.alfa * this.e / 2), n = 2 * (Math.atan(this.k * Math.tan(l / 2 + this.s45) ** +this.alfa / t) - this.s45), r = -u * this.alfa, i = Math.asin(Math.cos(this.ad) * Math.sin(n) + Math.sin(this.ad) * Math.cos(n) * Math.cos(r)), a = Math.asin(Math.cos(n) * Math.sin(r) / Math.cos(i)), o = this.n * a, s = this.ro0 * Math.tan(this.s0 / 2 + this.s45) ** +this.n / Math.tan(i / 2 + this.s45) ** +this.n, e.y = s * Math.cos(o) / 1, e.x = s * Math.sin(o) / 1, this.czech || (e.y *= -1, e.x *= -1), e;
}
function gr(e) {
	var t, n, r, i, a, o, s, c, l = e.x;
	e.x = e.y, e.y = l, this.czech || (e.y *= -1, e.x *= -1), o = Math.sqrt(e.x * e.x + e.y * e.y), a = Math.atan2(e.y, e.x), i = a / Math.sin(this.s0), r = 2 * (Math.atan((this.ro0 / o) ** (1 / this.n) * Math.tan(this.s0 / 2 + this.s45)) - this.s45), t = Math.asin(Math.cos(this.ad) * Math.sin(r) - Math.sin(this.ad) * Math.cos(r) * Math.cos(i)), n = Math.asin(Math.cos(r) * Math.sin(i) / Math.cos(t)), e.x = this.long0 - n / this.alfa, s = t, c = 0;
	var u = 0;
	do
		e.y = 2 * (Math.atan(this.k ** (-1 / this.alfa) * Math.tan(t / 2 + this.s45) ** (1 / this.alfa) * ((1 + this.e * Math.sin(s)) / (1 - this.e * Math.sin(s))) ** (this.e / 2)) - this.s45), Math.abs(s - e.y) < 1e-10 && (c = 1), s = e.y, u += 1;
	while (c === 0 && u < 15);
	return u >= 15 ? null : e;
}
var _r = {
	init: mr,
	forward: hr,
	inverse: gr,
	names: [
		"Krovak",
		"Krovak Modified",
		"Krovak (North Orientated)",
		"Krovak Modified (North Orientated)",
		"krovak"
	]
};
//#endregion
//#region node_modules/proj4/lib/common/mlfn.js
function Y(e, t, n, r, i) {
	return e * i - t * Math.sin(2 * i) + n * Math.sin(4 * i) - r * Math.sin(6 * i);
}
//#endregion
//#region node_modules/proj4/lib/common/e0fn.js
function vr(e) {
	return 1 - .25 * e * (1 + e / 16 * (3 + 1.25 * e));
}
//#endregion
//#region node_modules/proj4/lib/common/e1fn.js
function yr(e) {
	return .375 * e * (1 + .25 * e * (1 + .46875 * e));
}
//#endregion
//#region node_modules/proj4/lib/common/e2fn.js
function br(e) {
	return .05859375 * e * e * (1 + .75 * e);
}
//#endregion
//#region node_modules/proj4/lib/common/e3fn.js
function xr(e) {
	return e * e * e * (35 / 3072);
}
//#endregion
//#region node_modules/proj4/lib/common/gN.js
function Sr(e, t, n) {
	var r = t * n;
	return e / Math.sqrt(1 - r * r);
}
//#endregion
//#region node_modules/proj4/lib/common/adjust_lat.js
function Cr(e) {
	return Math.abs(e) < s ? e : e - De(e) * Math.PI;
}
//#endregion
//#region node_modules/proj4/lib/common/imlfn.js
function wr(e, t, n, r, i) {
	for (var a = e / t, o, s = 0; s < 15; s++) if (o = (e - (t * a - n * Math.sin(2 * a) + r * Math.sin(4 * a) - i * Math.sin(6 * a))) / (t - 2 * n * Math.cos(2 * a) + 4 * r * Math.cos(4 * a) - 6 * i * Math.cos(6 * a)), a += o, Math.abs(o) <= 1e-10) return a;
	return NaN;
}
//#endregion
//#region node_modules/proj4/lib/projections/cass.js
function Tr() {
	this.sphere || (this.e0 = vr(this.es), this.e1 = yr(this.es), this.e2 = br(this.es), this.e3 = xr(this.es), this.ml0 = this.a * Y(this.e0, this.e1, this.e2, this.e3, this.lat0));
}
function Er(e) {
	var t, n, r = e.x, i = e.y;
	if (r = B(r - this.long0, this.over), this.sphere) t = this.a * Math.asin(Math.cos(i) * Math.sin(r)), n = this.a * (Math.atan2(Math.tan(i), Math.cos(r)) - this.lat0);
	else {
		var a = Math.sin(i), o = Math.cos(i), s = Sr(this.a, this.e, a), c = Math.tan(i) * Math.tan(i), l = r * Math.cos(i), u = l * l, d = this.es * o * o / (1 - this.es), f = this.a * Y(this.e0, this.e1, this.e2, this.e3, i);
		t = s * l * (1 - u * c * (1 / 6 - (8 - c + 8 * d) * u / 120)), n = f - this.ml0 + s * a / o * u * (.5 + (5 - c + 6 * d) * u / 24);
	}
	return e.x = t + this.x0, e.y = n + this.y0, e;
}
function Dr(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t = e.x / this.a, n = e.y / this.a, r, i;
	if (this.sphere) {
		var a = n + this.lat0;
		r = Math.asin(Math.sin(a) * Math.cos(t)), i = Math.atan2(Math.tan(t), Math.cos(a));
	} else {
		var o = wr(this.ml0 / this.a + n, this.e0, this.e1, this.e2, this.e3);
		if (Math.abs(Math.abs(o) - s) <= 1e-10) return e.x = this.long0, e.y = s, n < 0 && (e.y *= -1), e;
		var c = Sr(this.a, this.e, Math.sin(o)), l = c * c * c / this.a / this.a * (1 - this.es), u = Math.tan(o) ** 2, d = t * this.a / c, f = d * d;
		r = o - c * Math.tan(o) / l * d * d * (.5 - (1 + 3 * u) * d * d / 24), i = d * (1 - f * (u / 3 + (1 + 3 * u) * u * f / 15)) / Math.cos(o);
	}
	return e.x = B(i + this.long0, this.over), e.y = Cr(r), e;
}
var Or = {
	init: Tr,
	forward: Er,
	inverse: Dr,
	names: [
		"Cassini",
		"Cassini_Soldner",
		"cass"
	]
};
//#endregion
//#region node_modules/proj4/lib/common/qsfnz.js
function kr(e, t) {
	var n;
	return e > 1e-7 ? (n = e * t, (1 - e * e) * (t / (1 - n * n) - .5 / e * Math.log((1 - n) / (1 + n)))) : 2 * t;
}
//#endregion
//#region node_modules/proj4/lib/common/authset.js
var Ar = .3333333333333333, jr = .17222222222222222, Mr = .10257936507936508, Nr = .06388888888888888, Pr = .0664021164021164, Fr = .016415012942191543;
function Ir(e) {
	var t, n = [];
	return n[0] = e * Ar, t = e * e, n[0] += t * jr, n[1] = t * Nr, t *= e, n[0] += t * Mr, n[1] += t * Pr, n[2] = t * Fr, n;
}
//#endregion
//#region node_modules/proj4/lib/common/authlat.js
function Lr(e, t) {
	var n = e + e;
	return e + t[0] * Math.sin(n) + t[1] * Math.sin(n + n) + t[2] * Math.sin(n + n + n);
}
function Rr() {
	var e = Math.abs(this.lat0);
	if (Math.abs(e - s) < 1e-10 ? this.mode = this.lat0 < 0 ? 1 : 2 : Math.abs(e) < 1e-10 ? this.mode = 3 : this.mode = 4, this.es > 0) {
		var t;
		switch (this.qp = kr(this.e, 1), this.mmf = .5 / (1 - this.es), this.apa = Ir(this.es), this.mode) {
			case 2:
				this.dd = 1;
				break;
			case 1:
				this.dd = 1;
				break;
			case 3:
				this.rq = Math.sqrt(.5 * this.qp), this.dd = 1 / this.rq, this.xmf = 1, this.ymf = .5 * this.qp;
				break;
			case 4:
				this.rq = Math.sqrt(.5 * this.qp), t = Math.sin(this.lat0), this.sinb1 = kr(this.e, t) / this.qp, this.cosb1 = Math.sqrt(1 - this.sinb1 * this.sinb1), this.dd = Math.cos(this.lat0) / (Math.sqrt(1 - this.es * t * t) * this.rq * this.cosb1), this.ymf = (this.xmf = this.rq) / this.dd, this.xmf *= this.dd;
				break;
		}
	} else this.mode === 4 && (this.sinph0 = Math.sin(this.lat0), this.cosph0 = Math.cos(this.lat0));
}
function zr(e) {
	var t, n, r, i, a, o, c, l, u, d, f = e.x, p = e.y;
	if (f = B(f - this.long0, this.over), this.sphere) {
		if (a = Math.sin(p), d = Math.cos(p), r = Math.cos(f), this.mode === this.OBLIQ || this.mode === this.EQUIT) {
			if (n = this.mode === this.EQUIT ? 1 + d * r : 1 + this.sinph0 * a + this.cosph0 * d * r, n <= 1e-10) return null;
			n = Math.sqrt(2 / n), t = n * d * Math.sin(f), n *= this.mode === this.EQUIT ? a : this.cosph0 * a - this.sinph0 * d * r;
		} else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
			if (this.mode === this.N_POLE && (r = -r), Math.abs(p + this.lat0) < 1e-10) return null;
			n = m - p * .5, n = 2 * (this.mode === this.S_POLE ? Math.cos(n) : Math.sin(n)), t = n * Math.sin(f), n *= r;
		}
	} else {
		switch (c = 0, l = 0, u = 0, r = Math.cos(f), i = Math.sin(f), a = Math.sin(p), o = kr(this.e, a), (this.mode === this.OBLIQ || this.mode === this.EQUIT) && (c = o / this.qp, l = Math.sqrt(1 - c * c)), this.mode) {
			case this.OBLIQ:
				u = 1 + this.sinb1 * c + this.cosb1 * l * r;
				break;
			case this.EQUIT:
				u = 1 + l * r;
				break;
			case this.N_POLE:
				u = s + p, o = this.qp - o;
				break;
			case this.S_POLE:
				u = p - s, o = this.qp + o;
				break;
		}
		if (Math.abs(u) < 1e-10) return null;
		switch (this.mode) {
			case this.OBLIQ:
			case this.EQUIT:
				u = Math.sqrt(2 / u), n = this.mode === this.OBLIQ ? this.ymf * u * (this.cosb1 * c - this.sinb1 * l * r) : (u = Math.sqrt(2 / (1 + l * r))) * c * this.ymf, t = this.xmf * u * l * i;
				break;
			case this.N_POLE:
			case this.S_POLE:
				o >= 0 ? (t = (u = Math.sqrt(o)) * i, n = r * (this.mode === this.S_POLE ? u : -u)) : t = n = 0;
				break;
		}
	}
	return e.x = this.a * t + this.x0, e.y = this.a * n + this.y0, e;
}
function Br(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t = e.x / this.a, n = e.y / this.a, r, i, a, o, c, l, u;
	if (this.sphere) {
		var d = 0, f, p = 0;
		if (f = Math.sqrt(t * t + n * n), i = f * .5, i > 1) return null;
		switch (i = 2 * Math.asin(i), (this.mode === this.OBLIQ || this.mode === this.EQUIT) && (p = Math.sin(i), d = Math.cos(i)), this.mode) {
			case this.EQUIT:
				i = Math.abs(f) <= 1e-10 ? 0 : Math.asin(n * p / f), t *= p, n = d * f;
				break;
			case this.OBLIQ:
				i = Math.abs(f) <= 1e-10 ? this.lat0 : Math.asin(d * this.sinph0 + n * p * this.cosph0 / f), t *= p * this.cosph0, n = (d - Math.sin(i) * this.sinph0) * f;
				break;
			case this.N_POLE:
				n = -n, i = s - i;
				break;
			case this.S_POLE:
				i -= s;
				break;
		}
		r = n === 0 && (this.mode === this.EQUIT || this.mode === this.OBLIQ) ? 0 : Math.atan2(t, n);
	} else {
		if (u = 0, this.mode === this.OBLIQ || this.mode === this.EQUIT) {
			if (t /= this.dd, n *= this.dd, l = Math.sqrt(t * t + n * n), l < 1e-10) return e.x = this.long0, e.y = this.lat0, e;
			o = 2 * Math.asin(.5 * l / this.rq), a = Math.cos(o), t *= o = Math.sin(o), this.mode === this.OBLIQ ? (u = a * this.sinb1 + n * o * this.cosb1 / l, c = this.qp * u, n = l * this.cosb1 * a - n * this.sinb1 * o) : (u = n * o / l, c = this.qp * u, n = l * a);
		} else if (this.mode === this.N_POLE || this.mode === this.S_POLE) {
			if (this.mode === this.N_POLE && (n = -n), c = t * t + n * n, !c) return e.x = this.long0, e.y = this.lat0, e;
			u = 1 - c / this.qp, this.mode === this.S_POLE && (u = -u);
		}
		r = Math.atan2(t, n), i = Lr(Math.asin(u), this.apa);
	}
	return e.x = B(this.long0 + r, this.over), e.y = i, e;
}
var Vr = {
	init: Rr,
	forward: zr,
	inverse: Br,
	names: [
		"Lambert Azimuthal Equal Area",
		"Lambert_Azimuthal_Equal_Area",
		"laea"
	],
	S_POLE: 1,
	N_POLE: 2,
	EQUIT: 3,
	OBLIQ: 4
};
//#endregion
//#region node_modules/proj4/lib/common/asinz.js
function Hr(e) {
	return Math.abs(e) > 1 && (e = e > 1 ? 1 : -1), Math.asin(e);
}
//#endregion
//#region node_modules/proj4/lib/projections/aea.js
function Ur() {
	Math.abs(this.lat1 + this.lat2) < 1e-10 || (this.temp = this.b / this.a, this.es = 1 - this.temp ** 2, this.e3 = Math.sqrt(this.es), this.sin_po = Math.sin(this.lat1), this.cos_po = Math.cos(this.lat1), this.t1 = this.sin_po, this.con = this.sin_po, this.ms1 = z(this.e3, this.sin_po, this.cos_po), this.qs1 = kr(this.e3, this.sin_po), this.sin_po = Math.sin(this.lat2), this.cos_po = Math.cos(this.lat2), this.t2 = this.sin_po, this.ms2 = z(this.e3, this.sin_po, this.cos_po), this.qs2 = kr(this.e3, this.sin_po), this.sin_po = Math.sin(this.lat0), this.cos_po = Math.cos(this.lat0), this.t3 = this.sin_po, this.qs0 = kr(this.e3, this.sin_po), Math.abs(this.lat1 - this.lat2) > 1e-10 ? this.ns0 = (this.ms1 * this.ms1 - this.ms2 * this.ms2) / (this.qs2 - this.qs1) : this.ns0 = this.con, this.c = this.ms1 * this.ms1 + this.ns0 * this.qs1, this.rh = this.a * Math.sqrt(this.c - this.ns0 * this.qs0) / this.ns0);
}
function Wr(e) {
	var t = e.x, n = e.y;
	this.sin_phi = Math.sin(n), this.cos_phi = Math.cos(n);
	var r = kr(this.e3, this.sin_phi), i = this.a * Math.sqrt(this.c - this.ns0 * r) / this.ns0, a = this.ns0 * B(t - this.long0, this.over), o = i * Math.sin(a) + this.x0, s = this.rh - i * Math.cos(a) + this.y0;
	return e.x = o, e.y = s, e;
}
function Gr(e) {
	var t, n, r, i, a, o;
	return e.x -= this.x0, e.y = this.rh - e.y + this.y0, this.ns0 >= 0 ? (t = Math.sqrt(e.x * e.x + e.y * e.y), r = 1) : (t = -Math.sqrt(e.x * e.x + e.y * e.y), r = -1), i = 0, t !== 0 && (i = Math.atan2(r * e.x, r * e.y)), r = t * this.ns0 / this.a, this.sphere ? o = Math.asin((this.c - r * r) / (2 * this.ns0)) : (n = (this.c - r * r) / this.ns0, o = this.phi1z(this.e3, n)), a = B(i / this.ns0 + this.long0, this.over), e.x = a, e.y = o, e;
}
function Kr(e, t) {
	var n, r, i, a, o, s = Hr(.5 * t);
	if (e < 1e-10) return s;
	for (var c = e * e, l = 1; l <= 25; l++) if (n = Math.sin(s), r = Math.cos(s), i = e * n, a = 1 - i * i, o = .5 * a * a / r * (t / (1 - c) - n / a + .5 / e * Math.log((1 - i) / (1 + i))), s += o, Math.abs(o) <= 1e-7) return s;
	return null;
}
var qr = {
	init: Ur,
	forward: Wr,
	inverse: Gr,
	names: [
		"Albers_Conic_Equal_Area",
		"Albers_Equal_Area",
		"Albers",
		"aea"
	],
	phi1z: Kr
};
//#endregion
//#region node_modules/proj4/lib/projections/gnom.js
function Jr() {
	this.sin_p14 = Math.sin(this.lat0), this.cos_p14 = Math.cos(this.lat0), this.infinity_dist = 1e3 * this.a, this.rc = 1;
}
function Yr(e) {
	var t, n, r, i, a, o, s, c, l = e.x, u = e.y;
	return r = B(l - this.long0, this.over), t = Math.sin(u), n = Math.cos(u), i = Math.cos(r), o = this.sin_p14 * t + this.cos_p14 * n * i, a = 1, o > 0 || Math.abs(o) <= 1e-10 ? (s = this.x0 + this.a * a * n * Math.sin(r) / o, c = this.y0 + this.a * a * (this.cos_p14 * t - this.sin_p14 * n * i) / o) : (s = this.x0 + this.infinity_dist * n * Math.sin(r), c = this.y0 + this.infinity_dist * (this.cos_p14 * t - this.sin_p14 * n * i)), e.x = s, e.y = c, e;
}
function Xr(e) {
	var t, n, r, i, a, o;
	return e.x = (e.x - this.x0) / this.a, e.y = (e.y - this.y0) / this.a, e.x /= this.k0, e.y /= this.k0, (t = Math.sqrt(e.x * e.x + e.y * e.y)) ? (i = Math.atan2(t, this.rc), n = Math.sin(i), r = Math.cos(i), o = Hr(r * this.sin_p14 + e.y * n * this.cos_p14 / t), a = Math.atan2(e.x * n, t * this.cos_p14 * r - e.y * this.sin_p14 * n), a = B(this.long0 + a, this.over)) : (o = this.phic0, a = 0), e.x = a, e.y = o, e;
}
var Zr = {
	init: Jr,
	forward: Yr,
	inverse: Xr,
	names: ["gnom"]
};
//#endregion
//#region node_modules/proj4/lib/common/iqsfnz.js
function Qr(e, t) {
	var n = 1 - (1 - e * e) / (2 * e) * Math.log((1 - e) / (1 + e));
	if (Math.abs(Math.abs(t) - n) < 1e-6) return t < 0 ? -1 * s : s;
	for (var r = Math.asin(.5 * t), i, a, o, c, l = 0; l < 30; l++) if (a = Math.sin(r), o = Math.cos(r), c = e * a, i = (1 - c * c) ** 2 / (2 * o) * (t / (1 - e * e) - a / (1 - c * c) + .5 / e * Math.log((1 - c) / (1 + c))), r += i, Math.abs(i) <= 1e-10) return r;
	return NaN;
}
//#endregion
//#region node_modules/proj4/lib/projections/cea.js
function $r() {
	this.sphere || (this.k0 = z(this.e, Math.sin(this.lat_ts), Math.cos(this.lat_ts)));
}
function ei(e) {
	var t = e.x, n = e.y, r, i, a = B(t - this.long0, this.over);
	if (this.sphere) r = this.x0 + this.a * a * Math.cos(this.lat_ts), i = this.y0 + this.a * Math.sin(n) / Math.cos(this.lat_ts);
	else {
		var o = kr(this.e, Math.sin(n));
		r = this.x0 + this.a * this.k0 * a, i = this.y0 + this.a * o * .5 / this.k0;
	}
	return e.x = r, e.y = i, e;
}
function ti(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t, n;
	return this.sphere ? (t = B(this.long0 + e.x / this.a / Math.cos(this.lat_ts), this.over), n = Math.asin(e.y / this.a * Math.cos(this.lat_ts))) : (n = Qr(this.e, 2 * e.y * this.k0 / this.a), t = B(this.long0 + e.x / (this.a * this.k0), this.over)), e.x = t, e.y = n, e;
}
var ni = {
	init: $r,
	forward: ei,
	inverse: ti,
	names: ["cea"]
};
//#endregion
//#region node_modules/proj4/lib/projections/eqc.js
function ri() {
	this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.lat_ts = this.lat_ts || 0, this.title = this.title || "Equidistant Cylindrical (Plate Carre)", this.rc = Math.cos(this.lat_ts);
}
function ii(e) {
	var t = e.x, n = e.y, r = B(t - this.long0, this.over), i = Cr(n - this.lat0);
	return e.x = this.x0 + this.a * r * this.rc, e.y = this.y0 + this.a * i, e;
}
function ai(e) {
	var t = e.x, n = e.y;
	return e.x = B(this.long0 + (t - this.x0) / (this.a * this.rc), this.over), e.y = Cr(this.lat0 + (n - this.y0) / this.a), e;
}
var oi = {
	init: ri,
	forward: ii,
	inverse: ai,
	names: [
		"Equirectangular",
		"Equidistant_Cylindrical",
		"Equidistant_Cylindrical_Spherical",
		"eqc"
	]
}, si = 20;
function ci() {
	this.temp = this.b / this.a, this.es = 1 - this.temp ** 2, this.e = Math.sqrt(this.es), this.e0 = vr(this.es), this.e1 = yr(this.es), this.e2 = br(this.es), this.e3 = xr(this.es), this.ml0 = this.a * Y(this.e0, this.e1, this.e2, this.e3, this.lat0);
}
function li(e) {
	var t = e.x, n = e.y, r, i, a, o = B(t - this.long0, this.over);
	if (a = o * Math.sin(n), this.sphere) Math.abs(n) <= 1e-10 ? (r = this.a * o, i = -1 * this.a * this.lat0) : (r = this.a * Math.sin(a) / Math.tan(n), i = this.a * (Cr(n - this.lat0) + (1 - Math.cos(a)) / Math.tan(n)));
	else if (Math.abs(n) <= 1e-10) r = this.a * o, i = -1 * this.ml0;
	else {
		var s = Sr(this.a, this.e, Math.sin(n)) / Math.tan(n);
		r = s * Math.sin(a), i = this.a * Y(this.e0, this.e1, this.e2, this.e3, n) - this.ml0 + s * (1 - Math.cos(a));
	}
	return e.x = r + this.x0, e.y = i + this.y0, e;
}
function ui(e) {
	var t, n, r = e.x - this.x0, i = e.y - this.y0, a, o, s, c, l;
	if (this.sphere) if (Math.abs(i + this.a * this.lat0) <= 1e-10) t = B(r / this.a + this.long0, this.over), n = 0;
	else {
		o = this.lat0 + i / this.a, s = r * r / this.a / this.a + o * o, c = o;
		var u;
		for (a = si; a; --a) if (u = Math.tan(c), l = -1 * (o * (c * u + 1) - c - .5 * (c * c + s) * u) / ((c - o) / u - 1), c += l, Math.abs(l) <= 1e-10) {
			n = c;
			break;
		}
		t = B(this.long0 + Math.asin(r * Math.tan(c) / this.a) / Math.sin(n), this.over);
	}
	else if (Math.abs(i + this.ml0) <= 1e-10) n = 0, t = B(this.long0 + r / this.a, this.over);
	else {
		o = (this.ml0 + i) / this.a, s = r * r / this.a / this.a + o * o, c = o;
		var d, f, p, m, h;
		for (a = si; a; --a) if (h = this.e * Math.sin(c), d = Math.sqrt(1 - h * h) * Math.tan(c), f = this.a * Y(this.e0, this.e1, this.e2, this.e3, c), p = this.e0 - 2 * this.e1 * Math.cos(2 * c) + 4 * this.e2 * Math.cos(4 * c) - 6 * this.e3 * Math.cos(6 * c), m = f / this.a, l = (o * (d * m + 1) - m - .5 * d * (m * m + s)) / (this.es * Math.sin(2 * c) * (m * m + s - 2 * o * m) / (4 * d) + (o - m) * (d * p - 2 / Math.sin(2 * c)) - p), c -= l, Math.abs(l) <= 1e-10) {
			n = c;
			break;
		}
		d = Math.sqrt(1 - this.es * Math.sin(n) ** 2) * Math.tan(n), t = B(this.long0 + Math.asin(r * d / this.a) / Math.sin(n), this.over);
	}
	return e.x = t, e.y = n, e;
}
var di = {
	init: ci,
	forward: li,
	inverse: ui,
	names: [
		"Polyconic",
		"American_Polyconic",
		"poly"
	]
};
//#endregion
//#region node_modules/proj4/lib/projections/nzmg.js
function fi() {
	this.A = [], this.A[1] = .6399175073, this.A[2] = -.1358797613, this.A[3] = .063294409, this.A[4] = -.02526853, this.A[5] = .0117879, this.A[6] = -.0055161, this.A[7] = .0026906, this.A[8] = -.001333, this.A[9] = 67e-5, this.A[10] = -34e-5, this.B_re = [], this.B_im = [], this.B_re[1] = .7557853228, this.B_im[1] = 0, this.B_re[2] = .249204646, this.B_im[2] = .003371507, this.B_re[3] = -.001541739, this.B_im[3] = .04105856, this.B_re[4] = -.10162907, this.B_im[4] = .01727609, this.B_re[5] = -.26623489, this.B_im[5] = -.36249218, this.B_re[6] = -.6870983, this.B_im[6] = -1.1651967, this.C_re = [], this.C_im = [], this.C_re[1] = 1.3231270439, this.C_im[1] = 0, this.C_re[2] = -.577245789, this.C_im[2] = -.007809598, this.C_re[3] = .508307513, this.C_im[3] = -.112208952, this.C_re[4] = -.15094762, this.C_im[4] = .18200602, this.C_re[5] = 1.01418179, this.C_im[5] = 1.64497696, this.C_re[6] = 1.9660549, this.C_im[6] = 2.5127645, this.D = [], this.D[1] = 1.5627014243, this.D[2] = .5185406398, this.D[3] = -.03333098, this.D[4] = -.1052906, this.D[5] = -.0368594, this.D[6] = .007317, this.D[7] = .0122, this.D[8] = .00394, this.D[9] = -.0013;
}
function pi(e) {
	var t, n = e.x, r = e.y - this.lat0, i = n - this.long0, a = r / o * 1e-5, s = i, c = 1, l = 0;
	for (t = 1; t <= 10; t++) c *= a, l += this.A[t] * c;
	var u = l, d = s, f = 1, p = 0, m, h, g = 0, _ = 0;
	for (t = 1; t <= 6; t++) m = f * u - p * d, h = p * u + f * d, f = m, p = h, g = g + this.B_re[t] * f - this.B_im[t] * p, _ = _ + this.B_im[t] * f + this.B_re[t] * p;
	return e.x = _ * this.a + this.x0, e.y = g * this.a + this.y0, e;
}
function mi(e) {
	var t, n = e.x, r = e.y, i = n - this.x0, a = (r - this.y0) / this.a, s = i / this.a, c = 1, l = 0, u, d, f = 0, p = 0;
	for (t = 1; t <= 6; t++) u = c * a - l * s, d = l * a + c * s, c = u, l = d, f = f + this.C_re[t] * c - this.C_im[t] * l, p = p + this.C_im[t] * c + this.C_re[t] * l;
	for (var m = 0; m < this.iterations; m++) {
		var h = f, g = p, _, v, y = a, b = s;
		for (t = 2; t <= 6; t++) _ = h * f - g * p, v = g * f + h * p, h = _, g = v, y += (t - 1) * (this.B_re[t] * h - this.B_im[t] * g), b += (t - 1) * (this.B_im[t] * h + this.B_re[t] * g);
		h = 1, g = 0;
		var x = this.B_re[1], S = this.B_im[1];
		for (t = 2; t <= 6; t++) _ = h * f - g * p, v = g * f + h * p, h = _, g = v, x += t * (this.B_re[t] * h - this.B_im[t] * g), S += t * (this.B_im[t] * h + this.B_re[t] * g);
		var C = x * x + S * S;
		f = (y * x + b * S) / C, p = (b * x - y * S) / C;
	}
	var w = f, T = p, E = 1, D = 0;
	for (t = 1; t <= 9; t++) E *= w, D += this.D[t] * E;
	var ee = this.lat0 + D * o * 1e5;
	return e.x = this.long0 + T, e.y = ee, e;
}
var hi = {
	init: fi,
	forward: pi,
	inverse: mi,
	names: ["New_Zealand_Map_Grid", "nzmg"]
};
//#endregion
//#region node_modules/proj4/lib/projections/mill.js
function gi() {}
function _i(e) {
	var t = e.x, n = e.y, r = B(t - this.long0, this.over), i = this.x0 + this.a * r, a = this.y0 + this.a * Math.log(Math.tan(Math.PI / 4 + n / 2.5)) * 1.25;
	return e.x = i, e.y = a, e;
}
function vi(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t = B(this.long0 + e.x / this.a, this.over), n = 2.5 * (Math.atan(Math.exp(.8 * e.y / this.a)) - Math.PI / 4);
	return e.x = t, e.y = n, e;
}
var yi = {
	init: gi,
	forward: _i,
	inverse: vi,
	names: ["Miller_Cylindrical", "mill"]
}, bi = 20;
function xi() {
	this.long0 = this.long0 || 0, this.sphere ? (this.n = 1, this.m = 0, this.es = 0, this.C_y = Math.sqrt((this.m + 1) / this.n), this.C_x = this.C_y / (this.m + 1)) : this.en = gn(this.es);
}
function Si(e) {
	var t, n, r = e.x, i = e.y;
	if (r = B(r - this.long0, this.over), this.sphere) {
		if (!this.m) i = this.n === 1 ? i : Math.asin(this.n * Math.sin(i));
		else for (var a = this.n * Math.sin(i), o = bi; o; --o) {
			var s = (this.m * i + Math.sin(i) - a) / (this.m + Math.cos(i));
			if (i -= s, Math.abs(s) < 1e-10) break;
		}
		t = this.a * this.C_x * r * (this.m + Math.cos(i)), n = this.a * this.C_y * i;
	} else {
		var c = Math.sin(i), l = Math.cos(i);
		n = this.a * _n(i, c, l, this.en), t = this.a * r * l / Math.sqrt(1 - this.es * c * c);
	}
	return e.x = t, e.y = n, e;
}
function Ci(e) {
	var t, n, r, i;
	return e.x -= this.x0, r = e.x / this.a, e.y -= this.y0, t = e.y / this.a, this.sphere ? (t /= this.C_y, r /= this.C_x * (this.m + Math.cos(t)), this.m ? t = Hr((this.m * t + Math.sin(t)) / this.n) : this.n !== 1 && (t = Hr(Math.sin(t) / this.n)), r = B(r + this.long0, this.over), t = Cr(t)) : (t = yn(e.y / this.a, this.es, this.en), i = Math.abs(t), i < s ? (i = Math.sin(t), n = this.long0 + e.x * Math.sqrt(1 - this.es * i * i) / (this.a * Math.cos(t)), r = B(n, this.over)) : i - 1e-10 < s && (r = this.long0)), e.x = r, e.y = t, e;
}
var wi = {
	init: xi,
	forward: Si,
	inverse: Ci,
	names: ["Sinusoidal", "sinu"]
};
//#endregion
//#region node_modules/proj4/lib/projections/eck6.js
function Ti() {
	this.sphere = !0, this.b = this.a, this.m = 1, this.n = 2.5707963267948966, this.es = 0, this.C_y = Math.sqrt((this.m + 1) / this.n), this.C_x = this.C_y / (this.m + 1);
}
var Ei = {
	init: Ti,
	forward: Si,
	inverse: Ci,
	names: ["Eckert_VI", "eck6"]
};
//#endregion
//#region node_modules/proj4/lib/projections/moll.js
function Di() {
	this.x0 = this.x0 === void 0 ? 0 : this.x0, this.y0 = this.y0 === void 0 ? 0 : this.y0, this.long0 = this.long0 === void 0 ? 0 : this.long0;
}
function Oi(e) {
	for (var t = e.x, n = e.y, r = B(t - this.long0, this.over), i = n, a = Math.PI * Math.sin(n);;) {
		var o = -(i + Math.sin(i) - a) / (1 + Math.cos(i));
		if (i += o, Math.abs(o) < 1e-10) break;
	}
	i /= 2, Math.PI / 2 - Math.abs(n) < 1e-10 && (r = 0);
	var s = .900316316158 * this.a * r * Math.cos(i) + this.x0, c = 1.4142135623731 * this.a * Math.sin(i) + this.y0;
	return e.x = s, e.y = c, e;
}
function ki(e) {
	var t, n;
	e.x -= this.x0, e.y -= this.y0, n = e.y / (1.4142135623731 * this.a), Math.abs(n) > .999999999999 && (n = .999999999999), t = Math.asin(n);
	var r = B(this.long0 + e.x / (.900316316158 * this.a * Math.cos(t)), this.over);
	r < -Math.PI && (r = -Math.PI), r > Math.PI && (r = Math.PI), n = (2 * t + Math.sin(2 * t)) / Math.PI, Math.abs(n) > 1 && (n = 1);
	var i = Math.asin(n);
	return e.x = r, e.y = i, e;
}
var Ai = {
	init: Di,
	forward: Oi,
	inverse: ki,
	names: ["Mollweide", "moll"]
};
//#endregion
//#region node_modules/proj4/lib/projections/eqdc.js
function ji() {
	Math.abs(this.lat1 + this.lat2) < 1e-10 || (this.lat2 = this.lat2 || this.lat1, this.temp = this.b / this.a, this.es = 1 - this.temp ** 2, this.e = Math.sqrt(this.es), this.e0 = vr(this.es), this.e1 = yr(this.es), this.e2 = br(this.es), this.e3 = xr(this.es), this.sin_phi = Math.sin(this.lat1), this.cos_phi = Math.cos(this.lat1), this.ms1 = z(this.e, this.sin_phi, this.cos_phi), this.ml1 = Y(this.e0, this.e1, this.e2, this.e3, this.lat1), Math.abs(this.lat1 - this.lat2) < 1e-10 ? this.ns = this.sin_phi : (this.sin_phi = Math.sin(this.lat2), this.cos_phi = Math.cos(this.lat2), this.ms2 = z(this.e, this.sin_phi, this.cos_phi), this.ml2 = Y(this.e0, this.e1, this.e2, this.e3, this.lat2), this.ns = (this.ms1 - this.ms2) / (this.ml2 - this.ml1)), this.g = this.ml1 + this.ms1 / this.ns, this.ml0 = Y(this.e0, this.e1, this.e2, this.e3, this.lat0), this.rh = this.a * (this.g - this.ml0));
}
function Mi(e) {
	var t = e.x, n = e.y, r;
	if (this.sphere) r = this.a * (this.g - n);
	else {
		var i = Y(this.e0, this.e1, this.e2, this.e3, n);
		r = this.a * (this.g - i);
	}
	var a = this.ns * B(t - this.long0, this.over), o = this.x0 + r * Math.sin(a), s = this.y0 + this.rh - r * Math.cos(a);
	return e.x = o, e.y = s, e;
}
function Ni(e) {
	e.x -= this.x0, e.y = this.rh - e.y + this.y0;
	var t, n, r, i;
	this.ns >= 0 ? (n = Math.sqrt(e.x * e.x + e.y * e.y), t = 1) : (n = -Math.sqrt(e.x * e.x + e.y * e.y), t = -1);
	var a = 0;
	return n !== 0 && (a = Math.atan2(t * e.x, t * e.y)), this.sphere ? (i = B(this.long0 + a / this.ns, this.over), r = Cr(this.g - n / this.a), e.x = i, e.y = r, e) : (r = wr(this.g - n / this.a, this.e0, this.e1, this.e2, this.e3), i = B(this.long0 + a / this.ns, this.over), e.x = i, e.y = r, e);
}
var Pi = {
	init: ji,
	forward: Mi,
	inverse: Ni,
	names: ["Equidistant_Conic", "eqdc"]
};
//#endregion
//#region node_modules/proj4/lib/projections/vandg.js
function Fi() {
	this.R = this.a;
}
function Ii(e) {
	var t = e.x, n = e.y, r = B(t - this.long0, this.over), i, a;
	Math.abs(n) <= 1e-10 && (i = this.x0 + this.R * r, a = this.y0);
	var o = Hr(2 * Math.abs(n / Math.PI));
	(Math.abs(r) <= 1e-10 || Math.abs(Math.abs(n) - s) <= 1e-10) && (i = this.x0, a = n >= 0 ? this.y0 + Math.PI * this.R * Math.tan(.5 * o) : this.y0 + Math.PI * this.R * -Math.tan(.5 * o));
	var c = .5 * Math.abs(Math.PI / r - r / Math.PI), l = c * c, u = Math.sin(o), d = Math.cos(o), f = d / (u + d - 1), p = f * f, m = f * (2 / u - 1), h = m * m, g = Math.PI * this.R * (c * (f - h) + Math.sqrt(l * (f - h) * (f - h) - (h + l) * (p - h))) / (h + l);
	r < 0 && (g = -g), i = this.x0 + g;
	var _ = l + f;
	return g = Math.PI * this.R * (m * _ - c * Math.sqrt((h + l) * (l + 1) - _ * _)) / (h + l), a = n >= 0 ? this.y0 + g : this.y0 - g, e.x = i, e.y = a, e;
}
function Li(e) {
	var t, n, r, i, a, o, s, c, l, u, d, f, p;
	return e.x -= this.x0, e.y -= this.y0, d = Math.PI * this.R, r = e.x / d, i = e.y / d, a = r * r + i * i, o = -Math.abs(i) * (1 + a), s = o - 2 * i * i + r * r, c = -2 * o + 1 + 2 * i * i + a * a, p = i * i / c + (2 * s * s * s / c / c / c - 9 * o * s / c / c) / 27, l = (o - s * s / 3 / c) / c, u = 2 * Math.sqrt(-l / 3), d = 3 * p / l / u, Math.abs(d) > 1 && (d = d >= 0 ? 1 : -1), f = Math.acos(d) / 3, n = e.y >= 0 ? (-u * Math.cos(f + Math.PI / 3) - s / 3 / c) * Math.PI : -(-u * Math.cos(f + Math.PI / 3) - s / 3 / c) * Math.PI, t = Math.abs(r) < 1e-10 ? this.long0 : B(this.long0 + Math.PI * (a - 1 + Math.sqrt(1 + 2 * (r * r - i * i) + a * a)) / 2 / r, this.over), e.x = t, e.y = n, e;
}
var Ri = {
	init: Fi,
	forward: Ii,
	inverse: Li,
	names: [
		"Van_der_Grinten_I",
		"VanDerGrinten",
		"Van_der_Grinten",
		"vandg"
	]
};
//#endregion
//#region node_modules/proj4/lib/common/vincenty.js
function zi(e, t, n, r, i, a) {
	let o = r - t, s = Math.atan((1 - a) * Math.tan(e)), c = Math.atan((1 - a) * Math.tan(n)), l = Math.sin(s), u = Math.cos(s), d = Math.sin(c), f = Math.cos(c), p = o, m, h = 100, g, _, v, y, b, x, S, C, w, T, E, D, ee, te;
	do {
		if (g = Math.sin(p), _ = Math.cos(p), v = Math.sqrt(f * g * (f * g) + (u * d - l * f * _) * (u * d - l * f * _)), v === 0) return {
			azi1: 0,
			s12: 0
		};
		y = l * d + u * f * _, b = Math.atan2(v, y), x = u * f * g / v, S = 1 - x * x, C = S === 0 ? 0 : y - 2 * l * d / S, w = a / 16 * S * (4 + a * (4 - 3 * S)), m = p, p = o + (1 - w) * a * x * (b + w * v * (C + w * y * (-1 + 2 * C * C)));
	} while (Math.abs(p - m) > 1e-12 && --h > 0);
	return h === 0 ? {
		azi1: NaN,
		s12: NaN
	} : (T = S * (i * i - i * (1 - a) * (i * (1 - a))) / (i * (1 - a) * (i * (1 - a))), E = 1 + T / 16384 * (4096 + T * (-768 + T * (320 - 175 * T))), D = T / 1024 * (256 + T * (-128 + T * (74 - 47 * T))), ee = D * v * (C + D / 4 * (y * (-1 + 2 * C * C) - D / 6 * C * (-3 + 4 * v * v) * (-3 + 4 * C * C))), te = i * (1 - a) * E * (b - ee), {
		azi1: Math.atan2(f * g, u * d - l * f * _),
		s12: te
	});
}
function Bi(e, t, n, r, i, a) {
	let o = Math.atan((1 - a) * Math.tan(e)), s = Math.sin(o), c = Math.cos(o), l = Math.sin(n), u = Math.cos(n), d = Math.atan2(s, c * u), f = c * l, p = 1 - f * f, m = p * (i * i - i * (1 - a) * (i * (1 - a))) / (i * (1 - a) * (i * (1 - a))), h = 1 + m / 16384 * (4096 + m * (-768 + m * (320 - 175 * m))), g = m / 1024 * (256 + m * (-128 + m * (74 - 47 * m))), _ = r / (i * (1 - a) * h), v, y = 100, b, x, S, C;
	do
		b = Math.cos(2 * d + _), x = Math.sin(_), S = Math.cos(_), C = g * x * (b + g / 4 * (S * (-1 + 2 * b * b) - g / 6 * b * (-3 + 4 * x * x) * (-3 + 4 * b * b))), v = _, _ = r / (i * (1 - a) * h) + C;
	while (Math.abs(_ - v) > 1e-12 && --y > 0);
	if (y === 0) return {
		lat2: NaN,
		lon2: NaN
	};
	let w = s * x - c * S * u, T = Math.atan2(s * S + c * x * u, (1 - a) * Math.sqrt(f * f + w * w)), E = Math.atan2(x * l, c * S - s * x * u), D = a / 16 * p * (4 + a * (4 - 3 * p));
	return {
		lat2: T,
		lon2: t + (E - (1 - D) * a * f * (_ + D * x * (b + D * S * (-1 + 2 * b * b))))
	};
}
//#endregion
//#region node_modules/proj4/lib/projections/aeqd.js
function Vi() {
	this.sin_p12 = Math.sin(this.lat0), this.cos_p12 = Math.cos(this.lat0), this.f = this.es / (1 + Math.sqrt(1 - this.es));
}
function Hi(e) {
	var t = e.x, n = e.y, r = Math.sin(e.y), i = Math.cos(e.y), a = B(t - this.long0, this.over), o, c, l, u, d, f, p, m, h, g, _;
	return this.sphere ? Math.abs(this.sin_p12 - 1) <= 1e-10 ? (e.x = this.x0 + this.a * (s - n) * Math.sin(a), e.y = this.y0 - this.a * (s - n) * Math.cos(a), e) : Math.abs(this.sin_p12 + 1) <= 1e-10 ? (e.x = this.x0 + this.a * (s + n) * Math.sin(a), e.y = this.y0 + this.a * (s + n) * Math.cos(a), e) : (h = this.sin_p12 * r + this.cos_p12 * i * Math.cos(a), p = Math.acos(h), m = p ? p / Math.sin(p) : 1, e.x = this.x0 + this.a * m * i * Math.sin(a), e.y = this.y0 + this.a * m * (this.cos_p12 * r - this.sin_p12 * i * Math.cos(a)), e) : (o = vr(this.es), c = yr(this.es), l = br(this.es), u = xr(this.es), Math.abs(this.sin_p12 - 1) <= 1e-10 ? (d = this.a * Y(o, c, l, u, s), f = this.a * Y(o, c, l, u, n), e.x = this.x0 + (d - f) * Math.sin(a), e.y = this.y0 - (d - f) * Math.cos(a), e) : Math.abs(this.sin_p12 + 1) <= 1e-10 ? (d = this.a * Y(o, c, l, u, s), f = this.a * Y(o, c, l, u, n), e.x = this.x0 + (d + f) * Math.sin(a), e.y = this.y0 + (d + f) * Math.cos(a), e) : Math.abs(t) < 1e-10 && Math.abs(n - this.lat0) < 1e-10 ? (e.x = e.y = 0, e) : (g = zi(this.lat0, this.long0, n, t, this.a, this.f), _ = g.azi1, e.x = g.s12 * Math.sin(_), e.y = g.s12 * Math.cos(_), e));
}
function Ui(e) {
	e.x -= this.x0, e.y -= this.y0;
	var t, n, r, i, a, o, c, l, u, d, f, p, m, h, g, _;
	return this.sphere ? (t = Math.sqrt(e.x * e.x + e.y * e.y), t > 2 * s * this.a ? void 0 : (n = t / this.a, r = Math.sin(n), i = Math.cos(n), a = this.long0, Math.abs(t) <= 1e-10 ? o = this.lat0 : (o = Hr(i * this.sin_p12 + e.y * r * this.cos_p12 / t), c = Math.abs(this.lat0) - s, a = Math.abs(c) <= 1e-10 ? this.lat0 >= 0 ? B(this.long0 + Math.atan2(e.x, -e.y), this.over) : B(this.long0 - Math.atan2(-e.x, e.y), this.over) : B(this.long0 + Math.atan2(e.x * r, t * this.cos_p12 * i - e.y * this.sin_p12 * r), this.over)), e.x = a, e.y = o, e)) : (l = vr(this.es), u = yr(this.es), d = br(this.es), f = xr(this.es), Math.abs(this.sin_p12 - 1) <= 1e-10 ? (p = this.a * Y(l, u, d, f, s), t = Math.sqrt(e.x * e.x + e.y * e.y), m = p - t, o = wr(m / this.a, l, u, d, f), a = B(this.long0 + Math.atan2(e.x, -1 * e.y), this.over), e.x = a, e.y = o, e) : Math.abs(this.sin_p12 + 1) <= 1e-10 ? (p = this.a * Y(l, u, d, f, s), t = Math.sqrt(e.x * e.x + e.y * e.y), m = t - p, o = wr(m / this.a, l, u, d, f), a = B(this.long0 + Math.atan2(e.x, e.y), this.over), e.x = a, e.y = o, e) : (h = Math.atan2(e.x, e.y), g = Math.sqrt(e.x * e.x + e.y * e.y), _ = Bi(this.lat0, this.long0, h, g, this.a, this.f), e.x = _.lon2, e.y = _.lat2, e));
}
var Wi = {
	init: Vi,
	forward: Hi,
	inverse: Ui,
	names: ["Azimuthal_Equidistant", "aeqd"]
};
//#endregion
//#region node_modules/proj4/lib/projections/ortho.js
function Gi() {
	this.sin_p14 = Math.sin(this.lat0 || 0), this.cos_p14 = Math.cos(this.lat0 || 0);
}
function Ki(e) {
	var t, n, r, i, a, o, s, c, l = e.x, u = e.y;
	return r = B(l - (this.long0 || 0), this.over), t = Math.sin(u), n = Math.cos(u), i = Math.cos(r), o = this.sin_p14 * t + this.cos_p14 * n * i, a = 1, (o > 0 || Math.abs(o) <= 1e-10) && (s = this.a * a * n * Math.sin(r), c = (this.y0 || 0) + this.a * a * (this.cos_p14 * t - this.sin_p14 * n * i)), e.x = s, e.y = c, e;
}
function qi(e) {
	var t, n, r, i, a, o, c, l, u;
	return e.x -= this.x0 || 0, e.y -= this.y0 || 0, t = Math.sqrt(e.x * e.x + e.y * e.y), n = Hr(t / this.a), r = Math.sin(n), i = Math.cos(n), l = this.long0 || 0, u = this.lat0 || 0, o = l, Math.abs(t) <= 1e-10 ? (c = u, e.x = o, e.y = c, e) : (c = Hr(i * this.sin_p14 + e.y * r * this.cos_p14 / t), a = Math.abs(u) - s, Math.abs(a) <= 1e-10 ? (o = B(u >= 0 ? l + Math.atan2(e.x, -e.y) : l - Math.atan2(-e.x, e.y), this.over), e.x = o, e.y = c, e) : (o = B(l + Math.atan2(e.x * r, t * this.cos_p14 * i - e.y * this.sin_p14 * r), this.over), e.x = o, e.y = c, e));
}
var Ji = {
	init: Gi,
	forward: Ki,
	inverse: qi,
	names: ["ortho"]
}, X = {
	FRONT: 1,
	RIGHT: 2,
	BACK: 3,
	LEFT: 4,
	TOP: 5,
	BOTTOM: 6
}, Z = {
	AREA_0: 1,
	AREA_1: 2,
	AREA_2: 3,
	AREA_3: 4
};
function Yi() {
	this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.lat0 = this.lat0 || 0, this.long0 = this.long0 || 0, this.lat_ts = this.lat_ts || 0, this.title = this.title || "Quadrilateralized Spherical Cube", this.lat0 >= s - m / 2 ? this.face = X.TOP : this.lat0 <= -(s - m / 2) ? this.face = X.BOTTOM : Math.abs(this.long0) <= m ? this.face = X.FRONT : Math.abs(this.long0) <= s + m ? this.face = this.long0 > 0 ? X.RIGHT : X.LEFT : this.face = X.BACK, this.es !== 0 && (this.one_minus_f = 1 - (this.a - this.b) / this.a, this.one_minus_f_squared = this.one_minus_f * this.one_minus_f);
}
function Xi(e) {
	var t = {
		x: 0,
		y: 0
	}, n, r, i, a, o, c, l = { value: 0 };
	if (e.x -= this.long0, n = this.es === 0 ? e.y : Math.atan(this.one_minus_f_squared * Math.tan(e.y)), r = e.x, this.face === X.TOP) a = s - n, r >= m && r <= s + m ? (l.value = Z.AREA_0, i = r - s) : r > s + m || r <= -(s + m) ? (l.value = Z.AREA_1, i = r > 0 ? r - g : r + g) : r > -(s + m) && r <= -m ? (l.value = Z.AREA_2, i = r + s) : (l.value = Z.AREA_3, i = r);
	else if (this.face === X.BOTTOM) a = s + n, r >= m && r <= s + m ? (l.value = Z.AREA_0, i = -r + s) : r < m && r >= -m ? (l.value = Z.AREA_1, i = -r) : r < -m && r >= -(s + m) ? (l.value = Z.AREA_2, i = -r - s) : (l.value = Z.AREA_3, i = r > 0 ? -r + g : -r - g);
	else {
		var u, d, f, p, h, _, v;
		this.face === X.RIGHT ? r = $i(r, +s) : this.face === X.BACK ? r = $i(r, +g) : this.face === X.LEFT && (r = $i(r, -s)), p = Math.sin(n), h = Math.cos(n), _ = Math.sin(r), v = Math.cos(r), u = h * v, d = h * _, f = p, this.face === X.FRONT ? (a = Math.acos(u), i = Qi(a, f, d, l)) : this.face === X.RIGHT ? (a = Math.acos(d), i = Qi(a, f, -u, l)) : this.face === X.BACK ? (a = Math.acos(-u), i = Qi(a, f, -d, l)) : this.face === X.LEFT ? (a = Math.acos(-d), i = Qi(a, f, u, l)) : (a = i = 0, l.value = Z.AREA_0);
	}
	return c = Math.atan(12 / g * (i + Math.acos(Math.sin(i) * Math.cos(m)) - s)), o = Math.sqrt((1 - Math.cos(a)) / (Math.cos(c) * Math.cos(c)) / (1 - Math.cos(Math.atan(1 / Math.cos(i))))), l.value === Z.AREA_1 ? c += s : l.value === Z.AREA_2 ? c += g : l.value === Z.AREA_3 && (c += 1.5 * g), t.x = o * Math.cos(c), t.y = o * Math.sin(c), t.x = t.x * this.a + this.x0, t.y = t.y * this.a + this.y0, e.x = t.x, e.y = t.y, e;
}
function Zi(e) {
	var t = {
		lam: 0,
		phi: 0
	}, n, r, i, a, o, c, l, u, d, f = { value: 0 };
	if (e.x = (e.x - this.x0) / this.a, e.y = (e.y - this.y0) / this.a, r = Math.atan(Math.sqrt(e.x * e.x + e.y * e.y)), n = Math.atan2(e.y, e.x), e.x >= 0 && e.x >= Math.abs(e.y) ? f.value = Z.AREA_0 : e.y >= 0 && e.y >= Math.abs(e.x) ? (f.value = Z.AREA_1, n -= s) : e.x < 0 && -e.x >= Math.abs(e.y) ? (f.value = Z.AREA_2, n = n < 0 ? n + g : n - g) : (f.value = Z.AREA_3, n += s), d = g / 12 * Math.tan(n), o = Math.sin(d) / (Math.cos(d) - 1 / Math.sqrt(2)), c = Math.atan(o), i = Math.cos(n), a = Math.tan(r), l = 1 - i * i * a * a * (1 - Math.cos(Math.atan(1 / Math.cos(c)))), l < -1 ? l = -1 : l > 1 && (l = 1), this.face === X.TOP) u = Math.acos(l), t.phi = s - u, f.value === Z.AREA_0 ? t.lam = c + s : f.value === Z.AREA_1 ? t.lam = c < 0 ? c + g : c - g : f.value === Z.AREA_2 ? t.lam = c - s : t.lam = c;
	else if (this.face === X.BOTTOM) u = Math.acos(l), t.phi = u - s, f.value === Z.AREA_0 ? t.lam = -c + s : f.value === Z.AREA_1 ? t.lam = -c : f.value === Z.AREA_2 ? t.lam = -c - s : t.lam = c < 0 ? -c - g : -c + g;
	else {
		var p = l, m, h;
		d = p * p, h = d >= 1 ? 0 : Math.sqrt(1 - d) * Math.sin(c), d += h * h, m = d >= 1 ? 0 : Math.sqrt(1 - d), f.value === Z.AREA_1 ? (d = m, m = -h, h = d) : f.value === Z.AREA_2 ? (m = -m, h = -h) : f.value === Z.AREA_3 && (d = m, m = h, h = -d), this.face === X.RIGHT ? (d = p, p = -m, m = d) : this.face === X.BACK ? (p = -p, m = -m) : this.face === X.LEFT && (d = p, p = m, m = -d), t.phi = Math.acos(-h) - s, t.lam = Math.atan2(m, p), this.face === X.RIGHT ? t.lam = $i(t.lam, -s) : this.face === X.BACK ? t.lam = $i(t.lam, -g) : this.face === X.LEFT && (t.lam = $i(t.lam, +s));
	}
	if (this.es !== 0) {
		var _ = +(t.phi < 0), v = Math.tan(t.phi), y = this.b / Math.sqrt(v * v + this.one_minus_f_squared);
		t.phi = Math.atan(Math.sqrt(this.a * this.a - y * y) / (this.one_minus_f * y)), _ && (t.phi = -t.phi);
	}
	return t.lam += this.long0, e.x = t.lam, e.y = t.phi, e;
}
function Qi(e, t, n, r) {
	var i;
	return e < 1e-10 ? (r.value = Z.AREA_0, i = 0) : (i = Math.atan2(t, n), Math.abs(i) <= m ? r.value = Z.AREA_0 : i > m && i <= s + m ? (r.value = Z.AREA_1, i -= s) : i > s + m || i <= -(s + m) ? (r.value = Z.AREA_2, i = i >= 0 ? i - g : i + g) : (r.value = Z.AREA_3, i += s)), i;
}
function $i(e, t) {
	var n = e + t;
	return n < -3.14159265359 ? n += h : n > 3.14159265359 && (n -= h), n;
}
var ea = {
	init: Yi,
	forward: Xi,
	inverse: Zi,
	names: [
		"Quadrilateralized Spherical Cube",
		"Quadrilateralized_Spherical_Cube",
		"qsc"
	]
}, ta = [
	[
		1,
		22199e-21,
		-715515e-10,
		31103e-10
	],
	[
		.9986,
		-482243e-9,
		-24897e-9,
		-13309e-10
	],
	[
		.9954,
		-83103e-8,
		-448605e-10,
		-9.86701e-7
	],
	[
		.99,
		-.00135364,
		-59661e-9,
		36777e-10
	],
	[
		.9822,
		-.00167442,
		-449547e-11,
		-572411e-11
	],
	[
		.973,
		-.00214868,
		-903571e-10,
		1.8736e-8
	],
	[
		.96,
		-.00305085,
		-900761e-10,
		164917e-11
	],
	[
		.9427,
		-.00382792,
		-653386e-10,
		-26154e-10
	],
	[
		.9216,
		-.00467746,
		-10457e-8,
		481243e-11
	],
	[
		.8962,
		-.00536223,
		-323831e-10,
		-543432e-11
	],
	[
		.8679,
		-.00609363,
		-113898e-9,
		332484e-11
	],
	[
		.835,
		-.00698325,
		-640253e-10,
		9.34959e-7
	],
	[
		.7986,
		-.00755338,
		-500009e-10,
		9.35324e-7
	],
	[
		.7597,
		-.00798324,
		-35971e-9,
		-227626e-11
	],
	[
		.7186,
		-.00851367,
		-701149e-10,
		-86303e-10
	],
	[
		.6732,
		-.00986209,
		-199569e-9,
		191974e-10
	],
	[
		.6213,
		-.010418,
		883923e-10,
		624051e-11
	],
	[
		.5722,
		-.00906601,
		182e-6,
		624051e-11
	],
	[
		.5322,
		-.00677797,
		275608e-9,
		624051e-11
	]
], na = [
	[
		-520417e-23,
		.0124,
		121431e-23,
		-845284e-16
	],
	[
		.062,
		.0124,
		-1.26793e-9,
		422642e-15
	],
	[
		.124,
		.0124,
		5.07171e-9,
		-1.60604e-9
	],
	[
		.186,
		.0123999,
		-1.90189e-8,
		6.00152e-9
	],
	[
		.248,
		.0124002,
		7.10039e-8,
		-2.24e-8
	],
	[
		.31,
		.0123992,
		-2.64997e-7,
		8.35986e-8
	],
	[
		.372,
		.0124029,
		9.88983e-7,
		-3.11994e-7
	],
	[
		.434,
		.0123893,
		-369093e-11,
		-4.35621e-7
	],
	[
		.4958,
		.0123198,
		-102252e-10,
		-3.45523e-7
	],
	[
		.5571,
		.0121916,
		-154081e-10,
		-5.82288e-7
	],
	[
		.6176,
		.0119938,
		-241424e-10,
		-5.25327e-7
	],
	[
		.6769,
		.011713,
		-320223e-10,
		-5.16405e-7
	],
	[
		.7346,
		.0113541,
		-397684e-10,
		-6.09052e-7
	],
	[
		.7903,
		.0109107,
		-489042e-10,
		-104739e-11
	],
	[
		.8435,
		.0103431,
		-64615e-9,
		-1.40374e-9
	],
	[
		.8936,
		.00969686,
		-64636e-9,
		-8547e-9
	],
	[
		.9394,
		.00840947,
		-192841e-9,
		-42106e-10
	],
	[
		.9761,
		.00616527,
		-256e-6,
		-42106e-10
	],
	[
		1,
		.00328947,
		-319159e-9,
		-42106e-10
	]
], ra = .8487, ia = 1.3523, aa = p / 5, oa = 1 / aa, sa = 18, ca = function(e, t) {
	return e[0] + t * (e[1] + t * (e[2] + t * e[3]));
}, la = function(e, t) {
	return e[1] + t * (2 * e[2] + t * 3 * e[3]);
};
function ua(e, t, n, r) {
	for (var i = t; r; --r) {
		var a = e(i);
		if (i -= a, Math.abs(a) < n) break;
	}
	return i;
}
function da() {
	this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.long0 = this.long0 || 0, this.es = 0, this.title = this.title || "Robinson";
}
function fa(e) {
	var t = B(e.x - this.long0, this.over), n = Math.abs(e.y), r = Math.floor(n * aa);
	r < 0 ? r = 0 : r >= sa && (r = sa - 1), n = p * (n - oa * r);
	var i = {
		x: ca(ta[r], n) * t,
		y: ca(na[r], n)
	};
	return e.y < 0 && (i.y = -i.y), i.x = i.x * this.a * ra + this.x0, i.y = i.y * this.a * ia + this.y0, i;
}
function pa(e) {
	var t = {
		x: (e.x - this.x0) / (this.a * ra),
		y: Math.abs(e.y - this.y0) / (this.a * ia)
	};
	if (t.y >= 1) t.x /= ta[sa][0], t.y = e.y < 0 ? -s : s;
	else {
		var n = Math.floor(t.y * sa);
		for (n < 0 ? n = 0 : n >= sa && (n = sa - 1);;) if (na[n][0] > t.y) --n;
		else if (na[n + 1][0] <= t.y) ++n;
		else break;
		var r = na[n], i = 5 * (t.y - r[0]) / (na[n + 1][0] - r[0]);
		i = ua(function(e) {
			return (ca(r, e) - t.y) / la(r, e);
		}, i, d, 100), t.x /= ca(ta[n], i), t.y = (5 * n + i) * f, e.y < 0 && (t.y = -t.y);
	}
	return t.x = B(t.x + this.long0, this.over), t;
}
var ma = {
	init: da,
	forward: fa,
	inverse: pa,
	names: ["Robinson", "robin"]
};
//#endregion
//#region node_modules/proj4/lib/projections/geocent.js
function ha() {
	this.name = "geocent";
}
function ga(e) {
	return ft(e, this.es, this.a);
}
function _a(e) {
	return pt(e, this.es, this.a, this.b);
}
var va = {
	init: ha,
	forward: ga,
	inverse: _a,
	names: [
		"Geocentric",
		"geocentric",
		"geocent",
		"Geocent"
	]
}, Q = {
	N_POLE: 0,
	S_POLE: 1,
	EQUIT: 2,
	OBLIQ: 3
}, ya = {
	h: {
		def: 1e5,
		num: !0
	},
	azi: {
		def: 0,
		num: !0,
		degrees: !0
	},
	tilt: {
		def: 0,
		num: !0,
		degrees: !0
	},
	long0: {
		def: 0,
		num: !0
	},
	lat0: {
		def: 0,
		num: !0
	}
};
function ba() {
	if (Object.keys(ya).forEach(function(e) {
		if (this[e] === void 0) this[e] = ya[e].def;
		else if (ya[e].num && isNaN(this[e])) throw Error("Invalid parameter value, must be numeric " + e + " = " + this[e]);
		else ya[e].num && (this[e] = parseFloat(this[e]));
		ya[e].degrees && (this[e] = this[e] * f);
	}.bind(this)), Math.abs(Math.abs(this.lat0) - s) < 1e-10 ? this.mode = this.lat0 < 0 ? Q.S_POLE : Q.N_POLE : Math.abs(this.lat0) < 1e-10 ? this.mode = Q.EQUIT : (this.mode = Q.OBLIQ, this.sinph0 = Math.sin(this.lat0), this.cosph0 = Math.cos(this.lat0)), this.pn1 = this.h / this.a, this.pn1 <= 0 || this.pn1 > 1e10) throw Error("Invalid height");
	this.p = 1 + this.pn1, this.rp = 1 / this.p, this.h1 = 1 / this.pn1, this.pfact = (this.p + 1) * this.h1, this.es = 0;
	var e = this.tilt, t = this.azi;
	this.cg = Math.cos(t), this.sg = Math.sin(t), this.cw = Math.cos(e), this.sw = Math.sin(e);
}
function xa(e) {
	e.x -= this.long0;
	var t = Math.sin(e.y), n = Math.cos(e.y), r = Math.cos(e.x), i, a;
	switch (this.mode) {
		case Q.OBLIQ:
			a = this.sinph0 * t + this.cosph0 * n * r;
			break;
		case Q.EQUIT:
			a = n * r;
			break;
		case Q.S_POLE:
			a = -t;
			break;
		case Q.N_POLE:
			a = t;
			break;
	}
	switch (a = this.pn1 / (this.p - a), i = a * n * Math.sin(e.x), this.mode) {
		case Q.OBLIQ:
			a *= this.cosph0 * t - this.sinph0 * n * r;
			break;
		case Q.EQUIT:
			a *= t;
			break;
		case Q.N_POLE:
			a *= -(n * r);
			break;
		case Q.S_POLE:
			a *= n * r;
			break;
	}
	var o = a * this.cg + i * this.sg, s = 1 / (o * this.sw * this.h1 + this.cw);
	return i = (i * this.cg - a * this.sg) * this.cw * s, a = o * s, e.x = i * this.a, e.y = a * this.a, e;
}
function Sa(e) {
	e.x /= this.a, e.y /= this.a;
	var t = {
		x: e.x,
		y: e.y
	}, n, r, i = 1 / (this.pn1 - e.y * this.sw);
	n = this.pn1 * e.x * i, r = this.pn1 * e.y * this.cw * i, e.x = n * this.cg + r * this.sg, e.y = r * this.cg - n * this.sg;
	var a = J(e.x, e.y);
	if (Math.abs(a) < 1e-10) t.x = 0, t.y = e.y;
	else {
		var o, s = 1 - a * a * this.pfact;
		switch (s = (this.p - Math.sqrt(s)) / (this.pn1 / a + a / this.pn1), o = Math.sqrt(1 - s * s), this.mode) {
			case Q.OBLIQ:
				t.y = Math.asin(o * this.sinph0 + e.y * s * this.cosph0 / a), e.y = (o - this.sinph0 * Math.sin(t.y)) * a, e.x *= s * this.cosph0;
				break;
			case Q.EQUIT:
				t.y = Math.asin(e.y * s / a), e.y = o * a, e.x *= s;
				break;
			case Q.N_POLE:
				t.y = Math.asin(o), e.y = -e.y;
				break;
			case Q.S_POLE:
				t.y = -Math.asin(o);
				break;
		}
		t.x = Math.atan2(e.x, e.y);
	}
	return e.x = t.x + this.long0, e.y = t.y, e;
}
var Ca = {
	init: ba,
	forward: xa,
	inverse: Sa,
	names: ["Tilted_Perspective", "tpers"]
};
//#endregion
//#region node_modules/proj4/lib/projections/geos.js
function wa() {
	if (this.flip_axis = +(this.sweep === "x"), this.h = Number(this.h), this.radius_g_1 = this.h / this.a, this.radius_g_1 <= 0 || this.radius_g_1 > 1e10) throw Error();
	if (this.radius_g = 1 + this.radius_g_1, this.C = this.radius_g * this.radius_g - 1, this.es !== 0) {
		var e = 1 - this.es, t = 1 / e;
		this.radius_p = Math.sqrt(e), this.radius_p2 = e, this.radius_p_inv2 = t, this.shape = "ellipse";
	} else this.radius_p = 1, this.radius_p2 = 1, this.radius_p_inv2 = 1, this.shape = "sphere";
	this.title ||= "Geostationary Satellite View";
}
function Ta(e) {
	var t = e.x, n = e.y, r, i, a, o;
	if (t -= this.long0, this.shape === "ellipse") {
		n = Math.atan(this.radius_p2 * Math.tan(n));
		var s = this.radius_p / J(this.radius_p * Math.cos(n), Math.sin(n));
		if (i = s * Math.cos(t) * Math.cos(n), a = s * Math.sin(t) * Math.cos(n), o = s * Math.sin(n), (this.radius_g - i) * i - a * a - o * o * this.radius_p_inv2 < 0) return e.x = NaN, e.y = NaN, e;
		r = this.radius_g - i, this.flip_axis ? (e.x = this.radius_g_1 * Math.atan(a / J(o, r)), e.y = this.radius_g_1 * Math.atan(o / r)) : (e.x = this.radius_g_1 * Math.atan(a / r), e.y = this.radius_g_1 * Math.atan(o / J(a, r)));
	} else this.shape === "sphere" && (r = Math.cos(n), i = Math.cos(t) * r, a = Math.sin(t) * r, o = Math.sin(n), r = this.radius_g - i, this.flip_axis ? (e.x = this.radius_g_1 * Math.atan(a / J(o, r)), e.y = this.radius_g_1 * Math.atan(o / r)) : (e.x = this.radius_g_1 * Math.atan(a / r), e.y = this.radius_g_1 * Math.atan(o / J(a, r))));
	return e.x *= this.a, e.y *= this.a, e;
}
function Ea(e) {
	var t = -1, n = 0, r = 0, i, a, o, s;
	if (e.x /= this.a, e.y /= this.a, this.shape === "ellipse") {
		this.flip_axis ? (r = Math.tan(e.y / this.radius_g_1), n = Math.tan(e.x / this.radius_g_1) * J(1, r)) : (n = Math.tan(e.x / this.radius_g_1), r = Math.tan(e.y / this.radius_g_1) * J(1, n));
		var c = r / this.radius_p;
		if (i = n * n + c * c + t * t, a = 2 * this.radius_g * t, o = a * a - 4 * i * this.C, o < 0) return e.x = NaN, e.y = NaN, e;
		s = (-a - Math.sqrt(o)) / (2 * i), t = this.radius_g + s * t, n *= s, r *= s, e.x = Math.atan2(n, t), e.y = Math.atan(r * Math.cos(e.x) / t), e.y = Math.atan(this.radius_p_inv2 * Math.tan(e.y));
	} else if (this.shape === "sphere") {
		if (this.flip_axis ? (r = Math.tan(e.y / this.radius_g_1), n = Math.tan(e.x / this.radius_g_1) * Math.sqrt(1 + r * r)) : (n = Math.tan(e.x / this.radius_g_1), r = Math.tan(e.y / this.radius_g_1) * Math.sqrt(1 + n * n)), i = n * n + r * r + t * t, a = 2 * this.radius_g * t, o = a * a - 4 * i * this.C, o < 0) return e.x = NaN, e.y = NaN, e;
		s = (-a - Math.sqrt(o)) / (2 * i), t = this.radius_g + s * t, n *= s, r *= s, e.x = Math.atan2(n, t), e.y = Math.atan(r * Math.cos(e.x) / t);
	}
	return e.x += this.long0, e;
}
var Da = {
	init: wa,
	forward: Ta,
	inverse: Ea,
	names: [
		"Geostationary Satellite View",
		"Geostationary_Satellite",
		"geos"
	]
}, Oa = 1.340264, ka = -.081106, Aa = 893e-6, ja = .003796, Ma = Math.sqrt(3) / 2;
function Na() {
	this.long0 = this.long0 === void 0 ? 0 : this.long0, this.x0 = this.x0 === void 0 ? 0 : this.x0, this.y0 = this.y0 === void 0 ? 0 : this.y0, this.es !== 0 && (this.apa = Ir(this.es), this.qp = kr(this.e, 1), this.rqda = Math.sqrt(.5 * this.qp));
}
function Pa(e) {
	var t = B(e.x - this.long0, this.over), n = e.y, r = Math.sin(n);
	this.es !== 0 && (r = kr(this.e, r) / this.qp);
	var i = Math.asin(Ma * r), a = i * i, o = a * a * a;
	return e.x = t * Math.cos(i) / (Ma * (Oa + 3 * ka * a + o * (7 * Aa + 9 * ja * a))), e.y = i * (Oa + ka * a + o * (Aa + ja * a)), this.es !== 0 && (e.x *= this.rqda, e.y *= this.rqda), e.x = this.a * e.x + this.x0, e.y = this.a * e.y + this.y0, e;
}
function Fa(e) {
	e.x = (e.x - this.x0) / this.a, e.y = (e.y - this.y0) / this.a, this.es !== 0 && (e.x /= this.rqda, e.y /= this.rqda);
	var t = 1e-9, n = 12, r = e.y, i, a, o, s, c, l;
	for (l = 0; l < n && (i = r * r, a = i * i * i, o = r * (Oa + ka * i + a * (Aa + ja * i)) - e.y, s = Oa + 3 * ka * i + a * (7 * Aa + 9 * ja * i), r -= c = o / s, !(Math.abs(c) < t)); ++l);
	return i = r * r, a = i * i * i, e.x = Ma * e.x * (Oa + 3 * ka * i + a * (7 * Aa + 9 * ja * i)) / Math.cos(r), e.y = Math.asin(Math.sin(r) / Ma), this.es !== 0 && (e.y = Lr(e.y, this.apa)), e.x = B(e.x + this.long0, this.over), e;
}
var Ia = {
	init: Na,
	forward: Pa,
	inverse: Fa,
	names: [
		"eqearth",
		"Equal Earth",
		"Equal_Earth"
	]
}, La = 1e-10;
function Ra() {
	var e;
	if (this.phi1 = this.lat1, Math.abs(this.phi1) < La) throw Error();
	this.es ? (this.en = gn(this.es), this.m1 = _n(this.phi1, this.am1 = Math.sin(this.phi1), e = Math.cos(this.phi1), this.en), this.am1 = e / (Math.sqrt(1 - this.es * this.am1 * this.am1) * this.am1), this.inverse = Ba, this.forward = za) : (Math.abs(this.phi1) + La >= s ? this.cphi1 = 0 : this.cphi1 = 1 / Math.tan(this.phi1), this.inverse = Ha, this.forward = Va);
}
function za(e) {
	var t = B(e.x - (this.long0 || 0), this.over), n = e.y, r = this.am1 + this.m1 - _n(n, i = Math.sin(n), a = Math.cos(n), this.en), i = a * t / (r * Math.sqrt(1 - this.es * i * i)), a;
	return e.x = r * Math.sin(i), e.y = this.am1 - r * Math.cos(i), e.x = this.a * e.x + (this.x0 || 0), e.y = this.a * e.y + (this.y0 || 0), e;
}
function Ba(e) {
	e.x = (e.x - (this.x0 || 0)) / this.a, e.y = (e.y - (this.y0 || 0)) / this.a;
	var t, n = J(e.x, e.y = this.am1 - e.y), r, i = yn(this.am1 + this.m1 - n, this.es, this.en);
	if ((t = Math.abs(i)) < s) t = Math.sin(i), r = n * Math.atan2(e.x, e.y) * Math.sqrt(1 - this.es * t * t) / Math.cos(i);
	else if (Math.abs(t - s) <= La) r = 0;
	else throw Error();
	return e.x = B(r + (this.long0 || 0), this.over), e.y = Cr(i), e;
}
function Va(e) {
	var t = B(e.x - (this.long0 || 0), this.over), n = e.y, r, i = this.cphi1 + this.phi1 - n;
	return Math.abs(i) > La ? (e.x = i * Math.sin(r = t * Math.cos(n) / i), e.y = this.cphi1 - i * Math.cos(r)) : e.x = e.y = 0, e.x = this.a * e.x + (this.x0 || 0), e.y = this.a * e.y + (this.y0 || 0), e;
}
function Ha(e) {
	e.x = (e.x - (this.x0 || 0)) / this.a, e.y = (e.y - (this.y0 || 0)) / this.a;
	var t, n, r = J(e.x, e.y = this.cphi1 - e.y);
	if (n = this.cphi1 + this.phi1 - r, Math.abs(n) > s) throw Error();
	return t = Math.abs(Math.abs(n) - s) <= La ? 0 : r * Math.atan2(e.x, e.y) / Math.cos(n), e.x = B(t + (this.long0 || 0), this.over), e.y = Cr(n), e;
}
var Ua = {
	init: Ra,
	names: ["bonne", "Bonne (Werner lat_1=90)"]
}, Wa = {
	OBLIQUE: {
		forward: Xa,
		inverse: Qa
	},
	TRANSVERSE: {
		forward: Za,
		inverse: $a
	}
}, Ga = {
	ROTATE: {
		o_alpha: "oAlpha",
		o_lon_c: "oLongC",
		o_lat_c: "oLatC"
	},
	NEW_POLE: {
		o_lat_p: "oLatP",
		o_lon_p: "oLongP"
	},
	NEW_EQUATOR: {
		o_lon_1: "oLong1",
		o_lat_1: "oLat1",
		o_lon_2: "oLong2",
		o_lat_2: "oLat2"
	}
};
function Ka() {
	if (this.x0 = this.x0 || 0, this.y0 = this.y0 || 0, this.long0 = this.long0 || 0, this.title = this.title || "General Oblique Transformation", this.isIdentity = Fe.includes(this.o_proj), !this.o_proj) throw Error("Missing parameter: o_proj");
	if (this.o_proj === "ob_tran") throw Error("Invalid value for o_proj: " + this.o_proj);
	let e = W(this.projStr.replace("+proj=ob_tran", "").replace("+o_proj=", "+proj=").trim());
	if (!e) throw Error("Invalid parameter: o_proj. Unknown projection " + this.o_proj);
	e.long0 = 0, this.obliqueProjection = e;
	let t, n = Object.keys(Ga), r = (e) => {
		if (this[e] === void 0) return;
		let t = parseFloat(this[e]) * f;
		if (isNaN(t)) throw Error("Invalid value for " + e + ": " + this[e]);
		return t;
	};
	for (let e = 0; e < n.length; e++) {
		let i = Ga[n[e]], a = Object.entries(i);
		if (a.some(([e]) => this[e] !== void 0)) {
			t = i;
			for (let e = 0; e < a.length; e++) {
				let [t, n] = a[e], i = r(t);
				if (i === void 0) throw Error("Missing parameter: " + t + ".");
				this[n] = i;
			}
			break;
		}
	}
	if (!t) throw Error("No valid parameters provided for ob_tran projection.");
	let { lamp: i, phip: a } = Ya(this, t);
	this.lamp = i, Math.abs(a) > 1e-10 ? (this.cphip = Math.cos(a), this.sphip = Math.sin(a), this.projectionType = Wa.OBLIQUE) : this.projectionType = Wa.TRANSVERSE;
}
function qa(e) {
	return this.projectionType.forward(this, e);
}
function Ja(e) {
	return this.projectionType.inverse(this, e);
}
function Ya(e, t) {
	let n, r;
	if (t === Ga.ROTATE) {
		let t = e.oLongC, i = e.oLatC, a = e.oAlpha;
		if (Math.abs(Math.abs(i) - s) <= 1e-10) throw Error("Invalid value for o_lat_c: " + e.o_lat_c + " should be < 90°");
		r = t + Math.atan2(-1 * Math.cos(a), -1 * Math.sin(a) * Math.sin(i)), n = Math.asin(Math.cos(i) * Math.sin(a));
	} else if (t === Ga.NEW_POLE) r = e.oLongP, n = e.oLatP;
	else {
		let t = e.oLong1, i = e.oLat1, a = e.oLong2, o = e.oLat2, c = Math.abs(i);
		if (Math.abs(i) > s - 1e-10) throw Error("Invalid value for o_lat_1: " + e.o_lat_1 + " should be < 90°");
		if (Math.abs(o) > s - 1e-10) throw Error("Invalid value for o_lat_2: " + e.o_lat_2 + " should be < 90°");
		if (Math.abs(i - o) < 1e-10) throw Error("Invalid value for o_lat_1 and o_lat_2: o_lat_1 should be different from o_lat_2");
		if (c < 1e-10) throw Error("Invalid value for o_lat_1: o_lat_1 should be different from zero");
		r = Math.atan2(Math.cos(i) * Math.sin(o) * Math.cos(t) - Math.sin(i) * Math.cos(o) * Math.cos(a), Math.sin(i) * Math.cos(o) * Math.sin(a) - Math.cos(i) * Math.sin(o) * Math.sin(t)), n = Math.atan(-1 * Math.cos(r - t) / Math.tan(i));
	}
	return {
		lamp: r,
		phip: n
	};
}
function Xa(e, t) {
	let { x: n, y: r } = t;
	n = B(n - e.long0, e.over);
	let i = Math.cos(n), a = Math.sin(r), o = Math.cos(r);
	t.x = B(Math.atan2(o * Math.sin(n), e.sphip * o * i + e.cphip * a) + e.lamp), t.y = Math.asin(e.sphip * a - e.cphip * o * i);
	let s = e.obliqueProjection.forward(t);
	return e.isIdentity && (s.x *= p, s.y *= p), s;
}
function Za(e, t) {
	let { x: n, y: r } = t;
	n = B(n - e.long0, e.over);
	let i = Math.cos(r), a = Math.cos(n);
	t.x = B(Math.atan2(i * Math.sin(n), Math.sin(r)) + e.lamp), t.y = Math.asin(-1 * i * a);
	let o = e.obliqueProjection.forward(t);
	return e.isIdentity && (o.x *= p, o.y *= p), o;
}
function Qa(e, t) {
	e.isIdentity && (t.x *= f, t.y *= f);
	let { x: n, y: r } = e.obliqueProjection.inverse(t);
	if (n < Number.MAX_VALUE) {
		n -= e.lamp;
		let i = Math.cos(n), a = Math.sin(r), o = Math.cos(r);
		t.x = Math.atan2(o * Math.sin(n), e.sphip * o * i - e.cphip * a), t.y = Math.asin(e.sphip * a + e.cphip * o * i);
	}
	return t.x = B(t.x + e.long0), t;
}
function $a(e, t) {
	e.isIdentity && (t.x *= f, t.y *= f);
	let { x: n, y: r } = e.obliqueProjection.inverse(t);
	if (n < Number.MAX_VALUE) {
		let i = Math.cos(r);
		n -= e.lamp, t.x = Math.atan2(i * Math.sin(n), -1 * Math.sin(r)), t.y = Math.asin(i * Math.cos(n));
	}
	return t.x = B(t.x + e.long0), t;
}
var eo = {
	init: Ka,
	forward: qa,
	inverse: Ja,
	names: [
		"General Oblique Transformation",
		"General_Oblique_Transformation",
		"ob_tran"
	]
};
//#endregion
//#region node_modules/proj4/projs.js
function to(e) {
	e.Proj.projections.add(Cn), e.Proj.projections.add(Pn), e.Proj.projections.add(Rn), e.Proj.projections.add(Jn), e.Proj.projections.add($n), e.Proj.projections.add(rr), e.Proj.projections.add(lr), e.Proj.projections.add(pr), e.Proj.projections.add(_r), e.Proj.projections.add(Or), e.Proj.projections.add(Vr), e.Proj.projections.add(qr), e.Proj.projections.add(Zr), e.Proj.projections.add(ni), e.Proj.projections.add(oi), e.Proj.projections.add(di), e.Proj.projections.add(hi), e.Proj.projections.add(yi), e.Proj.projections.add(wi), e.Proj.projections.add(Ei), e.Proj.projections.add(Ai), e.Proj.projections.add(Pi), e.Proj.projections.add(Ri), e.Proj.projections.add(Wi), e.Proj.projections.add(Ji), e.Proj.projections.add(ea), e.Proj.projections.add(ma), e.Proj.projections.add(va), e.Proj.projections.add(Ca), e.Proj.projections.add(Da), e.Proj.projections.add(Ia), e.Proj.projections.add(Ua), e.Proj.projections.add(eo);
}
//#endregion
//#region node_modules/proj4/lib/index.js
var no = Object.assign(Nt, {
	defaultDatum: "WGS84",
	Proj: W,
	WGS84: new W("WGS84"),
	Point: nn,
	toPoint: wt,
	defs: F,
	nadgrid: Ze,
	transform: kt,
	mgrs: Bt,
	version: "__VERSION__"
});
to(no);
//#endregion
//#region node_modules/copc/lib/ept/ept.js
var ro = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 });
})), io = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Hierarchy = void 0, e.Hierarchy = { parse: t };
	function t(e) {
		return Object.entries(e).reduce((e, [t, n]) => (n === -1 ? e.pages[t] = {} : n && (e.nodes[t] = { pointCount: n }), e), {
			nodes: {},
			pages: {}
		});
	}
})), ao = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__exportStar || function(e, n) {
		for (var r in e) r !== "default" && !Object.prototype.hasOwnProperty.call(n, r) && t(n, e, r);
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), n(ro(), e), n(io(), e);
})), oo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.hierarchyItemLength = e.infoLength = void 0, e.infoLength = 160, e.hierarchyItemLength = 32;
})), so = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.evlrHeaderLength = e.vlrHeaderLength = e.minHeaderLength = void 0, e.minHeaderLength = 375, e.vlrHeaderLength = 54, e.evlrHeaderLength = 60;
})), co = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.getBigUint64 = e.parseBigInt = void 0;
	function t(e) {
		if (e > BigInt(2 ** 53 - 1) || e < BigInt(-(2 ** 53 - 1))) throw Error(`Cannot convert bigint to number: ${e}`);
		return Number(e);
	}
	e.parseBigInt = t;
	function n(e, t, n) {
		if (e.getBigUint64) return e.getBigUint64(t, n);
		let [r, i] = n ? [4, 0] : [0, 4], a = BigInt(e.getUint32(t + r, n)), o = BigInt(e.getUint32(t + i, n));
		return (a << BigInt(32)) + o;
	}
	e.getBigUint64 = n;
})), lo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.toCString = e.toDataView = e.Binary = void 0, e.Binary = {
		toDataView: t,
		toCString: n
	};
	function t(e) {
		return new DataView(e.buffer, e.byteOffset, e.length);
	}
	e.toDataView = t;
	function n(e) {
		let n = t(e), r = "";
		for (let e = 0; e < n.byteLength; ++e) {
			let t = n.getInt8(e);
			if (t === 0) return r;
			r += String.fromCharCode(t);
		}
		return r;
	}
	e.toCString = n;
})), uo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Bounds = void 0, e.Bounds = {
		min: t,
		max: n,
		mid: r,
		width: i,
		depth: a,
		height: o,
		cube: s,
		step: c,
		stepTo: l,
		intersection: u
	};
	function t(e) {
		return [
			e[0],
			e[1],
			e[2]
		];
	}
	function n(e) {
		return [
			e[3],
			e[4],
			e[5]
		];
	}
	function r([e, t, n, r, i, a]) {
		return [
			e + (r - e) / 2,
			t + (i - t) / 2,
			n + (a - n) / 2
		];
	}
	function i(e) {
		return e[3] - e[0];
	}
	function a(e) {
		return e[4] - e[1];
	}
	function o(e) {
		return e[5] - e[2];
	}
	function s(e) {
		let t = r(e), n = Math.max(i(e), a(e), o(e)) / 2;
		return [
			t[0] - n,
			t[1] - n,
			t[2] - n,
			t[0] + n,
			t[1] + n,
			t[2] + n
		];
	}
	function c(e, [t, n, i]) {
		let [a, o, s, c, l, u] = e, [d, f, p] = r(e);
		return [
			t ? d : a,
			n ? f : o,
			i ? p : s,
			t ? c : d,
			n ? l : f,
			i ? u : p
		];
	}
	function l(e, [t, n, r, i]) {
		for (let a = t - 1; a >= 0; --a) e = c(e, [
			n >> a & 1,
			r >> a & 1,
			i >> a & 1
		]);
		return e;
	}
	function u(e, t) {
		return [
			Math.max(e[0], t[0]),
			Math.max(e[1], t[1]),
			Math.max(e[2], t[2]),
			Math.min(e[3], t[3]),
			Math.min(e[4], t[4]),
			Math.min(e[5], t[5])
		];
	}
})), fo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Dimension = void 0, e.Dimension = {
		Type: {
			int8: {
				type: "signed",
				size: 1
			},
			int16: {
				type: "signed",
				size: 2
			},
			int32: {
				type: "signed",
				size: 4
			},
			int64: {
				type: "signed",
				size: 8
			},
			uint8: {
				type: "unsigned",
				size: 1
			},
			uint16: {
				type: "unsigned",
				size: 2
			},
			uint32: {
				type: "unsigned",
				size: 4
			},
			uint64: {
				type: "unsigned",
				size: 8
			},
			float32: {
				type: "float",
				size: 4
			},
			float64: {
				type: "float",
				size: 8
			},
			float: {
				type: "float",
				size: 4
			},
			double: {
				type: "float",
				size: 8
			},
			bool: {
				type: "unsigned",
				size: 1
			},
			boolean: {
				type: "unsigned",
				size: 1
			}
		},
		ctype: t
	};
	function t({ type: e, size: t }) {
		switch (e) {
			case "signed": switch (t) {
				case 1: return "int8";
				case 2: return "int16";
				case 4: return "int32";
				case 8: return "int64";
			}
			case "unsigned": switch (t) {
				case 1: return "uint8";
				case 2: return "uint16";
				case 4: return "uint32";
				case 8: return "uint64";
			}
			case "float": switch (t) {
				case 4: return "float";
				case 8: return "double";
			}
		}
		throw Error(`Invalid dimension type/size: ${e}/${t}`);
	}
})), po = /* @__PURE__ */ t(((e, t) => {
	var n = typeof globalThis < "u" && globalThis || typeof self < "u" && self || typeof global < "u" && global, r = (function() {
		function e() {
			this.fetch = !1, this.DOMException = n.DOMException;
		}
		return e.prototype = n, new e();
	})();
	(function(e) {
		(function(t) {
			var n = e !== void 0 && e || typeof self < "u" && self || typeof global < "u" && global || {}, r = {
				searchParams: "URLSearchParams" in n,
				iterable: "Symbol" in n && "iterator" in Symbol,
				blob: "FileReader" in n && "Blob" in n && (function() {
					try {
						return new Blob(), !0;
					} catch {
						return !1;
					}
				})(),
				formData: "FormData" in n,
				arrayBuffer: "ArrayBuffer" in n
			};
			function i(e) {
				return e && DataView.prototype.isPrototypeOf(e);
			}
			if (r.arrayBuffer) var a = [
				"[object Int8Array]",
				"[object Uint8Array]",
				"[object Uint8ClampedArray]",
				"[object Int16Array]",
				"[object Uint16Array]",
				"[object Int32Array]",
				"[object Uint32Array]",
				"[object Float32Array]",
				"[object Float64Array]"
			], o = ArrayBuffer.isView || function(e) {
				return e && a.indexOf(Object.prototype.toString.call(e)) > -1;
			};
			function s(e) {
				if (typeof e != "string" && (e = String(e)), /[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(e) || e === "") throw TypeError("Invalid character in header field name: \"" + e + "\"");
				return e.toLowerCase();
			}
			function c(e) {
				return typeof e != "string" && (e = String(e)), e;
			}
			function l(e) {
				var t = { next: function() {
					var t = e.shift();
					return {
						done: t === void 0,
						value: t
					};
				} };
				return r.iterable && (t[Symbol.iterator] = function() {
					return t;
				}), t;
			}
			function u(e) {
				this.map = {}, e instanceof u ? e.forEach(function(e, t) {
					this.append(t, e);
				}, this) : Array.isArray(e) ? e.forEach(function(e) {
					if (e.length != 2) throw TypeError("Headers constructor: expected name/value pair to be length 2, found" + e.length);
					this.append(e[0], e[1]);
				}, this) : e && Object.getOwnPropertyNames(e).forEach(function(t) {
					this.append(t, e[t]);
				}, this);
			}
			u.prototype.append = function(e, t) {
				e = s(e), t = c(t);
				var n = this.map[e];
				this.map[e] = n ? n + ", " + t : t;
			}, u.prototype.delete = function(e) {
				delete this.map[s(e)];
			}, u.prototype.get = function(e) {
				return e = s(e), this.has(e) ? this.map[e] : null;
			}, u.prototype.has = function(e) {
				return this.map.hasOwnProperty(s(e));
			}, u.prototype.set = function(e, t) {
				this.map[s(e)] = c(t);
			}, u.prototype.forEach = function(e, t) {
				for (var n in this.map) this.map.hasOwnProperty(n) && e.call(t, this.map[n], n, this);
			}, u.prototype.keys = function() {
				var e = [];
				return this.forEach(function(t, n) {
					e.push(n);
				}), l(e);
			}, u.prototype.values = function() {
				var e = [];
				return this.forEach(function(t) {
					e.push(t);
				}), l(e);
			}, u.prototype.entries = function() {
				var e = [];
				return this.forEach(function(t, n) {
					e.push([n, t]);
				}), l(e);
			}, r.iterable && (u.prototype[Symbol.iterator] = u.prototype.entries);
			function d(e) {
				if (!e._noBody) {
					if (e.bodyUsed) return Promise.reject(/* @__PURE__ */ TypeError("Already read"));
					e.bodyUsed = !0;
				}
			}
			function f(e) {
				return new Promise(function(t, n) {
					e.onload = function() {
						t(e.result);
					}, e.onerror = function() {
						n(e.error);
					};
				});
			}
			function p(e) {
				var t = new FileReader(), n = f(t);
				return t.readAsArrayBuffer(e), n;
			}
			function m(e) {
				var t = new FileReader(), n = f(t), r = /charset=([A-Za-z0-9_-]+)/.exec(e.type), i = r ? r[1] : "utf-8";
				return t.readAsText(e, i), n;
			}
			function h(e) {
				for (var t = new Uint8Array(e), n = Array(t.length), r = 0; r < t.length; r++) n[r] = String.fromCharCode(t[r]);
				return n.join("");
			}
			function g(e) {
				if (e.slice) return e.slice(0);
				var t = new Uint8Array(e.byteLength);
				return t.set(new Uint8Array(e)), t.buffer;
			}
			function _() {
				return this.bodyUsed = !1, this._initBody = function(e) {
					this.bodyUsed = this.bodyUsed, this._bodyInit = e, e ? typeof e == "string" ? this._bodyText = e : r.blob && Blob.prototype.isPrototypeOf(e) ? this._bodyBlob = e : r.formData && FormData.prototype.isPrototypeOf(e) ? this._bodyFormData = e : r.searchParams && URLSearchParams.prototype.isPrototypeOf(e) ? this._bodyText = e.toString() : r.arrayBuffer && r.blob && i(e) ? (this._bodyArrayBuffer = g(e.buffer), this._bodyInit = new Blob([this._bodyArrayBuffer])) : r.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(e) || o(e)) ? this._bodyArrayBuffer = g(e) : this._bodyText = e = Object.prototype.toString.call(e) : (this._noBody = !0, this._bodyText = ""), this.headers.get("content-type") || (typeof e == "string" ? this.headers.set("content-type", "text/plain;charset=UTF-8") : this._bodyBlob && this._bodyBlob.type ? this.headers.set("content-type", this._bodyBlob.type) : r.searchParams && URLSearchParams.prototype.isPrototypeOf(e) && this.headers.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8"));
				}, r.blob && (this.blob = function() {
					var e = d(this);
					if (e) return e;
					if (this._bodyBlob) return Promise.resolve(this._bodyBlob);
					if (this._bodyArrayBuffer) return Promise.resolve(new Blob([this._bodyArrayBuffer]));
					if (this._bodyFormData) throw Error("could not read FormData body as blob");
					return Promise.resolve(new Blob([this._bodyText]));
				}), this.arrayBuffer = function() {
					if (this._bodyArrayBuffer) return d(this) || (ArrayBuffer.isView(this._bodyArrayBuffer) ? Promise.resolve(this._bodyArrayBuffer.buffer.slice(this._bodyArrayBuffer.byteOffset, this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength)) : Promise.resolve(this._bodyArrayBuffer));
					if (r.blob) return this.blob().then(p);
					throw Error("could not read as ArrayBuffer");
				}, this.text = function() {
					var e = d(this);
					if (e) return e;
					if (this._bodyBlob) return m(this._bodyBlob);
					if (this._bodyArrayBuffer) return Promise.resolve(h(this._bodyArrayBuffer));
					if (this._bodyFormData) throw Error("could not read FormData body as text");
					return Promise.resolve(this._bodyText);
				}, r.formData && (this.formData = function() {
					return this.text().then(x);
				}), this.json = function() {
					return this.text().then(JSON.parse);
				}, this;
			}
			var v = [
				"CONNECT",
				"DELETE",
				"GET",
				"HEAD",
				"OPTIONS",
				"PATCH",
				"POST",
				"PUT",
				"TRACE"
			];
			function y(e) {
				var t = e.toUpperCase();
				return v.indexOf(t) > -1 ? t : e;
			}
			function b(e, t) {
				if (!(this instanceof b)) throw TypeError("Please use the \"new\" operator, this DOM object constructor cannot be called as a function.");
				t ||= {};
				var r = t.body;
				if (e instanceof b) {
					if (e.bodyUsed) throw TypeError("Already read");
					this.url = e.url, this.credentials = e.credentials, t.headers || (this.headers = new u(e.headers)), this.method = e.method, this.mode = e.mode, this.signal = e.signal, !r && e._bodyInit != null && (r = e._bodyInit, e.bodyUsed = !0);
				} else this.url = String(e);
				if (this.credentials = t.credentials || this.credentials || "same-origin", (t.headers || !this.headers) && (this.headers = new u(t.headers)), this.method = y(t.method || this.method || "GET"), this.mode = t.mode || this.mode || null, this.signal = t.signal || this.signal || function() {
					if ("AbortController" in n) return new AbortController().signal;
				}(), this.referrer = null, (this.method === "GET" || this.method === "HEAD") && r) throw TypeError("Body not allowed for GET or HEAD requests");
				if (this._initBody(r), (this.method === "GET" || this.method === "HEAD") && (t.cache === "no-store" || t.cache === "no-cache")) {
					var i = /([?&])_=[^&]*/;
					if (i.test(this.url)) this.url = this.url.replace(i, "$1_=" + (/* @__PURE__ */ new Date()).getTime());
					else {
						var a = /\?/;
						this.url += (a.test(this.url) ? "&" : "?") + "_=" + (/* @__PURE__ */ new Date()).getTime();
					}
				}
			}
			b.prototype.clone = function() {
				return new b(this, { body: this._bodyInit });
			};
			function x(e) {
				var t = new FormData();
				return e.trim().split("&").forEach(function(e) {
					if (e) {
						var n = e.split("="), r = n.shift().replace(/\+/g, " "), i = n.join("=").replace(/\+/g, " ");
						t.append(decodeURIComponent(r), decodeURIComponent(i));
					}
				}), t;
			}
			function S(e) {
				var t = new u();
				return e.replace(/\r?\n[\t ]+/g, " ").split("\r").map(function(e) {
					return e.indexOf("\n") === 0 ? e.substr(1, e.length) : e;
				}).forEach(function(e) {
					var n = e.split(":"), r = n.shift().trim();
					if (r) {
						var i = n.join(":").trim();
						try {
							t.append(r, i);
						} catch (e) {
							console.warn("Response " + e.message);
						}
					}
				}), t;
			}
			_.call(b.prototype);
			function C(e, t) {
				if (!(this instanceof C)) throw TypeError("Please use the \"new\" operator, this DOM object constructor cannot be called as a function.");
				if (t ||= {}, this.type = "default", this.status = t.status === void 0 ? 200 : t.status, this.status < 200 || this.status > 599) throw RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].");
				this.ok = this.status >= 200 && this.status < 300, this.statusText = t.statusText === void 0 ? "" : "" + t.statusText, this.headers = new u(t.headers), this.url = t.url || "", this._initBody(e);
			}
			_.call(C.prototype), C.prototype.clone = function() {
				return new C(this._bodyInit, {
					status: this.status,
					statusText: this.statusText,
					headers: new u(this.headers),
					url: this.url
				});
			}, C.error = function() {
				var e = new C(null, {
					status: 200,
					statusText: ""
				});
				return e.ok = !1, e.status = 0, e.type = "error", e;
			};
			var w = [
				301,
				302,
				303,
				307,
				308
			];
			C.redirect = function(e, t) {
				if (w.indexOf(t) === -1) throw RangeError("Invalid status code");
				return new C(null, {
					status: t,
					headers: { location: e }
				});
			}, t.DOMException = n.DOMException;
			try {
				new t.DOMException();
			} catch {
				t.DOMException = function(e, t) {
					this.message = e, this.name = t;
					var n = Error(e);
					this.stack = n.stack;
				}, t.DOMException.prototype = Object.create(Error.prototype), t.DOMException.prototype.constructor = t.DOMException;
			}
			function T(e, i) {
				return new Promise(function(a, o) {
					var l = new b(e, i);
					if (l.signal && l.signal.aborted) return o(new t.DOMException("Aborted", "AbortError"));
					var d = new XMLHttpRequest();
					function f() {
						d.abort();
					}
					d.onload = function() {
						var e = {
							statusText: d.statusText,
							headers: S(d.getAllResponseHeaders() || "")
						};
						l.url.indexOf("file://") === 0 && (d.status < 200 || d.status > 599) ? e.status = 200 : e.status = d.status, e.url = "responseURL" in d ? d.responseURL : e.headers.get("X-Request-URL");
						var t = "response" in d ? d.response : d.responseText;
						setTimeout(function() {
							a(new C(t, e));
						}, 0);
					}, d.onerror = function() {
						setTimeout(function() {
							o(/* @__PURE__ */ TypeError("Network request failed"));
						}, 0);
					}, d.ontimeout = function() {
						setTimeout(function() {
							o(/* @__PURE__ */ TypeError("Network request timed out"));
						}, 0);
					}, d.onabort = function() {
						setTimeout(function() {
							o(new t.DOMException("Aborted", "AbortError"));
						}, 0);
					};
					function p(e) {
						try {
							return e === "" && n.location.href ? n.location.href : e;
						} catch {
							return e;
						}
					}
					if (d.open(l.method, p(l.url), !0), l.credentials === "include" ? d.withCredentials = !0 : l.credentials === "omit" && (d.withCredentials = !1), "responseType" in d && (r.blob ? d.responseType = "blob" : r.arrayBuffer && (d.responseType = "arraybuffer")), i && typeof i.headers == "object" && !(i.headers instanceof u || n.Headers && i.headers instanceof n.Headers)) {
						var m = [];
						Object.getOwnPropertyNames(i.headers).forEach(function(e) {
							m.push(s(e)), d.setRequestHeader(e, c(i.headers[e]));
						}), l.headers.forEach(function(e, t) {
							m.indexOf(t) === -1 && d.setRequestHeader(t, e);
						});
					} else l.headers.forEach(function(e, t) {
						d.setRequestHeader(t, e);
					});
					l.signal && (l.signal.addEventListener("abort", f), d.onreadystatechange = function() {
						d.readyState === 4 && l.signal.removeEventListener("abort", f);
					}), d.send(l._bodyInit === void 0 ? null : l._bodyInit);
				});
			}
			return T.polyfill = !0, n.fetch || (n.fetch = T, n.Headers = u, n.Request = b, n.Response = C), t.Headers = u, t.Request = b, t.Response = C, t.fetch = T, Object.defineProperty(t, "__esModule", { value: !0 }), t;
		})({});
	})(r), r.fetch.ponyfill = !0, delete r.fetch.polyfill;
	var i = n.fetch ? n : r;
	e = i.fetch, e.default = i.fetch, e.fetch = i.fetch, e.Headers = i.Headers, e.Request = i.Request, e.Response = i.Response, t.exports = e;
})), mo = /* @__PURE__ */ t(((e, t) => {
	t.exports = {};
})), ho = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__setModuleDefault || (Object.create ? (function(e, t) {
		Object.defineProperty(e, "default", {
			enumerable: !0,
			value: t
		});
	}) : function(e, t) {
		e.default = t;
	}), r = e && e.__importStar || function(e) {
		if (e && e.__esModule) return e;
		var r = {};
		if (e != null) for (var i in e) i !== "default" && Object.prototype.hasOwnProperty.call(e, i) && t(r, e, i);
		return n(r, e), r;
	}, i = e && e.__importDefault || function(e) {
		return e && e.__esModule ? e : { default: e };
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Getter = void 0;
	var a = i(po());
	e.Getter = {
		create: o,
		http: s,
		file: c
	};
	function o(e) {
		return typeof e == "function" ? e : e.startsWith("http://") || e.startsWith("https://") ? s(e) : c(e);
	}
	function s(e) {
		return async function(t, n) {
			if (t < 0 || n < 0 || t > n) throw Error("Invalid range");
			let r = await (await (0, a.default)(e, { headers: { Range: `bytes=${t}-${n - 1}` } })).arrayBuffer();
			return new Uint8Array(r);
		};
	}
	function c(e) {
		return async function(t, n) {
			let i = await Promise.resolve().then(() => r(mo()));
			async function a(t = 0, n = Infinity) {
				if (t < 0 || n < 0 || t > n) throw Error("Invalid range");
				return await i.promises.access(e), l(i.createReadStream(e, {
					start: t,
					end: n - 1,
					autoClose: !0
				}));
			}
			return a(t, n);
		};
	}
	async function l(e) {
		return await new Promise((t, n) => {
			let r = [];
			e.on("data", (e) => r.push(e)), e.on("error", n), e.on("end", () => t(Buffer.concat(r)));
		});
	}
})), go = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Key = void 0, e.Key = {
		create: t,
		parse: n,
		toString: r,
		step: i,
		up: a,
		compare: o,
		depth: s
	};
	function t(e, t = 0, r = 0, i = 0) {
		return typeof e == "number" ? [
			e,
			t,
			r,
			i
		] : n(e);
	}
	function n(e) {
		if (typeof e != "string") return e;
		let [t, n, r, i, ...a] = e.split("-").map((e) => parseInt(e, 10)), o = [
			t,
			n,
			r,
			i
		];
		if (a.length !== 0 || o.some((e) => typeof e != "number" || Number.isNaN(e))) throw Error(`Invalid key: ${e}`);
		return o;
	}
	function r(e) {
		return typeof e == "string" ? e : e.join("-");
	}
	function i(t, [n, r, i]) {
		let [a, o, s, c] = e.Key.create(t);
		return [
			a + 1,
			o * 2 + n,
			s * 2 + r,
			c * 2 + i
		];
	}
	function a(t, n = 1) {
		let [r, i, a, o] = e.Key.create(t);
		return [
			r - n,
			i >> n,
			a >> n,
			o >> n
		];
	}
	function o(e, t) {
		for (let n = 0; n < e.length; ++n) {
			if (e[n] < t[n]) return -1;
			if (e[n] > t[n]) return 1;
		}
		return 0;
	}
	function s(e) {
		return e[0];
	}
})), _o = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Scale = void 0, e.Scale = {
		apply: (e, t = 1, n = 0) => (e - n) / t,
		unapply: (e, t = 1, n = 0) => e * t + n
	};
})), vo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Step = void 0, e.Step = {
		fromIndex: t,
		list: n
	};
	function t(e) {
		if (e < 0 || e >= 8) throw Error(`Invalid step index: ${e}`);
		return [
			e >> 0 & 1 ? 1 : 0,
			e >> 1 & 1 ? 1 : 0,
			e >> 2 & 1 ? 1 : 0
		];
	}
	function n() {
		return [
			[
				0,
				0,
				0
			],
			[
				0,
				0,
				1
			],
			[
				0,
				1,
				0
			],
			[
				0,
				1,
				1
			],
			[
				1,
				0,
				0
			],
			[
				1,
				0,
				1
			],
			[
				1,
				1,
				0
			],
			[
				1,
				1,
				1
			]
		];
	}
})), yo = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__exportStar || function(e, n) {
		for (var r in e) r !== "default" && !Object.prototype.hasOwnProperty.call(n, r) && t(n, e, r);
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Step = e.Scale = e.Key = e.Getter = e.Dimension = e.Bounds = e.Binary = void 0, n(co(), e);
	var r = lo();
	Object.defineProperty(e, "Binary", {
		enumerable: !0,
		get: function() {
			return r.Binary;
		}
	});
	var i = uo();
	Object.defineProperty(e, "Bounds", {
		enumerable: !0,
		get: function() {
			return i.Bounds;
		}
	});
	var a = fo();
	Object.defineProperty(e, "Dimension", {
		enumerable: !0,
		get: function() {
			return a.Dimension;
		}
	});
	var o = ho();
	Object.defineProperty(e, "Getter", {
		enumerable: !0,
		get: function() {
			return o.Getter;
		}
	});
	var s = go();
	Object.defineProperty(e, "Key", {
		enumerable: !0,
		get: function() {
			return s.Key;
		}
	});
	var c = _o();
	Object.defineProperty(e, "Scale", {
		enumerable: !0,
		get: function() {
			return c.Scale;
		}
	});
	var l = vo();
	Object.defineProperty(e, "Step", {
		enumerable: !0,
		get: function() {
			return l.Step;
		}
	});
})), bo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.ExtraBytes = void 0;
	var t = yo();
	e.ExtraBytes = {
		getDimension: r,
		parse: i,
		parseOne: a
	};
	var n = 192;
	function r({ type: e, length: t }) {
		switch (e) {
			case "signed":
			case "unsigned": switch (t) {
				case 1:
				case 2:
				case 4:
				case 8: return {
					type: e,
					size: t
				};
			}
			case "float": switch (t) {
				case 4:
				case 8: return {
					type: e,
					size: t
				};
			}
		}
	}
	function i(e) {
		if (e.byteLength % n !== 0) throw Error(`Invalid extra bytes VLR length: ${e.byteLength}`);
		let t = [];
		for (let r = 0; r < e.byteLength; r += n) t.push(a(e.slice(r, r + n)));
		return t;
	}
	function a(e) {
		if (e.byteLength !== n) throw Error(`Invalid extra bytes entry length: ${e.byteLength}`);
		let r = t.Binary.toDataView(e), i = t.Binary.toCString(e.slice(4, 36)), a = t.Binary.toCString(e.slice(60, 192)), c = r.getUint8(2), l = r.getUint8(3);
		if (c >= 11) throw Error(`Invalid extra bytes "type" value: ${c}`);
		if (c === 0) return {
			name: i,
			description: a,
			length: l
		};
		let u = s(l), d = o(c);
		if (!d) throw Error(`Failed to extract dimension type: ${c}`);
		let { type: f, size: p } = d;
		function m(e) {
			switch (f) {
				case "signed": return (0, t.parseBigInt)(r.getBigInt64(e, !0));
				case "unsigned": return (0, t.parseBigInt)((0, t.getBigUint64)(r, e, !0));
				case "float": return r.getFloat64(e, !0);
			}
		}
		let h = {
			name: i,
			description: a,
			type: f,
			length: p
		};
		return u.hasNodata && (h.nodata = m(40)), u.hasMin && (h.min = m(64)), u.hasMax && (h.max = m(88)), u.hasScale && (h.scale = r.getFloat64(112)), u.hasOffset && (h.offset = r.getFloat64(136)), h;
	}
	function o(e) {
		switch (e) {
			case 1: return t.Dimension.Type.uint8;
			case 2: return t.Dimension.Type.int8;
			case 3: return t.Dimension.Type.uint16;
			case 4: return t.Dimension.Type.int16;
			case 5: return t.Dimension.Type.uint32;
			case 6: return t.Dimension.Type.int32;
			case 7: return t.Dimension.Type.uint64;
			case 8: return t.Dimension.Type.int64;
			case 9: return t.Dimension.Type.float32;
			case 10: return t.Dimension.Type.float64;
		}
	}
	function s(e) {
		return {
			hasNodata: !!(e & 1),
			hasMin: !!(e >> 1 & 1),
			hasMax: !!(e >> 2 & 1),
			hasScale: !!(e >> 3 & 1),
			hasOffset: !!(e >> 4 & 1)
		};
	}
})), xo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Dimensions = void 0;
	var t = yo(), n = bo();
	e.Dimensions = { create: a };
	var { Type: r } = t.Dimension, i = {
		X: r.float64,
		Y: r.float64,
		Z: r.float64,
		Intensity: r.uint16,
		ReturnNumber: r.uint8,
		NumberOfReturns: r.uint8,
		ScanDirectionFlag: r.boolean,
		EdgeOfFlightLine: r.boolean,
		Classification: r.uint8,
		Synthetic: r.boolean,
		KeyPoint: r.boolean,
		Withheld: r.boolean,
		Overlap: r.boolean,
		ScanAngle: r.float32,
		UserData: r.uint8,
		PointSourceId: r.uint16,
		GpsTime: r.float64,
		Red: r.uint16,
		Green: r.uint16,
		Blue: r.uint16,
		ScannerChannel: r.uint8,
		Infrared: r.uint16
	};
	function a(e, t = []) {
		return Object.keys(e).reduce((e, r) => {
			let a = i[r];
			if (a) return {
				...e,
				[r]: a
			};
			let o = t.find((e) => e.name === r), s = o && n.ExtraBytes.getDimension(o);
			if (s) return {
				...e,
				[r]: s
			};
			throw Error(`Failed to look up LAS type: ${r}`);
		}, {});
	}
})), So = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Extractor = void 0;
	var t = yo();
	e.Extractor = { create: a };
	function n(e) {
		switch (e) {
			case 0: return 20;
			case 1: return 28;
			case 2: return 26;
			case 3: return 34;
			case 6: return 30;
			case 7: return 36;
			case 8: return 38;
			default: throw Error(`Unsupported point data record format: ${e}`);
		}
	}
	function r(e, n, { type: r, length: i }) {
		let a = p(e);
		switch (r) {
			case "signed": switch (i) {
				case 1: return (e, t) => e.getInt8(a(t) + n);
				case 2: return (e, t) => e.getInt16(a(t) + n, !0);
				case 4: return (e, t) => e.getInt32(a(t) + n, !0);
				case 8: return (e, r) => (0, t.parseBigInt)(e.getBigInt64(a(r) + n, !0));
			}
			case "unsigned": switch (i) {
				case 1: return (e, t) => e.getUint8(a(t) + n);
				case 2: return (e, t) => e.getUint16(a(t) + n, !0);
				case 4: return (e, t) => e.getUint32(a(t) + n, !0);
				case 8: return (e, r) => (0, t.parseBigInt)((0, t.getBigUint64)(e, a(r) + n, !0));
			}
			case "float": switch (i) {
				case 4: return (e, t) => e.getFloat32(a(t) + n, !0);
				case 8: return (e, t) => e.getFloat64(a(t) + n, !0);
			}
		}
	}
	function i(e, i) {
		let a = n(e.pointDataRecordFormat);
		return i.reduce((n, i) => {
			let o = a;
			a += i.length;
			let s = r(e, o, i);
			if (!s) return n;
			let c = (e, n) => t.Scale.unapply(s(e, n), i.scale, i.offset);
			return {
				...n,
				[i.name]: c
			};
		}, {});
	}
	function a(e, t = []) {
		let n = i(e, t);
		return {
			...(() => {
				let { pointDataRecordFormat: t } = e;
				switch (t) {
					case 0: return o(e);
					case 1: return s(e);
					case 2: return c(e);
					case 3: return l(e);
					case 6: return u(e);
					case 7: return d(e);
					case 8: return f(e);
					default: throw Error(`Unsupported point data record format: ${t}`);
				}
			})(),
			...n
		};
	}
	function o(e) {
		let { scale: n, offset: r } = e, i = p(e);
		function a(e, t) {
			return e.getUint8(i(t) + 14);
		}
		function o(e, t) {
			return e.getUint8(i(t) + 15);
		}
		function s(e, t) {
			return o(e, t) & 31;
		}
		return {
			X: (e, a) => t.Scale.unapply(e.getInt32(i(a), !0), n[0], r[0]),
			Y: (e, a) => t.Scale.unapply(e.getInt32(i(a) + 4, !0), n[1], r[1]),
			Z: (e, a) => t.Scale.unapply(e.getInt32(i(a) + 8, !0), n[2], r[2]),
			Intensity: (e, t) => e.getUint16(i(t) + 12, !0),
			ReturnNumber: (e, t) => a(e, t) & 7,
			NumberOfReturns: (e, t) => (a(e, t) & 56) >> 3,
			ScanDirectionFlag: (e, t) => (a(e, t) & 64) >> 6,
			EdgeOfFlightLine: (e, t) => (a(e, t) & 128) >> 7,
			Classification: (e, t) => {
				let n = s(e, t);
				return n === 12 ? 0 : n;
			},
			Synthetic: (e, t) => (o(e, t) & 32) >> 5,
			KeyPoint: (e, t) => (o(e, t) & 64) >> 6,
			Withheld: (e, t) => (o(e, t) & 128) >> 7,
			Overlap: (e, t) => +(s(e, t) === 12),
			ScanAngle: (e, t) => e.getInt8(i(t) + 16),
			UserData: (e, t) => e.getUint8(i(t) + 17),
			PointSourceId: (e, t) => e.getUint16(i(t) + 18, !0)
		};
	}
	function s(e) {
		let t = p(e);
		return {
			...o(e),
			GpsTime: (e, n) => e.getFloat64(t(n) + 20, !0)
		};
	}
	function c(e) {
		let t = p(e);
		return {
			...o(e),
			Red: (e, n) => e.getUint16(t(n) + 20, !0),
			Green: (e, n) => e.getUint16(t(n) + 22, !0),
			Blue: (e, n) => e.getUint16(t(n) + 24, !0)
		};
	}
	function l(e) {
		let t = p(e);
		return {
			...o(e),
			GpsTime: (e, n) => e.getFloat64(t(n) + 20, !0),
			Red: (e, n) => e.getUint16(t(n) + 28, !0),
			Green: (e, n) => e.getUint16(t(n) + 30, !0),
			Blue: (e, n) => e.getUint16(t(n) + 32, !0)
		};
	}
	function u(e) {
		let { scale: n, offset: r } = e, i = p(e);
		function a(e, t) {
			return e.getUint8(i(t) + 15);
		}
		return {
			X: (e, a) => t.Scale.unapply(e.getInt32(i(a), !0), n[0], r[0]),
			Y: (e, a) => t.Scale.unapply(e.getInt32(i(a) + 4, !0), n[1], r[1]),
			Z: (e, a) => t.Scale.unapply(e.getInt32(i(a) + 8, !0), n[2], r[2]),
			Intensity: (e, t) => e.getUint16(i(t) + 12, !0),
			ReturnNumber: (e, t) => e.getUint16(i(t) + 14, !0) & 15,
			NumberOfReturns: (e, t) => (e.getUint16(i(t) + 14, !0) & 240) >> 4,
			Synthetic: (e, t) => a(e, t) & 1,
			KeyPoint: (e, t) => (a(e, t) & 2) >> 1,
			Withheld: (e, t) => (a(e, t) & 4) >> 2,
			Overlap: (e, t) => (a(e, t) & 8) >> 3,
			ScannerChannel: (e, t) => (a(e, t) & 48) >> 4,
			ScanDirectionFlag: (e, t) => (a(e, t) & 64) >> 6,
			EdgeOfFlightLine: (e, t) => (a(e, t) & 128) >> 7,
			Classification: (e, t) => e.getUint8(i(t) + 16),
			UserData: (e, t) => e.getUint8(i(t) + 17),
			ScanAngle: (e, t) => e.getInt16(i(t) + 18, !0) * .006,
			PointSourceId: (e, t) => e.getUint16(i(t) + 20, !0),
			GpsTime: (e, t) => e.getFloat64(i(t) + 22, !0)
		};
	}
	function d(e) {
		let t = p(e);
		return {
			...u(e),
			Red: (e, n) => e.getUint16(t(n) + 30, !0),
			Green: (e, n) => e.getUint16(t(n) + 32, !0),
			Blue: (e, n) => e.getUint16(t(n) + 34, !0)
		};
	}
	function f(e) {
		let t = p(e);
		return {
			...d(e),
			Infrared: (e, n) => e.getUint16(t(n) + 36, !0)
		};
	}
	function p(e) {
		let { pointDataRecordLength: t } = e;
		return function(e) {
			return e * t;
		};
	}
})), Co = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.formatGuid = e.parsePoint = void 0;
	var t = yo();
	function n(e) {
		let n = t.Binary.toDataView(e);
		if (n.byteLength !== 24) throw Error(`Invalid tuple buffer length: ${n.byteLength}`);
		return [
			n.getFloat64(0, !0),
			n.getFloat64(8, !0),
			n.getFloat64(16, !0)
		];
	}
	e.parsePoint = n;
	function r(e) {
		let n = t.Binary.toDataView(e);
		if (n.byteLength !== 16) throw Error(`Invalid GUID buffer length: ${n.byteLength}`);
		let r = "";
		for (let e = 0; e < n.byteLength; e += 4) {
			let t = n.getUint32(e, !0);
			r += t.toString(16).padStart(8, "0");
		}
		return [
			r.slice(0, 8),
			r.slice(8, 12),
			r.slice(12, 16),
			r.slice(16, 32)
		].join("-");
	}
	e.formatGuid = r;
})), wo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Header = void 0;
	var t = yo(), n = so(), r = Co();
	e.Header = { parse: i };
	function i(e) {
		if (e.byteLength < n.minHeaderLength) throw Error(`Invalid header: must be at least ${n.minHeaderLength} bytes`);
		let i = t.Binary.toDataView(e), s = t.Binary.toCString(e.slice(0, 4));
		if (s !== "LASF") throw Error(`Invalid file signature: ${s}`);
		let c = i.getUint8(24), l = i.getUint8(25);
		if (c !== 1 || l !== 2 && l !== 4) throw Error(`Invalid version (only 1.2 and 1.4 supported): ${c}.${l}`);
		let u = {
			fileSignature: s,
			fileSourceId: i.getUint16(4, !0),
			globalEncoding: i.getUint16(6, !0),
			projectId: (0, r.formatGuid)(e.slice(8, 24)),
			majorVersion: c,
			minorVersion: l,
			systemIdentifier: t.Binary.toCString(e.slice(26, 58)),
			generatingSoftware: t.Binary.toCString(e.slice(58, 90)),
			fileCreationDayOfYear: i.getUint16(90, !0),
			fileCreationYear: i.getUint16(92, !0),
			headerLength: i.getUint16(94, !0),
			pointDataOffset: i.getUint32(96, !0),
			vlrCount: i.getUint32(100, !0),
			pointDataRecordFormat: i.getUint8(104) & 15,
			pointDataRecordLength: i.getUint16(105, !0),
			pointCount: i.getUint32(107, !0),
			pointCountByReturn: o(e.slice(111, 131)),
			scale: (0, r.parsePoint)(e.slice(131, 155)),
			offset: (0, r.parsePoint)(e.slice(155, 179)),
			min: [
				i.getFloat64(187, !0),
				i.getFloat64(203, !0),
				i.getFloat64(219, !0)
			],
			max: [
				i.getFloat64(179, !0),
				i.getFloat64(195, !0),
				i.getFloat64(211, !0)
			],
			waveformDataOffset: 0,
			evlrOffset: 0,
			evlrCount: 0
		};
		return l == 2 ? u : {
			...u,
			pointCount: (0, t.parseBigInt)((0, t.getBigUint64)(i, 247, !0)),
			pointCountByReturn: a(e.slice(255, 375)),
			waveformDataOffset: (0, t.parseBigInt)((0, t.getBigUint64)(i, 227, !0)),
			evlrOffset: (0, t.parseBigInt)((0, t.getBigUint64)(i, 235, !0)),
			evlrCount: i.getUint32(243, !0)
		};
	}
	function a(e) {
		let n = t.Binary.toDataView(e), r = [];
		for (let e = 0; e < 120; e += 8) r.push((0, t.getBigUint64)(n, e, !0));
		return r.map((e) => (0, t.parseBigInt)(e));
	}
	function o(e) {
		let n = t.Binary.toDataView(e), r = [];
		for (let e = 0; e < 20; e += 4) r.push(n.getUint32(e, !0));
		return r;
	}
})), To = /* @__PURE__ */ t(((e, t) => {
	var n = (() => {
		var e = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
		return (function(t) {
			t ||= {};
			var n = t === void 0 ? {} : t, r, i;
			n.ready = new Promise(function(e, t) {
				r = e, i = t;
			}), [
				"_main",
				"___getTypeName",
				"__embind_initialize_bindings",
				"_fflush",
				"onRuntimeInitialized"
			].forEach((e) => {
				Object.getOwnPropertyDescriptor(n.ready, e) || Object.defineProperty(n.ready, e, {
					get: () => I("You are getting " + e + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js"),
					set: () => I("You are setting " + e + " on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js")
				});
			});
			var a = Object.assign({}, n), o = [], s = "./this.program", c = !0;
			if (n.ENVIRONMENT) throw Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
			var l = "";
			function u(e) {
				return n.locateFile ? n.locateFile(e, l) : l + e;
			}
			var d;
			if (c) {
				if (typeof document < "u" && document.currentScript && (l = document.currentScript.src), e && (l = e), l = l.indexOf("blob:") === 0 ? "" : l.substr(0, l.replace(/[?#].*/, "").lastIndexOf("/") + 1), !(typeof window == "object" || typeof importScripts == "function")) throw Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
			} else throw Error("environment detection error");
			var f = n.print || console.log.bind(console), p = n.printErr || console.warn.bind(console);
			Object.assign(n, a), a = null, qn(), n.arguments && (o = n.arguments), m("arguments", "arguments_"), n.thisProgram && (s = n.thisProgram), m("thisProgram", "thisProgram"), n.quit && n.quit, m("quit", "quit_"), S(n.memoryInitializerPrefixURL === void 0, "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead"), S(n.pthreadMainPrefixURL === void 0, "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead"), S(n.cdInitializerPrefixURL === void 0, "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead"), S(n.filePackagePrefixURL === void 0, "Module.filePackagePrefixURL option was removed, use Module.locateFile instead"), S(n.read === void 0, "Module.read option was removed (modify read_ in JS)"), S(n.readAsync === void 0, "Module.readAsync option was removed (modify readAsync in JS)"), S(n.readBinary === void 0, "Module.readBinary option was removed (modify readBinary in JS)"), S(n.setWindowTitle === void 0, "Module.setWindowTitle option was removed (modify setWindowTitle in JS)"), S(n.TOTAL_MEMORY === void 0, "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY"), m("read", "read_"), m("readAsync", "readAsync"), m("readBinary", "readBinary"), m("setWindowTitle", "setWindowTitle"), S(!0, "worker environment detected but not enabled at build time.  Add 'worker' to `-sENVIRONMENT` to enable."), S(!0, "node environment detected but not enabled at build time.  Add 'node' to `-sENVIRONMENT` to enable."), S(!0, "shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.");
			function m(e, t) {
				Object.getOwnPropertyDescriptor(n, e) || Object.defineProperty(n, e, {
					configurable: !0,
					get: function() {
						I("Module." + e + " has been replaced with plain " + t + " (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)");
					}
				});
			}
			function h(e) {
				Object.getOwnPropertyDescriptor(n, e) && I("`Module." + e + "` was supplied but `" + e + "` not included in INCOMING_MODULE_JS_API");
			}
			function g(e) {
				return e === "FS_createPath" || e === "FS_createDataFile" || e === "FS_createPreloadedFile" || e === "FS_unlink" || e === "addRunDependency" || e === "FS_createLazyFile" || e === "FS_createDevice" || e === "removeRunDependency";
			}
			function _(e) {
				typeof globalThis < "u" && !Object.getOwnPropertyDescriptor(globalThis, e) && Object.defineProperty(globalThis, e, {
					configurable: !0,
					get: function() {
						var t = "`" + e + "` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line";
						g(e) && (t += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you"), ke(t);
					}
				});
			}
			function v(e) {
				Object.getOwnPropertyDescriptor(n, e) || Object.defineProperty(n, e, {
					configurable: !0,
					get: function() {
						var t = "'" + e + "' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)";
						g(e) && (t += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you"), I(t);
					}
				});
			}
			var y;
			n.wasmBinary && (y = n.wasmBinary), m("wasmBinary", "wasmBinary"), n.noExitRuntime, m("noExitRuntime", "noExitRuntime"), typeof WebAssembly != "object" && I("no native wasm support detected");
			var b, x = !1;
			function S(e, t) {
				e || I("Assertion failed" + (t ? ": " + t : ""));
			}
			var C = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0;
			function w(e, t, n) {
				for (var r = t + n, i = t; e[i] && !(i >= r);) ++i;
				if (i - t > 16 && e.buffer && C) return C.decode(e.subarray(t, i));
				for (var a = ""; t < i;) {
					var o = e[t++];
					if (!(o & 128)) {
						a += String.fromCharCode(o);
						continue;
					}
					var s = e[t++] & 63;
					if ((o & 224) == 192) {
						a += String.fromCharCode((o & 31) << 6 | s);
						continue;
					}
					var c = e[t++] & 63;
					if ((o & 240) == 224 ? o = (o & 15) << 12 | s << 6 | c : ((o & 248) != 240 && ke("Invalid UTF-8 leading byte 0x" + o.toString(16) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!"), o = (o & 7) << 18 | s << 12 | c << 6 | e[t++] & 63), o < 65536) a += String.fromCharCode(o);
					else {
						var l = o - 65536;
						a += String.fromCharCode(55296 | l >> 10, 56320 | l & 1023);
					}
				}
				return a;
			}
			function T(e, t) {
				return e ? w(k, e, t) : "";
			}
			function E(e, t, n, r) {
				if (!(r > 0)) return 0;
				for (var i = n, a = n + r - 1, o = 0; o < e.length; ++o) {
					var s = e.charCodeAt(o);
					if (s >= 55296 && s <= 57343) {
						var c = e.charCodeAt(++o);
						s = 65536 + ((s & 1023) << 10) | c & 1023;
					}
					if (s <= 127) {
						if (n >= a) break;
						t[n++] = s;
					} else if (s <= 2047) {
						if (n + 1 >= a) break;
						t[n++] = 192 | s >> 6, t[n++] = 128 | s & 63;
					} else if (s <= 65535) {
						if (n + 2 >= a) break;
						t[n++] = 224 | s >> 12, t[n++] = 128 | s >> 6 & 63, t[n++] = 128 | s & 63;
					} else {
						if (n + 3 >= a) break;
						s > 1114111 && ke("Invalid Unicode code point 0x" + s.toString(16) + " encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF)."), t[n++] = 240 | s >> 18, t[n++] = 128 | s >> 12 & 63, t[n++] = 128 | s >> 6 & 63, t[n++] = 128 | s & 63;
					}
				}
				return t[n] = 0, n - i;
			}
			function D(e, t, n) {
				return S(typeof n == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), E(e, k, t, n);
			}
			function ee(e) {
				for (var t = 0, n = 0; n < e.length; ++n) {
					var r = e.charCodeAt(n);
					r <= 127 ? t++ : r <= 2047 ? t += 2 : r >= 55296 && r <= 57343 ? (t += 4, ++n) : t += 3;
				}
				return t;
			}
			var te, O, k, ne, re, A, j, ie, ae;
			function oe(e) {
				te = e, n.HEAP8 = O = new Int8Array(e), n.HEAP16 = ne = new Int16Array(e), n.HEAP32 = A = new Int32Array(e), n.HEAPU8 = k = new Uint8Array(e), n.HEAPU16 = re = new Uint16Array(e), n.HEAPU32 = j = new Uint32Array(e), n.HEAPF32 = ie = new Float32Array(e), n.HEAPF64 = ae = new Float64Array(e);
			}
			var se = 65536;
			n.TOTAL_STACK && S(se === n.TOTAL_STACK, "the stack size can no longer be determined at runtime");
			var M = n.INITIAL_MEMORY || 262144;
			m("INITIAL_MEMORY", "INITIAL_MEMORY"), S(M >= se, "INITIAL_MEMORY should be larger than TOTAL_STACK, was " + M + "! (TOTAL_STACK=" + se + ")"), S(typeof Int32Array < "u" && typeof Float64Array < "u" && Int32Array.prototype.subarray != null && Int32Array.prototype.set != null, "JS engine does not provide full typed array support"), S(!n.wasmMemory, "Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally"), S(M == 262144, "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically");
			var ce;
			function le() {
				var e = tr();
				S((e & 3) == 0), j[e >> 2] = 34821223, j[e + 4 >> 2] = 2310721022, j[0] = 1668509029;
			}
			function ue() {
				if (!x) {
					var e = tr(), t = j[e >> 2], n = j[e + 4 >> 2];
					(t != 34821223 || n != 2310721022) && I("Stack overflow! Stack cookie has been overwritten at 0x" + e.toString(16) + ", expected hex dwords 0x89BACDFE and 0x2135467, but received 0x" + n.toString(16) + " 0x" + t.toString(16)), j[0] !== 1668509029 && I("Runtime error: The application has corrupted its heap memory area (address zero)!");
				}
			}
			(function() {
				var e = /* @__PURE__ */ new Int16Array(1), t = new Int8Array(e.buffer);
				if (e[0] = 25459, t[0] !== 115 || t[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
			})();
			var de = [], N = [], fe = [], pe = !1;
			function me() {
				if (n.preRun) for (typeof n.preRun == "function" && (n.preRun = [n.preRun]); n.preRun.length;) _e(n.preRun.shift());
				Oe(de);
			}
			function he() {
				S(!pe), pe = !0, ue(), Oe(N);
			}
			function ge() {
				if (ue(), n.postRun) for (typeof n.postRun == "function" && (n.postRun = [n.postRun]); n.postRun.length;) ye(n.postRun.shift());
				Oe(fe);
			}
			function _e(e) {
				de.unshift(e);
			}
			function ve(e) {
				N.unshift(e);
			}
			function ye(e) {
				fe.unshift(e);
			}
			S(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), S(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), S(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill"), S(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
			var be = 0, P = null, F = null, xe = {};
			function Se(e) {
				be++, n.monitorRunDependencies && n.monitorRunDependencies(be), e ? (S(!xe[e]), xe[e] = 1, P === null && typeof setInterval < "u" && (P = setInterval(function() {
					if (x) {
						clearInterval(P), P = null;
						return;
					}
					var e = !1;
					for (var t in xe) e || (e = !0, p("still waiting on run dependencies:")), p("dependency: " + t);
					e && p("(end of list)");
				}, 1e4))) : p("warning: run dependency added without ID");
			}
			function Ce(e) {
				if (be--, n.monitorRunDependencies && n.monitorRunDependencies(be), e ? (S(xe[e]), delete xe[e]) : p("warning: run dependency removed without ID"), be == 0 && (P !== null && (clearInterval(P), P = null), F)) {
					var t = F;
					F = null, t();
				}
			}
			function I(e) {
				n.onAbort && n.onAbort(e), e = "Aborted(" + e + ")", p(e), x = !0;
				var t = new WebAssembly.RuntimeError(e);
				throw i(t), t;
			}
			var L = {
				error: function() {
					I("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM");
				},
				init: function() {
					L.error();
				},
				createDataFile: function() {
					L.error();
				},
				createPreloadedFile: function() {
					L.error();
				},
				createLazyFile: function() {
					L.error();
				},
				open: function() {
					L.error();
				},
				mkdev: function() {
					L.error();
				},
				registerDevice: function() {
					L.error();
				},
				analyzePath: function() {
					L.error();
				},
				loadFilesFromDB: function() {
					L.error();
				},
				ErrnoError: function() {
					L.error();
				}
			};
			n.FS_createDataFile = L.createDataFile, n.FS_createPreloadedFile = L.createPreloadedFile;
			var we = "data:application/octet-stream;base64,";
			function Te(e) {
				return e.startsWith(we);
			}
			function Ee(e) {
				return e.startsWith("file://");
			}
			function R(e, t) {
				return function() {
					var r = e, i = t;
					return t || (i = n.asm), S(pe, "native function `" + r + "` called before runtime initialization"), i[e] || S(i[e], "exported native function `" + r + "` not found"), i[e].apply(null, arguments);
				};
			}
			var z = "laz-perf.wasm";
			Te(z) || (z = u(z));
			function De(e) {
				try {
					if (e == z && y) return new Uint8Array(y);
					if (d) return d(e);
					throw "both async and sync fetching of the wasm failed";
				} catch (e) {
					I(e);
				}
			}
			function B() {
				return !y && c && typeof fetch == "function" ? fetch(z, { credentials: "same-origin" }).then(function(e) {
					if (!e.ok) throw "failed to load wasm binary file at '" + z + "'";
					return e.arrayBuffer();
				}).catch(function() {
					return De(z);
				}) : Promise.resolve().then(function() {
					return De(z);
				});
			}
			function V() {
				var e = {
					env: Jn,
					wasi_snapshot_preview1: Jn
				};
				function t(e, t) {
					n.asm = e.exports, b = n.asm.memory, S(b, "memory not found in wasm exports"), oe(b.buffer), ce = n.asm.__indirect_function_table, S(ce, "table not found in wasm exports"), ve(n.asm.__wasm_call_ctors), Ce("wasm-instantiate");
				}
				Se("wasm-instantiate");
				var r = n;
				function a(e) {
					S(n === r, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?"), r = null, t(e.instance);
				}
				function o(t) {
					return B().then(function(t) {
						return WebAssembly.instantiate(t, e);
					}).then(function(e) {
						return e;
					}).then(t, function(e) {
						p("failed to asynchronously prepare wasm: " + e), Ee(z) && p("warning: Loading from a file URI (" + z + ") is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing"), I(e);
					});
				}
				function s() {
					return !y && typeof WebAssembly.instantiateStreaming == "function" && !Te(z) && typeof fetch == "function" ? fetch(z, { credentials: "same-origin" }).then(function(t) {
						return WebAssembly.instantiateStreaming(t, e).then(a, function(e) {
							return p("wasm streaming compile failed: " + e), p("falling back to ArrayBuffer instantiation"), o(a);
						});
					}) : o(a);
				}
				if (n.instantiateWasm) try {
					return n.instantiateWasm(e, t);
				} catch (e) {
					return p("Module.instantiateWasm callback failed with error: " + e), !1;
				}
				return s().catch(i), {};
			}
			function Oe(e) {
				for (; e.length > 0;) e.shift()(n);
			}
			function ke(e) {
				ke.shown ||= {}, ke.shown[e] || (ke.shown[e] = 1, p(e));
			}
			function Ae(e, t) {
				S(e.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)"), O.set(e, t);
			}
			function je(e) {
				return Yn(e + 24) + 24;
			}
			function Me(e) {
				this.excPtr = e, this.ptr = e - 24, this.set_type = function(e) {
					j[this.ptr + 4 >> 2] = e;
				}, this.get_type = function() {
					return j[this.ptr + 4 >> 2];
				}, this.set_destructor = function(e) {
					j[this.ptr + 8 >> 2] = e;
				}, this.get_destructor = function() {
					return j[this.ptr + 8 >> 2];
				}, this.set_refcount = function(e) {
					A[this.ptr >> 2] = e;
				}, this.set_caught = function(e) {
					e = +!!e, O[this.ptr + 12 >> 0] = e;
				}, this.get_caught = function() {
					return O[this.ptr + 12 >> 0] != 0;
				}, this.set_rethrown = function(e) {
					e = +!!e, O[this.ptr + 13 >> 0] = e;
				}, this.get_rethrown = function() {
					return O[this.ptr + 13 >> 0] != 0;
				}, this.init = function(e, t) {
					this.set_adjusted_ptr(0), this.set_type(e), this.set_destructor(t), this.set_refcount(0), this.set_caught(!1), this.set_rethrown(!1);
				}, this.add_ref = function() {
					var e = A[this.ptr >> 2];
					A[this.ptr >> 2] = e + 1;
				}, this.release_ref = function() {
					var e = A[this.ptr >> 2];
					return A[this.ptr >> 2] = e - 1, S(e > 0), e === 1;
				}, this.set_adjusted_ptr = function(e) {
					j[this.ptr + 16 >> 2] = e;
				}, this.get_adjusted_ptr = function() {
					return j[this.ptr + 16 >> 2];
				}, this.get_exception_ptr = function() {
					if (nr(this.get_type())) return j[this.excPtr >> 2];
					var e = this.get_adjusted_ptr();
					return e === 0 ? this.excPtr : e;
				};
			}
			var Ne = 0;
			function Pe(e, t, n) {
				throw new Me(e).init(t, n), Ne++, e + " - Exception catching is disabled, this exception cannot be caught. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.";
			}
			function Fe(e, t, n, r, i) {}
			function Ie(e) {
				switch (e) {
					case 1: return 0;
					case 2: return 1;
					case 4: return 2;
					case 8: return 3;
					default: throw TypeError("Unknown type size: " + e);
				}
			}
			function Le() {
				for (var e = Array(256), t = 0; t < 256; ++t) e[t] = String.fromCharCode(t);
				Re = e;
			}
			var Re = void 0;
			function H(e) {
				for (var t = "", n = e; k[n];) t += Re[k[n++]];
				return t;
			}
			var ze = {}, Be = {}, Ve = {}, He = 48, Ue = 57;
			function We(e) {
				if (e === void 0) return "_unknown";
				e = e.replace(/[^a-zA-Z0-9_]/g, "$");
				var t = e.charCodeAt(0);
				return t >= He && t <= Ue ? "_" + e : e;
			}
			function Ge(e, t) {
				return e = We(e), function() {
					return t.apply(this, arguments);
				};
			}
			function Ke(e, t) {
				var n = Ge(t, function(e) {
					this.name = t, this.message = e;
					var n = Error(e).stack;
					n !== void 0 && (this.stack = this.toString() + "\n" + n.replace(/^Error(:[^\n]*)?\n/, ""));
				});
				return n.prototype = Object.create(e.prototype), n.prototype.constructor = n, n.prototype.toString = function() {
					return this.message === void 0 ? this.name : this.name + ": " + this.message;
				}, n;
			}
			var qe = void 0;
			function U(e) {
				throw new qe(e);
			}
			var Je = void 0;
			function Ye(e) {
				throw new Je(e);
			}
			function Xe(e, t, n) {
				e.forEach(function(e) {
					Ve[e] = t;
				});
				function r(t) {
					var r = n(t);
					r.length !== e.length && Ye("Mismatched type converter count");
					for (var i = 0; i < e.length; ++i) Ze(e[i], r[i]);
				}
				var i = Array(t.length), a = [], o = 0;
				t.forEach((e, t) => {
					Be.hasOwnProperty(e) ? i[t] = Be[e] : (a.push(e), ze.hasOwnProperty(e) || (ze[e] = []), ze[e].push(() => {
						i[t] = Be[e], ++o, o === a.length && r(i);
					}));
				}), a.length === 0 && r(i);
			}
			function Ze(e, t, n = {}) {
				if (!("argPackAdvance" in t)) throw TypeError("registerType registeredInstance requires argPackAdvance");
				var r = t.name;
				if (e || U("type \"" + r + "\" must have a positive integer typeid pointer"), Be.hasOwnProperty(e)) {
					if (n.ignoreDuplicateRegistrations) return;
					U("Cannot register type '" + r + "' twice");
				}
				if (Be[e] = t, delete Ve[e], ze.hasOwnProperty(e)) {
					var i = ze[e];
					delete ze[e], i.forEach((e) => e());
				}
			}
			function Qe(e, t, n, r, i) {
				var a = Ie(n);
				t = H(t), Ze(e, {
					name: t,
					fromWireType: function(e) {
						return !!e;
					},
					toWireType: function(e, t) {
						return t ? r : i;
					},
					argPackAdvance: 8,
					readValueFromPointer: function(e) {
						var r;
						if (n === 1) r = O;
						else if (n === 2) r = ne;
						else if (n === 4) r = A;
						else throw TypeError("Unknown boolean type size: " + t);
						return this.fromWireType(r[e >> a]);
					},
					destructorFunction: null
				});
			}
			function $e(e) {
				if (!(this instanceof Tt) || !(e instanceof Tt)) return !1;
				for (var t = this.$$.ptrType.registeredClass, n = this.$$.ptr, r = e.$$.ptrType.registeredClass, i = e.$$.ptr; t.baseClass;) n = t.upcast(n), t = t.baseClass;
				for (; r.baseClass;) i = r.upcast(i), r = r.baseClass;
				return t === r && n === i;
			}
			function et(e) {
				return {
					count: e.count,
					deleteScheduled: e.deleteScheduled,
					preservePointerOnDelete: e.preservePointerOnDelete,
					ptr: e.ptr,
					ptrType: e.ptrType,
					smartPtr: e.smartPtr,
					smartPtrType: e.smartPtrType
				};
			}
			function tt(e) {
				function t(e) {
					return e.$$.ptrType.registeredClass.name;
				}
				U(t(e) + " instance already deleted");
			}
			var nt = !1;
			function rt(e) {}
			function it(e) {
				e.smartPtr ? e.smartPtrType.rawDestructor(e.smartPtr) : e.ptrType.registeredClass.rawDestructor(e.ptr);
			}
			function at(e) {
				--e.count.value, e.count.value === 0 && it(e);
			}
			function ot(e, t, n) {
				if (t === n) return e;
				if (n.baseClass === void 0) return null;
				var r = ot(e, t, n.baseClass);
				return r === null ? null : n.downcast(r);
			}
			var st = {};
			function ct() {
				return Object.keys(mt).length;
			}
			function lt() {
				var e = [];
				for (var t in mt) mt.hasOwnProperty(t) && e.push(mt[t]);
				return e;
			}
			var ut = [];
			function W() {
				for (; ut.length;) {
					var e = ut.pop();
					e.$$.deleteScheduled = !1, e.delete();
				}
			}
			var dt = void 0;
			function ft(e) {
				dt = e, ut.length && dt && dt(W);
			}
			function pt() {
				n.getInheritedInstanceCount = ct, n.getLiveInheritedInstances = lt, n.flushPendingDeletes = W, n.setDelayFunction = ft;
			}
			var mt = {};
			function ht(e, t) {
				for (t === void 0 && U("ptr should not be undefined"); e.baseClass;) t = e.upcast(t), e = e.baseClass;
				return t;
			}
			function gt(e, t) {
				return t = ht(e, t), mt[t];
			}
			function _t(e, t) {
				return (!t.ptrType || !t.ptr) && Ye("makeClassHandle requires ptr and ptrType"), !!t.smartPtrType != !!t.smartPtr && Ye("Both smartPtrType and smartPtr must be specified"), t.count = { value: 1 }, yt(Object.create(e, { $$: { value: t } }));
			}
			function vt(e) {
				var t = this.getPointee(e);
				if (!t) return this.destructor(e), null;
				var n = gt(this.registeredClass, t);
				if (n !== void 0) {
					if (n.$$.count.value === 0) return n.$$.ptr = t, n.$$.smartPtr = e, n.clone();
					var r = n.clone();
					return this.destructor(e), r;
				}
				function i() {
					return this.isSmartPointer ? _t(this.registeredClass.instancePrototype, {
						ptrType: this.pointeeType,
						ptr: t,
						smartPtrType: this,
						smartPtr: e
					}) : _t(this.registeredClass.instancePrototype, {
						ptrType: this,
						ptr: e
					});
				}
				var a = st[this.registeredClass.getActualType(t)];
				if (!a) return i.call(this);
				var o = this.isConst ? a.constPointerType : a.pointerType, s = ot(t, this.registeredClass, o.registeredClass);
				return s === null ? i.call(this) : this.isSmartPointer ? _t(o.registeredClass.instancePrototype, {
					ptrType: o,
					ptr: s,
					smartPtrType: this,
					smartPtr: e
				}) : _t(o.registeredClass.instancePrototype, {
					ptrType: o,
					ptr: s
				});
			}
			function yt(e) {
				return typeof FinalizationRegistry > "u" ? (yt = (e) => e, e) : (nt = new FinalizationRegistry((e) => {
					console.warn(e.leakWarning.stack.replace(/^Error: /, "")), at(e.$$);
				}), yt = (e) => {
					var t = e.$$;
					if (t.smartPtr) {
						var n = { $$: t }, r = t.ptrType.registeredClass;
						n.leakWarning = /* @__PURE__ */ Error("Embind found a leaked C++ instance " + r.name + " <0x" + t.ptr.toString(16) + ">.\nWe'll free it automatically in this case, but this functionality is not reliable across various environments.\nMake sure to invoke .delete() manually once you're done with the instance instead.\nOriginally allocated"), "captureStackTrace" in Error && Error.captureStackTrace(n.leakWarning, vt), nt.register(e, n, e);
					}
					return e;
				}, rt = (e) => nt.unregister(e), yt(e));
			}
			function bt() {
				if (this.$$.ptr || tt(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
				var e = yt(Object.create(Object.getPrototypeOf(this), { $$: { value: et(this.$$) } }));
				return e.$$.count.value += 1, e.$$.deleteScheduled = !1, e;
			}
			function xt() {
				this.$$.ptr || tt(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && U("Object already scheduled for deletion"), rt(this), at(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
			}
			function St() {
				return !this.$$.ptr;
			}
			function Ct() {
				return this.$$.ptr || tt(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && U("Object already scheduled for deletion"), ut.push(this), ut.length === 1 && dt && dt(W), this.$$.deleteScheduled = !0, this;
			}
			function wt() {
				Tt.prototype.isAliasOf = $e, Tt.prototype.clone = bt, Tt.prototype.delete = xt, Tt.prototype.isDeleted = St, Tt.prototype.deleteLater = Ct;
			}
			function Tt() {}
			function Et(e, t, n) {
				if (e[t].overloadTable === void 0) {
					var r = e[t];
					e[t] = function() {
						return e[t].overloadTable.hasOwnProperty(arguments.length) || U("Function '" + n + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + e[t].overloadTable + ")!"), e[t].overloadTable[arguments.length].apply(this, arguments);
					}, e[t].overloadTable = [], e[t].overloadTable[r.argCount] = r;
				}
			}
			function Dt(e, t, r) {
				n.hasOwnProperty(e) ? ((r === void 0 || n[e].overloadTable !== void 0 && n[e].overloadTable[r] !== void 0) && U("Cannot register public name '" + e + "' twice"), Et(n, e, e), n.hasOwnProperty(r) && U("Cannot register multiple overloads of a function with the same number of arguments (" + r + ")!"), n[e].overloadTable[r] = t) : (n[e] = t, r !== void 0 && (n[e].numArguments = r));
			}
			function Ot(e, t, n, r, i, a, o, s) {
				this.name = e, this.constructor = t, this.instancePrototype = n, this.rawDestructor = r, this.baseClass = i, this.getActualType = a, this.upcast = o, this.downcast = s, this.pureVirtualFunctions = [];
			}
			function kt(e, t, n) {
				for (; t !== n;) t.upcast || U("Expected null or instance of " + n.name + ", got an instance of " + t.name), e = t.upcast(e), t = t.baseClass;
				return e;
			}
			function At(e, t) {
				if (t === null) return this.isReference && U("null is not a valid " + this.name), 0;
				t.$$ || U("Cannot pass \"" + sn(t) + "\" as a " + this.name), t.$$.ptr || U("Cannot pass deleted object as a pointer of type " + this.name);
				var n = t.$$.ptrType.registeredClass;
				return kt(t.$$.ptr, n, this.registeredClass);
			}
			function jt(e, t) {
				var n;
				if (t === null) return this.isReference && U("null is not a valid " + this.name), this.isSmartPointer ? (n = this.rawConstructor(), e !== null && e.push(this.rawDestructor, n), n) : 0;
				t.$$ || U("Cannot pass \"" + sn(t) + "\" as a " + this.name), t.$$.ptr || U("Cannot pass deleted object as a pointer of type " + this.name), !this.isConst && t.$$.ptrType.isConst && U("Cannot convert argument of type " + (t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name) + " to parameter type " + this.name);
				var r = t.$$.ptrType.registeredClass;
				if (n = kt(t.$$.ptr, r, this.registeredClass), this.isSmartPointer) switch (t.$$.smartPtr === void 0 && U("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy) {
					case 0:
						t.$$.smartPtrType === this ? n = t.$$.smartPtr : U("Cannot convert argument of type " + (t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name) + " to parameter type " + this.name);
						break;
					case 1:
						n = t.$$.smartPtr;
						break;
					case 2:
						if (t.$$.smartPtrType === this) n = t.$$.smartPtr;
						else {
							var i = t.clone();
							n = this.rawShare(n, an.toHandle(function() {
								i.delete();
							})), e !== null && e.push(this.rawDestructor, n);
						}
						break;
					default: U("Unsupporting sharing policy");
				}
				return n;
			}
			function Mt(e, t) {
				if (t === null) return this.isReference && U("null is not a valid " + this.name), 0;
				t.$$ || U("Cannot pass \"" + sn(t) + "\" as a " + this.name), t.$$.ptr || U("Cannot pass deleted object as a pointer of type " + this.name), t.$$.ptrType.isConst && U("Cannot convert argument of type " + t.$$.ptrType.name + " to parameter type " + this.name);
				var n = t.$$.ptrType.registeredClass;
				return kt(t.$$.ptr, n, this.registeredClass);
			}
			function Nt(e) {
				return this.fromWireType(A[e >> 2]);
			}
			function Pt(e) {
				return this.rawGetPointee && (e = this.rawGetPointee(e)), e;
			}
			function Ft(e) {
				this.rawDestructor && this.rawDestructor(e);
			}
			function It(e) {
				e !== null && e.delete();
			}
			function Lt() {
				G.prototype.getPointee = Pt, G.prototype.destructor = Ft, G.prototype.argPackAdvance = 8, G.prototype.readValueFromPointer = Nt, G.prototype.deleteObject = It, G.prototype.fromWireType = vt;
			}
			function G(e, t, n, r, i, a, o, s, c, l, u) {
				this.name = e, this.registeredClass = t, this.isReference = n, this.isConst = r, this.isSmartPointer = i, this.pointeeType = a, this.sharingPolicy = o, this.rawGetPointee = s, this.rawConstructor = c, this.rawShare = l, this.rawDestructor = u, !i && t.baseClass === void 0 ? r ? (this.toWireType = At, this.destructorFunction = null) : (this.toWireType = Mt, this.destructorFunction = null) : this.toWireType = jt;
			}
			function K(e, t, r) {
				n.hasOwnProperty(e) || Ye("Replacing nonexistant public symbol"), n[e].overloadTable !== void 0 && r !== void 0 ? n[e].overloadTable[r] = t : (n[e] = t, n[e].argCount = r);
			}
			function Rt(e, t, r) {
				S("dynCall_" + e in n, "bad function pointer type - no table for sig '" + e + "'"), r && r.length ? S(r.length === e.substring(1).replace(/j/g, "--").length) : S(e.length == 1);
				var i = n["dynCall_" + e];
				return r && r.length ? i.apply(null, [t].concat(r)) : i.call(null, t);
			}
			var zt = [];
			function Bt(e) {
				var t = zt[e];
				return t || (e >= zt.length && (zt.length = e + 1), zt[e] = t = ce.get(e)), S(ce.get(e) == t, "JavaScript-side Wasm function table mirror is out of date!"), t;
			}
			function Vt(e, t, n) {
				return e.includes("j") ? Rt(e, t, n) : (S(Bt(t), "missing table entry in dynCall: " + t), Bt(t).apply(null, n));
			}
			function Ht(e, t) {
				S(e.includes("j") || e.includes("p"), "getDynCaller should only be called with i64 sigs");
				var n = [];
				return function() {
					return n.length = 0, Object.assign(n, arguments), Vt(e, t, n);
				};
			}
			function Ut(e, t) {
				e = H(e);
				function n() {
					return e.includes("j") ? Ht(e, t) : Bt(t);
				}
				var r = n();
				return typeof r != "function" && U("unknown function pointer with signature " + e + ": " + t), r;
			}
			var Wt = void 0;
			function Gt(e) {
				var t = Zn(e), n = H(t);
				return Xn(t), n;
			}
			function Kt(e, t) {
				var n = [], r = {};
				function i(e) {
					if (!r[e] && !Be[e]) {
						if (Ve[e]) {
							Ve[e].forEach(i);
							return;
						}
						n.push(e), r[e] = !0;
					}
				}
				throw t.forEach(i), new Wt(e + ": " + n.map(Gt).join([", "]));
			}
			function qt(e, t, n, r, i, a, o, s, c, l, u, d, f) {
				u = H(u), a = Ut(i, a), s &&= Ut(o, s), l &&= Ut(c, l), f = Ut(d, f);
				var p = We(u);
				Dt(p, function() {
					Kt("Cannot construct " + u + " due to unbound types", [r]);
				}), Xe([
					e,
					t,
					n
				], r ? [r] : [], function(t) {
					t = t[0];
					var n, i;
					r ? (n = t.registeredClass, i = n.instancePrototype) : i = Tt.prototype;
					var o = Ge(p, function() {
						if (Object.getPrototypeOf(this) !== c) throw new qe("Use 'new' to construct " + u);
						if (d.constructor_body === void 0) throw new qe(u + " has no accessible constructor");
						var e = d.constructor_body[arguments.length];
						if (e === void 0) throw new qe("Tried to invoke ctor of " + u + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(d.constructor_body).toString() + ") parameters instead!");
						return e.apply(this, arguments);
					}), c = Object.create(i, { constructor: { value: o } });
					o.prototype = c;
					var d = new Ot(u, o, c, f, n, a, s, l), m = new G(u, d, !0, !1, !1), h = new G(u + "*", d, !1, !1, !1), g = new G(u + " const*", d, !1, !0, !1);
					return st[e] = {
						pointerType: h,
						constPointerType: g
					}, K(p, o), [
						m,
						h,
						g
					];
				});
			}
			function Jt(e, t) {
				for (var n = [], r = 0; r < e; r++) n.push(j[t + r * 4 >> 2]);
				return n;
			}
			function Yt(e) {
				for (; e.length;) {
					var t = e.pop();
					e.pop()(t);
				}
			}
			function Xt(e, t, n, r, i) {
				var a = t.length;
				a < 2 && U("argTypes array size mismatch! Must at least get return value and 'this' types!");
				for (var o = t[1] !== null && n !== null, s = !1, c = 1; c < t.length; ++c) if (t[c] !== null && t[c].destructorFunction === void 0) {
					s = !0;
					break;
				}
				var l = t[0].name !== "void", u = a - 2, d = Array(u), f = [], p = [];
				return function() {
					arguments.length !== u && U("function " + e + " called with " + arguments.length + " arguments, expected " + u + " args!"), p.length = 0;
					var n;
					f.length = o ? 2 : 1, f[0] = i, o && (n = t[1].toWireType(p, this), f[1] = n);
					for (var a = 0; a < u; ++a) d[a] = t[a + 2].toWireType(p, arguments[a]), f.push(d[a]);
					var c = r.apply(null, f);
					function m(e) {
						if (s) Yt(p);
						else for (var r = o ? 1 : 2; r < t.length; r++) {
							var i = r === 1 ? n : d[r - 2];
							t[r].destructorFunction !== null && t[r].destructorFunction(i);
						}
						if (l) return t[0].fromWireType(e);
					}
					return m(c);
				};
			}
			function Zt(e, t, n, r, i, a) {
				S(t > 0);
				var o = Jt(t, n);
				i = Ut(r, i), Xe([], [e], function(e) {
					e = e[0];
					var n = "constructor " + e.name;
					if (e.registeredClass.constructor_body === void 0 && (e.registeredClass.constructor_body = []), e.registeredClass.constructor_body[t - 1] !== void 0) throw new qe("Cannot register multiple constructors with identical number of parameters (" + (t - 1) + ") for class '" + e.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
					return e.registeredClass.constructor_body[t - 1] = () => {
						Kt("Cannot construct " + e.name + " due to unbound types", o);
					}, Xe([], o, function(r) {
						return r.splice(1, 0, null), e.registeredClass.constructor_body[t - 1] = Xt(n, r, null, i, a), [];
					}), [];
				});
			}
			function Qt(e, t, n, r, i, a, o, s) {
				var c = Jt(n, r);
				t = H(t), a = Ut(i, a), Xe([], [e], function(e) {
					e = e[0];
					var r = e.name + "." + t;
					t.startsWith("@@") && (t = Symbol[t.substring(2)]), s && e.registeredClass.pureVirtualFunctions.push(t);
					function i() {
						Kt("Cannot call " + r + " due to unbound types", c);
					}
					var l = e.registeredClass.instancePrototype, u = l[t];
					return u === void 0 || u.overloadTable === void 0 && u.className !== e.name && u.argCount === n - 2 ? (i.argCount = n - 2, i.className = e.name, l[t] = i) : (Et(l, t, r), l[t].overloadTable[n - 2] = i), Xe([], c, function(i) {
						var s = Xt(r, i, e, a, o);
						return l[t].overloadTable === void 0 ? (s.argCount = n - 2, l[t] = s) : l[t].overloadTable[n - 2] = s, [];
					}), [];
				});
			}
			var $t = [], q = [
				{},
				{ value: void 0 },
				{ value: null },
				{ value: !0 },
				{ value: !1 }
			];
			function en(e) {
				e > 4 && --q[e].refcount === 0 && (q[e] = void 0, $t.push(e));
			}
			function tn() {
				for (var e = 0, t = 5; t < q.length; ++t) q[t] !== void 0 && ++e;
				return e;
			}
			function nn() {
				for (var e = 5; e < q.length; ++e) if (q[e] !== void 0) return q[e];
				return null;
			}
			function rn() {
				n.count_emval_handles = tn, n.get_first_emval = nn;
			}
			var an = {
				toValue: (e) => (e || U("Cannot use deleted val. handle = " + e), q[e].value),
				toHandle: (e) => {
					switch (e) {
						case void 0: return 1;
						case null: return 2;
						case !0: return 3;
						case !1: return 4;
						default:
							var t = $t.length ? $t.pop() : q.length;
							return q[t] = {
								refcount: 1,
								value: e
							}, t;
					}
				}
			};
			function on(e, t) {
				t = H(t), Ze(e, {
					name: t,
					fromWireType: function(e) {
						var t = an.toValue(e);
						return en(e), t;
					},
					toWireType: function(e, t) {
						return an.toHandle(t);
					},
					argPackAdvance: 8,
					readValueFromPointer: Nt,
					destructorFunction: null
				});
			}
			function sn(e) {
				if (e === null) return "null";
				var t = typeof e;
				return t === "object" || t === "array" || t === "function" ? e.toString() : "" + e;
			}
			function cn(e, t) {
				switch (t) {
					case 2: return function(e) {
						return this.fromWireType(ie[e >> 2]);
					};
					case 3: return function(e) {
						return this.fromWireType(ae[e >> 3]);
					};
					default: throw TypeError("Unknown float type: " + e);
				}
			}
			function ln(e, t, n) {
				var r = Ie(n);
				t = H(t), Ze(e, {
					name: t,
					fromWireType: function(e) {
						return e;
					},
					toWireType: function(e, t) {
						if (typeof t != "number" && typeof t != "boolean") throw TypeError("Cannot convert \"" + sn(t) + "\" to " + this.name);
						return t;
					},
					argPackAdvance: 8,
					readValueFromPointer: cn(t, r),
					destructorFunction: null
				});
			}
			function un(e, t, n) {
				switch (t) {
					case 0: return n ? function(e) {
						return O[e];
					} : function(e) {
						return k[e];
					};
					case 1: return n ? function(e) {
						return ne[e >> 1];
					} : function(e) {
						return re[e >> 1];
					};
					case 2: return n ? function(e) {
						return A[e >> 2];
					} : function(e) {
						return j[e >> 2];
					};
					default: throw TypeError("Unknown integer type: " + e);
				}
			}
			function dn(e, t, n, r, i) {
				t = H(t), i === -1 && (i = 4294967295);
				var a = Ie(n), o = (e) => e;
				if (r === 0) {
					var s = 32 - 8 * n;
					o = (e) => e << s >>> s;
				}
				var c = t.includes("unsigned"), l = (e, n) => {
					if (typeof e != "number" && typeof e != "boolean") throw TypeError("Cannot convert \"" + sn(e) + "\" to " + n);
					if (e < r || e > i) throw TypeError("Passing a number \"" + sn(e) + "\" from JS side to C/C++ side to an argument of type \"" + t + "\", which is outside the valid range [" + r + ", " + i + "]!");
				};
				Ze(e, {
					name: t,
					fromWireType: o,
					toWireType: c ? function(e, t) {
						return l(t, this.name), t >>> 0;
					} : function(e, t) {
						return l(t, this.name), t;
					},
					argPackAdvance: 8,
					readValueFromPointer: un(t, a, r !== 0),
					destructorFunction: null
				});
			}
			function fn(e, t, n) {
				var r = [
					Int8Array,
					Uint8Array,
					Int16Array,
					Uint16Array,
					Int32Array,
					Uint32Array,
					Float32Array,
					Float64Array
				][t];
				function i(e) {
					e >>= 2;
					var t = j, n = t[e], i = t[e + 1];
					return new r(te, i, n);
				}
				n = H(n), Ze(e, {
					name: n,
					fromWireType: i,
					argPackAdvance: 8,
					readValueFromPointer: i
				}, { ignoreDuplicateRegistrations: !0 });
			}
			function pn(e, t) {
				t = H(t);
				var n = t === "std::string";
				Ze(e, {
					name: t,
					fromWireType: function(e) {
						var t = j[e >> 2], r = e + 4, i;
						if (n) for (var a = r, o = 0; o <= t; ++o) {
							var s = r + o;
							if (o == t || k[s] == 0) {
								var c = s - a, l = T(a, c);
								i === void 0 ? i = l : (i += "\0", i += l), a = s + 1;
							}
						}
						else {
							for (var u = Array(t), o = 0; o < t; ++o) u[o] = String.fromCharCode(k[r + o]);
							i = u.join("");
						}
						return Xn(e), i;
					},
					toWireType: function(e, t) {
						t instanceof ArrayBuffer && (t = new Uint8Array(t));
						var r, i = typeof t == "string";
						i || t instanceof Uint8Array || t instanceof Uint8ClampedArray || t instanceof Int8Array || U("Cannot pass non-string to std::string"), r = n && i ? ee(t) : t.length;
						var a = Yn(4 + r + 1), o = a + 4;
						if (j[a >> 2] = r, n && i) D(t, o, r + 1);
						else if (i) for (var s = 0; s < r; ++s) {
							var c = t.charCodeAt(s);
							c > 255 && (Xn(o), U("String has UTF-16 code units that do not fit in 8 bits")), k[o + s] = c;
						}
						else for (var s = 0; s < r; ++s) k[o + s] = t[s];
						return e !== null && e.push(Xn, a), a;
					},
					argPackAdvance: 8,
					readValueFromPointer: Nt,
					destructorFunction: function(e) {
						Xn(e);
					}
				});
			}
			var mn = typeof TextDecoder < "u" ? new TextDecoder("utf-16le") : void 0;
			function hn(e, t) {
				S(e % 2 == 0, "Pointer passed to UTF16ToString must be aligned to two bytes!");
				for (var n = e, r = n >> 1, i = r + t / 2; !(r >= i) && re[r];) ++r;
				if (n = r << 1, n - e > 32 && mn) return mn.decode(k.subarray(e, n));
				for (var a = "", o = 0; !(o >= t / 2); ++o) {
					var s = ne[e + o * 2 >> 1];
					if (s == 0) break;
					a += String.fromCharCode(s);
				}
				return a;
			}
			function gn(e, t, n) {
				if (S(t % 2 == 0, "Pointer passed to stringToUTF16 must be aligned to two bytes!"), S(typeof n == "number", "stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), n === void 0 && (n = 2147483647), n < 2) return 0;
				n -= 2;
				for (var r = t, i = n < e.length * 2 ? n / 2 : e.length, a = 0; a < i; ++a) {
					var o = e.charCodeAt(a);
					ne[t >> 1] = o, t += 2;
				}
				return ne[t >> 1] = 0, t - r;
			}
			function _n(e) {
				return e.length * 2;
			}
			function vn(e, t) {
				S(e % 4 == 0, "Pointer passed to UTF32ToString must be aligned to four bytes!");
				for (var n = 0, r = ""; !(n >= t / 4);) {
					var i = A[e + n * 4 >> 2];
					if (i == 0) break;
					if (++n, i >= 65536) {
						var a = i - 65536;
						r += String.fromCharCode(55296 | a >> 10, 56320 | a & 1023);
					} else r += String.fromCharCode(i);
				}
				return r;
			}
			function yn(e, t, n) {
				if (S(t % 4 == 0, "Pointer passed to stringToUTF32 must be aligned to four bytes!"), S(typeof n == "number", "stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!"), n === void 0 && (n = 2147483647), n < 4) return 0;
				for (var r = t, i = r + n - 4, a = 0; a < e.length; ++a) {
					var o = e.charCodeAt(a);
					if (o >= 55296 && o <= 57343) {
						var s = e.charCodeAt(++a);
						o = 65536 + ((o & 1023) << 10) | s & 1023;
					}
					if (A[t >> 2] = o, t += 4, t + 4 > i) break;
				}
				return A[t >> 2] = 0, t - r;
			}
			function bn(e) {
				for (var t = 0, n = 0; n < e.length; ++n) {
					var r = e.charCodeAt(n);
					r >= 55296 && r <= 57343 && ++n, t += 4;
				}
				return t;
			}
			function xn(e, t, n) {
				n = H(n);
				var r, i, a, o, s;
				t === 2 ? (r = hn, i = gn, o = _n, a = () => re, s = 1) : t === 4 && (r = vn, i = yn, o = bn, a = () => j, s = 2), Ze(e, {
					name: n,
					fromWireType: function(e) {
						for (var n = j[e >> 2], i = a(), o, c = e + 4, l = 0; l <= n; ++l) {
							var u = e + 4 + l * t;
							if (l == n || i[u >> s] == 0) {
								var d = u - c, f = r(c, d);
								o === void 0 ? o = f : (o += "\0", o += f), c = u + t;
							}
						}
						return Xn(e), o;
					},
					toWireType: function(e, r) {
						typeof r != "string" && U("Cannot pass non-string to C++ string type " + n);
						var a = o(r), c = Yn(4 + a + t);
						return j[c >> 2] = a >> s, i(r, c + 4, a + t), e !== null && e.push(Xn, c), c;
					},
					argPackAdvance: 8,
					readValueFromPointer: Nt,
					destructorFunction: function(e) {
						Xn(e);
					}
				});
			}
			function Sn(e, t) {
				t = H(t), Ze(e, {
					isVoid: !0,
					name: t,
					argPackAdvance: 0,
					fromWireType: function() {},
					toWireType: function(e, t) {}
				});
			}
			function Cn() {
				I("native code called abort()");
			}
			function wn(e, t, n) {
				k.copyWithin(e, t, t + n);
			}
			function J() {
				return 2147483648;
			}
			function Tn(e) {
				try {
					return b.grow(e - te.byteLength + 65535 >>> 16), oe(b.buffer), 1;
				} catch (t) {
					p("emscripten_realloc_buffer: Attempted to grow heap from " + te.byteLength + " bytes to " + e + " bytes, but got error: " + t);
				}
			}
			function En(e) {
				var t = k.length;
				e >>>= 0, S(e > t);
				var n = J();
				if (e > n) return p("Cannot enlarge memory, asked to go up to " + e + " bytes, but the limit is " + n + " bytes!"), !1;
				let r = (e, t) => e + (t - e % t) % t;
				for (var i = 1; i <= 4; i *= 2) {
					var a = t * (1 + .2 / i);
					a = Math.min(a, e + 100663296);
					var o = Math.min(n, r(Math.max(e, a), 65536));
					if (Tn(o)) return !0;
				}
				return p("Failed to grow the heap from " + t + " bytes to " + o + " bytes, not enough memory!"), !1;
			}
			var Dn = {};
			function On() {
				return s || "./this.program";
			}
			function kn() {
				if (!kn.strings) {
					var e = {
						USER: "web_user",
						LOGNAME: "web_user",
						PATH: "/",
						PWD: "/",
						HOME: "/home/web_user",
						LANG: (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8",
						_: On()
					};
					for (var t in Dn) Dn[t] === void 0 ? delete e[t] : e[t] = Dn[t];
					var n = [];
					for (var t in e) n.push(t + "=" + e[t]);
					kn.strings = n;
				}
				return kn.strings;
			}
			function An(e, t, n) {
				for (var r = 0; r < e.length; ++r) S(e.charCodeAt(r) === (e.charCodeAt(r) & 255)), O[t++ >> 0] = e.charCodeAt(r);
				n || (O[t >> 0] = 0);
			}
			var jn = {
				varargs: void 0,
				get: function() {
					return S(jn.varargs != null), jn.varargs += 4, A[jn.varargs - 4 >> 2];
				},
				getStr: function(e) {
					return T(e);
				}
			};
			function Mn(e, t) {
				var n = 0;
				return kn().forEach(function(r, i) {
					var a = t + n;
					j[e + i * 4 >> 2] = a, An(r, a), n += r.length + 1;
				}), 0;
			}
			function Nn(e, t) {
				var n = kn();
				j[e >> 2] = n.length;
				var r = 0;
				return n.forEach(function(e) {
					r += e.length + 1;
				}), j[t >> 2] = r, 0;
			}
			function Pn(e) {
				I("fd_close called without SYSCALLS_REQUIRE_FILESYSTEM");
			}
			function Fn(e, t, n, r, i) {
				return 70;
			}
			var In = [
				null,
				[],
				[]
			];
			function Ln(e, t) {
				var n = In[e];
				S(n), t === 0 || t === 10 ? ((e === 1 ? f : p)(w(n, 0)), n.length = 0) : n.push(t);
			}
			function Rn(e, t, n, r) {
				for (var i = 0, a = 0; a < n; a++) {
					var o = j[t >> 2], s = j[t + 4 >> 2];
					t += 8;
					for (var c = 0; c < s; c++) Ln(e, k[o + c]);
					i += s;
				}
				return j[r >> 2] = i, 0;
			}
			function zn(e) {
				return e % 4 == 0 && (e % 100 != 0 || e % 400 == 0);
			}
			function Bn(e, t) {
				for (var n = 0, r = 0; r <= t; n += e[r++]);
				return n;
			}
			var Vn = [
				31,
				29,
				31,
				30,
				31,
				30,
				31,
				31,
				30,
				31,
				30,
				31
			], Hn = [
				31,
				28,
				31,
				30,
				31,
				30,
				31,
				31,
				30,
				31,
				30,
				31
			];
			function Un(e, t) {
				for (var n = new Date(e.getTime()); t > 0;) {
					var r = zn(n.getFullYear()), i = n.getMonth(), a = (r ? Vn : Hn)[i];
					if (t > a - n.getDate()) t -= a - n.getDate() + 1, n.setDate(1), i < 11 ? n.setMonth(i + 1) : (n.setMonth(0), n.setFullYear(n.getFullYear() + 1));
					else return n.setDate(n.getDate() + t), n;
				}
				return n;
			}
			function Wn(e, t, n) {
				var r = n > 0 ? n : ee(e) + 1, i = Array(r), a = E(e, i, 0, i.length);
				return t && (i.length = a), i;
			}
			function Gn(e, t, n, r) {
				var i = A[r + 40 >> 2], a = {
					tm_sec: A[r >> 2],
					tm_min: A[r + 4 >> 2],
					tm_hour: A[r + 8 >> 2],
					tm_mday: A[r + 12 >> 2],
					tm_mon: A[r + 16 >> 2],
					tm_year: A[r + 20 >> 2],
					tm_wday: A[r + 24 >> 2],
					tm_yday: A[r + 28 >> 2],
					tm_isdst: A[r + 32 >> 2],
					tm_gmtoff: A[r + 36 >> 2],
					tm_zone: i ? T(i) : ""
				}, o = T(n), s = {
					"%c": "%a %b %d %H:%M:%S %Y",
					"%D": "%m/%d/%y",
					"%F": "%Y-%m-%d",
					"%h": "%b",
					"%r": "%I:%M:%S %p",
					"%R": "%H:%M",
					"%T": "%H:%M:%S",
					"%x": "%m/%d/%y",
					"%X": "%H:%M:%S",
					"%Ec": "%c",
					"%EC": "%C",
					"%Ex": "%m/%d/%y",
					"%EX": "%H:%M:%S",
					"%Ey": "%y",
					"%EY": "%Y",
					"%Od": "%d",
					"%Oe": "%e",
					"%OH": "%H",
					"%OI": "%I",
					"%Om": "%m",
					"%OM": "%M",
					"%OS": "%S",
					"%Ou": "%u",
					"%OU": "%U",
					"%OV": "%V",
					"%Ow": "%w",
					"%OW": "%W",
					"%Oy": "%y"
				};
				for (var c in s) o = o.replace(new RegExp(c, "g"), s[c]);
				var l = [
					"Sunday",
					"Monday",
					"Tuesday",
					"Wednesday",
					"Thursday",
					"Friday",
					"Saturday"
				], u = [
					"January",
					"February",
					"March",
					"April",
					"May",
					"June",
					"July",
					"August",
					"September",
					"October",
					"November",
					"December"
				];
				function d(e, t, n) {
					for (var r = typeof e == "number" ? e.toString() : e || ""; r.length < t;) r = n[0] + r;
					return r;
				}
				function f(e, t) {
					return d(e, t, "0");
				}
				function p(e, t) {
					function n(e) {
						return e < 0 ? -1 : +(e > 0);
					}
					var r;
					return (r = n(e.getFullYear() - t.getFullYear())) === 0 && (r = n(e.getMonth() - t.getMonth())) === 0 && (r = n(e.getDate() - t.getDate())), r;
				}
				function m(e) {
					switch (e.getDay()) {
						case 0: return new Date(e.getFullYear() - 1, 11, 29);
						case 1: return e;
						case 2: return new Date(e.getFullYear(), 0, 3);
						case 3: return new Date(e.getFullYear(), 0, 2);
						case 4: return new Date(e.getFullYear(), 0, 1);
						case 5: return new Date(e.getFullYear() - 1, 11, 31);
						case 6: return new Date(e.getFullYear() - 1, 11, 30);
					}
				}
				function h(e) {
					var t = Un(new Date(e.tm_year + 1900, 0, 1), e.tm_yday), n = new Date(t.getFullYear(), 0, 4), r = new Date(t.getFullYear() + 1, 0, 4), i = m(n), a = m(r);
					return p(i, t) <= 0 ? p(a, t) <= 0 ? t.getFullYear() + 1 : t.getFullYear() : t.getFullYear() - 1;
				}
				var g = {
					"%a": function(e) {
						return l[e.tm_wday].substring(0, 3);
					},
					"%A": function(e) {
						return l[e.tm_wday];
					},
					"%b": function(e) {
						return u[e.tm_mon].substring(0, 3);
					},
					"%B": function(e) {
						return u[e.tm_mon];
					},
					"%C": function(e) {
						return f((e.tm_year + 1900) / 100 | 0, 2);
					},
					"%d": function(e) {
						return f(e.tm_mday, 2);
					},
					"%e": function(e) {
						return d(e.tm_mday, 2, " ");
					},
					"%g": function(e) {
						return h(e).toString().substring(2);
					},
					"%G": function(e) {
						return h(e);
					},
					"%H": function(e) {
						return f(e.tm_hour, 2);
					},
					"%I": function(e) {
						var t = e.tm_hour;
						return t == 0 ? t = 12 : t > 12 && (t -= 12), f(t, 2);
					},
					"%j": function(e) {
						return f(e.tm_mday + Bn(zn(e.tm_year + 1900) ? Vn : Hn, e.tm_mon - 1), 3);
					},
					"%m": function(e) {
						return f(e.tm_mon + 1, 2);
					},
					"%M": function(e) {
						return f(e.tm_min, 2);
					},
					"%n": function() {
						return "\n";
					},
					"%p": function(e) {
						return e.tm_hour >= 0 && e.tm_hour < 12 ? "AM" : "PM";
					},
					"%S": function(e) {
						return f(e.tm_sec, 2);
					},
					"%t": function() {
						return "	";
					},
					"%u": function(e) {
						return e.tm_wday || 7;
					},
					"%U": function(e) {
						var t = e.tm_yday + 7 - e.tm_wday;
						return f(Math.floor(t / 7), 2);
					},
					"%V": function(e) {
						var t = Math.floor((e.tm_yday + 7 - (e.tm_wday + 6) % 7) / 7);
						if ((e.tm_wday + 371 - e.tm_yday - 2) % 7 <= 2 && t++, !t) {
							t = 52;
							var n = (e.tm_wday + 7 - e.tm_yday - 1) % 7;
							(n == 4 || n == 5 && zn(e.tm_year % 400 - 1)) && t++;
						} else if (t == 53) {
							var r = (e.tm_wday + 371 - e.tm_yday) % 7;
							r != 4 && (r != 3 || !zn(e.tm_year)) && (t = 1);
						}
						return f(t, 2);
					},
					"%w": function(e) {
						return e.tm_wday;
					},
					"%W": function(e) {
						var t = e.tm_yday + 7 - (e.tm_wday + 6) % 7;
						return f(Math.floor(t / 7), 2);
					},
					"%y": function(e) {
						return (e.tm_year + 1900).toString().substring(2);
					},
					"%Y": function(e) {
						return e.tm_year + 1900;
					},
					"%z": function(e) {
						var t = e.tm_gmtoff, n = t >= 0;
						return t = Math.abs(t) / 60, t = t / 60 * 100 + t % 60, (n ? "+" : "-") + String("0000" + t).slice(-4);
					},
					"%Z": function(e) {
						return e.tm_zone;
					},
					"%%": function() {
						return "%";
					}
				};
				for (var c in o = o.replace(/%%/g, "\0\0"), g) o.includes(c) && (o = o.replace(new RegExp(c, "g"), g[c](a)));
				o = o.replace(/\0\0/g, "%");
				var _ = Wn(o, !1);
				return _.length > t ? 0 : (Ae(_, e), _.length - 1);
			}
			function Kn(e, t, n, r) {
				return Gn(e, t, n, r);
			}
			Le(), qe = n.BindingError = Ke(Error, "BindingError"), Je = n.InternalError = Ke(Error, "InternalError"), wt(), pt(), Lt(), Wt = n.UnboundTypeError = Ke(Error, "UnboundTypeError"), rn();
			function qn() {
				h("fetchSettings");
			}
			var Jn = {
				__cxa_allocate_exception: je,
				__cxa_throw: Pe,
				_embind_register_bigint: Fe,
				_embind_register_bool: Qe,
				_embind_register_class: qt,
				_embind_register_class_constructor: Zt,
				_embind_register_class_function: Qt,
				_embind_register_emval: on,
				_embind_register_float: ln,
				_embind_register_integer: dn,
				_embind_register_memory_view: fn,
				_embind_register_std_string: pn,
				_embind_register_std_wstring: xn,
				_embind_register_void: Sn,
				abort: Cn,
				emscripten_memcpy_big: wn,
				emscripten_resize_heap: En,
				environ_get: Mn,
				environ_sizes_get: Nn,
				fd_close: Pn,
				fd_seek: Fn,
				fd_write: Rn,
				strftime_l: Kn
			};
			V(), n.___wasm_call_ctors = R("__wasm_call_ctors");
			var Yn = n._malloc = R("malloc"), Xn = n._free = R("free"), Zn = n.___getTypeName = R("__getTypeName");
			n.__embind_initialize_bindings = R("_embind_initialize_bindings"), n.___errno_location = R("__errno_location"), n._fflush = R("fflush");
			var Qn = n._emscripten_stack_init = function() {
				return (Qn = n._emscripten_stack_init = n.asm.emscripten_stack_init).apply(null, arguments);
			}, $n = n._emscripten_stack_get_free = function() {
				return ($n = n._emscripten_stack_get_free = n.asm.emscripten_stack_get_free).apply(null, arguments);
			}, er = n._emscripten_stack_get_base = function() {
				return (er = n._emscripten_stack_get_base = n.asm.emscripten_stack_get_base).apply(null, arguments);
			}, tr = n._emscripten_stack_get_end = function() {
				return (tr = n._emscripten_stack_get_end = n.asm.emscripten_stack_get_end).apply(null, arguments);
			};
			n.stackSave = R("stackSave"), n.stackRestore = R("stackRestore"), n.stackAlloc = R("stackAlloc");
			var nr = n.___cxa_is_pointer_type = R("__cxa_is_pointer_type");
			n.dynCall_viijii = R("dynCall_viijii"), n.dynCall_ji = R("dynCall_ji"), n.dynCall_jiji = R("dynCall_jiji"), n.dynCall_iiiiij = R("dynCall_iiiiij"), n.dynCall_iiiiijj = R("dynCall_iiiiijj"), n.dynCall_iiiiiijj = R("dynCall_iiiiiijj"), (/* @__PURE__ */ "run.UTF8ArrayToString.UTF8ToString.stringToUTF8Array.stringToUTF8.lengthBytesUTF8.addOnPreRun.addOnInit.addOnPreMain.addOnExit.addOnPostRun.addRunDependency.removeRunDependency.FS_createFolder.FS_createPath.FS_createDataFile.FS_createPreloadedFile.FS_createLazyFile.FS_createLink.FS_createDevice.FS_unlink.getLEB.getFunctionTables.alignFunctionTables.registerFunctions.prettyPrint.getCompilerSetting.print.printErr.callMain.abort.keepRuntimeAlive.wasmMemory.stackAlloc.stackSave.stackRestore.getTempRet0.setTempRet0.writeStackCookie.checkStackCookie.ptrToString.zeroMemory.stringToNewUTF8.exitJS.getHeapMax.emscripten_realloc_buffer.ENV.ERRNO_CODES.ERRNO_MESSAGES.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.DNS.getHostByName.Protocols.Sockets.getRandomDevice.warnOnce.traverseStack.UNWIND_CACHE.convertPCtoSourceLocation.readAsmConstArgsArray.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.getExecutableName.listenOnce.autoResumeAudioContext.dynCallLegacy.getDynCaller.dynCall.handleException.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertI32PairToI53Checked.convertU32PairToI53.getCFunc.ccall.cwrap.uleb128Encode.sigToWasmTypes.convertJsFunctionToWasm.freeTableIndexes.functionsInTableMap.getEmptyTableSlot.updateTableMap.addFunction.removeFunction.reallyNegative.unSign.strLen.reSign.formatString.setValue.getValue.PATH.PATH_FS.intArrayFromString.intArrayToString.AsciiToString.stringToAscii.UTF16Decoder.UTF16ToString.stringToUTF16.lengthBytesUTF16.UTF32ToString.stringToUTF32.lengthBytesUTF32.allocateUTF8.allocateUTF8OnStack.writeStringToMemory.writeArrayToMemory.writeAsciiToMemory.SYSCALLS.getSocketFromFD.getSocketAddress.JSEvents.registerKeyEventCallback.specialHTMLTargets.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.currentFullscreenStrategy.restoreOldWindowedStyle.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.demangle.demangleAll.jsStackTrace.stackTrace.ExitStatus.getEnvStrings.checkWasiClock.flush_NO_FILESYSTEM.dlopenMissingError.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.uncaughtExceptionCount.exceptionLast.exceptionCaught.ExceptionInfo.exception_addRef.exception_decRef.Browser.setMainLoop.wget.FS.MEMFS.TTY.PIPEFS.SOCKFS._setNetworkCallback.tempFixedLengthArray.miniTempWebGLFloatBuffers.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.GL.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.AL.SDL_unicode.SDL_ttfContext.SDL_audio.SDL.SDL_gfx.GLUT.EGL.GLFW_Window.GLFW.GLEW.IDBStore.runAndAbortIfError.ALLOC_NORMAL.ALLOC_STACK.allocate.InternalError.BindingError.UnboundTypeError.PureVirtualError.init_embind.throwInternalError.throwBindingError.throwUnboundTypeError.ensureOverloadTable.exposePublicSymbol.replacePublicSymbol.extendError.createNamedFunction.embindRepr.registeredInstances.getBasestPointer.registerInheritedInstance.unregisterInheritedInstance.getInheritedInstance.getInheritedInstanceCount.getLiveInheritedInstances.registeredTypes.awaitingDependencies.typeDependencies.registeredPointers.registerType.whenDependentTypesAreResolved.embind_charCodes.embind_init_charCodes.readLatin1String.getTypeName.heap32VectorToArray.requireRegisteredType.getShiftFromSize.integerReadValueFromPointer.enumReadValueFromPointer.floatReadValueFromPointer.simpleReadValueFromPointer.runDestructors.new_.craftInvokerFunction.embind__requireFunction.tupleRegistrations.structRegistrations.genericPointerToWireType.constNoSmartPtrRawPointerToWireType.nonConstNoSmartPtrRawPointerToWireType.init_RegisteredPointer.RegisteredPointer.RegisteredPointer_getPointee.RegisteredPointer_destructor.RegisteredPointer_deleteObject.RegisteredPointer_fromWireType.runDestructor.releaseClassHandle.finalizationRegistry.detachFinalizer_deps.detachFinalizer.attachFinalizer.makeClassHandle.init_ClassHandle.ClassHandle.ClassHandle_isAliasOf.throwInstanceAlreadyDeleted.ClassHandle_clone.ClassHandle_delete.deletionQueue.ClassHandle_isDeleted.ClassHandle_deleteLater.flushPendingDeletes.delayFunction.setDelayFunction.RegisteredClass.shallowCopyInternalPointer.downcastPointer.upcastPointer.validateThis.char_0.char_9.makeLegalFunctionName.emval_handle_array.emval_free_list.emval_symbols.init_emval.count_emval_handles.get_first_emval.getStringOrSymbol.Emval.emval_newers.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_methodCallers.emval_addMethodCaller.emval_registeredMethods".split(".")).forEach(v), (/* @__PURE__ */ "ptrToString.zeroMemory.stringToNewUTF8.exitJS.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.getHostByName.getRandomDevice.traverseStack.convertPCtoSourceLocation.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.listenOnce.autoResumeAudioContext.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertU32PairToI53.reallyNegative.unSign.strLen.reSign.formatString.getSocketFromFD.getSocketAddress.registerKeyEventCallback.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.checkWasiClock.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.exception_addRef.exception_decRef.setMainLoop._setNetworkCallback.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.SDL_unicode.SDL_ttfContext.SDL_audio.GLFW_Window.runAndAbortIfError.registerInheritedInstance.unregisterInheritedInstance.requireRegisteredType.enumReadValueFromPointer.validateThis.getStringOrSymbol.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_addMethodCaller".split(".")).forEach(_);
			var rr;
			F = function e() {
				rr || ar(), rr || (F = e);
			};
			function ir() {
				Qn(), le();
			}
			function ar(e) {
				if (e ||= o, be > 0 || (ir(), me(), be > 0)) return;
				function t() {
					rr || (rr = !0, n.calledRun = !0, !x && (he(), r(n), n.onRuntimeInitialized && n.onRuntimeInitialized(), S(!n._main, "compiled without a main, but one is present. if you added it from JS, use Module[\"onRuntimeInitialized\"]"), ge()));
				}
				n.setStatus ? (n.setStatus("Running..."), setTimeout(function() {
					setTimeout(function() {
						n.setStatus("");
					}, 1), t();
				}, 1)) : t(), ue();
			}
			if (n.preInit) for (typeof n.preInit == "function" && (n.preInit = [n.preInit]); n.preInit.length > 0;) n.preInit.pop()();
			return ar(), t.ready;
		});
	})();
	typeof e == "object" && typeof t == "object" ? t.exports = n : typeof define == "function" && define.amd ? define([], function() {
		return n;
	}) : typeof e == "object" && (e.createLazPerf = n);
})), Eo = /* @__PURE__ */ t(((e) => {
	var t = e && e.__importDefault || function(e) {
		return e && e.__esModule ? e : { default: e };
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.LazPerf = e.create = e.createLazPerf = void 0;
	var n = t(To());
	e.createLazPerf = n.default, e.create = n.default, e.LazPerf = { create: n.default };
})), Do = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.decompressFile = e.decompressChunk = e.PointData = void 0;
	var t = Eo(), n = wo();
	e.PointData = {
		createLazPerf: t.createLazPerf,
		decompressChunk: a,
		decompressFile: o
	};
	var r = void 0;
	async function i(e) {
		return e || (r ||= (0, t.createLazPerf)(), r);
	}
	async function a(e, { pointCount: t, pointDataRecordFormat: n, pointDataRecordLength: r }, a) {
		let o = await i(a), s = new Uint8Array(t * r), c = o._malloc(e.byteLength), l = o._malloc(r), u = new o.ChunkDecoder();
		try {
			o.HEAPU8.set(new Uint8Array(e.buffer, e.byteOffset, e.byteLength), c), u.open(n, r, c);
			for (let e = 0; e < t; ++e) u.getPoint(l), s.set(new Uint8Array(o.HEAPU8.buffer, l, r), e * r);
		} finally {
			o._free(c), o._free(l), u.delete();
		}
		return s;
	}
	e.decompressChunk = a;
	async function o(e, t) {
		let r = await i(t), { pointCount: a, pointDataRecordLength: o } = n.Header.parse(e), s = new Uint8Array(a * o), c = r._malloc(e.byteLength), l = r._malloc(o), u = new r.LASZip();
		try {
			r.HEAPU8.set(new Uint8Array(e.buffer, e.byteOffset, e.byteLength), c), u.open(c, e.byteLength);
			for (let e = 0; e < a; ++e) u.getPoint(l), s.set(new Uint8Array(r.HEAPU8.buffer, l, o), e * o);
		} finally {
			u.delete();
		}
		return s;
	}
	e.decompressFile = o;
})), Oo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.View = void 0;
	var t = yo(), n = xo(), r = So();
	e.View = { create: i };
	function i(e, i, a = [], o) {
		let s = r.Extractor.create(i, a);
		if (o) {
			let e = /* @__PURE__ */ new Set([...o]);
			s = Object.entries(s).reduce((t, [n, r]) => (e.has(n) && (t[n] = r), t), {});
		}
		let c = n.Dimensions.create(s, a), l = t.Binary.toDataView(e), u = i.pointDataRecordLength;
		if (l.byteLength % u !== 0) throw Error(`Invalid buffer length (${l.byteLength}) for point length ${u}`);
		let d = l.byteLength / i.pointDataRecordLength;
		function f(e) {
			let t = s[e];
			if (!t) throw Error(`No extractor for dimension: ${e}`);
			return function(e) {
				if (e >= d) throw RangeError(`View index (${e}) out of range: ${d}`);
				return t(l, e);
			};
		}
		return {
			pointCount: d,
			dimensions: c,
			getter: f
		};
	}
})), ko = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Vlr = void 0;
	var t = yo(), n = so();
	e.Vlr = {
		walk: o,
		parse: s,
		find: r,
		at: i,
		fetch: a
	};
	function r(e, t, n) {
		return e.find((e) => e.userId === t && e.recordId === n);
	}
	function i(e, t, n) {
		let i = r(e, t, n);
		if (!i) throw Error(`VLR not found: ${t}/${n}`);
		return i;
	}
	function a(e, { contentOffset: n, contentLength: r }) {
		return r === 0 ? /* @__PURE__ */ new Uint8Array() : t.Getter.create(e)(n, n + r);
	}
	async function o(e, n) {
		let r = t.Getter.create(e), i = await u({
			get: r,
			startOffset: n.headerLength,
			count: n.vlrCount,
			isExtended: !1
		}), a = await u({
			get: r,
			startOffset: n.evlrOffset,
			count: n.evlrCount,
			isExtended: !0
		});
		return [...i, ...a];
	}
	function s(e, t) {
		return (t ? l : c)(e);
	}
	function c(e) {
		let r = t.Binary.toDataView(e);
		if (r.byteLength !== n.vlrHeaderLength) throw Error(`Invalid VLR header length (must be ${n.vlrHeaderLength}): ${r.byteLength}`);
		return {
			userId: t.Binary.toCString(e.slice(2, 18)),
			recordId: r.getUint16(18, !0),
			contentLength: r.getUint16(20, !0),
			description: t.Binary.toCString(e.slice(22, 54)),
			isExtended: !1
		};
	}
	function l(e) {
		let r = t.Binary.toDataView(e);
		if (r.byteLength !== n.evlrHeaderLength) throw Error(`Invalid EVLR header length (must be ${n.evlrHeaderLength}): ${r.byteLength}`);
		return {
			userId: t.Binary.toCString(e.slice(2, 18)),
			recordId: r.getUint16(18, !0),
			contentLength: (0, t.parseBigInt)((0, t.getBigUint64)(r, 20, !0)),
			description: t.Binary.toCString(e.slice(28, 60)),
			isExtended: !0
		};
	}
	async function u({ get: e, startOffset: t, count: r, isExtended: i }) {
		let a = [], o = t, c = i ? n.evlrHeaderLength : n.vlrHeaderLength;
		for (let t = 0; t < r; ++t) {
			let { userId: t, recordId: n, contentLength: r, description: l } = s(c ? await e(o, o + c) : /* @__PURE__ */ new Uint8Array(), i);
			a.push({
				userId: t,
				recordId: n,
				contentOffset: o + c,
				contentLength: r,
				description: l,
				isExtended: i
			}), o += c + r;
		}
		return a;
	}
})), Ao = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__setModuleDefault || (Object.create ? (function(e, t) {
		Object.defineProperty(e, "default", {
			enumerable: !0,
			value: t
		});
	}) : function(e, t) {
		e.default = t;
	}), r = e && e.__importStar || function(e) {
		if (e && e.__esModule) return e;
		var r = {};
		if (e != null) for (var i in e) i !== "default" && Object.prototype.hasOwnProperty.call(e, i) && t(r, e, i);
		return n(r, e), r;
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Vlr = e.View = e.PointData = e.Header = e.Extractor = e.ExtraBytes = e.Dimensions = e.Constants = void 0, e.Constants = r(so());
	var i = xo();
	Object.defineProperty(e, "Dimensions", {
		enumerable: !0,
		get: function() {
			return i.Dimensions;
		}
	});
	var a = bo();
	Object.defineProperty(e, "ExtraBytes", {
		enumerable: !0,
		get: function() {
			return a.ExtraBytes;
		}
	});
	var o = So();
	Object.defineProperty(e, "Extractor", {
		enumerable: !0,
		get: function() {
			return o.Extractor;
		}
	});
	var s = wo();
	Object.defineProperty(e, "Header", {
		enumerable: !0,
		get: function() {
			return s.Header;
		}
	});
	var c = Do();
	Object.defineProperty(e, "PointData", {
		enumerable: !0,
		get: function() {
			return c.PointData;
		}
	});
	var l = Oo();
	Object.defineProperty(e, "View", {
		enumerable: !0,
		get: function() {
			return l.View;
		}
	});
	var u = ko();
	Object.defineProperty(e, "Vlr", {
		enumerable: !0,
		get: function() {
			return u.Vlr;
		}
	});
})), jo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Hierarchy = void 0;
	var t = yo(), n = oo();
	e.Hierarchy = {
		parse: r,
		load: i
	};
	function r(e) {
		let r = t.Binary.toDataView(e);
		if (r.byteLength % n.hierarchyItemLength !== 0) throw Error(`Invalid hierarchy page length: ${r.byteLength}`);
		let i = {}, a = {};
		for (let e = 0; e < r.byteLength; e += n.hierarchyItemLength) {
			let n = r.getInt32(e + 0, !0), o = r.getInt32(e + 4, !0), s = r.getInt32(e + 8, !0), c = r.getInt32(e + 12, !0), l = (0, t.parseBigInt)((0, t.getBigUint64)(r, e + 16, !0)), u = r.getInt32(e + 24, !0), d = r.getInt32(e + 28, !0), f = t.Key.toString([
				n,
				o,
				s,
				c
			]);
			if (d < -1) throw Error(`Invalid hierarchy point count at key: ${f}`);
			d === -1 ? a[f] = {
				pageOffset: l,
				pageLength: u
			} : i[f] = {
				pointCount: d,
				pointDataOffset: l,
				pointDataLength: u
			};
		}
		return {
			nodes: i,
			pages: a
		};
	}
	async function i(e, n) {
		return r(await t.Getter.create(e)(n.pageOffset, n.pageOffset + n.pageLength));
	}
})), Mo = /* @__PURE__ */ t(((e) => {
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Info = void 0;
	var t = yo(), n = oo();
	e.Info = { parse: r };
	function r(e) {
		let r = t.Binary.toDataView(e);
		if (r.byteLength !== n.infoLength) throw Error(`Invalid COPC info VLR length (should be ${n.infoLength}): ${r.byteLength}`);
		let i = [
			r.getFloat64(0, !0),
			r.getFloat64(8, !0),
			r.getFloat64(16, !0)
		], a = r.getFloat64(24, !0);
		return {
			cube: [
				i[0] - a,
				i[1] - a,
				i[2] - a,
				i[0] + a,
				i[1] + a,
				i[2] + a
			],
			spacing: r.getFloat64(32, !0),
			rootHierarchyPage: {
				pageOffset: (0, t.parseBigInt)((0, t.getBigUint64)(r, 40, !0)),
				pageLength: (0, t.parseBigInt)((0, t.getBigUint64)(r, 48, !0))
			},
			gpsTimeRange: [r.getFloat64(56, !0), r.getFloat64(64, !0)]
		};
	}
})), No = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__setModuleDefault || (Object.create ? (function(e, t) {
		Object.defineProperty(e, "default", {
			enumerable: !0,
			value: t
		});
	}) : function(e, t) {
		e.default = t;
	}), r = e && e.__importStar || function(e) {
		if (e && e.__esModule) return e;
		var r = {};
		if (e != null) for (var i in e) i !== "default" && Object.prototype.hasOwnProperty.call(e, i) && t(r, e, i);
		return n(r, e), r;
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Copc = void 0;
	var i = r(Ao()), a = yo(), o = jo(), s = Mo();
	e.Copc = {
		create: c,
		loadHierarchyPage: l,
		loadCompressedPointDataBuffer: u,
		loadPointDataBuffer: d,
		loadPointDataView: f
	};
	async function c(e) {
		let t = a.Getter.create(e), n = 65536, r = t(0, n);
		async function o(e, i) {
			return i >= n ? t(e, i) : (await r).slice(e, i);
		}
		let c = i.Header.parse(await o(0, i.Constants.minHeaderLength)), l = await i.Vlr.walk(o, c), u = i.Vlr.find(l, "copc", 1);
		if (!u) throw Error("COPC info VLR is required");
		let d = s.Info.parse(await i.Vlr.fetch(o, u)), f, p = i.Vlr.find(l, "LASF_Projection", 2112);
		p && p.contentLength && (f = a.Binary.toCString(await i.Vlr.fetch(o, p)), f === "" && (f = void 0));
		let m = [], h = i.Vlr.find(l, "LASF_Spec", 4);
		return h && (m = i.ExtraBytes.parse(await i.Vlr.fetch(o, h))), {
			header: c,
			vlrs: l,
			info: d,
			wkt: f,
			eb: m
		};
	}
	async function l(e, t) {
		let n = a.Getter.create(e);
		return o.Hierarchy.load(n, t);
	}
	async function u(e, { pointDataOffset: t, pointDataLength: n }) {
		return a.Getter.create(e)(t, t + n);
	}
	async function d(e, { pointDataRecordFormat: t, pointDataRecordLength: n }, r, a) {
		let o = await u(e, r), { pointCount: s } = r;
		return i.PointData.decompressChunk(o, {
			pointCount: s,
			pointDataRecordFormat: t,
			pointDataRecordLength: n
		}, a);
	}
	async function f(e, t, n, { lazPerf: r, include: a } = {}) {
		let o = await d(e, t.header, n, r);
		return i.View.create(o, t.header, t.eb, a);
	}
})), Po = /* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__setModuleDefault || (Object.create ? (function(e, t) {
		Object.defineProperty(e, "default", {
			enumerable: !0,
			value: t
		});
	}) : function(e, t) {
		e.default = t;
	}), r = e && e.__importStar || function(e) {
		if (e && e.__esModule) return e;
		var r = {};
		if (e != null) for (var i in e) i !== "default" && Object.prototype.hasOwnProperty.call(e, i) && t(r, e, i);
		return n(r, e), r;
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Info = e.Hierarchy = e.Copc = e.Constants = void 0, e.Constants = r(oo());
	var i = No();
	Object.defineProperty(e, "Copc", {
		enumerable: !0,
		get: function() {
			return i.Copc;
		}
	});
	var a = jo();
	Object.defineProperty(e, "Hierarchy", {
		enumerable: !0,
		get: function() {
			return a.Hierarchy;
		}
	});
	var o = Mo();
	Object.defineProperty(e, "Info", {
		enumerable: !0,
		get: function() {
			return o.Info;
		}
	});
})), Fo = (/* @__PURE__ */ t(((e) => {
	var t = e && e.__createBinding || (Object.create ? (function(e, t, n, r) {
		r === void 0 && (r = n);
		var i = Object.getOwnPropertyDescriptor(t, n);
		(!i || ("get" in i ? !t.__esModule : i.writable || i.configurable)) && (i = {
			enumerable: !0,
			get: function() {
				return t[n];
			}
		}), Object.defineProperty(e, r, i);
	}) : (function(e, t, n, r) {
		r === void 0 && (r = n), e[r] = t[n];
	})), n = e && e.__setModuleDefault || (Object.create ? (function(e, t) {
		Object.defineProperty(e, "default", {
			enumerable: !0,
			value: t
		});
	}) : function(e, t) {
		e.default = t;
	}), r = e && e.__importStar || function(e) {
		if (e && e.__esModule) return e;
		var r = {};
		if (e != null) for (var i in e) i !== "default" && Object.prototype.hasOwnProperty.call(e, i) && t(r, e, i);
		return n(r, e), r;
	}, i = e && e.__exportStar || function(e, n) {
		for (var r in e) r !== "default" && !Object.prototype.hasOwnProperty.call(n, r) && t(n, e, r);
	};
	Object.defineProperty(e, "__esModule", { value: !0 }), e.Las = e.Ept = void 0, e.Ept = r(ao()), i(Po(), e), e.Las = r(Ao()), i(yo(), e);
})))();
function Io(e) {
	return e.split("-").map(Number);
}
//#endregion
//#region src/copc/node.ts
function Lo(e) {
	return parseInt(e.split("-")[0]);
}
function Ro(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let [e, r, i, a] = Io(n), o = t.get(e);
		o || t.set(e, o = []), o.push({
			key: n,
			x: r,
			y: i,
			z: a
		});
	}
	return t;
}
function zo(e, t) {
	let [n, r, i, a] = Io(e), o = [];
	for (let [e, s] of t) {
		if (e === n) continue;
		let t = e > n ? e - n : n - e;
		for (let c of s) (e > n ? c.x >> t === r && c.y >> t === i && c.z >> t === a : r >> t === c.x && i >> t === c.y && a >> t === c.z) && o.push(c.key);
	}
	return o;
}
function Bo(e) {
	let [t, n, r, i] = Io(e), a = t + 1, o = n * 2, s = r * 2, c = i * 2;
	return [
		`${a}-${o}-${s}-${c}`,
		`${a}-${o + 1}-${s}-${c}`,
		`${a}-${o}-${s + 1}-${c}`,
		`${a}-${o + 1}-${s + 1}-${c}`,
		`${a}-${o}-${s}-${c + 1}`,
		`${a}-${o + 1}-${s}-${c + 1}`,
		`${a}-${o}-${s + 1}-${c + 1}`,
		`${a}-${o + 1}-${s + 1}-${c + 1}`
	];
}
//#endregion
//#region src/copc/TransferCounter.ts
var Vo = class {
	constructor() {
		this._requestCount = 0, this._transferredBytes = 0, this._fileBytes = 0;
	}
	record(e, t) {
		this._requestCount++, this._transferredBytes += t - e;
	}
	setFileBytes(e) {
		this._fileBytes = e;
	}
	get fileBytes() {
		return this._fileBytes;
	}
	get requestCount() {
		return this._requestCount;
	}
	get transferredBytes() {
		return this._transferredBytes;
	}
};
function Ho(e) {
	if (!e) return;
	let t = /\/\s*(\d+)\s*$/.exec(e);
	if (!t) return;
	let n = Number(t[1]);
	return Number.isFinite(n) ? n : void 0;
}
function Uo(e, t, n, r) {
	let i = /* @__PURE__ */ Error(`copcesium: server returned HTTP ${t} for bytes=${n}-${r - 1} of ${e} (expected 206 Partial Content)`);
	return i.status = t, i;
}
function Wo(e, t) {
	return async (n, r) => {
		let i = await fetch(e, { headers: { Range: `bytes=${n}-${r - 1}` } });
		if (i.status !== 206) throw Uo(e, i.status, n, r);
		if (t.fileBytes === 0) {
			let e = Ho(i.headers?.get("Content-Range") ?? null);
			e !== void 0 && t.setFileBytes(e);
		}
		return t.record(n, r), new Uint8Array(await i.arrayBuffer());
	};
}
//#endregion
//#region src/copc/hierarchy.ts
async function Go(e, t) {
	if (!/^https?:\/\//i.test(e)) return;
	let n = await fetch(e, { headers: { Range: "bytes=0-0" } }), r = Ho(n.headers?.get("Content-Range") ?? null);
	if (r !== void 0 && t.setFileBytes(r), t.record(0, 1), n.status !== 206) throw Error(`Server did not honor an HTTP Range Request (expected 206 Partial Content, got ${n.status}). COPC streaming requires Range Request support — check that the server or CDN advertises "Accept-Ranges: bytes".`);
}
async function Ko(e, t) {
	if (/^https?:\/\//i.test(e)) try {
		let n = await fetch(e, { method: "HEAD" }), r = Number(n.headers?.get("Content-Length"));
		Number.isFinite(r) && r > 0 && t.setFileBytes(r);
	} catch {}
}
async function qo(e) {
	let t = new Vo();
	await Go(e, t), t.fileBytes === 0 && await Ko(e, t);
	let n = Wo(e, t), r;
	try {
		r = await Fo.Copc.create(n);
	} catch (e) {
		let t = e;
		throw /must be at least|Invalid header|COPC info VLR/i.test(t.message) ? Error(`Failed to read the COPC header. Check that the URL is correct and that CORS access is allowed.\nCause: ${t.message}`, { cause: e }) : e;
	}
	let [i, a, o, s, c, l] = r.info.cube, u = {
		x: (i + s) / 2,
		y: (a + c) / 2,
		z: (o + l) / 2
	}, d = (s - i) / 2, { nodes: f, pages: p } = await Fo.Copc.loadHierarchyPage(n, r.info.rootHierarchyPage), m = 0;
	for (let e of Object.keys(f)) {
		let t = Lo(e);
		t > m && (m = t);
	}
	return {
		copc: r,
		nodes: f,
		pages: p,
		maxDepth: m,
		rootCenter: u,
		rootHalfSize: d,
		counter: t
	};
}
//#endregion
//#region src/copc/RangeFetcher.ts
function Jo(e) {
	let t = Error(e);
	return t.name = "AbortError", t;
}
function Yo(e, t, n) {
	let r = /* @__PURE__ */ Error(`RangeFetcher: server returned HTTP ${e} for bytes=${t}-${n - 1} (expected 206 Partial Content)`);
	return r.status = e, r;
}
function Xo(e) {
	if (e.name === "AbortError") return !1;
	let t = e.status;
	return t === void 0 || t >= 500;
}
function Zo(e, t) {
	return new Promise((n) => {
		if (t.aborted) return n();
		let r = setTimeout(() => {
			t.removeEventListener("abort", i), n();
		}, e), i = () => {
			clearTimeout(r), n();
		};
		t.addEventListener("abort", i, { once: !0 });
	});
}
var Qo = 512 * 1024, $o = 6, es = 3, ts = 250, ns = class {
	constructor(e, t = 0, n = Qo, r = $o, i) {
		this.url = e, this.gapBytes = t, this.maxGroupBytes = n, this.maxConcurrent = r, this.counter = i, this.pending = [], this.flushScheduled = !1, this.queue = [], this.activeCount = 0, this.inFlight = /* @__PURE__ */ new Set(), this.destroyed = !1;
	}
	fetch(e, t) {
		if (this.destroyed) {
			let e = Promise.reject(Jo("RangeFetcher: fetch() called after destroy()"));
			return e.cancel = () => {}, e;
		}
		let n, r = new Promise((r, i) => {
			n = {
				begin: e,
				end: t,
				resolve: r,
				reject: i,
				cancelled: !1,
				group: null
			}, this.pending.push(n), this._scheduleFlush();
		});
		return r.cancel = () => {
			if (n.cancelled) return;
			n.cancelled = !0;
			let e = n.group;
			!e || --e.liveCount > 0 || (e.controller ? e.controller.abort() : this._cancelQueuedGroup(e));
		}, r;
	}
	destroy() {
		this.destroyed = !0;
		for (let e of this.pending) e.reject(Jo("RangeFetcher: destroyed before its request was sent"));
		this.pending = [];
		for (let { requests: e } of this.queue) for (let t of e) t.reject(Jo("RangeFetcher: destroyed before its request was sent"));
		this.queue.length = 0;
		for (let e of this.inFlight) e.abort();
	}
	_scheduleFlush() {
		this.flushScheduled || (this.flushScheduled = !0, queueMicrotask(() => this._flush()));
	}
	_flush() {
		this.flushScheduled = !1;
		let e = this.pending;
		this.pending = [];
		let t = [];
		for (let n of e) n.cancelled ? n.reject(Jo("RangeFetcher: request cancelled before it reached a fetch")) : t.push(n);
		for (let e of this._group(t)) {
			let t = {
				liveCount: e.length,
				controller: null
			};
			for (let n of e) n.group = t;
			this.queue.push({
				requests: e,
				state: t
			});
		}
		this._pump();
	}
	_cancelQueuedGroup(e) {
		let t = this.queue.findIndex((t) => t.state === e);
		if (t === -1) return;
		let [n] = this.queue.splice(t, 1);
		for (let e of n.requests) e.reject(Jo("RangeFetcher: request cancelled before it reached a fetch"));
	}
	_pump() {
		for (; this.activeCount < this.maxConcurrent && this.queue.length > 0;) {
			let { requests: e, state: t } = this.queue.shift();
			this.activeCount++, this._fetchGroup(e, t).finally(() => {
				this.activeCount--, this._pump();
			});
		}
	}
	_group(e) {
		let t = [...e].sort((e, t) => e.begin - t.begin), n = [];
		for (let e of t) {
			let t = n[n.length - 1], r = t?.[t.length - 1], i = t ? e.end - t[0].begin : 0;
			r && e.begin - r.end <= this.gapBytes && i <= this.maxGroupBytes ? t.push(e) : n.push([e]);
		}
		return n;
	}
	async _fetchGroup(e, t) {
		let n = e[0].begin, r = e[e.length - 1].end, i = new AbortController();
		t.controller = i, this.inFlight.add(i);
		try {
			let t = await this._fetchRange(n, r, i.signal);
			for (let r of e) r.cancelled ? r.reject(Jo("RangeFetcher: request cancelled before its result was needed")) : r.resolve(t.slice(r.begin - n, r.end - n));
		} catch (t) {
			let n = t;
			for (let t of e) t.reject(n);
		} finally {
			this.inFlight.delete(i);
		}
	}
	async _fetchRange(e, t, n) {
		for (let r = 1;; r++) try {
			let r = await fetch(this.url, {
				headers: { Range: `bytes=${e}-${t - 1}` },
				signal: n
			});
			if (r.status !== 206) throw Yo(r.status, e, t);
			let i = new Uint8Array(await r.arrayBuffer());
			return this.counter?.record(e, e + i.length), i;
		} catch (e) {
			if (r >= es || n.aborted || !Xo(e)) throw e;
			if (await Zo(ts * 2 ** (r - 1), n), n.aborted) throw Jo("RangeFetcher: request cancelled while waiting to retry");
		}
	}
}, rs = {
	4326: "+proj=longlat +datum=WGS84 +no_defs",
	4269: "+proj=longlat +ellps=GRS80 +datum=NAD83 +no_defs",
	4617: "+proj=longlat +ellps=GRS80 +no_defs",
	4737: "+proj=longlat +ellps=GRS80 +no_defs",
	3857: "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs",
	5179: "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs",
	5185: "+proj=tmerc +lat_0=38 +lon_0=125 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs",
	5186: "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs",
	5187: "+proj=tmerc +lat_0=38 +lon_0=129 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs",
	5188: "+proj=tmerc +lat_0=38 +lon_0=131 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs",
	5174: "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
	5175: "+proj=tmerc +lat_0=38 +lon_0=129.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
	5176: "+proj=tmerc +lat_0=38 +lon_0=125.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
	5177: "+proj=tmerc +lat_0=38 +lon_0=131.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43",
	2226: "+proj=lcc +lat_1=40.33333333333334 +lat_2=41.66666666666666 +lat_0=39.33333333333334 +lon_0=-122 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 +units=us-ft +no_defs",
	2227: "+proj=lcc +lat_1=37.06666666666667 +lat_2=38.43333333333333 +lat_0=36.5 +lon_0=-120.5 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 +units=us-ft +no_defs",
	2228: "+proj=lcc +lat_1=36 +lat_2=37.25 +lat_0=35.33333333333334 +lon_0=-119 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 +units=us-ft +no_defs",
	2229: "+proj=lcc +lat_1=34.03333333333333 +lat_2=35.46666666666667 +lat_0=33.5 +lon_0=-118 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 +units=us-ft +no_defs",
	2230: "+proj=lcc +lat_1=32.78333333333333 +lat_2=33.88333333333333 +lat_0=32.16666666666666 +lon_0=-116.25 +x_0=2000000.0001016 +y_0=500000.0001016001 +datum=NAD83 +units=us-ft +no_defs",
	2992: "+proj=lcc +lat_1=43 +lat_2=45.5 +lat_0=41.75 +lon_0=-120.5 +x_0=399999.9999999999 +y_0=0 +datum=NAD83 +units=ft +no_defs",
	2993: "+proj=lcc +lat_1=42.33333333333334 +lat_2=44 +lat_0=41.66666666666666 +lon_0=-120.5 +x_0=1500000 +y_0=0 +datum=NAD83 +units=ft +no_defs",
	2285: "+proj=lcc +lat_1=47.5 +lat_2=48.73333333333333 +lat_0=47 +lon_0=-120.8333333333333 +x_0=500000.0001016001 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2286: "+proj=lcc +lat_1=45.83333333333334 +lat_2=47.33333333333334 +lat_0=45.33333333333334 +lon_0=-120.5 +x_0=500000.0001016001 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2231: "+proj=lcc +lat_1=39.71666666666667 +lat_2=40.78333333333333 +lat_0=39.33333333333334 +lon_0=-105.5 +x_0=914401.8289 +y_0=304800.6096 +datum=NAD83 +units=us-ft +no_defs",
	2232: "+proj=lcc +lat_1=38.45 +lat_2=39.75 +lat_0=37.83333333333334 +lon_0=-105.5 +x_0=914401.8289 +y_0=304800.6096 +datum=NAD83 +units=us-ft +no_defs",
	2233: "+proj=lcc +lat_1=37.23333333333333 +lat_2=38.43333333333333 +lat_0=36.66666666666666 +lon_0=-105.5 +x_0=914401.8289 +y_0=304800.6096 +datum=NAD83 +units=us-ft +no_defs",
	2275: "+proj=lcc +lat_1=34.65 +lat_2=36.18333333333333 +lat_0=34 +lon_0=-101.5 +x_0=200000 +y_0=1000000 +datum=NAD83 +units=us-ft +no_defs",
	2276: "+proj=lcc +lat_1=32.13333333333333 +lat_2=33.96666666666667 +lat_0=31.66666666666667 +lon_0=-98.5 +x_0=600000 +y_0=2000000 +datum=NAD83 +units=us-ft +no_defs",
	2277: "+proj=lcc +lat_1=30.11666666666667 +lat_2=31.88333333333333 +lat_0=29.66666666666667 +lon_0=-100.3333333333333 +x_0=700000 +y_0=3000000 +datum=NAD83 +units=us-ft +no_defs",
	2278: "+proj=lcc +lat_1=28.38333333333333 +lat_2=30.28333333333333 +lat_0=27.83333333333333 +lon_0=-99 +x_0=600000 +y_0=4000000 +datum=NAD83 +units=us-ft +no_defs",
	2279: "+proj=lcc +lat_1=26.16666666666667 +lat_2=27.83333333333333 +lat_0=25.66666666666667 +lon_0=-98.5 +x_0=300000 +y_0=5000000 +datum=NAD83 +units=us-ft +no_defs",
	2236: "+proj=tmerc +lat_0=24.33333333333333 +lon_0=-81 +k=0.999941177 +x_0=200000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2237: "+proj=tmerc +lat_0=24.33333333333333 +lon_0=-82 +k=0.999941177 +x_0=200000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2260: "+proj=tmerc +lat_0=38.83333333333334 +lon_0=-74.5 +k=0.9999 +x_0=150000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2261: "+proj=tmerc +lat_0=40 +lon_0=-76.58333333333333 +k=0.9999375 +x_0=250000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2262: "+proj=tmerc +lat_0=40 +lon_0=-78.58333333333333 +k=0.9999375 +x_0=350000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	2263: "+proj=lcc +lat_1=40.66666666666666 +lat_2=41.03333333333333 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	3435: "+proj=tmerc +lat_0=36.66666666666666 +lon_0=-88.33333333333333 +k=0.9999749999999999 +x_0=300000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	3436: "+proj=tmerc +lat_0=36.66666666666666 +lon_0=-90.16666666666667 +k=0.999941177 +x_0=700000 +y_0=0 +datum=NAD83 +units=us-ft +no_defs",
	26901: "+proj=utm +zone=1 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26902: "+proj=utm +zone=2 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26903: "+proj=utm +zone=3 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26904: "+proj=utm +zone=4 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26905: "+proj=utm +zone=5 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26906: "+proj=utm +zone=6 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26907: "+proj=utm +zone=7 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26908: "+proj=utm +zone=8 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26909: "+proj=utm +zone=9 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26910: "+proj=utm +zone=10 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26911: "+proj=utm +zone=11 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26912: "+proj=utm +zone=12 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26913: "+proj=utm +zone=13 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26914: "+proj=utm +zone=14 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26915: "+proj=utm +zone=15 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26916: "+proj=utm +zone=16 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26917: "+proj=utm +zone=17 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26918: "+proj=utm +zone=18 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26919: "+proj=utm +zone=19 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26920: "+proj=utm +zone=20 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26921: "+proj=utm +zone=21 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26922: "+proj=utm +zone=22 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26923: "+proj=utm +zone=23 +ellps=GRS80 +datum=NAD83 +units=m +no_defs",
	26931: "+proj=tmerc +lat_0=57 +lon_0=-133 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26932: "+proj=tmerc +lat_0=54 +lon_0=-142 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26933: "+proj=tmerc +lat_0=54 +lon_0=-146 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26934: "+proj=tmerc +lat_0=54 +lon_0=-150 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26935: "+proj=tmerc +lat_0=54 +lon_0=-154 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26936: "+proj=tmerc +lat_0=54 +lon_0=-158 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26937: "+proj=tmerc +lat_0=54 +lon_0=-162 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26938: "+proj=tmerc +lat_0=54 +lon_0=-166 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26939: "+proj=tmerc +lat_0=54 +lon_0=-170 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26940: "+proj=lcc +lat_1=53.83333333333334 +lat_2=51.83333333333334 +lat_0=51 +lon_0=-176 +x_0=1000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26948: "+proj=tmerc +lat_0=31 +lon_0=-110.1666666666667 +k=0.9999 +x_0=213360 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26949: "+proj=tmerc +lat_0=31 +lon_0=-111.9166666666667 +k=0.9999 +x_0=213360 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26950: "+proj=tmerc +lat_0=31 +lon_0=-113.75 +k=0.999933333 +x_0=213360 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26951: "+proj=lcc +lat_1=34.93333333333333 +lat_2=36.23333333333333 +lat_0=34.33333333333334 +lon_0=-92 +x_0=400000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26952: "+proj=lcc +lat_1=33.3 +lat_2=34.76666666666667 +lat_0=32.66666666666666 +lon_0=-92 +x_0=400000 +y_0=400000 +datum=NAD83 +units=m +no_defs",
	32118: "+proj=lcc +lat_1=41.86666666666667 +lat_2=41.2 +lat_0=40.83333333333334 +lon_0=-72.75 +x_0=304800.6096 +y_0=152400.3048 +datum=NAD83 +units=m +no_defs",
	32112: "+proj=tmerc +lat_0=38 +lon_0=-75.41666666666667 +k=0.999995 +x_0=200000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26966: "+proj=tmerc +lat_0=30 +lon_0=-82.16666666666667 +k=0.9999 +x_0=200000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26967: "+proj=tmerc +lat_0=30 +lon_0=-84.16666666666667 +k=0.9999 +x_0=700000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26961: "+proj=tmerc +lat_0=18.83333333333333 +lon_0=-155.5 +k=0.999967 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26962: "+proj=tmerc +lat_0=20.33333333333334 +lon_0=-156.6666666666667 +k=0.999967 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26963: "+proj=tmerc +lat_0=21.16666666666667 +lon_0=-158 +k=0.99999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26964: "+proj=tmerc +lat_0=21.83333333333333 +lon_0=-159.5 +k=0.99999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26965: "+proj=tmerc +lat_0=21.66666666666667 +lon_0=-160.1666666666667 +k=1 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26968: "+proj=tmerc +lat_0=41.66666666666666 +lon_0=-112.1666666666667 +k=0.9999473679 +x_0=200000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26969: "+proj=tmerc +lat_0=41.66666666666666 +lon_0=-114 +k=0.9999473679 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26970: "+proj=tmerc +lat_0=41.66666666666666 +lon_0=-115.75 +k=0.999933333 +x_0=800000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26971: "+proj=tmerc +lat_0=37.5 +lon_0=-85.66666666666667 +k=0.999966667 +x_0=100000 +y_0=250000 +datum=NAD83 +units=m +no_defs",
	26972: "+proj=tmerc +lat_0=37.5 +lon_0=-87.08333333333333 +k=0.999966667 +x_0=900000 +y_0=250000 +datum=NAD83 +units=m +no_defs",
	26975: "+proj=lcc +lat_1=43.26666666666667 +lat_2=42.06666666666667 +lat_0=41.5 +lon_0=-93.5 +x_0=1500000 +y_0=1000000 +datum=NAD83 +units=m +no_defs",
	26976: "+proj=lcc +lat_1=41.78333333333333 +lat_2=40.61666666666667 +lat_0=40 +lon_0=-93.5 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26977: "+proj=lcc +lat_1=39.78333333333333 +lat_2=38.71666666666667 +lat_0=38.33333333333334 +lon_0=-98 +x_0=400000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26978: "+proj=lcc +lat_1=38.56666666666667 +lat_2=37.26666666666667 +lat_0=36.66666666666666 +lon_0=-98.5 +x_0=400000 +y_0=400000 +datum=NAD83 +units=m +no_defs",
	2205: "+proj=lcc +lat_1=37.96666666666667 +lat_2=38.96666666666667 +lat_0=37.5 +lon_0=-84.25 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26979: "+proj=lcc +lat_1=37.08333333333334 +lat_2=36.73333333333333 +lat_0=36.33333333333334 +lon_0=-85.75 +x_0=500000 +y_0=500000 +datum=NAD83 +units=m +no_defs",
	26980: "+proj=lcc +lat_1=32.66666666666666 +lat_2=31.16666666666667 +lat_0=30.5 +lon_0=-92.5 +x_0=1000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26981: "+proj=lcc +lat_1=30.7 +lat_2=29.3 +lat_0=28.5 +lon_0=-91.33333333333333 +x_0=1000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26982: "+proj=tmerc +lat_0=43.66666666666666 +lon_0=-68.5 +k=0.9999 +x_0=300000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26983: "+proj=tmerc +lat_0=42.83333333333334 +lon_0=-70.16666666666667 +k=0.999966667 +x_0=900000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26985: "+proj=lcc +lat_1=39.45 +lat_2=38.3 +lat_0=37.66666666666666 +lon_0=-77 +x_0=400000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26986: "+proj=lcc +lat_1=42.68333333333333 +lat_2=41.71666666666667 +lat_0=41 +lon_0=-71.5 +x_0=200000 +y_0=750000 +datum=NAD83 +units=m +no_defs",
	26987: "+proj=lcc +lat_1=41.48333333333333 +lat_2=41.28333333333333 +lat_0=41 +lon_0=-70.5 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26988: "+proj=lcc +lat_1=45.7 +lat_2=44.18333333333333 +lat_0=43.31666666666667 +lon_0=-84.36666666666666 +x_0=6000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26989: "+proj=lcc +lat_1=44.18333333333333 +lat_2=42.1 +lat_0=41.5 +lon_0=-84.36666666666666 +x_0=4000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26990: "+proj=lcc +lat_1=43.66666666666666 +lat_2=42.1 +lat_0=41.5 +lon_0=-84.36666666666666 +x_0=4000000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26991: "+proj=lcc +lat_1=48.63333333333333 +lat_2=47.03333333333333 +lat_0=46.5 +lon_0=-93.1 +x_0=800000 +y_0=100000 +datum=NAD83 +units=m +no_defs",
	26992: "+proj=lcc +lat_1=47.05 +lat_2=45.61666666666667 +lat_0=45 +lon_0=-94.25 +x_0=800000 +y_0=100000 +datum=NAD83 +units=m +no_defs",
	26993: "+proj=lcc +lat_1=45.21666666666667 +lat_2=43.78333333333333 +lat_0=43 +lon_0=-94 +x_0=800000 +y_0=100000 +datum=NAD83 +units=m +no_defs",
	26994: "+proj=tmerc +lat_0=29.5 +lon_0=-88.83333333333333 +k=0.99995 +x_0=300000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26995: "+proj=tmerc +lat_0=29.5 +lon_0=-90.33333333333333 +k=0.99995 +x_0=700000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26996: "+proj=tmerc +lat_0=35.83333333333334 +lon_0=-90.5 +k=0.999933333 +x_0=250000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26997: "+proj=tmerc +lat_0=35.83333333333334 +lon_0=-92.5 +k=0.999933333 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	26998: "+proj=tmerc +lat_0=36.16666666666666 +lon_0=-94.5 +k=0.999941177 +x_0=850000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32100: "+proj=lcc +lat_1=49 +lat_2=45 +lat_0=44.25 +lon_0=-109.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32104: "+proj=lcc +lat_1=43 +lat_2=40 +lat_0=39.83333333333334 +lon_0=-100 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32107: "+proj=tmerc +lat_0=34.75 +lon_0=-115.5833333333333 +k=0.9999 +x_0=200000 +y_0=8000000 +datum=NAD83 +units=m +no_defs",
	32108: "+proj=tmerc +lat_0=34.75 +lon_0=-116.6666666666667 +k=0.9999 +x_0=500000 +y_0=6000000 +datum=NAD83 +units=m +no_defs",
	32109: "+proj=tmerc +lat_0=34.75 +lon_0=-118.5833333333333 +k=0.9999 +x_0=800000 +y_0=4000000 +datum=NAD83 +units=m +no_defs",
	32110: "+proj=tmerc +lat_0=42.5 +lon_0=-71.66666666666667 +k=0.999966667 +x_0=300000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32111: "+proj=tmerc +lat_0=38.83333333333334 +lon_0=-74.5 +k=0.9999 +x_0=150000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32113: "+proj=tmerc +lat_0=31 +lon_0=-106.25 +k=0.9999 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32114: "+proj=tmerc +lat_0=31 +lon_0=-107.8333333333333 +k=0.999916667 +x_0=830000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32119: "+proj=lcc +lat_1=36.16666666666666 +lat_2=34.33333333333334 +lat_0=33.75 +lon_0=-79 +x_0=609601.22 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32120: "+proj=lcc +lat_1=48.73333333333333 +lat_2=47.43333333333333 +lat_0=47 +lon_0=-100.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32121: "+proj=lcc +lat_1=47.48333333333333 +lat_2=46.18333333333333 +lat_0=45.66666666666666 +lon_0=-100.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32122: "+proj=lcc +lat_1=41.7 +lat_2=40.43333333333333 +lat_0=39.66666666666666 +lon_0=-82.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32123: "+proj=lcc +lat_1=40.03333333333333 +lat_2=38.73333333333333 +lat_0=38 +lon_0=-82.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32124: "+proj=lcc +lat_1=36.76666666666667 +lat_2=35.56666666666667 +lat_0=35 +lon_0=-98 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32125: "+proj=lcc +lat_1=35.23333333333333 +lat_2=33.93333333333333 +lat_0=33.33333333333334 +lon_0=-98 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32128: "+proj=lcc +lat_1=41.95 +lat_2=40.88333333333333 +lat_0=40.16666666666666 +lon_0=-77.75 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32129: "+proj=lcc +lat_1=40.96666666666667 +lat_2=39.93333333333333 +lat_0=39.33333333333334 +lon_0=-77.75 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32130: "+proj=tmerc +lat_0=41.08333333333334 +lon_0=-71.5 +k=0.99999375 +x_0=100000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32133: "+proj=lcc +lat_1=34.83333333333334 +lat_2=32.5 +lat_0=31.83333333333333 +lon_0=-81 +x_0=609600 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32134: "+proj=lcc +lat_1=45.68333333333333 +lat_2=44.41666666666666 +lat_0=43.83333333333334 +lon_0=-100 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32135: "+proj=lcc +lat_1=44.4 +lat_2=42.83333333333334 +lat_0=42.33333333333334 +lon_0=-100.3333333333333 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32136: "+proj=lcc +lat_1=36.41666666666666 +lat_2=35.25 +lat_0=34.33333333333334 +lon_0=-86 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32137: "+proj=lcc +lat_1=41.78333333333333 +lat_2=40.71666666666667 +lat_0=40.33333333333334 +lon_0=-111.5 +x_0=500000 +y_0=1000000 +datum=NAD83 +units=m +no_defs",
	32138: "+proj=lcc +lat_1=40.65 +lat_2=39.01666666666667 +lat_0=38.33333333333334 +lon_0=-111.5 +x_0=500000 +y_0=2000000 +datum=NAD83 +units=m +no_defs",
	32139: "+proj=lcc +lat_1=38.35 +lat_2=37.21666666666667 +lat_0=36.66666666666666 +lon_0=-111.5 +x_0=500000 +y_0=3000000 +datum=NAD83 +units=m +no_defs",
	32145: "+proj=tmerc +lat_0=42.5 +lon_0=-72.5 +k=0.999964286 +x_0=500000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32146: "+proj=lcc +lat_1=39.2 +lat_2=38.03333333333333 +lat_0=37.66666666666666 +lon_0=-78.5 +x_0=3500000 +y_0=2000000 +datum=NAD83 +units=m +no_defs",
	32147: "+proj=lcc +lat_1=37.96666666666667 +lat_2=36.76666666666667 +lat_0=36.33333333333334 +lon_0=-78.5 +x_0=3500000 +y_0=1000000 +datum=NAD83 +units=m +no_defs",
	32150: "+proj=lcc +lat_1=40.25 +lat_2=39 +lat_0=38.5 +lon_0=-79.5 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32151: "+proj=lcc +lat_1=38.88333333333333 +lat_2=37.48333333333333 +lat_0=37 +lon_0=-81 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32153: "+proj=lcc +lat_1=46.76666666666667 +lat_2=45.56666666666667 +lat_0=45.16666666666666 +lon_0=-90 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32154: "+proj=lcc +lat_1=45.5 +lat_2=44.25 +lat_0=43.83333333333334 +lon_0=-90 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32155: "+proj=lcc +lat_1=44.06666666666667 +lat_2=42.73333333333333 +lat_0=42 +lon_0=-90 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32158: "+proj=tmerc +lat_0=40.5 +lon_0=-105.1666666666667 +k=0.9999375 +x_0=200000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32159: "+proj=tmerc +lat_0=40.5 +lon_0=-107.3333333333333 +k=0.9999375 +x_0=400000 +y_0=100000 +datum=NAD83 +units=m +no_defs",
	32160: "+proj=tmerc +lat_0=40.5 +lon_0=-108.75 +k=0.9999375 +x_0=600000 +y_0=0 +datum=NAD83 +units=m +no_defs",
	32161: "+proj=tmerc +lat_0=40.5 +lon_0=-110.0833333333333 +k=0.9999375 +x_0=800000 +y_0=100000 +datum=NAD83 +units=m +no_defs",
	27700: "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs",
	28992: "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38720621111111 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs",
	3812: "+proj=lcc +lat_1=49.83333333333334 +lat_2=51.16666666666666 +lat_0=50.797815 +lon_0=4.359215833333333 +x_0=649328 +y_0=665262 +ellps=GRS80 +units=m +no_defs",
	2056: "+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs",
	2154: "+proj=lcc +lat_1=44 +lat_2=49 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	31466: "+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +datum=potsdam +units=m +no_defs",
	31467: "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +datum=potsdam +units=m +no_defs",
	31468: "+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=bessel +datum=potsdam +units=m +no_defs",
	31469: "+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=5500000 +y_0=0 +ellps=bessel +datum=potsdam +units=m +no_defs",
	31254: "+proj=tmerc +lat_0=0 +lon_0=10.33333333333333 +k=1 +x_0=0 +y_0=-5000000 +ellps=bessel +datum=hermannskogel +units=m +no_defs",
	31255: "+proj=tmerc +lat_0=0 +lon_0=13.33333333333333 +k=1 +x_0=0 +y_0=-5000000 +ellps=bessel +datum=hermannskogel +units=m +no_defs",
	31256: "+proj=tmerc +lat_0=0 +lon_0=16.33333333333333 +k=1 +x_0=0 +y_0=-5000000 +ellps=bessel +datum=hermannskogel +units=m +no_defs",
	3006: "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	3067: "+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	3763: "+proj=tmerc +lat_0=39.66825833333333 +lon_0=-8.133108333333334 +k=1 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	25830: "+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs",
	4612: "+proj=longlat +ellps=GRS80 +no_defs",
	6668: "+proj=longlat +ellps=GRS80 +no_defs",
	6669: "+proj=tmerc +lat_0=33 +lon_0=129.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6670: "+proj=tmerc +lat_0=33 +lon_0=131 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6671: "+proj=tmerc +lat_0=36 +lon_0=132.1666666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6672: "+proj=tmerc +lat_0=33 +lon_0=133.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6673: "+proj=tmerc +lat_0=36 +lon_0=134.3333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6674: "+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6675: "+proj=tmerc +lat_0=36 +lon_0=137.1666666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6676: "+proj=tmerc +lat_0=36 +lon_0=138.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6677: "+proj=tmerc +lat_0=36 +lon_0=139.8333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6678: "+proj=tmerc +lat_0=40 +lon_0=140.8333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6679: "+proj=tmerc +lat_0=44 +lon_0=140.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6680: "+proj=tmerc +lat_0=44 +lon_0=142.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6681: "+proj=tmerc +lat_0=44 +lon_0=144.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6682: "+proj=tmerc +lat_0=26 +lon_0=142 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6683: "+proj=tmerc +lat_0=26 +lon_0=127.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6684: "+proj=tmerc +lat_0=26 +lon_0=124 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6685: "+proj=tmerc +lat_0=26 +lon_0=131 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6686: "+proj=tmerc +lat_0=20 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6687: "+proj=tmerc +lat_0=26 +lon_0=154 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs",
	6688: "+proj=utm +zone=51 +ellps=GRS80 +units=m +no_defs",
	6689: "+proj=utm +zone=52 +ellps=GRS80 +units=m +no_defs",
	6690: "+proj=utm +zone=53 +ellps=GRS80 +units=m +no_defs",
	6691: "+proj=utm +zone=54 +ellps=GRS80 +units=m +no_defs",
	6692: "+proj=utm +zone=55 +ellps=GRS80 +units=m +no_defs",
	6693: "+proj=utm +zone=56 +ellps=GRS80 +units=m +no_defs",
	6694: "+proj=utm +zone=57 +ellps=GRS80 +units=m +no_defs",
	6695: "+proj=utm +zone=58 +ellps=GRS80 +units=m +no_defs",
	6696: "+proj=utm +zone=59 +ellps=GRS80 +units=m +no_defs",
	4283: "+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs",
	28348: "+proj=utm +zone=48 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28349: "+proj=utm +zone=49 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28350: "+proj=utm +zone=50 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28351: "+proj=utm +zone=51 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28352: "+proj=utm +zone=52 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28353: "+proj=utm +zone=53 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28354: "+proj=utm +zone=54 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28355: "+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28356: "+proj=utm +zone=56 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28357: "+proj=utm +zone=57 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	28358: "+proj=utm +zone=58 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
	7844: "+proj=longlat +ellps=GRS80 +no_defs",
	7849: "+proj=utm +zone=49 +south +ellps=GRS80 +units=m +no_defs",
	7850: "+proj=utm +zone=50 +south +ellps=GRS80 +units=m +no_defs",
	7851: "+proj=utm +zone=51 +south +ellps=GRS80 +units=m +no_defs",
	7852: "+proj=utm +zone=52 +south +ellps=GRS80 +units=m +no_defs",
	7853: "+proj=utm +zone=53 +south +ellps=GRS80 +units=m +no_defs",
	7854: "+proj=utm +zone=54 +south +ellps=GRS80 +units=m +no_defs",
	7855: "+proj=utm +zone=55 +south +ellps=GRS80 +units=m +no_defs",
	7856: "+proj=utm +zone=56 +south +ellps=GRS80 +units=m +no_defs",
	7857: "+proj=utm +zone=57 +south +ellps=GRS80 +units=m +no_defs",
	7858: "+proj=utm +zone=58 +south +ellps=GRS80 +units=m +no_defs"
};
for (let e = 1; e <= 60; e++) rs[32600 + e] = `+proj=utm +zone=${e} +datum=WGS84 +units=m +no_defs`;
for (let e = 1; e <= 60; e++) rs[32700 + e] = `+proj=utm +zone=${e} +south +datum=WGS84 +units=m +no_defs`;
for (let e = 28; e <= 38; e++) rs[25800 + e] = `+proj=utm +zone=${e} +ellps=GRS80 +units=m +no_defs`;
for (let e = 1; e <= 23; e++) rs[26900 + e] || (rs[26900 + e] = `+proj=utm +zone=${e} +ellps=GRS80 +datum=NAD83 +units=m +no_defs`);
//#endregion
//#region src/crs/projections.ts
function is(e) {
	return rs[parseInt(String(e), 10)] ?? null;
}
//#endregion
//#region src/crs/detectCrs.ts
function as(e) {
	let t = e.trim().toUpperCase();
	if (!t.startsWith("COMPD_CS")) return e;
	for (let n of [
		"PROJCS[",
		"GEOGCS[",
		"PROJCRS[",
		"GEOGCRS["
	]) {
		let r = t.indexOf(n);
		if (r < 0) continue;
		let i = 0;
		for (let t = r; t < e.length; t++) if (e[t] === "[") i++;
		else if (e[t] === "]" && (i--, i === 0)) return e.slice(r, t + 1);
	}
	return e;
}
function os(e) {
	let t = e.match(/LENGTHUNIT\s*\[\s*"[^"]*"\s*,\s*([\d.]+(?:[eE][+-]?\d+)?)/i);
	if (t) {
		let e = parseFloat(t[1]);
		if (e > 0) return e;
	}
	let n = [...e.matchAll(/\bUNIT\s*\[\s*"[^"]*"\s*,\s*([\d.]+(?:[eE][+-]?\d+)?)/gi)];
	for (let e = n.length - 1; e >= 0; e--) {
		let t = parseFloat(n[e][1]);
		if (t >= .05) return t;
	}
	return 1;
}
function ss(e) {
	let t = [...e.matchAll(/\bID\s*\[\s*"EPSG"\s*,\s*(\d+)/gi)];
	if (t.length > 0) return t[t.length - 1][1];
	let n = e.match(/AUTHORITY\s*\[\s*"EPSG"\s*,\s*"(\d+)"/i);
	return n ? n[1] : null;
}
function cs(e, t) {
	if (!e) return null;
	let n = e.trim(), r = as(n), i = r.toUpperCase();
	if (/^GEOG(?:CS|CRS)\b/.test(i) || /^GEOGRAPHICCRS\b/.test(i) || /^GEODCRS\b/.test(i)) return {
		proj: "EPSG:4326",
		projDef: null,
		zFactor: 1,
		xyFactor: 111320
	};
	let a = os(n), o = `CRS:${t.replace(/\W+/g, "_")}`;
	try {
		return no.defs(o, r), no(o, "EPSG:4326", [0, 0]), {
			proj: o,
			projDef: r,
			zFactor: a,
			xyFactor: a
		};
	} catch {}
	let s = ss(r);
	if (s) {
		let e = is(s);
		if (e) return no.defs(o, e), {
			proj: o,
			projDef: e,
			zFactor: a,
			xyFactor: a
		};
	}
	return null;
}
//#endregion
//#region src/crs/project.ts
function ls(t, n, r) {
	return (i, a, o) => {
		let s, c;
		return t ? [s, c] = t.forward([i, a]) : (s = i, c = a), e.Cartesian3.fromDegrees(s, c, o * r + n);
	};
}
//#endregion
//#region src/lod/boundingVolume.ts
function us(t, n, r, i, a = 1) {
	let [o, s, c, l] = Io(t), u = r / 2 ** o, d = i(n.x - r + (2 * s + 1) * u, n.y - r + (2 * c + 1) * u, n.z - r + (2 * l + 1) * u), f = u * a * Math.sqrt(3);
	return new e.BoundingSphere(d, f);
}
function ds(e) {
	return e.frustum.computeCullingVolume(e.positionWC, e.directionWC, e.upWC);
}
function fs(t, n) {
	return n.computeVisibility(t) !== e.Intersect.OUTSIDE;
}
//#endregion
//#region src/lod/screenSpaceError.ts
function ps(e, t, n, r) {
	let i = e.center.x - t.x, a = e.center.y - t.y, o = e.center.z - t.z, s = Math.sqrt(i * i + a * a + o * o);
	if (s <= 1e-6) return Infinity;
	let c = n / (2 * Math.tan(r / 2));
	return e.radius * c / s;
}
//#endregion
//#region src/lod/selectNodes.ts
var ms = e.Math.toRadians(60);
function hs(t) {
	return (t instanceof e.PerspectiveFrustum ? t.fovy : void 0) ?? ms;
}
var gs = class {
	constructor(e) {
		this.score = e, this.data = [];
	}
	get size() {
		return this.data.length;
	}
	push(e) {
		let t = this.data;
		t.push(e);
		let n = t.length - 1;
		for (; n > 0;) {
			let e = n - 1 >> 1;
			if (this.score(t[e]) >= this.score(t[n])) break;
			[t[e], t[n]] = [t[n], t[e]], n = e;
		}
	}
	pop() {
		let e = this.data;
		if (e.length === 0) return;
		let t = e[0], n = e.pop();
		if (e.length > 0) {
			e[0] = n;
			let t = 0, r = e.length;
			for (;;) {
				let n = 2 * t + 1, i = 2 * t + 2, a = t;
				if (n < r && this.score(e[n]) > this.score(e[a]) && (a = n), i < r && this.score(e[i]) > this.score(e[a]) && (a = i), a === t) break;
				[e[t], e[a]] = [e[a], e[t]], t = a;
			}
		}
		return t;
	}
};
function _s(e) {
	let { nodes: t, pages: n = {}, onPageNeeded: r, getSphere: i, camera: a, viewportHeight: o, sseThreshold: s, maxVisibleNodes: c, maxPoints: l = Infinity } = e, u = ds(a), d = hs(a.frustum), f = [], p = 0, m = (e) => ps(i(e), a.positionWC, o, d), h = new gs((e) => e.sse);
	for (h.push({
		key: "0-0-0-0",
		sse: Infinity
	}); h.size > 0 && f.length < c && p < l;) {
		let { key: e } = h.pop(), a = t[e];
		if (a && fs(i(e), u) && (a.pointCount > 0 && (f.push(e), p += a.pointCount), !(a.pointCount > 0 && m(e) <= s))) for (let i of Bo(e)) t[i] ? h.push({
			key: i,
			sse: m(i)
		}) : n[i] && r?.(i);
	}
	return f;
}
//#endregion
//#region src/style/classificationColors.ts
var vs = {
	2: [
		153,
		111,
		66
	],
	3: [
		90,
		156,
		68
	],
	4: [
		70,
		133,
		53
	],
	5: [
		50,
		110,
		38
	],
	6: [
		219,
		141,
		51
	],
	9: [
		59,
		121,
		191
	],
	10: [
		140,
		140,
		140
	],
	11: [
		100,
		100,
		100
	]
}, ys = [
	190,
	190,
	190
], bs = {
	rgb: 0,
	intensity: 1,
	classification: 2,
	elevation: 3
};
function xs(t) {
	let n = /* @__PURE__ */ new Int32Array(8);
	if (t === void 0) n.fill(-1);
	else for (let e of t) {
		if (!Number.isInteger(e) || e < 0 || e > 255) throw RangeError(`classificationFilter expects LAS classification codes (integers 0-255), got ${e}`);
		n[e >> 5] |= 1 << (e & 31);
	}
	return [new e.Cartesian4(n[0], n[1], n[2], n[3]), new e.Cartesian4(n[4], n[5], n[6], n[7])];
}
function Ss([e, t, n]) {
	return `vec3(${(e / 255).toFixed(4)}, ${(t / 255).toFixed(4)}, ${(n / 255).toFixed(4)})`;
}
var Cs = `
in vec3 position;
in vec4 color;
in float intensity;       // UNSIGNED_SHORT, normalized -> raw / 65535
in float classification;  // UNSIGNED_BYTE, normalized  -> code / 255
in float elevation;       // UNSIGNED_SHORT, normalized -> already 0..1 over the file's Z range

uniform float u_pixelSize;
uniform int u_colorMode;
uniform vec2 u_intensityRange;  // raw LAS units, mapped to the ramp's 0..1
uniform ivec4 u_classMask[2];   // 256-bit allow-list, one bit per classification code
uniform float u_opacity;

out vec4 v_color;

vec3 classificationColor(int c) {
${Object.entries(vs).map(([e, t]) => `  if (c == ${e}) return ${Ss(t)};`).join("\n")}
  return ${Ss(ys)};
}

vec3 elevationColor(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), t * 4.0);
  if (t < 0.50) return mix(vec3(0.0, 1.0, 1.0), vec3(0.0, 1.0, 0.0), (t - 0.25) * 4.0);
  if (t < 0.75) return mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (t - 0.50) * 4.0);
  return mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (t - 0.75) * 4.0);
}

// 256 codes packed into 8 int32 words: word = c / 32, bit = c % 32. Cesium's
// uniform layer has no unsigned-int setter (createUniform throws on uvec*),
// so the words are signed and "all allowed" is -1 rather than 0xFFFFFFFF.
bool classAllowed(int c) {
  int word = c >> 5;
  int bits = u_classMask[word >> 2][word & 3];
  return ((bits >> (c & 31)) & 1) != 0;
}

void main() {
  int c = int(classification * 255.0 + 0.5);

  if (!classAllowed(c)) {
    // Outside clip space, so the point is culled before it ever rasterizes.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_color = vec4(0.0);
    return;
  }

  vec3 rgb;
  if (u_colorMode == ${bs.intensity}) {
    float raw = intensity * 65535.0;
    float span = max(u_intensityRange.y - u_intensityRange.x, 1.0);
    rgb = vec3(clamp((raw - u_intensityRange.x) / span, 0.0, 1.0));
  } else if (u_colorMode == ${bs.classification}) {
    rgb = classificationColor(c);
  } else if (u_colorMode == ${bs.elevation}) {
    rgb = elevationColor(elevation);
  } else {
    rgb = color.rgb;
  }

  v_color = vec4(rgb, color.a * u_opacity);
  gl_PointSize = u_pixelSize;
  // position is a node-relative offset (model coordinates); the node origin
  // rides in the model matrix. Reconstruct the eye-relative position the way
  // czm_translateRelativeToEye does, but from a single Float32 offset — the
  // precision comes from the double-precision origin baked into the matrix.
  vec3 eyeRel = position - czm_encodedCameraPositionMCHigh - czm_encodedCameraPositionMCLow;
  gl_Position = czm_modelViewProjectionRelativeToEye * vec4(eyeRel, 1.0);
}`, ws = "\nin vec4 v_color;\nvoid main() {\n  out_FragColor = v_color;\n}", $ = e, Ts = class t {
	constructor(t, n, r, i) {
		this._positions = t.positions, this._origin = t.origin, this._up = e.Cartesian3.normalize(new e.Cartesian3(t.origin[0], t.origin[1], t.origin[2]), new e.Cartesian3()), this._appliedHeightOffset = 0, this._appliedOpaque = !0, this._colors = t.colors, this._intensities = t.intensities, this._classifications = t.classifications, this._elevations = t.elevations, this._pointCount = t.pointCount, this._boundingSphere = n, this._style = r, this.show = !0, this._destroyed = !1, this._cmd = null, this._va = null, this._sp = null, this._onGpuInit = i ?? null;
	}
	update(e) {
		if (!(!this.show || this._destroyed)) {
			if (this._cmd) {
				this._style.heightOffset !== this._appliedHeightOffset && (this._cmd.modelMatrix = this._modelMatrix(this._style.heightOffset), this._appliedHeightOffset = this._style.heightOffset);
				let e = this._style.opacity >= 1;
				e !== this._appliedOpaque && (this._cmd.pass = e ? $.Pass.OPAQUE : $.Pass.TRANSLUCENT, this._cmd.renderState = t._renderState(e), this._appliedOpaque = e);
			} else try {
				let t = performance.now();
				this._initGpu(e.context), this._onGpuInit?.(t, performance.now()), this._onGpuInit = null;
			} catch (e) {
				console.error("[PointCloudPrimitive] GPU initialization failed; excluding this node from rendering:", e), this._destroyed = !0;
				return;
			}
			e.commandList.push(this._cmd);
		}
	}
	static _renderState(e) {
		return e ? $.RenderState.fromCache({
			depthTest: { enabled: !0 },
			depthMask: !0
		}) : $.RenderState.fromCache({
			depthTest: { enabled: !0 },
			depthMask: !1,
			blending: $.BlendingState.ALPHA_BLEND
		});
	}
	_modelMatrix(t) {
		let n = new e.Cartesian3(this._origin[0], this._origin[1], this._origin[2]), r = e.Cartesian3.multiplyByScalar(this._up, t, new e.Cartesian3());
		return e.Matrix4.fromTranslation(e.Cartesian3.add(n, r, n));
	}
	_initGpu(n) {
		let r = (e) => $.Buffer.createVertexBuffer({
			context: n,
			typedArray: e,
			usage: $.BufferUsage.STATIC_DRAW
		}), i = null, a = null;
		try {
			i = new $.VertexArray({
				context: n,
				attributes: [
					{
						index: 0,
						vertexBuffer: r(this._positions),
						componentsPerAttribute: 3,
						componentDatatype: e.ComponentDatatype.FLOAT,
						offsetInBytes: 0,
						strideInBytes: 12
					},
					{
						index: 1,
						vertexBuffer: r(this._colors),
						componentsPerAttribute: 4,
						componentDatatype: e.ComponentDatatype.UNSIGNED_BYTE,
						normalize: !0,
						offsetInBytes: 0,
						strideInBytes: 4
					},
					{
						index: 2,
						vertexBuffer: r(this._intensities),
						componentsPerAttribute: 1,
						componentDatatype: e.ComponentDatatype.UNSIGNED_SHORT,
						normalize: !0,
						offsetInBytes: 0,
						strideInBytes: 2
					},
					{
						index: 3,
						vertexBuffer: r(this._classifications),
						componentsPerAttribute: 1,
						componentDatatype: e.ComponentDatatype.UNSIGNED_BYTE,
						normalize: !0,
						offsetInBytes: 0,
						strideInBytes: 1
					},
					{
						index: 4,
						vertexBuffer: r(this._elevations),
						componentsPerAttribute: 1,
						componentDatatype: e.ComponentDatatype.UNSIGNED_SHORT,
						normalize: !0,
						offsetInBytes: 0,
						strideInBytes: 2
					}
				]
			});
			let o = this._style;
			a = $.ShaderProgram.fromCache({
				context: n,
				vertexShaderSource: Cs,
				fragmentShaderSource: ws,
				attributeLocations: {
					position: 0,
					color: 1,
					intensity: 2,
					classification: 3,
					elevation: 4
				}
			}), this._va = i, this._sp = a;
			let s = o.opacity >= 1;
			this._cmd = new $.DrawCommand({
				vertexArray: i,
				primitiveType: e.PrimitiveType.POINTS,
				shaderProgram: a,
				renderState: t._renderState(s),
				boundingVolume: this._boundingSphere,
				count: this._pointCount,
				pass: s ? $.Pass.OPAQUE : $.Pass.TRANSLUCENT,
				modelMatrix: this._modelMatrix(this._style.heightOffset),
				uniformMap: {
					u_pixelSize: () => o.pixelSize,
					u_colorMode: () => o.colorMode,
					u_intensityRange: () => o.intensityRange,
					u_classMask: () => o.classMask,
					u_opacity: () => o.opacity
				}
			}), this._appliedHeightOffset = this._style.heightOffset, this._appliedOpaque = s;
		} catch (e) {
			try {
				i && i.destroy();
			} catch {}
			try {
				a && a.destroy();
			} catch {}
			throw this._destroyed = !0, e;
		}
		this._positions = null, this._colors = null, this._intensities = null, this._classifications = null, this._elevations = null;
	}
	get style() {
		return this._style;
	}
	isDestroyed() {
		return this._destroyed;
	}
	destroy() {
		return this._destroyed ||= (this._va && this._va.destroy(), this._sp && this._sp.destroy(), !0), e.destroyObject(this);
	}
};
//#endregion
//#region src/loader/loadNode.ts
async function Es(e, t, n, r) {
	return new Ts(e, t, n, r);
}
//#endregion
//#region src/worker/WorkerPool.ts
var Ds = class e {
	static {
		this.MAX_WORKER_REPLACEMENTS = 10;
	}
	constructor(e, t) {
		this.workerFactory = e, this.idleWorkers = [], this.queue = [], this.pending = /* @__PURE__ */ new Map(), this.nextId = 0, this.destroyed = !1, this.workerReplacementCount = 0, this.workers = [];
		for (let e = 0; e < t; e++) {
			let e = this.workerFactory();
			e.onmessage = (t) => this._handleMessage(e, t), e.onerror = (t) => this._handleError(e, t), this.workers.push(e), this.idleWorkers.push(e);
		}
	}
	get concurrency() {
		return this.workers.length;
	}
	run(e, t = [], n = 3e4) {
		if (this.destroyed) {
			let e = Promise.reject(/* @__PURE__ */ Error("WorkerPool: run() called after destroy()"));
			return e.cancel = () => {}, e;
		}
		let r, i = new Promise((i, a) => {
			r = {
				id: this.nextId++,
				message: e,
				transfer: t,
				resolve: i,
				reject: a,
				timer: setTimeout(() => this._handleTimeout(r), n)
			}, this._dispatch(r);
		});
		return i.cancel = () => this._cancel(r), i;
	}
	destroy() {
		this.destroyed = !0;
		for (let e of this.workers) e.terminate();
		for (let e of this.pending.values()) clearTimeout(e.timer), e.reject(/* @__PURE__ */ Error("WorkerPool: destroyed while task was running"));
		for (let e of this.queue) clearTimeout(e.timer), e.reject(/* @__PURE__ */ Error("WorkerPool: destroyed before task could run"));
		this.pending.clear(), this.queue.length = 0, this.idleWorkers.length = 0;
	}
	_dispatch(e) {
		let t = this.idleWorkers.pop();
		if (!t) {
			this.queue.push(e);
			return;
		}
		this.pending.set(t, e), t.postMessage({
			id: e.id,
			payload: e.message
		}, e.transfer);
	}
	_handleMessage(e, t) {
		let n = this.pending.get(e);
		if (!(!n || t.data.id !== n.id)) {
			if (this.pending.delete(e), clearTimeout(n.timer), t.data.error) {
				let e = Error(t.data.error.message);
				e.name = t.data.error.name, n.reject(e);
			} else n.resolve(t.data.result);
			this._release(e);
		}
	}
	_handleError(e, t) {
		let n = this.pending.get(e);
		this.pending.delete(e), n && (clearTimeout(n.timer), n.reject(/* @__PURE__ */ Error(`WorkerPool: worker error: ${t.message}`))), this._replaceWorker(e);
	}
	_handleTimeout(e) {
		for (let [t, n] of this.pending) if (n === e) {
			this.pending.delete(t), e.reject(/* @__PURE__ */ Error("WorkerPool: task timed out waiting for a worker response")), this._release(t);
			return;
		}
		let t = this.queue.indexOf(e);
		t !== -1 && (this.queue.splice(t, 1), e.reject(/* @__PURE__ */ Error("WorkerPool: task timed out waiting for an idle worker")));
	}
	_cancel(e) {
		let t = this.queue.indexOf(e);
		if (t !== -1) {
			this.queue.splice(t, 1), clearTimeout(e.timer);
			let n = /* @__PURE__ */ Error("WorkerPool: task cancelled before it reached a worker");
			n.name = "AbortError", e.reject(n);
			return;
		}
		for (let [t, n] of this.pending) if (n === e) {
			t.postMessage({
				id: e.id,
				cancel: !0
			});
			return;
		}
	}
	_release(e) {
		let t = this.queue.shift();
		if (!t) {
			this.idleWorkers.push(e);
			return;
		}
		this.pending.set(e, t), e.postMessage({
			id: t.id,
			payload: t.message
		}, t.transfer);
	}
	_replaceWorker(t) {
		t.terminate();
		let n = this.workers.indexOf(t);
		n !== -1 && this.workers.splice(n, 1);
		let r = this.idleWorkers.indexOf(t);
		if (r !== -1 && this.idleWorkers.splice(r, 1), this.destroyed) return;
		if (this.workerReplacementCount >= e.MAX_WORKER_REPLACEMENTS) {
			console.error("[WorkerPool] Worker replacement limit exceeded; continuing with a reduced pool.");
			return;
		}
		this.workerReplacementCount++;
		let i = this.workerFactory();
		i.onmessage = (e) => this._handleMessage(i, e), i.onerror = (e) => this._handleError(i, e), this.workers.push(i), this._release(i);
	}
}, Os = 21, ks = class {
	constructor(e, t, n) {
		this.maxNodes = e, this.onEvict = t, this.maxBytes = n, this.nodes = /* @__PURE__ */ new Map(), this.pinned = /* @__PURE__ */ new Set(), this.destroyed = !1, this.bytes = 0;
	}
	get(e) {
		let t = this.nodes.get(e);
		if (t !== void 0) return this.nodes.delete(e), this.nodes.set(e, t), t;
	}
	peek(e) {
		return this.nodes.get(e);
	}
	get size() {
		return this.nodes.size;
	}
	set(e, t) {
		if (this.destroyed) {
			this.onEvict(e, t);
			return;
		}
		let n = this.nodes.get(e);
		n !== void 0 && n !== t && this.onEvict(e, n), n !== t && (n !== void 0 && (this.bytes -= this._nodeBytes(n)), this.bytes += this._nodeBytes(t)), this.nodes.delete(e), this.nodes.set(e, t), this._evictOverBudget();
	}
	pin(e) {
		this.pinned = e;
		for (let t of e) this.get(t);
	}
	destroy() {
		if (!this.destroyed) {
			this.destroyed = !0;
			for (let [e, t] of this.nodes) this.onEvict(e, t);
			this.nodes.clear(), this.bytes = 0;
		}
	}
	_nodeBytes(e) {
		return e.pointCount * Os;
	}
	_isOverBudget() {
		return this.nodes.size > this.maxNodes || this.maxBytes !== void 0 && this.bytes > this.maxBytes;
	}
	_evictOverBudget() {
		if (this._isOverBudget()) for (let e of this.nodes.keys()) {
			if (!this._isOverBudget()) break;
			if (this.pinned.has(e)) continue;
			let t = this.nodes.get(e);
			this.nodes.delete(e), this.bytes -= this._nodeBytes(t), this.onEvict(e, t);
		}
	}
}, As = "(function(){var e=(e,t)=>()=>(t||(e((t={exports:{}}).exports,t),e=null),t.exports),t=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0})})),n=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Hierarchy=void 0,e.Hierarchy={parse:t};function t(e){return Object.entries(e).reduce((e,[t,n])=>(n===-1?e.pages[t]={}:n&&(e.nodes[t]={pointCount:n}),e),{nodes:{},pages:{}})}})),r=e((e=>{var r=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),i=e&&e.__exportStar||function(e,t){for(var n in e)n!==\"default\"&&!Object.prototype.hasOwnProperty.call(t,n)&&r(t,e,n)};Object.defineProperty(e,\"__esModule\",{value:!0}),i(t(),e),i(n(),e)})),i=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.hierarchyItemLength=e.infoLength=void 0,e.infoLength=160,e.hierarchyItemLength=32})),a=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.evlrHeaderLength=e.vlrHeaderLength=e.minHeaderLength=void 0,e.minHeaderLength=375,e.vlrHeaderLength=54,e.evlrHeaderLength=60})),o=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.getBigUint64=e.parseBigInt=void 0;function t(e){if(e>BigInt(2**53-1)||e<BigInt(-(2**53-1)))throw Error(`Cannot convert bigint to number: ${e}`);return Number(e)}e.parseBigInt=t;function n(e,t,n){if(e.getBigUint64)return e.getBigUint64(t,n);let[r,i]=n?[4,0]:[0,4],a=BigInt(e.getUint32(t+r,n)),o=BigInt(e.getUint32(t+i,n));return(a<<BigInt(32))+o}e.getBigUint64=n})),s=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.toCString=e.toDataView=e.Binary=void 0,e.Binary={toDataView:t,toCString:n};function t(e){return new DataView(e.buffer,e.byteOffset,e.length)}e.toDataView=t;function n(e){let n=t(e),r=``;for(let e=0;e<n.byteLength;++e){let t=n.getInt8(e);if(t===0)return r;r+=String.fromCharCode(t)}return r}e.toCString=n})),c=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Bounds=void 0,e.Bounds={min:t,max:n,mid:r,width:i,depth:a,height:o,cube:s,step:c,stepTo:l,intersection:u};function t(e){return[e[0],e[1],e[2]]}function n(e){return[e[3],e[4],e[5]]}function r([e,t,n,r,i,a]){return[e+(r-e)/2,t+(i-t)/2,n+(a-n)/2]}function i(e){return e[3]-e[0]}function a(e){return e[4]-e[1]}function o(e){return e[5]-e[2]}function s(e){let t=r(e),n=Math.max(i(e),a(e),o(e))/2;return[t[0]-n,t[1]-n,t[2]-n,t[0]+n,t[1]+n,t[2]+n]}function c(e,[t,n,i]){let[a,o,s,c,l,u]=e,[d,f,p]=r(e);return[t?d:a,n?f:o,i?p:s,t?c:d,n?l:f,i?u:p]}function l(e,[t,n,r,i]){for(let a=t-1;a>=0;--a)e=c(e,[n>>a&1,r>>a&1,i>>a&1]);return e}function u(e,t){return[Math.max(e[0],t[0]),Math.max(e[1],t[1]),Math.max(e[2],t[2]),Math.min(e[3],t[3]),Math.min(e[4],t[4]),Math.min(e[5],t[5])]}})),l=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Dimension=void 0,e.Dimension={Type:{int8:{type:`signed`,size:1},int16:{type:`signed`,size:2},int32:{type:`signed`,size:4},int64:{type:`signed`,size:8},uint8:{type:`unsigned`,size:1},uint16:{type:`unsigned`,size:2},uint32:{type:`unsigned`,size:4},uint64:{type:`unsigned`,size:8},float32:{type:`float`,size:4},float64:{type:`float`,size:8},float:{type:`float`,size:4},double:{type:`float`,size:8},bool:{type:`unsigned`,size:1},boolean:{type:`unsigned`,size:1}},ctype:t};function t({type:e,size:t}){switch(e){case`signed`:switch(t){case 1:return`int8`;case 2:return`int16`;case 4:return`int32`;case 8:return`int64`}case`unsigned`:switch(t){case 1:return`uint8`;case 2:return`uint16`;case 4:return`uint32`;case 8:return`uint64`}case`float`:switch(t){case 4:return`float`;case 8:return`double`}}throw Error(`Invalid dimension type/size: ${e}/${t}`)}})),u=e(((e,t)=>{var n=typeof globalThis<`u`&&globalThis||typeof self<`u`&&self||typeof global<`u`&&global,r=(function(){function e(){this.fetch=!1,this.DOMException=n.DOMException}return e.prototype=n,new e})();(function(e){(function(t){var n=e!==void 0&&e||typeof self<`u`&&self||typeof global<`u`&&global||{},r={searchParams:`URLSearchParams`in n,iterable:`Symbol`in n&&`iterator`in Symbol,blob:`FileReader`in n&&`Blob`in n&&(function(){try{return new Blob,!0}catch{return!1}})(),formData:`FormData`in n,arrayBuffer:`ArrayBuffer`in n};function i(e){return e&&DataView.prototype.isPrototypeOf(e)}if(r.arrayBuffer)var a=[`[object Int8Array]`,`[object Uint8Array]`,`[object Uint8ClampedArray]`,`[object Int16Array]`,`[object Uint16Array]`,`[object Int32Array]`,`[object Uint32Array]`,`[object Float32Array]`,`[object Float64Array]`],o=ArrayBuffer.isView||function(e){return e&&a.indexOf(Object.prototype.toString.call(e))>-1};function s(e){if(typeof e!=`string`&&(e=String(e)),/[^a-z0-9\\-#$%&'*+.^_`|~!]/i.test(e)||e===``)throw TypeError(`Invalid character in header field name: \"`+e+`\"`);return e.toLowerCase()}function c(e){return typeof e!=`string`&&(e=String(e)),e}function l(e){var t={next:function(){var t=e.shift();return{done:t===void 0,value:t}}};return r.iterable&&(t[Symbol.iterator]=function(){return t}),t}function u(e){this.map={},e instanceof u?e.forEach(function(e,t){this.append(t,e)},this):Array.isArray(e)?e.forEach(function(e){if(e.length!=2)throw TypeError(`Headers constructor: expected name/value pair to be length 2, found`+e.length);this.append(e[0],e[1])},this):e&&Object.getOwnPropertyNames(e).forEach(function(t){this.append(t,e[t])},this)}u.prototype.append=function(e,t){e=s(e),t=c(t);var n=this.map[e];this.map[e]=n?n+`, `+t:t},u.prototype.delete=function(e){delete this.map[s(e)]},u.prototype.get=function(e){return e=s(e),this.has(e)?this.map[e]:null},u.prototype.has=function(e){return this.map.hasOwnProperty(s(e))},u.prototype.set=function(e,t){this.map[s(e)]=c(t)},u.prototype.forEach=function(e,t){for(var n in this.map)this.map.hasOwnProperty(n)&&e.call(t,this.map[n],n,this)},u.prototype.keys=function(){var e=[];return this.forEach(function(t,n){e.push(n)}),l(e)},u.prototype.values=function(){var e=[];return this.forEach(function(t){e.push(t)}),l(e)},u.prototype.entries=function(){var e=[];return this.forEach(function(t,n){e.push([n,t])}),l(e)},r.iterable&&(u.prototype[Symbol.iterator]=u.prototype.entries);function d(e){if(!e._noBody){if(e.bodyUsed)return Promise.reject(TypeError(`Already read`));e.bodyUsed=!0}}function f(e){return new Promise(function(t,n){e.onload=function(){t(e.result)},e.onerror=function(){n(e.error)}})}function p(e){var t=new FileReader,n=f(t);return t.readAsArrayBuffer(e),n}function m(e){var t=new FileReader,n=f(t),r=/charset=([A-Za-z0-9_-]+)/.exec(e.type),i=r?r[1]:`utf-8`;return t.readAsText(e,i),n}function h(e){for(var t=new Uint8Array(e),n=Array(t.length),r=0;r<t.length;r++)n[r]=String.fromCharCode(t[r]);return n.join(``)}function g(e){if(e.slice)return e.slice(0);var t=new Uint8Array(e.byteLength);return t.set(new Uint8Array(e)),t.buffer}function _(){return this.bodyUsed=!1,this._initBody=function(e){this.bodyUsed=this.bodyUsed,this._bodyInit=e,e?typeof e==`string`?this._bodyText=e:r.blob&&Blob.prototype.isPrototypeOf(e)?this._bodyBlob=e:r.formData&&FormData.prototype.isPrototypeOf(e)?this._bodyFormData=e:r.searchParams&&URLSearchParams.prototype.isPrototypeOf(e)?this._bodyText=e.toString():r.arrayBuffer&&r.blob&&i(e)?(this._bodyArrayBuffer=g(e.buffer),this._bodyInit=new Blob([this._bodyArrayBuffer])):r.arrayBuffer&&(ArrayBuffer.prototype.isPrototypeOf(e)||o(e))?this._bodyArrayBuffer=g(e):this._bodyText=e=Object.prototype.toString.call(e):(this._noBody=!0,this._bodyText=``),this.headers.get(`content-type`)||(typeof e==`string`?this.headers.set(`content-type`,`text/plain;charset=UTF-8`):this._bodyBlob&&this._bodyBlob.type?this.headers.set(`content-type`,this._bodyBlob.type):r.searchParams&&URLSearchParams.prototype.isPrototypeOf(e)&&this.headers.set(`content-type`,`application/x-www-form-urlencoded;charset=UTF-8`))},r.blob&&(this.blob=function(){var e=d(this);if(e)return e;if(this._bodyBlob)return Promise.resolve(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(new Blob([this._bodyArrayBuffer]));if(this._bodyFormData)throw Error(`could not read FormData body as blob`);return Promise.resolve(new Blob([this._bodyText]))}),this.arrayBuffer=function(){if(this._bodyArrayBuffer)return d(this)||(ArrayBuffer.isView(this._bodyArrayBuffer)?Promise.resolve(this._bodyArrayBuffer.buffer.slice(this._bodyArrayBuffer.byteOffset,this._bodyArrayBuffer.byteOffset+this._bodyArrayBuffer.byteLength)):Promise.resolve(this._bodyArrayBuffer));if(r.blob)return this.blob().then(p);throw Error(`could not read as ArrayBuffer`)},this.text=function(){var e=d(this);if(e)return e;if(this._bodyBlob)return m(this._bodyBlob);if(this._bodyArrayBuffer)return Promise.resolve(h(this._bodyArrayBuffer));if(this._bodyFormData)throw Error(`could not read FormData body as text`);return Promise.resolve(this._bodyText)},r.formData&&(this.formData=function(){return this.text().then(x)}),this.json=function(){return this.text().then(JSON.parse)},this}var v=[`CONNECT`,`DELETE`,`GET`,`HEAD`,`OPTIONS`,`PATCH`,`POST`,`PUT`,`TRACE`];function y(e){var t=e.toUpperCase();return v.indexOf(t)>-1?t:e}function b(e,t){if(!(this instanceof b))throw TypeError(`Please use the \"new\" operator, this DOM object constructor cannot be called as a function.`);t||={};var r=t.body;if(e instanceof b){if(e.bodyUsed)throw TypeError(`Already read`);this.url=e.url,this.credentials=e.credentials,t.headers||(this.headers=new u(e.headers)),this.method=e.method,this.mode=e.mode,this.signal=e.signal,!r&&e._bodyInit!=null&&(r=e._bodyInit,e.bodyUsed=!0)}else this.url=String(e);if(this.credentials=t.credentials||this.credentials||`same-origin`,(t.headers||!this.headers)&&(this.headers=new u(t.headers)),this.method=y(t.method||this.method||`GET`),this.mode=t.mode||this.mode||null,this.signal=t.signal||this.signal||function(){if(`AbortController`in n)return new AbortController().signal}(),this.referrer=null,(this.method===`GET`||this.method===`HEAD`)&&r)throw TypeError(`Body not allowed for GET or HEAD requests`);if(this._initBody(r),(this.method===`GET`||this.method===`HEAD`)&&(t.cache===`no-store`||t.cache===`no-cache`)){var i=/([?&])_=[^&]*/;if(i.test(this.url))this.url=this.url.replace(i,`$1_=`+new Date().getTime());else{var a=/\\?/;this.url+=(a.test(this.url)?`&`:`?`)+`_=`+new Date().getTime()}}}b.prototype.clone=function(){return new b(this,{body:this._bodyInit})};function x(e){var t=new FormData;return e.trim().split(`&`).forEach(function(e){if(e){var n=e.split(`=`),r=n.shift().replace(/\\+/g,` `),i=n.join(`=`).replace(/\\+/g,` `);t.append(decodeURIComponent(r),decodeURIComponent(i))}}),t}function S(e){var t=new u;return e.replace(/\\r?\\n[\\t ]+/g,` `).split(`\\r`).map(function(e){return e.indexOf(`\n`)===0?e.substr(1,e.length):e}).forEach(function(e){var n=e.split(`:`),r=n.shift().trim();if(r){var i=n.join(`:`).trim();try{t.append(r,i)}catch(e){console.warn(`Response `+e.message)}}}),t}_.call(b.prototype);function C(e,t){if(!(this instanceof C))throw TypeError(`Please use the \"new\" operator, this DOM object constructor cannot be called as a function.`);if(t||={},this.type=`default`,this.status=t.status===void 0?200:t.status,this.status<200||this.status>599)throw RangeError(`Failed to construct 'Response': The status provided (0) is outside the range [200, 599].`);this.ok=this.status>=200&&this.status<300,this.statusText=t.statusText===void 0?``:``+t.statusText,this.headers=new u(t.headers),this.url=t.url||``,this._initBody(e)}_.call(C.prototype),C.prototype.clone=function(){return new C(this._bodyInit,{status:this.status,statusText:this.statusText,headers:new u(this.headers),url:this.url})},C.error=function(){var e=new C(null,{status:200,statusText:``});return e.ok=!1,e.status=0,e.type=`error`,e};var w=[301,302,303,307,308];C.redirect=function(e,t){if(w.indexOf(t)===-1)throw RangeError(`Invalid status code`);return new C(null,{status:t,headers:{location:e}})},t.DOMException=n.DOMException;try{new t.DOMException}catch{t.DOMException=function(e,t){this.message=e,this.name=t;var n=Error(e);this.stack=n.stack},t.DOMException.prototype=Object.create(Error.prototype),t.DOMException.prototype.constructor=t.DOMException}function T(e,i){return new Promise(function(a,o){var l=new b(e,i);if(l.signal&&l.signal.aborted)return o(new t.DOMException(`Aborted`,`AbortError`));var d=new XMLHttpRequest;function f(){d.abort()}d.onload=function(){var e={statusText:d.statusText,headers:S(d.getAllResponseHeaders()||``)};l.url.indexOf(`file://`)===0&&(d.status<200||d.status>599)?e.status=200:e.status=d.status,e.url=`responseURL`in d?d.responseURL:e.headers.get(`X-Request-URL`);var t=`response`in d?d.response:d.responseText;setTimeout(function(){a(new C(t,e))},0)},d.onerror=function(){setTimeout(function(){o(TypeError(`Network request failed`))},0)},d.ontimeout=function(){setTimeout(function(){o(TypeError(`Network request timed out`))},0)},d.onabort=function(){setTimeout(function(){o(new t.DOMException(`Aborted`,`AbortError`))},0)};function p(e){try{return e===``&&n.location.href?n.location.href:e}catch{return e}}if(d.open(l.method,p(l.url),!0),l.credentials===`include`?d.withCredentials=!0:l.credentials===`omit`&&(d.withCredentials=!1),`responseType`in d&&(r.blob?d.responseType=`blob`:r.arrayBuffer&&(d.responseType=`arraybuffer`)),i&&typeof i.headers==`object`&&!(i.headers instanceof u||n.Headers&&i.headers instanceof n.Headers)){var m=[];Object.getOwnPropertyNames(i.headers).forEach(function(e){m.push(s(e)),d.setRequestHeader(e,c(i.headers[e]))}),l.headers.forEach(function(e,t){m.indexOf(t)===-1&&d.setRequestHeader(t,e)})}else l.headers.forEach(function(e,t){d.setRequestHeader(t,e)});l.signal&&(l.signal.addEventListener(`abort`,f),d.onreadystatechange=function(){d.readyState===4&&l.signal.removeEventListener(`abort`,f)}),d.send(l._bodyInit===void 0?null:l._bodyInit)})}return T.polyfill=!0,n.fetch||(n.fetch=T,n.Headers=u,n.Request=b,n.Response=C),t.Headers=u,t.Request=b,t.Response=C,t.fetch=T,Object.defineProperty(t,\"__esModule\",{value:!0}),t})({})})(r),r.fetch.ponyfill=!0,delete r.fetch.polyfill;var i=n.fetch?n:r;e=i.fetch,e.default=i.fetch,e.fetch=i.fetch,e.Headers=i.Headers,e.Request=i.Request,e.Response=i.Response,t.exports=e})),d=e(((e,t)=>{t.exports={}})),f=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,\"default\",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||function(e){if(e&&e.__esModule)return e;var r={};if(e!=null)for(var i in e)i!==\"default\"&&Object.prototype.hasOwnProperty.call(e,i)&&t(r,e,i);return n(r,e),r},i=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Getter=void 0;let a=i(u());e.Getter={create:o,http:s,file:c};function o(e){return typeof e==`function`?e:e.startsWith(`http://`)||e.startsWith(`https://`)?s(e):c(e)}function s(e){return async function(t,n){if(t<0||n<0||t>n)throw Error(`Invalid range`);let r=await(await(0,a.default)(e,{headers:{Range:`bytes=${t}-${n-1}`}})).arrayBuffer();return new Uint8Array(r)}}function c(e){return async function(t,n){let i=await Promise.resolve().then(()=>r(d()));async function a(t=0,n=1/0){if(t<0||n<0||t>n)throw Error(`Invalid range`);return await i.promises.access(e),l(i.createReadStream(e,{start:t,end:n-1,autoClose:!0}))}return a(t,n)}}async function l(e){return await new Promise((t,n)=>{let r=[];e.on(`data`,e=>r.push(e)),e.on(`error`,n),e.on(`end`,()=>t(Buffer.concat(r)))})}})),p=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Key=void 0,e.Key={create:t,parse:n,toString:r,step:i,up:a,compare:o,depth:s};function t(e,t=0,r=0,i=0){return typeof e==`number`?[e,t,r,i]:n(e)}function n(e){if(typeof e!=`string`)return e;let[t,n,r,i,...a]=e.split(`-`).map(e=>parseInt(e,10)),o=[t,n,r,i];if(a.length!==0||o.some(e=>typeof e!=`number`||Number.isNaN(e)))throw Error(`Invalid key: ${e}`);return o}function r(e){return typeof e==`string`?e:e.join(`-`)}function i(t,[n,r,i]){let[a,o,s,c]=e.Key.create(t);return[a+1,o*2+n,s*2+r,c*2+i]}function a(t,n=1){let[r,i,a,o]=e.Key.create(t);return[r-n,i>>n,a>>n,o>>n]}function o(e,t){for(let n=0;n<e.length;++n){if(e[n]<t[n])return-1;if(e[n]>t[n])return 1}return 0}function s(e){return e[0]}})),m=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Scale=void 0,e.Scale={apply:(e,t=1,n=0)=>(e-n)/t,unapply:(e,t=1,n=0)=>e*t+n}})),h=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Step=void 0,e.Step={fromIndex:t,list:n};function t(e){if(e<0||e>=8)throw Error(`Invalid step index: ${e}`);return[e>>0&1?1:0,e>>1&1?1:0,e>>2&1?1:0]}function n(){return[[0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1]]}})),g=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__exportStar||function(e,n){for(var r in e)r!==\"default\"&&!Object.prototype.hasOwnProperty.call(n,r)&&t(n,e,r)};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Step=e.Scale=e.Key=e.Getter=e.Dimension=e.Bounds=e.Binary=void 0,n(o(),e);var r=s();Object.defineProperty(e,\"Binary\",{enumerable:!0,get:function(){return r.Binary}});var i=c();Object.defineProperty(e,\"Bounds\",{enumerable:!0,get:function(){return i.Bounds}});var a=l();Object.defineProperty(e,\"Dimension\",{enumerable:!0,get:function(){return a.Dimension}});var u=f();Object.defineProperty(e,\"Getter\",{enumerable:!0,get:function(){return u.Getter}});var d=p();Object.defineProperty(e,\"Key\",{enumerable:!0,get:function(){return d.Key}});var g=m();Object.defineProperty(e,\"Scale\",{enumerable:!0,get:function(){return g.Scale}});var _=h();Object.defineProperty(e,\"Step\",{enumerable:!0,get:function(){return _.Step}})})),_=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.ExtraBytes=void 0;let t=g();e.ExtraBytes={getDimension:n,parse:r,parseOne:i};function n({type:e,length:t}){switch(e){case`signed`:case`unsigned`:switch(t){case 1:case 2:case 4:case 8:return{type:e,size:t}}case`float`:switch(t){case 4:case 8:return{type:e,size:t}}}}function r(e){if(e.byteLength%192!=0)throw Error(`Invalid extra bytes VLR length: ${e.byteLength}`);let t=[];for(let n=0;n<e.byteLength;n+=192)t.push(i(e.slice(n,n+192)));return t}function i(e){if(e.byteLength!==192)throw Error(`Invalid extra bytes entry length: ${e.byteLength}`);let n=t.Binary.toDataView(e),r=t.Binary.toCString(e.slice(4,36)),i=t.Binary.toCString(e.slice(60,192)),s=n.getUint8(2),c=n.getUint8(3);if(s>=11)throw Error(`Invalid extra bytes \"type\" value: ${s}`);if(s===0)return{name:r,description:i,length:c};let l=o(c),u=a(s);if(!u)throw Error(`Failed to extract dimension type: ${s}`);let{type:d,size:f}=u;function p(e){switch(d){case`signed`:return(0,t.parseBigInt)(n.getBigInt64(e,!0));case`unsigned`:return(0,t.parseBigInt)((0,t.getBigUint64)(n,e,!0));case`float`:return n.getFloat64(e,!0)}}let m={name:r,description:i,type:d,length:f};return l.hasNodata&&(m.nodata=p(40)),l.hasMin&&(m.min=p(64)),l.hasMax&&(m.max=p(88)),l.hasScale&&(m.scale=n.getFloat64(112)),l.hasOffset&&(m.offset=n.getFloat64(136)),m}function a(e){switch(e){case 1:return t.Dimension.Type.uint8;case 2:return t.Dimension.Type.int8;case 3:return t.Dimension.Type.uint16;case 4:return t.Dimension.Type.int16;case 5:return t.Dimension.Type.uint32;case 6:return t.Dimension.Type.int32;case 7:return t.Dimension.Type.uint64;case 8:return t.Dimension.Type.int64;case 9:return t.Dimension.Type.float32;case 10:return t.Dimension.Type.float64}}function o(e){return{hasNodata:!!(e&1),hasMin:!!(e>>1&1),hasMax:!!(e>>2&1),hasScale:!!(e>>3&1),hasOffset:!!(e>>4&1)}}})),v=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Dimensions=void 0;let t=g(),n=_();e.Dimensions={create:a};let{Type:r}=t.Dimension,i={X:r.float64,Y:r.float64,Z:r.float64,Intensity:r.uint16,ReturnNumber:r.uint8,NumberOfReturns:r.uint8,ScanDirectionFlag:r.boolean,EdgeOfFlightLine:r.boolean,Classification:r.uint8,Synthetic:r.boolean,KeyPoint:r.boolean,Withheld:r.boolean,Overlap:r.boolean,ScanAngle:r.float32,UserData:r.uint8,PointSourceId:r.uint16,GpsTime:r.float64,Red:r.uint16,Green:r.uint16,Blue:r.uint16,ScannerChannel:r.uint8,Infrared:r.uint16};function a(e,t=[]){return Object.keys(e).reduce((e,r)=>{let a=i[r];if(a)return{...e,[r]:a};let o=t.find(e=>e.name===r),s=o&&n.ExtraBytes.getDimension(o);if(s)return{...e,[r]:s};throw Error(`Failed to look up LAS type: ${r}`)},{})}})),y=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Extractor=void 0;let t=g();e.Extractor={create:a};function n(e){switch(e){case 0:return 20;case 1:return 28;case 2:return 26;case 3:return 34;case 6:return 30;case 7:return 36;case 8:return 38;default:throw Error(`Unsupported point data record format: ${e}`)}}function r(e,n,{type:r,length:i}){let a=p(e);switch(r){case`signed`:switch(i){case 1:return(e,t)=>e.getInt8(a(t)+n);case 2:return(e,t)=>e.getInt16(a(t)+n,!0);case 4:return(e,t)=>e.getInt32(a(t)+n,!0);case 8:return(e,r)=>(0,t.parseBigInt)(e.getBigInt64(a(r)+n,!0))}case`unsigned`:switch(i){case 1:return(e,t)=>e.getUint8(a(t)+n);case 2:return(e,t)=>e.getUint16(a(t)+n,!0);case 4:return(e,t)=>e.getUint32(a(t)+n,!0);case 8:return(e,r)=>(0,t.parseBigInt)((0,t.getBigUint64)(e,a(r)+n,!0))}case`float`:switch(i){case 4:return(e,t)=>e.getFloat32(a(t)+n,!0);case 8:return(e,t)=>e.getFloat64(a(t)+n,!0)}}}function i(e,i){let a=n(e.pointDataRecordFormat);return i.reduce((n,i)=>{let o=a;a+=i.length;let s=r(e,o,i);if(!s)return n;let c=(e,n)=>t.Scale.unapply(s(e,n),i.scale,i.offset);return{...n,[i.name]:c}},{})}function a(e,t=[]){let n=i(e,t);return{...(()=>{let{pointDataRecordFormat:t}=e;switch(t){case 0:return o(e);case 1:return s(e);case 2:return c(e);case 3:return l(e);case 6:return u(e);case 7:return d(e);case 8:return f(e);default:throw Error(`Unsupported point data record format: ${t}`)}})(),...n}}function o(e){let{scale:n,offset:r}=e,i=p(e);function a(e,t){return e.getUint8(i(t)+14)}function o(e,t){return e.getUint8(i(t)+15)}function s(e,t){return o(e,t)&31}return{X:(e,a)=>t.Scale.unapply(e.getInt32(i(a),!0),n[0],r[0]),Y:(e,a)=>t.Scale.unapply(e.getInt32(i(a)+4,!0),n[1],r[1]),Z:(e,a)=>t.Scale.unapply(e.getInt32(i(a)+8,!0),n[2],r[2]),Intensity:(e,t)=>e.getUint16(i(t)+12,!0),ReturnNumber:(e,t)=>a(e,t)&7,NumberOfReturns:(e,t)=>(a(e,t)&56)>>3,ScanDirectionFlag:(e,t)=>(a(e,t)&64)>>6,EdgeOfFlightLine:(e,t)=>(a(e,t)&128)>>7,Classification:(e,t)=>{let n=s(e,t);return n===12?0:n},Synthetic:(e,t)=>(o(e,t)&32)>>5,KeyPoint:(e,t)=>(o(e,t)&64)>>6,Withheld:(e,t)=>(o(e,t)&128)>>7,Overlap:(e,t)=>+(s(e,t)===12),ScanAngle:(e,t)=>e.getInt8(i(t)+16),UserData:(e,t)=>e.getUint8(i(t)+17),PointSourceId:(e,t)=>e.getUint16(i(t)+18,!0)}}function s(e){let t=p(e);return{...o(e),GpsTime:(e,n)=>e.getFloat64(t(n)+20,!0)}}function c(e){let t=p(e);return{...o(e),Red:(e,n)=>e.getUint16(t(n)+20,!0),Green:(e,n)=>e.getUint16(t(n)+22,!0),Blue:(e,n)=>e.getUint16(t(n)+24,!0)}}function l(e){let t=p(e);return{...o(e),GpsTime:(e,n)=>e.getFloat64(t(n)+20,!0),Red:(e,n)=>e.getUint16(t(n)+28,!0),Green:(e,n)=>e.getUint16(t(n)+30,!0),Blue:(e,n)=>e.getUint16(t(n)+32,!0)}}function u(e){let{scale:n,offset:r}=e,i=p(e);function a(e,t){return e.getUint8(i(t)+15)}return{X:(e,a)=>t.Scale.unapply(e.getInt32(i(a),!0),n[0],r[0]),Y:(e,a)=>t.Scale.unapply(e.getInt32(i(a)+4,!0),n[1],r[1]),Z:(e,a)=>t.Scale.unapply(e.getInt32(i(a)+8,!0),n[2],r[2]),Intensity:(e,t)=>e.getUint16(i(t)+12,!0),ReturnNumber:(e,t)=>e.getUint16(i(t)+14,!0)&15,NumberOfReturns:(e,t)=>(e.getUint16(i(t)+14,!0)&240)>>4,Synthetic:(e,t)=>a(e,t)&1,KeyPoint:(e,t)=>(a(e,t)&2)>>1,Withheld:(e,t)=>(a(e,t)&4)>>2,Overlap:(e,t)=>(a(e,t)&8)>>3,ScannerChannel:(e,t)=>(a(e,t)&48)>>4,ScanDirectionFlag:(e,t)=>(a(e,t)&64)>>6,EdgeOfFlightLine:(e,t)=>(a(e,t)&128)>>7,Classification:(e,t)=>e.getUint8(i(t)+16),UserData:(e,t)=>e.getUint8(i(t)+17),ScanAngle:(e,t)=>e.getInt16(i(t)+18,!0)*.006,PointSourceId:(e,t)=>e.getUint16(i(t)+20,!0),GpsTime:(e,t)=>e.getFloat64(i(t)+22,!0)}}function d(e){let t=p(e);return{...u(e),Red:(e,n)=>e.getUint16(t(n)+30,!0),Green:(e,n)=>e.getUint16(t(n)+32,!0),Blue:(e,n)=>e.getUint16(t(n)+34,!0)}}function f(e){let t=p(e);return{...d(e),Infrared:(e,n)=>e.getUint16(t(n)+36,!0)}}function p(e){let{pointDataRecordLength:t}=e;return function(e){return e*t}}})),b=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.formatGuid=e.parsePoint=void 0;let t=g();function n(e){let n=t.Binary.toDataView(e);if(n.byteLength!==24)throw Error(`Invalid tuple buffer length: ${n.byteLength}`);return[n.getFloat64(0,!0),n.getFloat64(8,!0),n.getFloat64(16,!0)]}e.parsePoint=n;function r(e){let n=t.Binary.toDataView(e);if(n.byteLength!==16)throw Error(`Invalid GUID buffer length: ${n.byteLength}`);let r=``;for(let e=0;e<n.byteLength;e+=4){let t=n.getUint32(e,!0);r+=t.toString(16).padStart(8,`0`)}return[r.slice(0,8),r.slice(8,12),r.slice(12,16),r.slice(16,32)].join(`-`)}e.formatGuid=r})),x=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Header=void 0;let t=g(),n=a(),r=b();e.Header={parse:i};function i(e){if(e.byteLength<n.minHeaderLength)throw Error(`Invalid header: must be at least ${n.minHeaderLength} bytes`);let i=t.Binary.toDataView(e),a=t.Binary.toCString(e.slice(0,4));if(a!==`LASF`)throw Error(`Invalid file signature: ${a}`);let c=i.getUint8(24),l=i.getUint8(25);if(c!==1||l!==2&&l!==4)throw Error(`Invalid version (only 1.2 and 1.4 supported): ${c}.${l}`);let u={fileSignature:a,fileSourceId:i.getUint16(4,!0),globalEncoding:i.getUint16(6,!0),projectId:(0,r.formatGuid)(e.slice(8,24)),majorVersion:c,minorVersion:l,systemIdentifier:t.Binary.toCString(e.slice(26,58)),generatingSoftware:t.Binary.toCString(e.slice(58,90)),fileCreationDayOfYear:i.getUint16(90,!0),fileCreationYear:i.getUint16(92,!0),headerLength:i.getUint16(94,!0),pointDataOffset:i.getUint32(96,!0),vlrCount:i.getUint32(100,!0),pointDataRecordFormat:i.getUint8(104)&15,pointDataRecordLength:i.getUint16(105,!0),pointCount:i.getUint32(107,!0),pointCountByReturn:s(e.slice(111,131)),scale:(0,r.parsePoint)(e.slice(131,155)),offset:(0,r.parsePoint)(e.slice(155,179)),min:[i.getFloat64(187,!0),i.getFloat64(203,!0),i.getFloat64(219,!0)],max:[i.getFloat64(179,!0),i.getFloat64(195,!0),i.getFloat64(211,!0)],waveformDataOffset:0,evlrOffset:0,evlrCount:0};return l==2?u:{...u,pointCount:(0,t.parseBigInt)((0,t.getBigUint64)(i,247,!0)),pointCountByReturn:o(e.slice(255,375)),waveformDataOffset:(0,t.parseBigInt)((0,t.getBigUint64)(i,227,!0)),evlrOffset:(0,t.parseBigInt)((0,t.getBigUint64)(i,235,!0)),evlrCount:i.getUint32(243,!0)}}function o(e){let n=t.Binary.toDataView(e),r=[];for(let e=0;e<120;e+=8)r.push((0,t.getBigUint64)(n,e,!0));return r.map(e=>(0,t.parseBigInt)(e))}function s(e){let n=t.Binary.toDataView(e),r=[];for(let e=0;e<20;e+=4)r.push(n.getUint32(e,!0));return r}})),S=e(((e,t)=>{var n=(()=>{var e=typeof document<`u`&&document.currentScript?document.currentScript.src:void 0;return(function(t){t||={};var n=t===void 0?{}:t,r,i;n.ready=new Promise(function(e,t){r=e,i=t}),[`_main`,`___getTypeName`,`__embind_initialize_bindings`,`_fflush`,`onRuntimeInitialized`].forEach(e=>{Object.getOwnPropertyDescriptor(n.ready,e)||Object.defineProperty(n.ready,e,{get:()=>I(`You are getting `+e+` on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js`),set:()=>I(`You are setting `+e+` on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js`)})});var a=Object.assign({},n),o=[],s=`./this.program`,c=!0;if(n.ENVIRONMENT)throw Error(`Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)`);var l=``;function u(e){return n.locateFile?n.locateFile(e,l):l+e}var d;if(c){if(typeof document<`u`&&document.currentScript&&(l=document.currentScript.src),e&&(l=e),l=l.indexOf(`blob:`)===0?``:l.substr(0,l.replace(/[?#].*/,``).lastIndexOf(`/`)+1),!(typeof window==`object`||typeof importScripts==`function`))throw Error(`not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)`)}else throw Error(`environment detection error`);var f=n.print||console.log.bind(console),p=n.printErr||console.warn.bind(console);Object.assign(n,a),a=null,Kn(),n.arguments&&(o=n.arguments),m(`arguments`,`arguments_`),n.thisProgram&&(s=n.thisProgram),m(`thisProgram`,`thisProgram`),n.quit&&n.quit,m(`quit`,`quit_`),S(n.memoryInitializerPrefixURL===void 0,`Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead`),S(n.pthreadMainPrefixURL===void 0,`Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead`),S(n.cdInitializerPrefixURL===void 0,`Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead`),S(n.filePackagePrefixURL===void 0,`Module.filePackagePrefixURL option was removed, use Module.locateFile instead`),S(n.read===void 0,`Module.read option was removed (modify read_ in JS)`),S(n.readAsync===void 0,`Module.readAsync option was removed (modify readAsync in JS)`),S(n.readBinary===void 0,`Module.readBinary option was removed (modify readBinary in JS)`),S(n.setWindowTitle===void 0,`Module.setWindowTitle option was removed (modify setWindowTitle in JS)`),S(n.TOTAL_MEMORY===void 0,`Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY`),m(`read`,`read_`),m(`readAsync`,`readAsync`),m(`readBinary`,`readBinary`),m(`setWindowTitle`,`setWindowTitle`),S(!0,\"worker environment detected but not enabled at build time.  Add 'worker' to `-sENVIRONMENT` to enable.\"),S(!0,\"node environment detected but not enabled at build time.  Add 'node' to `-sENVIRONMENT` to enable.\"),S(!0,\"shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.\");function m(e,t){Object.getOwnPropertyDescriptor(n,e)||Object.defineProperty(n,e,{configurable:!0,get:function(){I(`Module.`+e+` has been replaced with plain `+t+` (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)`)}})}function h(e){Object.getOwnPropertyDescriptor(n,e)&&I(\"`Module.\"+e+\"` was supplied but `\"+e+\"` not included in INCOMING_MODULE_JS_API\")}function g(e){return e===`FS_createPath`||e===`FS_createDataFile`||e===`FS_createPreloadedFile`||e===`FS_unlink`||e===`addRunDependency`||e===`FS_createLazyFile`||e===`FS_createDevice`||e===`removeRunDependency`}function _(e){typeof globalThis<`u`&&!Object.getOwnPropertyDescriptor(globalThis,e)&&Object.defineProperty(globalThis,e,{configurable:!0,get:function(){var t=\"`\"+e+\"` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line\";g(e)&&(t+=`. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you`),je(t)}})}function v(e){Object.getOwnPropertyDescriptor(n,e)||Object.defineProperty(n,e,{configurable:!0,get:function(){var t=`'`+e+`' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)`;g(e)&&(t+=`. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you`),I(t)}})}var y;n.wasmBinary&&(y=n.wasmBinary),m(`wasmBinary`,`wasmBinary`),n.noExitRuntime,m(`noExitRuntime`,`noExitRuntime`),typeof WebAssembly!=`object`&&I(`no native wasm support detected`);var b,x=!1;function S(e,t){e||I(`Assertion failed`+(t?`: `+t:``))}var C=typeof TextDecoder<`u`?new TextDecoder(`utf8`):void 0;function w(e,t,n){for(var r=t+n,i=t;e[i]&&!(i>=r);)++i;if(i-t>16&&e.buffer&&C)return C.decode(e.subarray(t,i));for(var a=``;t<i;){var o=e[t++];if(!(o&128)){a+=String.fromCharCode(o);continue}var s=e[t++]&63;if((o&224)==192){a+=String.fromCharCode((o&31)<<6|s);continue}var c=e[t++]&63;if((o&240)==224?o=(o&15)<<12|s<<6|c:((o&248)!=240&&je(`Invalid UTF-8 leading byte 0x`+o.toString(16)+` encountered when deserializing a UTF-8 string in wasm memory to a JS string!`),o=(o&7)<<18|s<<12|c<<6|e[t++]&63),o<65536)a+=String.fromCharCode(o);else{var l=o-65536;a+=String.fromCharCode(55296|l>>10,56320|l&1023)}}return a}function T(e,t){return e?w(O,e,t):``}function ee(e,t,n,r){if(!(r>0))return 0;for(var i=n,a=n+r-1,o=0;o<e.length;++o){var s=e.charCodeAt(o);if(s>=55296&&s<=57343){var c=e.charCodeAt(++o);s=65536+((s&1023)<<10)|c&1023}if(s<=127){if(n>=a)break;t[n++]=s}else if(s<=2047){if(n+1>=a)break;t[n++]=192|s>>6,t[n++]=128|s&63}else if(s<=65535){if(n+2>=a)break;t[n++]=224|s>>12,t[n++]=128|s>>6&63,t[n++]=128|s&63}else{if(n+3>=a)break;s>1114111&&je(`Invalid Unicode code point 0x`+s.toString(16)+` encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).`),t[n++]=240|s>>18,t[n++]=128|s>>12&63,t[n++]=128|s>>6&63,t[n++]=128|s&63}}return t[n]=0,n-i}function te(e,t,n){return S(typeof n==`number`,`stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),ee(e,O,t,n)}function E(e){for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r<=127?t++:r<=2047?t+=2:r>=55296&&r<=57343?(t+=4,++n):t+=3}return t}var ne,D,O,re,ie,k,A,ae,oe;function se(e){ne=e,n.HEAP8=D=new Int8Array(e),n.HEAP16=re=new Int16Array(e),n.HEAP32=k=new Int32Array(e),n.HEAPU8=O=new Uint8Array(e),n.HEAPU16=ie=new Uint16Array(e),n.HEAPU32=A=new Uint32Array(e),n.HEAPF32=ae=new Float32Array(e),n.HEAPF64=oe=new Float64Array(e)}var ce=65536;n.TOTAL_STACK&&S(ce===n.TOTAL_STACK,`the stack size can no longer be determined at runtime`);var le=n.INITIAL_MEMORY||262144;m(`INITIAL_MEMORY`,`INITIAL_MEMORY`),S(le>=ce,`INITIAL_MEMORY should be larger than TOTAL_STACK, was `+le+`! (TOTAL_STACK=`+ce+`)`),S(typeof Int32Array<`u`&&typeof Float64Array<`u`&&Int32Array.prototype.subarray!=null&&Int32Array.prototype.set!=null,`JS engine does not provide full typed array support`),S(!n.wasmMemory,\"Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally\"),S(le==262144,`Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically`);var ue;function j(){var e=$n();S((e&3)==0),A[e>>2]=34821223,A[e+4>>2]=2310721022,A[0]=1668509029}function de(){if(!x){var e=$n(),t=A[e>>2],n=A[e+4>>2];(t!=34821223||n!=2310721022)&&I(`Stack overflow! Stack cookie has been overwritten at 0x`+e.toString(16)+`, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x`+n.toString(16)+` 0x`+t.toString(16)),A[0]!==1668509029&&I(`Runtime error: The application has corrupted its heap memory area (address zero)!`)}}(function(){var e=new Int16Array(1),t=new Int8Array(e.buffer);if(e[0]=25459,t[0]!==115||t[1]!==99)throw`Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)`})();var fe=[],pe=[],me=[],M=!1;function he(){if(n.preRun)for(typeof n.preRun==`function`&&(n.preRun=[n.preRun]);n.preRun.length;)P(n.preRun.shift());Ae(fe)}function N(){S(!M),M=!0,de(),Ae(pe)}function ge(){if(de(),n.postRun)for(typeof n.postRun==`function`&&(n.postRun=[n.postRun]);n.postRun.length;)ve(n.postRun.shift());Ae(me)}function P(e){fe.unshift(e)}function _e(e){pe.unshift(e)}function ve(e){me.unshift(e)}S(Math.imul,`This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.fround,`This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.clz32,`This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.trunc,`This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`);var ye=0,F=null,be=null,xe={};function Se(e){ye++,n.monitorRunDependencies&&n.monitorRunDependencies(ye),e?(S(!xe[e]),xe[e]=1,F===null&&typeof setInterval<`u`&&(F=setInterval(function(){if(x){clearInterval(F),F=null;return}var e=!1;for(var t in xe)e||(e=!0,p(`still waiting on run dependencies:`)),p(`dependency: `+t);e&&p(`(end of list)`)},1e4))):p(`warning: run dependency added without ID`)}function Ce(e){if(ye--,n.monitorRunDependencies&&n.monitorRunDependencies(ye),e?(S(xe[e]),delete xe[e]):p(`warning: run dependency removed without ID`),ye==0&&(F!==null&&(clearInterval(F),F=null),be)){var t=be;be=null,t()}}function I(e){n.onAbort&&n.onAbort(e),e=`Aborted(`+e+`)`,p(e),x=!0;var t=new WebAssembly.RuntimeError(e);throw i(t),t}var L={error:function(){I(`Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM`)},init:function(){L.error()},createDataFile:function(){L.error()},createPreloadedFile:function(){L.error()},createLazyFile:function(){L.error()},open:function(){L.error()},mkdev:function(){L.error()},registerDevice:function(){L.error()},analyzePath:function(){L.error()},loadFilesFromDB:function(){L.error()},ErrnoError:function(){L.error()}};n.FS_createDataFile=L.createDataFile,n.FS_createPreloadedFile=L.createPreloadedFile;var we=`data:application/octet-stream;base64,`;function Te(e){return e.startsWith(we)}function Ee(e){return e.startsWith(`file://`)}function R(e,t){return function(){var r=e,i=t;return t||(i=n.asm),S(M,\"native function `\"+r+\"` called before runtime initialization\"),i[e]||S(i[e],\"exported native function `\"+r+\"` not found\"),i[e].apply(null,arguments)}}var z=`laz-perf.wasm`;Te(z)||(z=u(z));function De(e){try{if(e==z&&y)return new Uint8Array(y);if(d)return d(e);throw`both async and sync fetching of the wasm failed`}catch(e){I(e)}}function Oe(){return!y&&c&&typeof fetch==`function`?fetch(z,{credentials:`same-origin`}).then(function(e){if(!e.ok)throw`failed to load wasm binary file at '`+z+`'`;return e.arrayBuffer()}).catch(function(){return De(z)}):Promise.resolve().then(function(){return De(z)})}function ke(){var e={env:qn,wasi_snapshot_preview1:qn};function t(e,t){n.asm=e.exports,b=n.asm.memory,S(b,`memory not found in wasm exports`),se(b.buffer),ue=n.asm.__indirect_function_table,S(ue,`table not found in wasm exports`),_e(n.asm.__wasm_call_ctors),Ce(`wasm-instantiate`)}Se(`wasm-instantiate`);var r=n;function a(e){S(n===r,`the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?`),r=null,t(e.instance)}function o(t){return Oe().then(function(t){return WebAssembly.instantiate(t,e)}).then(function(e){return e}).then(t,function(e){p(`failed to asynchronously prepare wasm: `+e),Ee(z)&&p(`warning: Loading from a file URI (`+z+`) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`),I(e)})}function s(){return!y&&typeof WebAssembly.instantiateStreaming==`function`&&!Te(z)&&typeof fetch==`function`?fetch(z,{credentials:`same-origin`}).then(function(t){return WebAssembly.instantiateStreaming(t,e).then(a,function(e){return p(`wasm streaming compile failed: `+e),p(`falling back to ArrayBuffer instantiation`),o(a)})}):o(a)}if(n.instantiateWasm)try{return n.instantiateWasm(e,t)}catch(e){return p(`Module.instantiateWasm callback failed with error: `+e),!1}return s().catch(i),{}}function Ae(e){for(;e.length>0;)e.shift()(n)}function je(e){je.shown||={},je.shown[e]||(je.shown[e]=1,p(e))}function Me(e,t){S(e.length>=0,`writeArrayToMemory array must have a length (should be an array or typed array)`),D.set(e,t)}function Ne(e){return Jn(e+24)+24}function Pe(e){this.excPtr=e,this.ptr=e-24,this.set_type=function(e){A[this.ptr+4>>2]=e},this.get_type=function(){return A[this.ptr+4>>2]},this.set_destructor=function(e){A[this.ptr+8>>2]=e},this.get_destructor=function(){return A[this.ptr+8>>2]},this.set_refcount=function(e){k[this.ptr>>2]=e},this.set_caught=function(e){e=+!!e,D[this.ptr+12>>0]=e},this.get_caught=function(){return D[this.ptr+12>>0]!=0},this.set_rethrown=function(e){e=+!!e,D[this.ptr+13>>0]=e},this.get_rethrown=function(){return D[this.ptr+13>>0]!=0},this.init=function(e,t){this.set_adjusted_ptr(0),this.set_type(e),this.set_destructor(t),this.set_refcount(0),this.set_caught(!1),this.set_rethrown(!1)},this.add_ref=function(){var e=k[this.ptr>>2];k[this.ptr>>2]=e+1},this.release_ref=function(){var e=k[this.ptr>>2];return k[this.ptr>>2]=e-1,S(e>0),e===1},this.set_adjusted_ptr=function(e){A[this.ptr+16>>2]=e},this.get_adjusted_ptr=function(){return A[this.ptr+16>>2]},this.get_exception_ptr=function(){if(er(this.get_type()))return A[this.excPtr>>2];var e=this.get_adjusted_ptr();return e===0?this.excPtr:e}}var Fe=0;function Ie(e,t,n){throw new Pe(e).init(t,n),Fe++,e+` - Exception catching is disabled, this exception cannot be caught. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.`}function Le(e,t,n,r,i){}function Re(e){switch(e){case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;default:throw TypeError(`Unknown type size: `+e)}}function ze(){for(var e=Array(256),t=0;t<256;++t)e[t]=String.fromCharCode(t);Be=e}var Be=void 0;function B(e){for(var t=``,n=e;O[n];)t+=Be[O[n++]];return t}var Ve={},He={},Ue={},We=48,Ge=57;function Ke(e){if(e===void 0)return`_unknown`;e=e.replace(/[^a-zA-Z0-9_]/g,`$`);var t=e.charCodeAt(0);return t>=We&&t<=Ge?`_`+e:e}function qe(e,t){return e=Ke(e),function(){\"use strict\";return t.apply(this,arguments)}}function Je(e,t){var n=qe(t,function(e){this.name=t,this.message=e;var n=Error(e).stack;n!==void 0&&(this.stack=this.toString()+`\n`+n.replace(/^Error(:[^\\n]*)?\\n/,``))});return n.prototype=Object.create(e.prototype),n.prototype.constructor=n,n.prototype.toString=function(){return this.message===void 0?this.name:this.name+`: `+this.message},n}var Ye=void 0;function V(e){throw new Ye(e)}var Xe=void 0;function Ze(e){throw new Xe(e)}function Qe(e,t,n){e.forEach(function(e){Ue[e]=t});function r(t){var r=n(t);r.length!==e.length&&Ze(`Mismatched type converter count`);for(var i=0;i<e.length;++i)H(e[i],r[i])}var i=Array(t.length),a=[],o=0;t.forEach((e,t)=>{He.hasOwnProperty(e)?i[t]=He[e]:(a.push(e),Ve.hasOwnProperty(e)||(Ve[e]=[]),Ve[e].push(()=>{i[t]=He[e],++o,o===a.length&&r(i)}))}),a.length===0&&r(i)}function H(e,t,n={}){if(!(`argPackAdvance`in t))throw TypeError(`registerType registeredInstance requires argPackAdvance`);var r=t.name;if(e||V(`type \"`+r+`\" must have a positive integer typeid pointer`),He.hasOwnProperty(e)){if(n.ignoreDuplicateRegistrations)return;V(`Cannot register type '`+r+`' twice`)}if(He[e]=t,delete Ue[e],Ve.hasOwnProperty(e)){var i=Ve[e];delete Ve[e],i.forEach(e=>e())}}function $e(e,t,n,r,i){var a=Re(n);t=B(t),H(e,{name:t,fromWireType:function(e){return!!e},toWireType:function(e,t){return t?r:i},argPackAdvance:8,readValueFromPointer:function(e){var r;if(n===1)r=D;else if(n===2)r=re;else if(n===4)r=k;else throw TypeError(`Unknown boolean type size: `+t);return this.fromWireType(r[e>>a])},destructorFunction:null})}function et(e){if(!(this instanceof W)||!(e instanceof W))return!1;for(var t=this.$$.ptrType.registeredClass,n=this.$$.ptr,r=e.$$.ptrType.registeredClass,i=e.$$.ptr;t.baseClass;)n=t.upcast(n),t=t.baseClass;for(;r.baseClass;)i=r.upcast(i),r=r.baseClass;return t===r&&n===i}function tt(e){return{count:e.count,deleteScheduled:e.deleteScheduled,preservePointerOnDelete:e.preservePointerOnDelete,ptr:e.ptr,ptrType:e.ptrType,smartPtr:e.smartPtr,smartPtrType:e.smartPtrType}}function nt(e){function t(e){return e.$$.ptrType.registeredClass.name}V(t(e)+` instance already deleted`)}var rt=!1;function it(e){}function at(e){e.smartPtr?e.smartPtrType.rawDestructor(e.smartPtr):e.ptrType.registeredClass.rawDestructor(e.ptr)}function U(e){--e.count.value,e.count.value===0&&at(e)}function ot(e,t,n){if(t===n)return e;if(n.baseClass===void 0)return null;var r=ot(e,t,n.baseClass);return r===null?null:n.downcast(r)}var st={};function ct(){return Object.keys(ht).length}function lt(){var e=[];for(var t in ht)ht.hasOwnProperty(t)&&e.push(ht[t]);return e}var ut=[];function dt(){for(;ut.length;){var e=ut.pop();e.$$.deleteScheduled=!1,e.delete()}}var ft=void 0;function pt(e){ft=e,ut.length&&ft&&ft(dt)}function mt(){n.getInheritedInstanceCount=ct,n.getLiveInheritedInstances=lt,n.flushPendingDeletes=dt,n.setDelayFunction=pt}var ht={};function gt(e,t){for(t===void 0&&V(`ptr should not be undefined`);e.baseClass;)t=e.upcast(t),e=e.baseClass;return t}function _t(e,t){return t=gt(e,t),ht[t]}function vt(e,t){return(!t.ptrType||!t.ptr)&&Ze(`makeClassHandle requires ptr and ptrType`),!!t.smartPtrType!=!!t.smartPtr&&Ze(`Both smartPtrType and smartPtr must be specified`),t.count={value:1},bt(Object.create(e,{$$:{value:t}}))}function yt(e){var t=this.getPointee(e);if(!t)return this.destructor(e),null;var n=_t(this.registeredClass,t);if(n!==void 0){if(n.$$.count.value===0)return n.$$.ptr=t,n.$$.smartPtr=e,n.clone();var r=n.clone();return this.destructor(e),r}function i(){return this.isSmartPointer?vt(this.registeredClass.instancePrototype,{ptrType:this.pointeeType,ptr:t,smartPtrType:this,smartPtr:e}):vt(this.registeredClass.instancePrototype,{ptrType:this,ptr:e})}var a=st[this.registeredClass.getActualType(t)];if(!a)return i.call(this);var o=this.isConst?a.constPointerType:a.pointerType,s=ot(t,this.registeredClass,o.registeredClass);return s===null?i.call(this):this.isSmartPointer?vt(o.registeredClass.instancePrototype,{ptrType:o,ptr:s,smartPtrType:this,smartPtr:e}):vt(o.registeredClass.instancePrototype,{ptrType:o,ptr:s})}function bt(e){return typeof FinalizationRegistry>`u`?(bt=e=>e,e):(rt=new FinalizationRegistry(e=>{console.warn(e.leakWarning.stack.replace(/^Error: /,``)),U(e.$$)}),bt=e=>{var t=e.$$;if(t.smartPtr){var n={$$:t},r=t.ptrType.registeredClass;n.leakWarning=Error(`Embind found a leaked C++ instance `+r.name+` <0x`+t.ptr.toString(16)+`>.\nWe'll free it automatically in this case, but this functionality is not reliable across various environments.\nMake sure to invoke .delete() manually once you're done with the instance instead.\nOriginally allocated`),`captureStackTrace`in Error&&Error.captureStackTrace(n.leakWarning,yt),rt.register(e,n,e)}return e},it=e=>rt.unregister(e),bt(e))}function xt(){if(this.$$.ptr||nt(this),this.$$.preservePointerOnDelete)return this.$$.count.value+=1,this;var e=bt(Object.create(Object.getPrototypeOf(this),{$$:{value:tt(this.$$)}}));return e.$$.count.value+=1,e.$$.deleteScheduled=!1,e}function St(){this.$$.ptr||nt(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&V(`Object already scheduled for deletion`),it(this),U(this.$$),this.$$.preservePointerOnDelete||(this.$$.smartPtr=void 0,this.$$.ptr=void 0)}function Ct(){return!this.$$.ptr}function wt(){return this.$$.ptr||nt(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&V(`Object already scheduled for deletion`),ut.push(this),ut.length===1&&ft&&ft(dt),this.$$.deleteScheduled=!0,this}function Tt(){W.prototype.isAliasOf=et,W.prototype.clone=xt,W.prototype.delete=St,W.prototype.isDeleted=Ct,W.prototype.deleteLater=wt}function W(){}function Et(e,t,n){if(e[t].overloadTable===void 0){var r=e[t];e[t]=function(){return e[t].overloadTable.hasOwnProperty(arguments.length)||V(`Function '`+n+`' called with an invalid number of arguments (`+arguments.length+`) - expects one of (`+e[t].overloadTable+`)!`),e[t].overloadTable[arguments.length].apply(this,arguments)},e[t].overloadTable=[],e[t].overloadTable[r.argCount]=r}}function Dt(e,t,r){n.hasOwnProperty(e)?((r===void 0||n[e].overloadTable!==void 0&&n[e].overloadTable[r]!==void 0)&&V(`Cannot register public name '`+e+`' twice`),Et(n,e,e),n.hasOwnProperty(r)&&V(`Cannot register multiple overloads of a function with the same number of arguments (`+r+`)!`),n[e].overloadTable[r]=t):(n[e]=t,r!==void 0&&(n[e].numArguments=r))}function Ot(e,t,n,r,i,a,o,s){this.name=e,this.constructor=t,this.instancePrototype=n,this.rawDestructor=r,this.baseClass=i,this.getActualType=a,this.upcast=o,this.downcast=s,this.pureVirtualFunctions=[]}function kt(e,t,n){for(;t!==n;)t.upcast||V(`Expected null or instance of `+n.name+`, got an instance of `+t.name),e=t.upcast(e),t=t.baseClass;return e}function At(e,t){if(t===null)return this.isReference&&V(`null is not a valid `+this.name),0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name);var n=t.$$.ptrType.registeredClass;return kt(t.$$.ptr,n,this.registeredClass)}function jt(e,t){var n;if(t===null)return this.isReference&&V(`null is not a valid `+this.name),this.isSmartPointer?(n=this.rawConstructor(),e!==null&&e.push(this.rawDestructor,n),n):0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name),!this.isConst&&t.$$.ptrType.isConst&&V(`Cannot convert argument of type `+(t.$$.smartPtrType?t.$$.smartPtrType.name:t.$$.ptrType.name)+` to parameter type `+this.name);var r=t.$$.ptrType.registeredClass;if(n=kt(t.$$.ptr,r,this.registeredClass),this.isSmartPointer)switch(t.$$.smartPtr===void 0&&V(`Passing raw pointer to smart pointer is illegal`),this.sharingPolicy){case 0:t.$$.smartPtrType===this?n=t.$$.smartPtr:V(`Cannot convert argument of type `+(t.$$.smartPtrType?t.$$.smartPtrType.name:t.$$.ptrType.name)+` to parameter type `+this.name);break;case 1:n=t.$$.smartPtr;break;case 2:if(t.$$.smartPtrType===this)n=t.$$.smartPtr;else{var i=t.clone();n=this.rawShare(n,an.toHandle(function(){i.delete()})),e!==null&&e.push(this.rawDestructor,n)}break;default:V(`Unsupporting sharing policy`)}return n}function Mt(e,t){if(t===null)return this.isReference&&V(`null is not a valid `+this.name),0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name),t.$$.ptrType.isConst&&V(`Cannot convert argument of type `+t.$$.ptrType.name+` to parameter type `+this.name);var n=t.$$.ptrType.registeredClass;return kt(t.$$.ptr,n,this.registeredClass)}function Nt(e){return this.fromWireType(k[e>>2])}function Pt(e){return this.rawGetPointee&&(e=this.rawGetPointee(e)),e}function Ft(e){this.rawDestructor&&this.rawDestructor(e)}function It(e){e!==null&&e.delete()}function Lt(){G.prototype.getPointee=Pt,G.prototype.destructor=Ft,G.prototype.argPackAdvance=8,G.prototype.readValueFromPointer=Nt,G.prototype.deleteObject=It,G.prototype.fromWireType=yt}function G(e,t,n,r,i,a,o,s,c,l,u){this.name=e,this.registeredClass=t,this.isReference=n,this.isConst=r,this.isSmartPointer=i,this.pointeeType=a,this.sharingPolicy=o,this.rawGetPointee=s,this.rawConstructor=c,this.rawShare=l,this.rawDestructor=u,!i&&t.baseClass===void 0?r?(this.toWireType=At,this.destructorFunction=null):(this.toWireType=Mt,this.destructorFunction=null):this.toWireType=jt}function Rt(e,t,r){n.hasOwnProperty(e)||Ze(`Replacing nonexistant public symbol`),n[e].overloadTable!==void 0&&r!==void 0?n[e].overloadTable[r]=t:(n[e]=t,n[e].argCount=r)}function zt(e,t,r){S(`dynCall_`+e in n,`bad function pointer type - no table for sig '`+e+`'`),r&&r.length?S(r.length===e.substring(1).replace(/j/g,`--`).length):S(e.length==1);var i=n[`dynCall_`+e];return r&&r.length?i.apply(null,[t].concat(r)):i.call(null,t)}var Bt=[];function Vt(e){var t=Bt[e];return t||(e>=Bt.length&&(Bt.length=e+1),Bt[e]=t=ue.get(e)),S(ue.get(e)==t,`JavaScript-side Wasm function table mirror is out of date!`),t}function Ht(e,t,n){return e.includes(`j`)?zt(e,t,n):(S(Vt(t),`missing table entry in dynCall: `+t),Vt(t).apply(null,n))}function Ut(e,t){S(e.includes(`j`)||e.includes(`p`),`getDynCaller should only be called with i64 sigs`);var n=[];return function(){return n.length=0,Object.assign(n,arguments),Ht(e,t,n)}}function K(e,t){e=B(e);function n(){return e.includes(`j`)?Ut(e,t):Vt(t)}var r=n();return typeof r!=`function`&&V(`unknown function pointer with signature `+e+`: `+t),r}var Wt=void 0;function Gt(e){var t=Yn(e),n=B(t);return X(t),n}function Kt(e,t){var n=[],r={};function i(e){if(!r[e]&&!He[e]){if(Ue[e]){Ue[e].forEach(i);return}n.push(e),r[e]=!0}}throw t.forEach(i),new Wt(e+`: `+n.map(Gt).join([`, `]))}function qt(e,t,n,r,i,a,o,s,c,l,u,d,f){u=B(u),a=K(i,a),s&&=K(o,s),l&&=K(c,l),f=K(d,f);var p=Ke(u);Dt(p,function(){Kt(`Cannot construct `+u+` due to unbound types`,[r])}),Qe([e,t,n],r?[r]:[],function(t){t=t[0];var n,i;r?(n=t.registeredClass,i=n.instancePrototype):i=W.prototype;var o=qe(p,function(){if(Object.getPrototypeOf(this)!==c)throw new Ye(`Use 'new' to construct `+u);if(d.constructor_body===void 0)throw new Ye(u+` has no accessible constructor`);var e=d.constructor_body[arguments.length];if(e===void 0)throw new Ye(`Tried to invoke ctor of `+u+` with invalid number of parameters (`+arguments.length+`) - expected (`+Object.keys(d.constructor_body).toString()+`) parameters instead!`);return e.apply(this,arguments)}),c=Object.create(i,{constructor:{value:o}});o.prototype=c;var d=new Ot(u,o,c,f,n,a,s,l),m=new G(u,d,!0,!1,!1),h=new G(u+`*`,d,!1,!1,!1),g=new G(u+` const*`,d,!1,!0,!1);return st[e]={pointerType:h,constPointerType:g},Rt(p,o),[m,h,g]})}function Jt(e,t){for(var n=[],r=0;r<e;r++)n.push(A[t+r*4>>2]);return n}function Yt(e){for(;e.length;){var t=e.pop();e.pop()(t)}}function Xt(e,t,n,r,i){var a=t.length;a<2&&V(`argTypes array size mismatch! Must at least get return value and 'this' types!`);for(var o=t[1]!==null&&n!==null,s=!1,c=1;c<t.length;++c)if(t[c]!==null&&t[c].destructorFunction===void 0){s=!0;break}var l=t[0].name!==`void`,u=a-2,d=Array(u),f=[],p=[];return function(){arguments.length!==u&&V(`function `+e+` called with `+arguments.length+` arguments, expected `+u+` args!`),p.length=0;var n;f.length=o?2:1,f[0]=i,o&&(n=t[1].toWireType(p,this),f[1]=n);for(var a=0;a<u;++a)d[a]=t[a+2].toWireType(p,arguments[a]),f.push(d[a]);var c=r.apply(null,f);function m(e){if(s)Yt(p);else for(var r=o?1:2;r<t.length;r++){var i=r===1?n:d[r-2];t[r].destructorFunction!==null&&t[r].destructorFunction(i)}if(l)return t[0].fromWireType(e)}return m(c)}}function Zt(e,t,n,r,i,a){S(t>0);var o=Jt(t,n);i=K(r,i),Qe([],[e],function(e){e=e[0];var n=`constructor `+e.name;if(e.registeredClass.constructor_body===void 0&&(e.registeredClass.constructor_body=[]),e.registeredClass.constructor_body[t-1]!==void 0)throw new Ye(`Cannot register multiple constructors with identical number of parameters (`+(t-1)+`) for class '`+e.name+`'! Overload resolution is currently only performed using the parameter count, not actual type info!`);return e.registeredClass.constructor_body[t-1]=()=>{Kt(`Cannot construct `+e.name+` due to unbound types`,o)},Qe([],o,function(r){return r.splice(1,0,null),e.registeredClass.constructor_body[t-1]=Xt(n,r,null,i,a),[]}),[]})}function Qt(e,t,n,r,i,a,o,s){var c=Jt(n,r);t=B(t),a=K(i,a),Qe([],[e],function(e){e=e[0];var r=e.name+`.`+t;t.startsWith(`@@`)&&(t=Symbol[t.substring(2)]),s&&e.registeredClass.pureVirtualFunctions.push(t);function i(){Kt(`Cannot call `+r+` due to unbound types`,c)}var l=e.registeredClass.instancePrototype,u=l[t];return u===void 0||u.overloadTable===void 0&&u.className!==e.name&&u.argCount===n-2?(i.argCount=n-2,i.className=e.name,l[t]=i):(Et(l,t,r),l[t].overloadTable[n-2]=i),Qe([],c,function(i){var s=Xt(r,i,e,a,o);return l[t].overloadTable===void 0?(s.argCount=n-2,l[t]=s):l[t].overloadTable[n-2]=s,[]}),[]})}var $t=[],q=[{},{value:void 0},{value:null},{value:!0},{value:!1}];function en(e){e>4&&--q[e].refcount===0&&(q[e]=void 0,$t.push(e))}function tn(){for(var e=0,t=5;t<q.length;++t)q[t]!==void 0&&++e;return e}function nn(){for(var e=5;e<q.length;++e)if(q[e]!==void 0)return q[e];return null}function rn(){n.count_emval_handles=tn,n.get_first_emval=nn}var an={toValue:e=>(e||V(`Cannot use deleted val. handle = `+e),q[e].value),toHandle:e=>{switch(e){case void 0:return 1;case null:return 2;case!0:return 3;case!1:return 4;default:var t=$t.length?$t.pop():q.length;return q[t]={refcount:1,value:e},t}}};function on(e,t){t=B(t),H(e,{name:t,fromWireType:function(e){var t=an.toValue(e);return en(e),t},toWireType:function(e,t){return an.toHandle(t)},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:null})}function J(e){if(e===null)return`null`;var t=typeof e;return t===`object`||t===`array`||t===`function`?e.toString():``+e}function sn(e,t){switch(t){case 2:return function(e){return this.fromWireType(ae[e>>2])};case 3:return function(e){return this.fromWireType(oe[e>>3])};default:throw TypeError(`Unknown float type: `+e)}}function cn(e,t,n){var r=Re(n);t=B(t),H(e,{name:t,fromWireType:function(e){return e},toWireType:function(e,t){if(typeof t!=`number`&&typeof t!=`boolean`)throw TypeError(`Cannot convert \"`+J(t)+`\" to `+this.name);return t},argPackAdvance:8,readValueFromPointer:sn(t,r),destructorFunction:null})}function ln(e,t,n){switch(t){case 0:return n?function(e){return D[e]}:function(e){return O[e]};case 1:return n?function(e){return re[e>>1]}:function(e){return ie[e>>1]};case 2:return n?function(e){return k[e>>2]}:function(e){return A[e>>2]};default:throw TypeError(`Unknown integer type: `+e)}}function un(e,t,n,r,i){t=B(t),i===-1&&(i=4294967295);var a=Re(n),o=e=>e;if(r===0){var s=32-8*n;o=e=>e<<s>>>s}var c=t.includes(`unsigned`),l=(e,n)=>{if(typeof e!=`number`&&typeof e!=`boolean`)throw TypeError(`Cannot convert \"`+J(e)+`\" to `+n);if(e<r||e>i)throw TypeError(`Passing a number \"`+J(e)+`\" from JS side to C/C++ side to an argument of type \"`+t+`\", which is outside the valid range [`+r+`, `+i+`]!`)};H(e,{name:t,fromWireType:o,toWireType:c?function(e,t){return l(t,this.name),t>>>0}:function(e,t){return l(t,this.name),t},argPackAdvance:8,readValueFromPointer:ln(t,a,r!==0),destructorFunction:null})}function dn(e,t,n){var r=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][t];function i(e){e>>=2;var t=A,n=t[e],i=t[e+1];return new r(ne,i,n)}n=B(n),H(e,{name:n,fromWireType:i,argPackAdvance:8,readValueFromPointer:i},{ignoreDuplicateRegistrations:!0})}function fn(e,t){t=B(t);var n=t===`std::string`;H(e,{name:t,fromWireType:function(e){var t=A[e>>2],r=e+4,i;if(n)for(var a=r,o=0;o<=t;++o){var s=r+o;if(o==t||O[s]==0){var c=s-a,l=T(a,c);i===void 0?i=l:(i+=`\\0`,i+=l),a=s+1}}else{for(var u=Array(t),o=0;o<t;++o)u[o]=String.fromCharCode(O[r+o]);i=u.join(``)}return X(e),i},toWireType:function(e,t){t instanceof ArrayBuffer&&(t=new Uint8Array(t));var r,i=typeof t==`string`;i||t instanceof Uint8Array||t instanceof Uint8ClampedArray||t instanceof Int8Array||V(`Cannot pass non-string to std::string`),r=n&&i?E(t):t.length;var a=Jn(4+r+1),o=a+4;if(A[a>>2]=r,n&&i)te(t,o,r+1);else if(i)for(var s=0;s<r;++s){var c=t.charCodeAt(s);c>255&&(X(o),V(`String has UTF-16 code units that do not fit in 8 bits`)),O[o+s]=c}else for(var s=0;s<r;++s)O[o+s]=t[s];return e!==null&&e.push(X,a),a},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:function(e){X(e)}})}var pn=typeof TextDecoder<`u`?new TextDecoder(`utf-16le`):void 0;function mn(e,t){S(e%2==0,`Pointer passed to UTF16ToString must be aligned to two bytes!`);for(var n=e,r=n>>1,i=r+t/2;!(r>=i)&&ie[r];)++r;if(n=r<<1,n-e>32&&pn)return pn.decode(O.subarray(e,n));for(var a=``,o=0;!(o>=t/2);++o){var s=re[e+o*2>>1];if(s==0)break;a+=String.fromCharCode(s)}return a}function hn(e,t,n){if(S(t%2==0,`Pointer passed to stringToUTF16 must be aligned to two bytes!`),S(typeof n==`number`,`stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),n===void 0&&(n=2147483647),n<2)return 0;n-=2;for(var r=t,i=n<e.length*2?n/2:e.length,a=0;a<i;++a){var o=e.charCodeAt(a);re[t>>1]=o,t+=2}return re[t>>1]=0,t-r}function Y(e){return e.length*2}function gn(e,t){S(e%4==0,`Pointer passed to UTF32ToString must be aligned to four bytes!`);for(var n=0,r=``;!(n>=t/4);){var i=k[e+n*4>>2];if(i==0)break;if(++n,i>=65536){var a=i-65536;r+=String.fromCharCode(55296|a>>10,56320|a&1023)}else r+=String.fromCharCode(i)}return r}function _n(e,t,n){if(S(t%4==0,`Pointer passed to stringToUTF32 must be aligned to four bytes!`),S(typeof n==`number`,`stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),n===void 0&&(n=2147483647),n<4)return 0;for(var r=t,i=r+n-4,a=0;a<e.length;++a){var o=e.charCodeAt(a);if(o>=55296&&o<=57343){var s=e.charCodeAt(++a);o=65536+((o&1023)<<10)|s&1023}if(k[t>>2]=o,t+=4,t+4>i)break}return k[t>>2]=0,t-r}function vn(e){for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r>=55296&&r<=57343&&++n,t+=4}return t}function yn(e,t,n){n=B(n);var r,i,a,o,s;t===2?(r=mn,i=hn,o=Y,a=()=>ie,s=1):t===4&&(r=gn,i=_n,o=vn,a=()=>A,s=2),H(e,{name:n,fromWireType:function(e){for(var n=A[e>>2],i=a(),o,c=e+4,l=0;l<=n;++l){var u=e+4+l*t;if(l==n||i[u>>s]==0){var d=u-c,f=r(c,d);o===void 0?o=f:(o+=`\\0`,o+=f),c=u+t}}return X(e),o},toWireType:function(e,r){typeof r!=`string`&&V(`Cannot pass non-string to C++ string type `+n);var a=o(r),c=Jn(4+a+t);return A[c>>2]=a>>s,i(r,c+4,a+t),e!==null&&e.push(X,c),c},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:function(e){X(e)}})}function bn(e,t){t=B(t),H(e,{isVoid:!0,name:t,argPackAdvance:0,fromWireType:function(){},toWireType:function(e,t){}})}function xn(){I(`native code called abort()`)}function Sn(e,t,n){O.copyWithin(e,t,t+n)}function Cn(){return 2147483648}function wn(e){try{return b.grow(e-ne.byteLength+65535>>>16),se(b.buffer),1}catch(t){p(`emscripten_realloc_buffer: Attempted to grow heap from `+ne.byteLength+` bytes to `+e+` bytes, but got error: `+t)}}function Tn(e){var t=O.length;e>>>=0,S(e>t);var n=Cn();if(e>n)return p(`Cannot enlarge memory, asked to go up to `+e+` bytes, but the limit is `+n+` bytes!`),!1;let r=(e,t)=>e+(t-e%t)%t;for(var i=1;i<=4;i*=2){var a=t*(1+.2/i);a=Math.min(a,e+100663296);var o=Math.min(n,r(Math.max(e,a),65536));if(wn(o))return!0}return p(`Failed to grow the heap from `+t+` bytes to `+o+` bytes, not enough memory!`),!1}var En={};function Dn(){return s||`./this.program`}function On(){if(!On.strings){var e={USER:`web_user`,LOGNAME:`web_user`,PATH:`/`,PWD:`/`,HOME:`/home/web_user`,LANG:(typeof navigator==`object`&&navigator.languages&&navigator.languages[0]||`C`).replace(`-`,`_`)+`.UTF-8`,_:Dn()};for(var t in En)En[t]===void 0?delete e[t]:e[t]=En[t];var n=[];for(var t in e)n.push(t+`=`+e[t]);On.strings=n}return On.strings}function kn(e,t,n){for(var r=0;r<e.length;++r)S(e.charCodeAt(r)===(e.charCodeAt(r)&255)),D[t++>>0]=e.charCodeAt(r);n||(D[t>>0]=0)}var An={varargs:void 0,get:function(){return S(An.varargs!=null),An.varargs+=4,k[An.varargs-4>>2]},getStr:function(e){return T(e)}};function jn(e,t){var n=0;return On().forEach(function(r,i){var a=t+n;A[e+i*4>>2]=a,kn(r,a),n+=r.length+1}),0}function Mn(e,t){var n=On();A[e>>2]=n.length;var r=0;return n.forEach(function(e){r+=e.length+1}),A[t>>2]=r,0}function Nn(e){I(`fd_close called without SYSCALLS_REQUIRE_FILESYSTEM`)}function Pn(e,t,n,r,i){return 70}var Fn=[null,[],[]];function In(e,t){var n=Fn[e];S(n),t===0||t===10?((e===1?f:p)(w(n,0)),n.length=0):n.push(t)}function Ln(e,t,n,r){for(var i=0,a=0;a<n;a++){var o=A[t>>2],s=A[t+4>>2];t+=8;for(var c=0;c<s;c++)In(e,O[o+c]);i+=s}return A[r>>2]=i,0}function Rn(e){return e%4==0&&(e%100!=0||e%400==0)}function zn(e,t){for(var n=0,r=0;r<=t;n+=e[r++]);return n}var Bn=[31,29,31,30,31,30,31,31,30,31,30,31],Vn=[31,28,31,30,31,30,31,31,30,31,30,31];function Hn(e,t){for(var n=new Date(e.getTime());t>0;){var r=Rn(n.getFullYear()),i=n.getMonth(),a=(r?Bn:Vn)[i];if(t>a-n.getDate())t-=a-n.getDate()+1,n.setDate(1),i<11?n.setMonth(i+1):(n.setMonth(0),n.setFullYear(n.getFullYear()+1));else return n.setDate(n.getDate()+t),n}return n}function Un(e,t,n){var r=n>0?n:E(e)+1,i=Array(r),a=ee(e,i,0,i.length);return t&&(i.length=a),i}function Wn(e,t,n,r){var i=k[r+40>>2],a={tm_sec:k[r>>2],tm_min:k[r+4>>2],tm_hour:k[r+8>>2],tm_mday:k[r+12>>2],tm_mon:k[r+16>>2],tm_year:k[r+20>>2],tm_wday:k[r+24>>2],tm_yday:k[r+28>>2],tm_isdst:k[r+32>>2],tm_gmtoff:k[r+36>>2],tm_zone:i?T(i):``},o=T(n),s={\"%c\":`%a %b %d %H:%M:%S %Y`,\"%D\":`%m/%d/%y`,\"%F\":`%Y-%m-%d`,\"%h\":`%b`,\"%r\":`%I:%M:%S %p`,\"%R\":`%H:%M`,\"%T\":`%H:%M:%S`,\"%x\":`%m/%d/%y`,\"%X\":`%H:%M:%S`,\"%Ec\":`%c`,\"%EC\":`%C`,\"%Ex\":`%m/%d/%y`,\"%EX\":`%H:%M:%S`,\"%Ey\":`%y`,\"%EY\":`%Y`,\"%Od\":`%d`,\"%Oe\":`%e`,\"%OH\":`%H`,\"%OI\":`%I`,\"%Om\":`%m`,\"%OM\":`%M`,\"%OS\":`%S`,\"%Ou\":`%u`,\"%OU\":`%U`,\"%OV\":`%V`,\"%Ow\":`%w`,\"%OW\":`%W`,\"%Oy\":`%y`};for(var c in s)o=o.replace(new RegExp(c,`g`),s[c]);var l=[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`],u=[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`];function d(e,t,n){for(var r=typeof e==`number`?e.toString():e||``;r.length<t;)r=n[0]+r;return r}function f(e,t){return d(e,t,`0`)}function p(e,t){function n(e){return e<0?-1:+(e>0)}var r;return(r=n(e.getFullYear()-t.getFullYear()))===0&&(r=n(e.getMonth()-t.getMonth()))===0&&(r=n(e.getDate()-t.getDate())),r}function m(e){switch(e.getDay()){case 0:return new Date(e.getFullYear()-1,11,29);case 1:return e;case 2:return new Date(e.getFullYear(),0,3);case 3:return new Date(e.getFullYear(),0,2);case 4:return new Date(e.getFullYear(),0,1);case 5:return new Date(e.getFullYear()-1,11,31);case 6:return new Date(e.getFullYear()-1,11,30)}}function h(e){var t=Hn(new Date(e.tm_year+1900,0,1),e.tm_yday),n=new Date(t.getFullYear(),0,4),r=new Date(t.getFullYear()+1,0,4),i=m(n),a=m(r);return p(i,t)<=0?p(a,t)<=0?t.getFullYear()+1:t.getFullYear():t.getFullYear()-1}var g={\"%a\":function(e){return l[e.tm_wday].substring(0,3)},\"%A\":function(e){return l[e.tm_wday]},\"%b\":function(e){return u[e.tm_mon].substring(0,3)},\"%B\":function(e){return u[e.tm_mon]},\"%C\":function(e){return f((e.tm_year+1900)/100|0,2)},\"%d\":function(e){return f(e.tm_mday,2)},\"%e\":function(e){return d(e.tm_mday,2,` `)},\"%g\":function(e){return h(e).toString().substring(2)},\"%G\":function(e){return h(e)},\"%H\":function(e){return f(e.tm_hour,2)},\"%I\":function(e){var t=e.tm_hour;return t==0?t=12:t>12&&(t-=12),f(t,2)},\"%j\":function(e){return f(e.tm_mday+zn(Rn(e.tm_year+1900)?Bn:Vn,e.tm_mon-1),3)},\"%m\":function(e){return f(e.tm_mon+1,2)},\"%M\":function(e){return f(e.tm_min,2)},\"%n\":function(){return`\n`},\"%p\":function(e){return e.tm_hour>=0&&e.tm_hour<12?`AM`:`PM`},\"%S\":function(e){return f(e.tm_sec,2)},\"%t\":function(){return`	`},\"%u\":function(e){return e.tm_wday||7},\"%U\":function(e){var t=e.tm_yday+7-e.tm_wday;return f(Math.floor(t/7),2)},\"%V\":function(e){var t=Math.floor((e.tm_yday+7-(e.tm_wday+6)%7)/7);if((e.tm_wday+371-e.tm_yday-2)%7<=2&&t++,!t){t=52;var n=(e.tm_wday+7-e.tm_yday-1)%7;(n==4||n==5&&Rn(e.tm_year%400-1))&&t++}else if(t==53){var r=(e.tm_wday+371-e.tm_yday)%7;r!=4&&(r!=3||!Rn(e.tm_year))&&(t=1)}return f(t,2)},\"%w\":function(e){return e.tm_wday},\"%W\":function(e){var t=e.tm_yday+7-(e.tm_wday+6)%7;return f(Math.floor(t/7),2)},\"%y\":function(e){return(e.tm_year+1900).toString().substring(2)},\"%Y\":function(e){return e.tm_year+1900},\"%z\":function(e){var t=e.tm_gmtoff,n=t>=0;return t=Math.abs(t)/60,t=t/60*100+t%60,(n?`+`:`-`)+String(`0000`+t).slice(-4)},\"%Z\":function(e){return e.tm_zone},\"%%\":function(){return`%`}};for(var c in o=o.replace(/%%/g,`\\0\\0`),g)o.includes(c)&&(o=o.replace(new RegExp(c,`g`),g[c](a)));o=o.replace(/\\0\\0/g,`%`);var _=Un(o,!1);return _.length>t?0:(Me(_,e),_.length-1)}function Gn(e,t,n,r){return Wn(e,t,n,r)}ze(),Ye=n.BindingError=Je(Error,`BindingError`),Xe=n.InternalError=Je(Error,`InternalError`),Tt(),mt(),Lt(),Wt=n.UnboundTypeError=Je(Error,`UnboundTypeError`),rn();function Kn(){h(`fetchSettings`)}var qn={__cxa_allocate_exception:Ne,__cxa_throw:Ie,_embind_register_bigint:Le,_embind_register_bool:$e,_embind_register_class:qt,_embind_register_class_constructor:Zt,_embind_register_class_function:Qt,_embind_register_emval:on,_embind_register_float:cn,_embind_register_integer:un,_embind_register_memory_view:dn,_embind_register_std_string:fn,_embind_register_std_wstring:yn,_embind_register_void:bn,abort:xn,emscripten_memcpy_big:Sn,emscripten_resize_heap:Tn,environ_get:jn,environ_sizes_get:Mn,fd_close:Nn,fd_seek:Pn,fd_write:Ln,strftime_l:Gn};ke(),n.___wasm_call_ctors=R(`__wasm_call_ctors`);var Jn=n._malloc=R(`malloc`),X=n._free=R(`free`),Yn=n.___getTypeName=R(`__getTypeName`);n.__embind_initialize_bindings=R(`_embind_initialize_bindings`),n.___errno_location=R(`__errno_location`),n._fflush=R(`fflush`);var Xn=n._emscripten_stack_init=function(){return(Xn=n._emscripten_stack_init=n.asm.emscripten_stack_init).apply(null,arguments)},Zn=n._emscripten_stack_get_free=function(){return(Zn=n._emscripten_stack_get_free=n.asm.emscripten_stack_get_free).apply(null,arguments)},Qn=n._emscripten_stack_get_base=function(){return(Qn=n._emscripten_stack_get_base=n.asm.emscripten_stack_get_base).apply(null,arguments)},$n=n._emscripten_stack_get_end=function(){return($n=n._emscripten_stack_get_end=n.asm.emscripten_stack_get_end).apply(null,arguments)};n.stackSave=R(`stackSave`),n.stackRestore=R(`stackRestore`),n.stackAlloc=R(`stackAlloc`);var er=n.___cxa_is_pointer_type=R(`__cxa_is_pointer_type`);n.dynCall_viijii=R(`dynCall_viijii`),n.dynCall_ji=R(`dynCall_ji`),n.dynCall_jiji=R(`dynCall_jiji`),n.dynCall_iiiiij=R(`dynCall_iiiiij`),n.dynCall_iiiiijj=R(`dynCall_iiiiijj`),n.dynCall_iiiiiijj=R(`dynCall_iiiiiijj`),`run.UTF8ArrayToString.UTF8ToString.stringToUTF8Array.stringToUTF8.lengthBytesUTF8.addOnPreRun.addOnInit.addOnPreMain.addOnExit.addOnPostRun.addRunDependency.removeRunDependency.FS_createFolder.FS_createPath.FS_createDataFile.FS_createPreloadedFile.FS_createLazyFile.FS_createLink.FS_createDevice.FS_unlink.getLEB.getFunctionTables.alignFunctionTables.registerFunctions.prettyPrint.getCompilerSetting.print.printErr.callMain.abort.keepRuntimeAlive.wasmMemory.stackAlloc.stackSave.stackRestore.getTempRet0.setTempRet0.writeStackCookie.checkStackCookie.ptrToString.zeroMemory.stringToNewUTF8.exitJS.getHeapMax.emscripten_realloc_buffer.ENV.ERRNO_CODES.ERRNO_MESSAGES.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.DNS.getHostByName.Protocols.Sockets.getRandomDevice.warnOnce.traverseStack.UNWIND_CACHE.convertPCtoSourceLocation.readAsmConstArgsArray.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.getExecutableName.listenOnce.autoResumeAudioContext.dynCallLegacy.getDynCaller.dynCall.handleException.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertI32PairToI53Checked.convertU32PairToI53.getCFunc.ccall.cwrap.uleb128Encode.sigToWasmTypes.convertJsFunctionToWasm.freeTableIndexes.functionsInTableMap.getEmptyTableSlot.updateTableMap.addFunction.removeFunction.reallyNegative.unSign.strLen.reSign.formatString.setValue.getValue.PATH.PATH_FS.intArrayFromString.intArrayToString.AsciiToString.stringToAscii.UTF16Decoder.UTF16ToString.stringToUTF16.lengthBytesUTF16.UTF32ToString.stringToUTF32.lengthBytesUTF32.allocateUTF8.allocateUTF8OnStack.writeStringToMemory.writeArrayToMemory.writeAsciiToMemory.SYSCALLS.getSocketFromFD.getSocketAddress.JSEvents.registerKeyEventCallback.specialHTMLTargets.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.currentFullscreenStrategy.restoreOldWindowedStyle.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.demangle.demangleAll.jsStackTrace.stackTrace.ExitStatus.getEnvStrings.checkWasiClock.flush_NO_FILESYSTEM.dlopenMissingError.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.uncaughtExceptionCount.exceptionLast.exceptionCaught.ExceptionInfo.exception_addRef.exception_decRef.Browser.setMainLoop.wget.FS.MEMFS.TTY.PIPEFS.SOCKFS._setNetworkCallback.tempFixedLengthArray.miniTempWebGLFloatBuffers.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.GL.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.AL.SDL_unicode.SDL_ttfContext.SDL_audio.SDL.SDL_gfx.GLUT.EGL.GLFW_Window.GLFW.GLEW.IDBStore.runAndAbortIfError.ALLOC_NORMAL.ALLOC_STACK.allocate.InternalError.BindingError.UnboundTypeError.PureVirtualError.init_embind.throwInternalError.throwBindingError.throwUnboundTypeError.ensureOverloadTable.exposePublicSymbol.replacePublicSymbol.extendError.createNamedFunction.embindRepr.registeredInstances.getBasestPointer.registerInheritedInstance.unregisterInheritedInstance.getInheritedInstance.getInheritedInstanceCount.getLiveInheritedInstances.registeredTypes.awaitingDependencies.typeDependencies.registeredPointers.registerType.whenDependentTypesAreResolved.embind_charCodes.embind_init_charCodes.readLatin1String.getTypeName.heap32VectorToArray.requireRegisteredType.getShiftFromSize.integerReadValueFromPointer.enumReadValueFromPointer.floatReadValueFromPointer.simpleReadValueFromPointer.runDestructors.new_.craftInvokerFunction.embind__requireFunction.tupleRegistrations.structRegistrations.genericPointerToWireType.constNoSmartPtrRawPointerToWireType.nonConstNoSmartPtrRawPointerToWireType.init_RegisteredPointer.RegisteredPointer.RegisteredPointer_getPointee.RegisteredPointer_destructor.RegisteredPointer_deleteObject.RegisteredPointer_fromWireType.runDestructor.releaseClassHandle.finalizationRegistry.detachFinalizer_deps.detachFinalizer.attachFinalizer.makeClassHandle.init_ClassHandle.ClassHandle.ClassHandle_isAliasOf.throwInstanceAlreadyDeleted.ClassHandle_clone.ClassHandle_delete.deletionQueue.ClassHandle_isDeleted.ClassHandle_deleteLater.flushPendingDeletes.delayFunction.setDelayFunction.RegisteredClass.shallowCopyInternalPointer.downcastPointer.upcastPointer.validateThis.char_0.char_9.makeLegalFunctionName.emval_handle_array.emval_free_list.emval_symbols.init_emval.count_emval_handles.get_first_emval.getStringOrSymbol.Emval.emval_newers.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_methodCallers.emval_addMethodCaller.emval_registeredMethods`.split(`.`).forEach(v),`ptrToString.zeroMemory.stringToNewUTF8.exitJS.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.getHostByName.getRandomDevice.traverseStack.convertPCtoSourceLocation.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.listenOnce.autoResumeAudioContext.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertU32PairToI53.reallyNegative.unSign.strLen.reSign.formatString.getSocketFromFD.getSocketAddress.registerKeyEventCallback.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.checkWasiClock.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.exception_addRef.exception_decRef.setMainLoop._setNetworkCallback.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.SDL_unicode.SDL_ttfContext.SDL_audio.GLFW_Window.runAndAbortIfError.registerInheritedInstance.unregisterInheritedInstance.requireRegisteredType.enumReadValueFromPointer.validateThis.getStringOrSymbol.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_addMethodCaller`.split(`.`).forEach(_);var tr;be=function e(){tr||Z(),tr||(be=e)};function nr(){Xn(),j()}function Z(e){if(e||=o,ye>0||(nr(),he(),ye>0))return;function t(){tr||(tr=!0,n.calledRun=!0,!x&&(N(),r(n),n.onRuntimeInitialized&&n.onRuntimeInitialized(),S(!n._main,`compiled without a main, but one is present. if you added it from JS, use Module[\"onRuntimeInitialized\"]`),ge()))}n.setStatus?(n.setStatus(`Running...`),setTimeout(function(){setTimeout(function(){n.setStatus(``)},1),t()},1)):t(),de()}if(n.preInit)for(typeof n.preInit==`function`&&(n.preInit=[n.preInit]);n.preInit.length>0;)n.preInit.pop()();return Z(),t.ready})})();typeof e==`object`&&typeof t==`object`?t.exports=n:typeof define==`function`&&define.amd?define([],function(){return n}):typeof e==`object`&&(e.createLazPerf=n)})),C=e((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,\"__esModule\",{value:!0}),e.LazPerf=e.create=e.createLazPerf=void 0;let n=t(S());e.createLazPerf=n.default,e.create=n.default,e.LazPerf={create:n.default}})),w=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.decompressFile=e.decompressChunk=e.PointData=void 0;let t=C(),n=x();e.PointData={createLazPerf:t.createLazPerf,decompressChunk:a,decompressFile:o};let r;async function i(e){return e||(r||=(0,t.createLazPerf)(),r)}async function a(e,{pointCount:t,pointDataRecordFormat:n,pointDataRecordLength:r},a){let o=await i(a),s=new Uint8Array(t*r),c=o._malloc(e.byteLength),l=o._malloc(r),u=new o.ChunkDecoder;try{o.HEAPU8.set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength),c),u.open(n,r,c);for(let e=0;e<t;++e)u.getPoint(l),s.set(new Uint8Array(o.HEAPU8.buffer,l,r),e*r)}finally{o._free(c),o._free(l),u.delete()}return s}e.decompressChunk=a;async function o(e,t){let r=await i(t),{pointCount:a,pointDataRecordLength:o}=n.Header.parse(e),s=new Uint8Array(a*o),c=r._malloc(e.byteLength),l=r._malloc(o),u=new r.LASZip;try{r.HEAPU8.set(new Uint8Array(e.buffer,e.byteOffset,e.byteLength),c),u.open(c,e.byteLength);for(let e=0;e<a;++e)u.getPoint(l),s.set(new Uint8Array(r.HEAPU8.buffer,l,o),e*o)}finally{u.delete()}return s}e.decompressFile=o})),T=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.View=void 0;let t=g(),n=v(),r=y();e.View={create:i};function i(e,i,a=[],o){let s=r.Extractor.create(i,a);if(o){let e=new Set([...o]);s=Object.entries(s).reduce((t,[n,r])=>(e.has(n)&&(t[n]=r),t),{})}let c=n.Dimensions.create(s,a),l=t.Binary.toDataView(e),u=i.pointDataRecordLength;if(l.byteLength%u!==0)throw Error(`Invalid buffer length (${l.byteLength}) for point length ${u}`);let d=l.byteLength/i.pointDataRecordLength;function f(e){let t=s[e];if(!t)throw Error(`No extractor for dimension: ${e}`);return function(e){if(e>=d)throw RangeError(`View index (${e}) out of range: ${d}`);return t(l,e)}}return{pointCount:d,dimensions:c,getter:f}}})),ee=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Vlr=void 0;let t=g(),n=a();e.Vlr={walk:s,parse:c,find:r,at:i,fetch:o};function r(e,t,n){return e.find(e=>e.userId===t&&e.recordId===n)}function i(e,t,n){let i=r(e,t,n);if(!i)throw Error(`VLR not found: ${t}/${n}`);return i}function o(e,{contentOffset:n,contentLength:r}){return r===0?new Uint8Array:t.Getter.create(e)(n,n+r)}async function s(e,n){let r=t.Getter.create(e),i=await d({get:r,startOffset:n.headerLength,count:n.vlrCount,isExtended:!1}),a=await d({get:r,startOffset:n.evlrOffset,count:n.evlrCount,isExtended:!0});return[...i,...a]}function c(e,t){return(t?u:l)(e)}function l(e){let r=t.Binary.toDataView(e);if(r.byteLength!==n.vlrHeaderLength)throw Error(`Invalid VLR header length (must be ${n.vlrHeaderLength}): ${r.byteLength}`);return{userId:t.Binary.toCString(e.slice(2,18)),recordId:r.getUint16(18,!0),contentLength:r.getUint16(20,!0),description:t.Binary.toCString(e.slice(22,54)),isExtended:!1}}function u(e){let r=t.Binary.toDataView(e);if(r.byteLength!==n.evlrHeaderLength)throw Error(`Invalid EVLR header length (must be ${n.evlrHeaderLength}): ${r.byteLength}`);return{userId:t.Binary.toCString(e.slice(2,18)),recordId:r.getUint16(18,!0),contentLength:(0,t.parseBigInt)((0,t.getBigUint64)(r,20,!0)),description:t.Binary.toCString(e.slice(28,60)),isExtended:!0}}async function d({get:e,startOffset:t,count:r,isExtended:i}){let a=[],o=t,s=i?n.evlrHeaderLength:n.vlrHeaderLength;for(let t=0;t<r;++t){let{userId:t,recordId:n,contentLength:r,description:l}=c(s?await e(o,o+s):new Uint8Array,i);a.push({userId:t,recordId:n,contentOffset:o+s,contentLength:r,description:l,isExtended:i}),o+=s+r}return a}})),te=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,\"default\",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||function(e){if(e&&e.__esModule)return e;var r={};if(e!=null)for(var i in e)i!==\"default\"&&Object.prototype.hasOwnProperty.call(e,i)&&t(r,e,i);return n(r,e),r};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Vlr=e.View=e.PointData=e.Header=e.Extractor=e.ExtraBytes=e.Dimensions=e.Constants=void 0,e.Constants=r(a());var i=v();Object.defineProperty(e,\"Dimensions\",{enumerable:!0,get:function(){return i.Dimensions}});var o=_();Object.defineProperty(e,\"ExtraBytes\",{enumerable:!0,get:function(){return o.ExtraBytes}});var s=y();Object.defineProperty(e,\"Extractor\",{enumerable:!0,get:function(){return s.Extractor}});var c=x();Object.defineProperty(e,\"Header\",{enumerable:!0,get:function(){return c.Header}});var l=w();Object.defineProperty(e,\"PointData\",{enumerable:!0,get:function(){return l.PointData}});var u=T();Object.defineProperty(e,\"View\",{enumerable:!0,get:function(){return u.View}});var d=ee();Object.defineProperty(e,\"Vlr\",{enumerable:!0,get:function(){return d.Vlr}})})),E=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Hierarchy=void 0;let t=g(),n=i();e.Hierarchy={parse:r,load:a};function r(e){let r=t.Binary.toDataView(e);if(r.byteLength%n.hierarchyItemLength!==0)throw Error(`Invalid hierarchy page length: ${r.byteLength}`);let i={},a={};for(let e=0;e<r.byteLength;e+=n.hierarchyItemLength){let n=r.getInt32(e+0,!0),o=r.getInt32(e+4,!0),s=r.getInt32(e+8,!0),c=r.getInt32(e+12,!0),l=(0,t.parseBigInt)((0,t.getBigUint64)(r,e+16,!0)),u=r.getInt32(e+24,!0),d=r.getInt32(e+28,!0),f=t.Key.toString([n,o,s,c]);if(d<-1)throw Error(`Invalid hierarchy point count at key: ${f}`);d===-1?a[f]={pageOffset:l,pageLength:u}:i[f]={pointCount:d,pointDataOffset:l,pointDataLength:u}}return{nodes:i,pages:a}}async function a(e,n){return r(await t.Getter.create(e)(n.pageOffset,n.pageOffset+n.pageLength))}})),ne=e((e=>{Object.defineProperty(e,\"__esModule\",{value:!0}),e.Info=void 0;let t=g(),n=i();e.Info={parse:r};function r(e){let r=t.Binary.toDataView(e);if(r.byteLength!==n.infoLength)throw Error(`Invalid COPC info VLR length (should be ${n.infoLength}): ${r.byteLength}`);let i=[r.getFloat64(0,!0),r.getFloat64(8,!0),r.getFloat64(16,!0)],a=r.getFloat64(24,!0);return{cube:[i[0]-a,i[1]-a,i[2]-a,i[0]+a,i[1]+a,i[2]+a],spacing:r.getFloat64(32,!0),rootHierarchyPage:{pageOffset:(0,t.parseBigInt)((0,t.getBigUint64)(r,40,!0)),pageLength:(0,t.parseBigInt)((0,t.getBigUint64)(r,48,!0))},gpsTimeRange:[r.getFloat64(56,!0),r.getFloat64(64,!0)]}}})),D=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,\"default\",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||function(e){if(e&&e.__esModule)return e;var r={};if(e!=null)for(var i in e)i!==\"default\"&&Object.prototype.hasOwnProperty.call(e,i)&&t(r,e,i);return n(r,e),r};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Copc=void 0;let i=r(te()),a=g(),o=E(),s=ne();e.Copc={create:c,loadHierarchyPage:l,loadCompressedPointDataBuffer:u,loadPointDataBuffer:d,loadPointDataView:f};async function c(e){let t=a.Getter.create(e),n=65536,r=t(0,n);async function o(e,i){return i>=n?t(e,i):(await r).slice(e,i)}let c=i.Header.parse(await o(0,i.Constants.minHeaderLength)),l=await i.Vlr.walk(o,c),u=i.Vlr.find(l,`copc`,1);if(!u)throw Error(`COPC info VLR is required`);let d=s.Info.parse(await i.Vlr.fetch(o,u)),f,p=i.Vlr.find(l,`LASF_Projection`,2112);p&&p.contentLength&&(f=a.Binary.toCString(await i.Vlr.fetch(o,p)),f===``&&(f=void 0));let m=[],h=i.Vlr.find(l,`LASF_Spec`,4);return h&&(m=i.ExtraBytes.parse(await i.Vlr.fetch(o,h))),{header:c,vlrs:l,info:d,wkt:f,eb:m}}async function l(e,t){let n=a.Getter.create(e);return o.Hierarchy.load(n,t)}async function u(e,{pointDataOffset:t,pointDataLength:n}){return a.Getter.create(e)(t,t+n)}async function d(e,{pointDataRecordFormat:t,pointDataRecordLength:n},r,a){let o=await u(e,r),{pointCount:s}=r;return i.PointData.decompressChunk(o,{pointCount:s,pointDataRecordFormat:t,pointDataRecordLength:n},a)}async function f(e,t,n,{lazPerf:r,include:a}={}){let o=await d(e,t.header,n,r);return i.View.create(o,t.header,t.eb,a)}})),O=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,\"default\",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||function(e){if(e&&e.__esModule)return e;var r={};if(e!=null)for(var i in e)i!==\"default\"&&Object.prototype.hasOwnProperty.call(e,i)&&t(r,e,i);return n(r,e),r};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Info=e.Hierarchy=e.Copc=e.Constants=void 0,e.Constants=r(i());var a=D();Object.defineProperty(e,\"Copc\",{enumerable:!0,get:function(){return a.Copc}});var o=E();Object.defineProperty(e,\"Hierarchy\",{enumerable:!0,get:function(){return o.Hierarchy}});var s=ne();Object.defineProperty(e,\"Info\",{enumerable:!0,get:function(){return s.Info}})})),re=e((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,\"default\",{enumerable:!0,value:t})}):function(e,t){e.default=t}),i=e&&e.__importStar||function(e){if(e&&e.__esModule)return e;var r={};if(e!=null)for(var i in e)i!==\"default\"&&Object.prototype.hasOwnProperty.call(e,i)&&t(r,e,i);return n(r,e),r},a=e&&e.__exportStar||function(e,n){for(var r in e)r!==\"default\"&&!Object.prototype.hasOwnProperty.call(n,r)&&t(n,e,r)};Object.defineProperty(e,\"__esModule\",{value:!0}),e.Las=e.Ept=void 0,e.Ept=i(r()),a(O(),e),e.Las=i(te()),a(g(),e)})),ie=e(((e,t)=>{var n=(()=>{var e=typeof document<`u`&&document.currentScript?document.currentScript.src:void 0;return(function(t){t||={};var n=t===void 0?{}:t,r,i;n.ready=new Promise(function(e,t){r=e,i=t}),[`_main`,`___getTypeName`,`__embind_initialize_bindings`,`_fflush`,`onRuntimeInitialized`].forEach(e=>{Object.getOwnPropertyDescriptor(n.ready,e)||Object.defineProperty(n.ready,e,{get:()=>I(`You are getting `+e+` on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js`),set:()=>I(`You are setting `+e+` on the Promise object, instead of the instance. Use .then() to get called back with the instance, see the MODULARIZE docs in src/settings.js`)})});var a=Object.assign({},n),o=[],s=`./this.program`,c=!0;if(n.ENVIRONMENT)throw Error(`Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)`);var l=``;function u(e){return n.locateFile?n.locateFile(e,l):l+e}var d;if(c){if(c?l=self.location.href:typeof document<`u`&&document.currentScript&&(l=document.currentScript.src),e&&(l=e),l=l.indexOf(`blob:`)===0?``:l.substr(0,l.replace(/[?#].*/,``).lastIndexOf(`/`)+1),!(typeof window==`object`||typeof importScripts==`function`))throw Error(`not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)`);c&&(d=e=>{var t=new XMLHttpRequest;return t.open(`GET`,e,!1),t.responseType=`arraybuffer`,t.send(null),new Uint8Array(t.response)})}else throw Error(`environment detection error`);var f=n.print||console.log.bind(console),p=n.printErr||console.warn.bind(console);Object.assign(n,a),a=null,Kn(),n.arguments&&(o=n.arguments),m(`arguments`,`arguments_`),n.thisProgram&&(s=n.thisProgram),m(`thisProgram`,`thisProgram`),n.quit&&n.quit,m(`quit`,`quit_`),S(n.memoryInitializerPrefixURL===void 0,`Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead`),S(n.pthreadMainPrefixURL===void 0,`Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead`),S(n.cdInitializerPrefixURL===void 0,`Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead`),S(n.filePackagePrefixURL===void 0,`Module.filePackagePrefixURL option was removed, use Module.locateFile instead`),S(n.read===void 0,`Module.read option was removed (modify read_ in JS)`),S(n.readAsync===void 0,`Module.readAsync option was removed (modify readAsync in JS)`),S(n.readBinary===void 0,`Module.readBinary option was removed (modify readBinary in JS)`),S(n.setWindowTitle===void 0,`Module.setWindowTitle option was removed (modify setWindowTitle in JS)`),S(n.TOTAL_MEMORY===void 0,`Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY`),m(`read`,`read_`),m(`readAsync`,`readAsync`),m(`readBinary`,`readBinary`),m(`setWindowTitle`,`setWindowTitle`),S(!0,\"web environment detected but not enabled at build time.  Add 'web' to `-sENVIRONMENT` to enable.\"),S(!0,\"node environment detected but not enabled at build time.  Add 'node' to `-sENVIRONMENT` to enable.\"),S(!0,\"shell environment detected but not enabled at build time.  Add 'shell' to `-sENVIRONMENT` to enable.\");function m(e,t){Object.getOwnPropertyDescriptor(n,e)||Object.defineProperty(n,e,{configurable:!0,get:function(){I(`Module.`+e+` has been replaced with plain `+t+` (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)`)}})}function h(e){Object.getOwnPropertyDescriptor(n,e)&&I(\"`Module.\"+e+\"` was supplied but `\"+e+\"` not included in INCOMING_MODULE_JS_API\")}function g(e){return e===`FS_createPath`||e===`FS_createDataFile`||e===`FS_createPreloadedFile`||e===`FS_unlink`||e===`addRunDependency`||e===`FS_createLazyFile`||e===`FS_createDevice`||e===`removeRunDependency`}function _(e){typeof globalThis<`u`&&!Object.getOwnPropertyDescriptor(globalThis,e)&&Object.defineProperty(globalThis,e,{configurable:!0,get:function(){var t=\"`\"+e+\"` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line\";g(e)&&(t+=`. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you`),je(t)}})}function v(e){Object.getOwnPropertyDescriptor(n,e)||Object.defineProperty(n,e,{configurable:!0,get:function(){var t=`'`+e+`' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the FAQ)`;g(e)&&(t+=`. Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you`),I(t)}})}var y;n.wasmBinary&&(y=n.wasmBinary),m(`wasmBinary`,`wasmBinary`),n.noExitRuntime,m(`noExitRuntime`,`noExitRuntime`),typeof WebAssembly!=`object`&&I(`no native wasm support detected`);var b,x=!1;function S(e,t){e||I(`Assertion failed`+(t?`: `+t:``))}var C=typeof TextDecoder<`u`?new TextDecoder(`utf8`):void 0;function w(e,t,n){for(var r=t+n,i=t;e[i]&&!(i>=r);)++i;if(i-t>16&&e.buffer&&C)return C.decode(e.subarray(t,i));for(var a=``;t<i;){var o=e[t++];if(!(o&128)){a+=String.fromCharCode(o);continue}var s=e[t++]&63;if((o&224)==192){a+=String.fromCharCode((o&31)<<6|s);continue}var c=e[t++]&63;if((o&240)==224?o=(o&15)<<12|s<<6|c:((o&248)!=240&&je(`Invalid UTF-8 leading byte 0x`+o.toString(16)+` encountered when deserializing a UTF-8 string in wasm memory to a JS string!`),o=(o&7)<<18|s<<12|c<<6|e[t++]&63),o<65536)a+=String.fromCharCode(o);else{var l=o-65536;a+=String.fromCharCode(55296|l>>10,56320|l&1023)}}return a}function T(e,t){return e?w(O,e,t):``}function ee(e,t,n,r){if(!(r>0))return 0;for(var i=n,a=n+r-1,o=0;o<e.length;++o){var s=e.charCodeAt(o);if(s>=55296&&s<=57343){var c=e.charCodeAt(++o);s=65536+((s&1023)<<10)|c&1023}if(s<=127){if(n>=a)break;t[n++]=s}else if(s<=2047){if(n+1>=a)break;t[n++]=192|s>>6,t[n++]=128|s&63}else if(s<=65535){if(n+2>=a)break;t[n++]=224|s>>12,t[n++]=128|s>>6&63,t[n++]=128|s&63}else{if(n+3>=a)break;s>1114111&&je(`Invalid Unicode code point 0x`+s.toString(16)+` encountered when serializing a JS string to a UTF-8 string in wasm memory! (Valid unicode code points should be in range 0-0x10FFFF).`),t[n++]=240|s>>18,t[n++]=128|s>>12&63,t[n++]=128|s>>6&63,t[n++]=128|s&63}}return t[n]=0,n-i}function te(e,t,n){return S(typeof n==`number`,`stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),ee(e,O,t,n)}function E(e){for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r<=127?t++:r<=2047?t+=2:r>=55296&&r<=57343?(t+=4,++n):t+=3}return t}var ne,D,O,re,ie,k,A,ae,oe;function se(e){ne=e,n.HEAP8=D=new Int8Array(e),n.HEAP16=re=new Int16Array(e),n.HEAP32=k=new Int32Array(e),n.HEAPU8=O=new Uint8Array(e),n.HEAPU16=ie=new Uint16Array(e),n.HEAPU32=A=new Uint32Array(e),n.HEAPF32=ae=new Float32Array(e),n.HEAPF64=oe=new Float64Array(e)}var ce=65536;n.TOTAL_STACK&&S(ce===n.TOTAL_STACK,`the stack size can no longer be determined at runtime`);var le=n.INITIAL_MEMORY||262144;m(`INITIAL_MEMORY`,`INITIAL_MEMORY`),S(le>=ce,`INITIAL_MEMORY should be larger than TOTAL_STACK, was `+le+`! (TOTAL_STACK=`+ce+`)`),S(typeof Int32Array<`u`&&typeof Float64Array<`u`&&Int32Array.prototype.subarray!=null&&Int32Array.prototype.set!=null,`JS engine does not provide full typed array support`),S(!n.wasmMemory,\"Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally\"),S(le==262144,`Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically`);var ue;function j(){var e=$n();S((e&3)==0),A[e>>2]=34821223,A[e+4>>2]=2310721022,A[0]=1668509029}function de(){if(!x){var e=$n(),t=A[e>>2],n=A[e+4>>2];(t!=34821223||n!=2310721022)&&I(`Stack overflow! Stack cookie has been overwritten at 0x`+e.toString(16)+`, expected hex dwords 0x89BACDFE and 0x2135467, but received 0x`+n.toString(16)+` 0x`+t.toString(16)),A[0]!==1668509029&&I(`Runtime error: The application has corrupted its heap memory area (address zero)!`)}}(function(){var e=new Int16Array(1),t=new Int8Array(e.buffer);if(e[0]=25459,t[0]!==115||t[1]!==99)throw`Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)`})();var fe=[],pe=[],me=[],M=!1;function he(){if(n.preRun)for(typeof n.preRun==`function`&&(n.preRun=[n.preRun]);n.preRun.length;)P(n.preRun.shift());Ae(fe)}function N(){S(!M),M=!0,de(),Ae(pe)}function ge(){if(de(),n.postRun)for(typeof n.postRun==`function`&&(n.postRun=[n.postRun]);n.postRun.length;)ve(n.postRun.shift());Ae(me)}function P(e){fe.unshift(e)}function _e(e){pe.unshift(e)}function ve(e){me.unshift(e)}S(Math.imul,`This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.fround,`This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.clz32,`This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`),S(Math.trunc,`This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill`);var ye=0,F=null,be=null,xe={};function Se(e){ye++,n.monitorRunDependencies&&n.monitorRunDependencies(ye),e?(S(!xe[e]),xe[e]=1,F===null&&typeof setInterval<`u`&&(F=setInterval(function(){if(x){clearInterval(F),F=null;return}var e=!1;for(var t in xe)e||(e=!0,p(`still waiting on run dependencies:`)),p(`dependency: `+t);e&&p(`(end of list)`)},1e4))):p(`warning: run dependency added without ID`)}function Ce(e){if(ye--,n.monitorRunDependencies&&n.monitorRunDependencies(ye),e?(S(xe[e]),delete xe[e]):p(`warning: run dependency removed without ID`),ye==0&&(F!==null&&(clearInterval(F),F=null),be)){var t=be;be=null,t()}}function I(e){n.onAbort&&n.onAbort(e),e=`Aborted(`+e+`)`,p(e),x=!0;var t=new WebAssembly.RuntimeError(e);throw i(t),t}var L={error:function(){I(`Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM`)},init:function(){L.error()},createDataFile:function(){L.error()},createPreloadedFile:function(){L.error()},createLazyFile:function(){L.error()},open:function(){L.error()},mkdev:function(){L.error()},registerDevice:function(){L.error()},analyzePath:function(){L.error()},loadFilesFromDB:function(){L.error()},ErrnoError:function(){L.error()}};n.FS_createDataFile=L.createDataFile,n.FS_createPreloadedFile=L.createPreloadedFile;var we=`data:application/octet-stream;base64,`;function Te(e){return e.startsWith(we)}function Ee(e){return e.startsWith(`file://`)}function R(e,t){return function(){var r=e,i=t;return t||(i=n.asm),S(M,\"native function `\"+r+\"` called before runtime initialization\"),i[e]||S(i[e],\"exported native function `\"+r+\"` not found\"),i[e].apply(null,arguments)}}var z=`laz-perf.wasm`;Te(z)||(z=u(z));function De(e){try{if(e==z&&y)return new Uint8Array(y);if(d)return d(e);throw`both async and sync fetching of the wasm failed`}catch(e){I(e)}}function Oe(){return!y&&c&&typeof fetch==`function`?fetch(z,{credentials:`same-origin`}).then(function(e){if(!e.ok)throw`failed to load wasm binary file at '`+z+`'`;return e.arrayBuffer()}).catch(function(){return De(z)}):Promise.resolve().then(function(){return De(z)})}function ke(){var e={env:qn,wasi_snapshot_preview1:qn};function t(e,t){n.asm=e.exports,b=n.asm.memory,S(b,`memory not found in wasm exports`),se(b.buffer),ue=n.asm.__indirect_function_table,S(ue,`table not found in wasm exports`),_e(n.asm.__wasm_call_ctors),Ce(`wasm-instantiate`)}Se(`wasm-instantiate`);var r=n;function a(e){S(n===r,`the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?`),r=null,t(e.instance)}function o(t){return Oe().then(function(t){return WebAssembly.instantiate(t,e)}).then(function(e){return e}).then(t,function(e){p(`failed to asynchronously prepare wasm: `+e),Ee(z)&&p(`warning: Loading from a file URI (`+z+`) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`),I(e)})}function s(){return!y&&typeof WebAssembly.instantiateStreaming==`function`&&!Te(z)&&typeof fetch==`function`?fetch(z,{credentials:`same-origin`}).then(function(t){return WebAssembly.instantiateStreaming(t,e).then(a,function(e){return p(`wasm streaming compile failed: `+e),p(`falling back to ArrayBuffer instantiation`),o(a)})}):o(a)}if(n.instantiateWasm)try{return n.instantiateWasm(e,t)}catch(e){return p(`Module.instantiateWasm callback failed with error: `+e),!1}return s().catch(i),{}}function Ae(e){for(;e.length>0;)e.shift()(n)}function je(e){je.shown||={},je.shown[e]||(je.shown[e]=1,p(e))}function Me(e,t){S(e.length>=0,`writeArrayToMemory array must have a length (should be an array or typed array)`),D.set(e,t)}function Ne(e){return Jn(e+24)+24}function Pe(e){this.excPtr=e,this.ptr=e-24,this.set_type=function(e){A[this.ptr+4>>2]=e},this.get_type=function(){return A[this.ptr+4>>2]},this.set_destructor=function(e){A[this.ptr+8>>2]=e},this.get_destructor=function(){return A[this.ptr+8>>2]},this.set_refcount=function(e){k[this.ptr>>2]=e},this.set_caught=function(e){e=+!!e,D[this.ptr+12>>0]=e},this.get_caught=function(){return D[this.ptr+12>>0]!=0},this.set_rethrown=function(e){e=+!!e,D[this.ptr+13>>0]=e},this.get_rethrown=function(){return D[this.ptr+13>>0]!=0},this.init=function(e,t){this.set_adjusted_ptr(0),this.set_type(e),this.set_destructor(t),this.set_refcount(0),this.set_caught(!1),this.set_rethrown(!1)},this.add_ref=function(){var e=k[this.ptr>>2];k[this.ptr>>2]=e+1},this.release_ref=function(){var e=k[this.ptr>>2];return k[this.ptr>>2]=e-1,S(e>0),e===1},this.set_adjusted_ptr=function(e){A[this.ptr+16>>2]=e},this.get_adjusted_ptr=function(){return A[this.ptr+16>>2]},this.get_exception_ptr=function(){if(er(this.get_type()))return A[this.excPtr>>2];var e=this.get_adjusted_ptr();return e===0?this.excPtr:e}}var Fe=0;function Ie(e,t,n){throw new Pe(e).init(t,n),Fe++,e+` - Exception catching is disabled, this exception cannot be caught. Compile with -sNO_DISABLE_EXCEPTION_CATCHING or -sEXCEPTION_CATCHING_ALLOWED=[..] to catch.`}function Le(e,t,n,r,i){}function Re(e){switch(e){case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;default:throw TypeError(`Unknown type size: `+e)}}function ze(){for(var e=Array(256),t=0;t<256;++t)e[t]=String.fromCharCode(t);Be=e}var Be=void 0;function B(e){for(var t=``,n=e;O[n];)t+=Be[O[n++]];return t}var Ve={},He={},Ue={},We=48,Ge=57;function Ke(e){if(e===void 0)return`_unknown`;e=e.replace(/[^a-zA-Z0-9_]/g,`$`);var t=e.charCodeAt(0);return t>=We&&t<=Ge?`_`+e:e}function qe(e,t){return e=Ke(e),function(){\"use strict\";return t.apply(this,arguments)}}function Je(e,t){var n=qe(t,function(e){this.name=t,this.message=e;var n=Error(e).stack;n!==void 0&&(this.stack=this.toString()+`\n`+n.replace(/^Error(:[^\\n]*)?\\n/,``))});return n.prototype=Object.create(e.prototype),n.prototype.constructor=n,n.prototype.toString=function(){return this.message===void 0?this.name:this.name+`: `+this.message},n}var Ye=void 0;function V(e){throw new Ye(e)}var Xe=void 0;function Ze(e){throw new Xe(e)}function Qe(e,t,n){e.forEach(function(e){Ue[e]=t});function r(t){var r=n(t);r.length!==e.length&&Ze(`Mismatched type converter count`);for(var i=0;i<e.length;++i)H(e[i],r[i])}var i=Array(t.length),a=[],o=0;t.forEach((e,t)=>{He.hasOwnProperty(e)?i[t]=He[e]:(a.push(e),Ve.hasOwnProperty(e)||(Ve[e]=[]),Ve[e].push(()=>{i[t]=He[e],++o,o===a.length&&r(i)}))}),a.length===0&&r(i)}function H(e,t,n={}){if(!(`argPackAdvance`in t))throw TypeError(`registerType registeredInstance requires argPackAdvance`);var r=t.name;if(e||V(`type \"`+r+`\" must have a positive integer typeid pointer`),He.hasOwnProperty(e)){if(n.ignoreDuplicateRegistrations)return;V(`Cannot register type '`+r+`' twice`)}if(He[e]=t,delete Ue[e],Ve.hasOwnProperty(e)){var i=Ve[e];delete Ve[e],i.forEach(e=>e())}}function $e(e,t,n,r,i){var a=Re(n);t=B(t),H(e,{name:t,fromWireType:function(e){return!!e},toWireType:function(e,t){return t?r:i},argPackAdvance:8,readValueFromPointer:function(e){var r;if(n===1)r=D;else if(n===2)r=re;else if(n===4)r=k;else throw TypeError(`Unknown boolean type size: `+t);return this.fromWireType(r[e>>a])},destructorFunction:null})}function et(e){if(!(this instanceof W)||!(e instanceof W))return!1;for(var t=this.$$.ptrType.registeredClass,n=this.$$.ptr,r=e.$$.ptrType.registeredClass,i=e.$$.ptr;t.baseClass;)n=t.upcast(n),t=t.baseClass;for(;r.baseClass;)i=r.upcast(i),r=r.baseClass;return t===r&&n===i}function tt(e){return{count:e.count,deleteScheduled:e.deleteScheduled,preservePointerOnDelete:e.preservePointerOnDelete,ptr:e.ptr,ptrType:e.ptrType,smartPtr:e.smartPtr,smartPtrType:e.smartPtrType}}function nt(e){function t(e){return e.$$.ptrType.registeredClass.name}V(t(e)+` instance already deleted`)}var rt=!1;function it(e){}function at(e){e.smartPtr?e.smartPtrType.rawDestructor(e.smartPtr):e.ptrType.registeredClass.rawDestructor(e.ptr)}function U(e){--e.count.value,e.count.value===0&&at(e)}function ot(e,t,n){if(t===n)return e;if(n.baseClass===void 0)return null;var r=ot(e,t,n.baseClass);return r===null?null:n.downcast(r)}var st={};function ct(){return Object.keys(ht).length}function lt(){var e=[];for(var t in ht)ht.hasOwnProperty(t)&&e.push(ht[t]);return e}var ut=[];function dt(){for(;ut.length;){var e=ut.pop();e.$$.deleteScheduled=!1,e.delete()}}var ft=void 0;function pt(e){ft=e,ut.length&&ft&&ft(dt)}function mt(){n.getInheritedInstanceCount=ct,n.getLiveInheritedInstances=lt,n.flushPendingDeletes=dt,n.setDelayFunction=pt}var ht={};function gt(e,t){for(t===void 0&&V(`ptr should not be undefined`);e.baseClass;)t=e.upcast(t),e=e.baseClass;return t}function _t(e,t){return t=gt(e,t),ht[t]}function vt(e,t){return(!t.ptrType||!t.ptr)&&Ze(`makeClassHandle requires ptr and ptrType`),!!t.smartPtrType!=!!t.smartPtr&&Ze(`Both smartPtrType and smartPtr must be specified`),t.count={value:1},bt(Object.create(e,{$$:{value:t}}))}function yt(e){var t=this.getPointee(e);if(!t)return this.destructor(e),null;var n=_t(this.registeredClass,t);if(n!==void 0){if(n.$$.count.value===0)return n.$$.ptr=t,n.$$.smartPtr=e,n.clone();var r=n.clone();return this.destructor(e),r}function i(){return this.isSmartPointer?vt(this.registeredClass.instancePrototype,{ptrType:this.pointeeType,ptr:t,smartPtrType:this,smartPtr:e}):vt(this.registeredClass.instancePrototype,{ptrType:this,ptr:e})}var a=st[this.registeredClass.getActualType(t)];if(!a)return i.call(this);var o=this.isConst?a.constPointerType:a.pointerType,s=ot(t,this.registeredClass,o.registeredClass);return s===null?i.call(this):this.isSmartPointer?vt(o.registeredClass.instancePrototype,{ptrType:o,ptr:s,smartPtrType:this,smartPtr:e}):vt(o.registeredClass.instancePrototype,{ptrType:o,ptr:s})}function bt(e){return typeof FinalizationRegistry>`u`?(bt=e=>e,e):(rt=new FinalizationRegistry(e=>{console.warn(e.leakWarning.stack.replace(/^Error: /,``)),U(e.$$)}),bt=e=>{var t=e.$$;if(t.smartPtr){var n={$$:t},r=t.ptrType.registeredClass;n.leakWarning=Error(`Embind found a leaked C++ instance `+r.name+` <0x`+t.ptr.toString(16)+`>.\nWe'll free it automatically in this case, but this functionality is not reliable across various environments.\nMake sure to invoke .delete() manually once you're done with the instance instead.\nOriginally allocated`),`captureStackTrace`in Error&&Error.captureStackTrace(n.leakWarning,yt),rt.register(e,n,e)}return e},it=e=>rt.unregister(e),bt(e))}function xt(){if(this.$$.ptr||nt(this),this.$$.preservePointerOnDelete)return this.$$.count.value+=1,this;var e=bt(Object.create(Object.getPrototypeOf(this),{$$:{value:tt(this.$$)}}));return e.$$.count.value+=1,e.$$.deleteScheduled=!1,e}function St(){this.$$.ptr||nt(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&V(`Object already scheduled for deletion`),it(this),U(this.$$),this.$$.preservePointerOnDelete||(this.$$.smartPtr=void 0,this.$$.ptr=void 0)}function Ct(){return!this.$$.ptr}function wt(){return this.$$.ptr||nt(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&V(`Object already scheduled for deletion`),ut.push(this),ut.length===1&&ft&&ft(dt),this.$$.deleteScheduled=!0,this}function Tt(){W.prototype.isAliasOf=et,W.prototype.clone=xt,W.prototype.delete=St,W.prototype.isDeleted=Ct,W.prototype.deleteLater=wt}function W(){}function Et(e,t,n){if(e[t].overloadTable===void 0){var r=e[t];e[t]=function(){return e[t].overloadTable.hasOwnProperty(arguments.length)||V(`Function '`+n+`' called with an invalid number of arguments (`+arguments.length+`) - expects one of (`+e[t].overloadTable+`)!`),e[t].overloadTable[arguments.length].apply(this,arguments)},e[t].overloadTable=[],e[t].overloadTable[r.argCount]=r}}function Dt(e,t,r){n.hasOwnProperty(e)?((r===void 0||n[e].overloadTable!==void 0&&n[e].overloadTable[r]!==void 0)&&V(`Cannot register public name '`+e+`' twice`),Et(n,e,e),n.hasOwnProperty(r)&&V(`Cannot register multiple overloads of a function with the same number of arguments (`+r+`)!`),n[e].overloadTable[r]=t):(n[e]=t,r!==void 0&&(n[e].numArguments=r))}function Ot(e,t,n,r,i,a,o,s){this.name=e,this.constructor=t,this.instancePrototype=n,this.rawDestructor=r,this.baseClass=i,this.getActualType=a,this.upcast=o,this.downcast=s,this.pureVirtualFunctions=[]}function kt(e,t,n){for(;t!==n;)t.upcast||V(`Expected null or instance of `+n.name+`, got an instance of `+t.name),e=t.upcast(e),t=t.baseClass;return e}function At(e,t){if(t===null)return this.isReference&&V(`null is not a valid `+this.name),0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name);var n=t.$$.ptrType.registeredClass;return kt(t.$$.ptr,n,this.registeredClass)}function jt(e,t){var n;if(t===null)return this.isReference&&V(`null is not a valid `+this.name),this.isSmartPointer?(n=this.rawConstructor(),e!==null&&e.push(this.rawDestructor,n),n):0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name),!this.isConst&&t.$$.ptrType.isConst&&V(`Cannot convert argument of type `+(t.$$.smartPtrType?t.$$.smartPtrType.name:t.$$.ptrType.name)+` to parameter type `+this.name);var r=t.$$.ptrType.registeredClass;if(n=kt(t.$$.ptr,r,this.registeredClass),this.isSmartPointer)switch(t.$$.smartPtr===void 0&&V(`Passing raw pointer to smart pointer is illegal`),this.sharingPolicy){case 0:t.$$.smartPtrType===this?n=t.$$.smartPtr:V(`Cannot convert argument of type `+(t.$$.smartPtrType?t.$$.smartPtrType.name:t.$$.ptrType.name)+` to parameter type `+this.name);break;case 1:n=t.$$.smartPtr;break;case 2:if(t.$$.smartPtrType===this)n=t.$$.smartPtr;else{var i=t.clone();n=this.rawShare(n,an.toHandle(function(){i.delete()})),e!==null&&e.push(this.rawDestructor,n)}break;default:V(`Unsupporting sharing policy`)}return n}function Mt(e,t){if(t===null)return this.isReference&&V(`null is not a valid `+this.name),0;t.$$||V(`Cannot pass \"`+J(t)+`\" as a `+this.name),t.$$.ptr||V(`Cannot pass deleted object as a pointer of type `+this.name),t.$$.ptrType.isConst&&V(`Cannot convert argument of type `+t.$$.ptrType.name+` to parameter type `+this.name);var n=t.$$.ptrType.registeredClass;return kt(t.$$.ptr,n,this.registeredClass)}function Nt(e){return this.fromWireType(k[e>>2])}function Pt(e){return this.rawGetPointee&&(e=this.rawGetPointee(e)),e}function Ft(e){this.rawDestructor&&this.rawDestructor(e)}function It(e){e!==null&&e.delete()}function Lt(){G.prototype.getPointee=Pt,G.prototype.destructor=Ft,G.prototype.argPackAdvance=8,G.prototype.readValueFromPointer=Nt,G.prototype.deleteObject=It,G.prototype.fromWireType=yt}function G(e,t,n,r,i,a,o,s,c,l,u){this.name=e,this.registeredClass=t,this.isReference=n,this.isConst=r,this.isSmartPointer=i,this.pointeeType=a,this.sharingPolicy=o,this.rawGetPointee=s,this.rawConstructor=c,this.rawShare=l,this.rawDestructor=u,!i&&t.baseClass===void 0?r?(this.toWireType=At,this.destructorFunction=null):(this.toWireType=Mt,this.destructorFunction=null):this.toWireType=jt}function Rt(e,t,r){n.hasOwnProperty(e)||Ze(`Replacing nonexistant public symbol`),n[e].overloadTable!==void 0&&r!==void 0?n[e].overloadTable[r]=t:(n[e]=t,n[e].argCount=r)}function zt(e,t,r){S(`dynCall_`+e in n,`bad function pointer type - no table for sig '`+e+`'`),r&&r.length?S(r.length===e.substring(1).replace(/j/g,`--`).length):S(e.length==1);var i=n[`dynCall_`+e];return r&&r.length?i.apply(null,[t].concat(r)):i.call(null,t)}var Bt=[];function Vt(e){var t=Bt[e];return t||(e>=Bt.length&&(Bt.length=e+1),Bt[e]=t=ue.get(e)),S(ue.get(e)==t,`JavaScript-side Wasm function table mirror is out of date!`),t}function Ht(e,t,n){return e.includes(`j`)?zt(e,t,n):(S(Vt(t),`missing table entry in dynCall: `+t),Vt(t).apply(null,n))}function Ut(e,t){S(e.includes(`j`)||e.includes(`p`),`getDynCaller should only be called with i64 sigs`);var n=[];return function(){return n.length=0,Object.assign(n,arguments),Ht(e,t,n)}}function K(e,t){e=B(e);function n(){return e.includes(`j`)?Ut(e,t):Vt(t)}var r=n();return typeof r!=`function`&&V(`unknown function pointer with signature `+e+`: `+t),r}var Wt=void 0;function Gt(e){var t=Yn(e),n=B(t);return X(t),n}function Kt(e,t){var n=[],r={};function i(e){if(!r[e]&&!He[e]){if(Ue[e]){Ue[e].forEach(i);return}n.push(e),r[e]=!0}}throw t.forEach(i),new Wt(e+`: `+n.map(Gt).join([`, `]))}function qt(e,t,n,r,i,a,o,s,c,l,u,d,f){u=B(u),a=K(i,a),s&&=K(o,s),l&&=K(c,l),f=K(d,f);var p=Ke(u);Dt(p,function(){Kt(`Cannot construct `+u+` due to unbound types`,[r])}),Qe([e,t,n],r?[r]:[],function(t){t=t[0];var n,i;r?(n=t.registeredClass,i=n.instancePrototype):i=W.prototype;var o=qe(p,function(){if(Object.getPrototypeOf(this)!==c)throw new Ye(`Use 'new' to construct `+u);if(d.constructor_body===void 0)throw new Ye(u+` has no accessible constructor`);var e=d.constructor_body[arguments.length];if(e===void 0)throw new Ye(`Tried to invoke ctor of `+u+` with invalid number of parameters (`+arguments.length+`) - expected (`+Object.keys(d.constructor_body).toString()+`) parameters instead!`);return e.apply(this,arguments)}),c=Object.create(i,{constructor:{value:o}});o.prototype=c;var d=new Ot(u,o,c,f,n,a,s,l),m=new G(u,d,!0,!1,!1),h=new G(u+`*`,d,!1,!1,!1),g=new G(u+` const*`,d,!1,!0,!1);return st[e]={pointerType:h,constPointerType:g},Rt(p,o),[m,h,g]})}function Jt(e,t){for(var n=[],r=0;r<e;r++)n.push(A[t+r*4>>2]);return n}function Yt(e){for(;e.length;){var t=e.pop();e.pop()(t)}}function Xt(e,t,n,r,i){var a=t.length;a<2&&V(`argTypes array size mismatch! Must at least get return value and 'this' types!`);for(var o=t[1]!==null&&n!==null,s=!1,c=1;c<t.length;++c)if(t[c]!==null&&t[c].destructorFunction===void 0){s=!0;break}var l=t[0].name!==`void`,u=a-2,d=Array(u),f=[],p=[];return function(){arguments.length!==u&&V(`function `+e+` called with `+arguments.length+` arguments, expected `+u+` args!`),p.length=0;var n;f.length=o?2:1,f[0]=i,o&&(n=t[1].toWireType(p,this),f[1]=n);for(var a=0;a<u;++a)d[a]=t[a+2].toWireType(p,arguments[a]),f.push(d[a]);var c=r.apply(null,f);function m(e){if(s)Yt(p);else for(var r=o?1:2;r<t.length;r++){var i=r===1?n:d[r-2];t[r].destructorFunction!==null&&t[r].destructorFunction(i)}if(l)return t[0].fromWireType(e)}return m(c)}}function Zt(e,t,n,r,i,a){S(t>0);var o=Jt(t,n);i=K(r,i),Qe([],[e],function(e){e=e[0];var n=`constructor `+e.name;if(e.registeredClass.constructor_body===void 0&&(e.registeredClass.constructor_body=[]),e.registeredClass.constructor_body[t-1]!==void 0)throw new Ye(`Cannot register multiple constructors with identical number of parameters (`+(t-1)+`) for class '`+e.name+`'! Overload resolution is currently only performed using the parameter count, not actual type info!`);return e.registeredClass.constructor_body[t-1]=()=>{Kt(`Cannot construct `+e.name+` due to unbound types`,o)},Qe([],o,function(r){return r.splice(1,0,null),e.registeredClass.constructor_body[t-1]=Xt(n,r,null,i,a),[]}),[]})}function Qt(e,t,n,r,i,a,o,s){var c=Jt(n,r);t=B(t),a=K(i,a),Qe([],[e],function(e){e=e[0];var r=e.name+`.`+t;t.startsWith(`@@`)&&(t=Symbol[t.substring(2)]),s&&e.registeredClass.pureVirtualFunctions.push(t);function i(){Kt(`Cannot call `+r+` due to unbound types`,c)}var l=e.registeredClass.instancePrototype,u=l[t];return u===void 0||u.overloadTable===void 0&&u.className!==e.name&&u.argCount===n-2?(i.argCount=n-2,i.className=e.name,l[t]=i):(Et(l,t,r),l[t].overloadTable[n-2]=i),Qe([],c,function(i){var s=Xt(r,i,e,a,o);return l[t].overloadTable===void 0?(s.argCount=n-2,l[t]=s):l[t].overloadTable[n-2]=s,[]}),[]})}var $t=[],q=[{},{value:void 0},{value:null},{value:!0},{value:!1}];function en(e){e>4&&--q[e].refcount===0&&(q[e]=void 0,$t.push(e))}function tn(){for(var e=0,t=5;t<q.length;++t)q[t]!==void 0&&++e;return e}function nn(){for(var e=5;e<q.length;++e)if(q[e]!==void 0)return q[e];return null}function rn(){n.count_emval_handles=tn,n.get_first_emval=nn}var an={toValue:e=>(e||V(`Cannot use deleted val. handle = `+e),q[e].value),toHandle:e=>{switch(e){case void 0:return 1;case null:return 2;case!0:return 3;case!1:return 4;default:var t=$t.length?$t.pop():q.length;return q[t]={refcount:1,value:e},t}}};function on(e,t){t=B(t),H(e,{name:t,fromWireType:function(e){var t=an.toValue(e);return en(e),t},toWireType:function(e,t){return an.toHandle(t)},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:null})}function J(e){if(e===null)return`null`;var t=typeof e;return t===`object`||t===`array`||t===`function`?e.toString():``+e}function sn(e,t){switch(t){case 2:return function(e){return this.fromWireType(ae[e>>2])};case 3:return function(e){return this.fromWireType(oe[e>>3])};default:throw TypeError(`Unknown float type: `+e)}}function cn(e,t,n){var r=Re(n);t=B(t),H(e,{name:t,fromWireType:function(e){return e},toWireType:function(e,t){if(typeof t!=`number`&&typeof t!=`boolean`)throw TypeError(`Cannot convert \"`+J(t)+`\" to `+this.name);return t},argPackAdvance:8,readValueFromPointer:sn(t,r),destructorFunction:null})}function ln(e,t,n){switch(t){case 0:return n?function(e){return D[e]}:function(e){return O[e]};case 1:return n?function(e){return re[e>>1]}:function(e){return ie[e>>1]};case 2:return n?function(e){return k[e>>2]}:function(e){return A[e>>2]};default:throw TypeError(`Unknown integer type: `+e)}}function un(e,t,n,r,i){t=B(t),i===-1&&(i=4294967295);var a=Re(n),o=e=>e;if(r===0){var s=32-8*n;o=e=>e<<s>>>s}var c=t.includes(`unsigned`),l=(e,n)=>{if(typeof e!=`number`&&typeof e!=`boolean`)throw TypeError(`Cannot convert \"`+J(e)+`\" to `+n);if(e<r||e>i)throw TypeError(`Passing a number \"`+J(e)+`\" from JS side to C/C++ side to an argument of type \"`+t+`\", which is outside the valid range [`+r+`, `+i+`]!`)};H(e,{name:t,fromWireType:o,toWireType:c?function(e,t){return l(t,this.name),t>>>0}:function(e,t){return l(t,this.name),t},argPackAdvance:8,readValueFromPointer:ln(t,a,r!==0),destructorFunction:null})}function dn(e,t,n){var r=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][t];function i(e){e>>=2;var t=A,n=t[e],i=t[e+1];return new r(ne,i,n)}n=B(n),H(e,{name:n,fromWireType:i,argPackAdvance:8,readValueFromPointer:i},{ignoreDuplicateRegistrations:!0})}function fn(e,t){t=B(t);var n=t===`std::string`;H(e,{name:t,fromWireType:function(e){var t=A[e>>2],r=e+4,i;if(n)for(var a=r,o=0;o<=t;++o){var s=r+o;if(o==t||O[s]==0){var c=s-a,l=T(a,c);i===void 0?i=l:(i+=`\\0`,i+=l),a=s+1}}else{for(var u=Array(t),o=0;o<t;++o)u[o]=String.fromCharCode(O[r+o]);i=u.join(``)}return X(e),i},toWireType:function(e,t){t instanceof ArrayBuffer&&(t=new Uint8Array(t));var r,i=typeof t==`string`;i||t instanceof Uint8Array||t instanceof Uint8ClampedArray||t instanceof Int8Array||V(`Cannot pass non-string to std::string`),r=n&&i?E(t):t.length;var a=Jn(4+r+1),o=a+4;if(A[a>>2]=r,n&&i)te(t,o,r+1);else if(i)for(var s=0;s<r;++s){var c=t.charCodeAt(s);c>255&&(X(o),V(`String has UTF-16 code units that do not fit in 8 bits`)),O[o+s]=c}else for(var s=0;s<r;++s)O[o+s]=t[s];return e!==null&&e.push(X,a),a},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:function(e){X(e)}})}var pn=typeof TextDecoder<`u`?new TextDecoder(`utf-16le`):void 0;function mn(e,t){S(e%2==0,`Pointer passed to UTF16ToString must be aligned to two bytes!`);for(var n=e,r=n>>1,i=r+t/2;!(r>=i)&&ie[r];)++r;if(n=r<<1,n-e>32&&pn)return pn.decode(O.subarray(e,n));for(var a=``,o=0;!(o>=t/2);++o){var s=re[e+o*2>>1];if(s==0)break;a+=String.fromCharCode(s)}return a}function hn(e,t,n){if(S(t%2==0,`Pointer passed to stringToUTF16 must be aligned to two bytes!`),S(typeof n==`number`,`stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),n===void 0&&(n=2147483647),n<2)return 0;n-=2;for(var r=t,i=n<e.length*2?n/2:e.length,a=0;a<i;++a){var o=e.charCodeAt(a);re[t>>1]=o,t+=2}return re[t>>1]=0,t-r}function Y(e){return e.length*2}function gn(e,t){S(e%4==0,`Pointer passed to UTF32ToString must be aligned to four bytes!`);for(var n=0,r=``;!(n>=t/4);){var i=k[e+n*4>>2];if(i==0)break;if(++n,i>=65536){var a=i-65536;r+=String.fromCharCode(55296|a>>10,56320|a&1023)}else r+=String.fromCharCode(i)}return r}function _n(e,t,n){if(S(t%4==0,`Pointer passed to stringToUTF32 must be aligned to four bytes!`),S(typeof n==`number`,`stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!`),n===void 0&&(n=2147483647),n<4)return 0;for(var r=t,i=r+n-4,a=0;a<e.length;++a){var o=e.charCodeAt(a);if(o>=55296&&o<=57343){var s=e.charCodeAt(++a);o=65536+((o&1023)<<10)|s&1023}if(k[t>>2]=o,t+=4,t+4>i)break}return k[t>>2]=0,t-r}function vn(e){for(var t=0,n=0;n<e.length;++n){var r=e.charCodeAt(n);r>=55296&&r<=57343&&++n,t+=4}return t}function yn(e,t,n){n=B(n);var r,i,a,o,s;t===2?(r=mn,i=hn,o=Y,a=()=>ie,s=1):t===4&&(r=gn,i=_n,o=vn,a=()=>A,s=2),H(e,{name:n,fromWireType:function(e){for(var n=A[e>>2],i=a(),o,c=e+4,l=0;l<=n;++l){var u=e+4+l*t;if(l==n||i[u>>s]==0){var d=u-c,f=r(c,d);o===void 0?o=f:(o+=`\\0`,o+=f),c=u+t}}return X(e),o},toWireType:function(e,r){typeof r!=`string`&&V(`Cannot pass non-string to C++ string type `+n);var a=o(r),c=Jn(4+a+t);return A[c>>2]=a>>s,i(r,c+4,a+t),e!==null&&e.push(X,c),c},argPackAdvance:8,readValueFromPointer:Nt,destructorFunction:function(e){X(e)}})}function bn(e,t){t=B(t),H(e,{isVoid:!0,name:t,argPackAdvance:0,fromWireType:function(){},toWireType:function(e,t){}})}function xn(){I(`native code called abort()`)}function Sn(e,t,n){O.copyWithin(e,t,t+n)}function Cn(){return 2147483648}function wn(e){try{return b.grow(e-ne.byteLength+65535>>>16),se(b.buffer),1}catch(t){p(`emscripten_realloc_buffer: Attempted to grow heap from `+ne.byteLength+` bytes to `+e+` bytes, but got error: `+t)}}function Tn(e){var t=O.length;e>>>=0,S(e>t);var n=Cn();if(e>n)return p(`Cannot enlarge memory, asked to go up to `+e+` bytes, but the limit is `+n+` bytes!`),!1;let r=(e,t)=>e+(t-e%t)%t;for(var i=1;i<=4;i*=2){var a=t*(1+.2/i);a=Math.min(a,e+100663296);var o=Math.min(n,r(Math.max(e,a),65536));if(wn(o))return!0}return p(`Failed to grow the heap from `+t+` bytes to `+o+` bytes, not enough memory!`),!1}var En={};function Dn(){return s||`./this.program`}function On(){if(!On.strings){var e={USER:`web_user`,LOGNAME:`web_user`,PATH:`/`,PWD:`/`,HOME:`/home/web_user`,LANG:(typeof navigator==`object`&&navigator.languages&&navigator.languages[0]||`C`).replace(`-`,`_`)+`.UTF-8`,_:Dn()};for(var t in En)En[t]===void 0?delete e[t]:e[t]=En[t];var n=[];for(var t in e)n.push(t+`=`+e[t]);On.strings=n}return On.strings}function kn(e,t,n){for(var r=0;r<e.length;++r)S(e.charCodeAt(r)===(e.charCodeAt(r)&255)),D[t++>>0]=e.charCodeAt(r);n||(D[t>>0]=0)}var An={varargs:void 0,get:function(){return S(An.varargs!=null),An.varargs+=4,k[An.varargs-4>>2]},getStr:function(e){return T(e)}};function jn(e,t){var n=0;return On().forEach(function(r,i){var a=t+n;A[e+i*4>>2]=a,kn(r,a),n+=r.length+1}),0}function Mn(e,t){var n=On();A[e>>2]=n.length;var r=0;return n.forEach(function(e){r+=e.length+1}),A[t>>2]=r,0}function Nn(e){I(`fd_close called without SYSCALLS_REQUIRE_FILESYSTEM`)}function Pn(e,t,n,r,i){return 70}var Fn=[null,[],[]];function In(e,t){var n=Fn[e];S(n),t===0||t===10?((e===1?f:p)(w(n,0)),n.length=0):n.push(t)}function Ln(e,t,n,r){for(var i=0,a=0;a<n;a++){var o=A[t>>2],s=A[t+4>>2];t+=8;for(var c=0;c<s;c++)In(e,O[o+c]);i+=s}return A[r>>2]=i,0}function Rn(e){return e%4==0&&(e%100!=0||e%400==0)}function zn(e,t){for(var n=0,r=0;r<=t;n+=e[r++]);return n}var Bn=[31,29,31,30,31,30,31,31,30,31,30,31],Vn=[31,28,31,30,31,30,31,31,30,31,30,31];function Hn(e,t){for(var n=new Date(e.getTime());t>0;){var r=Rn(n.getFullYear()),i=n.getMonth(),a=(r?Bn:Vn)[i];if(t>a-n.getDate())t-=a-n.getDate()+1,n.setDate(1),i<11?n.setMonth(i+1):(n.setMonth(0),n.setFullYear(n.getFullYear()+1));else return n.setDate(n.getDate()+t),n}return n}function Un(e,t,n){var r=n>0?n:E(e)+1,i=Array(r),a=ee(e,i,0,i.length);return t&&(i.length=a),i}function Wn(e,t,n,r){var i=k[r+40>>2],a={tm_sec:k[r>>2],tm_min:k[r+4>>2],tm_hour:k[r+8>>2],tm_mday:k[r+12>>2],tm_mon:k[r+16>>2],tm_year:k[r+20>>2],tm_wday:k[r+24>>2],tm_yday:k[r+28>>2],tm_isdst:k[r+32>>2],tm_gmtoff:k[r+36>>2],tm_zone:i?T(i):``},o=T(n),s={\"%c\":`%a %b %d %H:%M:%S %Y`,\"%D\":`%m/%d/%y`,\"%F\":`%Y-%m-%d`,\"%h\":`%b`,\"%r\":`%I:%M:%S %p`,\"%R\":`%H:%M`,\"%T\":`%H:%M:%S`,\"%x\":`%m/%d/%y`,\"%X\":`%H:%M:%S`,\"%Ec\":`%c`,\"%EC\":`%C`,\"%Ex\":`%m/%d/%y`,\"%EX\":`%H:%M:%S`,\"%Ey\":`%y`,\"%EY\":`%Y`,\"%Od\":`%d`,\"%Oe\":`%e`,\"%OH\":`%H`,\"%OI\":`%I`,\"%Om\":`%m`,\"%OM\":`%M`,\"%OS\":`%S`,\"%Ou\":`%u`,\"%OU\":`%U`,\"%OV\":`%V`,\"%Ow\":`%w`,\"%OW\":`%W`,\"%Oy\":`%y`};for(var c in s)o=o.replace(new RegExp(c,`g`),s[c]);var l=[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`],u=[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`];function d(e,t,n){for(var r=typeof e==`number`?e.toString():e||``;r.length<t;)r=n[0]+r;return r}function f(e,t){return d(e,t,`0`)}function p(e,t){function n(e){return e<0?-1:+(e>0)}var r;return(r=n(e.getFullYear()-t.getFullYear()))===0&&(r=n(e.getMonth()-t.getMonth()))===0&&(r=n(e.getDate()-t.getDate())),r}function m(e){switch(e.getDay()){case 0:return new Date(e.getFullYear()-1,11,29);case 1:return e;case 2:return new Date(e.getFullYear(),0,3);case 3:return new Date(e.getFullYear(),0,2);case 4:return new Date(e.getFullYear(),0,1);case 5:return new Date(e.getFullYear()-1,11,31);case 6:return new Date(e.getFullYear()-1,11,30)}}function h(e){var t=Hn(new Date(e.tm_year+1900,0,1),e.tm_yday),n=new Date(t.getFullYear(),0,4),r=new Date(t.getFullYear()+1,0,4),i=m(n),a=m(r);return p(i,t)<=0?p(a,t)<=0?t.getFullYear()+1:t.getFullYear():t.getFullYear()-1}var g={\"%a\":function(e){return l[e.tm_wday].substring(0,3)},\"%A\":function(e){return l[e.tm_wday]},\"%b\":function(e){return u[e.tm_mon].substring(0,3)},\"%B\":function(e){return u[e.tm_mon]},\"%C\":function(e){return f((e.tm_year+1900)/100|0,2)},\"%d\":function(e){return f(e.tm_mday,2)},\"%e\":function(e){return d(e.tm_mday,2,` `)},\"%g\":function(e){return h(e).toString().substring(2)},\"%G\":function(e){return h(e)},\"%H\":function(e){return f(e.tm_hour,2)},\"%I\":function(e){var t=e.tm_hour;return t==0?t=12:t>12&&(t-=12),f(t,2)},\"%j\":function(e){return f(e.tm_mday+zn(Rn(e.tm_year+1900)?Bn:Vn,e.tm_mon-1),3)},\"%m\":function(e){return f(e.tm_mon+1,2)},\"%M\":function(e){return f(e.tm_min,2)},\"%n\":function(){return`\n`},\"%p\":function(e){return e.tm_hour>=0&&e.tm_hour<12?`AM`:`PM`},\"%S\":function(e){return f(e.tm_sec,2)},\"%t\":function(){return`	`},\"%u\":function(e){return e.tm_wday||7},\"%U\":function(e){var t=e.tm_yday+7-e.tm_wday;return f(Math.floor(t/7),2)},\"%V\":function(e){var t=Math.floor((e.tm_yday+7-(e.tm_wday+6)%7)/7);if((e.tm_wday+371-e.tm_yday-2)%7<=2&&t++,!t){t=52;var n=(e.tm_wday+7-e.tm_yday-1)%7;(n==4||n==5&&Rn(e.tm_year%400-1))&&t++}else if(t==53){var r=(e.tm_wday+371-e.tm_yday)%7;r!=4&&(r!=3||!Rn(e.tm_year))&&(t=1)}return f(t,2)},\"%w\":function(e){return e.tm_wday},\"%W\":function(e){var t=e.tm_yday+7-(e.tm_wday+6)%7;return f(Math.floor(t/7),2)},\"%y\":function(e){return(e.tm_year+1900).toString().substring(2)},\"%Y\":function(e){return e.tm_year+1900},\"%z\":function(e){var t=e.tm_gmtoff,n=t>=0;return t=Math.abs(t)/60,t=t/60*100+t%60,(n?`+`:`-`)+String(`0000`+t).slice(-4)},\"%Z\":function(e){return e.tm_zone},\"%%\":function(){return`%`}};for(var c in o=o.replace(/%%/g,`\\0\\0`),g)o.includes(c)&&(o=o.replace(new RegExp(c,`g`),g[c](a)));o=o.replace(/\\0\\0/g,`%`);var _=Un(o,!1);return _.length>t?0:(Me(_,e),_.length-1)}function Gn(e,t,n,r){return Wn(e,t,n,r)}ze(),Ye=n.BindingError=Je(Error,`BindingError`),Xe=n.InternalError=Je(Error,`InternalError`),Tt(),mt(),Lt(),Wt=n.UnboundTypeError=Je(Error,`UnboundTypeError`),rn();function Kn(){h(`fetchSettings`)}var qn={__cxa_allocate_exception:Ne,__cxa_throw:Ie,_embind_register_bigint:Le,_embind_register_bool:$e,_embind_register_class:qt,_embind_register_class_constructor:Zt,_embind_register_class_function:Qt,_embind_register_emval:on,_embind_register_float:cn,_embind_register_integer:un,_embind_register_memory_view:dn,_embind_register_std_string:fn,_embind_register_std_wstring:yn,_embind_register_void:bn,abort:xn,emscripten_memcpy_big:Sn,emscripten_resize_heap:Tn,environ_get:jn,environ_sizes_get:Mn,fd_close:Nn,fd_seek:Pn,fd_write:Ln,strftime_l:Gn};ke(),n.___wasm_call_ctors=R(`__wasm_call_ctors`);var Jn=n._malloc=R(`malloc`),X=n._free=R(`free`),Yn=n.___getTypeName=R(`__getTypeName`);n.__embind_initialize_bindings=R(`_embind_initialize_bindings`),n.___errno_location=R(`__errno_location`),n._fflush=R(`fflush`);var Xn=n._emscripten_stack_init=function(){return(Xn=n._emscripten_stack_init=n.asm.emscripten_stack_init).apply(null,arguments)},Zn=n._emscripten_stack_get_free=function(){return(Zn=n._emscripten_stack_get_free=n.asm.emscripten_stack_get_free).apply(null,arguments)},Qn=n._emscripten_stack_get_base=function(){return(Qn=n._emscripten_stack_get_base=n.asm.emscripten_stack_get_base).apply(null,arguments)},$n=n._emscripten_stack_get_end=function(){return($n=n._emscripten_stack_get_end=n.asm.emscripten_stack_get_end).apply(null,arguments)};n.stackSave=R(`stackSave`),n.stackRestore=R(`stackRestore`),n.stackAlloc=R(`stackAlloc`);var er=n.___cxa_is_pointer_type=R(`__cxa_is_pointer_type`);n.dynCall_viijii=R(`dynCall_viijii`),n.dynCall_ji=R(`dynCall_ji`),n.dynCall_jiji=R(`dynCall_jiji`),n.dynCall_iiiiij=R(`dynCall_iiiiij`),n.dynCall_iiiiijj=R(`dynCall_iiiiijj`),n.dynCall_iiiiiijj=R(`dynCall_iiiiiijj`),`run.UTF8ArrayToString.UTF8ToString.stringToUTF8Array.stringToUTF8.lengthBytesUTF8.addOnPreRun.addOnInit.addOnPreMain.addOnExit.addOnPostRun.addRunDependency.removeRunDependency.FS_createFolder.FS_createPath.FS_createDataFile.FS_createPreloadedFile.FS_createLazyFile.FS_createLink.FS_createDevice.FS_unlink.getLEB.getFunctionTables.alignFunctionTables.registerFunctions.prettyPrint.getCompilerSetting.print.printErr.callMain.abort.keepRuntimeAlive.wasmMemory.stackAlloc.stackSave.stackRestore.getTempRet0.setTempRet0.writeStackCookie.checkStackCookie.ptrToString.zeroMemory.stringToNewUTF8.exitJS.getHeapMax.emscripten_realloc_buffer.ENV.ERRNO_CODES.ERRNO_MESSAGES.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.DNS.getHostByName.Protocols.Sockets.getRandomDevice.warnOnce.traverseStack.UNWIND_CACHE.convertPCtoSourceLocation.readAsmConstArgsArray.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.getExecutableName.listenOnce.autoResumeAudioContext.dynCallLegacy.getDynCaller.dynCall.handleException.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertI32PairToI53Checked.convertU32PairToI53.getCFunc.ccall.cwrap.uleb128Encode.sigToWasmTypes.convertJsFunctionToWasm.freeTableIndexes.functionsInTableMap.getEmptyTableSlot.updateTableMap.addFunction.removeFunction.reallyNegative.unSign.strLen.reSign.formatString.setValue.getValue.PATH.PATH_FS.intArrayFromString.intArrayToString.AsciiToString.stringToAscii.UTF16Decoder.UTF16ToString.stringToUTF16.lengthBytesUTF16.UTF32ToString.stringToUTF32.lengthBytesUTF32.allocateUTF8.allocateUTF8OnStack.writeStringToMemory.writeArrayToMemory.writeAsciiToMemory.SYSCALLS.getSocketFromFD.getSocketAddress.JSEvents.registerKeyEventCallback.specialHTMLTargets.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.currentFullscreenStrategy.restoreOldWindowedStyle.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.demangle.demangleAll.jsStackTrace.stackTrace.ExitStatus.getEnvStrings.checkWasiClock.flush_NO_FILESYSTEM.dlopenMissingError.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.uncaughtExceptionCount.exceptionLast.exceptionCaught.ExceptionInfo.exception_addRef.exception_decRef.Browser.setMainLoop.wget.FS.MEMFS.TTY.PIPEFS.SOCKFS._setNetworkCallback.tempFixedLengthArray.miniTempWebGLFloatBuffers.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.GL.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.AL.SDL_unicode.SDL_ttfContext.SDL_audio.SDL.SDL_gfx.GLUT.EGL.GLFW_Window.GLFW.GLEW.IDBStore.runAndAbortIfError.ALLOC_NORMAL.ALLOC_STACK.allocate.InternalError.BindingError.UnboundTypeError.PureVirtualError.init_embind.throwInternalError.throwBindingError.throwUnboundTypeError.ensureOverloadTable.exposePublicSymbol.replacePublicSymbol.extendError.createNamedFunction.embindRepr.registeredInstances.getBasestPointer.registerInheritedInstance.unregisterInheritedInstance.getInheritedInstance.getInheritedInstanceCount.getLiveInheritedInstances.registeredTypes.awaitingDependencies.typeDependencies.registeredPointers.registerType.whenDependentTypesAreResolved.embind_charCodes.embind_init_charCodes.readLatin1String.getTypeName.heap32VectorToArray.requireRegisteredType.getShiftFromSize.integerReadValueFromPointer.enumReadValueFromPointer.floatReadValueFromPointer.simpleReadValueFromPointer.runDestructors.new_.craftInvokerFunction.embind__requireFunction.tupleRegistrations.structRegistrations.genericPointerToWireType.constNoSmartPtrRawPointerToWireType.nonConstNoSmartPtrRawPointerToWireType.init_RegisteredPointer.RegisteredPointer.RegisteredPointer_getPointee.RegisteredPointer_destructor.RegisteredPointer_deleteObject.RegisteredPointer_fromWireType.runDestructor.releaseClassHandle.finalizationRegistry.detachFinalizer_deps.detachFinalizer.attachFinalizer.makeClassHandle.init_ClassHandle.ClassHandle.ClassHandle_isAliasOf.throwInstanceAlreadyDeleted.ClassHandle_clone.ClassHandle_delete.deletionQueue.ClassHandle_isDeleted.ClassHandle_deleteLater.flushPendingDeletes.delayFunction.setDelayFunction.RegisteredClass.shallowCopyInternalPointer.downcastPointer.upcastPointer.validateThis.char_0.char_9.makeLegalFunctionName.emval_handle_array.emval_free_list.emval_symbols.init_emval.count_emval_handles.get_first_emval.getStringOrSymbol.Emval.emval_newers.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_methodCallers.emval_addMethodCaller.emval_registeredMethods`.split(`.`).forEach(v),`ptrToString.zeroMemory.stringToNewUTF8.exitJS.setErrNo.inetPton4.inetNtop4.inetPton6.inetNtop6.readSockaddr.writeSockaddr.getHostByName.getRandomDevice.traverseStack.convertPCtoSourceLocation.readAsmConstArgs.mainThreadEM_ASM.jstoi_q.jstoi_s.listenOnce.autoResumeAudioContext.runtimeKeepalivePush.runtimeKeepalivePop.callUserCallback.maybeExit.safeSetTimeout.asmjsMangle.asyncLoad.alignMemory.mmapAlloc.writeI53ToI64.writeI53ToI64Clamped.writeI53ToI64Signaling.writeI53ToU64Clamped.writeI53ToU64Signaling.readI53FromI64.readI53FromU64.convertI32PairToI53.convertU32PairToI53.reallyNegative.unSign.strLen.reSign.formatString.getSocketFromFD.getSocketAddress.registerKeyEventCallback.maybeCStringToJsString.findEventTarget.findCanvasEventTarget.getBoundingClientRect.fillMouseEventData.registerMouseEventCallback.registerWheelEventCallback.registerUiEventCallback.registerFocusEventCallback.fillDeviceOrientationEventData.registerDeviceOrientationEventCallback.fillDeviceMotionEventData.registerDeviceMotionEventCallback.screenOrientation.fillOrientationChangeEventData.registerOrientationChangeEventCallback.fillFullscreenChangeEventData.registerFullscreenChangeEventCallback.JSEvents_requestFullscreen.JSEvents_resizeCanvasForFullscreen.registerRestoreOldStyle.hideEverythingExceptGivenElement.restoreHiddenElements.setLetterbox.softFullscreenResizeWebGLRenderTarget.doRequestFullscreen.fillPointerlockChangeEventData.registerPointerlockChangeEventCallback.registerPointerlockErrorEventCallback.requestPointerLock.fillVisibilityChangeEventData.registerVisibilityChangeEventCallback.registerTouchEventCallback.fillGamepadEventData.registerGamepadEventCallback.registerBeforeUnloadEventCallback.fillBatteryEventData.battery.registerBatteryEventCallback.setCanvasElementSize.getCanvasElementSize.checkWasiClock.setImmediateWrapped.clearImmediateWrapped.polyfillSetImmediate.exception_addRef.exception_decRef.setMainLoop._setNetworkCallback.heapObjectForWebGLType.heapAccessShiftForWebGLHeap.emscriptenWebGLGet.computeUnpackAlignedImageSize.emscriptenWebGLGetTexPixelData.emscriptenWebGLGetUniform.webglGetUniformLocation.webglPrepareUniformLocationsBeforeFirstUse.webglGetLeftBracePos.emscriptenWebGLGetVertexAttrib.writeGLArray.SDL_unicode.SDL_ttfContext.SDL_audio.GLFW_Window.runAndAbortIfError.registerInheritedInstance.unregisterInheritedInstance.requireRegisteredType.enumReadValueFromPointer.validateThis.getStringOrSymbol.craftEmvalAllocator.emval_get_global.emval_lookupTypes.emval_allocateDestructors.emval_addMethodCaller`.split(`.`).forEach(_);var tr;be=function e(){tr||Z(),tr||(be=e)};function nr(){Xn(),j()}function Z(e){if(e||=o,ye>0||(nr(),he(),ye>0))return;function t(){tr||(tr=!0,n.calledRun=!0,!x&&(N(),r(n),n.onRuntimeInitialized&&n.onRuntimeInitialized(),S(!n._main,`compiled without a main, but one is present. if you added it from JS, use Module[\"onRuntimeInitialized\"]`),ge()))}n.setStatus?(n.setStatus(`Running...`),setTimeout(function(){setTimeout(function(){n.setStatus(``)},1),t()},1)):t(),de()}if(n.preInit)for(typeof n.preInit==`function`&&(n.preInit=[n.preInit]);n.preInit.length>0;)n.preInit.pop()();return Z(),t.ready})})();typeof e==`object`&&typeof t==`object`?t.exports=n:typeof define==`function`&&define.amd?define([],function(){return n}):typeof e==`object`&&(e.createLazPerf=n)})),k=e((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,\"__esModule\",{value:!0}),e.LazPerf=e.create=e.createLazPerf=void 0;let n=t(ie());e.createLazPerf=n.default,e.create=n.default,e.LazPerf={create:n.default}})),A=re(),ae=k();function oe(e){e(`EPSG:4326`,`+title=WGS 84 (long/lat) +proj=longlat +ellps=WGS84 +datum=WGS84 +units=degrees`),e(`EPSG:4269`,`+title=NAD83 (long/lat) +proj=longlat +a=6378137.0 +b=6356752.31414036 +ellps=GRS80 +datum=NAD83 +units=degrees`),e(`EPSG:3857`,`+title=WGS 84 / Pseudo-Mercator +proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs`);for(var t=1;t<=60;++t)e(`EPSG:`+(32600+t),`+proj=utm +zone=`+t+` +datum=WGS84 +units=m`),e(`EPSG:`+(32700+t),`+proj=utm +zone=`+t+` +south +datum=WGS84 +units=m`);e(`EPSG:5041`,`+title=WGS 84 / UPS North (E,N) +proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m`),e(`EPSG:5042`,`+title=WGS 84 / UPS South (E,N) +proj=stere +lat_0=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m`),e.WGS84=e[`EPSG:4326`],e[`EPSG:3785`]=e[`EPSG:3857`],e.GOOGLE=e[`EPSG:3857`],e[`EPSG:900913`]=e[`EPSG:3857`],e[`EPSG:102113`]=e[`EPSG:3857`]}var se=6378137,ce=6356752.314,le=.0066943799901413165,ue=484813681109536e-20,j=Math.PI/2,de=.16666666666666666,fe=.04722222222222222,pe=.022156084656084655,me=1e-10,M=.017453292519943295,he=57.29577951308232,N=Math.PI/4,ge=Math.PI*2,P=3.14159265359,_e={};_e.greenwich=0,_e.lisbon=-9.131906111111,_e.paris=2.337229166667,_e.bogota=-74.080916666667,_e.madrid=-3.687938888889,_e.rome=12.452333333333,_e.bern=7.439583333333,_e.jakarta=106.807719444444,_e.ferro=-17.666666666667,_e.brussels=4.367975,_e.stockholm=18.058277777778,_e.athens=23.7163375,_e.oslo=10.722916666667;var ve={mm:{to_meter:.001},cm:{to_meter:.01},ft:{to_meter:.3048},\"us-ft\":{to_meter:1200/3937},fath:{to_meter:1.8288},kmi:{to_meter:1852},\"us-ch\":{to_meter:20.1168402336805},\"us-mi\":{to_meter:1609.34721869444},km:{to_meter:1e3},\"ind-ft\":{to_meter:.30479841},\"ind-yd\":{to_meter:.91439523},mi:{to_meter:1609.344},yd:{to_meter:.9144},ch:{to_meter:20.1168},link:{to_meter:.201168},dm:{to_meter:.1},in:{to_meter:.0254},\"ind-ch\":{to_meter:20.11669506},\"us-in\":{to_meter:.025400050800101},\"us-yd\":{to_meter:.914401828803658}},ye=/[\\s_\\-\\/\\(\\)]/g;function F(e,t){if(e[t])return e[t];for(var n=Object.keys(e),r=t.toLowerCase().replace(ye,``),i=-1,a,o;++i<n.length;)if(a=n[i],o=a.toLowerCase().replace(ye,``),o===r)return e[a]}function be(e){var t={},n=e.split(`+`).map(function(e){return e.trim()}).filter(function(e){return e}).reduce(function(e,t){var n=t.split(`=`);return n.push(!0),e[n[0].toLowerCase()]=n[1],e},{}),r,i,a,o={proj:`projName`,datum:`datumCode`,rf:function(e){t.rf=parseFloat(e)},lat_0:function(e){t.lat0=e*M},lat_1:function(e){t.lat1=e*M},lat_2:function(e){t.lat2=e*M},lat_ts:function(e){t.lat_ts=e*M},lon_0:function(e){t.long0=e*M},lon_1:function(e){t.long1=e*M},lon_2:function(e){t.long2=e*M},alpha:function(e){t.alpha=parseFloat(e)*M},gamma:function(e){t.rectified_grid_angle=parseFloat(e)*M},lonc:function(e){t.longc=e*M},x_0:function(e){t.x0=parseFloat(e)},y_0:function(e){t.y0=parseFloat(e)},k_0:function(e){t.k0=parseFloat(e)},k:function(e){t.k0=parseFloat(e)},a:function(e){t.a=parseFloat(e)},b:function(e){t.b=parseFloat(e)},r:function(e){t.a=t.b=parseFloat(e)},r_a:function(){t.R_A=!0},zone:function(e){t.zone=parseInt(e,10)},south:function(){t.utmSouth=!0},towgs84:function(e){t.datum_params=e.split(`,`).map(function(e){return parseFloat(e)})},to_meter:function(e){t.to_meter=parseFloat(e)},units:function(e){t.units=e;var n=F(ve,e);n&&(t.to_meter=n.to_meter)},from_greenwich:function(e){t.from_greenwich=e*M},pm:function(e){t.from_greenwich=(F(_e,e)||parseFloat(e))*M},nadgrids:function(e){e===`@null`?t.datumCode=`none`:t.nadgrids=e},axis:function(e){var n=`ewnsud`;e.length===3&&n.indexOf(e.substr(0,1))!==-1&&n.indexOf(e.substr(1,1))!==-1&&n.indexOf(e.substr(2,1))!==-1&&(t.axis=e)},approx:function(){t.approx=!0},over:function(){t.over=!0}};for(r in n)i=n[r],r in o?(a=o[r],typeof a==`function`?a(i):t[a]=i):t[r]=i;return typeof t.datumCode==`string`&&t.datumCode!==`WGS84`&&(t.datumCode=t.datumCode.toLowerCase()),t.projStr=e,t}var xe=class{static getId(e){let t=e.find(e=>Array.isArray(e)&&e[0]===`ID`);return t&&t.length>=3?{authority:t[1],code:parseInt(t[2],10)}:null}static convertUnit(e,t=`unit`){if(!e||e.length<3)return{type:t,name:`unknown`,conversion_factor:null};let n=e[1],r=parseFloat(e[2])||null,i=e.find(e=>Array.isArray(e)&&e[0]===`ID`);return{type:t,name:n,conversion_factor:r,id:i?{authority:i[1],code:parseInt(i[2],10)}:null}}static convertAxis(e){let t=e[1]||`Unknown`,n,r=t.match(/^\\((.)\\)$/);if(r){let t=r[1].toUpperCase();if(t===`E`)n=`east`;else if(t===`N`)n=`north`;else if(t===`U`)n=`up`;else if(e[2])n=e[2];else throw Error(`Unknown axis abbreviation: ${t}`)}else n=e[2]||`unknown`;let i=e.find(e=>Array.isArray(e)&&e[0]===`ORDER`),a=i?parseInt(i[1],10):null,o=e.find(e=>Array.isArray(e)&&(e[0]===`LENGTHUNIT`||e[0]===`ANGLEUNIT`||e[0]===`SCALEUNIT`)),s=this.convertUnit(o);return{name:t,direction:n,unit:s,order:a}}static extractAxes(e){return e.filter(e=>Array.isArray(e)&&e[0]===`AXIS`).map(e=>this.convertAxis(e)).sort((e,t)=>(e.order||0)-(t.order||0))}static convert(e,t={}){switch(e[0]){case`PROJCRS`:t.type=`ProjectedCRS`,t.name=e[1],t.base_crs=e.find(e=>Array.isArray(e)&&e[0]===`BASEGEOGCRS`)?this.convert(e.find(e=>Array.isArray(e)&&e[0]===`BASEGEOGCRS`)):null,t.conversion=e.find(e=>Array.isArray(e)&&e[0]===`CONVERSION`)?this.convert(e.find(e=>Array.isArray(e)&&e[0]===`CONVERSION`)):null;let n=e.find(e=>Array.isArray(e)&&e[0]===`CS`);n&&(t.coordinate_system={type:n[1],axis:this.extractAxes(e)});let r=e.find(e=>Array.isArray(e)&&e[0]===`LENGTHUNIT`);if(r){let e=this.convertUnit(r);t.coordinate_system.unit=e}t.id=this.getId(e);break;case`BASEGEOGCRS`:case`GEOGCRS`:case`GEODCRS`:t.type=e[0]===`GEODCRS`?`GeodeticCRS`:`GeographicCRS`,t.name=e[1];let i=e.find(e=>Array.isArray(e)&&(e[0]===`DATUM`||e[0]===`ENSEMBLE`));if(i){let n=this.convert(i);i[0]===`ENSEMBLE`?t.datum_ensemble=n:t.datum=n;let r=e.find(e=>Array.isArray(e)&&e[0]===`PRIMEM`);r&&r[1]!==`Greenwich`&&(n.prime_meridian={name:r[1],longitude:parseFloat(r[2])})}t.coordinate_system={type:`ellipsoidal`,axis:this.extractAxes(e)},t.id=this.getId(e);break;case`DATUM`:t.type=`GeodeticReferenceFrame`,t.name=e[1],t.ellipsoid=e.find(e=>Array.isArray(e)&&e[0]===`ELLIPSOID`)?this.convert(e.find(e=>Array.isArray(e)&&e[0]===`ELLIPSOID`)):null;break;case`ENSEMBLE`:t.type=`DatumEnsemble`,t.name=e[1],t.members=e.filter(e=>Array.isArray(e)&&e[0]===`MEMBER`).map(e=>({type:`DatumEnsembleMember`,name:e[1],id:this.getId(e)}));let a=e.find(e=>Array.isArray(e)&&e[0]===`ENSEMBLEACCURACY`);a&&(t.accuracy=parseFloat(a[1]));let o=e.find(e=>Array.isArray(e)&&e[0]===`ELLIPSOID`);o&&(t.ellipsoid=this.convert(o)),t.id=this.getId(e);break;case`ELLIPSOID`:t.type=`Ellipsoid`,t.name=e[1],t.semi_major_axis=parseFloat(e[2]),t.inverse_flattening=parseFloat(e[3]),e.find(e=>Array.isArray(e)&&e[0]===`LENGTHUNIT`)&&this.convert(e.find(e=>Array.isArray(e)&&e[0]===`LENGTHUNIT`),t);break;case`CONVERSION`:t.type=`Conversion`,t.name=e[1],t.method=e.find(e=>Array.isArray(e)&&e[0]===`METHOD`)?this.convert(e.find(e=>Array.isArray(e)&&e[0]===`METHOD`)):null,t.parameters=e.filter(e=>Array.isArray(e)&&e[0]===`PARAMETER`).map(e=>this.convert(e));break;case`METHOD`:t.type=`Method`,t.name=e[1],t.id=this.getId(e);break;case`PARAMETER`:t.type=`Parameter`,t.name=e[1],t.value=parseFloat(e[2]),t.unit=this.convertUnit(e.find(e=>Array.isArray(e)&&(e[0]===`LENGTHUNIT`||e[0]===`ANGLEUNIT`||e[0]===`SCALEUNIT`))),t.id=this.getId(e);break;case`BOUNDCRS`:t.type=`BoundCRS`;let s=e.find(e=>Array.isArray(e)&&e[0]===`SOURCECRS`);if(s){let e=s.find(e=>Array.isArray(e));t.source_crs=e?this.convert(e):null}let c=e.find(e=>Array.isArray(e)&&e[0]===`TARGETCRS`);if(c){let e=c.find(e=>Array.isArray(e));t.target_crs=e?this.convert(e):null}let l=e.find(e=>Array.isArray(e)&&e[0]===`ABRIDGEDTRANSFORMATION`);l?t.transformation=this.convert(l):t.transformation=null;break;case`ABRIDGEDTRANSFORMATION`:if(t.type=`Transformation`,t.name=e[1],t.method=e.find(e=>Array.isArray(e)&&e[0]===`METHOD`)?this.convert(e.find(e=>Array.isArray(e)&&e[0]===`METHOD`)):null,t.parameters=e.filter(e=>Array.isArray(e)&&(e[0]===`PARAMETER`||e[0]===`PARAMETERFILE`)).map(e=>{if(e[0]===`PARAMETER`)return this.convert(e);if(e[0]===`PARAMETERFILE`)return{name:e[1],value:e[2],id:{authority:`EPSG`,code:8656}}}),t.parameters.length===7){let e=t.parameters[6];e.name===`Scale difference`&&(e.value=Math.round((e.value-1)*0xe8d4a51000)/1e6)}t.id=this.getId(e);break;case`AXIS`:t.coordinate_system||={type:`unspecified`,axis:[]},t.coordinate_system.axis.push(this.convertAxis(e));break;case`LENGTHUNIT`:let u=this.convertUnit(e,`LinearUnit`);t.coordinate_system&&t.coordinate_system.axis&&t.coordinate_system.axis.forEach(e=>{e.unit||=u}),u.conversion_factor&&u.conversion_factor!==1&&(t.semi_major_axis&&={value:t.semi_major_axis,unit:u});break;default:t.keyword=e[0];break}return t}},Se=class extends xe{static convert(e,t={}){return super.convert(e,t),t.coordinate_system&&t.coordinate_system.subtype===`Cartesian`&&delete t.coordinate_system,t.usage&&delete t.usage,t}},Ce=class extends xe{static convert(e,t={}){super.convert(e,t);let n=e.find(e=>Array.isArray(e)&&e[0]===`CS`);n&&(t.coordinate_system={subtype:n[1],axis:this.extractAxes(e)});let r=e.find(e=>Array.isArray(e)&&e[0]===`USAGE`);if(r){let e=r.find(e=>Array.isArray(e)&&e[0]===`SCOPE`),n=r.find(e=>Array.isArray(e)&&e[0]===`AREA`),i=r.find(e=>Array.isArray(e)&&e[0]===`BBOX`);t.usage={},e&&(t.usage.scope=e[1]),n&&(t.usage.area=n[1]),i&&(t.usage.bbox=i.slice(1))}return t}};function I(e){return e.find(e=>Array.isArray(e)&&e[0]===`USAGE`)?`2019`:(e.find(e=>Array.isArray(e)&&e[0]===`CS`)||e[0]===`BOUNDCRS`||e[0]===`PROJCRS`||e[0],`2015`)}function L(e){return(I(e)===`2019`?Ce:Se).convert(e)}function we(e){let t=e.toUpperCase();return t.includes(`PROJCRS`)||t.includes(`GEOGCRS`)||t.includes(`BOUNDCRS`)||t.includes(`VERTCRS`)||t.includes(`LENGTHUNIT`)||t.includes(`ANGLEUNIT`)||t.includes(`SCALEUNIT`)?`WKT2`:(t.includes(`PROJCS`)||t.includes(`GEOGCS`)||t.includes(`LOCAL_CS`)||t.includes(`VERT_CS`)||t.includes(`UNIT`),`WKT1`)}var Te=Ie,Ee=1,R=2,z=3,De=4,Oe=5,ke=-1,Ae=/\\s/,je=/[A-Za-z]/,Me=/[A-Za-z84_]/,Ne=/[,\\]]/,Pe=/[\\d\\.E\\-\\+]/;function Fe(e){if(typeof e!=`string`)throw Error(`not a string`);this.text=e.trim(),this.level=0,this.place=0,this.root=null,this.stack=[],this.currentObject=null,this.state=Ee}Fe.prototype.readCharicter=function(){var e=this.text[this.place++];if(this.state!==De)for(;Ae.test(e);){if(this.place>=this.text.length)return;e=this.text[this.place++]}switch(this.state){case Ee:return this.neutral(e);case R:return this.keyword(e);case De:return this.quoted(e);case Oe:return this.afterquote(e);case z:return this.number(e);case ke:return}},Fe.prototype.afterquote=function(e){if(e===`\"`){this.word+=`\"`,this.state=De;return}if(Ne.test(e)){this.word=this.word.trim(),this.afterItem(e);return}throw Error(`havn't handled \"`+e+`\" in afterquote yet, index `+this.place)},Fe.prototype.afterItem=function(e){if(e===`,`){this.word!==null&&this.currentObject.push(this.word),this.word=null,this.state=Ee;return}if(e===`]`){this.level--,this.word!==null&&(this.currentObject.push(this.word),this.word=null),this.state=Ee,this.currentObject=this.stack.pop(),this.currentObject||(this.state=ke);return}},Fe.prototype.number=function(e){if(Pe.test(e)){this.word+=e;return}if(Ne.test(e)){this.word=parseFloat(this.word),this.afterItem(e);return}throw Error(`havn't handled \"`+e+`\" in number yet, index `+this.place)},Fe.prototype.quoted=function(e){if(e===`\"`){this.state=Oe;return}this.word+=e},Fe.prototype.keyword=function(e){if(Me.test(e)){this.word+=e;return}if(e===`[`){var t=[];t.push(this.word),this.level++,this.root===null?this.root=t:this.currentObject.push(t),this.stack.push(this.currentObject),this.currentObject=t,this.state=Ee;return}if(Ne.test(e)){this.afterItem(e);return}throw Error(`havn't handled \"`+e+`\" in keyword yet, index `+this.place)},Fe.prototype.neutral=function(e){if(je.test(e)){this.word=e,this.state=R;return}if(e===`\"`){this.word=``,this.state=De;return}if(Pe.test(e)){this.word=e,this.state=z;return}if(Ne.test(e)){this.afterItem(e);return}throw Error(`havn't handled \"`+e+`\" in neutral yet, index `+this.place)},Fe.prototype.output=function(){for(;this.place<this.text.length;)this.readCharicter();if(this.state===ke)return this.root;throw Error(`unable to parse string \"`+this.text+`\". State is `+this.state)};function Ie(e){return new Fe(e).output()}function Le(e,t,n){Array.isArray(t)&&(n.unshift(t),t=null);var r=t?{}:e,i=n.reduce(function(e,t){return Re(t,e),e},r);t&&(e[t]=i)}function Re(e,t){if(!Array.isArray(e)){t[e]=!0;return}var n=e.shift();if(n===`PARAMETER`&&(n=e.shift()),e.length===1){if(Array.isArray(e[0])){t[n]={},Re(e[0],t[n]);return}t[n]=e[0];return}if(!e.length){t[n]=!0;return}if(n===`TOWGS84`){t[n]=e;return}if(n===`AXIS`){n in t||(t[n]=[]),t[n].push(e);return}Array.isArray(n)||(t[n]={});var r;switch(n){case`UNIT`:case`PRIMEM`:case`VERT_DATUM`:t[n]={name:e[0].toLowerCase(),convert:e[1]},e.length===3&&Re(e[2],t[n]);return;case`SPHEROID`:case`ELLIPSOID`:t[n]={name:e[0],a:e[1],rf:e[2]},e.length===4&&Re(e[3],t[n]);return;case`EDATUM`:case`ENGINEERINGDATUM`:case`LOCAL_DATUM`:case`DATUM`:case`VERT_CS`:case`VERTCRS`:case`VERTICALCRS`:e[0]=[`name`,e[0]],Le(t,n,e);return;case`COMPD_CS`:case`COMPOUNDCRS`:case`FITTED_CS`:case`PROJECTEDCRS`:case`PROJCRS`:case`GEOGCS`:case`GEOCCS`:case`PROJCS`:case`LOCAL_CS`:case`GEODCRS`:case`GEODETICCRS`:case`GEODETICDATUM`:case`ENGCRS`:case`ENGINEERINGCRS`:e[0]=[`name`,e[0]],Le(t,n,e),t[n].type=n;return;default:for(r=-1;++r<e.length;)if(!Array.isArray(e[r]))return Re(e,t[n]);return Le(t,n,e)}}var ze=.017453292519943295;function Be(e){return e*ze}function B(e){let t=(e.projName||``).toLowerCase().replace(/_/g,` `);e.long0===void 0&&e.longc!==void 0&&(e.long0=e.longc),!e.lat_ts&&e.lat1&&(t===`stereographic south pole`||t===`polar stereographic (variant b)`)?(e.lat0=Be(e.lat1>0?90:-90),e.lat_ts=e.lat1,delete e.lat1):!e.lat_ts&&e.lat0&&(t===`polar stereographic`||t===`polar stereographic (variant a)`)&&(e.lat_ts=e.lat0,e.lat0=Be(e.lat0>0?90:-90),delete e.lat1)}function Ve(e){let t={units:null,to_meter:void 0};return typeof e==`string`?(t.units=e.toLowerCase(),t.units===`metre`&&(t.units=`meter`),t.units===`meter`&&(t.to_meter=1)):e&&e.name&&(t.units=e.name.toLowerCase(),t.units===`metre`&&(t.units=`meter`),t.to_meter=e.conversion_factor),t}function He(e){return typeof e==`object`?e.value*e.unit.conversion_factor:e}function Ue(e,t){e.ellipsoid.radius?(t.a=e.ellipsoid.radius,t.rf=0):(t.a=He(e.ellipsoid.semi_major_axis),e.ellipsoid.inverse_flattening===void 0?e.ellipsoid.semi_major_axis!==void 0&&e.ellipsoid.semi_minor_axis!==void 0&&(t.rf=t.a/(t.a-He(e.ellipsoid.semi_minor_axis))):t.rf=e.ellipsoid.inverse_flattening)}function We(e,t={}){return!e||typeof e!=`object`?e:e.type===`BoundCRS`?(We(e.source_crs,t),e.transformation&&(e.transformation.method&&e.transformation.method.name===`NTv2`?t.nadgrids=e.transformation.parameters[0].value:t.datum_params=e.transformation.parameters.map(e=>e.value)),t):(Object.keys(e).forEach(n=>{let r=e[n];if(r!==null)switch(n){case`name`:if(t.srsCode)break;t.name=r,t.srsCode=r;break;case`type`:r===`GeographicCRS`?t.projName=`longlat`:r===`GeodeticCRS`?e.coordinate_system&&e.coordinate_system.subtype===`Cartesian`?t.projName=`geocent`:t.projName=`longlat`:r===`ProjectedCRS`&&e.conversion&&e.conversion.method&&(t.projName=e.conversion.method.name);break;case`datum`:case`datum_ensemble`:r.ellipsoid&&(t.ellps=r.ellipsoid.name,Ue(r,t)),r.prime_meridian&&(t.from_greenwich=r.prime_meridian.longitude*Math.PI/180);break;case`ellipsoid`:t.ellps=r.name,Ue(r,t);break;case`prime_meridian`:t.long0=(r.longitude||0)*Math.PI/180;break;case`coordinate_system`:if(r.axis){let e={east:`e`,north:`n`,west:`w`,south:`s`,up:`u`,down:`d`,geocentricx:`e`,geocentricy:`n`,geocentricz:`u`},n=r.axis.map(t=>e[t.direction.toLowerCase()]);if(n.every(Boolean)&&(t.axis=n.join(``),t.axis.length===2&&(t.axis+=`u`)),r.unit){let{units:e,to_meter:n}=Ve(r.unit);t.units=e,t.to_meter=n}else if(r.axis[0]&&r.axis[0].unit){let{units:e,to_meter:n}=Ve(r.axis[0].unit);t.units=e,t.to_meter=n}}break;case`id`:r.authority&&r.code&&(t.title=r.authority+`:`+r.code);break;case`conversion`:r.method&&r.method.name&&(t.projName=r.method.name),r.parameters&&r.parameters.forEach(e=>{let n=e.name.toLowerCase().replace(/\\s+/g,`_`),r=e.value;e.unit&&e.unit.conversion_factor?t[n]=r*e.unit.conversion_factor:e.unit===`degree`?t[n]=r*Math.PI/180:t[n]=r});break;case`unit`:r.name&&(t.units=r.name.toLowerCase(),t.units===`metre`&&(t.units=`meter`)),r.conversion_factor&&(t.to_meter=r.conversion_factor);break;case`base_crs`:We(r,t),t.datumCode=r.id?r.id.authority+`_`+r.id.code:r.name;break;default:break}}),t.latitude_of_false_origin!==void 0&&(t.lat0=t.latitude_of_false_origin),t.longitude_of_false_origin!==void 0&&(t.long0=t.longitude_of_false_origin),t.latitude_of_standard_parallel!==void 0&&(t.lat0=t.latitude_of_standard_parallel,t.lat1=t.latitude_of_standard_parallel),t.latitude_of_1st_standard_parallel!==void 0&&(t.lat1=t.latitude_of_1st_standard_parallel),t.latitude_of_2nd_standard_parallel!==void 0&&(t.lat2=t.latitude_of_2nd_standard_parallel),t.latitude_of_projection_centre!==void 0&&(t.lat0=t.latitude_of_projection_centre),t.longitude_of_projection_centre!==void 0&&(t.longc=t.longitude_of_projection_centre),t.easting_at_false_origin!==void 0&&(t.x0=t.easting_at_false_origin),t.northing_at_false_origin!==void 0&&(t.y0=t.northing_at_false_origin),t.latitude_of_natural_origin!==void 0&&(t.lat0=t.latitude_of_natural_origin),t.longitude_of_natural_origin!==void 0&&(t.long0=t.longitude_of_natural_origin),t.longitude_of_origin!==void 0&&(t.long0=t.longitude_of_origin),t.false_easting!==void 0&&(t.x0=t.false_easting),t.easting_at_projection_centre&&(t.x0=t.easting_at_projection_centre),t.false_northing!==void 0&&(t.y0=t.false_northing),t.northing_at_projection_centre&&(t.y0=t.northing_at_projection_centre),t.standard_parallel_1!==void 0&&(t.lat1=t.standard_parallel_1),t.standard_parallel_2!==void 0&&(t.lat2=t.standard_parallel_2),t.scale_factor_at_natural_origin!==void 0&&(t.k0=t.scale_factor_at_natural_origin),t.scale_factor_at_projection_centre!==void 0&&(t.k0=t.scale_factor_at_projection_centre),t.scale_factor_on_pseudo_standard_parallel!==void 0&&(t.k0=t.scale_factor_on_pseudo_standard_parallel),t.azimuth!==void 0&&(t.alpha=t.azimuth),t.azimuth_at_projection_centre!==void 0&&(t.alpha=t.azimuth_at_projection_centre),t.angle_from_rectified_to_skew_grid&&(t.rectified_grid_angle=t.angle_from_rectified_to_skew_grid),B(t),t)}var Ge=[`PROJECTEDCRS`,`PROJCRS`,`GEOGCS`,`GEOCCS`,`PROJCS`,`LOCAL_CS`,`GEODCRS`,`GEODETICCRS`,`GEODETICDATUM`,`ENGCRS`,`ENGINEERINGCRS`];function Ke(e,t){var n=t[0],r=t[1];!(n in e)&&r in e&&(e[n]=e[r],t.length===3&&(e[n]=t[2](e[n])))}function qe(e){for(var t=Object.keys(e),n=0,r=t.length;n<r;++n){var i=t[n];Ge.indexOf(i)!==-1&&Je(e[i]),typeof e[i]==`object`&&qe(e[i])}}function Je(e){if(e.AUTHORITY){var t=Object.keys(e.AUTHORITY)[0];t&&t in e.AUTHORITY&&(e.title=t+`:`+e.AUTHORITY[t])}if(e.type===`GEOGCS`?e.projName=`longlat`:e.type===`LOCAL_CS`?(e.projName=`identity`,e.local=!0):typeof e.PROJECTION==`object`?e.projName=Object.keys(e.PROJECTION)[0]:e.projName=e.PROJECTION,e.AXIS){for(var n=``,r=0,i=e.AXIS.length;r<i;++r){var a=[e.AXIS[r][0].toLowerCase(),e.AXIS[r][1].toLowerCase()];a[0].indexOf(`north`)!==-1||(a[0]===`y`||a[0]===`lat`)&&a[1]===`north`?n+=`n`:a[0].indexOf(`south`)!==-1||(a[0]===`y`||a[0]===`lat`)&&a[1]===`south`?n+=`s`:a[0].indexOf(`east`)!==-1||(a[0]===`x`||a[0]===`lon`)&&a[1]===`east`?n+=`e`:(a[0].indexOf(`west`)!==-1||(a[0]===`x`||a[0]===`lon`)&&a[1]===`west`)&&(n+=`w`)}n.length===2&&(n+=`u`),n.length===3&&(e.axis=n)}e.UNIT&&(e.units=e.UNIT.name.toLowerCase(),e.units===`metre`&&(e.units=`meter`),e.UNIT.convert&&(e.type===`GEOGCS`?e.DATUM&&e.DATUM.SPHEROID&&(e.to_meter=e.UNIT.convert*e.DATUM.SPHEROID.a):e.to_meter=e.UNIT.convert));var o=e.GEOGCS;e.type===`GEOGCS`&&(o=e),o&&(o.PRIMEM&&o.PRIMEM.convert&&(e.from_greenwich=Be(o.PRIMEM.convert)),o.DATUM?e.datumCode=o.DATUM.name.toLowerCase():e.datumCode=o.name.toLowerCase(),e.datumCode.slice(0,2)===`d_`&&(e.datumCode=e.datumCode.slice(2)),e.datumCode===`new_zealand_1949`&&(e.datumCode=`nzgd49`),(e.datumCode===`wgs_1984`||e.datumCode===`world_geodetic_system_1984`)&&(e.PROJECTION===`Mercator_Auxiliary_Sphere`&&(e.sphere=!0),e.datumCode=`wgs84`),e.datumCode===`belge_1972`&&(e.datumCode=`rnb72`),o.DATUM&&o.DATUM.SPHEROID&&(e.ellps=o.DATUM.SPHEROID.name.replace(`_19`,``).replace(/[Cc]larke\\_18/,`clrk`),e.ellps.toLowerCase().slice(0,13)===`international`&&(e.ellps=`intl`),e.a=o.DATUM.SPHEROID.a,e.rf=parseFloat(o.DATUM.SPHEROID.rf)),o.DATUM&&o.DATUM.TOWGS84&&(e.datum_params=o.DATUM.TOWGS84),~e.datumCode.indexOf(`osgb_1936`)&&(e.datumCode=`osgb36`),~e.datumCode.indexOf(`osni_1952`)&&(e.datumCode=`osni52`),(~e.datumCode.indexOf(`tm65`)||~e.datumCode.indexOf(`geodetic_datum_of_1965`))&&(e.datumCode=`ire65`),e.datumCode===`ch1903+`&&(e.datumCode=`ch1903`),~e.datumCode.indexOf(`israel`)&&(e.datumCode=`isr93`)),e.b&&!isFinite(e.b)&&(e.b=e.a),e.rectified_grid_angle&&=Be(e.rectified_grid_angle);function s(t){return t*(e.to_meter||1)}[[`standard_parallel_1`,`Standard_Parallel_1`],[`standard_parallel_1`,`Latitude of 1st standard parallel`],[`standard_parallel_2`,`Standard_Parallel_2`],[`standard_parallel_2`,`Latitude of 2nd standard parallel`],[`false_easting`,`False_Easting`],[`false_easting`,`False easting`],[`false-easting`,`Easting at false origin`],[`false_northing`,`False_Northing`],[`false_northing`,`False northing`],[`false_northing`,`Northing at false origin`],[`central_meridian`,`Central_Meridian`],[`central_meridian`,`Longitude of natural origin`],[`central_meridian`,`Longitude of false origin`],[`latitude_of_origin`,`Latitude_Of_Origin`],[`latitude_of_origin`,`Central_Parallel`],[`latitude_of_origin`,`Latitude of natural origin`],[`latitude_of_origin`,`Latitude of false origin`],[`scale_factor`,`Scale_Factor`],[`k0`,`scale_factor`],[`latitude_of_center`,`Latitude_Of_Center`],[`latitude_of_center`,`Latitude_of_center`],[`lat0`,`latitude_of_center`,Be],[`longitude_of_center`,`Longitude_Of_Center`],[`longitude_of_center`,`Longitude_of_center`],[`longc`,`longitude_of_center`,Be],[`x0`,`false_easting`,s],[`y0`,`false_northing`,s],[`long0`,`central_meridian`,Be],[`lat0`,`latitude_of_origin`,Be],[`lat0`,`standard_parallel_1`,Be],[`lat1`,`standard_parallel_1`,Be],[`lat2`,`standard_parallel_2`,Be],[`azimuth`,`Azimuth`],[`alpha`,`azimuth`,Be],[`srsCode`,`name`]].forEach(function(t){return Ke(e,t)}),B(e)}function Ye(e){if(typeof e==`object`)return We(e);let t=we(e);var n=Te(e);if(t===`WKT2`)return We(L(n));var r=n[0],i={};return Re(n,i),qe(i),i[r]}function V(e){var t=this;if(arguments.length===2){var n=arguments[1];typeof n==`string`?n.charAt(0)===`+`?V[e]=be(arguments[1]):V[e]=Ye(arguments[1]):n&&typeof n==`object`&&!(`projName`in n)?V[e]=Ye(arguments[1]):(V[e]=n,n||delete V[e])}else if(arguments.length===1){if(Array.isArray(e))return e.map(function(e){return Array.isArray(e)?V.apply(t,e):V(e)});if(typeof e==`string`){if(e in V)return V[e]}else`EPSG`in e?V[`EPSG:`+e.EPSG]=e:`ESRI`in e?V[`ESRI:`+e.ESRI]=e:`IAU2000`in e?V[`IAU2000:`+e.IAU2000]=e:console.log(e);return}}oe(V);function Xe(e){return typeof e==`string`}function Ze(e){return e in V}function Qe(e){return e.indexOf(`+`)!==0&&e.indexOf(`[`)!==-1||typeof e==`object`&&!(`srsCode`in e)}var H=[`3857`,`900913`,`3785`,`102113`];function $e(e){if(e.title)return e.title.toLowerCase().indexOf(`epsg:`)===0&&H.indexOf(e.title.substr(5))>-1;var t=F(e,`authority`);if(t){var n=F(t,`epsg`);return n&&H.indexOf(n)>-1}}function et(e){var t=F(e,`extension`);if(t)return F(t,`proj4`)}function tt(e){return e[0]===`+`}function nt(e){let t;if(Xe(e))if(Ze(e))t=V[e];else if(Qe(e)){t=Ye(e);var n=et(t);n&&(t=be(n))}else tt(e)&&(t=be(e));else t=`projName`in e?e:Ye(e);return t&&$e(t)?V[`EPSG:3857`]:t}function rt(e,t){e||={};var n,r;if(!t)return e;for(r in t)n=t[r],n!==void 0&&(e[r]=n);return e}function it(e,t,n){var r=e*t;return n/Math.sqrt(1-r*r)}function at(e){return e<0?-1:1}function U(e,t){return t||Math.abs(e)<=3.14159265359?e:e-at(e)*ge}function ot(e,t,n){var r=e*n,i=.5*e;return r=((1-r)/(1+r))**i,Math.tan(.5*(j-t))/r}function st(e,t){for(var n=.5*e,r,i,a=j-2*Math.atan(t),o=0;o<=15;o++)if(r=e*Math.sin(a),i=j-2*Math.atan(t*((1-r)/(1+r))**n)-a,a+=i,Math.abs(i)<=1e-10)return a;return-9999}function ct(){var e=this.b/this.a;this.es=1-e*e,`x0`in this||(this.x0=0),`y0`in this||(this.y0=0),this.e=Math.sqrt(this.es),this.lat_ts?this.sphere?this.k0=Math.cos(this.lat_ts):this.k0=it(this.e,Math.sin(this.lat_ts),Math.cos(this.lat_ts)):this.k0||(this.k?this.k0=this.k:this.k0=1)}function lt(e){var t=e.x,n=e.y;if(n*57.29577951308232>90&&n*57.29577951308232<-90&&t*57.29577951308232>180&&t*57.29577951308232<-180)return null;var r,i;if(Math.abs(Math.abs(n)-j)<=1e-10)return null;if(this.sphere)r=this.x0+this.a*this.k0*U(t-this.long0,this.over),i=this.y0+this.a*this.k0*Math.log(Math.tan(N+.5*n));else{var a=Math.sin(n),o=ot(this.e,n,a);r=this.x0+this.a*this.k0*U(t-this.long0,this.over),i=this.y0-this.a*this.k0*Math.log(o)}return e.x=r,e.y=i,e}function ut(e){var t=e.x-this.x0,n=e.y-this.y0,r,i;if(this.sphere)i=j-2*Math.atan(Math.exp(-n/(this.a*this.k0)));else{var a=Math.exp(-n/(this.a*this.k0));if(i=st(this.e,a),i===-9999)return null}return r=U(this.long0+t/(this.a*this.k0),this.over),e.x=r,e.y=i,e}var dt={init:ct,forward:lt,inverse:ut,names:[`Mercator`,`Popular Visualisation Pseudo Mercator`,`Mercator_1SP`,`Mercator_Auxiliary_Sphere`,`Mercator_Variant_A`,`merc`]};function ft(){}function pt(e){return e}var mt=[`longlat`,`identity`],ht=[dt,{init:ft,forward:pt,inverse:pt,names:mt}],gt={},_t=[];function vt(e,t){var n=_t.length;return e.names?(_t[n]=e,e.names.forEach(function(e){gt[e.toLowerCase()]=n}),this):(console.log(t),!0)}function yt(e){return e.replace(/[-\\(\\)\\s]+/g,` `).trim().replace(/ /g,`_`)}function bt(e){if(!e)return!1;var t=e.toLowerCase();if(gt[t]!==void 0&&_t[gt[t]]||(t=yt(t),t in gt&&_t[gt[t]]))return _t[gt[t]]}function xt(){ht.forEach(vt)}var St={start:xt,add:vt,get:bt},Ct={MERIT:{a:6378137,rf:298.257,ellipseName:`MERIT 1983`},SGS85:{a:6378136,rf:298.257,ellipseName:`Soviet Geodetic System 85`},GRS80:{a:6378137,rf:298.257222101,ellipseName:`GRS 1980(IUGG, 1980)`},IAU76:{a:6378140,rf:298.257,ellipseName:`IAU 1976`},airy:{a:6377563.396,b:6356256.91,ellipseName:`Airy 1830`},APL4:{a:6378137,rf:298.25,ellipseName:`Appl. Physics. 1965`},NWL9D:{a:6378145,rf:298.25,ellipseName:`Naval Weapons Lab., 1965`},mod_airy:{a:6377340.189,b:6356034.446,ellipseName:`Modified Airy`},andrae:{a:6377104.43,rf:300,ellipseName:`Andrae 1876 (Den., Iclnd.)`},aust_SA:{a:6378160,rf:298.25,ellipseName:`Australian Natl & S. Amer. 1969`},GRS67:{a:6378160,rf:298.247167427,ellipseName:`GRS 67(IUGG 1967)`},bessel:{a:6377397.155,rf:299.1528128,ellipseName:`Bessel 1841`},bess_nam:{a:6377483.865,rf:299.1528128,ellipseName:`Bessel 1841 (Namibia)`},clrk66:{a:6378206.4,b:6356583.8,ellipseName:`Clarke 1866`},clrk80:{a:6378249.145,rf:293.4663,ellipseName:`Clarke 1880 mod.`},clrk80ign:{a:6378249.2,b:6356515,rf:293.4660213,ellipseName:`Clarke 1880 (IGN)`},clrk58:{a:6378293.645208759,rf:294.2606763692654,ellipseName:`Clarke 1858`},CPM:{a:6375738.7,rf:334.29,ellipseName:`Comm. des Poids et Mesures 1799`},delmbr:{a:6376428,rf:311.5,ellipseName:`Delambre 1810 (Belgium)`},engelis:{a:6378136.05,rf:298.2566,ellipseName:`Engelis 1985`},evrst30:{a:6377276.345,rf:300.8017,ellipseName:`Everest 1830`},evrst48:{a:6377304.063,rf:300.8017,ellipseName:`Everest 1948`},evrst56:{a:6377301.243,rf:300.8017,ellipseName:`Everest 1956`},evrst69:{a:6377295.664,rf:300.8017,ellipseName:`Everest 1969`},evrstSS:{a:6377298.556,rf:300.8017,ellipseName:`Everest (Sabah & Sarawak)`},fschr60:{a:6378166,rf:298.3,ellipseName:`Fischer (Mercury Datum) 1960`},fschr60m:{a:6378155,rf:298.3,ellipseName:`Fischer 1960`},fschr68:{a:6378150,rf:298.3,ellipseName:`Fischer 1968`},helmert:{a:6378200,rf:298.3,ellipseName:`Helmert 1906`},hough:{a:6378270,rf:297,ellipseName:`Hough`},intl:{a:6378388,rf:297,ellipseName:`International 1909 (Hayford)`},kaula:{a:6378163,rf:298.24,ellipseName:`Kaula 1961`},lerch:{a:6378139,rf:298.257,ellipseName:`Lerch 1979`},mprts:{a:6397300,rf:191,ellipseName:`Maupertius 1738`},new_intl:{a:6378157.5,b:6356772.2,ellipseName:`New International 1967`},plessis:{a:6376523,rf:6355863,ellipseName:`Plessis 1817 (France)`},krass:{a:6378245,rf:298.3,ellipseName:`Krassovsky, 1942`},SEasia:{a:6378155,b:6356773.3205,ellipseName:`Southeast Asia`},walbeck:{a:6376896,b:6355834.8467,ellipseName:`Walbeck`},WGS60:{a:6378165,rf:298.3,ellipseName:`WGS 60`},WGS66:{a:6378145,rf:298.25,ellipseName:`WGS 66`},WGS7:{a:6378135,rf:298.26,ellipseName:`WGS 72`},WGS84:{a:6378137,rf:298.257223563,ellipseName:`WGS 84`},sphere:{a:6370997,b:6370997,ellipseName:`Normal Sphere (r=6370997)`}};let wt=Ct.WGS84;function Tt(e,t,n,r){var i=e*e,a=t*t,o=(i-a)/i,s=0;r?(e*=1-o*(de+o*(fe+o*pe)),i=e*e,o=0):s=Math.sqrt(o);var c=(i-a)/a;return{es:o,e:s,ep2:c}}function W(e,t,n,r,i){if(!e){var a=F(Ct,r);a||=wt,e=a.a,t=a.b,n=a.rf}return n&&!t&&(t=(1-1/n)*e),(n===0||Math.abs(e-t)<1e-10)&&(i=!0,t=e),{a:e,b:t,rf:n,sphere:i}}var Et={wgs84:{towgs84:`0,0,0`,ellipse:`WGS84`,datumName:`WGS84`},ch1903:{towgs84:`674.374,15.056,405.346`,ellipse:`bessel`,datumName:`swiss`},ggrs87:{towgs84:`-199.87,74.79,246.62`,ellipse:`GRS80`,datumName:`Greek_Geodetic_Reference_System_1987`},nad83:{towgs84:`0,0,0`,ellipse:`GRS80`,datumName:`North_American_Datum_1983`},nad27:{nadgrids:`@conus,@alaska,@ntv2_0.gsb,@ntv1_can.dat`,ellipse:`clrk66`,datumName:`North_American_Datum_1927`},potsdam:{towgs84:`598.1,73.7,418.2,0.202,0.045,-2.455,6.7`,ellipse:`bessel`,datumName:`Potsdam Rauenberg 1950 DHDN`},carthage:{towgs84:`-263.0,6.0,431.0`,ellipse:`clark80`,datumName:`Carthage 1934 Tunisia`},hermannskogel:{towgs84:`577.326,90.129,463.919,5.137,1.474,5.297,2.4232`,ellipse:`bessel`,datumName:`Hermannskogel`},mgi:{towgs84:`577.326,90.129,463.919,5.137,1.474,5.297,2.4232`,ellipse:`bessel`,datumName:`Militar-Geographische Institut`},osni52:{towgs84:`482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15`,ellipse:`airy`,datumName:`Irish National`},ire65:{towgs84:`482.530,-130.596,564.557,-1.042,-0.214,-0.631,8.15`,ellipse:`mod_airy`,datumName:`Ireland 1965`},rassadiran:{towgs84:`-133.63,-157.5,-158.62`,ellipse:`intl`,datumName:`Rassadiran`},nzgd49:{towgs84:`59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993`,ellipse:`intl`,datumName:`New Zealand Geodetic Datum 1949`},osgb36:{towgs84:`446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894`,ellipse:`airy`,datumName:`Ordnance Survey of Great Britain 1936`},s_jtsk:{towgs84:`589,76,480`,ellipse:`bessel`,datumName:`S-JTSK (Ferro)`},beduaram:{towgs84:`-106,-87,188`,ellipse:`clrk80`,datumName:`Beduaram`},gunung_segara:{towgs84:`-403,684,41`,ellipse:`bessel`,datumName:`Gunung Segara Jakarta`},rnb72:{towgs84:`106.869,-52.2978,103.724,-0.33657,0.456955,-1.84218,1`,ellipse:`intl`,datumName:`Reseau National Belge 1972`},EPSG_5451:{towgs84:`6.41,-49.05,-11.28,1.5657,0.5242,6.9718,-5.7649`},IGNF_LURESG:{towgs84:`-192.986,13.673,-39.309,-0.4099,-2.9332,2.6881,0.43`},EPSG_4614:{towgs84:`-119.4248,-303.65872,-11.00061,1.164298,0.174458,1.096259,3.657065`},EPSG_4615:{towgs84:`-494.088,-312.129,279.877,-1.423,-1.013,1.59,-0.748`},ESRI_37241:{towgs84:`-76.822,257.457,-12.817,2.136,-0.033,-2.392,-0.031`},ESRI_37249:{towgs84:`-440.296,58.548,296.265,1.128,10.202,4.559,-0.438`},ESRI_37245:{towgs84:`-511.151,-181.269,139.609,1.05,2.703,1.798,3.071`},EPSG_4178:{towgs84:`24.9,-126.4,-93.2,-0.063,-0.247,-0.041,1.01`},EPSG_4622:{towgs84:`-472.29,-5.63,-304.12,0.4362,-0.8374,0.2563,1.8984`},EPSG_4625:{towgs84:`126.93,547.94,130.41,-2.7867,5.1612,-0.8584,13.8227`},EPSG_5252:{towgs84:`0.023,0.036,-0.068,0.00176,0.00912,-0.01136,0.00439`},EPSG_4314:{towgs84:`597.1,71.4,412.1,0.894,0.068,-1.563,7.58`},EPSG_4282:{towgs84:`-178.3,-316.7,-131.5,5.278,6.077,10.979,19.166`},EPSG_4231:{towgs84:`-83.11,-97.38,-117.22,0.005693,-0.044698,0.044285,0.1218`},EPSG_4274:{towgs84:`-230.994,102.591,25.199,0.633,-0.239,0.9,1.95`},EPSG_4134:{towgs84:`-180.624,-225.516,173.919,-0.81,-1.898,8.336,16.71006`},EPSG_4254:{towgs84:`18.38,192.45,96.82,0.056,-0.142,-0.2,-0.0013`},EPSG_4159:{towgs84:`-194.513,-63.978,-25.759,-3.4027,3.756,-3.352,-0.9175`},EPSG_4687:{towgs84:`0.072,-0.507,-0.245,0.0183,-0.0003,0.007,-0.0093`},EPSG_4227:{towgs84:`-83.58,-397.54,458.78,-17.595,-2.847,4.256,3.225`},EPSG_4746:{towgs84:`599.4,72.4,419.2,-0.062,-0.022,-2.723,6.46`},EPSG_4745:{towgs84:`612.4,77,440.2,-0.054,0.057,-2.797,2.55`},EPSG_6311:{towgs84:`8.846,-4.394,-1.122,-0.00237,-0.146528,0.130428,0.783926`},EPSG_4289:{towgs84:`565.7381,50.4018,465.2904,-0.395026,0.330772,-1.876073,4.07244`},EPSG_4230:{towgs84:`-68.863,-134.888,-111.49,-0.53,-0.14,0.57,-3.4`},EPSG_4154:{towgs84:`-123.02,-158.95,-168.47`},EPSG_4156:{towgs84:`570.8,85.7,462.8,4.998,1.587,5.261,3.56`},EPSG_4299:{towgs84:`482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15`},EPSG_4179:{towgs84:`33.4,-146.6,-76.3,-0.359,-0.053,0.844,-0.84`},EPSG_4313:{towgs84:`-106.8686,52.2978,-103.7239,0.3366,-0.457,1.8422,-1.2747`},EPSG_4194:{towgs84:`163.511,127.533,-159.789`},EPSG_4195:{towgs84:`105,326,-102.5`},EPSG_4196:{towgs84:`-45,417,-3.5`},EPSG_4611:{towgs84:`-162.619,-276.959,-161.764,0.067753,-2.243648,-1.158828,-1.094246`},EPSG_4633:{towgs84:`137.092,131.66,91.475,-1.9436,-11.5993,-4.3321,-7.4824`},EPSG_4641:{towgs84:`-408.809,366.856,-412.987,1.8842,-0.5308,2.1655,-121.0993`},EPSG_4643:{towgs84:`-480.26,-438.32,-643.429,16.3119,20.1721,-4.0349,-111.7002`},EPSG_4300:{towgs84:`482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15`},EPSG_4188:{towgs84:`482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15`},EPSG_4660:{towgs84:`982.6087,552.753,-540.873,6.681627,-31.611492,-19.848161,16.805`},EPSG_4662:{towgs84:`97.295,-263.247,310.882,-1.5999,0.8386,3.1409,13.3259`},EPSG_3906:{towgs84:`577.88891,165.22205,391.18289,4.9145,-0.94729,-13.05098,7.78664`},EPSG_4307:{towgs84:`-209.3622,-87.8162,404.6198,0.0046,3.4784,0.5805,-1.4547`},EPSG_6892:{towgs84:`-76.269,-16.683,68.562,-6.275,10.536,-4.286,-13.686`},EPSG_4690:{towgs84:`221.597,152.441,176.523,2.403,1.3893,0.884,11.4648`},EPSG_4691:{towgs84:`218.769,150.75,176.75,3.5231,2.0037,1.288,10.9817`},EPSG_4629:{towgs84:`72.51,345.411,79.241,-1.5862,-0.8826,-0.5495,1.3653`},EPSG_4630:{towgs84:`165.804,216.213,180.26,-0.6251,-0.4515,-0.0721,7.4111`},EPSG_4692:{towgs84:`217.109,86.452,23.711,0.0183,-0.0003,0.007,-0.0093`},EPSG_9333:{towgs84:`0,0,0,-0.008393,0.000749,-0.010276,0`},EPSG_9059:{towgs84:`0,0,0`},EPSG_4312:{towgs84:`601.705,84.263,485.227,4.7354,1.3145,5.393,-2.3887`},EPSG_4123:{towgs84:`-96.062,-82.428,-121.753,4.801,0.345,-1.376,1.496`},EPSG_4309:{towgs84:`-124.45,183.74,44.64,-0.4384,0.5446,-0.9706,-2.1365`},ESRI_104106:{towgs84:`-283.088,-70.693,117.445,-1.157,0.059,-0.652,-4.058`},EPSG_4281:{towgs84:`-219.247,-73.802,269.529`},EPSG_4322:{towgs84:`0,0,4.5`},EPSG_4324:{towgs84:`0,0,1.9`},EPSG_4284:{towgs84:`43.822,-108.842,-119.585,1.455,-0.761,0.737,0.549`},EPSG_4277:{towgs84:`446.448,-125.157,542.06,0.15,0.247,0.842,-20.489`},EPSG_4207:{towgs84:`-282.1,-72.2,120,-1.529,0.145,-0.89,-4.46`},EPSG_4688:{towgs84:`347.175,1077.618,2623.677,33.9058,-70.6776,9.4013,186.0647`},EPSG_4689:{towgs84:`410.793,54.542,80.501,-2.5596,-2.3517,-0.6594,17.3218`},EPSG_4720:{towgs84:`0,0,4.5`},EPSG_4273:{towgs84:`278.3,93,474.5,7.889,0.05,-6.61,6.21`},EPSG_4240:{towgs84:`204.64,834.74,293.8`},EPSG_4817:{towgs84:`278.3,93,474.5,7.889,0.05,-6.61,6.21`},ESRI_104131:{towgs84:`426.62,142.62,460.09,4.98,4.49,-12.42,-17.1`},EPSG_4265:{towgs84:`-104.1,-49.1,-9.9,0.971,-2.917,0.714,-11.68`},EPSG_4263:{towgs84:`-111.92,-87.85,114.5,1.875,0.202,0.219,0.032`},EPSG_4298:{towgs84:`-689.5937,623.84046,-65.93566,-0.02331,1.17094,-0.80054,5.88536`},EPSG_4270:{towgs84:`-253.4392,-148.452,386.5267,0.15605,0.43,-0.1013,-0.0424`},EPSG_4229:{towgs84:`-121.8,98.1,-10.7`},EPSG_4220:{towgs84:`-55.5,-348,-229.2`},EPSG_4214:{towgs84:`12.646,-155.176,-80.863`},EPSG_4232:{towgs84:`-345,3,223`},EPSG_4238:{towgs84:`-1.977,-13.06,-9.993,0.364,0.254,0.689,-1.037`},EPSG_4168:{towgs84:`-170,33,326`},EPSG_4131:{towgs84:`199,931,318.9`},EPSG_4152:{towgs84:`-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0`},EPSG_5228:{towgs84:`572.213,85.334,461.94,4.9732,1.529,5.2484,3.5378`},EPSG_8351:{towgs84:`485.021,169.465,483.839,7.786342,4.397554,4.102655,0`},EPSG_4683:{towgs84:`-127.62,-67.24,-47.04,-3.068,4.903,1.578,-1.06`},EPSG_4133:{towgs84:`0,0,0`},EPSG_7373:{towgs84:`0.819,-0.5762,-1.6446,-0.00378,-0.03317,0.00318,0.0693`},EPSG_9075:{towgs84:`-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0`},EPSG_9072:{towgs84:`-0.9102,2.0141,0.5602,0.029039,0.010065,0.010101,0`},EPSG_9294:{towgs84:`1.16835,-1.42001,-2.24431,-0.00822,-0.05508,0.01818,0.23388`},EPSG_4212:{towgs84:`-267.434,173.496,181.814,-13.4704,8.7154,7.3926,14.7492`},EPSG_4191:{towgs84:`-44.183,-0.58,-38.489,2.3867,2.7072,-3.5196,-8.2703`},EPSG_4237:{towgs84:`52.684,-71.194,-13.975,-0.312,-0.1063,-0.3729,1.0191`},EPSG_4740:{towgs84:`-1.08,-0.27,-0.9`},EPSG_4124:{towgs84:`419.3836,99.3335,591.3451,0.850389,1.817277,-7.862238,-0.99496`},EPSG_5681:{towgs84:`584.9636,107.7175,413.8067,1.1155,0.2824,-3.1384,7.9922`},EPSG_4141:{towgs84:`23.772,17.49,17.859,-0.3132,-1.85274,1.67299,-5.4262`},EPSG_4204:{towgs84:`-85.645,-273.077,-79.708,2.289,-1.421,2.532,3.194`},EPSG_4319:{towgs84:`226.702,-193.337,-35.371,-2.229,-4.391,9.238,0.9798`},EPSG_4200:{towgs84:`24.82,-131.21,-82.66`},EPSG_4130:{towgs84:`0,0,0`},EPSG_4127:{towgs84:`-82.875,-57.097,-156.768,-2.158,1.524,-0.982,-0.359`},EPSG_4149:{towgs84:`674.374,15.056,405.346`},EPSG_4617:{towgs84:`-0.991,1.9072,0.5129,0.02579,0.00965,0.01166,0`},EPSG_4663:{towgs84:`-210.502,-66.902,-48.476,2.094,-15.067,-5.817,0.485`},EPSG_4664:{towgs84:`-211.939,137.626,58.3,-0.089,0.251,0.079,0.384`},EPSG_4665:{towgs84:`-105.854,165.589,-38.312,-0.003,-0.026,0.024,-0.048`},EPSG_4666:{towgs84:`631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43`},EPSG_4756:{towgs84:`-192.873,-39.382,-111.202,-0.00205,-0.0005,0.00335,0.0188`},EPSG_4723:{towgs84:`-179.483,-69.379,-27.584,-7.862,8.163,6.042,-13.925`},EPSG_4726:{towgs84:`8.853,-52.644,180.304,-0.393,-2.323,2.96,-24.081`},EPSG_4267:{towgs84:`-8.0,160.0,176.0`},EPSG_5365:{towgs84:`-0.16959,0.35312,0.51846,0.03385,-0.16325,0.03446,0.03693`},EPSG_4218:{towgs84:`304.5,306.5,-318.1`},EPSG_4242:{towgs84:`-33.722,153.789,94.959,-8.581,-4.478,4.54,8.95`},EPSG_4216:{towgs84:`-292.295,248.758,429.447,4.9971,2.99,6.6906,1.0289`},ESRI_104105:{towgs84:`631.392,-66.551,481.442,1.09,-4.445,-4.487,-4.43`},ESRI_104129:{towgs84:`0,0,0`},EPSG_4673:{towgs84:`174.05,-25.49,112.57`},EPSG_4202:{towgs84:`-124,-60,154`},EPSG_4203:{towgs84:`-117.763,-51.51,139.061,0.292,0.443,0.277,-0.191`},EPSG_3819:{towgs84:`595.48,121.69,515.35,4.115,-2.9383,0.853,-3.408`},EPSG_8694:{towgs84:`-93.799,-132.737,-219.073,-1.844,0.648,-6.37,-0.169`},EPSG_4145:{towgs84:`275.57,676.78,229.6`},EPSG_4283:{towgs84:`0.06155,-0.01087,-0.04019,0.039492,0.032722,0.032898,-0.009994`},EPSG_4317:{towgs84:`2.3287,-147.0425,-92.0802,-0.309248,0.324822,0.497299,5.689063`},EPSG_4272:{towgs84:`59.47,-5.04,187.44,0.47,-0.1,1.024,-4.5993`},EPSG_4248:{towgs84:`-307.7,265.3,-363.5`},EPSG_5561:{towgs84:`24,-121,-76`},EPSG_5233:{towgs84:`-0.293,766.95,87.713,0.195704,1.695068,3.473016,-0.039338`},ESRI_104130:{towgs84:`-86,-98,-119`},ESRI_104102:{towgs84:`682,-203,480`},ESRI_37207:{towgs84:`7,-10,-26`},EPSG_4675:{towgs84:`59.935,118.4,-10.871`},ESRI_104109:{towgs84:`-89.121,-348.182,260.871`},ESRI_104112:{towgs84:`-185.583,-230.096,281.361`},ESRI_104113:{towgs84:`25.1,-275.6,222.6`},IGNF_WGS72G:{towgs84:`0,12,6`},IGNF_NTFG:{towgs84:`-168,-60,320`},IGNF_EFATE57G:{towgs84:`-127,-769,472`},IGNF_PGP50G:{towgs84:`324.8,153.6,172.1`},IGNF_REUN47G:{towgs84:`94,-948,-1262`},IGNF_CSG67G:{towgs84:`-186,230,110`},IGNF_GUAD48G:{towgs84:`-467,-16,-300`},IGNF_TAHI51G:{towgs84:`162,117,154`},IGNF_TAHAAG:{towgs84:`65,342,77`},IGNF_NUKU72G:{towgs84:`84,274,65`},IGNF_PETRELS72G:{towgs84:`365,194,166`},IGNF_WALL78G:{towgs84:`253,-133,-127`},IGNF_MAYO50G:{towgs84:`-382,-59,-262`},IGNF_TANNAG:{towgs84:`-139,-967,436`},IGNF_IGN72G:{towgs84:`-13,-348,292`},IGNF_ATIGG:{towgs84:`1118,23,66`},IGNF_FANGA84G:{towgs84:`150.57,158.33,118.32`},IGNF_RUSAT84G:{towgs84:`202.13,174.6,-15.74`},IGNF_KAUE70G:{towgs84:`126.74,300.1,-75.49`},IGNF_MOP90G:{towgs84:`-10.8,-1.8,12.77`},IGNF_MHPF67G:{towgs84:`338.08,212.58,-296.17`},IGNF_TAHI79G:{towgs84:`160.61,116.05,153.69`},IGNF_ANAA92G:{towgs84:`1.5,3.84,4.81`},IGNF_MARQUI72G:{towgs84:`330.91,-13.92,58.56`},IGNF_APAT86G:{towgs84:`143.6,197.82,74.05`},IGNF_TUBU69G:{towgs84:`237.17,171.61,-77.84`},IGNF_STPM50G:{towgs84:`11.363,424.148,373.13`},EPSG_4150:{towgs84:`674.374,15.056,405.346`},EPSG_4754:{towgs84:`-208.4058,-109.8777,-2.5764`},ESRI_104101:{towgs84:`372.87,149.23,585.29`},EPSG_4693:{towgs84:`0,-0.15,0.68`},EPSG_6207:{towgs84:`293.17,726.18,245.36`},EPSG_4153:{towgs84:`-133.63,-157.5,-158.62`},EPSG_4132:{towgs84:`-241.54,-163.64,396.06`},EPSG_4221:{towgs84:`-154.5,150.7,100.4`},EPSG_4266:{towgs84:`-80.7,-132.5,41.1`},EPSG_4193:{towgs84:`-70.9,-151.8,-41.4`},EPSG_5340:{towgs84:`-0.41,0.46,-0.35`},EPSG_4246:{towgs84:`-294.7,-200.1,525.5`},EPSG_4318:{towgs84:`-3.2,-5.7,2.8`},EPSG_4121:{towgs84:`-199.87,74.79,246.62`},EPSG_4223:{towgs84:`-260.1,5.5,432.2`},EPSG_4158:{towgs84:`-0.465,372.095,171.736`},EPSG_4285:{towgs84:`-128.16,-282.42,21.93`},EPSG_4613:{towgs84:`-404.78,685.68,45.47`},EPSG_4607:{towgs84:`195.671,332.517,274.607`},EPSG_4475:{towgs84:`-381.788,-57.501,-256.673`},EPSG_4208:{towgs84:`-157.84,308.54,-146.6`},EPSG_4743:{towgs84:`70.995,-335.916,262.898`},EPSG_4710:{towgs84:`-323.65,551.39,-491.22`},EPSG_7881:{towgs84:`-0.077,0.079,0.086`},EPSG_4682:{towgs84:`283.729,735.942,261.143`},EPSG_4739:{towgs84:`-156,-271,-189`},EPSG_4679:{towgs84:`-80.01,253.26,291.19`},EPSG_4750:{towgs84:`-56.263,16.136,-22.856`},EPSG_4644:{towgs84:`-10.18,-350.43,291.37`},EPSG_4695:{towgs84:`-103.746,-9.614,-255.95`},EPSG_4292:{towgs84:`-355,21,72`},EPSG_4302:{towgs84:`-61.702,284.488,472.052`},EPSG_4143:{towgs84:`-124.76,53,466.79`},EPSG_4606:{towgs84:`-153,153,307`},EPSG_4699:{towgs84:`-770.1,158.4,-498.2`},EPSG_4247:{towgs84:`-273.5,110.6,-357.9`},EPSG_4160:{towgs84:`8.88,184.86,106.69`},EPSG_4161:{towgs84:`-233.43,6.65,173.64`},EPSG_9251:{towgs84:`-9.5,122.9,138.2`},EPSG_9253:{towgs84:`-78.1,101.6,133.3`},EPSG_4297:{towgs84:`-198.383,-240.517,-107.909`},EPSG_4269:{towgs84:`0,0,0`},EPSG_4301:{towgs84:`-147,506,687`},EPSG_4618:{towgs84:`-59,-11,-52`},EPSG_4612:{towgs84:`0,0,0`},EPSG_4678:{towgs84:`44.585,-131.212,-39.544`},EPSG_4250:{towgs84:`-130,29,364`},EPSG_4144:{towgs84:`214,804,268`},EPSG_4147:{towgs84:`-17.51,-108.32,-62.39`},EPSG_4259:{towgs84:`-254.1,-5.36,-100.29`},EPSG_4164:{towgs84:`-76,-138,67`},EPSG_4211:{towgs84:`-378.873,676.002,-46.255`},EPSG_4182:{towgs84:`-422.651,-172.995,84.02`},EPSG_4224:{towgs84:`-143.87,243.37,-33.52`},EPSG_4225:{towgs84:`-205.57,168.77,-4.12`},EPSG_5527:{towgs84:`-67.35,3.88,-38.22`},EPSG_4752:{towgs84:`98,390,-22`},EPSG_4310:{towgs84:`-30,190,89`},EPSG_9248:{towgs84:`-192.26,65.72,132.08`},EPSG_4680:{towgs84:`124.5,-63.5,-281`},EPSG_4701:{towgs84:`-79.9,-158,-168.9`},EPSG_4706:{towgs84:`-146.21,112.63,4.05`},EPSG_4805:{towgs84:`682,-203,480`},EPSG_4201:{towgs84:`-165,-11,206`},EPSG_4210:{towgs84:`-157,-2,-299`},EPSG_4183:{towgs84:`-104,167,-38`},EPSG_4139:{towgs84:`11,72,-101`},EPSG_4668:{towgs84:`-86,-98,-119`},EPSG_4717:{towgs84:`-2,151,181`},EPSG_4732:{towgs84:`102,52,-38`},EPSG_4280:{towgs84:`-377,681,-50`},EPSG_4209:{towgs84:`-138,-105,-289`},EPSG_4261:{towgs84:`31,146,47`},EPSG_4658:{towgs84:`-73,46,-86`},EPSG_4721:{towgs84:`265.025,384.929,-194.046`},EPSG_4222:{towgs84:`-136,-108,-292`},EPSG_4601:{towgs84:`-255,-15,71`},EPSG_4602:{towgs84:`725,685,536`},EPSG_4603:{towgs84:`72,213.7,93`},EPSG_4605:{towgs84:`9,183,236`},EPSG_4621:{towgs84:`137,248,-430`},EPSG_4657:{towgs84:`-28,199,5`},EPSG_4316:{towgs84:`103.25,-100.4,-307.19`},EPSG_4642:{towgs84:`-13,-348,292`},EPSG_4698:{towgs84:`145,-187,103`},EPSG_4192:{towgs84:`-206.1,-174.7,-87.7`},EPSG_4311:{towgs84:`-265,120,-358`},EPSG_4135:{towgs84:`58,-283,-182`},ESRI_104138:{towgs84:`198,-226,-347`},EPSG_4245:{towgs84:`-11,851,5`},EPSG_4142:{towgs84:`-125,53,467`},EPSG_4213:{towgs84:`-106,-87,188`},EPSG_4253:{towgs84:`-133,-77,-51`},EPSG_4129:{towgs84:`-132,-110,-335`},EPSG_4713:{towgs84:`-77,-128,142`},EPSG_4239:{towgs84:`217,823,299`},EPSG_4146:{towgs84:`295,736,257`},EPSG_4155:{towgs84:`-83,37,124`},EPSG_4165:{towgs84:`-173,253,27`},EPSG_4672:{towgs84:`175,-38,113`},EPSG_4236:{towgs84:`-637,-549,-203`},EPSG_4251:{towgs84:`-90,40,88`},EPSG_4271:{towgs84:`-2,374,172`},EPSG_4175:{towgs84:`-88,4,101`},EPSG_4716:{towgs84:`298,-304,-375`},EPSG_4315:{towgs84:`-23,259,-9`},EPSG_4744:{towgs84:`-242.2,-144.9,370.3`},EPSG_4244:{towgs84:`-97,787,86`},EPSG_4293:{towgs84:`616,97,-251`},EPSG_4714:{towgs84:`-127,-769,472`},EPSG_4736:{towgs84:`260,12,-147`},EPSG_6883:{towgs84:`-235,-110,393`},EPSG_6894:{towgs84:`-63,176,185`},EPSG_4205:{towgs84:`-43,-163,45`},EPSG_4256:{towgs84:`41,-220,-134`},EPSG_4262:{towgs84:`639,405,60`},EPSG_4604:{towgs84:`174,359,365`},EPSG_4169:{towgs84:`-115,118,426`},EPSG_4620:{towgs84:`-106,-129,165`},EPSG_4184:{towgs84:`-203,141,53`},EPSG_4616:{towgs84:`-289,-124,60`},EPSG_9403:{towgs84:`-307,-92,127`},EPSG_4684:{towgs84:`-133,-321,50`},EPSG_4708:{towgs84:`-491,-22,435`},EPSG_4707:{towgs84:`114,-116,-333`},EPSG_4709:{towgs84:`145,75,-272`},EPSG_4712:{towgs84:`-205,107,53`},EPSG_4711:{towgs84:`124,-234,-25`},EPSG_4718:{towgs84:`230,-199,-752`},EPSG_4719:{towgs84:`211,147,111`},EPSG_4724:{towgs84:`208,-435,-229`},EPSG_4725:{towgs84:`189,-79,-202`},EPSG_4735:{towgs84:`647,1777,-1124`},EPSG_4722:{towgs84:`-794,119,-298`},EPSG_4728:{towgs84:`-307,-92,127`},EPSG_4734:{towgs84:`-632,438,-609`},EPSG_4727:{towgs84:`912,-58,1227`},EPSG_4729:{towgs84:`185,165,42`},EPSG_4730:{towgs84:`170,42,84`},EPSG_4733:{towgs84:`276,-57,149`},ESRI_37218:{towgs84:`230,-199,-752`},ESRI_37240:{towgs84:`-7,215,225`},ESRI_37221:{towgs84:`252,-209,-751`},ESRI_4305:{towgs84:`-123,-206,219`},ESRI_104139:{towgs84:`-73,-247,227`},EPSG_4748:{towgs84:`51,391,-36`},EPSG_4219:{towgs84:`-384,664,-48`},EPSG_4255:{towgs84:`-333,-222,114`},EPSG_4257:{towgs84:`-587.8,519.75,145.76`},EPSG_4646:{towgs84:`-963,510,-359`},EPSG_6881:{towgs84:`-24,-203,268`},EPSG_6882:{towgs84:`-183,-15,273`},EPSG_4715:{towgs84:`-104,-129,239`},IGNF_RGF93GDD:{towgs84:`0,0,0`},IGNF_RGM04GDD:{towgs84:`0,0,0`},IGNF_RGSPM06GDD:{towgs84:`0,0,0`},IGNF_RGTAAF07GDD:{towgs84:`0,0,0`},IGNF_RGFG95GDD:{towgs84:`0,0,0`},IGNF_RGNCG:{towgs84:`0,0,0`},IGNF_RGPFGDD:{towgs84:`0,0,0`},IGNF_ETRS89G:{towgs84:`0,0,0`},IGNF_RGR92GDD:{towgs84:`0,0,0`},EPSG_4173:{towgs84:`0,0,0`},EPSG_4180:{towgs84:`0,0,0`},EPSG_4619:{towgs84:`0,0,0`},EPSG_4667:{towgs84:`0,0,0`},EPSG_4075:{towgs84:`0,0,0`},EPSG_6706:{towgs84:`0,0,0`},EPSG_7798:{towgs84:`0,0,0`},EPSG_4661:{towgs84:`0,0,0`},EPSG_4669:{towgs84:`0,0,0`},EPSG_8685:{towgs84:`0,0,0`},EPSG_4151:{towgs84:`0,0,0`},EPSG_9702:{towgs84:`0,0,0`},EPSG_4758:{towgs84:`0,0,0`},EPSG_4761:{towgs84:`0,0,0`},EPSG_4765:{towgs84:`0,0,0`},EPSG_8997:{towgs84:`0,0,0`},EPSG_4023:{towgs84:`0,0,0`},EPSG_4670:{towgs84:`0,0,0`},EPSG_4694:{towgs84:`0,0,0`},EPSG_4148:{towgs84:`0,0,0`},EPSG_4163:{towgs84:`0,0,0`},EPSG_4167:{towgs84:`0,0,0`},EPSG_4189:{towgs84:`0,0,0`},EPSG_4190:{towgs84:`0,0,0`},EPSG_4176:{towgs84:`0,0,0`},EPSG_4659:{towgs84:`0,0,0`},EPSG_3824:{towgs84:`0,0,0`},EPSG_3889:{towgs84:`0,0,0`},EPSG_4046:{towgs84:`0,0,0`},EPSG_4081:{towgs84:`0,0,0`},EPSG_4558:{towgs84:`0,0,0`},EPSG_4483:{towgs84:`0,0,0`},EPSG_5013:{towgs84:`0,0,0`},EPSG_5264:{towgs84:`0,0,0`},EPSG_5324:{towgs84:`0,0,0`},EPSG_5354:{towgs84:`0,0,0`},EPSG_5371:{towgs84:`0,0,0`},EPSG_5373:{towgs84:`0,0,0`},EPSG_5381:{towgs84:`0,0,0`},EPSG_5393:{towgs84:`0,0,0`},EPSG_5489:{towgs84:`0,0,0`},EPSG_5593:{towgs84:`0,0,0`},EPSG_6135:{towgs84:`0,0,0`},EPSG_6365:{towgs84:`0,0,0`},EPSG_5246:{towgs84:`0,0,0`},EPSG_7886:{towgs84:`0,0,0`},EPSG_8431:{towgs84:`0,0,0`},EPSG_8427:{towgs84:`0,0,0`},EPSG_8699:{towgs84:`0,0,0`},EPSG_8818:{towgs84:`0,0,0`},EPSG_4757:{towgs84:`0,0,0`},EPSG_9140:{towgs84:`0,0,0`},EPSG_8086:{towgs84:`0,0,0`},EPSG_4686:{towgs84:`0,0,0`},EPSG_4737:{towgs84:`0,0,0`},EPSG_4702:{towgs84:`0,0,0`},EPSG_4747:{towgs84:`0,0,0`},EPSG_4749:{towgs84:`0,0,0`},EPSG_4674:{towgs84:`0,0,0`},EPSG_4755:{towgs84:`0,0,0`},EPSG_4759:{towgs84:`0,0,0`},EPSG_4762:{towgs84:`0,0,0`},EPSG_4763:{towgs84:`0,0,0`},EPSG_4764:{towgs84:`0,0,0`},EPSG_4166:{towgs84:`0,0,0`},EPSG_4170:{towgs84:`0,0,0`},EPSG_5546:{towgs84:`0,0,0`},EPSG_7844:{towgs84:`0,0,0`},EPSG_4818:{towgs84:`589,76,480`},EPSG_10328:{towgs84:`0,0,0`},EPSG_9782:{towgs84:`0,0,0`},EPSG_9777:{towgs84:`0,0,0`},EPSG_10690:{towgs84:`0,0,0`},EPSG_10639:{towgs84:`0,0,0`},EPSG_10739:{towgs84:`0,0,0`},EPSG_7686:{towgs84:`0,0,0`},EPSG_8900:{towgs84:`0,0,0`},EPSG_5886:{towgs84:`0,0,0`},EPSG_7683:{towgs84:`0,0,0`},EPSG_6668:{towgs84:`0,0,0`},EPSG_20046:{towgs84:`0,0,0`},EPSG_10299:{towgs84:`0,0,0`},EPSG_10310:{towgs84:`0,0,0`},EPSG_10475:{towgs84:`0,0,0`},EPSG_4742:{towgs84:`0,0,0`},EPSG_10671:{towgs84:`0,0,0`},EPSG_10762:{towgs84:`0,0,0`},EPSG_10725:{towgs84:`0,0,0`},EPSG_10791:{towgs84:`0,0,0`},EPSG_10800:{towgs84:`0,0,0`},EPSG_10305:{towgs84:`0,0,0`},EPSG_10941:{towgs84:`0,0,0`},EPSG_10968:{towgs84:`0,0,0`},EPSG_10875:{towgs84:`0,0,0`},EPSG_6318:{towgs84:`0,0,0`},EPSG_10910:{towgs84:`0,0,0`}};for(var Dt in Et){var Ot=Et[Dt];Ot.datumName&&(Et[Ot.datumName]=Ot)}function kt(e,t,n,r,i,a,o){var s={};return s.datum_type=5,t&&(s.datum_type=4,s.datum_params=t.map(parseFloat),(s.datum_params[0]!==0||s.datum_params[1]!==0||s.datum_params[2]!==0)&&(s.datum_type=1),s.datum_params.length>3&&(s.datum_params[3]!==0||s.datum_params[4]!==0||s.datum_params[5]!==0||s.datum_params[6]!==0)&&(s.datum_type=2,s.datum_params[3]*=ue,s.datum_params[4]*=ue,s.datum_params[5]*=ue,s.datum_params[6]=s.datum_params[6]/1e6+1)),o&&(s.datum_type=3,s.grids=o),s.a=n,s.b=r,s.es=i,s.ep2=a,s}var At={};function jt(e,t,n){return t instanceof ArrayBuffer?Mt(e,t,n):{ready:Nt(e,t)}}function Mt(e,t,n){var r=!0;n!==void 0&&n.includeErrorFields===!1&&(r=!1);var i=new DataView(t),a=G(i),o=Rt(i,a),s={header:o,subgrids:Bt(i,o,a,r)};return At[e]=s,s}async function Nt(e,t){for(var n=[],r=await t.getImageCount(),i=r-1;i>=0;i--){var a=await t.getImage(i),o=await a.readRasters(),s=[a.getWidth(),a.getHeight()],c=a.getBoundingBox().map(It),l=typeof a.fileDirectory.getValue==`function`?a.fileDirectory.getValue(`ModelPixelScale`):a.fileDirectory.ModelPixelScale,u=[l[0],l[1]].map(It),d=c[0]+(s[0]-1)*u[0],f=c[3]-(s[1]-1)*u[1],p=o[0],m=o[1],h=[];for(let e=s[1]-1;e>=0;e--)for(let t=s[0]-1;t>=0;t--){var g=e*s[0]+t;h.push([-Lt(m[g]),Lt(p[g])])}n.push({del:u,lim:s,ll:[-d,f],cvs:h})}var _={header:{nSubgrids:r},subgrids:n};return At[e]=_,_}function Pt(e){return e===void 0?null:e.split(`,`).map(Ft)}function Ft(e){if(e.length===0)return null;var t=e[0]===`@`;return t&&(e=e.slice(1)),e===`null`?{name:`null`,mandatory:!t,grid:null,isNull:!0}:{name:e,mandatory:!t,grid:At[e]||null,isNull:!1}}function It(e){return e*Math.PI/180}function Lt(e){return e/3600*Math.PI/180}function G(e){var t=e.getInt32(8,!1);return t===11?!1:(t=e.getInt32(8,!0),t!==11&&console.warn(`Failed to detect nadgrid endian-ness, defaulting to little-endian`),!0)}function Rt(e,t){return{nFields:e.getInt32(8,t),nSubgridFields:e.getInt32(24,t),nSubgrids:e.getInt32(40,t),shiftType:zt(e,56,64).trim(),fromSemiMajorAxis:e.getFloat64(120,t),fromSemiMinorAxis:e.getFloat64(136,t),toSemiMajorAxis:e.getFloat64(152,t),toSemiMinorAxis:e.getFloat64(168,t)}}function zt(e,t,n){return String.fromCharCode.apply(null,new Uint8Array(e.buffer.slice(t,n)))}function Bt(e,t,n,r){for(var i=176,a=[],o=0;o<t.nSubgrids;o++){var s=Ht(e,i,n),c=Ut(e,i,s,n,r),l=Math.round(1+(s.upperLongitude-s.lowerLongitude)/s.longitudeInterval),u=Math.round(1+(s.upperLatitude-s.lowerLatitude)/s.latitudeInterval);a.push({ll:[Lt(s.lowerLongitude),Lt(s.lowerLatitude)],del:[Lt(s.longitudeInterval),Lt(s.latitudeInterval)],lim:[l,u],count:s.gridNodeCount,cvs:Vt(c)});var d=16;r===!1&&(d=8),i+=176+s.gridNodeCount*d}return a}function Vt(e){return e.map(function(e){return[Lt(e.longitudeShift),Lt(e.latitudeShift)]})}function Ht(e,t,n){return{name:zt(e,t+8,t+16).trim(),parent:zt(e,t+24,t+24+8).trim(),lowerLatitude:e.getFloat64(t+72,n),upperLatitude:e.getFloat64(t+88,n),lowerLongitude:e.getFloat64(t+104,n),upperLongitude:e.getFloat64(t+120,n),latitudeInterval:e.getFloat64(t+136,n),longitudeInterval:e.getFloat64(t+152,n),gridNodeCount:e.getInt32(t+168,n)}}function Ut(e,t,n,r,i){var a=t+176,o=16;i===!1&&(o=8);for(var s=[],c=0;c<n.gridNodeCount;c++){var l={latitudeShift:e.getFloat32(a+c*o,r),longitudeShift:e.getFloat32(a+c*o+4,r)};i!==!1&&(l.latitudeAccuracy=e.getFloat32(a+c*o+8,r),l.longitudeAccuracy=e.getFloat32(a+c*o+12,r)),s.push(l)}return s}function K(e,t){if(!(this instanceof K))return new K(e);this.forward=null,this.inverse=null,this.init=null,this.name,this.axis,this.names=null,this.title,t||=function(e){if(e)throw e};var n=nt(e);if(typeof n!=`object`){t(`Could not parse to valid json: `+e);return}var r=K.projections.get(n.projName);if(!r){t(`Could not get projection name from: `+e);return}if(n.datumCode&&n.datumCode!==`none`){var i=F(Et,n.datumCode);i&&(n.datum_params=n.datum_params||(i.towgs84?i.towgs84.split(`,`):null),n.ellps=i.ellipse,n.datumName=i.datumName?i.datumName:n.datumCode)}n.k0=n.k0||1,n.axis=n.axis||`enu`,n.ellps=n.ellps||`wgs84`,n.lat1=n.lat1||n.lat0;var a=W(n.a,n.b,n.rf,n.ellps,n.sphere),o=Tt(a.a,a.b,a.rf,n.R_A),s=Pt(n.nadgrids),c=n.datum||kt(n.datumCode,n.datum_params,a.a,a.b,o.es,o.ep2,s);rt(this,n),rt(this,r),this.a=a.a,this.b=a.b,this.rf=a.rf,this.sphere=a.sphere,this.es=o.es,this.e=o.e,this.ep2=o.ep2,this.datum=c,`init`in this&&typeof this.init==`function`&&this.init(),t(null,this)}K.projections=St,K.projections.start();function Wt(e,t){return e.datum_type===t.datum_type?e.a!==t.a||Math.abs(e.es-t.es)>5e-11?!1:e.datum_type===1?e.datum_params[0]===t.datum_params[0]&&e.datum_params[1]===t.datum_params[1]&&e.datum_params[2]===t.datum_params[2]:e.datum_type!==2||e.datum_params[0]===t.datum_params[0]&&e.datum_params[1]===t.datum_params[1]&&e.datum_params[2]===t.datum_params[2]&&e.datum_params[3]===t.datum_params[3]&&e.datum_params[4]===t.datum_params[4]&&e.datum_params[5]===t.datum_params[5]&&e.datum_params[6]===t.datum_params[6]:!1}function Gt(e,t,n){var r=e.x,i=e.y,a=e.z?e.z:0,o,s,c,l;if(i<-j&&i>-1.001*j)i=-j;else if(i>j&&i<1.001*j)i=j;else if(i<-j)return{x:-1/0,y:-1/0,z:e.z};else if(i>j)return{x:1/0,y:1/0,z:e.z};return r>Math.PI&&(r-=2*Math.PI),s=Math.sin(i),l=Math.cos(i),c=s*s,o=n/Math.sqrt(1-t*c),{x:(o+a)*l*Math.cos(r),y:(o+a)*l*Math.sin(r),z:(o*(1-t)+a)*s}}function Kt(e,t,n,r){var i=1e-12,a=i*i,o=30,s,c,l,u,d,f,p,m,h,g,_,v,y,b=e.x,x=e.y,S=e.z?e.z:0,C,w,T;if(s=Math.sqrt(b*b+x*x),c=Math.sqrt(b*b+x*x+S*S),s/n<i){if(C=0,c/n<i)return w=j,T=-r,{x:e.x,y:e.y,z:e.z}}else C=Math.atan2(x,b);l=S/c,u=s/c,d=1/Math.sqrt(1-t*(2-t)*u*u),m=u*(1-t)*d,h=l*d,y=0;do y++,p=n/Math.sqrt(1-t*h*h),T=s*m+S*h-p*(1-t*h*h),f=t*p/(p+T),d=1/Math.sqrt(1-f*(2-f)*u*u),g=u*(1-f)*d,_=l*d,v=_*m-g*h,m=g,h=_;while(v*v>a&&y<o);return w=Math.atan(_/Math.abs(g)),{x:C,y:w,z:T}}function qt(e,t,n){if(t===1)return{x:e.x+n[0],y:e.y+n[1],z:e.z+n[2]};if(t===2){var r=n[0],i=n[1],a=n[2],o=n[3],s=n[4],c=n[5],l=n[6];return{x:l*(e.x-c*e.y+s*e.z)+r,y:l*(c*e.x+e.y-o*e.z)+i,z:l*(-s*e.x+o*e.y+e.z)+a}}}function Jt(e,t,n){if(t===1)return{x:e.x-n[0],y:e.y-n[1],z:e.z-n[2]};if(t===2){var r=n[0],i=n[1],a=n[2],o=n[3],s=n[4],c=n[5],l=n[6],u=(e.x-r)/l,d=(e.y-i)/l,f=(e.z-a)/l;return{x:u+c*d-s*f,y:-c*u+d+o*f,z:s*u-o*d+f}}}function Yt(e){return e===1||e===2}function Xt(e,t,n){if(Wt(e,t)||e.datum_type===5||t.datum_type===5)return n;var r=e.a,i=e.es;if(e.datum_type===3){if(Zt(e,!1,n)!==0)return;r=se,i=le}var a=t.a,o=t.b,s=t.es;if(t.datum_type===3&&(a=se,o=ce,s=le),i===s&&r===a&&!Yt(e.datum_type)&&!Yt(t.datum_type)||(n=Gt(n,i,r),Yt(e.datum_type)&&(n=qt(n,e.datum_type,e.datum_params)),Yt(t.datum_type)&&(n=Jt(n,t.datum_type,t.datum_params)),n=Kt(n,s,a,o),!(t.datum_type===3&&Zt(t,!0,n)!==0)))return n}function Zt(e,t,n){if(e.grids===null||e.grids.length===0)return console.log(`Grid shift grids not found`),-1;var r={x:-n.x,y:n.y},i={x:NaN,y:NaN},a=[];outer:for(var o=0;o<e.grids.length;o++){var s=e.grids[o];if(a.push(s.name),s.isNull){i=r;break}if(s.grid===null){if(s.mandatory)return console.log(`Unable to find mandatory grid '`+s.name+`'`),-1;continue}for(var c=s.grid.subgrids,l=0,u=c.length;l<u;l++){var d=c[l],f=(Math.abs(d.del[1])+Math.abs(d.del[0]))/1e4,p=d.ll[0]-f,m=d.ll[1]-f,h=d.ll[0]+(d.lim[0]-1)*d.del[0]+f,g=d.ll[1]+(d.lim[1]-1)*d.del[1]+f;if(!(m>r.y||p>r.x||g<r.y||h<r.x)&&(i=Qt(r,t,d),!isNaN(i.x)))break outer}}return isNaN(i.x)?(console.log(`Failed to find a grid shift table for location '`+-r.x*he+` `+r.y*he+` tried: '`+a+`'`),-1):(n.x=-i.x,n.y=i.y,0)}function Qt(e,t,n){var r={x:NaN,y:NaN};if(isNaN(e.x))return r;var i={x:e.x,y:e.y};i.x-=n.ll[0],i.y-=n.ll[1],i.x=U(i.x-Math.PI)+Math.PI;var a=$t(i,n);if(t){if(isNaN(a.x))return r;a.x=i.x-a.x,a.y=i.y-a.y;var o=9,s=1e-12,c,l;do{if(l=$t(a,n),isNaN(l.x)){console.log(`Inverse grid shift iteration failed, presumably at grid edge.  Using first approximation.`);break}c={x:i.x-(l.x+a.x),y:i.y-(l.y+a.y)},a.x+=c.x,a.y+=c.y}while(o--&&Math.abs(c.x)>s&&Math.abs(c.y)>s);if(o<0)return console.log(`Inverse grid shift iterator failed to converge.`),r;r.x=U(a.x+n.ll[0]),r.y=a.y+n.ll[1]}else isNaN(a.x)||(r.x=e.x+a.x,r.y=e.y+a.y);return r}function $t(e,t){var n={x:e.x/t.del[0],y:e.y/t.del[1]},r={x:Math.floor(n.x),y:Math.floor(n.y)},i={x:n.x-1*r.x,y:n.y-1*r.y},a={x:NaN,y:NaN},o;if(r.x<0||r.x>=t.lim[0]||r.y<0||r.y>=t.lim[1])return a;o=r.y*t.lim[0]+r.x;var s={x:t.cvs[o][0],y:t.cvs[o][1]};o++;var c={x:t.cvs[o][0],y:t.cvs[o][1]};o+=t.lim[0];var l={x:t.cvs[o][0],y:t.cvs[o][1]};o--;var u={x:t.cvs[o][0],y:t.cvs[o][1]},d=i.x*i.y,f=i.x*(1-i.y),p=(1-i.x)*(1-i.y),m=(1-i.x)*i.y;return a.x=p*s.x+f*c.x+m*u.x+d*l.x,a.y=p*s.y+f*c.y+m*u.y+d*l.y,a}var q=[`x`,`y`,`z`];function en(e,t){let n={};for(let r=0,i=e.axis.length;r<i;r++){if(r===2&&t.z===void 0)continue;let i=t[q[r]];switch(e.axis[r]){case`e`:n.x=i;break;case`w`:n.x=-i;break;case`n`:n.y=i;break;case`s`:n.y=-i;break;case`u`:n.z=i;break;case`d`:n.z=-i;break;default:return null}}return n}function tn(e,t){let n={};for(let r=0,i=e.axis.length;r<i;r++)if(!(r===2&&t.z===void 0))switch(e.axis[r]){case`e`:n[q[r]]=t.x;break;case`w`:n[q[r]]=-t.x;break;case`n`:n[q[r]]=t.y;break;case`s`:n[q[r]]=-t.y;break;case`u`:n[q[r]]=t.z;break;case`d`:n[q[r]]=-t.z;break;default:return null}return n}function nn(e){var t={x:e[0],y:e[1]};return e.length>2&&(t.z=e[2]),e.length>3&&(t.m=e[3]),t}function rn(e){an(e.x),an(e.y)}function an(e){if(typeof Number.isFinite==`function`){if(Number.isFinite(e))return;throw TypeError(`coordinates must be finite numbers`)}if(typeof e!=`number`||e!==e||!isFinite(e))throw TypeError(`coordinates must be finite numbers`)}function on(e,t){return(e.datum.datum_type===1||e.datum.datum_type===2||e.datum.datum_type===3)&&t.datumCode!==`WGS84`||(t.datum.datum_type===1||t.datum.datum_type===2||t.datum.datum_type===3)&&e.datumCode!==`WGS84`}function J(e,t,n,r){var i,a=n.z!==void 0;if(rn(n),e.datum&&t.datum&&on(e,t)&&(i=new K(`WGS84`),n=J(e,i,n,r),e=i),r&&e.axis!==`enu`&&(n=en(e,n)),e.projName===`longlat`)n={x:n.x*M,y:n.y*M,z:n.z||0};else if(e.to_meter&&(n={x:n.x*e.to_meter,y:n.y*e.to_meter,z:n.z||0}),n=e.inverse(n),!n)return;if(e.from_greenwich&&(n.x+=e.from_greenwich),n=Xt(e.datum,t.datum,n),n)return n=n,t.from_greenwich&&(n={x:n.x-t.from_greenwich,y:n.y,z:n.z||0}),t.projName===`longlat`?n={x:n.x*he,y:n.y*he,z:n.z||0}:(n=t.forward(n),t.to_meter&&(n={x:n.x/t.to_meter,y:n.y/t.to_meter,z:n.z||0})),r&&t.axis!==`enu`?tn(t,n):(n&&!a&&t.projName!==`geocent`&&delete n.z,n)}function sn(e,t,n,r){return J(e,t,Array.isArray(n)?nn(n):{x:n.x,y:n.y,z:n.z,m:n.m},r)}var cn=K(`WGS84`);function ln(e,t,n,r){var i,a,o;return Array.isArray(n)?(i=J(e,t,nn(n),r)||{x:NaN,y:NaN},n.length>2?(a=e.name!==void 0&&e.name===`geocent`||t.name!==void 0&&t.name===`geocent`,a?typeof i.z==`number`?[i.x,i.y,i.z].concat(n.slice(3)):[i.x,i.y,n[2]].concat(n.slice(3)):r&&typeof i.z==`number`?[i.x,i.y,i.z].concat(n.slice(3)):[i.x,i.y].concat(n.slice(2))):[i.x,i.y]):(i=J(e,t,{x:n.x,y:n.y,z:n.z,m:n.m},r)||{x:NaN,y:NaN},o=Object.keys(n),o.length===2?i:(a=e.name!==void 0&&e.name===`geocent`||t.name!==void 0&&t.name===`geocent`,o.forEach(function(e){e===`x`||e===`y`||e===`z`&&(a||r)||(i[e]=n[e])}),i))}function un(e){return e instanceof K?e:typeof e==`object`&&`oProj`in e?e.oProj:K(e)}function dn(e,t,n){var r,i,a=!1,o;return t===void 0?(i=un(e),r=cn,a=!0):(t.x!==void 0||Array.isArray(t))&&(n=t,i=un(e),r=cn,a=!0),r||=un(e),i||=un(t),n?ln(r,i,n):(o={forward:function(e,t){return ln(r,i,e,t)},inverse:function(e,t){return ln(i,r,e,t)}},a&&(o.oProj=i),o)}var fn=6,pn=`AJSAJS`,mn=`AFAFAF`,hn=65,Y=73,gn=79,_n=86,vn=90,yn={forward:bn,inverse:xn,toPoint:Sn};function bn(e,t){return t||=5,On(Tn({lat:e[1],lon:e[0]}),t)}function xn(e){var t=En(Mn(e.toUpperCase()));return t.lat&&t.lon?[t.lon,t.lat,t.lon,t.lat]:[t.left,t.bottom,t.right,t.top]}function Sn(e){var t=En(Mn(e.toUpperCase()));return t.lat&&t.lon?[t.lon,t.lat]:[(t.left+t.right)/2,(t.top+t.bottom)/2]}function Cn(e){return Math.PI/180*e}function wn(e){return e/Math.PI*180}function Tn(e){var t=e.lat,n=e.lon,r=6378137,i=.00669438,a=.9996,o,s,c,l,u,d,f,p=Cn(t),m=Cn(n),h,g=Math.floor((n+180)/6)+1;n===180&&(g=60),t>=56&&t<64&&n>=3&&n<12&&(g=32),t>=72&&t<84&&(n>=0&&n<9?g=31:n>=9&&n<21?g=33:n>=21&&n<33?g=35:n>=33&&n<42&&(g=37)),o=(g-1)*6-180+3,h=Cn(o),s=i/(1-i),c=r/Math.sqrt(1-i*Math.sin(p)*Math.sin(p)),l=Math.tan(p)*Math.tan(p),u=s*Math.cos(p)*Math.cos(p),d=Math.cos(p)*(m-h),f=r*((1-i/4-3*i*i/64-5*i*i*i/256)*p-(3*i/8+3*i*i/32+45*i*i*i/1024)*Math.sin(2*p)+(15*i*i/256+45*i*i*i/1024)*Math.sin(4*p)-35*i*i*i/3072*Math.sin(6*p));var _=a*c*(d+(1-l+u)*d*d*d/6+(5-18*l+l*l+72*u-58*s)*d*d*d*d*d/120)+5e5,v=a*(f+c*Math.tan(p)*(d*d/2+(5-l+9*u+4*u*u)*d*d*d*d/24+(61-58*l+l*l+600*u-330*s)*d*d*d*d*d*d/720));return t<0&&(v+=1e7),{northing:Math.round(v),easting:Math.round(_),zoneNumber:g,zoneLetter:Dn(t)}}function En(e){var t=e.northing,n=e.easting,r=e.zoneLetter,i=e.zoneNumber;if(i<0||i>60)return null;var a=.9996,o=6378137,s=.00669438,c,l=(1-Math.sqrt(1-s))/(1+Math.sqrt(1-s)),u,d,f,p,m,h,g,_,v,y=n-5e5,b=t;r<`N`&&(b-=1e7),g=(i-1)*6-180+3,c=s/(1-s),h=b/a,_=h/(o*(1-s/4-3*s*s/64-5*s*s*s/256)),v=_+(3*l/2-27*l*l*l/32)*Math.sin(2*_)+(21*l*l/16-55*l*l*l*l/32)*Math.sin(4*_)+151*l*l*l/96*Math.sin(6*_),u=o/Math.sqrt(1-s*Math.sin(v)*Math.sin(v)),d=Math.tan(v)*Math.tan(v),f=c*Math.cos(v)*Math.cos(v),p=o*(1-s)/(1-s*Math.sin(v)*Math.sin(v))**1.5,m=y/(u*a);var x=v-u*Math.tan(v)/p*(m*m/2-(5+3*d+10*f-4*f*f-9*c)*m*m*m*m/24+(61+90*d+298*f+45*d*d-252*c-3*f*f)*m*m*m*m*m*m/720);x=wn(x);var S=(m-(1+2*d+f)*m*m*m/6+(5-2*f+28*d-3*f*f+8*c+24*d*d)*m*m*m*m*m/120)/Math.cos(v);S=g+wn(S);var C;if(e.accuracy){var w=En({northing:e.northing+e.accuracy,easting:e.easting+e.accuracy,zoneLetter:e.zoneLetter,zoneNumber:e.zoneNumber});C={top:w.lat,right:w.lon,bottom:x,left:S}}else C={lat:x,lon:S};return C}function Dn(e){var t=`Z`;return 84>=e&&e>=72?t=`X`:72>e&&e>=64?t=`W`:64>e&&e>=56?t=`V`:56>e&&e>=48?t=`U`:48>e&&e>=40?t=`T`:40>e&&e>=32?t=`S`:32>e&&e>=24?t=`R`:24>e&&e>=16?t=`Q`:16>e&&e>=8?t=`P`:8>e&&e>=0?t=`N`:0>e&&e>=-8?t=`M`:-8>e&&e>=-16?t=`L`:-16>e&&e>=-24?t=`K`:-24>e&&e>=-32?t=`J`:-32>e&&e>=-40?t=`H`:-40>e&&e>=-48?t=`G`:-48>e&&e>=-56?t=`F`:-56>e&&e>=-64?t=`E`:-64>e&&e>=-72?t=`D`:-72>e&&e>=-80&&(t=`C`),t}function On(e,t){var n=`00000`+e.easting,r=`00000`+e.northing;return e.zoneNumber+e.zoneLetter+kn(e.easting,e.northing,e.zoneNumber)+n.substr(n.length-5,t)+r.substr(r.length-5,t)}function kn(e,t,n){var r=An(n);return jn(Math.floor(e/1e5),Math.floor(t/1e5)%20,r)}function An(e){var t=e%fn;return t===0&&(t=fn),t}function jn(e,t,n){var r=n-1,i=pn.charCodeAt(r),a=mn.charCodeAt(r),o=i+e-1,s=a+t,c=!1;return o>vn&&(o=o-vn+hn-1,c=!0),(o===Y||i<Y&&o>Y||(o>Y||i<Y)&&c)&&o++,(o===gn||i<gn&&o>gn||(o>gn||i<gn)&&c)&&(o++,o===Y&&o++),o>vn&&(o=o-vn+hn-1),s>_n?(s=s-_n+hn-1,c=!0):c=!1,(s===Y||a<Y&&s>Y||(s>Y||a<Y)&&c)&&s++,(s===gn||a<gn&&s>gn||(s>gn||a<gn)&&c)&&(s++,s===Y&&s++),s>_n&&(s=s-_n+hn-1),String.fromCharCode(o)+String.fromCharCode(s)}function Mn(e){if(e&&e.length===0)throw`MGRSPoint coverting from nothing`;for(var t=e.length,n=null,r=``,i,a=0;!/[A-Z]/.test(i=e.charAt(a));){if(a>=2)throw`MGRSPoint bad conversion from: `+e;r+=i,a++}var o=parseInt(r,10);if(a===0||a+3>t)throw`MGRSPoint bad conversion from: `+e;var s=e.charAt(a++);if(s<=`A`||s===`B`||s===`Y`||s>=`Z`||s===`I`||s===`O`)throw`MGRSPoint zone letter `+s+` not handled: `+e;n=e.substring(a,a+=2);for(var c=An(o),l=Nn(n.charAt(0),c),u=Pn(n.charAt(1),c);u<Fn(s);)u+=2e6;var d=t-a;if(d%2!=0)throw`MGRSPoint has to have an even number \nof digits after the zone letter and two 100km letters - front \nhalf for easting meters, second half for \nnorthing meters`+e;var f=d/2,p=0,m=0,h,g,_,v,y;return f>0&&(h=1e5/10**f,g=e.substring(a,a+f),p=parseFloat(g)*h,_=e.substring(a+f),m=parseFloat(_)*h),v=p+l,y=m+u,{easting:v,northing:y,zoneLetter:s,zoneNumber:o,accuracy:h}}function Nn(e,t){for(var n=pn.charCodeAt(t-1),r=1e5,i=!1;n!==e.charCodeAt(0);){if(n++,n===Y&&n++,n===gn&&n++,n>vn){if(i)throw`Bad character: `+e;n=hn,i=!0}r+=1e5}return r}function Pn(e,t){if(e>`V`)throw`MGRSPoint given invalid Northing `+e;for(var n=mn.charCodeAt(t-1),r=0,i=!1;n!==e.charCodeAt(0);){if(n++,n===Y&&n++,n===gn&&n++,n>_n){if(i)throw`Bad character: `+e;n=hn,i=!0}r+=1e5}return r}function Fn(e){var t;switch(e){case`C`:t=11e5;break;case`D`:t=2e6;break;case`E`:t=28e5;break;case`F`:t=37e5;break;case`G`:t=46e5;break;case`H`:t=55e5;break;case`J`:t=64e5;break;case`K`:t=73e5;break;case`L`:t=82e5;break;case`M`:t=91e5;break;case`N`:t=0;break;case`P`:t=8e5;break;case`Q`:t=17e5;break;case`R`:t=26e5;break;case`S`:t=35e5;break;case`T`:t=44e5;break;case`U`:t=53e5;break;case`V`:t=62e5;break;case`W`:t=7e6;break;case`X`:t=79e5;break;default:t=-1}if(t>=0)return t;throw`Invalid zone letter: `+e}function In(e,t,n){if(!(this instanceof In))return new In(e,t,n);if(Array.isArray(e))this.x=e[0],this.y=e[1],this.z=e[2]||0;else if(typeof e==`object`)this.x=e.x,this.y=e.y,this.z=e.z||0;else if(typeof e==`string`&&t===void 0){var r=e.split(`,`);this.x=parseFloat(r[0]),this.y=parseFloat(r[1]),this.z=parseFloat(r[2])||0}else this.x=e,this.y=t,this.z=n||0;console.warn(`proj4.Point will be removed in version 3, use proj4.toPoint`)}In.fromMGRS=function(e){return new In(Sn(e))},In.prototype.toMGRS=function(e){return bn([this.x,this.y],e)};var Ln=1,Rn=.25,zn=.046875,Bn=.01953125,Vn=.01068115234375,Hn=.75,Un=.46875,Wn=.013020833333333334,Gn=.007120768229166667,Kn=.3645833333333333,qn=.005696614583333333,Jn=.3076171875;function X(e){var t=[];t[0]=Ln-e*(Rn+e*(zn+e*(Bn+e*Vn))),t[1]=e*(Hn-e*(zn+e*(Bn+e*Vn)));var n=e*e;return t[2]=n*(Un-e*(Wn+e*Gn)),n*=e,t[3]=n*(Kn-e*qn),t[4]=n*e*Jn,t}function Yn(e,t,n,r){return n*=t,t*=t,r[0]*e-n*(r[1]+t*(r[2]+t*(r[3]+t*r[4])))}var Xn=20;function Zn(e,t,n){for(var r=1/(1-t),i=e,a=Xn;a;--a){var o=Math.sin(i),s=1-t*o*o;if(s=(Yn(i,o,Math.cos(i),n)-e)*(s*Math.sqrt(s))*r,i-=s,Math.abs(s)<1e-10)return i}return i}function Qn(){this.x0=this.x0===void 0?0:this.x0,this.y0=this.y0===void 0?0:this.y0,this.long0=this.long0===void 0?0:this.long0,this.lat0=this.lat0===void 0?0:this.lat0,this.es&&(this.en=X(this.es),this.ml0=Yn(this.lat0,Math.sin(this.lat0),Math.cos(this.lat0),this.en))}function $n(e){var t=e.x,n=e.y,r=U(t-this.long0,this.over),i,a,o,s=Math.sin(n),c=Math.cos(n);if(this.es){var l=c*r,u=l**2,d=this.ep2*c**2,f=d**2,p=(Math.abs(c)>1e-10?Math.tan(n):0)**2,m=p**2;i=1-this.es*s**2,l/=Math.sqrt(i);var h=Yn(n,s,c,this.en);a=this.a*(this.k0*l*(1+u/6*(1-p+d+u/20*(5-18*p+m+14*d-58*p*d+u/42*(61+179*m-m*p-479*p)))))+this.x0,o=this.a*(this.k0*(h-this.ml0+s*r*l/2*(1+u/12*(5-p+9*d+4*f+u/30*(61+m-58*p+270*d-330*p*d+u/56*(1385+543*m-m*p-3111*p))))))+this.y0}else{var g=c*Math.sin(r);if(Math.abs(Math.abs(g)-1)<1e-10)return 93;if(a=.5*this.a*this.k0*Math.log((1+g)/(1-g))+this.x0,o=c*Math.cos(r)/Math.sqrt(1-g**2),g=Math.abs(o),g>=1){if(g-1>1e-10)return 93;o=0}else o=Math.acos(o);n<0&&(o=-o),o=this.a*this.k0*(o-this.lat0)+this.y0}return e.x=a,e.y=o,e}function er(e){var t,n,r,i,a=(e.x-this.x0)*(1/this.a),o=(e.y-this.y0)*(1/this.a);if(!this.es){var s=Math.exp(a/this.k0),c=.5*(s-1/s),l=this.lat0+o/this.k0,u=Math.cos(l);t=Math.sqrt((1-u**2)/(1+c**2)),r=Math.asin(t),o<0&&(r=-r),i=c===0&&u===0?0:U(Math.atan2(c,u)+this.long0,this.over)}else if(t=this.ml0+o/this.k0,n=Zn(t,this.es,this.en),Math.abs(n)<j){var d=Math.sin(n),f=Math.cos(n),p=Math.abs(f)>1e-10?Math.tan(n):0,m=this.ep2*f**2,h=m**2,g=p**2,_=g**2;t=1-this.es*d**2;var v=a*Math.sqrt(t)/this.k0,y=v**2;t*=p,r=n-t*y/(1-this.es)*.5*(1-y/12*(5+3*g-9*m*g+m-4*h-y/30*(61+90*g-252*m*g+45*_+46*m-y/56*(1385+3633*g+4095*_+1574*_*g)))),i=U(this.long0+v*(1-y/6*(1+2*g+m-y/20*(5+28*g+24*_+8*m*g+6*m-y/42*(61+662*g+1320*_+720*_*g))))/f,this.over)}else r=j*at(o),i=0;return e.x=i,e.y=r,e}var tr={init:Qn,forward:$n,inverse:er,names:[`Fast_Transverse_Mercator`,`Fast Transverse Mercator`]};function nr(e){var t=Math.exp(e);return t=(t-1/t)/2,t}function Z(e,t){e=Math.abs(e),t=Math.abs(t);var n=Math.max(e,t),r=Math.min(e,t)/(n||1);return n*Math.sqrt(1+r**2)}function rr(e){var t=1+e,n=t-1;return n===0?e:e*Math.log(t)/n}function ir(e){var t=Math.abs(e);return t=rr(t*(1+t/(Z(1,t)+1))),e<0?-t:t}function ar(e,t){for(var n=2*Math.cos(2*t),r=e.length-1,i=e[r],a=0,o;--r>=0;)o=-a+n*i+e[r],a=i,i=o;return t+o*Math.sin(2*t)}function or(e,t){for(var n=2*Math.cos(t),r=e.length-1,i=e[r],a=0,o;--r>=0;)o=-a+n*i+e[r],a=i,i=o;return Math.sin(t)*o}function sr(e){var t=Math.exp(e);return t=(t+1/t)/2,t}function cr(e,t,n){for(var r=Math.sin(t),i=Math.cos(t),a=nr(n),o=sr(n),s=2*i*o,c=-2*r*a,l=e.length-1,u=e[l],d=0,f=0,p=0,m,h;--l>=0;)m=f,h=d,f=u,d=p,u=-m+s*f-c*d+e[l],p=-h+c*f+s*d;return s=r*o,c=i*a,[s*u-c*p,s*p+c*u]}function lr(){if(!this.approx&&(isNaN(this.es)||this.es<=0))throw Error(`Incorrect elliptical usage. Try using the +approx option in the proj string, or PROJECTION[\"Fast_Transverse_Mercator\"] in the WKT.`);this.approx&&(tr.init.apply(this),this.forward=tr.forward,this.inverse=tr.inverse),this.x0=this.x0===void 0?0:this.x0,this.y0=this.y0===void 0?0:this.y0,this.long0=this.long0===void 0?0:this.long0,this.lat0=this.lat0===void 0?0:this.lat0,this.cgb=[],this.cbg=[],this.utg=[],this.gtu=[];var e=this.es/(1+Math.sqrt(1-this.es)),t=e/(2-e),n=t;this.cgb[0]=t*(2+t*(-2/3+t*(-2+t*(116/45+t*(26/45+-2854/675*t))))),this.cbg[0]=t*(-2+t*(2/3+t*(4/3+t*(-82/45+t*(32/45+4642/4725*t))))),n*=t,this.cgb[1]=n*(7/3+t*(-8/5+t*(-227/45+t*(2704/315+2323/945*t)))),this.cbg[1]=n*(5/3+t*(-16/15+t*(-13/9+t*(904/315+-1522/945*t)))),n*=t,this.cgb[2]=n*(56/15+t*(-136/35+t*(-1262/105+73814/2835*t))),this.cbg[2]=n*(-26/15+t*(34/21+t*(8/5+-12686/2835*t))),n*=t,this.cgb[3]=n*(4279/630+t*(-332/35+-399572/14175*t)),this.cbg[3]=n*(1237/630+t*(-12/5+-24832/14175*t)),n*=t,this.cgb[4]=n*(4174/315+-144838/6237*t),this.cbg[4]=n*(-734/315+109598/31185*t),n*=t,this.cgb[5]=601676/22275*n,this.cbg[5]=444337/155925*n,n=t**2,this.Qn=this.k0/(1+t)*(1+n*(1/4+n*(1/64+n/256))),this.utg[0]=t*(-.5+t*(2/3+t*(-37/96+t*(1/360+t*(81/512+-96199/604800*t))))),this.gtu[0]=t*(.5+t*(-2/3+t*(5/16+t*(41/180+t*(-127/288+7891/37800*t))))),this.utg[1]=n*(-1/48+t*(-1/15+t*(437/1440+t*(-46/105+1118711/3870720*t)))),this.gtu[1]=n*(13/48+t*(-3/5+t*(557/1440+t*(281/630+-1983433/1935360*t)))),n*=t,this.utg[2]=n*(-17/480+t*(37/840+t*(209/4480+-5569/90720*t))),this.gtu[2]=n*(61/240+t*(-103/140+t*(15061/26880+167603/181440*t))),n*=t,this.utg[3]=n*(-4397/161280+t*(11/504+830251/7257600*t)),this.gtu[3]=n*(49561/161280+t*(-179/168+6601661/7257600*t)),n*=t,this.utg[4]=n*(-4583/161280+108847/3991680*t),this.gtu[4]=n*(34729/80640+-3418889/1995840*t),n*=t,this.utg[5]=-20648693/638668800*n,this.gtu[5]=212378941/319334400*n;var r=ar(this.cbg,this.lat0);this.Zb=-this.Qn*(r+or(this.gtu,2*r))}function ur(e){var t=U(e.x-this.long0,this.over),n=e.y;n=ar(this.cbg,n);var r=Math.sin(n),i=Math.cos(n),a=Math.sin(t),o=Math.cos(t);n=Math.atan2(r,o*i),t=Math.atan2(a*i,Z(r,i*o)),t=ir(Math.tan(t));var s=cr(this.gtu,2*n,2*t);n+=s[0],t+=s[1];var c,l;return Math.abs(t)<=2.623395162778?(c=this.a*(this.Qn*t)+this.x0,l=this.a*(this.Qn*n+this.Zb)+this.y0):(c=1/0,l=1/0),e.x=c,e.y=l,e}function dr(e){var t=(e.x-this.x0)*(1/this.a),n=(e.y-this.y0)*(1/this.a);n=(n-this.Zb)/this.Qn,t/=this.Qn;var r,i;if(Math.abs(t)<=2.623395162778){var a=cr(this.utg,2*n,2*t);n+=a[0],t+=a[1],t=Math.atan(nr(t));var o=Math.sin(n),s=Math.cos(n),c=Math.sin(t),l=Math.cos(t);n=Math.atan2(o*l,Z(c,l*s)),t=Math.atan2(c,l*s),r=U(t+this.long0,this.over),i=ar(this.cgb,n)}else r=1/0,i=1/0;return e.x=r,e.y=i,e}var fr={init:lr,forward:ur,inverse:dr,names:[`Extended_Transverse_Mercator`,`Extended Transverse Mercator`,`etmerc`,`Transverse_Mercator`,`Transverse Mercator`,`Gauss Kruger`,`Gauss_Kruger`,`tmerc`]};function pr(e,t){if(e===void 0){if(e=Math.floor((U(t)+Math.PI)*30/Math.PI)+1,e<0)return 0;if(e>60)return 60}return e}var mr=`etmerc`;function hr(){var e=pr(this.zone,this.long0);if(e===void 0)throw Error(`unknown utm zone`);this.lat0=0,this.long0=(6*Math.abs(e)-183)*M,this.x0=5e5,this.y0=this.utmSouth?1e7:0,this.k0=.9996,fr.init.apply(this),this.forward=fr.forward,this.inverse=fr.inverse}var gr={init:hr,names:[`Universal Transverse Mercator System`,`utm`],dependsOn:mr};function _r(e,t){return((1-e)/(1+e))**t}var vr=20;function yr(){var e=Math.sin(this.lat0),t=Math.cos(this.lat0);t*=t,this.rc=Math.sqrt(1-this.es)/(1-this.es*e*e),this.C=Math.sqrt(1+this.es*t*t/(1-this.es)),this.phic0=Math.asin(e/this.C),this.ratexp=.5*this.C*this.e,this.K=Math.tan(.5*this.phic0+N)/(Math.tan(.5*this.lat0+N)**+this.C*_r(this.e*e,this.ratexp))}function br(e){var t=e.x,n=e.y;return e.y=2*Math.atan(this.K*Math.tan(.5*n+N)**+this.C*_r(this.e*Math.sin(n),this.ratexp))-j,e.x=this.C*t,e}function xr(e){for(var t=1e-14,n=e.x/this.C,r=e.y,i=(Math.tan(.5*r+N)/this.K)**(1/this.C),a=vr;a>0&&(r=2*Math.atan(i*_r(this.e*Math.sin(e.y),-.5*this.e))-j,!(Math.abs(r-e.y)<t));--a)e.y=r;return a?(e.x=n,e.y=r,e):null}var Sr={init:yr,forward:br,inverse:xr,names:[`gauss`]};function Cr(){Sr.init.apply(this),this.rc&&(this.sinc0=Math.sin(this.phic0),this.cosc0=Math.cos(this.phic0),this.R2=2*this.rc,this.title||=`Oblique Stereographic Alternative`)}function wr(e){var t,n,r,i;return e.x=U(e.x-this.long0,this.over),Sr.forward.apply(this,[e]),t=Math.sin(e.y),n=Math.cos(e.y),r=Math.cos(e.x),i=this.k0*this.R2/(1+this.sinc0*t+this.cosc0*n*r),e.x=i*n*Math.sin(e.x),e.y=i*(this.cosc0*t-this.sinc0*n*r),e.x=this.a*e.x+this.x0,e.y=this.a*e.y+this.y0,e}function Tr(e){var t,n,r,i,a;if(e.x=(e.x-this.x0)/this.a,e.y=(e.y-this.y0)/this.a,e.x/=this.k0,e.y/=this.k0,a=Z(e.x,e.y)){var o=2*Math.atan2(a,this.R2);t=Math.sin(o),n=Math.cos(o),i=Math.asin(n*this.sinc0+e.y*t*this.cosc0/a),r=Math.atan2(e.x*t,a*this.cosc0*n-e.y*this.sinc0*t)}else i=this.phic0,r=0;return e.x=r,e.y=i,Sr.inverse.apply(this,[e]),e.x=U(e.x+this.long0,this.over),e}var Er={init:Cr,forward:wr,inverse:Tr,names:[`Stereographic_North_Pole`,`Oblique_Stereographic`,`sterea`,`Oblique Stereographic Alternative`,`Double_Stereographic`]};function Dr(e,t,n){return t*=n,Math.tan(.5*(j+e))*((1-t)/(1+t))**(.5*n)}function Or(){this.x0=this.x0||0,this.y0=this.y0||0,this.lat0=this.lat0||0,this.long0=this.long0||0,this.coslat0=Math.cos(this.lat0),this.sinlat0=Math.sin(this.lat0),this.sphere?this.k0===1&&!isNaN(this.lat_ts)&&Math.abs(this.coslat0)<=1e-10&&(this.k0=.5*(1+at(this.lat0)*Math.sin(this.lat_ts))):(Math.abs(this.coslat0)<=1e-10&&(this.lat0>0?this.con=1:this.con=-1),this.cons=Math.sqrt((1+this.e)**+(1+this.e)*(1-this.e)**(1-this.e)),this.k0===1&&!isNaN(this.lat_ts)&&Math.abs(this.coslat0)<=1e-10&&Math.abs(Math.cos(this.lat_ts))>1e-10&&(this.k0=.5*this.cons*it(this.e,Math.sin(this.lat_ts),Math.cos(this.lat_ts))/ot(this.e,this.con*this.lat_ts,this.con*Math.sin(this.lat_ts))),this.ms1=it(this.e,this.sinlat0,this.coslat0),this.X0=2*Math.atan(Dr(this.lat0,this.sinlat0,this.e))-j,this.cosX0=Math.cos(this.X0),this.sinX0=Math.sin(this.X0))}function kr(e){var t=e.x,n=e.y,r=Math.sin(n),i=Math.cos(n),a,o,s,c,l,u,d=U(t-this.long0,this.over);return Math.abs(Math.abs(t-this.long0)-Math.PI)<=1e-10&&Math.abs(n+this.lat0)<=1e-10?(e.x=NaN,e.y=NaN,e):this.sphere?(a=2*this.k0/(1+this.sinlat0*r+this.coslat0*i*Math.cos(d)),e.x=this.a*a*i*Math.sin(d)+this.x0,e.y=this.a*a*(this.coslat0*r-this.sinlat0*i*Math.cos(d))+this.y0,e):(o=2*Math.atan(Dr(n,r,this.e))-j,c=Math.cos(o),s=Math.sin(o),Math.abs(this.coslat0)<=1e-10?(l=ot(this.e,n*this.con,this.con*r),u=2*this.a*this.k0*l/this.cons,e.x=this.x0+u*Math.sin(t-this.long0),e.y=this.y0-this.con*u*Math.cos(t-this.long0),e):(Math.abs(this.sinlat0)<1e-10?(a=2*this.a*this.k0/(1+c*Math.cos(d)),e.y=a*s):(a=2*this.a*this.k0*this.ms1/(this.cosX0*(1+this.sinX0*s+this.cosX0*c*Math.cos(d))),e.y=a*(this.cosX0*s-this.sinX0*c*Math.cos(d))+this.y0),e.x=a*c*Math.sin(d)+this.x0,e))}function Ar(e){e.x-=this.x0,e.y-=this.y0;var t,n,r,i,a,o=Math.sqrt(e.x*e.x+e.y*e.y);if(this.sphere){var s=2*Math.atan(o/(2*this.a*this.k0));return t=this.long0,n=this.lat0,o<=1e-10?(e.x=t,e.y=n,e):(n=Math.asin(Math.cos(s)*this.sinlat0+e.y*Math.sin(s)*this.coslat0/o),t=Math.abs(this.coslat0)<1e-10?this.lat0>0?U(this.long0+Math.atan2(e.x,-1*e.y),this.over):U(this.long0+Math.atan2(e.x,e.y),this.over):U(this.long0+Math.atan2(e.x*Math.sin(s),o*this.coslat0*Math.cos(s)-e.y*this.sinlat0*Math.sin(s)),this.over),e.x=t,e.y=n,e)}else if(Math.abs(this.coslat0)<=1e-10){if(o<=1e-10)return n=this.lat0,t=this.long0,e.x=t,e.y=n,e;e.x*=this.con,e.y*=this.con,r=o*this.cons/(2*this.a*this.k0),n=this.con*st(this.e,r),t=this.con*U(this.con*this.long0+Math.atan2(e.x,-1*e.y),this.over)}else i=2*Math.atan(o*this.cosX0/(2*this.a*this.k0*this.ms1)),t=this.long0,o<=1e-10?a=this.X0:(a=Math.asin(Math.cos(i)*this.sinX0+e.y*Math.sin(i)*this.cosX0/o),t=U(this.long0+Math.atan2(e.x*Math.sin(i),o*this.cosX0*Math.cos(i)-e.y*this.sinX0*Math.sin(i)),this.over)),n=-1*st(this.e,Math.tan(.5*(j+a)));return e.x=t,e.y=n,e}var jr={init:Or,forward:kr,inverse:Ar,names:[`stere`,`Stereographic_South_Pole`,`Polar_Stereographic_variant_A`,`Polar_Stereographic_variant_B`,`Polar_Stereographic`],ssfn_:Dr};function Mr(){var e=this.lat0;this.lambda0=this.long0;var t=Math.sin(e),n=this.a,r=1/this.rf,i=2*r-r**2,a=this.e=Math.sqrt(i);this.R=this.k0*n*Math.sqrt(1-i)/(1-i*t**2),this.alpha=Math.sqrt(1+i/(1-i)*Math.cos(e)**4),this.b0=Math.asin(t/this.alpha);var o=Math.log(Math.tan(Math.PI/4+this.b0/2)),s=Math.log(Math.tan(Math.PI/4+e/2)),c=Math.log((1+a*t)/(1-a*t));this.K=o-this.alpha*s+this.alpha*a/2*c}function Nr(e){var t=Math.log(Math.tan(Math.PI/4-e.y/2)),n=this.e/2*Math.log((1+this.e*Math.sin(e.y))/(1-this.e*Math.sin(e.y))),r=-this.alpha*(t+n)+this.K,i=2*(Math.atan(Math.exp(r))-Math.PI/4),a=this.alpha*(e.x-this.lambda0),o=Math.atan(Math.sin(a)/(Math.sin(this.b0)*Math.tan(i)+Math.cos(this.b0)*Math.cos(a))),s=Math.asin(Math.cos(this.b0)*Math.sin(i)-Math.sin(this.b0)*Math.cos(i)*Math.cos(a));return e.y=this.R/2*Math.log((1+Math.sin(s))/(1-Math.sin(s)))+this.y0,e.x=this.R*o+this.x0,e}function Pr(e){for(var t=e.x-this.x0,n=e.y-this.y0,r=t/this.R,i=2*(Math.atan(Math.exp(n/this.R))-Math.PI/4),a=Math.asin(Math.cos(this.b0)*Math.sin(i)+Math.sin(this.b0)*Math.cos(i)*Math.cos(r)),o=Math.atan(Math.sin(r)/(Math.cos(this.b0)*Math.cos(r)-Math.sin(this.b0)*Math.tan(i))),s=this.lambda0+o/this.alpha,c=0,l=a,u=-1e3,d=0;Math.abs(l-u)>1e-7;){if(++d>20)return;c=1/this.alpha*(Math.log(Math.tan(Math.PI/4+a/2))-this.K)+this.e*Math.log(Math.tan(Math.PI/4+Math.asin(this.e*Math.sin(l))/2)),u=l,l=2*Math.atan(Math.exp(c))-Math.PI/2}return e.x=s,e.y=l,e}var Fr={init:Mr,forward:Nr,inverse:Pr,names:[`somerc`]},Ir=1e-7;function Lr(e){var t=[`Hotine_Oblique_Mercator`,`Hotine_Oblique_Mercator_variant_A`,`Hotine_Oblique_Mercator_Azimuth_Natural_Origin`],n=typeof e.projName==`object`?Object.keys(e.projName)[0]:e.projName;return`no_uoff`in e||`no_off`in e||t.indexOf(n)!==-1||t.indexOf(yt(n))!==-1}function Rr(){var e,t,n,r,i,a,o,s,c,l,u=0,d,f=0,p=0,m=0,h=0,g=0,_=0;this.no_off=Lr(this),this.no_rot=`no_rot`in this;var v=!1;`alpha`in this&&(v=!0);var y=!1;if(`rectified_grid_angle`in this&&(y=!0),v&&(_=this.alpha),y&&(u=this.rectified_grid_angle,v||=(_=0,!0)),v||y)f=this.longc;else if(p=this.long1,h=this.lat1,m=this.long2,g=this.lat2,Math.abs(h-g)<=Ir||(e=Math.abs(h))<=Ir||Math.abs(e-j)<=Ir||Math.abs(Math.abs(this.lat0)-j)<=Ir||Math.abs(Math.abs(g)-j)<=Ir)throw Error();var b=1-this.es;t=Math.sqrt(b),Math.abs(this.lat0)>1e-10?(s=Math.sin(this.lat0),n=Math.cos(this.lat0),e=1-this.es*s*s,this.B=n*n,this.B=Math.sqrt(1+this.es*this.B*this.B/b),this.A=this.B*this.k0*t/e,r=this.B*t/(n*Math.sqrt(e)),i=r*r-1,i<=0?i=0:(i=Math.sqrt(i),this.lat0<0&&(i=-i)),this.E=i+=r,this.E*=ot(this.e,this.lat0,s)**+this.B):(this.B=1/t,this.A=this.k0,this.E=r=i=1),v||y?(v?(d=Math.asin(Math.sin(_)/r),y||(u=_)):(d=u,_=Math.asin(r*Math.sin(d))),this.lam0=f-Math.asin(.5*(i-1/i)*Math.tan(d))/this.B):(a=ot(this.e,h,Math.sin(h))**+this.B,o=ot(this.e,g,Math.sin(g))**+this.B,i=this.E/a,c=(o-a)/(o+a),l=this.E*this.E,l=(l-o*a)/(l+o*a),e=p-m,e<-Math.PI?m-=ge:e>Math.PI&&(m+=ge),this.lam0=U(.5*(p+m)-Math.atan(l*Math.tan(.5*this.B*(p-m))/c)/this.B,this.over),d=Math.atan(2*Math.sin(this.B*U(p-this.lam0,this.over))/(i-1/i)),u=_=Math.asin(r*Math.sin(d))),this.singam=Math.sin(d),this.cosgam=Math.cos(d),this.sinrot=Math.sin(u),this.cosrot=Math.cos(u),this.rB=1/this.B,this.ArB=this.A*this.rB,this.BrA=1/this.ArB,this.no_off?this.u_0=0:(this.u_0=Math.abs(this.ArB*Math.atan(Math.sqrt(r*r-1)/Math.cos(_))),this.lat0<0&&(this.u_0=-this.u_0)),i=.5*d,this.v_pole_n=this.ArB*Math.log(Math.tan(N-i)),this.v_pole_s=this.ArB*Math.log(Math.tan(N+i))}function zr(e){var t={},n,r,i,a,o,s,c,l;if(e.x-=this.lam0,Math.abs(Math.abs(e.y)-j)>1e-10){if(o=this.E/ot(this.e,e.y,Math.sin(e.y))**+this.B,s=1/o,n=.5*(o-s),r=.5*(o+s),a=Math.sin(this.B*e.x),i=(n*this.singam-a*this.cosgam)/r,Math.abs(Math.abs(i)-1)<1e-10)throw Error();l=.5*this.ArB*Math.log((1-i)/(1+i)),s=Math.cos(this.B*e.x),c=Math.abs(s)<Ir?this.A*e.x:this.ArB*Math.atan2(n*this.cosgam+a*this.singam,s)}else l=e.y>0?this.v_pole_n:this.v_pole_s,c=this.ArB*e.y;return this.no_rot?(t.x=c,t.y=l):(c-=this.u_0,t.x=l*this.cosrot+c*this.sinrot,t.y=c*this.cosrot-l*this.sinrot),t.x=this.a*t.x+this.x0,t.y=this.a*t.y+this.y0,t}function Br(e){var t,n,r,i,a,o,s,c={};if(e.x=(e.x-this.x0)*(1/this.a),e.y=(e.y-this.y0)*(1/this.a),this.no_rot?(n=e.y,t=e.x):(n=e.x*this.cosrot-e.y*this.sinrot,t=e.y*this.cosrot+e.x*this.sinrot+this.u_0),r=Math.exp(-this.BrA*n),i=.5*(r-1/r),a=.5*(r+1/r),o=Math.sin(this.BrA*t),s=(o*this.cosgam+i*this.singam)/a,Math.abs(Math.abs(s)-1)<1e-10)c.x=0,c.y=s<0?-j:j;else{if(c.y=this.E/Math.sqrt((1+s)/(1-s)),c.y=st(this.e,c.y**(1/this.B)),c.y===1/0)throw Error();c.x=-this.rB*Math.atan2(i*this.cosgam-o*this.singam,Math.cos(this.BrA*t))}return c.x+=this.lam0,c}var Vr={init:Rr,forward:zr,inverse:Br,names:[`Hotine_Oblique_Mercator`,`Hotine Oblique Mercator`,`Hotine_Oblique_Mercator_variant_A`,`Hotine_Oblique_Mercator_Variant_B`,`Hotine_Oblique_Mercator_Azimuth_Natural_Origin`,`Hotine_Oblique_Mercator_Two_Point_Natural_Origin`,`Hotine_Oblique_Mercator_Azimuth_Center`,`Oblique_Mercator`,`omerc`]};function Hr(){if(this.lat2||=this.lat1,this.k0||=1,this.x0=this.x0||0,this.y0=this.y0||0,!(Math.abs(this.lat1+this.lat2)<1e-10)){var e=this.b/this.a;this.e=Math.sqrt(1-e*e);var t=Math.sin(this.lat1),n=Math.cos(this.lat1),r=it(this.e,t,n),i=ot(this.e,this.lat1,t),a=Math.sin(this.lat2),o=Math.cos(this.lat2),s=it(this.e,a,o),c=ot(this.e,this.lat2,a),l=Math.abs(Math.abs(this.lat0)-j)<1e-10?0:ot(this.e,this.lat0,Math.sin(this.lat0));Math.abs(this.lat1-this.lat2)>1e-10?this.ns=Math.log(r/s)/Math.log(i/c):this.ns=t,isNaN(this.ns)&&(this.ns=t),this.f0=r/(this.ns*i**+this.ns),this.rh=this.a*this.f0*l**+this.ns,this.title||=`Lambert Conformal Conic`}}function Ur(e){var t=e.x,n=e.y;Math.abs(2*Math.abs(n)-Math.PI)<=1e-10&&(n=at(n)*(j-2*me));var r=Math.abs(Math.abs(n)-j),i,a;if(r>1e-10)i=ot(this.e,n,Math.sin(n)),a=this.a*this.f0*i**+this.ns;else{if(r=n*this.ns,r<=0)return null;a=0}var o=this.ns*U(t-this.long0,this.over);return e.x=this.k0*(a*Math.sin(o))+this.x0,e.y=this.k0*(this.rh-a*Math.cos(o))+this.y0,e}function Wr(e){var t,n,r,i,a,o=(e.x-this.x0)/this.k0,s=this.rh-(e.y-this.y0)/this.k0;this.ns>0?(t=Math.sqrt(o*o+s*s),n=1):(t=-Math.sqrt(o*o+s*s),n=-1);var c=0;if(t!==0&&(c=Math.atan2(n*o,n*s)),t!==0||this.ns>0){if(n=1/this.ns,r=(t/(this.a*this.f0))**+n,i=st(this.e,r),i===-9999)return null}else i=-j;return a=U(c/this.ns+this.long0,this.over),e.x=a,e.y=i,e}var Gr={init:Hr,forward:Ur,inverse:Wr,names:[`Lambert Tangential Conformal Conic Projection`,`Lambert_Conformal_Conic`,`Lambert_Conformal_Conic_1SP`,`Lambert_Conformal_Conic_2SP`,`lcc`,`Lambert Conic Conformal (1SP)`,`Lambert Conic Conformal (2SP)`]};function Kr(){this.a=6377397.155,this.es=.006674372230614,this.e=Math.sqrt(this.es),this.lat0||=.863937979737193,this.long0||=.4334234309119251,this.k0||=.9999,this.s45=.785398163397448,this.s90=2*this.s45,this.fi0=this.lat0,this.e2=this.es,this.e=Math.sqrt(this.e2),this.alfa=Math.sqrt(1+this.e2*Math.cos(this.fi0)**4/(1-this.e2)),this.uq=1.04216856380474,this.u0=Math.asin(Math.sin(this.fi0)/this.alfa),this.g=((1+this.e*Math.sin(this.fi0))/(1-this.e*Math.sin(this.fi0)))**(this.alfa*this.e/2),this.k=Math.tan(this.u0/2+this.s45)/Math.tan(this.fi0/2+this.s45)**+this.alfa*this.g,this.k1=this.k0,this.n0=this.a*Math.sqrt(1-this.e2)/(1-this.e2*Math.sin(this.fi0)**2),this.s0=1.37008346281555,this.n=Math.sin(this.s0),this.ro0=this.k1*this.n0/Math.tan(this.s0),this.ad=this.s90-this.uq}function qr(e){var t,n,r,i,a,o,s,c=e.x,l=e.y,u=U(c-this.long0,this.over);return t=((1+this.e*Math.sin(l))/(1-this.e*Math.sin(l)))**(this.alfa*this.e/2),n=2*(Math.atan(this.k*Math.tan(l/2+this.s45)**+this.alfa/t)-this.s45),r=-u*this.alfa,i=Math.asin(Math.cos(this.ad)*Math.sin(n)+Math.sin(this.ad)*Math.cos(n)*Math.cos(r)),a=Math.asin(Math.cos(n)*Math.sin(r)/Math.cos(i)),o=this.n*a,s=this.ro0*Math.tan(this.s0/2+this.s45)**+this.n/Math.tan(i/2+this.s45)**+this.n,e.y=s*Math.cos(o)/1,e.x=s*Math.sin(o)/1,this.czech||(e.y*=-1,e.x*=-1),e}function Jr(e){var t,n,r,i,a,o,s,c,l=e.x;e.x=e.y,e.y=l,this.czech||(e.y*=-1,e.x*=-1),o=Math.sqrt(e.x*e.x+e.y*e.y),a=Math.atan2(e.y,e.x),i=a/Math.sin(this.s0),r=2*(Math.atan((this.ro0/o)**(1/this.n)*Math.tan(this.s0/2+this.s45))-this.s45),t=Math.asin(Math.cos(this.ad)*Math.sin(r)-Math.sin(this.ad)*Math.cos(r)*Math.cos(i)),n=Math.asin(Math.cos(r)*Math.sin(i)/Math.cos(t)),e.x=this.long0-n/this.alfa,s=t,c=0;var u=0;do e.y=2*(Math.atan(this.k**(-1/this.alfa)*Math.tan(t/2+this.s45)**(1/this.alfa)*((1+this.e*Math.sin(s))/(1-this.e*Math.sin(s)))**(this.e/2))-this.s45),Math.abs(s-e.y)<1e-10&&(c=1),s=e.y,u+=1;while(c===0&&u<15);return u>=15?null:e}var Yr={init:Kr,forward:qr,inverse:Jr,names:[`Krovak`,`Krovak Modified`,`Krovak (North Orientated)`,`Krovak Modified (North Orientated)`,`krovak`]};function Xr(e,t,n,r,i){return e*i-t*Math.sin(2*i)+n*Math.sin(4*i)-r*Math.sin(6*i)}function Zr(e){return 1-.25*e*(1+e/16*(3+1.25*e))}function Qr(e){return .375*e*(1+.25*e*(1+.46875*e))}function $r(e){return .05859375*e*e*(1+.75*e)}function ei(e){return e*e*e*(35/3072)}function ti(e,t,n){var r=t*n;return e/Math.sqrt(1-r*r)}function ni(e){return Math.abs(e)<j?e:e-at(e)*Math.PI}function ri(e,t,n,r,i){for(var a=e/t,o,s=0;s<15;s++)if(o=(e-(t*a-n*Math.sin(2*a)+r*Math.sin(4*a)-i*Math.sin(6*a)))/(t-2*n*Math.cos(2*a)+4*r*Math.cos(4*a)-6*i*Math.cos(6*a)),a+=o,Math.abs(o)<=1e-10)return a;return NaN}function ii(){this.sphere||(this.e0=Zr(this.es),this.e1=Qr(this.es),this.e2=$r(this.es),this.e3=ei(this.es),this.ml0=this.a*Xr(this.e0,this.e1,this.e2,this.e3,this.lat0))}function ai(e){var t,n,r=e.x,i=e.y;if(r=U(r-this.long0,this.over),this.sphere)t=this.a*Math.asin(Math.cos(i)*Math.sin(r)),n=this.a*(Math.atan2(Math.tan(i),Math.cos(r))-this.lat0);else{var a=Math.sin(i),o=Math.cos(i),s=ti(this.a,this.e,a),c=Math.tan(i)*Math.tan(i),l=r*Math.cos(i),u=l*l,d=this.es*o*o/(1-this.es),f=this.a*Xr(this.e0,this.e1,this.e2,this.e3,i);t=s*l*(1-u*c*(1/6-(8-c+8*d)*u/120)),n=f-this.ml0+s*a/o*u*(.5+(5-c+6*d)*u/24)}return e.x=t+this.x0,e.y=n+this.y0,e}function oi(e){e.x-=this.x0,e.y-=this.y0;var t=e.x/this.a,n=e.y/this.a,r,i;if(this.sphere){var a=n+this.lat0;r=Math.asin(Math.sin(a)*Math.cos(t)),i=Math.atan2(Math.tan(t),Math.cos(a))}else{var o=ri(this.ml0/this.a+n,this.e0,this.e1,this.e2,this.e3);if(Math.abs(Math.abs(o)-j)<=1e-10)return e.x=this.long0,e.y=j,n<0&&(e.y*=-1),e;var s=ti(this.a,this.e,Math.sin(o)),c=s*s*s/this.a/this.a*(1-this.es),l=Math.tan(o)**2,u=t*this.a/s,d=u*u;r=o-s*Math.tan(o)/c*u*u*(.5-(1+3*l)*u*u/24),i=u*(1-d*(l/3+(1+3*l)*l*d/15))/Math.cos(o)}return e.x=U(i+this.long0,this.over),e.y=ni(r),e}var si={init:ii,forward:ai,inverse:oi,names:[`Cassini`,`Cassini_Soldner`,`cass`]};function ci(e,t){var n;return e>1e-7?(n=e*t,(1-e*e)*(t/(1-n*n)-.5/e*Math.log((1-n)/(1+n)))):2*t}var li=.3333333333333333,ui=.17222222222222222,di=.10257936507936508,fi=.06388888888888888,pi=.0664021164021164,mi=.016415012942191543;function hi(e){var t,n=[];return n[0]=e*li,t=e*e,n[0]+=t*ui,n[1]=t*fi,t*=e,n[0]+=t*di,n[1]+=t*pi,n[2]=t*mi,n}function gi(e,t){var n=e+e;return e+t[0]*Math.sin(n)+t[1]*Math.sin(n+n)+t[2]*Math.sin(n+n+n)}function _i(){var e=Math.abs(this.lat0);if(Math.abs(e-j)<1e-10?this.mode=this.lat0<0?1:2:Math.abs(e)<1e-10?this.mode=3:this.mode=4,this.es>0){var t;switch(this.qp=ci(this.e,1),this.mmf=.5/(1-this.es),this.apa=hi(this.es),this.mode){case 2:this.dd=1;break;case 1:this.dd=1;break;case 3:this.rq=Math.sqrt(.5*this.qp),this.dd=1/this.rq,this.xmf=1,this.ymf=.5*this.qp;break;case 4:this.rq=Math.sqrt(.5*this.qp),t=Math.sin(this.lat0),this.sinb1=ci(this.e,t)/this.qp,this.cosb1=Math.sqrt(1-this.sinb1*this.sinb1),this.dd=Math.cos(this.lat0)/(Math.sqrt(1-this.es*t*t)*this.rq*this.cosb1),this.ymf=(this.xmf=this.rq)/this.dd,this.xmf*=this.dd;break}}else this.mode===4&&(this.sinph0=Math.sin(this.lat0),this.cosph0=Math.cos(this.lat0))}function vi(e){var t,n,r,i,a,o,s,c,l,u,d=e.x,f=e.y;if(d=U(d-this.long0,this.over),this.sphere){if(a=Math.sin(f),u=Math.cos(f),r=Math.cos(d),this.mode===this.OBLIQ||this.mode===this.EQUIT){if(n=this.mode===this.EQUIT?1+u*r:1+this.sinph0*a+this.cosph0*u*r,n<=1e-10)return null;n=Math.sqrt(2/n),t=n*u*Math.sin(d),n*=this.mode===this.EQUIT?a:this.cosph0*a-this.sinph0*u*r}else if(this.mode===this.N_POLE||this.mode===this.S_POLE){if(this.mode===this.N_POLE&&(r=-r),Math.abs(f+this.lat0)<1e-10)return null;n=N-f*.5,n=2*(this.mode===this.S_POLE?Math.cos(n):Math.sin(n)),t=n*Math.sin(d),n*=r}}else{switch(s=0,c=0,l=0,r=Math.cos(d),i=Math.sin(d),a=Math.sin(f),o=ci(this.e,a),(this.mode===this.OBLIQ||this.mode===this.EQUIT)&&(s=o/this.qp,c=Math.sqrt(1-s*s)),this.mode){case this.OBLIQ:l=1+this.sinb1*s+this.cosb1*c*r;break;case this.EQUIT:l=1+c*r;break;case this.N_POLE:l=j+f,o=this.qp-o;break;case this.S_POLE:l=f-j,o=this.qp+o;break}if(Math.abs(l)<1e-10)return null;switch(this.mode){case this.OBLIQ:case this.EQUIT:l=Math.sqrt(2/l),n=this.mode===this.OBLIQ?this.ymf*l*(this.cosb1*s-this.sinb1*c*r):(l=Math.sqrt(2/(1+c*r)))*s*this.ymf,t=this.xmf*l*c*i;break;case this.N_POLE:case this.S_POLE:o>=0?(t=(l=Math.sqrt(o))*i,n=r*(this.mode===this.S_POLE?l:-l)):t=n=0;break}}return e.x=this.a*t+this.x0,e.y=this.a*n+this.y0,e}function yi(e){e.x-=this.x0,e.y-=this.y0;var t=e.x/this.a,n=e.y/this.a,r,i,a,o,s,c,l;if(this.sphere){var u=0,d,f=0;if(d=Math.sqrt(t*t+n*n),i=d*.5,i>1)return null;switch(i=2*Math.asin(i),(this.mode===this.OBLIQ||this.mode===this.EQUIT)&&(f=Math.sin(i),u=Math.cos(i)),this.mode){case this.EQUIT:i=Math.abs(d)<=1e-10?0:Math.asin(n*f/d),t*=f,n=u*d;break;case this.OBLIQ:i=Math.abs(d)<=1e-10?this.lat0:Math.asin(u*this.sinph0+n*f*this.cosph0/d),t*=f*this.cosph0,n=(u-Math.sin(i)*this.sinph0)*d;break;case this.N_POLE:n=-n,i=j-i;break;case this.S_POLE:i-=j;break}r=n===0&&(this.mode===this.EQUIT||this.mode===this.OBLIQ)?0:Math.atan2(t,n)}else{if(l=0,this.mode===this.OBLIQ||this.mode===this.EQUIT){if(t/=this.dd,n*=this.dd,c=Math.sqrt(t*t+n*n),c<1e-10)return e.x=this.long0,e.y=this.lat0,e;o=2*Math.asin(.5*c/this.rq),a=Math.cos(o),t*=o=Math.sin(o),this.mode===this.OBLIQ?(l=a*this.sinb1+n*o*this.cosb1/c,s=this.qp*l,n=c*this.cosb1*a-n*this.sinb1*o):(l=n*o/c,s=this.qp*l,n=c*a)}else if(this.mode===this.N_POLE||this.mode===this.S_POLE){if(this.mode===this.N_POLE&&(n=-n),s=t*t+n*n,!s)return e.x=this.long0,e.y=this.lat0,e;l=1-s/this.qp,this.mode===this.S_POLE&&(l=-l)}r=Math.atan2(t,n),i=gi(Math.asin(l),this.apa)}return e.x=U(this.long0+r,this.over),e.y=i,e}var bi={init:_i,forward:vi,inverse:yi,names:[`Lambert Azimuthal Equal Area`,`Lambert_Azimuthal_Equal_Area`,`laea`],S_POLE:1,N_POLE:2,EQUIT:3,OBLIQ:4};function xi(e){return Math.abs(e)>1&&(e=e>1?1:-1),Math.asin(e)}function Si(){Math.abs(this.lat1+this.lat2)<1e-10||(this.temp=this.b/this.a,this.es=1-this.temp**2,this.e3=Math.sqrt(this.es),this.sin_po=Math.sin(this.lat1),this.cos_po=Math.cos(this.lat1),this.t1=this.sin_po,this.con=this.sin_po,this.ms1=it(this.e3,this.sin_po,this.cos_po),this.qs1=ci(this.e3,this.sin_po),this.sin_po=Math.sin(this.lat2),this.cos_po=Math.cos(this.lat2),this.t2=this.sin_po,this.ms2=it(this.e3,this.sin_po,this.cos_po),this.qs2=ci(this.e3,this.sin_po),this.sin_po=Math.sin(this.lat0),this.cos_po=Math.cos(this.lat0),this.t3=this.sin_po,this.qs0=ci(this.e3,this.sin_po),Math.abs(this.lat1-this.lat2)>1e-10?this.ns0=(this.ms1*this.ms1-this.ms2*this.ms2)/(this.qs2-this.qs1):this.ns0=this.con,this.c=this.ms1*this.ms1+this.ns0*this.qs1,this.rh=this.a*Math.sqrt(this.c-this.ns0*this.qs0)/this.ns0)}function Ci(e){var t=e.x,n=e.y;this.sin_phi=Math.sin(n),this.cos_phi=Math.cos(n);var r=ci(this.e3,this.sin_phi),i=this.a*Math.sqrt(this.c-this.ns0*r)/this.ns0,a=this.ns0*U(t-this.long0,this.over),o=i*Math.sin(a)+this.x0,s=this.rh-i*Math.cos(a)+this.y0;return e.x=o,e.y=s,e}function wi(e){var t,n,r,i,a,o;return e.x-=this.x0,e.y=this.rh-e.y+this.y0,this.ns0>=0?(t=Math.sqrt(e.x*e.x+e.y*e.y),r=1):(t=-Math.sqrt(e.x*e.x+e.y*e.y),r=-1),i=0,t!==0&&(i=Math.atan2(r*e.x,r*e.y)),r=t*this.ns0/this.a,this.sphere?o=Math.asin((this.c-r*r)/(2*this.ns0)):(n=(this.c-r*r)/this.ns0,o=this.phi1z(this.e3,n)),a=U(i/this.ns0+this.long0,this.over),e.x=a,e.y=o,e}function Ti(e,t){var n,r,i,a,o,s=xi(.5*t);if(e<1e-10)return s;for(var c=e*e,l=1;l<=25;l++)if(n=Math.sin(s),r=Math.cos(s),i=e*n,a=1-i*i,o=.5*a*a/r*(t/(1-c)-n/a+.5/e*Math.log((1-i)/(1+i))),s+=o,Math.abs(o)<=1e-7)return s;return null}var Ei={init:Si,forward:Ci,inverse:wi,names:[`Albers_Conic_Equal_Area`,`Albers_Equal_Area`,`Albers`,`aea`],phi1z:Ti};function Di(){this.sin_p14=Math.sin(this.lat0),this.cos_p14=Math.cos(this.lat0),this.infinity_dist=1e3*this.a,this.rc=1}function Oi(e){var t,n,r,i,a,o,s,c,l=e.x,u=e.y;return r=U(l-this.long0,this.over),t=Math.sin(u),n=Math.cos(u),i=Math.cos(r),o=this.sin_p14*t+this.cos_p14*n*i,a=1,o>0||Math.abs(o)<=1e-10?(s=this.x0+this.a*a*n*Math.sin(r)/o,c=this.y0+this.a*a*(this.cos_p14*t-this.sin_p14*n*i)/o):(s=this.x0+this.infinity_dist*n*Math.sin(r),c=this.y0+this.infinity_dist*(this.cos_p14*t-this.sin_p14*n*i)),e.x=s,e.y=c,e}function ki(e){var t,n,r,i,a,o;return e.x=(e.x-this.x0)/this.a,e.y=(e.y-this.y0)/this.a,e.x/=this.k0,e.y/=this.k0,(t=Math.sqrt(e.x*e.x+e.y*e.y))?(i=Math.atan2(t,this.rc),n=Math.sin(i),r=Math.cos(i),o=xi(r*this.sin_p14+e.y*n*this.cos_p14/t),a=Math.atan2(e.x*n,t*this.cos_p14*r-e.y*this.sin_p14*n),a=U(this.long0+a,this.over)):(o=this.phic0,a=0),e.x=a,e.y=o,e}var Ai={init:Di,forward:Oi,inverse:ki,names:[`gnom`]};function ji(e,t){var n=1-(1-e*e)/(2*e)*Math.log((1-e)/(1+e));if(Math.abs(Math.abs(t)-n)<1e-6)return t<0?-1*j:j;for(var r=Math.asin(.5*t),i,a,o,s,c=0;c<30;c++)if(a=Math.sin(r),o=Math.cos(r),s=e*a,i=(1-s*s)**2/(2*o)*(t/(1-e*e)-a/(1-s*s)+.5/e*Math.log((1-s)/(1+s))),r+=i,Math.abs(i)<=1e-10)return r;return NaN}function Mi(){this.sphere||(this.k0=it(this.e,Math.sin(this.lat_ts),Math.cos(this.lat_ts)))}function Ni(e){var t=e.x,n=e.y,r,i,a=U(t-this.long0,this.over);if(this.sphere)r=this.x0+this.a*a*Math.cos(this.lat_ts),i=this.y0+this.a*Math.sin(n)/Math.cos(this.lat_ts);else{var o=ci(this.e,Math.sin(n));r=this.x0+this.a*this.k0*a,i=this.y0+this.a*o*.5/this.k0}return e.x=r,e.y=i,e}function Pi(e){e.x-=this.x0,e.y-=this.y0;var t,n;return this.sphere?(t=U(this.long0+e.x/this.a/Math.cos(this.lat_ts),this.over),n=Math.asin(e.y/this.a*Math.cos(this.lat_ts))):(n=ji(this.e,2*e.y*this.k0/this.a),t=U(this.long0+e.x/(this.a*this.k0),this.over)),e.x=t,e.y=n,e}var Fi={init:Mi,forward:Ni,inverse:Pi,names:[`cea`]};function Ii(){this.x0=this.x0||0,this.y0=this.y0||0,this.lat0=this.lat0||0,this.long0=this.long0||0,this.lat_ts=this.lat_ts||0,this.title=this.title||`Equidistant Cylindrical (Plate Carre)`,this.rc=Math.cos(this.lat_ts)}function Li(e){var t=e.x,n=e.y,r=U(t-this.long0,this.over),i=ni(n-this.lat0);return e.x=this.x0+this.a*r*this.rc,e.y=this.y0+this.a*i,e}function Ri(e){var t=e.x,n=e.y;return e.x=U(this.long0+(t-this.x0)/(this.a*this.rc),this.over),e.y=ni(this.lat0+(n-this.y0)/this.a),e}var zi={init:Ii,forward:Li,inverse:Ri,names:[`Equirectangular`,`Equidistant_Cylindrical`,`Equidistant_Cylindrical_Spherical`,`eqc`]},Bi=20;function Vi(){this.temp=this.b/this.a,this.es=1-this.temp**2,this.e=Math.sqrt(this.es),this.e0=Zr(this.es),this.e1=Qr(this.es),this.e2=$r(this.es),this.e3=ei(this.es),this.ml0=this.a*Xr(this.e0,this.e1,this.e2,this.e3,this.lat0)}function Hi(e){var t=e.x,n=e.y,r,i,a,o=U(t-this.long0,this.over);if(a=o*Math.sin(n),this.sphere)Math.abs(n)<=1e-10?(r=this.a*o,i=-1*this.a*this.lat0):(r=this.a*Math.sin(a)/Math.tan(n),i=this.a*(ni(n-this.lat0)+(1-Math.cos(a))/Math.tan(n)));else if(Math.abs(n)<=1e-10)r=this.a*o,i=-1*this.ml0;else{var s=ti(this.a,this.e,Math.sin(n))/Math.tan(n);r=s*Math.sin(a),i=this.a*Xr(this.e0,this.e1,this.e2,this.e3,n)-this.ml0+s*(1-Math.cos(a))}return e.x=r+this.x0,e.y=i+this.y0,e}function Ui(e){var t,n,r=e.x-this.x0,i=e.y-this.y0,a,o,s,c,l;if(this.sphere)if(Math.abs(i+this.a*this.lat0)<=1e-10)t=U(r/this.a+this.long0,this.over),n=0;else{o=this.lat0+i/this.a,s=r*r/this.a/this.a+o*o,c=o;var u;for(a=Bi;a;--a)if(u=Math.tan(c),l=-1*(o*(c*u+1)-c-.5*(c*c+s)*u)/((c-o)/u-1),c+=l,Math.abs(l)<=1e-10){n=c;break}t=U(this.long0+Math.asin(r*Math.tan(c)/this.a)/Math.sin(n),this.over)}else if(Math.abs(i+this.ml0)<=1e-10)n=0,t=U(this.long0+r/this.a,this.over);else{o=(this.ml0+i)/this.a,s=r*r/this.a/this.a+o*o,c=o;var d,f,p,m,h;for(a=Bi;a;--a)if(h=this.e*Math.sin(c),d=Math.sqrt(1-h*h)*Math.tan(c),f=this.a*Xr(this.e0,this.e1,this.e2,this.e3,c),p=this.e0-2*this.e1*Math.cos(2*c)+4*this.e2*Math.cos(4*c)-6*this.e3*Math.cos(6*c),m=f/this.a,l=(o*(d*m+1)-m-.5*d*(m*m+s))/(this.es*Math.sin(2*c)*(m*m+s-2*o*m)/(4*d)+(o-m)*(d*p-2/Math.sin(2*c))-p),c-=l,Math.abs(l)<=1e-10){n=c;break}d=Math.sqrt(1-this.es*Math.sin(n)**2)*Math.tan(n),t=U(this.long0+Math.asin(r*d/this.a)/Math.sin(n),this.over)}return e.x=t,e.y=n,e}var Wi={init:Vi,forward:Hi,inverse:Ui,names:[`Polyconic`,`American_Polyconic`,`poly`]};function Gi(){this.A=[],this.A[1]=.6399175073,this.A[2]=-.1358797613,this.A[3]=.063294409,this.A[4]=-.02526853,this.A[5]=.0117879,this.A[6]=-.0055161,this.A[7]=.0026906,this.A[8]=-.001333,this.A[9]=67e-5,this.A[10]=-34e-5,this.B_re=[],this.B_im=[],this.B_re[1]=.7557853228,this.B_im[1]=0,this.B_re[2]=.249204646,this.B_im[2]=.003371507,this.B_re[3]=-.001541739,this.B_im[3]=.04105856,this.B_re[4]=-.10162907,this.B_im[4]=.01727609,this.B_re[5]=-.26623489,this.B_im[5]=-.36249218,this.B_re[6]=-.6870983,this.B_im[6]=-1.1651967,this.C_re=[],this.C_im=[],this.C_re[1]=1.3231270439,this.C_im[1]=0,this.C_re[2]=-.577245789,this.C_im[2]=-.007809598,this.C_re[3]=.508307513,this.C_im[3]=-.112208952,this.C_re[4]=-.15094762,this.C_im[4]=.18200602,this.C_re[5]=1.01418179,this.C_im[5]=1.64497696,this.C_re[6]=1.9660549,this.C_im[6]=2.5127645,this.D=[],this.D[1]=1.5627014243,this.D[2]=.5185406398,this.D[3]=-.03333098,this.D[4]=-.1052906,this.D[5]=-.0368594,this.D[6]=.007317,this.D[7]=.0122,this.D[8]=.00394,this.D[9]=-.0013}function Ki(e){var t,n=e.x,r=e.y-this.lat0,i=n-this.long0,a=r/ue*1e-5,o=i,s=1,c=0;for(t=1;t<=10;t++)s*=a,c+=this.A[t]*s;var l=c,u=o,d=1,f=0,p,m,h=0,g=0;for(t=1;t<=6;t++)p=d*l-f*u,m=f*l+d*u,d=p,f=m,h=h+this.B_re[t]*d-this.B_im[t]*f,g=g+this.B_im[t]*d+this.B_re[t]*f;return e.x=g*this.a+this.x0,e.y=h*this.a+this.y0,e}function qi(e){var t,n=e.x,r=e.y,i=n-this.x0,a=(r-this.y0)/this.a,o=i/this.a,s=1,c=0,l,u,d=0,f=0;for(t=1;t<=6;t++)l=s*a-c*o,u=c*a+s*o,s=l,c=u,d=d+this.C_re[t]*s-this.C_im[t]*c,f=f+this.C_im[t]*s+this.C_re[t]*c;for(var p=0;p<this.iterations;p++){var m=d,h=f,g,_,v=a,y=o;for(t=2;t<=6;t++)g=m*d-h*f,_=h*d+m*f,m=g,h=_,v+=(t-1)*(this.B_re[t]*m-this.B_im[t]*h),y+=(t-1)*(this.B_im[t]*m+this.B_re[t]*h);m=1,h=0;var b=this.B_re[1],x=this.B_im[1];for(t=2;t<=6;t++)g=m*d-h*f,_=h*d+m*f,m=g,h=_,b+=t*(this.B_re[t]*m-this.B_im[t]*h),x+=t*(this.B_im[t]*m+this.B_re[t]*h);var S=b*b+x*x;d=(v*b+y*x)/S,f=(y*b-v*x)/S}var C=d,w=f,T=1,ee=0;for(t=1;t<=9;t++)T*=C,ee+=this.D[t]*T;var te=this.lat0+ee*ue*1e5;return e.x=this.long0+w,e.y=te,e}var Ji={init:Gi,forward:Ki,inverse:qi,names:[`New_Zealand_Map_Grid`,`nzmg`]};function Yi(){}function Xi(e){var t=e.x,n=e.y,r=U(t-this.long0,this.over),i=this.x0+this.a*r,a=this.y0+this.a*Math.log(Math.tan(Math.PI/4+n/2.5))*1.25;return e.x=i,e.y=a,e}function Zi(e){e.x-=this.x0,e.y-=this.y0;var t=U(this.long0+e.x/this.a,this.over),n=2.5*(Math.atan(Math.exp(.8*e.y/this.a))-Math.PI/4);return e.x=t,e.y=n,e}var Qi={init:Yi,forward:Xi,inverse:Zi,names:[`Miller_Cylindrical`,`mill`]},$i=20;function ea(){this.long0=this.long0||0,this.sphere?(this.n=1,this.m=0,this.es=0,this.C_y=Math.sqrt((this.m+1)/this.n),this.C_x=this.C_y/(this.m+1)):this.en=X(this.es)}function ta(e){var t,n,r=e.x,i=e.y;if(r=U(r-this.long0,this.over),this.sphere){if(!this.m)i=this.n===1?i:Math.asin(this.n*Math.sin(i));else for(var a=this.n*Math.sin(i),o=$i;o;--o){var s=(this.m*i+Math.sin(i)-a)/(this.m+Math.cos(i));if(i-=s,Math.abs(s)<1e-10)break}t=this.a*this.C_x*r*(this.m+Math.cos(i)),n=this.a*this.C_y*i}else{var c=Math.sin(i),l=Math.cos(i);n=this.a*Yn(i,c,l,this.en),t=this.a*r*l/Math.sqrt(1-this.es*c*c)}return e.x=t,e.y=n,e}function na(e){var t,n,r,i;return e.x-=this.x0,r=e.x/this.a,e.y-=this.y0,t=e.y/this.a,this.sphere?(t/=this.C_y,r/=this.C_x*(this.m+Math.cos(t)),this.m?t=xi((this.m*t+Math.sin(t))/this.n):this.n!==1&&(t=xi(Math.sin(t)/this.n)),r=U(r+this.long0,this.over),t=ni(t)):(t=Zn(e.y/this.a,this.es,this.en),i=Math.abs(t),i<j?(i=Math.sin(t),n=this.long0+e.x*Math.sqrt(1-this.es*i*i)/(this.a*Math.cos(t)),r=U(n,this.over)):i-1e-10<j&&(r=this.long0)),e.x=r,e.y=t,e}var ra={init:ea,forward:ta,inverse:na,names:[`Sinusoidal`,`sinu`]};function ia(){this.sphere=!0,this.b=this.a,this.m=1,this.n=2.5707963267948966,this.es=0,this.C_y=Math.sqrt((this.m+1)/this.n),this.C_x=this.C_y/(this.m+1)}var aa={init:ia,forward:ta,inverse:na,names:[`Eckert_VI`,`eck6`]};function oa(){this.x0=this.x0===void 0?0:this.x0,this.y0=this.y0===void 0?0:this.y0,this.long0=this.long0===void 0?0:this.long0}function sa(e){for(var t=e.x,n=e.y,r=U(t-this.long0,this.over),i=n,a=Math.PI*Math.sin(n);;){var o=-(i+Math.sin(i)-a)/(1+Math.cos(i));if(i+=o,Math.abs(o)<1e-10)break}i/=2,Math.PI/2-Math.abs(n)<1e-10&&(r=0);var s=.900316316158*this.a*r*Math.cos(i)+this.x0,c=1.4142135623731*this.a*Math.sin(i)+this.y0;return e.x=s,e.y=c,e}function ca(e){var t,n;e.x-=this.x0,e.y-=this.y0,n=e.y/(1.4142135623731*this.a),Math.abs(n)>.999999999999&&(n=.999999999999),t=Math.asin(n);var r=U(this.long0+e.x/(.900316316158*this.a*Math.cos(t)),this.over);r<-Math.PI&&(r=-Math.PI),r>Math.PI&&(r=Math.PI),n=(2*t+Math.sin(2*t))/Math.PI,Math.abs(n)>1&&(n=1);var i=Math.asin(n);return e.x=r,e.y=i,e}var la={init:oa,forward:sa,inverse:ca,names:[`Mollweide`,`moll`]};function ua(){Math.abs(this.lat1+this.lat2)<1e-10||(this.lat2=this.lat2||this.lat1,this.temp=this.b/this.a,this.es=1-this.temp**2,this.e=Math.sqrt(this.es),this.e0=Zr(this.es),this.e1=Qr(this.es),this.e2=$r(this.es),this.e3=ei(this.es),this.sin_phi=Math.sin(this.lat1),this.cos_phi=Math.cos(this.lat1),this.ms1=it(this.e,this.sin_phi,this.cos_phi),this.ml1=Xr(this.e0,this.e1,this.e2,this.e3,this.lat1),Math.abs(this.lat1-this.lat2)<1e-10?this.ns=this.sin_phi:(this.sin_phi=Math.sin(this.lat2),this.cos_phi=Math.cos(this.lat2),this.ms2=it(this.e,this.sin_phi,this.cos_phi),this.ml2=Xr(this.e0,this.e1,this.e2,this.e3,this.lat2),this.ns=(this.ms1-this.ms2)/(this.ml2-this.ml1)),this.g=this.ml1+this.ms1/this.ns,this.ml0=Xr(this.e0,this.e1,this.e2,this.e3,this.lat0),this.rh=this.a*(this.g-this.ml0))}function da(e){var t=e.x,n=e.y,r;if(this.sphere)r=this.a*(this.g-n);else{var i=Xr(this.e0,this.e1,this.e2,this.e3,n);r=this.a*(this.g-i)}var a=this.ns*U(t-this.long0,this.over),o=this.x0+r*Math.sin(a),s=this.y0+this.rh-r*Math.cos(a);return e.x=o,e.y=s,e}function fa(e){e.x-=this.x0,e.y=this.rh-e.y+this.y0;var t,n,r,i;this.ns>=0?(n=Math.sqrt(e.x*e.x+e.y*e.y),t=1):(n=-Math.sqrt(e.x*e.x+e.y*e.y),t=-1);var a=0;return n!==0&&(a=Math.atan2(t*e.x,t*e.y)),this.sphere?(i=U(this.long0+a/this.ns,this.over),r=ni(this.g-n/this.a),e.x=i,e.y=r,e):(r=ri(this.g-n/this.a,this.e0,this.e1,this.e2,this.e3),i=U(this.long0+a/this.ns,this.over),e.x=i,e.y=r,e)}var pa={init:ua,forward:da,inverse:fa,names:[`Equidistant_Conic`,`eqdc`]};function ma(){this.R=this.a}function ha(e){var t=e.x,n=e.y,r=U(t-this.long0,this.over),i,a;Math.abs(n)<=1e-10&&(i=this.x0+this.R*r,a=this.y0);var o=xi(2*Math.abs(n/Math.PI));(Math.abs(r)<=1e-10||Math.abs(Math.abs(n)-j)<=1e-10)&&(i=this.x0,a=n>=0?this.y0+Math.PI*this.R*Math.tan(.5*o):this.y0+Math.PI*this.R*-Math.tan(.5*o));var s=.5*Math.abs(Math.PI/r-r/Math.PI),c=s*s,l=Math.sin(o),u=Math.cos(o),d=u/(l+u-1),f=d*d,p=d*(2/l-1),m=p*p,h=Math.PI*this.R*(s*(d-m)+Math.sqrt(c*(d-m)*(d-m)-(m+c)*(f-m)))/(m+c);r<0&&(h=-h),i=this.x0+h;var g=c+d;return h=Math.PI*this.R*(p*g-s*Math.sqrt((m+c)*(c+1)-g*g))/(m+c),a=n>=0?this.y0+h:this.y0-h,e.x=i,e.y=a,e}function ga(e){var t,n,r,i,a,o,s,c,l,u,d,f,p;return e.x-=this.x0,e.y-=this.y0,d=Math.PI*this.R,r=e.x/d,i=e.y/d,a=r*r+i*i,o=-Math.abs(i)*(1+a),s=o-2*i*i+r*r,c=-2*o+1+2*i*i+a*a,p=i*i/c+(2*s*s*s/c/c/c-9*o*s/c/c)/27,l=(o-s*s/3/c)/c,u=2*Math.sqrt(-l/3),d=3*p/l/u,Math.abs(d)>1&&(d=d>=0?1:-1),f=Math.acos(d)/3,n=e.y>=0?(-u*Math.cos(f+Math.PI/3)-s/3/c)*Math.PI:-(-u*Math.cos(f+Math.PI/3)-s/3/c)*Math.PI,t=Math.abs(r)<1e-10?this.long0:U(this.long0+Math.PI*(a-1+Math.sqrt(1+2*(r*r-i*i)+a*a))/2/r,this.over),e.x=t,e.y=n,e}var _a={init:ma,forward:ha,inverse:ga,names:[`Van_der_Grinten_I`,`VanDerGrinten`,`Van_der_Grinten`,`vandg`]};function va(e,t,n,r,i,a){let o=r-t,s=Math.atan((1-a)*Math.tan(e)),c=Math.atan((1-a)*Math.tan(n)),l=Math.sin(s),u=Math.cos(s),d=Math.sin(c),f=Math.cos(c),p=o,m,h=100,g,_,v,y,b,x,S,C,w,T,ee,te,E,ne;do{if(g=Math.sin(p),_=Math.cos(p),v=Math.sqrt(f*g*(f*g)+(u*d-l*f*_)*(u*d-l*f*_)),v===0)return{azi1:0,s12:0};y=l*d+u*f*_,b=Math.atan2(v,y),x=u*f*g/v,S=1-x*x,C=S===0?0:y-2*l*d/S,w=a/16*S*(4+a*(4-3*S)),m=p,p=o+(1-w)*a*x*(b+w*v*(C+w*y*(-1+2*C*C)))}while(Math.abs(p-m)>1e-12&&--h>0);return h===0?{azi1:NaN,s12:NaN}:(T=S*(i*i-i*(1-a)*(i*(1-a)))/(i*(1-a)*(i*(1-a))),ee=1+T/16384*(4096+T*(-768+T*(320-175*T))),te=T/1024*(256+T*(-128+T*(74-47*T))),E=te*v*(C+te/4*(y*(-1+2*C*C)-te/6*C*(-3+4*v*v)*(-3+4*C*C))),ne=i*(1-a)*ee*(b-E),{azi1:Math.atan2(f*g,u*d-l*f*_),s12:ne})}function ya(e,t,n,r,i,a){let o=Math.atan((1-a)*Math.tan(e)),s=Math.sin(o),c=Math.cos(o),l=Math.sin(n),u=Math.cos(n),d=Math.atan2(s,c*u),f=c*l,p=1-f*f,m=p*(i*i-i*(1-a)*(i*(1-a)))/(i*(1-a)*(i*(1-a))),h=1+m/16384*(4096+m*(-768+m*(320-175*m))),g=m/1024*(256+m*(-128+m*(74-47*m))),_=r/(i*(1-a)*h),v,y=100,b,x,S,C;do b=Math.cos(2*d+_),x=Math.sin(_),S=Math.cos(_),C=g*x*(b+g/4*(S*(-1+2*b*b)-g/6*b*(-3+4*x*x)*(-3+4*b*b))),v=_,_=r/(i*(1-a)*h)+C;while(Math.abs(_-v)>1e-12&&--y>0);if(y===0)return{lat2:NaN,lon2:NaN};let w=s*x-c*S*u,T=Math.atan2(s*S+c*x*u,(1-a)*Math.sqrt(f*f+w*w)),ee=Math.atan2(x*l,c*S-s*x*u),te=a/16*p*(4+a*(4-3*p));return{lat2:T,lon2:t+(ee-(1-te)*a*f*(_+te*x*(b+te*S*(-1+2*b*b))))}}function ba(){this.sin_p12=Math.sin(this.lat0),this.cos_p12=Math.cos(this.lat0),this.f=this.es/(1+Math.sqrt(1-this.es))}function xa(e){var t=e.x,n=e.y,r=Math.sin(e.y),i=Math.cos(e.y),a=U(t-this.long0,this.over),o,s,c,l,u,d,f,p,m,h,g;return this.sphere?Math.abs(this.sin_p12-1)<=1e-10?(e.x=this.x0+this.a*(j-n)*Math.sin(a),e.y=this.y0-this.a*(j-n)*Math.cos(a),e):Math.abs(this.sin_p12+1)<=1e-10?(e.x=this.x0+this.a*(j+n)*Math.sin(a),e.y=this.y0+this.a*(j+n)*Math.cos(a),e):(m=this.sin_p12*r+this.cos_p12*i*Math.cos(a),f=Math.acos(m),p=f?f/Math.sin(f):1,e.x=this.x0+this.a*p*i*Math.sin(a),e.y=this.y0+this.a*p*(this.cos_p12*r-this.sin_p12*i*Math.cos(a)),e):(o=Zr(this.es),s=Qr(this.es),c=$r(this.es),l=ei(this.es),Math.abs(this.sin_p12-1)<=1e-10?(u=this.a*Xr(o,s,c,l,j),d=this.a*Xr(o,s,c,l,n),e.x=this.x0+(u-d)*Math.sin(a),e.y=this.y0-(u-d)*Math.cos(a),e):Math.abs(this.sin_p12+1)<=1e-10?(u=this.a*Xr(o,s,c,l,j),d=this.a*Xr(o,s,c,l,n),e.x=this.x0+(u+d)*Math.sin(a),e.y=this.y0+(u+d)*Math.cos(a),e):Math.abs(t)<1e-10&&Math.abs(n-this.lat0)<1e-10?(e.x=e.y=0,e):(h=va(this.lat0,this.long0,n,t,this.a,this.f),g=h.azi1,e.x=h.s12*Math.sin(g),e.y=h.s12*Math.cos(g),e))}function Sa(e){e.x-=this.x0,e.y-=this.y0;var t,n,r,i,a,o,s,c,l,u,d,f,p,m,h,g;return this.sphere?(t=Math.sqrt(e.x*e.x+e.y*e.y),t>2*j*this.a?void 0:(n=t/this.a,r=Math.sin(n),i=Math.cos(n),a=this.long0,Math.abs(t)<=1e-10?o=this.lat0:(o=xi(i*this.sin_p12+e.y*r*this.cos_p12/t),s=Math.abs(this.lat0)-j,a=Math.abs(s)<=1e-10?this.lat0>=0?U(this.long0+Math.atan2(e.x,-e.y),this.over):U(this.long0-Math.atan2(-e.x,e.y),this.over):U(this.long0+Math.atan2(e.x*r,t*this.cos_p12*i-e.y*this.sin_p12*r),this.over)),e.x=a,e.y=o,e)):(c=Zr(this.es),l=Qr(this.es),u=$r(this.es),d=ei(this.es),Math.abs(this.sin_p12-1)<=1e-10?(f=this.a*Xr(c,l,u,d,j),t=Math.sqrt(e.x*e.x+e.y*e.y),p=f-t,o=ri(p/this.a,c,l,u,d),a=U(this.long0+Math.atan2(e.x,-1*e.y),this.over),e.x=a,e.y=o,e):Math.abs(this.sin_p12+1)<=1e-10?(f=this.a*Xr(c,l,u,d,j),t=Math.sqrt(e.x*e.x+e.y*e.y),p=t-f,o=ri(p/this.a,c,l,u,d),a=U(this.long0+Math.atan2(e.x,e.y),this.over),e.x=a,e.y=o,e):(m=Math.atan2(e.x,e.y),h=Math.sqrt(e.x*e.x+e.y*e.y),g=ya(this.lat0,this.long0,m,h,this.a,this.f),e.x=g.lon2,e.y=g.lat2,e))}var Ca={init:ba,forward:xa,inverse:Sa,names:[`Azimuthal_Equidistant`,`aeqd`]};function wa(){this.sin_p14=Math.sin(this.lat0||0),this.cos_p14=Math.cos(this.lat0||0)}function Ta(e){var t,n,r,i,a,o,s,c,l=e.x,u=e.y;return r=U(l-(this.long0||0),this.over),t=Math.sin(u),n=Math.cos(u),i=Math.cos(r),o=this.sin_p14*t+this.cos_p14*n*i,a=1,(o>0||Math.abs(o)<=1e-10)&&(s=this.a*a*n*Math.sin(r),c=(this.y0||0)+this.a*a*(this.cos_p14*t-this.sin_p14*n*i)),e.x=s,e.y=c,e}function Ea(e){var t,n,r,i,a,o,s,c,l;return e.x-=this.x0||0,e.y-=this.y0||0,t=Math.sqrt(e.x*e.x+e.y*e.y),n=xi(t/this.a),r=Math.sin(n),i=Math.cos(n),c=this.long0||0,l=this.lat0||0,o=c,Math.abs(t)<=1e-10?(s=l,e.x=o,e.y=s,e):(s=xi(i*this.sin_p14+e.y*r*this.cos_p14/t),a=Math.abs(l)-j,Math.abs(a)<=1e-10?(o=U(l>=0?c+Math.atan2(e.x,-e.y):c-Math.atan2(-e.x,e.y),this.over),e.x=o,e.y=s,e):(o=U(c+Math.atan2(e.x*r,t*this.cos_p14*i-e.y*this.sin_p14*r),this.over),e.x=o,e.y=s,e))}var Da={init:wa,forward:Ta,inverse:Ea,names:[`ortho`]},Q={FRONT:1,RIGHT:2,BACK:3,LEFT:4,TOP:5,BOTTOM:6},$={AREA_0:1,AREA_1:2,AREA_2:3,AREA_3:4};function Oa(){this.x0=this.x0||0,this.y0=this.y0||0,this.lat0=this.lat0||0,this.long0=this.long0||0,this.lat_ts=this.lat_ts||0,this.title=this.title||`Quadrilateralized Spherical Cube`,this.lat0>=j-N/2?this.face=Q.TOP:this.lat0<=-(j-N/2)?this.face=Q.BOTTOM:Math.abs(this.long0)<=N?this.face=Q.FRONT:Math.abs(this.long0)<=j+N?this.face=this.long0>0?Q.RIGHT:Q.LEFT:this.face=Q.BACK,this.es!==0&&(this.one_minus_f=1-(this.a-this.b)/this.a,this.one_minus_f_squared=this.one_minus_f*this.one_minus_f)}function ka(e){var t={x:0,y:0},n,r,i,a,o,s,c={value:0};if(e.x-=this.long0,n=this.es===0?e.y:Math.atan(this.one_minus_f_squared*Math.tan(e.y)),r=e.x,this.face===Q.TOP)a=j-n,r>=N&&r<=j+N?(c.value=$.AREA_0,i=r-j):r>j+N||r<=-(j+N)?(c.value=$.AREA_1,i=r>0?r-P:r+P):r>-(j+N)&&r<=-N?(c.value=$.AREA_2,i=r+j):(c.value=$.AREA_3,i=r);else if(this.face===Q.BOTTOM)a=j+n,r>=N&&r<=j+N?(c.value=$.AREA_0,i=-r+j):r<N&&r>=-N?(c.value=$.AREA_1,i=-r):r<-N&&r>=-(j+N)?(c.value=$.AREA_2,i=-r-j):(c.value=$.AREA_3,i=r>0?-r+P:-r-P);else{var l,u,d,f,p,m,h;this.face===Q.RIGHT?r=Ma(r,+j):this.face===Q.BACK?r=Ma(r,+P):this.face===Q.LEFT&&(r=Ma(r,-j)),f=Math.sin(n),p=Math.cos(n),m=Math.sin(r),h=Math.cos(r),l=p*h,u=p*m,d=f,this.face===Q.FRONT?(a=Math.acos(l),i=ja(a,d,u,c)):this.face===Q.RIGHT?(a=Math.acos(u),i=ja(a,d,-l,c)):this.face===Q.BACK?(a=Math.acos(-l),i=ja(a,d,-u,c)):this.face===Q.LEFT?(a=Math.acos(-u),i=ja(a,d,l,c)):(a=i=0,c.value=$.AREA_0)}return s=Math.atan(12/P*(i+Math.acos(Math.sin(i)*Math.cos(N))-j)),o=Math.sqrt((1-Math.cos(a))/(Math.cos(s)*Math.cos(s))/(1-Math.cos(Math.atan(1/Math.cos(i))))),c.value===$.AREA_1?s+=j:c.value===$.AREA_2?s+=P:c.value===$.AREA_3&&(s+=1.5*P),t.x=o*Math.cos(s),t.y=o*Math.sin(s),t.x=t.x*this.a+this.x0,t.y=t.y*this.a+this.y0,e.x=t.x,e.y=t.y,e}function Aa(e){var t={lam:0,phi:0},n,r,i,a,o,s,c,l,u,d={value:0};if(e.x=(e.x-this.x0)/this.a,e.y=(e.y-this.y0)/this.a,r=Math.atan(Math.sqrt(e.x*e.x+e.y*e.y)),n=Math.atan2(e.y,e.x),e.x>=0&&e.x>=Math.abs(e.y)?d.value=$.AREA_0:e.y>=0&&e.y>=Math.abs(e.x)?(d.value=$.AREA_1,n-=j):e.x<0&&-e.x>=Math.abs(e.y)?(d.value=$.AREA_2,n=n<0?n+P:n-P):(d.value=$.AREA_3,n+=j),u=P/12*Math.tan(n),o=Math.sin(u)/(Math.cos(u)-1/Math.sqrt(2)),s=Math.atan(o),i=Math.cos(n),a=Math.tan(r),c=1-i*i*a*a*(1-Math.cos(Math.atan(1/Math.cos(s)))),c<-1?c=-1:c>1&&(c=1),this.face===Q.TOP)l=Math.acos(c),t.phi=j-l,d.value===$.AREA_0?t.lam=s+j:d.value===$.AREA_1?t.lam=s<0?s+P:s-P:d.value===$.AREA_2?t.lam=s-j:t.lam=s;else if(this.face===Q.BOTTOM)l=Math.acos(c),t.phi=l-j,d.value===$.AREA_0?t.lam=-s+j:d.value===$.AREA_1?t.lam=-s:d.value===$.AREA_2?t.lam=-s-j:t.lam=s<0?-s-P:-s+P;else{var f=c,p,m;u=f*f,m=u>=1?0:Math.sqrt(1-u)*Math.sin(s),u+=m*m,p=u>=1?0:Math.sqrt(1-u),d.value===$.AREA_1?(u=p,p=-m,m=u):d.value===$.AREA_2?(p=-p,m=-m):d.value===$.AREA_3&&(u=p,p=m,m=-u),this.face===Q.RIGHT?(u=f,f=-p,p=u):this.face===Q.BACK?(f=-f,p=-p):this.face===Q.LEFT&&(u=f,f=p,p=-u),t.phi=Math.acos(-m)-j,t.lam=Math.atan2(p,f),this.face===Q.RIGHT?t.lam=Ma(t.lam,-j):this.face===Q.BACK?t.lam=Ma(t.lam,-P):this.face===Q.LEFT&&(t.lam=Ma(t.lam,+j))}if(this.es!==0){var h=+(t.phi<0),g=Math.tan(t.phi),_=this.b/Math.sqrt(g*g+this.one_minus_f_squared);t.phi=Math.atan(Math.sqrt(this.a*this.a-_*_)/(this.one_minus_f*_)),h&&(t.phi=-t.phi)}return t.lam+=this.long0,e.x=t.lam,e.y=t.phi,e}function ja(e,t,n,r){var i;return e<1e-10?(r.value=$.AREA_0,i=0):(i=Math.atan2(t,n),Math.abs(i)<=N?r.value=$.AREA_0:i>N&&i<=j+N?(r.value=$.AREA_1,i-=j):i>j+N||i<=-(j+N)?(r.value=$.AREA_2,i=i>=0?i-P:i+P):(r.value=$.AREA_3,i+=j)),i}function Ma(e,t){var n=e+t;return n<-3.14159265359?n+=ge:n>3.14159265359&&(n-=ge),n}var Na={init:Oa,forward:ka,inverse:Aa,names:[`Quadrilateralized Spherical Cube`,`Quadrilateralized_Spherical_Cube`,`qsc`]},Pa=[[1,22199e-21,-715515e-10,31103e-10],[.9986,-482243e-9,-24897e-9,-13309e-10],[.9954,-83103e-8,-448605e-10,-9.86701e-7],[.99,-.00135364,-59661e-9,36777e-10],[.9822,-.00167442,-449547e-11,-572411e-11],[.973,-.00214868,-903571e-10,1.8736e-8],[.96,-.00305085,-900761e-10,164917e-11],[.9427,-.00382792,-653386e-10,-26154e-10],[.9216,-.00467746,-10457e-8,481243e-11],[.8962,-.00536223,-323831e-10,-543432e-11],[.8679,-.00609363,-113898e-9,332484e-11],[.835,-.00698325,-640253e-10,9.34959e-7],[.7986,-.00755338,-500009e-10,9.35324e-7],[.7597,-.00798324,-35971e-9,-227626e-11],[.7186,-.00851367,-701149e-10,-86303e-10],[.6732,-.00986209,-199569e-9,191974e-10],[.6213,-.010418,883923e-10,624051e-11],[.5722,-.00906601,182e-6,624051e-11],[.5322,-.00677797,275608e-9,624051e-11]],Fa=[[-520417e-23,.0124,121431e-23,-845284e-16],[.062,.0124,-1.26793e-9,422642e-15],[.124,.0124,5.07171e-9,-1.60604e-9],[.186,.0123999,-1.90189e-8,6.00152e-9],[.248,.0124002,7.10039e-8,-2.24e-8],[.31,.0123992,-2.64997e-7,8.35986e-8],[.372,.0124029,9.88983e-7,-3.11994e-7],[.434,.0123893,-369093e-11,-4.35621e-7],[.4958,.0123198,-102252e-10,-3.45523e-7],[.5571,.0121916,-154081e-10,-5.82288e-7],[.6176,.0119938,-241424e-10,-5.25327e-7],[.6769,.011713,-320223e-10,-5.16405e-7],[.7346,.0113541,-397684e-10,-6.09052e-7],[.7903,.0109107,-489042e-10,-104739e-11],[.8435,.0103431,-64615e-9,-1.40374e-9],[.8936,.00969686,-64636e-9,-8547e-9],[.9394,.00840947,-192841e-9,-42106e-10],[.9761,.00616527,-256e-6,-42106e-10],[1,.00328947,-319159e-9,-42106e-10]],Ia=.8487,La=1.3523,Ra=he/5,za=1/Ra,Ba=18,Va=function(e,t){return e[0]+t*(e[1]+t*(e[2]+t*e[3]))},Ha=function(e,t){return e[1]+t*(2*e[2]+t*3*e[3])};function Ua(e,t,n,r){for(var i=t;r;--r){var a=e(i);if(i-=a,Math.abs(a)<n)break}return i}function Wa(){this.x0=this.x0||0,this.y0=this.y0||0,this.long0=this.long0||0,this.es=0,this.title=this.title||`Robinson`}function Ga(e){var t=U(e.x-this.long0,this.over),n=Math.abs(e.y),r=Math.floor(n*Ra);r<0?r=0:r>=Ba&&(r=Ba-1),n=he*(n-za*r);var i={x:Va(Pa[r],n)*t,y:Va(Fa[r],n)};return e.y<0&&(i.y=-i.y),i.x=i.x*this.a*Ia+this.x0,i.y=i.y*this.a*La+this.y0,i}function Ka(e){var t={x:(e.x-this.x0)/(this.a*Ia),y:Math.abs(e.y-this.y0)/(this.a*La)};if(t.y>=1)t.x/=Pa[Ba][0],t.y=e.y<0?-j:j;else{var n=Math.floor(t.y*Ba);for(n<0?n=0:n>=Ba&&(n=Ba-1);;)if(Fa[n][0]>t.y)--n;else if(Fa[n+1][0]<=t.y)++n;else break;var r=Fa[n],i=5*(t.y-r[0])/(Fa[n+1][0]-r[0]);i=Ua(function(e){return(Va(r,e)-t.y)/Ha(r,e)},i,me,100),t.x/=Va(Pa[n],i),t.y=(5*n+i)*M,e.y<0&&(t.y=-t.y)}return t.x=U(t.x+this.long0,this.over),t}var qa={init:Wa,forward:Ga,inverse:Ka,names:[`Robinson`,`robin`]};function Ja(){this.name=`geocent`}function Ya(e){return Gt(e,this.es,this.a)}function Xa(e){return Kt(e,this.es,this.a,this.b)}var Za={init:Ja,forward:Ya,inverse:Xa,names:[`Geocentric`,`geocentric`,`geocent`,`Geocent`]},Qa={N_POLE:0,S_POLE:1,EQUIT:2,OBLIQ:3},$a={h:{def:1e5,num:!0},azi:{def:0,num:!0,degrees:!0},tilt:{def:0,num:!0,degrees:!0},long0:{def:0,num:!0},lat0:{def:0,num:!0}};function eo(){if(Object.keys($a).forEach(function(e){if(this[e]===void 0)this[e]=$a[e].def;else if($a[e].num&&isNaN(this[e]))throw Error(`Invalid parameter value, must be numeric `+e+` = `+this[e]);else $a[e].num&&(this[e]=parseFloat(this[e]));$a[e].degrees&&(this[e]=this[e]*M)}.bind(this)),Math.abs(Math.abs(this.lat0)-j)<1e-10?this.mode=this.lat0<0?Qa.S_POLE:Qa.N_POLE:Math.abs(this.lat0)<1e-10?this.mode=Qa.EQUIT:(this.mode=Qa.OBLIQ,this.sinph0=Math.sin(this.lat0),this.cosph0=Math.cos(this.lat0)),this.pn1=this.h/this.a,this.pn1<=0||this.pn1>1e10)throw Error(`Invalid height`);this.p=1+this.pn1,this.rp=1/this.p,this.h1=1/this.pn1,this.pfact=(this.p+1)*this.h1,this.es=0;var e=this.tilt,t=this.azi;this.cg=Math.cos(t),this.sg=Math.sin(t),this.cw=Math.cos(e),this.sw=Math.sin(e)}function to(e){e.x-=this.long0;var t=Math.sin(e.y),n=Math.cos(e.y),r=Math.cos(e.x),i,a;switch(this.mode){case Qa.OBLIQ:a=this.sinph0*t+this.cosph0*n*r;break;case Qa.EQUIT:a=n*r;break;case Qa.S_POLE:a=-t;break;case Qa.N_POLE:a=t;break}switch(a=this.pn1/(this.p-a),i=a*n*Math.sin(e.x),this.mode){case Qa.OBLIQ:a*=this.cosph0*t-this.sinph0*n*r;break;case Qa.EQUIT:a*=t;break;case Qa.N_POLE:a*=-(n*r);break;case Qa.S_POLE:a*=n*r;break}var o=a*this.cg+i*this.sg,s=1/(o*this.sw*this.h1+this.cw);return i=(i*this.cg-a*this.sg)*this.cw*s,a=o*s,e.x=i*this.a,e.y=a*this.a,e}function no(e){e.x/=this.a,e.y/=this.a;var t={x:e.x,y:e.y},n,r,i=1/(this.pn1-e.y*this.sw);n=this.pn1*e.x*i,r=this.pn1*e.y*this.cw*i,e.x=n*this.cg+r*this.sg,e.y=r*this.cg-n*this.sg;var a=Z(e.x,e.y);if(Math.abs(a)<1e-10)t.x=0,t.y=e.y;else{var o,s=1-a*a*this.pfact;switch(s=(this.p-Math.sqrt(s))/(this.pn1/a+a/this.pn1),o=Math.sqrt(1-s*s),this.mode){case Qa.OBLIQ:t.y=Math.asin(o*this.sinph0+e.y*s*this.cosph0/a),e.y=(o-this.sinph0*Math.sin(t.y))*a,e.x*=s*this.cosph0;break;case Qa.EQUIT:t.y=Math.asin(e.y*s/a),e.y=o*a,e.x*=s;break;case Qa.N_POLE:t.y=Math.asin(o),e.y=-e.y;break;case Qa.S_POLE:t.y=-Math.asin(o);break}t.x=Math.atan2(e.x,e.y)}return e.x=t.x+this.long0,e.y=t.y,e}var ro={init:eo,forward:to,inverse:no,names:[`Tilted_Perspective`,`tpers`]};function io(){if(this.flip_axis=+(this.sweep===`x`),this.h=Number(this.h),this.radius_g_1=this.h/this.a,this.radius_g_1<=0||this.radius_g_1>1e10)throw Error();if(this.radius_g=1+this.radius_g_1,this.C=this.radius_g*this.radius_g-1,this.es!==0){var e=1-this.es,t=1/e;this.radius_p=Math.sqrt(e),this.radius_p2=e,this.radius_p_inv2=t,this.shape=`ellipse`}else this.radius_p=1,this.radius_p2=1,this.radius_p_inv2=1,this.shape=`sphere`;this.title||=`Geostationary Satellite View`}function ao(e){var t=e.x,n=e.y,r,i,a,o;if(t-=this.long0,this.shape===`ellipse`){n=Math.atan(this.radius_p2*Math.tan(n));var s=this.radius_p/Z(this.radius_p*Math.cos(n),Math.sin(n));if(i=s*Math.cos(t)*Math.cos(n),a=s*Math.sin(t)*Math.cos(n),o=s*Math.sin(n),(this.radius_g-i)*i-a*a-o*o*this.radius_p_inv2<0)return e.x=NaN,e.y=NaN,e;r=this.radius_g-i,this.flip_axis?(e.x=this.radius_g_1*Math.atan(a/Z(o,r)),e.y=this.radius_g_1*Math.atan(o/r)):(e.x=this.radius_g_1*Math.atan(a/r),e.y=this.radius_g_1*Math.atan(o/Z(a,r)))}else this.shape===`sphere`&&(r=Math.cos(n),i=Math.cos(t)*r,a=Math.sin(t)*r,o=Math.sin(n),r=this.radius_g-i,this.flip_axis?(e.x=this.radius_g_1*Math.atan(a/Z(o,r)),e.y=this.radius_g_1*Math.atan(o/r)):(e.x=this.radius_g_1*Math.atan(a/r),e.y=this.radius_g_1*Math.atan(o/Z(a,r))));return e.x*=this.a,e.y*=this.a,e}function oo(e){var t=-1,n=0,r=0,i,a,o,s;if(e.x/=this.a,e.y/=this.a,this.shape===`ellipse`){this.flip_axis?(r=Math.tan(e.y/this.radius_g_1),n=Math.tan(e.x/this.radius_g_1)*Z(1,r)):(n=Math.tan(e.x/this.radius_g_1),r=Math.tan(e.y/this.radius_g_1)*Z(1,n));var c=r/this.radius_p;if(i=n*n+c*c+t*t,a=2*this.radius_g*t,o=a*a-4*i*this.C,o<0)return e.x=NaN,e.y=NaN,e;s=(-a-Math.sqrt(o))/(2*i),t=this.radius_g+s*t,n*=s,r*=s,e.x=Math.atan2(n,t),e.y=Math.atan(r*Math.cos(e.x)/t),e.y=Math.atan(this.radius_p_inv2*Math.tan(e.y))}else if(this.shape===`sphere`){if(this.flip_axis?(r=Math.tan(e.y/this.radius_g_1),n=Math.tan(e.x/this.radius_g_1)*Math.sqrt(1+r*r)):(n=Math.tan(e.x/this.radius_g_1),r=Math.tan(e.y/this.radius_g_1)*Math.sqrt(1+n*n)),i=n*n+r*r+t*t,a=2*this.radius_g*t,o=a*a-4*i*this.C,o<0)return e.x=NaN,e.y=NaN,e;s=(-a-Math.sqrt(o))/(2*i),t=this.radius_g+s*t,n*=s,r*=s,e.x=Math.atan2(n,t),e.y=Math.atan(r*Math.cos(e.x)/t)}return e.x+=this.long0,e}var so={init:io,forward:ao,inverse:oo,names:[`Geostationary Satellite View`,`Geostationary_Satellite`,`geos`]},co=1.340264,lo=-.081106,uo=893e-6,fo=.003796,po=Math.sqrt(3)/2;function mo(){this.long0=this.long0===void 0?0:this.long0,this.x0=this.x0===void 0?0:this.x0,this.y0=this.y0===void 0?0:this.y0,this.es!==0&&(this.apa=hi(this.es),this.qp=ci(this.e,1),this.rqda=Math.sqrt(.5*this.qp))}function ho(e){var t=U(e.x-this.long0,this.over),n=e.y,r=Math.sin(n);this.es!==0&&(r=ci(this.e,r)/this.qp);var i=Math.asin(po*r),a=i*i,o=a*a*a;return e.x=t*Math.cos(i)/(po*(co+3*lo*a+o*(7*uo+9*fo*a))),e.y=i*(co+lo*a+o*(uo+fo*a)),this.es!==0&&(e.x*=this.rqda,e.y*=this.rqda),e.x=this.a*e.x+this.x0,e.y=this.a*e.y+this.y0,e}function go(e){e.x=(e.x-this.x0)/this.a,e.y=(e.y-this.y0)/this.a,this.es!==0&&(e.x/=this.rqda,e.y/=this.rqda);var t=1e-9,n=12,r=e.y,i,a,o,s,c,l;for(l=0;l<n&&(i=r*r,a=i*i*i,o=r*(co+lo*i+a*(uo+fo*i))-e.y,s=co+3*lo*i+a*(7*uo+9*fo*i),r-=c=o/s,!(Math.abs(c)<t));++l);return i=r*r,a=i*i*i,e.x=po*e.x*(co+3*lo*i+a*(7*uo+9*fo*i))/Math.cos(r),e.y=Math.asin(Math.sin(r)/po),this.es!==0&&(e.y=gi(e.y,this.apa)),e.x=U(e.x+this.long0,this.over),e}var _o={init:mo,forward:ho,inverse:go,names:[`eqearth`,`Equal Earth`,`Equal_Earth`]},vo=1e-10;function yo(){var e;if(this.phi1=this.lat1,Math.abs(this.phi1)<vo)throw Error();this.es?(this.en=X(this.es),this.m1=Yn(this.phi1,this.am1=Math.sin(this.phi1),e=Math.cos(this.phi1),this.en),this.am1=e/(Math.sqrt(1-this.es*this.am1*this.am1)*this.am1),this.inverse=xo,this.forward=bo):(Math.abs(this.phi1)+vo>=j?this.cphi1=0:this.cphi1=1/Math.tan(this.phi1),this.inverse=Co,this.forward=So)}function bo(e){var t=U(e.x-(this.long0||0),this.over),n=e.y,r=this.am1+this.m1-Yn(n,i=Math.sin(n),a=Math.cos(n),this.en),i=a*t/(r*Math.sqrt(1-this.es*i*i)),a;return e.x=r*Math.sin(i),e.y=this.am1-r*Math.cos(i),e.x=this.a*e.x+(this.x0||0),e.y=this.a*e.y+(this.y0||0),e}function xo(e){e.x=(e.x-(this.x0||0))/this.a,e.y=(e.y-(this.y0||0))/this.a;var t,n=Z(e.x,e.y=this.am1-e.y),r,i=Zn(this.am1+this.m1-n,this.es,this.en);if((t=Math.abs(i))<j)t=Math.sin(i),r=n*Math.atan2(e.x,e.y)*Math.sqrt(1-this.es*t*t)/Math.cos(i);else if(Math.abs(t-j)<=vo)r=0;else throw Error();return e.x=U(r+(this.long0||0),this.over),e.y=ni(i),e}function So(e){var t=U(e.x-(this.long0||0),this.over),n=e.y,r,i=this.cphi1+this.phi1-n;return Math.abs(i)>vo?(e.x=i*Math.sin(r=t*Math.cos(n)/i),e.y=this.cphi1-i*Math.cos(r)):e.x=e.y=0,e.x=this.a*e.x+(this.x0||0),e.y=this.a*e.y+(this.y0||0),e}function Co(e){e.x=(e.x-(this.x0||0))/this.a,e.y=(e.y-(this.y0||0))/this.a;var t,n,r=Z(e.x,e.y=this.cphi1-e.y);if(n=this.cphi1+this.phi1-r,Math.abs(n)>j)throw Error();return t=Math.abs(Math.abs(n)-j)<=vo?0:r*Math.atan2(e.x,e.y)/Math.cos(n),e.x=U(t+(this.long0||0),this.over),e.y=ni(n),e}var wo={init:yo,names:[`bonne`,`Bonne (Werner lat_1=90)`]};let To={OBLIQUE:{forward:jo,inverse:No},TRANSVERSE:{forward:Mo,inverse:Po}},Eo={ROTATE:{o_alpha:`oAlpha`,o_lon_c:`oLongC`,o_lat_c:`oLatC`},NEW_POLE:{o_lat_p:`oLatP`,o_lon_p:`oLongP`},NEW_EQUATOR:{o_lon_1:`oLong1`,o_lat_1:`oLat1`,o_lon_2:`oLong2`,o_lat_2:`oLat2`}};function Do(){if(this.x0=this.x0||0,this.y0=this.y0||0,this.long0=this.long0||0,this.title=this.title||`General Oblique Transformation`,this.isIdentity=mt.includes(this.o_proj),!this.o_proj)throw Error(`Missing parameter: o_proj`);if(this.o_proj===`ob_tran`)throw Error(`Invalid value for o_proj: `+this.o_proj);let e=K(this.projStr.replace(`+proj=ob_tran`,``).replace(`+o_proj=`,`+proj=`).trim());if(!e)throw Error(`Invalid parameter: o_proj. Unknown projection `+this.o_proj);e.long0=0,this.obliqueProjection=e;let t,n=Object.keys(Eo),r=e=>{if(this[e]===void 0)return;let t=parseFloat(this[e])*M;if(isNaN(t))throw Error(`Invalid value for `+e+`: `+this[e]);return t};for(let e=0;e<n.length;e++){let i=n[e],a=Eo[i],o=Object.entries(a);if(o.some(([e])=>this[e]!==void 0)){t=a;for(let e=0;e<o.length;e++){let[t,n]=o[e],i=r(t);if(i===void 0)throw Error(`Missing parameter: `+t+`.`);this[n]=i}break}}if(!t)throw Error(`No valid parameters provided for ob_tran projection.`);let{lamp:i,phip:a}=Ao(this,t);this.lamp=i,Math.abs(a)>1e-10?(this.cphip=Math.cos(a),this.sphip=Math.sin(a),this.projectionType=To.OBLIQUE):this.projectionType=To.TRANSVERSE}function Oo(e){return this.projectionType.forward(this,e)}function ko(e){return this.projectionType.inverse(this,e)}function Ao(e,t){let n,r;if(t===Eo.ROTATE){let t=e.oLongC,i=e.oLatC,a=e.oAlpha;if(Math.abs(Math.abs(i)-j)<=1e-10)throw Error(`Invalid value for o_lat_c: `+e.o_lat_c+` should be < 90°`);r=t+Math.atan2(-1*Math.cos(a),-1*Math.sin(a)*Math.sin(i)),n=Math.asin(Math.cos(i)*Math.sin(a))}else if(t===Eo.NEW_POLE)r=e.oLongP,n=e.oLatP;else{let t=e.oLong1,i=e.oLat1,a=e.oLong2,o=e.oLat2,s=Math.abs(i);if(Math.abs(i)>j-1e-10)throw Error(`Invalid value for o_lat_1: `+e.o_lat_1+` should be < 90°`);if(Math.abs(o)>j-1e-10)throw Error(`Invalid value for o_lat_2: `+e.o_lat_2+` should be < 90°`);if(Math.abs(i-o)<1e-10)throw Error(`Invalid value for o_lat_1 and o_lat_2: o_lat_1 should be different from o_lat_2`);if(s<1e-10)throw Error(`Invalid value for o_lat_1: o_lat_1 should be different from zero`);r=Math.atan2(Math.cos(i)*Math.sin(o)*Math.cos(t)-Math.sin(i)*Math.cos(o)*Math.cos(a),Math.sin(i)*Math.cos(o)*Math.sin(a)-Math.cos(i)*Math.sin(o)*Math.sin(t)),n=Math.atan(-1*Math.cos(r-t)/Math.tan(i))}return{lamp:r,phip:n}}function jo(e,t){let{x:n,y:r}=t;n=U(n-e.long0,e.over);let i=Math.cos(n),a=Math.sin(r),o=Math.cos(r);t.x=U(Math.atan2(o*Math.sin(n),e.sphip*o*i+e.cphip*a)+e.lamp),t.y=Math.asin(e.sphip*a-e.cphip*o*i);let s=e.obliqueProjection.forward(t);return e.isIdentity&&(s.x*=he,s.y*=he),s}function Mo(e,t){let{x:n,y:r}=t;n=U(n-e.long0,e.over);let i=Math.cos(r),a=Math.cos(n);t.x=U(Math.atan2(i*Math.sin(n),Math.sin(r))+e.lamp),t.y=Math.asin(-1*i*a);let o=e.obliqueProjection.forward(t);return e.isIdentity&&(o.x*=he,o.y*=he),o}function No(e,t){e.isIdentity&&(t.x*=M,t.y*=M);let{x:n,y:r}=e.obliqueProjection.inverse(t);if(n<Number.MAX_VALUE){n-=e.lamp;let i=Math.cos(n),a=Math.sin(r),o=Math.cos(r);t.x=Math.atan2(o*Math.sin(n),e.sphip*o*i-e.cphip*a),t.y=Math.asin(e.sphip*a+e.cphip*o*i)}return t.x=U(t.x+e.long0),t}function Po(e,t){e.isIdentity&&(t.x*=M,t.y*=M);let{x:n,y:r}=e.obliqueProjection.inverse(t);if(n<Number.MAX_VALUE){let i=Math.cos(r);n-=e.lamp,t.x=Math.atan2(i*Math.sin(n),-1*Math.sin(r)),t.y=Math.asin(i*Math.cos(n))}return t.x=U(t.x+e.long0),t}var Fo={init:Do,forward:Oo,inverse:ko,names:[`General Oblique Transformation`,`General_Oblique_Transformation`,`ob_tran`]};function Io(e){e.Proj.projections.add(tr),e.Proj.projections.add(fr),e.Proj.projections.add(gr),e.Proj.projections.add(Er),e.Proj.projections.add(jr),e.Proj.projections.add(Fr),e.Proj.projections.add(Vr),e.Proj.projections.add(Gr),e.Proj.projections.add(Yr),e.Proj.projections.add(si),e.Proj.projections.add(bi),e.Proj.projections.add(Ei),e.Proj.projections.add(Ai),e.Proj.projections.add(Fi),e.Proj.projections.add(zi),e.Proj.projections.add(Wi),e.Proj.projections.add(Ji),e.Proj.projections.add(Qi),e.Proj.projections.add(ra),e.Proj.projections.add(aa),e.Proj.projections.add(la),e.Proj.projections.add(pa),e.Proj.projections.add(_a),e.Proj.projections.add(Ca),e.Proj.projections.add(Da),e.Proj.projections.add(Na),e.Proj.projections.add(qa),e.Proj.projections.add(Za),e.Proj.projections.add(ro),e.Proj.projections.add(so),e.Proj.projections.add(_o),e.Proj.projections.add(wo),e.Proj.projections.add(Fo)}let Lo=Object.assign(dn,{defaultDatum:`WGS84`,Proj:K,WGS84:new K(`WGS84`),Point:In,toPoint:nn,defs:V,nadgrid:jt,transform:sn,mgrs:yn,version:`__VERSION__`});Io(Lo);let Ro={2:[153,111,66],3:[90,156,68],4:[70,133,53],5:[50,110,38],6:[219,141,51],9:[59,121,191],10:[140,140,140],11:[100,100,100]},zo=[190,190,190];var Bo=`AGFzbQEAAAABwgM2YAF/AX9gAX8AYAJ/fwBgAn9/AX9gA39/fwF/YAN/f38AYAZ/f39/f38Bf2AEf39/fwF/YAV/f39/fwF/YAR/f39/AGAFf39/f38AYAZ/f39/f38AYAAAYAh/f39/f39/fwF/YAd/f39/f39/AX9gAAF/YAF/AX5gBX9+fn5+AGAHf39/f39/fwBgBX9/fn9/AGAFf39/f34Bf2ADf35/AX5gCH9/f39/f39/AGAEf35+fwBgCn9/f39/f39/f38Bf2AGf39/f35+AX9gB39/f39/fn4Bf2ADf39+AX9gAn9+AGAEf39/fwF+YAx/f39/f39/f39/f38Bf2AFf39/f3wBf2ALf39/f39/f39/f38Bf2AKf39/f39/f39/fwBgD39/f39/f39/f39/f39/fwBgA39/fwF+YA1/f39/f39/f39/f39/AGAEf39/fgF/YAJ/fABgBH5+fn4Bf2ADfn5+AX9gAX8BfGACf38BfmACfn4BfWACfn4BfGADf39+AGACfH8BfGACfn8Bf2AGf3x/f39/AX9gBH9/f34BfmADf39/AX1gA39/fwF8YAl/f39/f39/f38Bf2AEf39+fgACwAUXA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2NsYXNzACQDZW52Il9lbWJpbmRfcmVnaXN0ZXJfY2xhc3NfY29uc3RydWN0b3IACwNlbnYfX2VtYmluZF9yZWdpc3Rlcl9jbGFzc19mdW5jdGlvbgAWA2VudhhfX2N4YV9hbGxvY2F0ZV9leGNlcHRpb24AAANlbnYLX19jeGFfdGhyb3cABQNlbnYVX2VtYmluZF9yZWdpc3Rlcl92b2lkAAIDZW52FV9lbWJpbmRfcmVnaXN0ZXJfYm9vbAAKA2VudhhfZW1iaW5kX3JlZ2lzdGVyX2ludGVnZXIACgNlbnYWX2VtYmluZF9yZWdpc3Rlcl9mbG9hdAAFA2VudhtfZW1iaW5kX3JlZ2lzdGVyX3N0ZF9zdHJpbmcAAgNlbnYcX2VtYmluZF9yZWdpc3Rlcl9zdGRfd3N0cmluZwAFA2VudhZfZW1iaW5kX3JlZ2lzdGVyX2VtdmFsAAIDZW52HF9lbWJpbmRfcmVnaXN0ZXJfbWVtb3J5X3ZpZXcABQNlbnYVZW1zY3JpcHRlbl9tZW1jcHlfYmlnAAUD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GkH0GkESIABBABACQQgQpAQiAEEANgIEIABBEzYCAEGQGkGpCUEDQZwdQfwZQRQgAEEAEAILBQBB9BYLQAECfyAABEACQCAAKAIEIgFFDQAgASABKAIEIgJBAWs2AgQgAg0AIAEgASgCACgCCBEBACABEKMECyAAEKMBCwsHACAAEQ8ACxIBAX9BCBCkBCIAQgA3AgAgAAv/NAIOfwJ+QQgQpAQhDiMAQSBrIgwkAEGIBBCkBCIEQQA2AgQgBCAEQRBqIgc2AgwgBCAHNgIIIAdCADcCBCAHQcyCzbIENgIAIAdBgQY7ARggB0IANwIMIAdBADYCFCAHQRpqQQBBzwAQngEaIAdBADsBggEgB0IANwF6IAdCADcBciAHQgA3AWogB0IANwOIASAHQgA3A5ABIAdCADcDmAEgB0IANwOgASAHQgA3A6gBIAdCADcDsAEgB0L/////////9/8ANwPgASAHQv////////93NwPYASAHQv/////////3/wA3A9ABIAdC/////////3c3A8gBIAdC//////////f/ADcDwAEgB0L/////////dzcDuAEgBEGQAmpBAEGAARCeARogBEEANgKIAiAEQgA3A4ACIARCADcD+AEgBEIANwKUAyAEQQA6AJADIARBBDoAKSAEQgA3A8gDIARBADYC0AMgBEHkwQA2AqADIARCADcC3AMgBEEANgLkAyAEQYDCADYC2AMgBEIANwPwAyAEQQA2AugDIARCADcD+AMgBEIANwOABCAOIAQ2AgBBkAEQpAQhBCAMQgA3AxggDEIANwMQIARB9MkANgIAIARBBGoQvQMgBEIANwIYIARCADcCECAEQgA3AgggBEIANwMgIARB4Dw2AgAgBEIANwMoIAwgDCkDGDcDCCAMIAwpAxA3AwAgBCAMKQMANwMgIAQgDCkDCDcDKCAEIAE2AjAgBCABNgIYIAQgASACaiICNgIQIAQgATYCDCAEIAE2AgggBCACNgIcIAQgATYCFCAEQUBrIgFBzMoANgIAIARBuMoANgI4IARBADYCPCABQQA2AhQgASAENgIYIAFBADYCDCABQoKggIDgADcCBCABIARFNgIQIAFBIGpBAEEoEJ4BGiABQRxqEL0DIARCgICAgHA3A4gBIA4gBDYCBCAOKAIAIgggBEE4aiIBNgIAQQQQpAQgARAv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CwJAAn8gBSgCsAEiCiAFQaABakYEQCAFQaABaiEKIAUoAqABQRBqDAELIApFDQEgCigCAEEUagshASAKIAEoAgARAQALIAcQMBoLIAVB8AFqJAAMAQtBCBADIAVBIGpBoxUQchBzQcw9QSAQBAALCyAIKAIAIgEgASgCAEEMaygCAGpBABDjASAIKAIAIQEgCSAIKAIINQJgIhFCCHwgESAILQCQAxsiETcDSCAJIBE3AwggCUIANwNAIAlCADcDACABIAkQzQECQAJ/IAgoAgQoAgAiCygCCCIBIAsoAgQiA2siB0H//z9NBEBBgIDAACAHayIPIAsoAgwiAiABa00EQCABQQAgDxCeASAPagwCCyACIANrIgRBAXQiAkGAgMAAIAJBgIDAAEsbQf////8HIARB/////wNJGyIEEKQEIg0gB2pBACAPEJ4BGiANQYCAQGshAiABIANHBEAgDSADIAcQnAEaCyALIAQgDWo2AgwgCyACNgIIIAsgDTYCBCADRQ0CIAMQowEgCygCCCECDAILIAEhAiAHQYCAwABGDQEgA0GAgEBrCyECIAsgAjYCCAsgCyACIAsoAgRrNgIQQQELIQEgEARAIBAQowELIAlBoAFqJAAgAQwCCxAzAAtBCBADIAlB8ABqQfITEHIQc0HMPUEgEAQAC0UEQEEIEAMgDEEQakH/DRByEHNBzD1BIBAEAAsgDEEgaiQAQRAQpAQiASAONgIMIAFB4Bc2AgAgAUIANwIEIAAgDjYCACAAKAIEIQIgACABNgIEAkAgAkUNACACIAIoAgQiAEEBazYCBCAADQAgAiACKAIAKAIIEQEAIAIQowQLCzkBAX8gASAAKAIEIgRBAXVqIQEgACgCACEAIAEgAiADIARBAXEEfyABKAIAIABqKAIABSAACxEFAAsQACAAKAIAKAIAQRBqLwFqCzUBAX8gASAAKAIEIgJBAXVqIQEgACgCACEAIAEgAkEBcQR/IAEoAgAgAGooAgAFIAALEQAACxAAIAAoAgAoAgBBEGotAGgL+QQCBH8BfgJAIAAoAgAoAgAhAyMAQUBqIgAkAAJAAkAgAy0AkANFBEAgACADKAIEKAIANgIsIABBADYCKCAAQR82AiQgAEH8HTYCICAAIABBIGo2AjAgAygCCC8BaiEDIAAgATYCPCAAIAM2AjggACgCMCIB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NwAQIAAgAS0AGDoAGCAAIAEtABkiAjoAGQJAIAJBAUsNACAAQQA7AQYgAg0AIABBADsBBAsgACABKQAaNwAaIAAgASkAMjcAMiAAIAEpACo3ACogACABKQAiNwAiIAAgASkAOjcAOiAAIAEpAEI3AEIgACABKQBKNwBKIAAgASkAUjcAUiAAIAEvAFo7AVogACABLwBcOwFcIAAgAS8AXjsBXiAAIAEoAGA2AmAgACABKABkNgJkIAAgAS0AaDoAaCAAIAEvAGk7AWogACABKABrNgJsIAAgASkAbzcAcCAAIAEpAHc3AHggACABKAB/NgCAASAAIAEpAIMBNwOIASAAIAEpAIsBNwOQASAAIAEpAJMBNwOYASAAIAEpAJsBNwOgASAAIAEpAKMBNwOoASAAIAEpAKsBNwOwASAAIAEpALMBNwO4ASAAIAEpALsBNwPAASAAIAEpAMMBNwPIASAAIAEpAMsBNwPQASAAIAEpANMBNwPYASAAIAEpANsBNwPgASABEKMBC2EBAn9BFBCkBCICQgA3AgQgAiABNgIAIAJBADYCDEGAgMAAEKQEQQBBgIDAABCeASEBIAJBgIDAADYCECACIAFBgIBAayIDNgIMIAIgAzYCCCACIAE2AgQgACACNgIAIAALNAECfyAAKAIAIQEgAEEANgIAIAEEQCABKAIEIgIEQCABIAI2AgggAhCjAQsgARCjAQsgAAveAQEDfyACQQFGBEAgACgCECICIAAoAgggACgCBCIDa08EQCAAEDIaIAAoAgQhAyAAKAIQIQILIAAgAkEBajYCECABIAIgA2otAAA6AAAPCwJAIAIgACgCCCAAKAIQIgMgACgCBGoiBWsiBE0EQCAAIAIEfyABIAUgAhCdASAAKAIQBSADCyACajYCEAwBCwNAIAQgAiACIARLGyIDBEAgASAAKAIEIAAoAhBqIAMQnQELIAAgACgCECADajYCECACIARNDQEgASADaiEBIAIgA2shAiAAEDIhBAwACwALC6YCAQd/IwBBEGsiByQAIABBADYCECAAKAIAIAAoAgQiASAAKAIIIAFrEMoBAkAgACgCACgCBCIBBEACQCAAKAIIIgIgACgCBCIDayIEIAFJBEAgASAEayIGIAAoAgwiBSACa00EQCAAIAJBACAGEJ4BIAZqNgIIDAILIAFBAEgNAyAF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QQxqCyADNgIAIAdBADoAyAMMAQsgAigCBCEGIAMgBEoEQCACIAQ2AgQgAiAGNgIAIAIoAgwhBCADIAIoAhAiB0oEQCACIAM2AhAgAiAHNgIMIAIgBDYCCAwCCyADIARKBEAgAiADNgIMIAIgBDYCCAwCCyACIAM2AggMAQsgAyAGTAR/IAIFIAIgBjYCACACQQRqCyADNgIAIAdBAToAyAMLIAAgBUECdGoiBEG0BmooAgAhBSAAQdAhaiAAKAKMHyAAQfQhaigCACAAKAKAISAAKAKwIGoiAkEBdkH+////B3FBEiACQSRJGyAKckEsbGoQeiEDIAAgAEHoIWooAgAiAkEAQQAgAiACIAMgBWoiAksbayACQQBIGyACaiICNgIIIAQgAjYCtAYgASAAKAIANgAAIAEgACgCBDYABCABIAAoAgg2AAggASAALwEMOwAMIAEgAC0ADjoADiABIAAtAA86AA8gASAALQAQOgAQIAEgAC0AEToAESABIAAvARI7ABILIAlBEGokACABQRRqDwsQdAAL/A0CB38BfiMAQRBrIgckACAALQCoAUUEQCAAQawBahB5IABBAToAqAELAkACQCAALQAARQRAIABBAToAACAAKAKkASgCECEEIAcgATYCDCAHQQg2AgggBCgCECIERQ0CIAQgB0EMaiAHQQhqIAQoAgAoAhgRBQAgACABKQAANwJkDAELIAAoAqQBIQICQCAAQYQBaiIEIAAoAlxBAnRqKAIARQRAAkACQAJAIAIgAEEwahCGASICQQFrDgIAAQILIABBrAFqIAAoAqQBIAAoAtABEHohAiAEIAAoAlxBAnRqIAIgACgCxAEiA0EAQQAgAyACIANJG2sgAkEASBtqNgIAIAAgACgCXCICQQN0aiIDQeQAaiADKQJkIAQgAkECdCICajQCAHw3AgAgACACakEANgKUAQwDCyAAIAAoAmBBAWpBA3E2AmAgAEHkAGoiAiAAKAJcQQN0aigCBCEFIABBrAFqIAAoAqQBIAAoAtABQeACahB6IQYgAiAAKAJgQQN0aiAAKALEASIDQQBBACADIAMgBSAGaiIDSxtrIANBAEgbIANqrUIghjcCACAAKAKkARA8IQUgAiAAKAJgIgNBA3RqIgIgAikCACAFrYQ3AgAgACADNgJcIAQgA0ECdGpBADYCACAAIAAo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akEBdiIBNgJYIAAgATYCVCACQQ82AiBBACEDIAJBADoABCACQRA2AgAgAkEANgIQIAJCADcCJEGEARCiASIBQcQAakFAcSIEQQRrIAE2AgAgAiAENgIIQYQBEKIBIgFBxABqQUBxIgdBBGsgATYCACACQoCAgICAAjcCFCACIAc2AgwDQCAHIANBAnRqQQE2AgAgA0EBaiIDIAIoAgAiAUkNAAsgAiACKAIUIAIoAhhqIgQ2AhQCQAJAAkACQCAEQYGAAk8EQEEAIQMgAkEANgIUIAFFDQEDQCAHIANBAnRqIgEgASgCAEEBakEBdiIBNgIAIAIgAigCFCABaiIENgIUIANBAWoiAyACKAIAIgFJDQALC0GAgICAeCAEbiEKAkAgAigCJARAIAENAQwDCyABRQ0EQQAhAyACKAIIIQRBACEBA0AgBCADQQJ0IgVqIAEgCmxBEHY2AgAgBSAHaigCACABaiEBIANBAWoiAyACKAIASQ0ACwwECyACKAIQIQUgAigCCCELQQAhAQNAIAsgCEECdCIDaiAJIApsQRB2IgQ2AgAgAyAHaigCACEMIAEgBCACKAIodiIDSQRAIAhBAWshBiADIAFBf3NqIQ1BACEEIAMgAWtBB3EiDgRAA0AgBSABQQFqIgFBAnRqIAY2AgAgBEEBaiIEIA5HDQALCyANQQdPBEADQCABQQJ0IAVqIgQgBjYCHCAEIAY2AhggBCAGNgIUIAQgBjYCECAEIAY2AgwgBCAGNgIIIAQgBjYCBCAFIAFBCGoiAUECdGogBjYCACABIANHDQALCyADIQELIAkgDGohCSAIQQFqIgggAigCAEkNAAsgBUEANgIAIAEgAigCJEsNAwwCCyACKAIkRQ0CC0EAIQEgAigCECIFQQA2AgALA0AgBSABQQFqIgFBAnRqIAIoAgBBAWs2AgAgASACKAIkTQ0ACwsgAiACKAIAQQZqQQF2IgE2AhwgAiABNgIYIABBADYCcCAAQgA3A2ggAEHABRCkBCIBNgJoIAAgATYCbCAAIAFBwAVqIgM2AnAgASACEIMBIgFBLGogAhCDARogAUHYAGogAhCDARogAUGEAWogAhCDARogAUGwAWogAhCDARogAUHcAWogAhCDARogAUGIAmogAhCDARogAUG0AmogAhCDARogAUHgAmogAhCDARogAUGMA2og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hAYgAEEENgLwBSAAQoCAgID4/////wA3AtwFIABCIDcC1AUgAEKBgICAIDcCzAYgAEEANgK8BiAAQgA3ArQGIABCCDcCnAYgAEKggICAIDcClAYgAEEANgLEBSAAQYAgNgLIBiAAQQQ2AsQGIABBADYC3AYgAEIANwLUBiAAQQQ2AsAGIABCgICAgPj/////ADcCrAYgAEIgNwKkBiAAQoGAgIAgNwKcByAAQQA2AowHIABCADcChAcgAEIINwLsBiAAQqCAgIDgAjcC5AYgAEEANgKQBiAAQYAgNgKYByAAQQQ2ApQHIABBADYCrAcgAEIANwKkByAAQQQ2ApAHIABCgICAgPj/////ADcC/AYgAEIgNwL0BiAAQoGAgIAgNwLsByAAQQA2AtwHIABCADcC1AcgAEIINwK8ByAAQqCAgIDAAjcCtAcgAEEANgLgBiAAQYAgNgLoByAAQQQ2AuQHIABBADYC/AcgAEIANwL0ByAAQQQ2AuAHIABCgICAgPj/////ADcCzAcgAEIgNwLEByAAQbwIakKBgICAIDcCACAAQawIakEANgIAIABBpAhqQgA3AgAgAEGMCGpCCDcCACAAQYQIakKQgICAwAA3AgAgAEEANgKwByAAQbgIakGAIDYCACAAQbQIakEENgIAIABBzAhqQQA2AgAgAEHECGpCADcCACAAQbAIakEENgIAIABBnAhqQoCA/v///x83AgAgAEGUCGpCkICAgICAwAA3AgAgAEGMCWpCgYCAgCA3AgAgAEH8CGpBADYCACAAQfQIakIANwIAIABB3AhqQgg3AgAgAEHUCGpCkICAgCA3AgAgAEEANgKACCAAQYgJakGAIDYCACAAQYQJakEENgIAIABBnAlqQQA2AgAgAEGUCWpCADcCACAAQYAJakEENgIAIABB7AhqQoCA/v///x83AgAgAEHkCGpCkICAgICAwAA3AgAgAEHcCWpCgYCAgCA3AgAgAEHMCWpBADYCACAAQcQJakIANwIAIABBrAlqQgg3AgAgAEGkCWpCkICAgBA3AgAgAEEANgLQCCAAQdgJakGAIDYCACAAQdQJakEENgIAIABB7AlqQQA2AgAgAEHkCWpCADcCACAAQdAJakEENgIAIABBvAlqQoCA/v///x83AgAgAEG0CWpCkICAgICAwAA3AgAgAEGsCmpCgYCA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ADcDACAoQQE6AAAgK0IANwMAICpCADcDACApQQA2AgAgLEEBOgAAIC9CADcDACAuQgA3AwAgLUEANgIAIDBBAToAACAAQgA3A7ANIDJCADcDACAxQQA2AgAgM0EBOgAAIDRBADYCACA1QgA3AwAgNkIANwMAIDpCADcDACA3QQE6AAAgOUIANwMAIDhBADYCACA+QgA3AwAgO0EBOgAAID1CADcDACA8QQA2AgAgQkIANwMAID9BAToAACBBQgA3AwAgQEEANgIAIEZCADcDACBDQQE6AAAgRUIANwMAIERBADYCACBHQQE6AAAgSEEANgIAIElCADcDACBKQgA3AwAgS0EBOgAAIExBADYCACBNQgA3AwAgTkIANwMAIE9BAToAACBQQQA2AgAgUUIANwMAIFJCADcDACBTQQE6AAAgVEEANgIAIFVCADcDACBWQgA3AwAgV0EBOgAAIFhBADYCACBZQgA3AwAgWkIANwMAIFtBAToAACBcQQA2AgAgXUIANwMAIF5CADcDACBfQQE6AAAgAkEwaiQAIAALhxQBEX8jAEEQayIDJAAgA0EENgIIIAMgA0EEajYCDAJAAkACQCAAQZjBAGooAgAiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhByADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIQkgA0EENgIIIAMgA0EEajYCDCAAKAKYQSIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCEKIANBBDYCCCADIANBBGo2AgwgACgCmEEiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhCyADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIQwgA0EENgIIIAMgA0EEajYCDCAAKAKYQSIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCENIANBBDYCCCADIANBBGo2AgwgACgCmEEiAUUNACABIANBDGogA0EIaiABKAIAKAIYEQUAIAMoAgQhDiADQQQ2AgggAyADQQRqNgIMIAAoAphBIgFFDQAgASADQQxqIANBCGogASgCACgCGBEFACADKAIEIQ8gA0EENgIIIAMgA0EEajYCDCAAKAKYQSIBRQ0AIAEgA0EMaiADQQhqIAEoAgAoAhgRBQAgAygCBCEQIABB1MIAaiEIAkAgAEHYwgBqKAIAIgEgAEHcwgBqKAIAIgJHBEAgASAHNgIAIAAgAUEEaiIBNgLYQgwBCyABIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiESAHNgIAIAQgAUECdGohAiARQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASAJNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByAJNgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASAKNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByAKNgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASALNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByALNgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASAMNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByAMNgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASANNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByANNgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASAONgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByAONgIAIAQgAUECdGohAiAHQQRqIQEgBUEASgRAIAQgBiAFEJwBGgsgACACNgLcQiAAIAE2AthCIAAgBDYC1EIgBkUNACAGEKMBIAAoAtxCIQIgACgC2EIhAQsCQCABIAJHBEAgASAPNgIAIAAgAUEEaiIBNgLYQgwBCyACIAgoAgAiBmsiBUECdSICQQFqIgFBgICAgARPDQIgBUEBdSIEIAEgASAESRtB/////wMgBUH8////B0kbIgEEfyABQYCAgIAETw0EIAFBAnQQpAQFQQALIgQgAkECdGoiByAPNgIAIAQgAUECdGohAiAHQQRqIQEgBUEA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AEE0akGAAhB+GiAAQeAAakGAAhB+GgubLgEUfyMAQSBrIg4kAAJAAkACQCABKAIQIgRFBEAgDkEANgIYDAELAkAgASAERgRAIA4gDkEIaiIENgIYIAEgBCABKAIAKAIMEQIAIA4oAhghAQwBCyAOIAQgBCgCACgCCBEAACIBNgIYCyABDQELIABBADYCEAwBCwJAIA5BCGogAUYEQCAAIAA2AhAgDkEIaiAAIA4oAggoAgwRAgAMAQsgACABIAEoAgAoAggRAAA2AhALAn8gDigCGCIBIA5BCGpGBEAgDkEIaiEBIA4oAghBEGoMAQsgAUUNASABKAIAQRRqCyEEIAEgBCgCABEBAAsgAEKAgICAcDcDGCAAIAA2AiggAEEANgIkIABBADoAICAAQRhqIRYgAEEsaiIDQgA3AgAgA0IANwI0IANBADYCECADQgA3AgggA0IANwI8IANBADYCRCADQgA3AkwgA0EBOgBIIANCADcCVCADQQA2AlwgA0IANwJkIANBAToAYCADQgA3AmwgA0EANgJ0IANBAToAeCADQgA3AnwgA0IANwKEASADQQA2AowBIANCADcClAEgA0EBOgCQASADQgA3ApwBIANBADYCpAEgA0EBOgCoASADQgA3AqwBIANCADcCtAEgA0EANgK8ASADQQE6AMABIANCADcCxAEgA0IANwLMASADQQA2AtQBIANBAToA2AEgA0IANwLcASADQgA3AuQBIANBADYC7AEgA0EBOgDwASADQQA2AoQCIANCADcC/AEgA0IANwL0ASADQgA3AowCIANBAToAiAIgA0IANwKUAiADQQA2ApwCIANCADcCpAIgA0EBOgCgAiADQgA3AqwCIANBADYCtAIgA0IANwK8AiADQQE6ALgCIANCADcCxAIgA0EANgLMAiADQgA3AtQCIANBAToA0AIgA0IANwLcAiADQQA2AuQCIANBAToA6AIgA0EANgL8AiADQgA3AvQCIANCADcC7AIgA0EBOgCAAyADQQA2ApQDIANCADcCjAMgA0IANwKEAyADQQE6AJgDIANBADYCrAMgA0IANwKkAyADQgA3ApwDIANBAToAsAMgA0EANgLEAyADQgA3ArwDIANCADcCtAMgA0EBOgDIAyADQQA2AtwDIANCADcC1AMgA0IANwLMAyADQQE6AOADIANBADYC9AMgA0IANwLsAyADQgA3AuQDIANBAToA+AMgA0EANgKMBCADQgA3AoQEIANCADcC/AMgA0EBOgCQBCADQQA2AqQEIANCADcCnAQgA0IANwKUBCADQQE6AKgEIANBADYCvAQgA0IANwK0BCADQgA3AqwEIANBAToAwAQgA0EANgLUBCADQgA3AswEIANCADcCxAQgA0EBOgDYBCADQQA2AuwEIANCADcC5AQgA0IANwLcBCADQQE6APAEIANBADYChAUgA0IANwL8BCADQgA3AvQEIANBAToAiAUgA0EANgKcBSADQgA3ApQFIANCADcCjAUgA0EBOgCgBSADQQA2ArQFIANCADcCrAUgA0IANwKkBSADQQE6ALgFIANBADYCzAUgA0IANwLEBSADQgA3ArwFIANBAToA0AUgA0EANgLkBSADQgA3AtwFIANCADcC1AUgA0EBOgDoBSADQQA2AvwFIANCADcC9AUgA0IANwLsBSADQQE6AIAGIANBADYClAYgA0IANwKMBiADQgA3AoQGIANBAToAmAYgA0EANgKsBiADQgA3AqQGIANCADcCnAYgA0EBOgCwBiADQdQGakHAABB+GiADQgA3AhQgA0EAOgCIHyADQgA3AhwgA0IANwIkIANCADcCLCADQSwQpARBgAIQfjYCgAdBLBCkBEGAAhB+IQEgA0IANwK0BiADIAE2AoQHIANCADcCvAYgA0IANwLEBiADQgA3AswGIANBiBdqIQUgA0GID2ohBCADQYgHaiEBA0AgASALQQJ0IgdqQSwQpARBgAIQfjYCACAEIAdqQSwQpARBgAIQfjYCACAFIAdqQSwQpARBgAIQfjYCACALQQFqIgtBgAJHDQALIAMgFjYCjB8gA0KAgICAgAI3ApAfIANB0B9qQQI2AgAgA0G8H2pBADYCACADQbQfakIANwIAIANBoB9qQQA2AgAgA0GYH2pChICAgIABNwIAIANByB9qQoCggIAQNwIAIANB3B9qQQA2AgAgA0HUH2pCADcCACADQcAfakKEgICAwAA3AgAgA0GsH2pCgID+////HzcCACADQaQfakKQgICAgIDAADcCACADQYwgakEANgIAIANB5B9qQpCAgIAQNwIAIANB7B9qQgg3AgAgA0GEIGpCADcCACADQZwgakKBgICAIDcCACADQZggakGAIDYCACADQZAgakKEgICAwAA3AgAgA0GsIGpBADYCACADQaQgakIANwIAIANB9B9qQpCAgICAgMAANwIAIANB/B9qQoCA/v///x83AgAgA0EANgLgHyADQdwgakEANgIAIANBtCBqQqCAgIAgNwIAIANBvCBqQgg3AgAgA0HUIGpCADcCACADQewgakKBgICAIDcCACADQeggakGAIDYCACADQeAgakKEgICAwAA3AgAgA0H8IGpBADYCACADQfQgakIANwIAIANBzCBqQoCAgID4/////wA3AgAgA0HEIGpCIDcCACADQbwhakKBgICAIDcCACADQawhakKAgICAwAA3AgAgA0GkIWpCADcCACADQYwhakIINwIAIANBhCFqQqCAgIDgAjcCACADQQA2ArAgIANBxCFqQgA3AgAgA0G0IWpChICAgICABDcCACADQcwhakEANgIAIANBnCFqQoCAgID4/////wA3AgAgA0GUIWpCIDcCACADQYwiakKBgICAIDcCACADQfQhakIANwIAIANB3CFqQgg3AgAgA0HUIWpCoICAgMACNwIAIANB/CFqQQA2AgAgA0EANgKAISADQYgiakGAIDYCACADQYQiakEENgIAIANBnCJqQQA2AgAgA0GUImpCADcCACADQYAiakEENgIAIANB7CFqQoCAgID4/////wA3AgAgA0HkIWpCIDcCACADQQA6AKAiIANBADYC0CFBACELIABB0CJqIgVBADoAACAFQQRqQYQEEH4aIAVBBTYCUCAFQQA6ADQgBUEGNgIwIAVBQGtBADYCACAFQgA3AlRB3AAQogEiBEHEAGpBQHEiAUEEayAENgIAIAUgATYCOEHcABCiASIBQcQAakFAcSIEQQRrIAE2AgAgBUKAgICA4AA3AkQgBSAENgI8IAVBMGohAQNAIAQgC0ECdGpBATYCACALQQFqIgsgASgCAEkNAAsgARCCASAFIAUoAjBBBmpBAXYiATYCTCAFIAE2AkggBUHcAGpBAEHIABCeARogBUEAOgCoASAFIBY2AqQBIAVCgICAgIAENwKsASAFQQI2AuwBIAVBADYC2AEgBUIANwLQASAFQQA2ArwBIAVCiYCAgIABNwK0ASAFQoCggIAQNwLkASAFQQA2AvgBIAVCADcC8AEgBUKEgICAwAA3AtwBIAVCgICAgPj/////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IAEQPiEBIAAoAgQiAi0AyCcEQCACQRhqEHggACgCBEEAOgDIJwsgAQuFEgEKfyMAQSBrIgUkAAJAAkACQCABKAIQIgNFBEAgBUEANgIYDAELAkAgASADRgRAIAUgBUEIaiIDNgIYIAEgAyABKAIAKAIMEQIAIAUoAhghAQwBCyAFIAMgAygCACgCCBEAACIBNgIYCyABDQELIABBADYCEAwBCwJAIAVBCGogAUYEQCAAIAA2AhAgBUEIaiAAIAUoAggoAgwRAgAMAQsgACABIAEoAgAoAggRAAA2AhALAn8gBSgCGCIBIAVBCGpGBEAgBUEIaiEBIAUoAghBEGoMAQsgAUUNASABKAIAQRRqCyEDIAEgAygCABEBAAsgAEEYahBIIgFBoBBqEEghAyABQcAgahBIIQQgAUHgMGoQSCEGIAFBADYCACABQX82AoBBIANBATYCACAEQQI2AgAgBkEDNgIAAkAgACgCECIDRQRAIAFBmMEAakEANgIADAELIAAgA0YEQCABQZjBAGogAUGIwQBqIgM2AgAgACgCECIEIAMgBCgCACgCDBECAAwBCyABQZjBAGogAyADKAIAKAIIEQAANgIAC0EQEKQEIgNCADcCACADQgA3AgggAUGwwQBqIAM2AgAgAUGswQBqIAM2AgAgAUGowQBqQQA6AAAgAUKAgICAcDcDoEFBEBCkBCIDQgA3AgAgA0IANwIIIAFBxMEAaiADNgIAIAFBwMEAaiADNgIAIAFBvMEAakEAOgAAIAFCgICAgHA3ArRBQRAQpAQiA0IANwIAIANCADcCCCABQdjBAGogAzYCACABQdTBAGogAzYCACABQdDBAGpBADoAACABQoCAgIBwNwPIQUEQEKQEIgNCADcCACADQgA3AgggAUHswQBqIAM2AgAgAUHowQBqIAM2AgAgAUHkwQBqQQA6AAAgAUKAgICAcDcC3EFBEBCkBCIDQgA3AgAgA0IANwIIIAFBgMIAaiADNgIAIAFB/MEAaiADNgIAIAFB+MEAakEAOgAAIAFCgICAgHA3A/BBQRAQpAQiA0IANwIAIANCADcCCCABQZTCAGogAzYCACABQZDCAGogAzYCACABQYzCAGpBADoAACABQoCAgIBwNwKEQkEQEKQEIgNCADcCACADQgA3AgggAUGowgBqIAM2AgAgAUGkwgBqIAM2AgAgAUGgwgBqQQA6AAAgAUKAgICAcDcDmEJBEBCkBCIDQgA3AgAgA0IANwIIIAFBvMIAaiADNgIAIAFBuMIAaiADNgIAIAFBtMIAakEAOgAAIAFCgICAgHA3AqxCQRAQpAQiA0IANwIAIANCADcCCCABQdDCAGogAzYCACABQczCAGogAzYCACABQcjCAGpBADoAACABQoCAgIBwNwPAQiABQdTCAGpBAEHsABCeARogAEHYwwBqIgFCADcCACABQQA7AQggAUEMakGAARB+GiABQThqQYACEH4aIAFB5ABqQYACEH4aIAFBkAFqQYACEH4aIAFBvAFqQYACEH4aIAFB6AFqQYACEH4aIAFBlAJqQYACEH4aIAFBADsByAIgAUIANwLAAiABQcwCakGAARB+GiABQfgCakGAAhB+GiABQaQDakGAAhB+GiABQdADakGAAhB+GiABQfwDakGAAhB+GiABQagEakGAAhB+GiABQdQEakGAAhB+GiABQQA7AYgFIAFCADcCgAUgAUGMBWpBgAEQfhogAUG4BWpBgAIQfhogAUHkBWpBgAIQfhogAUGQBmpBgAIQfhogAUG8BmpBgAIQfhogAUHoBmpBgAIQfhogAUGUB2pBgAIQfhogAUEAOwHIByABQgA3AsAHIAFBzAdqQYABEH4aIAFB+AdqQYACEH4aIAFBpAhqQYACEH4aIAFB0AhqQYACEH4aIAFB/AhqQYACEH4aIAFBqAlqQYACEH4aIAFB1AlqQYACEH4aIABB3M0AaiAANgIAIABB2M0AakF/NgIAQRAQpAQiAUIANwIAIAFCADcCCCAAQfTNAGogATYCACAAQfDNAGogATYCACAAQfjNAGpCADcDACAAQezNAGpBADoAACAAQeTNAGpCgICAgHA3AgAgAEGAzgBqEFEgAEGMzwBqEFEgAEGY0ABqEFEgAEGk0QBqEFEgAEG00gBqIAA2AgAgAEGw0gBqQX82AgBBEBCkBCIBQgA3AgAgAUIANwIIIABBzNIAaiABNgIAIABByNIAaiABNgIAIABB0NIAakIANwMAIABBxNIAakEAOgAAIABBvNIAakKAgICAcDcCACMAQSBrIgMkACAAQdjSAGoiAUF/NgIEIAEgAjYCACABQQhqIAIQQSABQSRqIAEoAgAQQSABQUBrIAEoAgAQQSABQdwAaiABKAIAEEEgASAANgKEASABQQA2AoABIAFCADcCeCABQQA2ApABIAFCADcCiAECQAJAIAEoAgAiAgRAIAJBgICAgARPDQEgASACQQJ0IgQQpAQiBjYCiAEgASAEIAZqIgc2ApABIAZBACAEEJ4BGiABIAc2AowBC0EQEKQEIgRCADcCACAEQgA3AgggAyAENgIYIAMgBDYCFCADQQA6ABAgA0KAgICAcDcDCCABQQA2ApwBIAFCADcClAECQAJAAkAgAgRAIAJBzZmz5gBPDQEgASACQRRsIgQQpAQiAjYClAEgASACNgKYASABIAIgBGoiCTYCnAEgAygCDCEKIAMoAgghCyADKAIUIQYDQEEQEKQEIgRBADYCCCAEQgA3AgAgBigCBCIHIAYoAgAiCEcEQCAHIAhrIghBAEgNBCAEIAgQpAQiBzYCACAEIAc2AgQgBCAHIAhqNgIIIAQgBigCBCAGKAIAIgxrIghBAEoEfyAHIAwgCBCcASAIagUgBws2AgQLIAQgBigCDDYCDCACIAQ2AhAgAiAENgIMIAIgCjYCBCACIAs2AgAgAkEUaiICIAlHDQALIAEgCTYCmAELDAILEDMACxAzAAsgAygCFCECIANBADYCFCACBEAgAigCACIEBEAgAiAENgIEIAQQowELIAIQowELIAFCADcCoAEgA0EgaiQADAELEDMACyAAQQE6AIRUIABBADYCgFQgBUEgaiQAIAAL0g8BBn8gAEGMJzYCACAAKAIEIQYgAEEANgIEIAYEQCAGQdjSAGoiAygClAEiAgRAIAMoApgBIgQgAiIBRwRAA0AgBEEUayIEKAIMIQEgBEEANgIMIAEEQCABKAIAIgUEQCABIAU2AgQgBRCjAQsgARCjAQsgAiAERw0ACyADKAKUASEBCyADIAI2ApgBIAEQowELIAMoAogBIgEEQCADIAE2AowBIAEQowELIAMoAngiAgRAIAMoAnwiBCACIgFHBEADQCAEQRRrIgQoAgwhASAEQQA2AgwgAQRAIAEoAgAiBQRAIAEgBTYCBCAFEKMBCyABEKMBCyACIARHDQALIAMoAnghAQsgAyACNgJ8IAEQowELIANBCGoiBCgCZCIDBEAgBCgCaCIBIAMiAkcEQANAIAFBLGsiAigCCCIFBEAgBUEEaygCABCjAQsgAUEgaygCACIFBEAgBUEEaygCABCjAQsgAUEcaygCACIBBEAgAUEEaygCABCjAQsgAiIBIANHDQALIAQoAmQhAgsgBCADNgJoIAIQowELIAQoAlgiAQRAIAQgATYCXCABEKMBCyAEKAJIIgMEQCAEKAJMIgEgAyICRwRAA0AgAUEsayICKAIIIgUEQCAFQQRrKAIAEKMBCyABQSBrKAIAIgUEQCAFQQRrKAIAEKMBCyABQRxrKAIAIgEEQCABQQRrKAIAEKMBCyACIgEgA0cNAAsgBCgCSCECCyAEIAM2AkwgAhCjAQsgBCgCPCIBBEAgBEFAayABNgIAIAEQowELIAQoAiwiAwRAIAQoAjAiASADIgJHBEADQCABQSxrIgIoAggiBQRAIAVBBGsoAgAQowELIAFBIGsoAgAiBQRAIAVBBGsoAgAQowELIAFBHGsoAgAiAQRAIAFBBGsoAgAQowELIAIiASADRw0ACyAEKAIsIQILIAQgAzYCMCACEKMBCyAEKAIgIgEEQCAEIAE2AiQgARCjAQsgBCgCECIDBEAgBCgCFCIBIAMiAkcEQANAIAFBLGsiAigCCCIFBEAgBUEEaygCABCjAQsgAUEgaygCACIFBEAgBUEEaygCABCjAQsgAUEcaygCACIBBEAgAUEEaygCABCjAQsgAiIBIANHDQALIAQoAhAhAgsgBCADNgIUIAIQowELIAQoAgQiAQRAIAQgATYCCCABEKMBCyAGQcjSAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIAZBpNEAahBjIAZBmNAAahBjIAZBjM8AahBjIAZBgM4AahBjIAZB8M0AaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgBkHYwwBqIgFB+AdqEGUgASgC1AciAgRAIAJBBGsoAgAQowELIAEoAtgHIgIEQCACQQRrKAIAEKMBCyABKALcByICBEAgAkEEaygCABCjAQsgAUG4BWoQZSABKAKUBSICBEAgAkEEaygCABCjAQsgASgCmAUiAgRAIAJBBGsoAgAQowELIAEoApwFIgIEQCACQQRrKAIAEKMBCyABQfgCahBlIAEoAtQCIgIEQCACQQRrKAIAEKMBCyABKALYAiICBEAgAkEEaygCABCjAQsgASgC3AIiAgRAIAJBBGsoAgAQowELIAFBOGoQZSABKAIUIgIEQCACQQRrKAIAEKMBCyABKAIYIgIEQCACQQRrKAIAEKMBCyABKAIcIgEEQCABQQRrKAIAEKMBCyAGQRhqIgMoAtRCIgEEQCADQdjCAGogATYCACABEKMBCyADQczCAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIANBuMIAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0GkwgBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyADQZDCAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIANB/MEAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0HowQBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCyADQdTBAGoiAigCACEBIAJBADYCACABBEAgASgCACICBEAgASACNgIEIAIQowELIAEQowELIANBwMEAaiICKAIAIQEgAkEANgIAIAEEQCABKAIAIgIEQCABIAI2AgQgAhCjAQsgARCjAQsgA0GswQBqIgIoAgAhASACQQA2AgAgAQRAIAEoAgAiAgRAIAEgAjYCBCACEKMBCyABEKMBCwJAAn8gA0GYwQBqKAIAIgIgA0GIwQBqIgFGBEAgASgCAEEQagwBCyACRQ0BIAIiASgCAEEUagshAiABIAIoAgARAQALIANB4DBqEGQgA0HAIGoQZCADQaAQahBkIAMQZAJAAn8gBiAGKAIQIgFGBEAgBiIBKAIAQRBqDAELIAFFDQEgASgCAEEUagshAiABIAIoAgARAQALIAYQowELIAALDAAgABBbGiAAEKMBC/gBAQN/IwBBEGsiAiQAIAJBADYCACAAKAIEQRhqIAEgAhBLIQEgACgCBEHY0gBqKAIABEAgACgCBEHY0gBqIAEgAhBFIQELAkAgACgCBCIDLQCEVARAIAJBBDYCCCACIAJBBGo2AgwgAygCECIERQ0BIAQgAkEMaiACQQhqIAQoAgAo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IAIoAhAiAkUNACACIAFBDGogAUEIaiACKAIAKAIYEQUAIAEtAAchAyAAKAIQIQIgAUEBNgIIIAEgAUEHajYCDCACKAIQIgJFDQAgAiABQQxqIAFBCGogAigCACgCGBEFACABLQAHIQQgACgCECECIAFBATYCCCABIAFBB2o2AgwgAigCECICRQ0AIAIgAUEMaiABQQhqIAIoAgAoAhgRBQAgAS0AByEFIAAoAhAhAiABQQE2AgggASABQQdqNgIMIAIoAhAiAkUNACACIAFBDGogAUEIaiACKAIAKAIYEQUAIAAgAS0AByAEQRB0IANBGHRyIAVBCHRycjYCACABQRBqJAAPCxB0AAvfBAEGfyMAQTBrIgIkAAJAIAAoAiQgACgCKEcNACAAKAIIBEAgAEEkaiEGIAJBCGohBANAIAIgACgCFEEBahB+IQUCQCAAKAIoIgEgACgCLEkEQCABIAUoAgA2AgAgASACLQAEOgAEIAEgAigCCDYCCCABIAIoAgw2AgwgASACKAIQNgIQIAEgAigCFDYCFCABIAIoAhg2AhggASACKAIcNgIcIAEgAigCIDYCICABIAIoAiQ2AiQgASACKAIoNgIoIARBADYCCCAEQgA3AgAgACABQSxqNgIoDAELIAYgBRB/IAIoAggiAUUNACABQQRrKAIAEKMBCyACKAIMIgEEQCABQQRrKAIAEKMBCyACKAIQIgEEQCABQQRrKAIAEKMBCyADQQFqIgMgACgCCEkNAAsLIAAoAhRFDQAgAEHEAGohBiACQQhqIQRBASEDA0AgAkEBIAMgACgCDCIBIAEgA0sbdBB+IQUCQCAAKAJIIgEgACgCTEkEQCABIAUoAgA2AgAgASACLQAEOgAEIAEgAigCCDYCCCABIAIoAgw2AgwgASACKAIQNgIQIAEgAigCFDYCFCABIAIoAhg2AhggASACKAIcNgIcIAEgAigCIDYCICABIAIoAiQ2AiQgASACKAIoNgIoIARBADYCCCAEQgA3AgAgACABQSxqNgJIDAELIAYgBRB/IAIoAggiAUUNACABQQRrKAIAEKMBCyACKAIMIgEEQCABQQRrKAIAEKMBCyACKAIQIgEEQCABQQRrKAIAEKMBCyADQQFqIgMgACgCFE0NAAsLIAJBMGokAAusBAEEfyAAIAEgAhCGASICNgIAIAIEQCAC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IgJqIgMgASACai0AADoAACADQQNxDQALCyACQQNNDQADQCAAIAJBBGsiAmogASACaigCADYCACACQQNLDQALCyACRQ0CA0AgACACQQFrIgJqIAEgAmotAAA6AAAgAg0ACwwCCyACQQNNDQADQCAAIAEoAgA2AgAgAUEEaiEBIABBBGohACACQQRrIgJBA0sNAAsLIAJFDQADQCAAIAEtAAA6AAAgAEEBaiEAIAFBAWohASACQQFrIgINAAsLC/ICAgJ/AX4CQCACRQ0AIAAgAToAACAAIAJqIgNBAWsgAToAACACQQNJDQAgACABOgACIAAgAToAASADQQNrIAE6AAAgA0ECayABOgAAIAJBB0kNACAAIAE6AAMgA0EEayABOgAAIAJBCUkNACAAQQAgAGtBA3EiBGoiAyABQf8BcUGBgoQIbCIBNgIAIAMgAiAEa0F8cSIEaiICQQRrIAE2AgAgBEEJSQ0AIAMgATYCCCADIAE2AgQgAkEIayABNgIAIAJBDGsgATYCACAEQRlJDQAgAyABNgIYIAMgATYCFCADIAE2AhAgAyABNgIMIAJBEGsgATYCACACQRRrIAE2AgAgAkEYayABNgIAIAJBHGsgATYCACAEIANBBHFBGHIiBGsiAkEgSQ0AIAGtQoGAgIAQfiEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkEgayICQR9LDQALCyAAC4EBAQJ/AkACQCACQQRPBEAgACABckEDcQ0BA0AgACgCACABKAIARw0CIAFBBGohASAAQQRqIQAgAkEEayICQQNLDQALCyACRQ0BCwNAIAAtAAAiAyABLQAAIgRGBEAgAUEBaiEBIABBAWohACACQQFrIgINAQwCCwsgAyAEaw8LQQALaQEDfwJAIAAiAUEDcQRAA0AgAS0AAEUNAiABQQFqIgFBA3ENAAsLA0AgASICQQRqIQEgAigCACIDQX9zIANBgYKECGtxQYCBgoR4cUUNAAsDQCACIgFBAWohAiABLQAADQALCyABIABrCwYAQeSyAQv+LQELfyMAQRBrIgskAAJAAkACQAJAAkACQAJAAkACQAJAAkAgAEH0AU0EQEHosgEoAgAiBUEQIABBC2pBeHEgAEELSRsiBkEDdiIAdiIBQQNxBEACQCABQX9zQQFxIABqIgJBA3QiAUGQswFqIgAgAUGYswFqKAIAIgEoAggiA0YEQEHosgEgBUF+IAJ3cTYCAAwBCyADIAA2AgwgACADNgIICyABQQhqIQAgASACQQN0IgJBA3I2AgQgASACaiIBIAEoAgRBAXI2AgQMDAsgBkHwsgEoAgAiB00NASABBEACQEECIAB0IgJBACACa3IgASAAdHEiAEEAIABrcUEBayIAIABBDHZBEHEiAHYiAUEFdkEIcSICIAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqIgFBA3QiAEGQswFqIgIgAEGYswFqKAIAIgAoAggiA0YEQEHosgEgBUF+IAF3cSIFNgIADAELIAMgAjYCDCACIAM2AggLIAAgBkEDcjYCBCAAIAZqIgggAUEDdCIBIAZrIgNBAXI2AgQgACABaiADNgIAIAcEQCAHQXhxQZCzAWohAUH8sgEoAgAhAgJ/IAVBASAHQQN2dCIEcUUEQEHosgEgBCAFcjYCACABDAELIAEoAggLIQQgASACNgIIIAQgAjYCDCACIAE2AgwgAiAENgIICyAAQQhqIQBB/LIBIAg2AgBB8LIBIAM2AgAMDAtB7LIBKAIAIgpFDQEgCkEAIAprcUEBayIAIABBDHZBEHEiAHYiAUEFdkEIcSICIAByIAEgAnYiAEECdkEEcSIBciAAIAF2IgBBAXZBAnEiAXIgACABdiIAQQF2QQFxIgFyIAAgAXZqQQJ0QZi1AWooAgAiAigCBEF4cSAGayEEIAIhAQNAAkAgASgCECIARQRAIAEoAhQiAEUNAQsgACgCBEF4cSAGayIBIAQgASAESSIBGyEEIAAgAiABGyECIAAhAQwBCwsgAigCGCEJIAIgAigCDCIDRwRAIAIoAggiAEH4sgEoAgBJGiAAIAM2AgwgAyAANgIIDAsLIAJBFGoiASgCACIARQRAIAIoAhAiAEUNAyACQRBqIQELA0AgASEIIAAiA0EUaiIBKAIAIgANACADQRBqIQEgAygCECIADQALIAhBADYCAAwKC0F/IQYgAEG/f0sNACAAQQtqIgBBeHEhBkHssgEoAgAiCEUNAEEAIAZrIQQCQAJAAkACf0EAIAZBgAJJDQAaQR8gBkH///8HSw0AGiAAQQh2IgAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRxIgF0IgIgAkGAgA9qQRB2QQJxIgJ0QQ92IAAgAXIgAnJrIgBBAXQgBiAAQRVqdkEBcXJBHGoLIgdBAnRBmLUBaigCACIBRQRAQQAhAAwBC0EAIQAgBkEAQRkgB0EBdmsgB0EfRht0IQIDQAJAIAEoAgRBeHEgBmsiBSAETw0AIAEhAyAFIgQNAEEAIQQgASEADAMLIAAgASgCFCIFIAUgASACQR12QQRxaigCECIBRhsgACAFGyEAIAJBAXQhAiABDQALCyAAIANyRQRAQQAhA0ECIAd0IgBBACAAa3IgCHEiAEUNAyAAQQAgAGtxQQFrIgAgAEEMdkEQcSIAdiIBQQV2QQhxIgIgAHIgASACdiIAQQJ2QQRxIgFyIAAgAXYiAEEBdkECcSIBciAAIAF2IgBBAXZBAXEiAXIgACABdmpBAnRBmLUBaigCACEACyAARQ0BCwNAIAAoAgRBeHEgBmsiAiAESSEBIAIgBCABGyEEIAAgAyABGyEDIAAoAhAiAQR/IAEFIAAoAhQLIgANAAsLIANFDQAgBEHwsgEoAgAgBmtPDQAgAygCGCEHIAMgAygCDCICRwRAIAMoAggiAEH4sgEoAgBJGiAAIAI2AgwgAiAANgIIDAkLIANBFGoiASgCACIARQRAIAMoAhAiAEUNAyADQRBqIQELA0AgASEFIAAiAkEUaiIBKAIAIgANACACQRBqIQEgAigCECIADQALIAVBADYCAAwICyAGQfCyASgCACIBTQRAQfyyASgCACEAAkAgASAGayICQRBPBEBB8LIBIAI2AgBB/LIBIAAgBmoiAzYCACADIAJBAXI2AgQgACABaiACNgIAIAAgBkEDcjYCBAwBC0H8sgFBADYCAEHwsgFBADYCACAAIAFBA3I2AgQgACABaiIBIAEoAgRBAXI2AgQLIABBCGohAAwKCyAGQfSyASgCACICSQRAQfSyASACIAZrIgE2AgBBgLMBQYCzASgCACIAIAZqIgI2AgAgAiABQQFyNgIEIAAgBkEDcjYCBCAAQQhqIQAMCgtBACEAIAZBL2oiBAJ/QcC2ASgCAARAQci2ASgCAAwBC0HMtgFCfzcCAEHEtgFCgKCAgICABDcCAEHAtgEgC0EMakFwcUHYqtWqBXM2AgBB1LYBQQA2AgBBpLYBQQA2AgBBgCALIgFqIgVBACABayIIcSIBIAZNDQlBoLYBKAIAIgMEQEGYtgEoAgAiByABaiIJIAdNDQogAyAJSQ0KC0GktgEtAABBBHENBAJAAkBBgLMBKAIAIgMEQEGotgEhAANAIAMgACgCACIHTwRAIAcgACgCBGogA0sNAwsgACgCCCIADQALC0EAEKYBIgJBf0YNBSABIQVBxLYBKAIAIgBBAWsiAyACcQRAIAEgAmsgAiADakEAIABrcWohBQsgBSAGTQ0FIAVB/v///wdLDQVBoLYBKAIAIgAEQEGYtgEoAgAiAyAFaiIIIANNDQYgACAISQ0GCyAFEKYBIgAgAkcNAQwHCyAFIAJrIAhxIgVB/v///wdLDQQgBRCmASICIAAoAgAgACgCBGpGDQMgAiEACwJAIABBf0YNACAGQTBqIAVNDQBByLYBKAIAIgIgBCAFa2pBACACa3EiAkH+////B0sEQCAAIQIMBwsgAhCmAUF/RwRAIAIgBWohBSAAIQIMBwtBACAFaxCmARoMBAsgACICQX9HDQUMAwtBACEDDAcLQQAhAgwFCyACQX9HDQILQaS2AUGktgEoAgBBBHI2AgALIAFB/v///wdLDQEgARCmASECQQAQpgEhACACQX9GDQEgAEF/Rg0BIAAgAk0NASAAIAJrIgUgBkEoak0NAQtBmLYBQZi2ASgCACAFaiIANgIAQZy2ASgCACAASQRAQZy2ASAANgIACwJAAkACQEGAswEoAgAiBARAQai2ASEAA0AgAiAAKAIAIgEgACgCBCIDakYNAiAAKAIIIgANAAsMAgtB+LIBKAIAIgBBACAAIAJNG0UEQEH4sgEgAjYCAAtBACEAQay2ASAFNgIAQai2ASACNgIAQYizAUF/NgIAQYyzAUHAtgEoAgA2AgBBtLYBQQA2AgADQCAAQQN0IgFBmLMBaiABQZCzAWoiAzYCACABQZyzAWogAzYCACAAQQFqIgBBIEcNAAtB9LIBIAVBKGsiAEF4IAJrQQdxQQAgAkEIakEHcRsiAWsiAzYCAEGAswEgASACaiIBNgIAIAEgA0EBcjYCBCAAIAJqQSg2AgRBhLMBQdC2ASgCADYCAAwCCyAALQAMQQhxDQAgASAESw0AIAIgBE0NACAAIAMgBWo2AgRBgLMBIARBeCAEa0EHcUEAIARBCGpBB3EbIgBqIgE2AgBB9LIBQfSyASgCACAFaiICIABrIgA2AgAgASAAQQFyNgIEIAIgBGpBKDYCBEGEswFB0LYBKAIANgIADAELQfiyASgCACACSwRAQfiyASACNgIACyACIAVqIQFBqLYBIQACQAJAAkACQAJAAkADQCABIAAoAgBHBEAgACgCCCIADQEMAgsLIAAtAAxBCHFFDQELQai2ASEAA0AgBCAAKAIAIgFPBEAgASAAKAIEaiIDIARLDQMLIAAoAgghAAwACwALIAAgAjYCACAAIAAoAgQgBWo2AgQgAkF4IAJrQQdxQQAgAkEIakEHcRtqIgcgBkEDcjYCBCABQXggAWtBB3FBACABQQhqQQdxG2oiBSAGIAdqIgZrIQAgBCAFRgRAQYCzASAGNgIAQfSyAUH0sgEoAgAgAGoiADYCACAGIABBAXI2AgQMAwtB/LIBKAIAIAVGBEBB/LIBIAY2AgBB8LIBQfCyASgCACAAaiIANgIAIAYgAEEBcjYCBCAAIAZqIAA2AgAMAwsgBSgCBCIEQQNxQQFGBEAgBEF4cSEJAkAgBEH/AU0EQCAFKAIIIgEgBEEDdiIDQQN0QZCzAWpGGiABIAUoAgwiAkYEQEHosgFB6LIBKAIAQX4gA3dxNgIADAILIAEgAjYCDCACIAE2AggMAQsgBSgCGCEIAkAgBSAFKAIMIgJHBEAgBSgCCCIBIAI2AgwgAiABNgIIDAELAkAgBUEUaiIEKAIAIgENACAFQRBqIgQoAgAiAQ0AQQAhAgwBCwNAIAQhAyABIgJBFGoiBCgCACIBDQAgAkEQaiEEIAIoAhAiAQ0ACyADQQA2AgALIAhFDQACQCAFKAIcIgFBAnRBmLUBaiIDKAIAIAVGBEAgAyACNgIAIAINAUHssgFB7LIBKAIAQX4gAXdxNgIADAILIAhBEEEUIAgoAhAgBUYbaiACNgIAIAJFDQELIAIgCDYCGCAFKAIQIgEEQCACIAE2AhAgASACNgIYCyAFKAIUIgFFDQAgAiABNgIUIAEgAjYCGAsgBSAJaiIFKAIEIQQgACAJaiEACyAFIARBfnE2AgQgBiAAQQFyNgIEIAAgBmogADYCACAAQf8BTQRAIABBeHFBkLMBaiEBAn9B6LIBKAIAIgJBASAAQQN2dCIAcUUEQEHosgEgACACcjYCACABDAELIAEoAggLIQAgASAGNgIIIAAgBjYCDCAGIAE2AgwgBiAANgIIDAMLQR8hBCAAQf///wdNBEAgAEEIdiIBIAFBgP4/akEQdkEIcSIBdCICIAJBgOAfakEQdkEEcSICdCIDIANBgIAPakEQdkECcSIDdEEPdiABIAJyIANyayIBQQF0IAAgAUEVanZBAXFyQRxqIQQLIAYgBDYCHCAGQgA3AhAgBEECdEGYtQFqIQECQEHssgEoAgAiAkEBIAR0IgNxRQRAQeyyASACIANyNgIAIAEgBjYCAAwBCyAAQQBBGSAEQQF2ayAEQR9GG3QhBCABKAIAIQIDQCACIgEoAgRBeHEgAEYNAyAEQR12IQIgBEEBdCEEIAEgAkEEcWoiAygCECICDQALIAMgBjYCEAsgBiABNgIYIAYgBjYCDCAGIAY2AggMAgtB9LIBIAVBKGsiAEF4IAJrQQdxQQAgAkEIakEHcRsiAWsiCDYCAEGAswEgASACaiIBNgIAIAEgCEEBcjYCBCAAIAJqQSg2AgRBhLMBQdC2ASgCADYCACAEIANBJyADa0EHcUEAIANBJ2tBB3EbakEvayIAIAAgBEEQakkbIgFBGzYCBCABQbC2ASkCADcCECABQai2ASkCADcCCEGwtgEgAUEIajYCAEGstgEgBTYCAEGotgEgAjYCAEG0tgFBADYCACABQRhqIQADQCAAQQc2AgQgAEEIaiECIABBBGohACACIANJDQALIAEgBEYNAyABIAEoAgRBfnE2AgQgBCABIARrIgJBAXI2AgQgASACNgIAIAJB/wFNBEAgAkF4cUGQswFqIQACf0HosgEoAgAiAUEBIAJBA3Z0IgJxRQRAQeiyASABIAJyNgIAIAAMAQsgACgCCAshASAAIAQ2AgggASAENgIMIAQgADYCDCAEIAE2AggMBAtBHyEAIAJB////B00EQCACQQh2IgAgAEGA/j9qQRB2QQhxIgB0IgEgAUGA4B9qQRB2QQRxIgF0IgMgA0GAgA9qQRB2QQJxIgN0QQ92IAAgAXIgA3JrIgBBAXQgAiAAQRVqdkEBcXJBHGohAAsgBCAANgIcIARCADcCECAAQQJ0QZi1AWohAQJAQeyyASgCACIDQQEgAHQiBXFFBEBB7LIBIAMgBXI2AgAgASAENgIADAELIAJBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhAwNAIAMiASgCBEF4cSACRg0EIABBHXYhAyAAQQF0IQAgASADQQRxaiIFKAIQIgMNAAsgBSAENgIQCyAEIAE2AhggBCAENgIMIAQgBDYCCAwDCyABKAIIIgAgBjYCDCABIAY2AgggBkEANgIYIAYgATYCDCAGIAA2AggLIAdBCGohAAwFCyABKAIIIgAgBDYCDCABIAQ2AgggBEEANgIYIAQgATYCDCAEIAA2AggLQfSyASgCACIAIAZNDQBB9LIBIAAgBmsiATYCAEGAswFBgLMBKAIAIgAgBmoiAjYCACACIAFBAXI2AgQgACAGQQNyNgIEIABBCGohAAwDC0HksgFBMDYCAEEAIQAMAgsCQCAHRQ0AAkAgAygCHCIAQQJ0QZi1AWoiASgCACADRgRAIAEgAjYCACACDQFB7LIBIAhBfiAAd3EiCDYCAAwCCyAHQRBBFCAHKAIQIANGG2ogAjYCACACRQ0BCyACIAc2AhggAygCECIABEAgAiAANgIQIAAgAjYCGAsgAygCFCIARQ0AIAIgADYCFCAAIAI2AhgLAkAgBEEPTQRAIAMgBCAGaiIAQQNyNgIEIAAgA2oiACAAKAIEQQFyNgIEDAELIAMgBkEDcjYCBCADIAZqIgIgBEEBcjYCBCACIARqIAQ2AgAgBEH/AU0EQCAEQXhxQZCzAWohAAJ/QeiyASgCACIBQQEgBEEDdnQiBHFFBEBB6LIBIAEgBHI2AgAgAAwBCyAAKAIICyEBIAAgAjYCCCABIAI2AgwgAiAANgIMIAIgATYCCAwBC0EfIQAgBEH///8HTQRAIARBCHYiACAAQYD+P2pBEHZBCHEiAHQiASABQYDgH2pBEHZBBHEiAXQiBSAFQYCAD2pBEHZBAnEiBXRBD3YgACABciAFcmsiAEEBdCAEIABBFWp2QQFxckEcaiEACyACIAA2AhwgAkIANwIQIABBAnRBmLUBaiEBAkACQCAIQQEgAHQiBXFFBEBB7LIBIAUgCHI2AgAgASACNgIADAELIARBAEEZIABBAXZrIABBH0YbdCEAIAEoAgAhBgNAIAYiASgCBEF4cSAERg0CIABBHXYhBSAAQQF0IQAgASAFQQRxaiIFKAIQIgYNAAsgBSACNgIQCyACIAE2AhggAiACNgIMIAIgAjYCCAwBCyABKAIIIgAgAjYCDCABIAI2AgggAkEANgIYIAIgATYCDCACIAA2AggLIANBCGohAAwBCwJAIAlFDQACQCACKAIcIgBBAnRBmLUBaiIBKAIAIAJGBEAgASADNgIAIAMNAUHssgEgCkF+IAB3cTYCAAwCCyAJQRBBFCAJKAIQIAJGG2ogAzYCACADRQ0BCyADIAk2AhggAigCECIABEAgAyAANgIQIAAgAzYCGAsgAigCFCIARQ0AIAMgADYCFCAAIAM2AhgLAkAgBEEPTQRAIAIgBCAGaiIAQQNyNgIEIAAgAmoiACAAKAIEQQFyNgIEDAELIAIgBkEDcjYCBCACIAZqIgMgBEEBcjYCBCADIARqIAQ2AgAgBwRAIAdBeHFBkLMBaiEAQfyyASgCACEBAn9BASAHQQN2dCIGIAVxRQRAQeiyASAFIAZyNgIAIAAMAQsgACgCCAshBSAAIAE2AgggBSABNgIMIAEgADYCDCABIAU2AggLQfyyASADNgIAQfCyASAENgIACyACQQhqIQALIAtBEGokACAAC8oMAQd/AkAgAEUNACAAQQhrIgIgAEEEaygCACIBQXhxIgBqIQUCQCABQQFxDQAgAUEDcUUNASACIAIoAgAiAWsiAkH4sgEoAgBJDQEgACABaiEAQfyyASgCACACRwRAIAFB/wFNBEAgAigCCCIEIAFBA3YiAUEDdEGQswFqRhogBCACKAIMIgNGBEBB6LIBQeiyASgCAEF+IAF3cTYCAAwDCyAEIAM2AgwgAyAENgIIDAILIAIoAhghBgJAIAIgAigCDCIBRwRAIAIoAggiAyABNgIMIAEgAzYCCAwBCwJAIAJBFGoiBCgCACIDDQAgAkEQaiIEKAIAIgMNAEEAIQEMAQsDQCAEIQcgAyIBQRRqIgQoAgAiAw0AIAFBEGohBCABKAIQIgMNAAsgB0EANgIACyAGRQ0BAkAgAigCHCIEQQJ0QZi1AWoiAygCACACRgRAIAMgATYCACABDQFB7LIBQeyyASgCAEF+IAR3cTYCAAwDCyAGQRBBFCAGKAIQIAJGG2ogATYCACABRQ0CCyABIAY2AhggAigCECIDBEAgASADNgIQIAMgATYCGAsgAigCFCIDRQ0BIAEgAzYCFCADIAE2AhgMAQsgBSgCBCIBQQNxQQNHDQBB8LIBIAA2AgAgBSABQX5xNgIEIAIgAEEBcjYCBCAAIAJqIAA2AgAPCyACIAVPDQAgBSgCBCIBQQFxRQ0AAkAgAUECcUUEQEGAswEoAgAgBUYEQEGAswEgAjYCAEH0sgFB9LIBKAIAIABqIgA2AgAgAiAAQQFyNgIEIAJB/LIBKAIARw0DQfCyAUEANgIAQfyyAUEANgIADwtB/LIBKAIAIAVGBEBB/LIBIAI2AgBB8LIBQfCyASgCACAAaiIANgIAIAIgAEEBcjYCBCAAIAJqIAA2AgAPCyABQXhxIABqIQACQCABQf8BTQRAIAUoAggiBCABQQN2IgFBA3RBkLMBakYaIAQgBSgCDCIDRgRAQeiyAUHosgEoAgBBfiABd3E2AgAMAgsgBCADNgIMIAMgBDYCCAwBCyAFKAIYIQYCQCAFIAUoAgwiAUcEQCAFKAIIIgNB+LIBKAIASRogAyABNgIMIAEgAzYCCAwBCwJAIAVBFGoiBCgCACIDDQAgBUEQaiIEKAIAIgMNAEEAIQEMAQsDQCAEIQcgAyIBQRRqIgQoAgAiAw0AIAFBEGohBCABKAIQIgMNAAsgB0EANgIACyAGRQ0AAkAgBSgCHCIEQQJ0QZi1AWoiAygCACAFRgRAIAMgATYCACABDQFB7LIBQeyyASgCAEF+IAR3cTYCAAwCCyAGQRBBFCAGKAIQIAVGG2ogATYCACABRQ0BCyABIAY2AhggBSgCECIDBEAgASADNgIQIAMgATYCGAsgBSgCFCIDRQ0AIAEgAzYCFCADIAE2AhgLIAIgAEEBcjYCBCAAIAJqIAA2AgAgAkH8sgEoAgBHDQFB8LIBIAA2AgAPCyAFIAFBfnE2AgQgAiAAQQFyNgIEIAAgAmogADYCAAsgAEH/AU0EQCAAQXhxQZCzAWohAQJ/QeiyASgCACIDQQEgAEEDdnQiAHFFBEBB6LIBIAAgA3I2AgAgAQwBCyABKAIICyEAIAEgAjYCCCAAIAI2AgwgAiABNgIMIAIgADYCCA8LQR8hBCAAQf///wdNBEAgAEEIdiIBIAFBgP4/akEQdkEIcSIEdCIBIAFBgOAfakEQdkEEcSIDdCIBIAFBgIAPakEQdkECcSIBdEEPdiADIARyIAFyayIBQQF0IAAgAUEVanZBAXFyQRxqIQQLIAIgBDYCHCACQgA3AhAgBEECdEGYtQFqIQcCQAJAAkBB7LIBKAIAIgNBASAEdCIBcUUEQEHssgEgASADcjYCACAHIAI2AgAgAiAHNgIYDAELIABBAEEZIARBAXZrIARBH0YbdCEEIAcoAgAhAQNAIAEiAygCBEF4cSAARg0CIARBHXYhASAEQQF0IQQgAyABQQRxaiIHQRBqKAIAIgENAAsgByACNgIQIAIgAzYCGAsgAiACNgIMIAIgAjYCCAwBCyADKAIIIgAgAjYCDCADIAI2AgggAkEANgIYIAIgAzYCDCACIAA2AggLQYizAUGIswEoAgBBAWsiAEF/IAAbNgIACwugCAELfyAARQRAIAEQogEPCyABQUBPBEBB5LIBQTA2AgBBAA8LAn9BECABQQtqQXhxIAFBC0kbIQYgAEEIayIFKAIEIglBeHEhBAJAIAlBA3FFBEBBACAGQYACSQ0CGiAGQQRqIARNBEAgBSECIAQgBmtByLYBKAIAQQF0TQ0CC0EADAILIAQgBWohBwJAIAQgBk8EQCAEIAZrIgNBEEkNASAFIAlBAXEgBnJBAnI2AgQgBSAGaiICIANBA3I2AgQgByAHKAIEQQFyNgIEIAIgAxClAQwBC0GAswEoAgAgB0YEQEH0sgEoAgAgBGoiBCAGTQ0CIAUgCUEBcSAGckECcjYCBCAFIAZqIgMgBCAGayICQQFyNgIEQfSyASACNgIAQYCzASADNgIADAELQfyyASgCACAHRgRAQfCyASgCACAEaiIDIAZJDQICQCADIAZrIgJBEE8EQCAFIAlBAXEgBnJBAnI2AgQgBSAGaiIEIAJBAXI2AgQgAyAFaiIDIAI2AgAgAyADKAIEQX5xNgIEDAELIAUgCUEBcSADckECcjYCBCADIAVqIgIgAigCBEEBcjYCBEEAIQJBACEEC0H8sgEgBDYCAEHwsgEgAjYCAAwBCyAHKAIEIgNBAnENASADQXhxIARqIgogBkkNASAKIAZrIQwCQCADQf8BTQRAIAcoAggiBCADQQN2IgJBA3RBkLMBakYaIAQgBygCDCIDRgRAQeiyAUHosgEoAgBBfiACd3E2AgAMAgsgBCADNgIMIAMgBDYCCAwBCyAHKAIYIQsCQCAHIAcoAgwiCEcEQCAHKAIIIgJB+LIBKAIASRogAiAINgIMIAggAjYCCAwBCwJAIAdBFGoiBCgCACICDQAgB0EQaiIEKAIAIgINAEEAIQgMAQsDQCAEIQMgAiIIQRRqIgQoAgAiAg0AIAhBEGohBCAIKAIQIgINAAsgA0EANgIACyALRQ0AAkAgBygCHCIDQQJ0QZi1AWoiAigCACAHRgRAIAIgCDYCACAIDQFB7LIBQeyyASgCAEF+IAN3cTYCAAwCCyALQRBBFCALKAIQIAdGG2ogCDYCACAIRQ0BCyAIIAs2AhggBygCECICBEAgCCACNgIQIAIgCDYCGAsgBygCFCICRQ0AIAggAjYCFCACIAg2AhgLIAxBD00EQCAFIAlBAXEgCnJBAnI2AgQgBSAKaiICIAIoAgRBAXI2AgQMAQsgBSAJQQFxIAZyQQJyNgIEIAUgBmoiAyAMQQNyNgIEIAUgCmoiAiACKAIEQQFyNgIEIAMgDBClAQsgBSECCyACCyICBEAgAkEIag8LIAEQogEiBUUEQEEADwsgBSAAQXxBeCAAQQRrKAIAIgJBA3EbIAJBeHFqIgIgASABIAJLGxCcARogABCjASAFC4kMAQZ/IAAgAWohBQJAAkAgACgCBCICQQFxDQAgAkEDcUUNASAAKAIAIgIgAWohAQJAIAAgAmsiAEH8sgEoAgBHBEAgAkH/AU0EQCAAKAIIIgQgAkEDdiICQQN0QZCzAWpGGiAAKAIMIgMgBEcNAkHosgFB6LIBKAIAQX4gAndxNgIADAMLIAAoAhghBgJAIAAgACgCDCICRwRAIAAoAggiA0H4sgEoAgBJGiADIAI2AgwgAiADNgIIDAELAkAgAEEUaiIEKAIAIgMNACAAQRBqIgQoAgAiAw0AQQAhAgwBCwNAIAQhByADIgJBFGoiBCgCACIDDQAgAkEQaiEEIAIoAhAiAw0ACyAHQQA2AgALIAZFDQICQCAAKAIcIgRBAnRBmLUBaiIDKAIAIABGBEAgAyACNgIAIAINAUHssgFB7LIBKAIAQX4gBHdxNgIADAQLIAZBEEEUIAYoAhAgAEYbaiACNgIAIAJFDQMLIAIgBjYCGCAAKAIQIgMEQCACIAM2AhAgAyACNgIYCyAAKAIUIgNFDQIgAiADNgIUIAMgAjYCGAwCCyAFKAIEIgJBA3FBA0cNAUHwsgEgATYCACAFIAJBfnE2AgQgACABQQFyNgIEIAUgATYCAA8LIAQgAzYCDCADIAQ2AggLAkAgBSgCBCICQQJxRQRAQYCzASgCACAFRgRAQYCzASAANgIAQfSyAUH0sgEoAgAgAWoiATYCACAAIAFBAXI2AgQgAEH8sgEoAgBHDQNB8LIBQQA2AgBB/LIBQQA2AgAPC0H8sgEoAgAgBUYEQEH8sgEgADYCAEHwsgFB8LIBKAIAIAFqIgE2AgAgACABQQFyNgIEIAAgAWogATYCAA8LIAJBeHEgAWohAQJAIAJB/wFNBEAgBSgCCCIEIAJBA3YiAkEDdEGQswFqRhogBCAFKAIMIgNGBEBB6LIBQeiyASgCAEF+IAJ3cTYCAAwCCyAEIAM2AgwgAyAENgIIDAELIAUoAhghBgJAIAUgBSgCDCICRwRAIAUoAggiA0H4sgEoAgBJGiADIAI2AgwgAiADNgIIDAELAkAgBUEUaiIDKAIAIgQNACAFQRBqIgMoAgAiBA0AQQAhAgwBCwNAIAMhByAEIgJBFGoiAygCACIEDQAgAkEQaiEDIAIoAhAiBA0ACyAHQQA2AgALIAZFDQACQCAFKAIcIgRBAnRBmLUBaiIDKAIAIAVGBEAgAyACNgIAIAINAUHssgFB7LIBKAIAQX4gBHdxNgIADAILIAZBEEEUIAYoAhAgBUYbaiACNgIAIAJFDQELIAIgBjYCGCAFKAIQIgMEQCACIAM2AhAgAyACNgIYCyAFKAIUIgNFDQAgAiADNgIUIAMgAjYCGAsgACABQQFyNgIEIAAgAWogATYCACAAQfyyASgCAEcNAUHwsgEgATYCAA8LIAUgAkF+cTYCBCAAIAFBAXI2AgQgACABaiABNgIACyABQf8BTQRAIAFBeHFBkLMBaiECAn9B6LIBKAIAIgNBASABQQN2dCIBcUUEQEHosgEgASADcjYCACACDAELIAIoAggLIQEgAiAANgIIIAEgADYCDCAAIAI2AgwgACABNgIIDwtBHyEEIAFB////B00EQCABQQh2IgIgAkGA/j9qQRB2QQhxIgR0IgIgAkGA4B9qQRB2QQRxIgN0IgIgAkGAgA9qQRB2QQJxIgJ0QQ92IAMgBHIgAnJrIgJBAXQgASACQRVqdkEBcXJBHGohBAsgACAENgIcIABCADcCECAEQQJ0QZi1AWohBwJAAkBB7LIBKAIAIgNBASAEdCICcUUEQEHssgEgAiADcjYCACAHIAA2AgAgACAHNgIYDAELIAFBAEEZIARBAXZrIARBH0YbdCEEIAcoAgAhAgNAIAIiAygCBEF4cSABRg0CIARBHXYhAiAEQQF0IQQgAyACQQRxaiIHQRBqKAIAIgINAAsgByAANgIQIAAgAzYCGAsgACAANgIMIAAgADYCCA8LIAMoAggiASAANgIMIAMgADYCCCAAQQA2AhggACADNgIMIAAgATYCCAsLUgECf0GQsAEoAgAiASAAQQdqQXhxIgJqIQACQCACQQAgACABTRsNACAAPwBBEHRLBEAgABAORQ0BC0GQsAEgADYCACABDwtB5LIBQTA2AgBBfwsFAEG1CwtWAQF/IAAoAjwhAyMAQRBrIgAkACADIAGnIAFCIIinIAJB/wFxIABBCGoQFiICBH9B5LIBIAI2AgBBfwVBAAshAiAAKQMIIQEgAEEQaiQAQn8gASACGwv2AgEHfyMAQSBrIgMkACADIAAoAhwiBDYCECAAKAIUIQUgAyACNgIcIAMgATYCGCADIAUgBGsiATYCFCABIAJqIQVBAiEHAn8CQAJAAkAgACgCPCADQRBqIgFBAiADQQxqEA8iBAR/QeSyASAENgIAQX8FQQALBEAgASEEDAELA0AgBSADKAIMIgZGDQIgBkEASARAIAEhBAwECyABIAYgASgCBCIISyIJQQN0aiIEIAYgCEEAIAkbayIIIAQoAgBqNgIAIAFBDEEEIAkbaiIBIAEoAgAgCGs2AgAgBSAGayEFIAAoAjwgBCIBIAcgCWsiByADQQxqEA8iBgR/QeSyASAGNgIAQX8FQQALRQ0ACwsgBUF/Rw0BCyAAIAAoAiwiATYCHCAAIAE2AhQgACABIAAoAjBqNgIQIAIMAQsgAEEANgIcIABCADcDECAAIAAoAgBBIHI2AgBBACAHQQJGDQAaIAIgBCgCBGsLIQAgA0EgaiQAIAALCQAgACgCPBAQCwQAQQALBABBAQvwAQEDfyAARQRAQaixASgCAARAQaixASgCABCtASEBC0HAsgEoAgAEQEHAsgEoAgAQrQEgAXIhAQtBlLcBKAIAIgAEQANAIAAoAkwaIAAoAhQgACgCHEcEQCAAEK0BIAFyIQELIAAoAjgiAA0ACwsgAQ8LIAAoAkxBAE4hAgJAAkAgACgCFCAAKAIcRg0AIABBAEEAIAAoAiQRBAAaIAAoAhQNAEF/IQEMAQsgACgCBCIBIAAoAggiA0cEQCAAIAEgA2usQQEgACgCKBEVABoLQQAhASAAQQA2AhwgAEIANwMQIABCADcCBCACRQ0ACyABC3wBAn8gACAAKAJIIgFBAWsgAXI2AkggACgCFCAAKAIcRwRAIABBAEEAIAAoAiQRBAAaCyAAQQA2AhwgAEIANwMQIAAoAgAiAUEEcQRAIAAgAUEgcjYCAEF/DwsgACAAKAIsIAAoAjBqIgI2AgggACACNgIEIAFBG3RBH3ULWQEBfyAAIAAoAkgiAUEBayABcjYCSCAAKAIAIgFBCHEEQCAAIAFBIHI2AgBBfw8LIABCADcCBCAAIAAoAiwiATYCHCAAIAE2AhQgACABIAAoAjBqNgIQQQALOAECfyAAQfTJADYCACAAKAIEIgEgASgCBEEBayICNgIEIAJBf0YEQCABIAEoAgAoAggRAQALIAALDQAgABCwARogABCjAQsDAAELBAAgAAsQACAAQn83AwggAEIANwMACxAAIABCfzcDCCAAQgA3AwALgQIBBn8jAEEQayIEJAADQAJAIAIgBkwNAAJAIAAoAgwiAyAAKAIQIgVJBEAgBEH/////BzYCDCAEIAUgA2s2AgggBCACIAZrNgIEIwBBEGsiAyQAIARBBGoiBSgCACAEQQhqIgcoAgBIIQggA0EQaiQAIAUgByAIGyEDIwBBEGsiBSQAIAMoAgAgBEEMaiIHKAIASCEIIAVBEGokACADIAcgCBshAyABIAAoAgwgAygCACIDELcBIAAgACgCDCADajYCDAwBCyAAIAAoAgAoAigRAAAiA0F/Rg0BIAEgAzoAAEEBIQMLIAEgA2ohASADIAZqIQYMAQsLIARBEGokACAGCxEAIAIEQCAAIAEgAhCcARoLCwQAQX8LLAAgACAAKAIAKAIkEQAAQX9GBEBBfw8LIAAgACgCDCIAQQFqNgIMIAAtAAALBABBfwvLAQEGfyMAQRBrIgUkAANAAkAgAiAETA0AIAAoAhgiAyAAKAIcIgZPBH8gACABLQAAIAAoAgAoAjQRAwBBf0YNASAEQQFqIQQgAUEBagUgBSAGIANrNgIMIAUgAiAEazYCCCMAQRBrIgMkACAFQQhqIgYoAgAgBUEMaiIHKAIASCEIIANBEGokACAGIAcgCBshAyAAKAIYIAEgAygCACIDELcBIAAgAyAAKAIYajYCGCADIARqIQQgASADagshAQwBCwsgBUEQaiQAIAQLDQAgAEEIahDkARogAAsTACAAIAAoAgBBDGsoAgBqELwBCwoAIAAQvAEQowELEwAgACAAKAIAQQxrKAIAahC+AQtzAQJ/IwBBIGsiAyQAIABBADoAACABIAEoAgBBDGsoAgBqIQICQCACKAIQRQRAIAIoAkgEQCABIAEoAgBBDGsoAgBqKAJIEMEBCyAAIAEgASgCAEEMaygCAGooAhBFOgAADAELIAJBBBDHAQsgA0EgaiQAC80CAQJ/IwBBEGsiASQAIAAgACgCAEEMaygCAGooAhgEQCABIAA2AgwgAUEAOgAIIAAgACgCAEEMaygCAGooAhBFBEAgACAAKAIAQQxrKAIAaigCSARAIAAgACgCAEEMaygCAGooAkgQwQELIAFBAToACAsCQCABLQAIRQ0AIAAgACgCAEEMaygCAGooAhgiAiACKAIAKAIYEQAAQX9HDQAgACAAKAIAQQxrKAIAakEBEMcBCwJAIAEoAgwiACAAKAIAQQxrKAIAaigCGEUNACABKAIMIgAgACgCAEEMaygCAGooAhANACABKAIMIgAgACgCAEEMaygCAGooAgRBgMAAcUUNACABKAIMIgAgACgCAEEMaygCAGooAhgiACAAKAIAKAIYEQAAQX9HDQAgASgCDCIAIAAoAgBBDGsoAgBqQQEQxwELCyABQRBqJAALCwAgAEG0wgEQpAILDAAgACABEMgBQQFzCzYBAX8CfyAAKAIAIgAoAgwiASAAKAIQRgRAIAAgACgCACgCJBEAAAwBCyABLQAAC0EYdEEYdQsNACAAKAIAEMkBGiAACwkAIAAgARDIAQsPACAAIAAoAhAgAXIQ4wELEAAgABDfASABEN8Bc0EBcwsxAQF/IAAoAgwiASAAKAIQRgRAIAAgACgCACgCKBEAAA8LIAAgAUEBajYCDCABLQAAC3kBAn8jAEEQayIEJAAgAEEANgIEIARBCGogABDAAUEEIQMgBC0ACARAIAAgACAAKAIAQQxrKAIAaigCGCIDIAEgAiADKAIAKAIgEQQAIgE2AgRBAEEGIAEgAkYbIQMLIAAgACgCAEEMaygCAGogAxDHASAEQRBqJAALCQAgACABEOMBC4QBAQJ/IwBBIGsiAiQAIABCfzcDCCAAQgA3AwAgAkEYaiABEMABIAItABgEQCACQQhqIAEgASgCAEEMaygCAGooAhgiA0IAQQFBCCADKAIAKAIQERMAIAAgAikDEDcDCCAAIAIpAwg3AwAgASABKAIAQQxrKAIAakEAEMcBCyACQSBqJAAL4QEBBX8jAEFAaiICJAAgACAAKAIAQQxrKAIAaiIDIAMoAhBBfXEiAxDLASACQThqIAAQwAEgAi0AOARAIAAgACgCAEEMaygCAGooAhghBCACIAEpAwg3AxAgAiABKQMANwMIIwBBEGsiASQAIAQoAgAoAhQhBSABIAIpAxA3AwggASACKQMINwMAIAJBKGoiBiAEIAFBCCAFEQkAIAFBEGokACACQRhqIgFCfzcDCCABQgA3AwAgACAAKAIAQQxrKAIAaiADQQRyIAMgBikDCCABKQMIURsQxwELIAJBQGskAAupAQEEfyMAQTBrIgMkACAAIAAoAgBBDGsoAgBqIgIgAigCEEF9cSIEEMsBIANBKGogABDAASADLQAoBEAgA0EYaiIFIAAgACgCAEEMaygCAGooAhgiAiABQQFBCCACKAIAKAIQERMAIANBCGoiAkJ/NwMIIAJCADcDACAFKQMIIAIpAwhRIQIgACAAKAIAQQxrKAIAaiAEQQRyIAQgAhsQxwELIANBMGokAAtcAQJ/AkAgACgCACICRQ0AAn8gAigCGCIDIAIoAhxGBEAgAiABQf8BcSACKAIAKAI0EQMADAELIAIgA0EBajYCGCADIAE6AAAgAUH/AXELQX9HDQAgAEEANgIACws2ACACBH8gAgRAA0AgACABKAIANgIAIABBBGohACABQQRqIQEgAkEBayICDQALC0EABSAACxoLCwAgAEGswgEQpAILDAAgACABENUBQQFzCw0AIAAoAgAQ1gEaIAALCQAgACABENUBCxAAIAAQ4AEgARDgAXNBAXMLMQEBfyAAKAIMIgEgACgCEEYEQCAAIAAoAgAoAigRAAAPCyAAIAFBBGo2AgwgASgCAAtUAQJ/AkAgACgCACICRQ0AAn8gAigCGCIDIAIoAhxGBEAgAiABIAIoAgAoAjQRAwAMAQsgAiADQQRqNgIYIAMgATYCACABC0F/Rw0AIABBADYCAAsLPwECfyMAQRBrIgIkACAAIQFBACEAA0AgAEEDRwRAIAEgAEECdGpBADYCACAAQQFqIQAMAQsLIAJBEGokACABC2EBAX8jAEEQayICJAAgAC0AC0EHdgRAIAAgACgCACAAKAIIQf////8HcRDdAQsgACABKAIINgIIIAAgASkCADcCACABQQA6AAsgAkEAOgAPIAEgAi0ADzoAACACQRBqJAALuwEBBH8jAEEQayIFJAAgAiABayIEQW9NBEACQCAEQQtJBEAgACAEOgALIAAhAwwBCyAAIAAgBEELTwR/IARBEGpBcHEiAyADQQFrIgMgA0ELRhsFQQoLQQFqIgYQ4QEiAzYCACAAIAZBgICAgHhyNgIIIAAgBDYCBAsDQCABIAJHBEAgAyABLQAAOgAAIANBAWohAyABQQFqIQEMAQsLIAVBADoADyADIAUtAA86AAAgBUEQaiQADwsQdQALCQAgACABELEECwUAEBEACwkAIAFBARDeAQsVACABQQhLBEAgABCjAQ8LIAAQowELSwECfyAAKAIAIgEEQAJ/IAEoAgwiAiABKAIQRgRAIAEgASgCACgCJBEAAAwBCyACLQAAC0F/RwRAIAAoAgBFDwsgAEEANgIAC0EBC0sBAn8gACgCACIBBEACfyABKAIMIgIgASgCEEYEQCABIAEoAgAoAiQRAAAMAQsgAigCAAtBf0cEQCAAKAIARQ8LIABBADYCAAtBAQsJACABQQEQ4gEL1QQBCH8gAUEISwRAIAFBBCABQQRLGyEEIABBASAAGyEGA0ACQCMAQRBrIgckACAHQQA2AgwCQAJ/IARBCEYEQCAGEKIBDAELIARBBEkNASAEQQNxDQEgBEECdiIAIABBAWtxDQFBQCAEayAGSQ0BAn9BECEDAkAgBEEQIARBEEsbIgBBECAAQRBLGyIBIAFBAWtxRQRAIAEhAAwBCwNAIAMiAEEBdCEDIAAgAUkNAAsLIAZBQCAAa08EQEHksgFBMDYCAEEADAELQQBBECAGQQtqQXhxIAZBC0kbIgMgAGpBDGoQogEiAkUNABogAkEIayEBAkAgAEEBayACcUUEQCABIQAMAQsgAkEEayIIKAIAIglBeHEgACACakEBa0EAIABrcUEIayICQQAgACACIAFrQQ9LG2oiACABayICayEFIAlBA3FFBEAgASgCACEBIAAgBTYCBCAAIAEgAmo2AgAMAQsgACAFIAAoAgRBAXFyQQJyNgIEIAAgBWoiBSAFKAIEQQFyNgIEIAggAiAIKAIAQQFxckECcjYCACABIAJqIgUgBSgCBEEBcjYCBCABIAIQpQELAkAgACgCBCIBQQNxRQ0AIAFBeHEiAiADQRBqTQ0AIAAgAyABQQFxckECcjYCBCAAIANqIgEgAiADayIDQQNyNgIEIAAgAmoiAiACKAIEQQFyNgIEIAEgAxClAQsgAEEIagsLIgBFDQAgByAANgIMCyAHKAIMIQAgB0EQaiQAIAANAEHo0AEoAgAiAUUNACABEQwADAELCyAADwsgABCkBAshACAAIAAoAhhFIAFyIgE2AhAgACgCFCABcQRAENwBAAsLkAEBAn8gAEGgzAA2AgAgACgCKCEBA0AgAQRAQQAgACABQQFrIgFBAnQiAiAAKAIkaigCACAAKAIgIAJqKAIAEQUADAELCyAAKAIcIgEgASgCBEEBayICNgIEIAJBf0YEQCABIAEoAgAoAggRAQALIAAoAiAQowEgACgCJBCjASAAKAIwEKMBIAAoAjwQowEgAAsNACAAEOQBGiAAEKMBCwQAQgALRwECfyAAIAE3A3AgACAAKAIsIAAoAgQiA2usNwN4IAAoAgghAgJAIAFQDQAgAiADa6wgAVcNACADIAGnaiECCyAAIAI2AmgLjAICA38CfgJAIAApA3AiBEIAUiAEIAApA3ggACgCBCIBIAAoAiwiAmusfCIFV3FFBEAjAEEQayICJABBfyEBAkAgABCuAQ0AIAAgAkEPakEBIAAoAiARBABBAUcNACACLQAPIQELIAJBEGokACABIgNBAE4NASAAKAIEIQEgACgCLCECCyAAQn83A3AgACABNgJoIAAgBSACIAFrrHw3A3hBfw8LIAVCAXwhBSAAKAIEIQEgACgCCCECAkAgACkDcCIEUA0AIAQgBX0iBCACIAFrrFkNACABIASnaiECCyAAIAI2AmggACAFIAAoAiwiACABa6x8NwN4IAAgAU8EQCABQQFrIAM6AAALIAMLUAEBfgJAIANBwABxBEAgASADQUBqrYYhAkIAIQEMAQsgA0UNACACIAOtIgSGIAFBwAAgA2utiIQhAiABIASGIQELIAAgATcDACAAIAI3AwgLfwICfwF+IwBBEGsiAyQAIAACfiABRQRAQgAMAQsgAyABIAFBH3UiAnMgAmsiAq1CACACZyICQdEAahDpASADKQMIQoCAgICAgMAAhUGegAEgAmutQjCGfCABQYCAgIB4ca1CIIaEIQQgAykDAAs3AwAgACAENwMIIANBEGokAAtQAQF+AkAgA0HAAHEEQCACIANBQGqtiCEBQgAhAgwBCyADRQ0AIAJBwAAgA2uthiABIAOtIgSIhCEBIAIgBIghAgsgACABNwMAIAAgAjcDCAvLCgIFfw9+IwBB4ABrIgUkACAEQv///////z+DIQwgAiAEhUKAgICAgICAgIB/gyEKIAJC////////P4MiDUIgiCEOIARCMIinQf//AXEhBwJAAkAgAkIwiKdB//8BcSIJQf//AWtBgoB+TwRAIAdB//8Ba0GBgH5LDQELIAFQIAJC////////////AIMiC0KAgICAgIDA//8AVCALQoCAgICAgMD//wBRG0UEQCACQoCAgICAgCCEIQoMAgsgA1AgBEL///////////8AgyICQoCAgICAgMD//wBUIAJCgICAgICAwP//AFEbRQRAIARCgICAgICAIIQhCiADIQEMAgsgASALQoCAgICAgMD//wCFhFAEQCACIAOEUARAQoCAgICAgOD//wAhCkIAIQEMAwsgCkKAgICAgIDA//8AhCEKQgAhAQwCCyADIAJCgICAgICAwP//AIWEUARAIAEgC4QhAkIAIQEgAlAEQEKAgICAgIDg//8AIQoMAwsgCkKAgICAgIDA//8AhCEKDAILIAEgC4RQBEBCACEBDAILIAIgA4RQBEBCACEBDAILIAtC////////P1gEQCAFQdAAaiABIA0gASANIA1QIgYbeSAGQQZ0rXynIgZBD2sQ6QFBECAGayEGIAUpA1giDUIgiCEOIAUpA1AhAQsgAkL///////8/Vg0AIAVBQGsgAyAMIAMgDCAMUCIIG3kgCEEGdK18pyIIQQ9rEOkBIAYgCGtBEGohBiAFKQNIIQwgBSkDQCEDCyADQg+GIgtCgID+/w+DIgIgAUIgiCIEfiIQIAtCIIgiEyABQv////8PgyIBfnwiD0IghiIRIAEgAn58IgsgEVStIAIgDUL/////D4MiDX4iFSAEIBN+fCIRIAxCD4YiEiADQjGIhEL/////D4MiAyABfnwiFCAPIBBUrUIghiAPQiCIhHwiDyACIA5CgIAEhCIMfiIWIA0gE358Ig4gEkIgiEKAgICACIQiAiABfnwiECADIAR+fCISQiCGfCIXfCEBIAcgCWogBmpB//8AayEGAkAgAiAEfiIYIAwgE358IgQgGFStIAQgBCADIA1+fCIEVq18IAIgDH58IAQgBCARIBVUrSARIBRWrXx8IgRWrXwgAyAMfiIDIAIgDX58IgIgA1StQiCGIAJCIIiEfCAEIAJCIIZ8IgIgBFStfCACIAIgECASVq0gDiAWVK0gDiAQVq18fEIghiASQiCIhHwiAlatfCACIAIgDyAUVK0gDyAXVq18fCICVq18IgRCgICAgICAwACDQgBSBEAgBkEBaiEGDAELIAtCP4ghAyAEQgGGIAJCP4iEIQQgAkIBhiABQj+IhCECIAtCAYYhCyADIAFCAYaEIQELIAZB//8BTgRAIApCgICAgICAwP//AIQhCkIAIQEMAQsCfiAGQQBMBEBBASAGayIHQYABTwRAQgAhAQwDCyAFQTBqIAsgASAGQf8AaiIGEOkBIAVBIGogAiAEIAYQ6QEgBUEQaiALIAEgBxDrASAFIAIgBCAHEOsBIAUpAzAgBSkDOIRCAFKtIAUpAyAgBSkDEISEIQsgBSkDKCAFKQMYhCEBIAUpAwAhAiAFKQMIDAELIARC////////P4MgBq1CMIaECyAKhCEKIAtQIAFCAFkgAUKAgICAgICAgIB/URtFBEAgCiACQgF8IgEgAlStfCEKDAELIAsgAUKAgICAgICAgIB/hYRCAFIEQCACIQEMAQsgCiACIAJCAYN8IgEgAlStfCEKCyAAIAE3AwAgACAKNwMIIAVB4ABqJAALzQkCBH4EfyMAQfAAayIKJAAgBEL///////////8AgyEFAkACQCABUCIJIAJC////////////AIMiBkKAgICAgIDA//8AfUKAgICAgIDAgIB/VCAGUBtFBEAgA0IAUiAFQoCAgICAgMD//wB9IghCgICAgICAwICAf1YgCEKAgICAgIDAgIB/URsNAQsgCSAGQoCAgICAgMD//wBUIAZCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhBCABIQMMAgsgA1AgBUKAgICAgIDA//8AVCAFQoCAgICAgMD//wBRG0UEQCAEQoCAgICAgCCEIQQMAgsgASAGQoCAgICAgMD//wCFhFAEQEKAgICAgIDg//8AIAIgASADhSACIASFQoCAgICAgICAgH+FhFAiCRshBEIAIAEgCRshAwwCCyADIAVCgICAgICAwP//AIWEUA0BIAEgBoRQBEAgAyAFhEIAUg0CIAEgA4MhAyACIASDIQQMAgsgAyAFhEIAUg0AIAEhAyACIQQMAQsgAyABIAEgA1QgBSAGViAFIAZRGyIMGyEFIAQgAiAMGyIIQv///////z+DIQYgAiAEIAwbIgdCMIinQf//AXEhCyAIQjCIp0H//wFxIglFBEAgCkHgAGogBSAGIAUgBiAGUCIJG3kgCUEGdK18pyIJQQ9rEOkBIAopA2ghBiAKKQNgIQVBECAJayEJCyABIAMgDBshAyAHQv///////z+DIQQgC0UEQCAKQdAAaiADIAQgAyAEIARQIgsbeSALQQZ0rXynIgtBD2sQ6QFBECALayELIAopA1ghBCAKKQNQIQMLIARCA4YgA0I9iIRCgICAgICAgASEIQIgBkIDhiAFQj2IhCEEIANCA4YhASAHIAiFIQMCQCAJIAtGDQAgCSALayILQf8ASwRAQgAhAkIBIQEMAQsgCkFAayABIAJBgAEgC2sQ6QEgCkEwaiABIAIgCxDrASAKKQMwIAopA0AgCikDSIRCAFKthCEBIAopAzghAgsgBEKAgICAgICABIQhByAFQgOGIQYCQCADQgBTBEBCACEDQgAhBCABIAaFIAIgB4WEUA0CIAYgAX0hBSAHIAJ9IAEgBlatfSIEQv////////8DVg0BIApBIGogBSAEIAUgBCAEUCILG3kgC0EGdK18p0EMayILEOkBIAkgC2shCSAKKQMoIQQgCikDICEFDAELIAEgBnwiBSABVK0gAiAHfHwiBEKAgICAgICACINQDQAgBUIBgyAEQj+GIAVCAYiEhCEFIAlBAWohCSAEQgGIIQQLIAhCgICAgICAgICAf4MhASAJQf//AU4EQCABQoCAgICAgMD//wCEIQRCACEDDAELQQAhCwJAIAlBAEoEQCAJIQsMAQsgCkEQaiAFIAQgCUH/AGoQ6QEgCiAFIARBASAJaxDrASAKKQMAIAopAxAgCikDGIRCAFKthCEFIAopAwghBAsgBEI9hiAFQgOIhCICIAWnQQdxIglBBEutfCIDIAJUrSAEQgOIQv///////z+DIAutQjCGhCABhHwhBAJAIAlBBEYEQCAEIANCAYMiASADfCIDIAFUrXwhBAwBCyAJRQ0BCwsgACADNwMAIAAgBDcDCCAKQfAAaiQAC/oBAgN+An8jAEEQayIFJAACfiABvSIDQv///////////wCDIgJCgICAgICAgAh9Qv/////////v/wBYBEAgAkI8hiEEIAJCBIhCgICAgICAgIA8fAwBCyACQoCAgICAgID4/wBaBEAgA0I8hiEEIANCBIhCgICAgICAwP//AIQMAQsgAlAEQEIADAELIAUgAkIAIAOnZ0EgaiACQiCIp2cgAkKAgICAEFQbIgZBMWoQ6QEgBSkDACEEIAUpAwhCgICAgICAwACFQYz4ACAGa61CMIaECyECIAAgBDcDACAAIAIgA0KAgICAgICAgIB/g4Q3AwggBUEQaiQAC9sBAgF/An5BASEEAkAgAEIAUiABQv///////////wCDIgVCgICAgICAwP//AFYgBUKAgICAgIDA//8AURsNACACQgBSIANC////////////AIMiBkKAgICAgIDA//8AViAGQoCAgICAgMD//wBRGw0AIAAgAoQgBSAGhIRQBEBBAA8LIAEgA4NCAFkEQEF/IQQgACACVCABIANTIAEgA1EbDQEgACAChSABIAOFhEIAUg8LQX8hBCAAIAJWIAEgA1UgASADURsNACAAIAKFIAEgA4WEQgBSIQQLIAQLxAECAX8CfkF/IQMCQCAAQgBSIAFC////////////AIMiBEKAgICAgIDA//8AViAEQoCAgICAgMD//wBRGw0AQQAgAkL///////////8AgyIFQoCAgICAgMD//wBWIAVCgICAgICAwP//AFEbDQAgACAEIAWEhFAEQEEADwsgASACg0IAWQRAQQAgASACUyABIAJRGw0BIAAgASAChYRCAFIPCyAAQgBSIAEgAlUgASACURsNACAAIAEgAoWEQgBSIQMLIAMLqQEBAXxEAAAAAAAA8D8hAQJAIABBgAhOBEBEAAAAAAAA4H8hASAAQf8PSQRAIABB/wdrIQAMAgtEAAAAAAAA8H8hASAAQf0XIABB/RdIG0H+D2shAAwBCyAAQYF4Sg0ARAAAAAAAAGADIQEgAEG4cEsEQCAAQckHaiEADAELRAAAAAAAAAAAIQEgAEHwaCAAQfBoShtBkg9qIQALIAEgAEH/B2qtQjSGv6ILNQAgACABNwMAIAAgAkL///////8/gyAEQjCIp0GAgAJxIAJCMIinQf//AXFyrUIwhoQ3AwgLZAIBfwF+IwBBEGsiAiQAIAACfiABRQRAQgAMAQsgAiABrUIAIAFnIgFB0QBqEOkBIAIpAwhCgICAgICAwACFQZ6AASABa61CMIZ8IQMgAikDAAs3AwAgACADNwMIIAJBEGokAAtFAQF/IwBBEGsiBSQAIAUgASACIAMgBEKAgICAgICAgIB/hRDtASAFKQMAIQEgACAFKQMINwMIIAAgATcDACAFQRBqJAALxAIBAX8jAEHQAGsiBCQAAkAgA0GAgAFOBEAgBEEgaiABIAJCAEKAgICAgICA//8AEOwBIAQpAyghAiAEKQMgIQEgA0H//wFJBEAgA0H//wBrIQMMAgsgBEEQaiABIAJCAEKAgICAgICA//8AEOwBIANB/f8CIANB/f8CSBtB/v8BayEDIAQpAxghAiAEKQMQIQEMAQsgA0GBgH9KDQAgBEFAayABIAJCAEKAgICAgICAORDsASAEKQNIIQIgBCkDQCEBIANB9IB+SwRAIANBjf8AaiEDDAELIARBMGogASACQgBCgICAgICAgDkQ7AEgA0HogX0gA0HogX1KG0Ga/gFqIQMgBCkDOCECIAQpAzAhAQsgBCABIAJCACADQf//AGqtQjCGEOwBIAAgBCkDCDcDCCAAIAQpAwA3AwAgBEHQAGokAAt1AQF+IAAgASAEfiACIAN+fCADQiCIIgIgAUIgiCIEfnwgA0L/////D4MiAyABQv////8PgyIBfiIFQiCIIAMgBH58IgNCIIh8IAEgAn4gA0L/////D4N8IgFCIIh8NwMIIAAgBUL/////D4MgAUIghoQ3AwALvg8CBX8PfiMAQdACayIFJAAgBEL///////8/gyELIAJC////////P4MhCiACIASFQoCAgICAgICAgH+DIQ0gBEIwiKdB//8BcSEIAkACQCACQjCIp0H//wFxIglB//8Ba0GCgH5PBEAgCEH//wFrQYGAfksNAQsgAVAgAkL///////////8AgyIMQoCAgICAgMD//wBUIAxCgICAgICAwP//AFEbRQRAIAJCgICAgICAIIQhDQwCCyADUCAEQv///////////wCDIgJCgICAgICAwP//AFQgAkKAgICAgIDA//8AURtFBEAgBEKAgICAgIAghCENIAMhAQwCCyABIAxCgICAgICAwP//AIWEUARAIAMgAkKAgICAgIDA//8AhYRQBEBCACEBQoCAgICA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ASADIAAgBUGB/wAgBGsQ6wEgAykDCCIAQhmIpyECIAMpAwAgAykDECADKQMYhEIAUq2EIgVQIABC////D4MiAEKAgIAIVCAAQoCAgAhRG0UEQCACQQFqIQIMAQsgBSAAQoCAgAiFhEIAUg0AIAJBAXEgAmohAgsgA0EgaiQAIAIgAUIgiKdBgICAgHhxcr4L0wMCAn4CfyMAQSBrIgQkAAJAIAFC////////////AIMiA0KAgICAgIDAgDx9IANCgICAgICAwP/DAH1UBEAgAUIEhiAAQjyIhCEDIABC//////////8PgyIAQoGAgICAgICACFoEQCADQoGAgICAgICAwAB8IQIMAgsgA0KAgICAgICAgEB9IQIgAEKAgICAgICAgAhSDQEgAiADQgGDfCECDAELIABQIANCgICAgICAwP//AFQgA0KAgICAgIDA//8AURtFBEAgAUIEhiAAQjyIhEL/////////A4NCgICAgICAgPz/AIQhAgwBC0KAgICAgICA+P8AIQIgA0L///////+//8MAVg0AQgAhAiADQjCIpyIFQZH3AEkNACAEQRBqIAAgAUL///////8/g0KAgICAgIDAAIQiAiAFQYH3AGsQ6QEgBCAAIAJBgfgAIAVrEOsBIAQpAwhCBIYgBCkDACIAQjyIhCECIAQpAxAgBCkDGIRCAFKtIABC//////////8Pg4QiAEKBgICAgICAgAhaBEAgAkIBfCECDAELIABCgICAgICAgIAIUg0AIAJCAYMgAnwhAgsgBEEgaiQAIAIgAUKAgICAgICAgIB/g4S/C+UCAQZ/IwBBEGsiByQAIANBoMABIAMbIgUoAgAhAwJAAkACQCABRQRAIAMNAQwDC0F+IQQgAkUNAiAAIAdBDGogABshBgJAIAMEQCACIQAMAQsgAS0AACIAQRh0QRh1IgNBAE4EQCAGIAA2AgAgA0EARyEEDAQLIAEsAAAhAEGIwAEoAgAoAgBFBEAgBiAAQf+/A3E2AgBBASEEDAQLIABB/wFxQcIBayIAQTJLDQEgAEECdEGwzwBqKAIAIQMgAkEBayIARQ0CIAFBAWohAQsgAS0AACIIQQN2IglBEGsgA0EadSAJanJBB0sNAANAIABBAWshACAIQYABayADQQZ0ciIDQQBOBEAgBUEANgIAIAYgAzYCACACIABrIQQM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IQQMAQsgAkEENgIAIARCAFUEQEL///////////8AIQQMAQtCgICAgICAgICAfyEECyAFQRBqJAAgBAvJBAEBfyMAQZACayIAJAAgACACNgKAAiAAIAE2AogCIAMQpwIhBiAAQdABaiADIABB/wFqEKgCIABBwAFqENgBIgEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAjYCvAEgACAAQRBqNgIMIABBADYCCANAAkAgAEGIAmogAEGAAmoQwwFFDQAgACgCvAECfyABLQALQQd2BEAgASgCBAwBCyABLQALCyACakYEQAJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLIQMgAQJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLQQF0ENsBIAEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAIAMCfyABLQALQQd2BEAgASgCAAwBCyABCyICajYCvAELIABBiAJqEMQBIAYgAiAAQbwBaiAAQQhqIAAsAP8BIABB0AFqIABBEGogAEEMakHA7gAQqQINACAAQYgCahDFARoMAQsLAkACfyAALQDbAUEHdgRAIAAoAtQBDAELIAAtANsBC0UNACAAKAIMIgMgAEEQamtBnwFKDQAgACADQQRqNgIMIAMgACgCCDYCAAsgBSACIAAoArwBIAQgBhCvAjsBACAAQdABaiAAQRBqIAAoAgwgBBCrAiAAQYgCaiAAQYACahDGAQRAIAQgBCgCAEECcjYCAAsgACgCiAIhAiABEKoEGiAAQdABahCqBBogAEGQAmokACACC94BAgN/AX4jAEEQayIEJAACfwJAAkACQCAAIAFHBEACQAJAIAAtAAAiBUEtRw0AIABBAWoiACABRw0ADAELQeSyASgCACEGQeSyAUEANgIAEL0CGiAAIARBDGogAxCiBCEHAkBB5LIBKAIAIgAEQCAEKAIMIAFHDQEgAEHEAEYNBQwEC0HksgEgBjYCACAEKAIMIAFGDQMLCwsgAkEENgIAQQAMAwsgB0L//wNYDQELIAJBBDYCAEH//wMMAQtBACAHpyIAayAAIAVBLUYbCyEAIARBEGokACAAQf//A3ELyQQBAX8jAEGQAmsiACQAIAAgAjYCgAIgACABNgKIAiADEKcCIQYgAEHQAWogAyAAQf8BahCoAiAAQcABahDYASIBIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgAAJ/IAEtAAtBB3YEQCABKAIADAELIAELIgI2ArwBIAAgAEEQajYCDCAAQQA2AggDQAJAIABBiAJqIABBgAJqEMMBRQ0AIAAoArwBAn8gAS0AC0EHdgRAIAEoAgQMAQsgAS0ACwsgAmpGBEACfyABLQALQQd2BEAgASgCBAwBCyABLQALCyEDIAECfyABLQALQQd2BEAgASgCBAwBCyABLQALC0EBdBDbASABIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgACADAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAmo2ArwBCyAAQYgCahDEASAGIAIgAEG8AWogAEEIaiAALAD/ASAAQdABaiAAQRBqIABBDGpBwO4AEKkCDQAgAEGIAmoQxQEaDAELCwJAAn8gAC0A2wFBB3YEQCAAKALUAQwBCyAALQDbAQtFDQAgACgCDCIDIABBEGprQZ8BSg0AIAAgA0EEajYCDCADIAAoAgg2AgALIAUgAiAAKAK8ASAEIAYQsQI2AgAgAEHQAWogAEEQaiAAKAIMIAQQqwIgAEGIAmogAEGAAmoQxgEEQCAEIAQoAgBBAnI2AgALIAAoAogCIQIgARCqBBogAEHQAWoQqgQaIABBkAJqJAAgAgvZAQIDfwF+IwBBEGsiBCQAAn8CQAJAAkAgACABRwRAAkACQCAALQAAIgVBLUcNACAAQQFqIgAgAUcNAAwBC0HksgEoAgAhBkHksgFBADYCABC9AhogACAEQQxqIAMQogQhBwJAQeSyASgCACIABEAgBCgCDCABRw0BIABBxABGDQUMBAtB5LIBIAY2AgAgBCgCDCABRg0DCwsLIAJBBDYCAEEADAMLIAdC/////w9YDQELIAJBBDYCAEF/DAELQQAgB6ciAGsgACAFQS1GGwshACAEQRBqJAAgAAvJBAEBfyMAQZACayIAJAAgACACNgKAAiAAIAE2AogCIAMQpwIhBiAAQdABaiADIABB/wFqEKgCIABBwAFqENgBIgEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAjYCvAEgACAAQRBqNgIMIABBADYCCANAAkAgAEGIAmogAEGAAmoQwwFFDQAgACgCvAECfyABLQALQQd2BEAgASgCBAwBCyABLQALCyACakYEQAJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLIQMgAQJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLQQF0ENsBIAEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAIAMCfyABLQALQQd2BEAgASgCAAwBCyABCyICajYCvAELIABBiAJqEMQBIAYgAiAAQbwBaiAAQQhqIAAsAP8BIABB0AFqIABBEGogAEEMakHA7gAQqQINACAAQYgCahDFARoMAQsLAkACfyAALQDbAUEHdgRAIAAoAtQBDAELIAAtANsBC0UNACAAKAIMIgMgAEEQamtBnwFKDQAgACADQQRqNgIMIAMgACgCCDYCAAsgBSACIAAoArwBIAQgBhCzAjcDACAAQdABaiAAQRBqIAAoAgwgBBCrAiAAQYgCaiAAQYACahDGAQRAIAQgBCgCAEECcjYCAAsgACgCiAIhAiABEKoEGiAAQdABahCqBBogAEGQAmokACACC8gBAgN/AX4jAEEQayIEJAACfgJAAkAgACABRwRAAkACQCAALQAAIgVBLUcNACAAQQFqIgAgAUcNAAwBC0HksgEoAgAhBkHksgFBADYCABC9AhogACAEQQxqIAMQogQhBwJAQeSyASgCACIABEAgBCgCDCABRw0BIABBxABGDQQMBQtB5LIBIAY2AgAgBCgCDCABRg0ECwsLIAJBBDYCAEIADAILIAJBBDYCAEJ/DAELQgAgB30gByAFQS1GGwshByAEQRBqJAAgBwvxBAAjAEGQAmsiACQAIAAgAjYCgAIgACABNgKIAiAAQdABaiADIABB4AFqIABB3wFqIABB3gFqELUCIABBwAFqENgBIgEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAjYCvAEgACAAQRBqNgIMIABBADYCCCAAQQE6AAcgAEHFADoABgNAAkAgAEGIAmogAEGAAmoQwwFFDQAgACgCvAECfyABLQALQQd2BEAgASgCBAwBCyABLQALCyACakYEQAJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLIQMgAQJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLQQF0ENsBIAEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAIAMCfyABLQALQQd2BEAgASgCAAwBCyABCyICajYCvAELIABBiAJqEMQBIABBB2ogAEEGaiACIABBvAFqIAAsAN8BIAAsAN4BIABB0AFqIABBEGogAEEMaiAAQQhqIABB4AFqELYCDQAgAEGIAmoQxQEaDAELCwJAAn8gAC0A2wFBB3YEQCAAKALUAQwBCyAALQDbAQtFDQAgAC0AB0UNACAAKAIMIgMgAEEQamtBnwFKDQAgACADQQRqNgIMIAMgACgCCDYCAAsgBSACIAAoArwBIAQQtwI4AgAgAEHQAWogAEEQaiAAKAIMIAQQqwIgAEGIAmogAEGAAmoQxgEEQCAEIAQoAgBBAnI2AgALIAAoAogCIQIgARCqBBogAEHQAWoQqgQaIABBkAJqJAAgAguwAQECfyMAQRBrIgYkACAGQQhqIgUgASgCHCIBNgIAIAEgASgCBEEBajYCBCAFEMIBIgFBwO4AQeDuACACIAEoAgAoAiARBwAaIAMgBRCiAiIBIAEoAgAoAgwRAAA6AAAgBCABIAEoAgAoAhARAAA6AAAgACABIAEoAgAoAhQRAgAgBSgCACIAIAAoAgRBAWsiATYCBCABQX9GBEAgACAAKAIAKAIIEQEACyAGQRBqJAALrwQBAX8jAEEQayIMJAAgDCAAOgAPAkACQCAAIAVGBEAgAS0AAEUNAUEAIQAgAUEAOgAAIAQgBCgCACIBQQFqNgIAIAFBLjoAAAJ/IActAAtBB3YEQCAHKAIEDAELIActAAsLRQ0CIAkoAgAiASAIa0GfAUoNAiAKKAIAIQIgCSABQQRqNgIAIAEgAjYCAAwCCwJAIAAgBkcNAAJ/IActAAtBB3YEQCAHKAIEDAELIActAAsLRQ0AIAEtAABFDQFBACEAIAkoAgAiASAIa0GfAUoNAiAKKAIAIQAgCSABQQRqNgIAIAEgADYCAEEAIQAgCkEANgIADAILQX8hACALIAtBIGogDEEPahC/AiALayIFQR9KDQEgBUHA7gBqLQAAIQYCQAJAAkACQCAFQX5xQRZrDgMBAgACCyADIAQoAgAiAUcEQCABQQFrLQAAQd8AcSACLQAAQf8AcUcNBQsgBCABQQFqNgIAIAEgBjoAAEEAIQAMBAsgAkHQADoAAAwBCyAGQd8AcSIAIAItAABHDQAgAiAAQYABcjoAACABLQAARQ0AIAFBADoAAAJ/IActAAtBB3YEQCAHKAIEDAELIActAAsLRQ0AIAkoAgAiACAIa0GfAUoNACAKKAIAIQEgCSAAQQRqNgIAIAAgATYCAAsgBCAEKAIAIgBBAWo2AgAgACAGOgAAQQAhACAFQRVKDQEgCiAKKAIAQQFqNgIADAELQX8hAAsgDEEQaiQAIAALtwECAn0DfyMAQRBrIgUkAAJAAkACQCAAIAFHBEBB5LIBKAIAIQdB5LIBQQA2AgAQvQIaIwBBEGsiBiQAIAYgACAFQQxqQQAQmAIgBikDACAGKQMIEPsBIQMgBkEQaiQAQeSyASgCACIARQ0BIAUoAgwgAUcNAiADIQQgAEHEAEcNAwwCCyACQQQ2AgAMAgtB5LIBIAc2AgAgBSgCDCABRg0BCyACQQQ2AgAgBCEDCyAFQRBqJAAgAwvxBAAjAEGQAmsiACQAIAAgAjYCgAIgACABNgKIAiAAQdABaiADIABB4AFqIABB3wFqIABB3gFqELUCIABBwAFqENgBIgEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAjYCvAEgACAAQRBqNgIMIABBADYCCCAAQQE6AAcgAEHFADoABgNAAkAgAEGIAmogAEGAAmoQwwFFDQAgACgCvAECfyABLQALQQd2BEAgASgCBAwBCyABLQALCyACakYEQAJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLIQMgAQJ/IAEtAAtBB3YEQCABKAIEDAELIAEtAAsLQQF0ENsBIAEgAS0AC0EHdgR/IAEoAghB/////wdxQQFrBUEKCxDbASAAIAMCfyABLQALQQd2BEAgASgCAAwBCyABCyICajYCvAELIABBiAJqEMQBIABBB2ogAEEGaiACIABBvAFqIAAsAN8BIAAsAN4BIABB0AFqIABBEGogAEEMaiAAQQhqIABB4AFqELYCDQAgAEGIAmoQxQEaDAELCwJAAn8gAC0A2wFBB3YEQCAAKALUAQwBCyAALQDbAQtFDQAgAC0AB0UNACAAKAIMIgMgAEEQamtBnwFKDQAgACADQQRqNgIMIAMgACgCCDYCAAsgBSACIAAoArwBIAQQuQI5AwAgAEHQAWogAEEQaiAAKAIMIAQQqwIgAEGIAmogAEGAAmoQxgEEQCAEIAQoAgBBAnI2AgALIAAoAogCIQIgARCqBBogAEHQAWoQqgQaIABBkAJqJAAgAgu3AQICfAN/IwBBEGsiBSQAAkACQAJAIAAgAUcEQEHksgEoAgAhB0HksgFBADYCABC9AhojAEEQayIGJAAgBiAAIAVBDGpBARCYAiAGKQMAIAYpAwgQ/AEhAyAGQRBqJABB5LIBKAIAIgBFDQEgBSgCDCABRw0CIAMhBCAAQcQARw0DDAILIAJBBDYCAAwCC0HksgEgBzYCACAFKAIMIAFGDQELIAJBBDYCACAEIQMLIAVBEGokACADC4gFAQF+IwBBoAJrIgAkACAAIAI2ApACIAAgATYCmAIgAEHgAWogAyAAQfABaiAAQe8BaiAAQe4BahC1AiAAQdABahDYASIBIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgAAJ/IAEtAAtBB3YEQCABKAIADAELIAELIgI2AswBIAAgAEEgajYCHCAAQQA2AhggAEEBOgAXIABBxQA6ABYDQAJAIABBmAJqIABBkAJqEMMBRQ0AIAAoAswBAn8gAS0AC0EHdgRAIAEoAgQMAQsgAS0ACwsgAmpGBEACfyABLQALQQd2BEAgASgCBAwBCyABLQALCyEDIAECfyABLQALQQd2BEAgASgCBAwBCyABLQALC0EBdBDbASABIAEtAAtBB3YEfyABKAIIQf////8HcUEBawVBCgsQ2wEgACADAn8gAS0AC0EHdgRAIAEoAgAMAQsgAQsiAmo2AswBCyAAQZgCahDEASAAQRdqIABBFmogAiAAQcwBaiAALADvASAALADuASAAQeABaiAAQSBqIABBHGogAEEYaiAAQfABahC2Ag0AIABBmAJqEMUBGgwBCwsCQAJ/IAAtAOsBQQd2BEAgACgC5AEMAQsgAC0A6wELRQ0AIAAtABdFDQAgACgCHCIDIABBIGprQZ8BSg0AIAAgA0EEajYCHCADIAAoAhg2AgALIAAgAiAAKALMASAEELsCIAApAwAhBiAFIAApAwg3AwggBSAGNwMAIABB4AFqIABBIGogACgCHCAEEKsCIABBmAJqIABBkAJqEMYBBEAgBCAEKAIAQQJyNgIACyAAKAKYAiECIAEQqgQaIABB4AFqEKoEGiAAQaACaiQAIAILsgICBH4FfyMAQSBrIggkAAJAAkACQCABIAJHBEBB5LIBKAIAIQxB5LIBQQA2AgAjAEEQayIJJAAQvQIaIwBBEGsiCiQAIwBBEGsiCyQAIAsgASAIQRxqQQIQmAIgCykDACEEIAogCykDCDcDCCAKIAQ3AwAgC0EQaiQAIAopAwAhBCAJIAopAwg3AwggCSAENwMAIApBEGokACAJKQMAIQQgCCAJKQMINwMQIAggBDcDCCAJQRBqJAAgCCkDECEEIAgpAwghBUHksgEoAgAiAUUNASAIKAIcIAJHDQIgBSEGIAQhByABQcQARw0DDAILIANBBDYCAAwCC0HksgEgDDYCACAIKAIcIAJGDQELIANBBDYCACAGIQUgByEECyAAIAU3AwAgACAENwMIIAhBIGokAAvtBAECfyMAQZACayIAJAAgACACNgKAAiAAIAE2AogCIABB0AFqENgBIQcgAEEQaiIGIAMoAhwiATYCACABIAEoAgRBAWo2AgQgBhDCASIBQcDuAEHa7gAgAEHgAWogASgCACgCIBEHABogBigCACIBIAEoAgRBAWsiAjYCBCACQX9GBEAgASABKAIAKAIIEQEACyAAQcABahDYASICIAItAAtBB3YEfyACKAIIQf////8HcUEBawVBCgsQ2wEgAAJ/IAItAAtBB3YEQCACKAIADAELIAILIgE2ArwBIAAgBjYCDCAAQQA2AggDQAJAIABBiAJqIABBgAJqEMMBRQ0AIAAoArwBAn8gAi0AC0EHdgRAIAIoAgQMAQsgAi0ACwsgAWpGBEACfyACLQALQQd2BEAgAigCBAwBCyACLQALCyEDIAICfyACLQALQQd2BEAgAigCBAwBCyACLQALC0EBdBDbASACIAItAAtBB3YEfyACKAIIQf////8HcUEBawVBCgsQ2wEgACADAn8gAi0AC0EHdgRAIAIoAgAMAQsgAgsiAWo2ArwBCyAAQYgCahDEAUEQIAEgAEG8AWogAEEIakEAIAcgAEEQaiAAQQxqIABB4AFqEKkCDQAgAEGIAmoQxQEaDAELCyACIAAoArwBIAFrENsBAn8gAi0AC0EHdgRA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AWokACAIKAIMIQQjAEEQayIAJAAgACABNgIIA0AgAiAERwRAIABBCGogAigCABDXASACQQRqIQIMAQsLIAAoAgghASAAQRBqJAAgAyQAIAELBQBB/wALCAAgABDYARoLRQEBfyMAQRBrIgIkACMAQRBrIgEkACAAQQE6AAsgAEEBQS0QrAQgAUEAOgAPIAAgAS0ADzoAASABQRBqJAAgAkEQaiQACwwAIABBgoaAIDYAAAsIAEH/////BwsMACAAQQFBLRDyAhoLSAEBfyMAQRBrIgIkAAJAIAEtAAtBB3ZFBEAgACABKAIINgIIIAAgASkCADcCAAwBCyAAIAEoAgAgASgCBBCtBAsgAkEQaiQAC+IEAQJ/IwBBoAJrIgAkACAAIAI2ApACIAAgATYCmAIgAEGYATYCECAAQZgBaiAAQaABaiAAQRBqEKUCIQcgAEGQAWoiCCAEKAIcIgE2AgAgASABKAIEQQFqNgIEIAgQwgEhASAAQQA6AI8BAkAgAEGYAmogAiADIAggBCgCBCAFIABBjwFqIAEgByAAQZQBaiAAQYQCahCYA0UNACAAQeYTKAAANgCHASAAQd8TKQAANwOAASABIABBgAFqIABBigFqIABB9gBqIAEoAgAoAiARBwAaIABBlwE2AhAgAEEIakEAIABBEGoiBBClAiEBAkAgACgClAEgBygCAGtB4wBOBEAgACgClAEgBygCAGtBAmoQogEhAyABKAIAIQIgASADNgIAIAIEQCACIAEoAgQRAQALIAEoAgBFDQEgASgCACEECyAALQCPAQRAIARBLToAACAEQQFqIQQLIAcoAgAhAgNAIAAoApQBIAJNBEACQCAEQQA6AAAgACAGNgIAIABBEGogABCSAkEBRw0AIAEoAgAhAiABQQA2AgAgAgRAIAIgASgCBBEBAAsMBAsFIAQgAEH2AGoiAyADQQpqIAIQvwIgAGsgAGotAAo6AAAgBEEBaiEEIAJBAWohAgwBCwsQ3AEACxDcAQALIABBmAJqIABBkAJqEMYBBEAgBSAFKAIAQQJyNgIACyAAKAKYAiECIAAoApABIgEgASgCBEEBayIDNgIEIANBf0YEQCABIAEoAgAoAggRAQALIAcoAgAhASAHQQA2AgAgAQRAIAEgBygCBBEBAAsgAEGgAmokACACC6YVAQp/IwBBsARrIgskACALIAo2AqQEIAsgATYCqAQCQCAAIAtBqARqEMYBBEAgBSAFKAIAQQRyNgIAQQAhAAwBCyALQZgBNgJoIAsgC0GIAWogC0GQAWogC0HoAGoiARClAiIPKAIAIgo2AoQBIAsgCkGQA2o2AoABIAEQ2AEhESALQdgAahDYASEOIAtByABqENgBIQ0gC0E4ahDYASEMIAtBKGoQ2AEhECMAQRBrIgEkACALAn8gAgRAIAEgAxCdAyICIAIoAgAoAiwRAgAgCyABKAIANgB4IAEgAiACKAIAKAIgEQIAIAwgARDZASABEKoEGiABIAIgAigCACgCHBECACANIAEQ2QEgARCqBBogCyACIAIoAgAoAgwRAAA6AHcgCyACIAIoAgAoAhARAAA6AHYgASACIAIoAgAoAhQRAgAgESABENkBIAEQqgQaIAEgAiACKAIAKAIYEQIAIA4gARDZASABEKoEGiACIAIoAgAoAiQRAAAMAQsgASADEJ4DIgIgAigCACgCLBECACALIAEoAgA2AHggASACIAIoAgAoAiARAgAgDCABENkBIAEQqgQaIAEgAiACKAIAKAIcEQIAIA0gARDZASABEKoEGiALIAIgAigCACgCDBEAADoAdyALIAIgAigCACgCEBEAADoAdiABIAIgAigCACgCFBECACARIAEQ2QEgARCqBBogASACIAIoAgAoAhgRAgAgDiABENkBIAEQqgQaIAIgAigCACgCJBEAAAs2AiQgAUEQaiQAIAkgCCgCADYCACAEQYAEcSISQQl2IRNBACEDQQAhAQNAIAEhAgJAAkACQAJAIANBBEYNACAAIAtBqARqEMMBRQ0AQQAhCgJAAkACQAJAAkACQCALQfgAaiADaiwAAA4FAQAEAwUJCyADQQNGDQcgABDEASIBQQBOBH8gBygCCCABQf8BcUECdGooAgBBAXEFQQALBEAgC0EYaiAAEJkDIBAgCywAGBCvBAwCCyAFIAUoAgBBBHI2AgBBACEADAYLIANBA0YNBgsDQCAAIAtBqARqEMMBRQ0GIAAQxAEiAUEATgR/IAcoAgggAUH/AXFBAnRqKAIAQQFxBUEAC0UNBiALQRhqIAAQmQMgECALLAAYEK8EDAALAAsCQAJ/IA0tAAtBB3YEQCANKAIEDAELIA0tAAsLRQ0AIAAQxAFB/wFxAn8gDS0AC0EH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QQJqEKIBIQMgASgCACECIAEgAzYCACACBEAgAiABKAIEEQEACyABKAIARQ0BIAEoAgAhBAsgAC0AvwEEQCAEQS06AAAgBEEBaiEECyAHKAIAIQIDQCAAKALEASACTQRAAkAgBEEAOgAAIAAgBjYCACAAQRBqIAAQkgJBAUcNACABKAIAIQIgAUEANgIAIAIEQCACIAEoAgQRAQALDAQLBSAEIABBsAFqIABBgAFqIgMgA0EoaiACENICIANrQQJ1ai0AADoAACAEQQFqIQQgAkEEaiECDAELCxDcAQALENwBAAsgAEHoBGogAEHgBGoQ1AEEQCAFIAUoAgBBAnI2AgALIAAoAugEIQIgACgCwAEiASABKAIEQQFrIgM2AgQgA0F/RgRAIAEgASgCACgCCBEBAAsgBygCACEBIAdBADYCACABBEAgASAHKAIEEQEACyAAQfAEaiQAIAILxhcBCn8jAEGwBGsiCyQAIAsgCjYCpAQgCyABNgKoBAJAIAAgC0GoBGoQ1AEEQCAFIAUoAgBBBHI2AgBBACEADAELIAtBmAE2AmAgCyALQYgBaiALQZABaiALQeAAaiIBEKUCIg8oAgAiCjYChAEgCyAKQZADajYCgAEgARDYASERIAtB0ABqENgBIQ4gC0FAaxDYASENIAtBMGoQ2AEhDCALQSBqENgBIRAjAEEQayIBJAAgCwJ/IAIEQCABIAMQpQMiAiACKAIAKAIsEQIAIAsgASgCADYAeCABIAIgAigCACgCIBECACAMIAEQpgMgARCzBBogASACIAIoAgAoAhwRAgAgDSABEKYDIAEQswQaIAsgAiACKAIAKAIMEQAANgJ0IAsgAiACKAIAKAIQEQAANgJwIAEgAiACKAIAKAIUEQIAIBEgARDZASABEKoEGiABIAIgAigCACgCGBECACAOIAEQpgMgARCzBBogAiACKAIAKAIkEQAADAELIAEgAxCnAyICIAIoAgAoAiwRAgAgCyABKAIANgB4IAEgAiACKAIAKAIgEQIAIAwgARCmAyABELMEGiABIAIgAigCACgCHBECACANIAEQpgMgARCzBBogCyACIAIoAgAoAgwRAAA2AnQgCyACIAIoAgAoAhARAAA2AnAgASACIAIoAgAoAhQRAgAgESABENkBIAEQqgQaIAEgAiACKAIAKAIYEQIAIA4gARCm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ADYCACABBEAgASALKAIEEQEACyAIEKoEGiAHEKoEGiAQEKoEGiAAKALYASIBIAEoAgRBAWsiAzYCBCADQX9GBEAgASABKAIAKAIIEQEACyAKKAIAIQEgCkEANgIAIAEEQCABIAooAgQRAQALIA0oAgAhASANQQA2AgAgAQRAIAEgDSgCBBEBAAsgAEHQA2okACACDwsQ3AEAC9EDAQF/IwBBEGsiCiQAIAkCfyAABEAgAhCdAyEAAkAgAQRAIAogACAAKAIAKAIsEQIAIAMgCigCADYAACAKIAAgACgCACgCIBECAAwBCyAKIAAgACgCACgCKBECACADIAooAgA2AAAgCiAAIAAoAgAoAhwRAgALIAggChDZASAKEKoEGiAEIAAgACgCACgCDBEAADoAACAFIAAgACgCACgCEBEAADoAACAKIAAgACgCACgCFBECACAGIAoQ2QEgChCqBBogCiAAIAAoAgAoAhgRAgAgByAKENkBIAoQqgQaIAAgACgCACgCJBEAAAwBCyACEJ4DIQACQCABBEAgCiAAIAAoAgAoAiwRAgAgAyAKKAIANgAAIAogACAAKAIAKAIgEQIADAELIAogACAAKAIAKAIoEQIAIAMgCigCADYAACAKIAAgACgCACgCHBECAAsgCCAKENkBIAoQqgQaIAQgACAAKAIAKAIMEQAAOgAAIAUgACAAKAIAKAIQEQAAOgAAIAogACAAKAIAKAIUEQIAIAYgChDZASAKEKoEGiAKIAAgACgCACgCGBECACAHIAoQ2QEgChCqBBogACAAKAIAKAIkEQAACzYCACAKQRBqJAALzQcBCn8jAEEQayITJAAgAiAANgIAIANBgARxIRYDQCAUQQRGBEACfyANLQALQQd2BEAgDSgCBAwBCyANLQALC0EBSwRAIBMgDRDUAjYCCCACIBNBCGpBARCfAyANENUCIAIoAgAQrAM2AgALIANBsAFxIgNBEEcEQCABIANBIEYEfyACKAIABSAACzYCAAsgE0EQaiQADwsCQAJAAkACQAJAAkAgCCAUaiwAAA4FAAEDAgQFCyABIAIoAgA2AgAMBAsgASACKAIANgIAIAZBICAGKAIAKAIcEQMAIQ8gAiACKAIAIhBBAWo2AgAgECAPOgAADAMLAn8gDS0AC0EHdgRAIA0oAgQMAQsgDS0ACwtFDQICfyAN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AEkhCyABQRBqJAAgCSAFIAsbKAIAIQELIARBEGokACABDAELEDMACyEEIAAoAgQgACgCAGtBAnUhCUEAIQEjAEEQayIFJAAgBUEANgIMIANBADYCDCADIAg2AhAgBARAIAMoAhAgBBCaBCEBCyADIAE2AgAgAyABIAlBAnRqIgg2AgggAyAINgIEIAMgASAEQQJ0ajYCDCAFQRBqJAAjAEEQayIBJAAgASADKAIINgIAIAMoAgghBCABIANBCGo2AgggASAEIAdBAnRqNgIEIAEoAgAhBANAIAEoAgQgBEcEQCADKAIQGiABKAIAQQA2AgAgASABKAIAQQRqIgQ2AgAMAQsLIAEoAgggASgCADYCACABQRBqJAAgACgCACIEIgEgACgCCCABa0ECdUECdGoaIAMgAygCBCAAKAIEIARrIgFrIgc2AgQgAUEASgRAIAcgBCABEJwBGgsgACgCACEBIAAgAygCBDYCACADIAE2AgQgACgCBCEBIAAgAygCCDYCBCADIAE2AgggACgCCCEBIAAgAygCDDYCCCADIAE2AgwgAyADKAIENgIAIAAoAgQgACgCAGsaIAAoAgAiASAAKAIIIAFrQQJ1QQJ0ahogAygCBCEBA0AgASADKAIIRwRAIAMoAhAaIAMgAygCCEEEazYCCAwBCwsgAygCAARAIAMoAhAgAygCACIBIAMoAgwgAWtBAnUQuwMLCyAKQSBqJAAMAQsgASADSQRAIAAoAgQgACgCACIDaxogACABQQJ0IANqEJwEIAAoAgAiASAAKAIIIAFrQQJ1QQJ0ahogACgCBBoLCwsgACgCACACQQJ0aigCAARAIAAoAgAgAkECdGooAgAiASABKAIEQQFrIgM2AgQgA0F/RgRAIAEgASgCACgCCBEBAAsLIAYoAgghASAGQQA2AgggACgCACACQQJ0aiABNgIAIAYoAgghACAGQQA2AgggAARAIAAgACgCBEEBayIBNgIEIAFBf0YEQCAAIAAoAgAoAggRAQALCyAGQRBqJAALxAEBBH8gAEG48AA2AgAgAEEIaiEBA0AgAiABKAIEIAEoAgBrQQJ1SQRAIAEoAgAgAkECdGooAgAEQCABKAIAIAJBAnRqKAIAIgMgAygCBEEBayIENgIEIARBf0YEQCADIAMoAgAoAggRAQALCyACQQFqIQIMAQsLIABB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CwkAIAFBBBDeAQtfAQR/IwBBEGsiACQAIABB/////wM2AgwgAEH/////BzYCCCMAQRBrIgEkACAAQQhqIgIoAgAgAEEMaiIDKAIASSEEIAFBEGokACACIAMgBBsoAgAhASAAQRBqJAAgAQs/AQF/IwBBEGsiAiQAAkACQCABQR5LDQAgAC0AeA0AIABBAToAeAwBCyACQQhqIAEQmwQhAAsgAkEQaiQAIAALHAAgAUH/////A0sEQBCEAQALIAFBAnRBBBDiAQsmAQF/IAAoAgQhAgNAIAEgAkcEQCACQQRrIQIMAQsLIAAgATYCBAsKACAAEL0CNgIACwcAIAAoAgQLCQAgACABEJsEC0YBAX8jAEEQayIDJAACQCAALQALQQd2BEAgACACNgIEDAELIAAgAjoACwsgA0EAOgAPIAEgAmogAy0ADzoAACADQRBqJAALFgAgACABIAJCgICAgICAgICAfxCXAgsNACAAIAEgAkJ/EJcCCzcBAX8CQCAAQQhqIgEoAgAEQCABIAEoAgBBAWsiATYCACABQX9HDQELIAAgACgCACgCEBEBAAsLNAEBfyAAQQEgABshAAJAA0AgABCiASIBDQFB6NABKAIAIgEEQCABEQwADAELCxARAAsgAQs6AQJ/IAEQoAEiAkENahCkBCIDQQA2AgggAyACNgIEIAMgAjYCACAAIANBDGogASACQQFqEJwBNgIACzEAIAFBCU0EQCAAIAFBMGo6AAAgAEEBag8LIAAgAUEBdEGQpQFqLwEAOwAAIABBAmoLPwEBfyAAIAFB5ABuIgJBAXRBkKUBai8BADsAACAAQQJqIgAgASACQeQAbGtBAXRBkKUBai8BADsAACAAQQJqC1kBAX8gAUHjAE0EQCAAIAEQpgQPCyABQecHTQRAIAAgAUHkAG4iAkEwajoAACAAQQFqIgAgASACQeQAbGtBAXRBkKUBai8BADsAACAAQQJqDwsgACABEKcEC9sCAQV/IwBBEGsiCCQAIAIgAUF/c0ERa00EQAJ/IAAtAAtBB3YEQCAAKAIADAELIAALIQkgAAJ/IAFB5////wdJBEAgCCABQQF0NgIIIAggASACajYCDCMAQRBrIgIkACAIQQxqIgooAgAgCEEIaiILKAIASSEMIAJBEGokACALIAogDBsoAgAiAkELTwR/IAJBEGpBcHEiAiACQQFrIgIgAkELRhsFQQoLDAELQW4LQQFqIgoQ4QEhAiAEBEAgAiAJIAQQtwELIAYEQCACIARqIAcgBhC3AQsgAyAEIAVqIgtrIQcgAyALRwRAIAIgBGogBmogBCAJaiAFaiAHELcBCyABQQFqIgFBC0cEQCAAIAkgARDdAQsgACACNgIAIAAgCkGAgICAeHI2AgggACAEIAZqIAdqIgA2AgQgCEEAOgAHIAAgAmogCC0ABzoAACAIQRBqJAAPCxB1AAslACAALQALQQd2BEAgACAAKAIAIAAoAghB/////wdxEN0BCyAAC5UCAQV/IwBBEGsiBSQAIAJBbyABa00EQAJ/IAAtAAtBB3YEQCAAKAIADAELIAALIQYgAAJ/IAFB5////wdJBEAgBSABQQF0NgIIIAUgASACajYCDCMAQRBrIgIkACAFQQxqIgcoAgAgBUEIaiIIKAIASSEJIAJBEGokACAIIAcgCRsoAgAiAkELTwR/IAJBEGpBcHEiAiACQQFrIgIgAkELRhsFQQoLDAELQW4LQQFqIgcQ4QEhAiAEBEAgAiAGIAQQtwELIAMgBEcEQCACIARqIAQgBmogAyAEaxC3AQsgAUEBaiIBQQtHBEAgACAGIAEQ3QELIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEHUACxUAIAEEQCAAIAJB/wFxIAEQngEaCwt8AQJ/AkACQCACQQtJBEAgACIDIAI6AAsMAQsgAkFvSw0BIAAgACACQQtPBH8gAkEQakFwcSIDIANBAWsiAyADQQtGGwVBCgtBAWoiBBDhASIDNgIAIAAgBEGAgICAeHI2AgggACACNgIECyADIAEgAkEBahC3AQ8LEHUAC9cBAQN/IwBBEGsiBSQAAkAgAiAALQALQQd2BH8gACgCCEH/////B3FBAWsFQQoLIgQCfyAALQALQQd2BEAgACgCBAwBCyAALQALCyIDa00EQCACRQ0BAn8gAC0AC0EHdgRAIAAoAgAMAQsgAAsiBCADaiABIAIQtwEgAiADaiEBAkAgAC0AC0EHdgRAIAAgATYCBAwBCyAAIAE6AAsLIAVBADoADyABIARqIAUtAA86AAAMAQsgACAEIAIgA2ogBGsgAyADQQAgAiABEKkECyAFQRBqJAAgAAurAQECfyMAQRBrIgMkACADIAE6AA8CQAJAAkAgAC0AC0EHdkUEQEEKIQIgAC0ACyIBQQpGDQEgACICIAFBAWo6AAsMAwsgACgCBCIBIAAoAghB/////wdxQQFrIgJHDQELIAAgAkEBIAIgAhCrBCACIQELIAAoAgAhAiAAIAFBAWo2AgQLIAEgAmoiACADLQAPOgAAIANBADoADiAAIAMtAA46AAEgA0EQaiQAC40CAQR/IwBBEGsiAyQAIAMgAjYCCCADQX82AgwCQAJ/IAAtAAtBB3YEQCAAKAIEDAELIAAtAAsLIgRBAEkNACACQX9GDQAgAyAENgIAIwBBEGsiAiQAIAMoAgAgA0EMaiIEKAIASSEFIAJBEGokACADIAMgBCAFGygCADYCBAJAAn8CfyAALQALQQd2BEAgACgCAAwBCyAACyEAIwBBEGsiAiQAIANBCGoiBCgCACADQQRqIgUoAgBJIQYgAkEQaiQAQQAgBCAFIAYbKAIAIgJFDQAaIAAgASACEJ8BCyIADQBBfyEAIAMoAgQiASADKAIIIgJJDQAgASACSyEACyADQRBqJAAgAA8LENwBAAuPAgEEfyABAn8gAC0AC0EHdgRAIAAoAgQMAQsgAC0ACwsiAksEQCMAQRBrIgQkACABIAJrIgUEQCAALQALQQd2BH8gACgCCEH/////B3FBAWsFQQoLIQMCfyAALQALQQd2BEAgACgCBAwBCyAALQALCyICIAVqIQEgBSADIAJrSwRAIAAgAyABIANrIAIgAhCrBAsgAgJ/IAAtAAtBB3YEQCAAKAIADAELIAALIgNqIAVBABCsBAJAIAAtAAtBB3YEQCAAIAE2AgQMAQsgACABOgALCyAEQQA6AA8gASADaiAELQAPOgAACyAEQRBqJAAPCyAAAn8gAC0AC0EHdgRAIAAoAgAMAQsgAAsgARCgBAv0AgEFfyMAQRBrIggkACACIAFBf3NB7////wNqTQRAAn8gAC0AC0EHdgRAIAAoAgAMAQsgAAshCSAAAn8gAUHn////AUkEQCAIIAFBAXQ2AgggCCABIAJqNgIMIwBBEGsiAiQAIAhBDGoiCigCACAIQQhqIgsoAgBJIQwgAkEQaiQAIAsgCiAMGygCACICQQJPBH8gAkEEakF8cSICIAJBAWsiAiACQQJGGwVBAQsMAQtB7v///wMLQQFqIgoQnwQhAiAEBEAgAiAJIAQQ0AELIAYEQCAEQQJ0IAJqIAcgBhDQAQsgAyAEIAVqIgtrIQcgAyALRwRAIARBAnQiAyACaiAGQQJ0aiADIAlqIAVBAnRqIAcQ0AELIAFBAWoiAUECRwRAIAAgCSABEJcECyAAIAI2AgAgACAKQYCAgIB4cjYCCCAAIAQgBmogB2oiADYCBCAIQQA2AgQgAiAAQQJ0aiAIKAIENgIAIAhBEGokAA8LEHUACyUAIAAtAAtBB3YEQCAAIAAoAgAgACgCCEH/////B3EQlwQLIAALogIBBX8jAEEQayIFJAAgAkHv////AyABa00EQAJ/IAAtAAtBB3YEQCAAKAIADAELIAALIQYgAAJ/IAFB5////wFJBEAgBSABQQF0NgIIIAUgASACajYCDCMAQRBrIgIkACAFQQxqIgcoAgAgBUEIaiIIKAIASSEJIAJBEGokACAIIAcgCRsoAgAiAkECTwR/IAJBBGpBfHEiAiACQQFrIgIgAkECRhsFQQELDAELQe7///8DC0EBaiIHEJ8EIQIgBARAIAIgBiAEENABCyADIARHBEAgBEECdCIIIAJqIAYgCGogAyAEaxDQAQsgAUEBaiIBQQJHBEAgACAGIAEQlwQLIAAgAjYCACAAIAdBgICAgHhyNgIIIAVBEGokAA8LEHUAC64BAQJ/IwBBEGsiAyQAIAMgATYCDAJAAkACQCAALQALQQd2RQRAQQEhAiAALQALIgFBAUYNASAAIgIgAUEBajoACwwDCyAAKAIEIgEgACgCCEH/////B3FBAWsiAkcNAQsgACACQQEgAiACELQEIAIhAQsgACgCACECIAAgAUEBajYCBAsgAiABQQJ0aiIAIAMoAgw2AgAgA0EANgIIIAAgAygCCDYCBCADQRBqJAALnQIBCH8jAEEgayIFJAAgBUEIaiECAkAgBUEVaiIHIgMgBUEgaiIGRg0AIAFBAE4NACADQS06AAAgA0EBaiEDQQAgAWshAQsgASEEIAIiAQJ/IAYiAiADayIIQQlMBEBBPSAIQSAgBEEBcmdrQdEJbEEMdSIJIAlBAnRB4KYBaigCACAETWpIDQEaCwJ/IARB/8HXL00EQAJ/IARBj84ATQRAIAMgBBCoBAwBCyADIARBkM4AbiICEKgEIAQgAkGQzgBsaxCnBAsMAQsgAyAEQYDC1y9uIgIQpgQgBCACQYDC1y9sayIDQZDOAG4iAhCnBCADIAJBkM4AbGsQpwQLIQJBAAs2AgQgASACNgIAIAAgByAFKAIIEJsCIAYkAAsLACAAIAFBABC4BAstACACRQRAIAAoAgQgASgCBEYPCyAAIAFGBEBBAQ8LIAAoAgQgASgCBBCCAkULogEBAn8jAEFAaiIDJAACf0EBIAAgAUEAELgEDQAaQQAgAUUNABpBACABQdynARC6BCIBRQ0AGiADQQhqIgRBBHJBAEE0EJ4BGiADQQE2AjggA0F/NgIUIAMgADYCECADIAE2AgggASAEIAIoAgBBASABKAIAKAIcEQkAIAMoAiAiAEEBRgRAIAIgAygCGDYCAAsgAEEBRgshACADQUBrJAAgAAu7AgEDfyMAQUBqIgIkACAAKAIAIgNBBGsoAgAhBCADQQhrKAIAIQMgAkIANwMgIAJCADcDKCACQgA3AzAgAkIANwA3IAJCADcDGCACQQA2AhQgAkGspwE2AhAgAiAANgIMIAIgATYCCCAAIANqIQBBACEDAkAgBCABQQAQuAQEQCACQQE2AjggBCACQQhqIAAgAEEBQQAgBCgCACgCFBELACAAQQAgAigCIEEBRhshAwwBCyAEIAJBCGogAEEBQQAgBCgCACgCGBEKAAJAAkAgAigCLA4CAAECCyACKAIcQQAgAigCKEEBRhtBACACKAIkQQFGG0EAIAIoAjBBAUYbIQMMAQsgAigCIEEBRwRAIAIoAjANASACKAIkQQFHDQEgAigCKEEBRw0BCyACKAIYIQMLIAJBQGskACADC10BAX8gACgCECIDRQRAIABBATYCJCAAIAI2AhggACABNgIQDwsCQCABIANGBEAgACgCGEECRw0BIAAgAjYCGA8LIABBAToANiAAQQI2AhggACAAKAIkQQFqNgIkCwsaACAAIAEoAghBABC4BARAIAEgAiADELsECwszACAAIAEoAghBABC4BARAIAEgAiADELsEDwsgACgCCCIAIAEgAiADIAAoAgAoAhwRCQALUgEBfyAAKAIEIQQgACgCACIAIAECf0EAIAJFDQAaIARBCHUiASAEQQFxRQ0AGiABIAIoAgBqKAIACyACaiADQQIgBEECcRsgACgCACgCHBEJAAtsAQJ/IAAgASgCCEEAELgEBEAgASACIAMQuwQPCyAAKAIMIQQgAEEQaiIF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IG9mZnNldCA9PSAtMSBpcyBub3Qgc3VwcG9ydGVkIGF0IHRoaXMgdGltZQBkb3VibGUAdm9pZABsYXN6aXAgZW5jb2RlZABXZWQAc3RkOjpiYWRfYWxsb2MATEFTRl9TcGVjAERlYwBGZWIAQ291bGRuJ3Qgb3BlbiBtZW1fZmlsZSBhcyBMQVMvTEFaACVhICViICVkICVIOiVNOiVTICVZAFBPU0lYACVIOiVNOiVTAENvdWxkbid0IGZpbmQgTEFTWklQIFZMUgBOQU4AUE0AQU0ATENfQUxMAExBTkcATEFTRgBJTkYAQwBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaG9ydD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgc2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgaW50PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxmbG9hdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDhfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGNoYXI+AHN0ZDo6YmFzaWNfc3RyaW5nPHVuc2lnbmVkIGNoYXI+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHNpZ25lZCBjaGFyPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxkb3VibGU+ADAxMjM0NTY3ODkAQy5VVEYtOABJbnZhbGlkIExBUyBmaWxlLiBJbmNvcnJlY3QgbWFnaWMgbnVtYmVyLgBIZWFkZXIgYml0cyBpbmRpY2F0ZSB1bnN1cHBvcnRlZCBvbGQtc3R5bGUgY29tcHJlc3Npb24uAEJhZCBjaHVuayB0YWJsZS4gSW52YWxpZCB2ZXJzaW9uLgBVbmV4cGVjdGVkIGVuZCBvZiBmaWxlLgBNaXNzaW5nIGNodW5rIHRhYmxlLgBFcnJvciByZWFkaW5nIGNodW5rIHRhYmxlLgBDb3VsZG4ndCByZWFkIGNodW5rIHRhYmxlLgBIZWFkZXIgaW5kaWNhdGVzIHRoZSBmaWxlIGlzIG5vdCBjb21wcmVzc2VkLgAobnVsbCkAUHVyZSB2aXJ0dWFsIGZ1bmN0aW9uIGNhbGxlZCEATWlzbWF0Y2ggYmV0d2VlbiBwb2ludCBmb3JtYXQgb2YgACBhbmQgY29tcHJlc3NvciB2ZXJzaW9uIG9mIAA2TEFTWmlwAAAAANBVAABpCwAAUDZMQVNaaXAAAAAAsFYAAHwLAAAAAAAAdAsAAFBLNkxBU1ppcAAAALBWAACYCwAAAQAAAHQLAABpaQB2AHZpAIgLAAAMVQAAiAsAAHhVAACQVQAAdmlpaWkAAAAAAAAAgAwAABYAAAAXAAAAGAAAABkAAAAaAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjZyZWFkZXI4bWVtX2ZpbGVFTlNfMTBzaGFyZWRfcHRySVMzX0UyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTM19TM19FRU5TXzlhbGxvY2F0b3JJUzNfRUVFRQAAAAD4VQAA9AsAAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjZyZWFkZXI4bWVtX2ZpbGVFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMzX1MzX0VFAAAAeFUAAKQLAABpaWkADFUAAIgLAABsVQAAdmlpaQAxMkNodW5rRGVjb2RlcgDQVQAAAQ0AAFAxMkNodW5rRGVjb2RlcgCwVgAAGA0AAAAAAAAQDQAAUEsxMkNodW5rRGVjb2RlcgAAAACwVgAAOA0AAAEAAAAQDQAAKA0AAAxVAAAoDQAAbFUAAGxVAAB4VQAAdmlpaWlpAAAAAAAALA4AABYAAAAbAAAAHAAAAB0AAAAeAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjZyZWFkZXIxOGNodW5rX2RlY29tcHJlc3NvckVOU18xMHNoYXJlZF9wdHJJUzNfRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMzX1MzX0VFTlNfOWFsbG9jYXRvcklTM19FRUVFAPhVAACYDQAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmNnJlYWRlcjE4Y2h1bmtfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTM19TM19FRQAAAAAMVQAAKA0AAHhVAAB3AQAAFAAAABwAAAAaAAAAIgBBxB0LzgMeAAAAJAAAACYAAADs////5P///+b////e////7P///+z////i////3P///9r///8AAAAAwA8AACEAAAAiAAAAIwAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAAE5TdDNfXzIxMF9fZnVuY3Rpb242X19mdW5jSU5TXzZfX2JpbmRJTU43bGF6cGVyZjEySW5GaWxlU3RyZWFtN1ByaXZhdGVFRnZQaG1FSlBTNV9SS05TXzEycGxhY2Vob2xkZXJzNF9fcGhJTGkxRUVFUktOU0JfSUxpMkVFRUVFRU5TXzlhbGxvY2F0b3JJU0lfRUVGdlM2X21FRUUAAAD4VQAAIA8AAOgfAABOU3QzX18yNl9fYmluZElNTjdsYXpwZXJmMTJJbkZpbGVTdHJlYW03UHJpdmF0ZUVGdlBobUVKUFMzX1JLTlNfMTJwbGFjZWhvbGRlcnM0X19waElMaTFFRUVSS05TOV9JTGkyRUVFRUVFAE5TdDNfXzIxOF9fd2Vha19yZXN1bHRfdHlwZUlNTjdsYXpwZXJmMTJJbkZpbGVTdHJlYW03UHJpdmF0ZUVGdlBobUVFRQAAAADQVQAANxAAAPhVAADMDwAAgBAAQaAhC6IrDw4NDAsKCQgOAAEDBgoKCQ0BAgQHCwsKDAMEBQgMDAsLBgcICQ0NDAoKCwwNDg4NCQoLDA0ODw4ICQoLDA0ODwABAgMEBQYHAQABAgMEBQYCAQABAgMEBQMCAQABAgMEBAMCAQABAgMFBAMCAQABAgYFBAMCAQABBwYFBAMCAQAAAQIDBAUDBAQFBQUFBQUFAQABAwMDAwMDAwMDAwMDAwIBAgQEBAQEBAQEAwMDAwMDAwQFBAQEBAQEBAQEBAQEBAMEBAUEBAQEBAQEBAQEBAUDBAQEBQQEBAQEBAQEBAQDAwQEBAQFBAQEBAQEBAQEBAMEBAQEBAUEBAQEBAQEBAQDBAQEBAQEBQQEBAQEBAQFAwQEBAQEBAQFBAQEBAQEBQMEBAQEBAQEBAUEBAQEBAUDAwQEBAQEBAQEBQUEBAQFAwMEBAQEBAQEBAUFBQQEBQMDBAQEBAQEBAQEBQUFBAUDAwQEBAQEBAQEBAQFBQUFAwMEBAQEBAQEBAQEBAUFAAECAwQFBgcHBwcHBwcHBwEAAQIDBAUGBwcHBwcHBwcCAQABAgMEBQYHBwcHBwcHAwIBAAECAwQFBgcHBwcHBwQDAgEAAQIDBAUGBwcHBwcFBAMCAQABAgMEBQYHBwcHBgUEAwIBAAECAwQFBgcHBwcGBQQDAgEAAQIDBAUGBwcHBwYFBAMCAQABAgMEBQYHBwcHBgUEAwIBAAECAwQFBgcHBwcGBQQDAgEAAQIDBAUHBwcHBwYFBAMCAQABAgMEBwcHBwcHBgUEAwIBAAECAwcHBwcHBwcGBQQDAgEAAQIHBwcHBwcHBwYFBAMCAQABBwcHBwcHBwcHBgUEAwIBAAAAAAAkFAAAKgAAACsAAAAsAAAAAAAAAFQUAAAtAAAAKwAAAC4AAAAAAAAAhBQAAC8AAAArAAAAMAAAAAAAAAC0FAAAMQAAACsAAAAyAAAAAAAAAOQUAAAzAAAAKwAAADQAAAAAAAAAPBUAACoAAAA1AAAANgAAAAAAAABIFQAANwAAADgAAAA5AAAAAAAAAHgVAAA6AAAAOwAAADwAAAAAAAAAqBUAAD0AAAA+AAAAPwAAAE43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckUAAAAA0FUAANQTAABON2xhenBlcmYyN3BvaW50X2RlY29tcHJlc3Nvcl9iYXNlXzFfMkUA+FUAAPwTAAD0EwAATjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfMEUAAAAA+FUAADAUAAAkFAAATjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfMUUAAAAA+FUAAGAUAAAkFAAATjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfMkUAAAAA+FUAAJAUAAAkFAAATjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfM0UAAAAA+FUAAMAUAAAkFAAATjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfNkUATjdsYXpwZXJmMjdwb2ludF9kZWNvbXByZXNzb3JfYmFzZV8xXzRFAAAAAPhVAAARFQAA9BMAAPhVAADwFAAAPBUAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzdFAAAAAPhVAABUFQAAPBUAAE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzhFAAAAAPhVAACEFQAAPBUAAAAAAAB0FgAAFgAAAEAAAABBAAAAQgAAAEMAAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQTjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfMEVOU18xMHNoYXJlZF9wdHJJTlMxXzE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzVfUzJfRUVOU185YWxsb2NhdG9ySVMyX0VFRUUAAPhVAADQFQAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTMl9OUzFfMjBwb2ludF9kZWNvbXByZXNzb3JfMEVFRQAAAAAAsBcAABYAAABEAAAARQAAAEYAAABHAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzFFTlNfMTBzaGFyZWRfcHRySU5TMV8xNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVM1X1MyX0VFTlNfOWFsbG9jYXRvcklTMl9FRUVFAAD4VQAADBcAAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzJfTlMxXzIwcG9pbnRfZGVjb21wcmVzc29yXzFFRUUAAAAAAOwYAAAWAAAASAAAAEkAAABKAAAASwAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl8yRU5TXzEwc2hhcmVkX3B0cklOUzFfMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTNV9TMl9FRU5TXzlhbGxvY2F0b3JJUzJfRUVFRQAA+FUAAEgYAAB4UgAATlN0M19fMjEwc2hhcmVkX3B0cklON2xhenBlcmYxNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMyX05TMV8yMHBvaW50X2RlY29tcHJlc3Nvcl8yRUVFAAAAAAAoGgAAFgAAAEwAAABNAAAATgAAAE8AAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQTjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfM0VOU18xMHNoYXJlZF9wdHJJTlMxXzE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzVfUzJfRUVOU185YWxsb2NhdG9ySVMyX0VFRUUAAPhVAACEGQAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTMl9OUzFfMjBwb2ludF9kZWNvbXByZXNzb3JfM0VFRQAAAAAAZBsAABYAAABQAAAAUQAAAFIAAABTAAAATlN0M19fMjIwX19zaGFyZWRfcHRyX3BvaW50ZXJJUE43bGF6cGVyZjIwcG9pbnRfZGVjb21wcmVzc29yXzZFTlNfMTBzaGFyZWRfcHRySU5TMV8xNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVM1X1MyX0VFTlNfOWFsbG9jYXRvcklTMl9FRUVFAAD4VQAAwBoAAHhSAABOU3QzX18yMTBzaGFyZWRfcHRySU43bGF6cGVyZjE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzJfTlMxXzIwcG9pbnRfZGVjb21wcmVzc29yXzZFRUUAAAAAAKAcAAAWAAAAVAAAAFUAAABWAAAAVwAAAE5TdDNfXzIyMF9fc2hhcmVkX3B0cl9wb2ludGVySVBON2xhenBlcmYyMHBvaW50X2RlY29tcHJlc3Nvcl83RU5TXzEwc2hhcmVkX3B0cklOUzFfMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTNV9TMl9FRU5TXzlhbGxvY2F0b3JJUzJfRUVFRQAA+FUAAPwbAAB4UgAATlN0M19fMjEwc2hhcmVkX3B0cklON2xhenBlcmYxNmxhc19kZWNvbXByZXNzb3JFRTI3X19zaGFyZWRfcHRyX2RlZmF1bHRfZGVsZXRlSVMyX05TMV8yMHBvaW50X2RlY29tcHJlc3Nvcl83RUVFAAAAAADcHQAAFgAAAFgAAABZAAAAWgAAAFsAAABOU3QzX18yMjBfX3NoYXJlZF9wdHJfcG9pbnRlcklQTjdsYXpwZXJmMjBwb2ludF9kZWNvbXByZXNzb3JfOEVOU18xMHNoYXJlZF9wdHJJTlMxXzE2bGFzX2RlY29tcHJlc3NvckVFMjdfX3NoYXJlZF9wdHJfZGVmYXVsdF9kZWxldGVJUzVfUzJfRUVOU185YWxsb2NhdG9ySVMyX0VFRUUAAPhVAAA4HQAAeFIAAE5TdDNfXzIxMHNoYXJlZF9wdHJJTjdsYXpwZXJmMTZsYXNfZGVjb21wcmVzc29yRUUyN19fc2hhcmVkX3B0cl9kZWZhdWx0X2RlbGV0ZUlTMl9OUzFfMjBwb2ludF9kZWNvbXByZXNzb3JfOEVFRQAAAAAArB4AAFwAAABdAAAAXgAAAF8AAABgAAAAYQAAAGIAAABjAAAAZAAAAGUAAABmAAAAZwAAAGgAAABpAAAATjdsYXpwZXJmN2NoYXJidWZFAAD4VQAAmB4AAMglAABON2xhenBlcmY1ZXJyb3JFAAAAAPhVAAC4HgAA6FcAAAAAAADMHgAAIAAAAG4AAABvAAAAAAAAAPAfAAAhAAAAcAAAAHEAAAByAAAAcwAAAHQAAAB1AAAAdgAAAHcAAABOU3QzX18yMTBfX2Z1bmN0aW9uNl9fZnVuY0lOU182X19iaW5kSU1ON2xhenBlcmY2cmVhZGVyMThjaHVua19kZWNvbXByZXNzb3I3UHJpdmF0ZUVGdlBoaUVKUFM2X1JLTlNfMTJwbGFjZWhvbGRlcnM0X19waElMaTFFRUVSS05TQ19JTGkyRUVFRUVFTlNfOWFsbG9jYXRvcklTSl9FRUZ2UzdfbUVFRQBOU3QzX18yMTBfX2Z1bmN0aW9uNl9fYmFzZUlGdlBobUVFRQAA0FUAAMMfAAD4VQAAGB8AAOgfAABOU3QzX18yNl9fYmluZElNTjdsYXpwZXJmNnJlYWRlcjE4Y2h1bmtfZGVjb21wcmVzc29yN1ByaXZhdGVFRnZQaGlFSlBTNF9SS05TXzEycGxhY2Vob2xkZXJzNF9fcGhJTGkxRUVFUktOU0FfSUxpMkVFRUVFRQBOU3QzX18yMThfX3dlYWtfcmVzdWx0X3R5cGVJTU43bGF6cGVyZjZyZWFkZXIxOGNodW5rX2RlY29tcHJlc3NvcjdQcml2YXRlRUZ2UGhpRUVFAADQVQAAdCAAAPhVAAD8HwAAyCAAAAAAAABAIQAAeAAAAHkAAAB6AAAAewAAAHwAAAAAAAAAYCEAAH0AAAB+AAAAfwAAAIAAAACBAAAATjdsYXpwZXJmM3ZsckUAANBVAAAUIQAATjdsYXpwZXJmN2xhel92bHJFAAD4VQAALCEAACQhAABON2xhenBlcmY2ZWJfdmxyRQAAAPhVAABMIQAAJCEAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0ljTlNfMTFjaGFyX3RyYWl0c0ljRUVOU185YWxsb2NhdG9ySWNFRUVFAADQVQAAbCEAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0loTlNfMTFjaGFyX3RyYWl0c0loRUVOU185YWxsb2NhdG9ySWhFRUVFAADQVQAAtCEAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0l3TlNfMTFjaGFyX3RyYWl0c0l3RUVOU185YWxsb2NhdG9ySXdFRUVFAADQVQAA/CEAAE5TdDNfXzIxMmJhc2ljX3N0cmluZ0lEc05TXzExY2hhcl90cmFpdHNJRHNFRU5TXzlhbGxvY2F0b3JJRHNFRUVFAAAA0FUAAEQiAABOU3QzX18yMTJiYXNpY19zdHJpbmdJRGlOU18xMWNoYXJfdHJhaXRzSURpRUVOU185YWxsb2NhdG9ySURpRUVFRQAAANBVAACQIgAATjEwZW1zY3JpcHRlbjN2YWxFAADQVQAA3CIAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQAA0FUAAPgiAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lhRUUAANBVAAAgIwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaEVFAADQVQAASCMAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQAA0FUAAHAjAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0l0RUUAANBVAACYIwAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJaUVFAADQVQAAwCMAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQAA0FUAAOgjAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lsRUUAANBVAAAQJAAATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbUVFAADQVQAAOCQAAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWZFRQAA0FUAAGAkAABOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAANBVAACIJAAAAAAAAOAkAABqAAAAgwAAAIQAAABOU3QzX18yMTdiYWRfZnVuY3Rpb25fY2FsbEUA+FUAAMQkAAAQVwAAAAAAAMglAABcAAAAhQAAAF4AAABfAAAAhgAAAIcAAABiAAAAYwAAAGQAAABlAAAAZgAAAGcAAABoAAAAaQAAAAgAAAAAAAAAACYAAIgAAACJAAAA+P////j///8AJgAAigAAAIsAAAA4JQAATCUAAE5TdDNfXzI5YmFzaWNfaW9zSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAAAA+FUAAFwlAAA8JgAATlN0M19fMjE1YmFzaWNfc3RyZWFtYnVmSWNOU18xMWNoYXJfdHJhaXRzSWNFRUVFAAAAANBVAACUJQAATlN0M19fMjEzYmFzaWNfaXN0cmVhbUljTlNfMTFjaGFyX3RyYWl0c0ljRUVFRQAAVFYAANAlAAAAAAAAAQAAAIglAAAD9P//AAAAADwmAACMAAAAjQAAAE5TdDNfXzI4aW9zX2Jhc2VFAAAA0FUAACgmAEHQzAAL0wTRdJ4AV529KoBwUg///z4nCgAAAGQAAADoAwAAECcAAKCGAQBAQg8AgJaYAADh9QUYAAAANQAAAHEAAABr////zvv//5K///8AAAAAAAAAAP////////////////////////////////////////////////////////////////8AAQIDBAUGBwgJ/////////woLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIj////////CgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiP/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AAECBAcDBgUAAAAAAAAAAgAAwAMAAMAEAADABQAAwAYAAMAHAADACAAAwAkAAMAKAADACwAAwAwAAMANAADADgAAwA8AAMAQAADAEQAAwBIAAMATAADAFAAAwBUAAMAWAADAFwAAwBgAAMAZAADAGgAAwBsAAMAcAADAHQAAwB4AAMAfAADAAAAAswEAAMMCAADDAwAAwwQAAMMFAADDBgAAwwcAAMMIAADDCQAAwwoAAMMLAADDDAAAww0AANMOAADDDwAAwwAADLsBAAzDAgAMwwMADMMEAAzbAAAAAN4SBJUAAAAA////////////////gCgAABQAAABDLlVURi04AEHQ0QALApQoAEHw0QALR0xDX0NUWVBFAAAAAExDX05VTUVSSUMAAExDX1RJTUUAAAAAAExDX0NPTExBVEUAAExDX01PTkVUQVJZAExDX01FU1NBR0VTAEHA0gALQRkACgAZGRkAAAAABQAAAAAAAAkAAAAACwAAAAAAAAAAGQARChkZGQMKBwABAAkLGAAACQYLAAALAAYZAAAAGRkZAEGR0wALIQ4AAAAAAAAAABkACg0ZGRkADQAAAgAJDgAAAAkADgAADgBBy9MACwEMAEHX0wALFRMAAAAAEwAAAAAJDAAAAAAADAAADABBhdQACwEQAEGR1AALFQ8AAAAEDwAAAAAJEAAAAAAAEAAAEABBv9QACwESAEHL1AALHhEAAAAAEQAAAAAJ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AABOU3QzX18yMTBtb25leXB1bmN0SWNMYjFFRUUAVFYAAOBJAAAAAAAAAgAAACQ+AAACAAAAgEkAAAIAAAAAAAAAcEoAAM0AAAByAQAAqwAAAHMBAAB0AQAAdQEAAHYBAAB3AQAAeAEAAHkBAAB6AQAAewEAAE5TdDNfXzIxMG1vbmV5cHVuY3RJd0xiMEVFRQBUVgAAVEoAAAAAAAACAAAAJD4AAAIAAACASQAAAgAAAAAAAADkSgAAzQAAAHwBAACrAAAAfQEAAH4BAAB/AQAAgAEAAIEBAACCAQAAgwEAAIQBAACFAQAATlN0M19fMjEwbW9uZXlwdW5jdEl3TGIxRUVFAFRWAADISgAAAAAAAAIAAAAkPgAAAgAAAIBJAAACAAAAAAAAAIhLAADNAAAAhgEAAKsAAACHAQAAiAEAAE5TdDNfXzI5bW9uZXlfZ2V0SWNOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X2dldEljRUUAANBVAABmSwAAVFYAACBLAAAAAAAAAgAAACQ+AAACAAAAgEsAQayXAQuaASxMAADNAAAAiQEAAKsAAACKAQAAiwEAAE5TdDNfXzI5bW9uZXlfZ2V0SXdOU18xOWlzdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X2dldEl3RUUAANBVAAAKTAAAVFYAAMRLAAAAAAAAAgAAACQ+AAACAAAAJEwAQdCYAQuaAdBMAADNAAAAjAEAAKsAAACNAQAAjgEAAE5TdDNfXzI5bW9uZXlfcHV0SWNOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJY05TXzExY2hhcl90cmFpdHNJY0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEljRUUAANBVAACuTAAAVFYAAGhMAAAAAAAAAgAAACQ+AAACAAAAyEwAQfSZAQuaAXRNAADNAAAAjwEAAKsAAACQAQAAkQEAAE5TdDNfXzI5bW9uZXlfcHV0SXdOU18xOW9zdHJlYW1idWZfaXRlcmF0b3JJd05TXzExY2hhcl90cmFpdHNJd0VFRUVFRQBOU3QzX18yMTFfX21vbmV5X3B1dEl3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`;let Vo=.00669437999014;function Ho(e,t,n){let r=Math.PI/180*e,i=Math.PI/180*t,a=Math.sin(i),o=Math.cos(i),s=6378137/Math.sqrt(1-Vo*a*a);return[(s+n)*o*Math.cos(r),(s+n)*o*Math.sin(r),(s*(1-Vo)+n)*a]}let Uo=[200,200,200];function Wo(e){return Math.max(0,Math.min(255,Math.round(e)))}function Go(e){let t=atob(e),n=new Uint8Array(t.length);for(let e=0;e<t.length;e++)n[e]=t.charCodeAt(e);return n}let Ko=null;function qo(){return Ko??=ae.LazPerf.create({wasmBinary:Go(Bo)}),Ko}function Jo(e){return async()=>e}let Yo=new Set;function Xo(e,t){try{return e.getter(t)}catch{return}}function Zo(e,t){e!==`EPSG:4326`&&t&&!Yo.has(e)&&(Lo.defs(e,t),Yo.add(e))}function Qo(e,t,n,r){let i=new Uint16Array(e*3),a=0;for(let o=0;o<e;o++){let e=t(o),s=n(o),c=r(o),l=o*3;i[l]=e,i[l+1]=s,i[l+2]=c,e>a&&(a=e),s>a&&(a=s),c>a&&(a=c)}return{rgbRaw:i,maxColor:a}}async function $o(e){let{compressedBytes:t,copc:n,node:r,proj:i,projDef:a,geoidOffset:o,zFactor:s,zMin:c,zMax:l}=e,u=await qo(),d=await A.Copc.loadPointDataView(Jo(t),n,r,{lazPerf:u}),f=d.pointCount;if(!Number.isInteger(f)||f<0||f>1e7)throw Error(`Invalid pointCount: ${f}`);let p=d.getter(`X`),m=d.getter(`Y`),h=d.getter(`Z`),g=Xo(d,`Red`),_=Xo(d,`Green`),v=Xo(d,`Blue`),y=!!(g&&_&&v),b=Xo(d,`Classification`),x=Xo(d,`Intensity`);Zo(i,a);let S=i!==`EPSG:4326`,C=S?Lo(i,`EPSG:4326`):null,{rgbRaw:w,maxColor:T}=y?Qo(f,g,_,v):{rgbRaw:null,maxColor:0},ee=T>255?65535:255,te=new Float32Array(f*3),E=new Uint8Array(f*4),ne=new Uint16Array(f),D=new Uint8Array(f),O=new Uint16Array(f),re=0,ie=0,k=0,ae=0,oe=l-c,se=oe>0?65535/oe:0;for(let e=0;e<f;e++){let t=p(e),n=m(e),r=h(e),i,a;if(S&&C){if([i,a]=C.forward([t,n]),!isFinite(i)||!isFinite(a))throw Error(`proj4 transform produced a non-finite coordinate at point ${e}: x=${t}, y=${n}`)}else i=t,a=n;let l=r*s+o,[u,d,f]=Ho(i,a,l);e===0&&(ie=u,k=d,ae=f);let g=e*3;te[g]=u-ie,te[g+1]=d-k,te[g+2]=f-ae;let _=b?b(e)&255:0;if(D[e]=_,x){let t=Math.max(0,Math.min(65535,Math.round(x(e))));ne[e]=t,t>re&&(re=t)}O[e]=Math.max(0,Math.min(65535,Math.round((r-c)*se)));let v=e*4;if(y&&w)E[v]=Wo(w[g]/ee*255),E[v+1]=Wo(w[g+1]/ee*255),E[v+2]=Wo(w[g+2]/ee*255);else if(b){let[e,t,n]=Ro[_]??zo;E[v]=e,E[v+1]=t,E[v+2]=n}else E[v]=Uo[0],E[v+1]=Uo[1],E[v+2]=Uo[2];E[v+3]=255}return{positions:te,origin:[ie,k,ae],colors:E,intensities:ne,classifications:D,elevations:O,pointCount:f,maxIntensity:re}}self.onmessage=async e=>{let t=e.data;if(`cancel`in t)return;let{id:n,payload:r}=t;try{let e=await $o(r);postMessage({id:n,result:e},[e.positions.buffer,e.colors.buffer,e.intensities.buffer,e.classifications.buffer,e.elevations.buffer])}catch(e){let t=e;postMessage({id:n,error:{name:t.name,message:t.message}})}}})();", js = typeof self < "u" && self.Blob && new Blob(["(self.URL || self.webkitURL).revokeObjectURL(self.location.href);", As], { type: "text/javascript;charset=utf-8" });
function Ms(e) {
	let t;
	try {
		if (t = js && (self.URL || self.webkitURL).createObjectURL(js), !t) throw "";
		let n = new Worker(t, { name: e?.name });
		return n.addEventListener("error", () => {
			(self.URL || self.webkitURL).revokeObjectURL(t);
		}), n;
	} catch {
		return new Worker("data:text/javascript;charset=utf-8," + encodeURIComponent(As), { name: e?.name });
	}
}
//#endregion
//#region src/CopcDataSource.ts
function Ns(e) {
	if (!Number.isFinite(e) || e < 0 || e > 1) throw RangeError(`opacity must be between 0 and 1, got ${e}`);
	return e;
}
var Ps = {
	proj: "EPSG:4326",
	projDef: null,
	geoidOffset: 0,
	concurrency: 5,
	debounceMs: 100,
	maxCacheNodes: 150,
	maxVisibleNodes: 100,
	maxPoints: 5e6,
	pixelSize: 2,
	sseThreshold: 250,
	zFactor: 1,
	xyFactor: 1,
	autoFrame: !0,
	colorMode: "rgb",
	opacity: 1
}, Fs = 3, Is = 1e3, Ls = 6e4, Rs = 256;
function zs(e, t) {
	return e.length === 0 ? 0 : e[Math.min(e.length - 1, Math.floor(e.length * t))];
}
var Bs = 5e3, Vs = class t {
	constructor(t, n, r, i, a, o, s) {
		this._pendingPages = /* @__PURE__ */ new Set(), this._pageFailures = /* @__PURE__ */ new Map(), this._stageSamples = {
			fetch: [],
			decode: [],
			upload: []
		}, this._stageCounts = {
			fetch: 0,
			decode: 0,
			upload: 0
		}, this._measureCount = {
			fetch: 0,
			decode: 0,
			upload: 0
		}, this._pendingKeys = /* @__PURE__ */ new Set(), this._cancels = /* @__PURE__ */ new Map(), this._sphereCache = /* @__PURE__ */ new Map(), this._selectedKeys = /* @__PURE__ */ new Set(), this._isUpdating = !1, this._pendingUpdate = !1, this._lastUpdateTime = 0, this._removeUpdateListener = () => {}, this._removeMoveEndListener = () => {}, this._destroyed = !1, this._url = t, this._viewer = n, this._copc = r.copc, this._nodes = r.nodes, this._maxDepth = r.maxDepth, this._pages = r.pages, this._rootCenter = r.rootCenter, this._rootHalfSize = r.rootHalfSize, this._options = i, this._project = a, this._style = {
			pixelSize: i.pixelSize,
			colorMode: bs[i.colorMode],
			intensityRange: new e.Cartesian2(i.intensityRange?.[0] ?? 0, i.intensityRange?.[1] ?? 1),
			classMask: xs(i.classificationFilter),
			heightOffset: 0,
			opacity: Ns(i.opacity)
		}, this._autoIntensityRange = i.intensityRange === void 0, this._nodeCache = new ks(i.maxCacheNodes, (e, t) => this._destroyLoadedNode(t), i.maxCacheBytes), this._counter = r.counter, this._pageGetter = Wo(t, this._counter), this._rangeFetcher = new ns(t, void 0, void 0, i.maxConcurrentRequests ?? o.concurrency, this._counter), this._workerPool = o, this._ownsPool = s;
	}
	static async load(e, n, r = {}, i) {
		let a = {
			...Ps,
			...r
		}, o = await qo(e), s = cs(o.copc.wkt, e);
		s && (a.projDef ||= (a.proj = s.proj, s.projDef), r.zFactor === void 0 && (a.zFactor = s.zFactor), r.xyFactor === void 0 && (a.xyFactor = s.xyFactor)), a.projDef && a.proj !== "EPSG:4326" && no.defs(a.proj, a.projDef);
		let c = ls(a.proj === "EPSG:4326" ? null : no(a.proj, "EPSG:4326"), a.geoidOffset, a.zFactor), l = i ?? new Ds(() => new Ms(), a.concurrency), u = new t(e, n, o, a, c, l, !i);
		return a.autoFrame && await u.zoomTo(), u._startListening(), u;
	}
	_startListening() {
		this._removeUpdateListener = this._viewer.scene.preRender.addEventListener(() => this._onPreRender()), this._removeMoveEndListener = this._viewer.scene.camera.moveEnd.addEventListener(() => this._onMoveEnd());
	}
	async zoomTo() {
		let t = this._getSphere("0-0-0-0"), n = this._viewer.scene.camera, r = (n.frustum instanceof e.PerspectiveFrustum ? n.frustum.fovy : void 0) ?? e.Math.toRadians(60), i = this._viewer.scene.canvas.clientHeight / (2 * Math.tan(r / 2)), a = t.radius * i / (this._options.sseThreshold * 2);
		return new Promise((r) => {
			n.flyToBoundingSphere(t, {
				offset: new e.HeadingPitchRange(0, e.Math.toRadians(-45), a),
				complete: r
			});
		});
	}
	_getSphere(e) {
		let t = this._sphereCache.get(e);
		if (t) return this._sphereCache.delete(e), this._sphereCache.set(e, t), t;
		let n = us(e, this._rootCenter, this._rootHalfSize, this._project, this._options.xyFactor);
		if (this._sphereCache.set(e, n), this._sphereCache.size > Bs) {
			let e = this._sphereCache.keys().next().value;
			e !== void 0 && this._sphereCache.delete(e);
		}
		return n;
	}
	_onPreRender() {
		if (this._destroyed) return;
		this._updateVisibility();
		let e = performance.now();
		e - this._lastUpdateTime < this._options.debounceMs || (this._lastUpdateTime = e, this._updateLoD());
	}
	_onMoveEnd() {
		this._destroyed || (this._lastUpdateTime = performance.now(), this._updateLoD());
	}
	_updateVisibility() {
		if (this._selectedKeys.size === 0) return;
		let e = ds(this._viewer.scene.camera), t = !1;
		for (let n of this._selectedKeys) {
			let r = this._nodeCache.peek(n);
			if (!r) continue;
			let i = r.primitive, a = fs(this._getSphere(n), e);
			i.show !== a && (i.show = a, t = !0);
		}
		t && this._viewer.scene.requestRender();
	}
	async _updateLoD() {
		if (!this._destroyed) {
			if (this._isUpdating) {
				this._pendingUpdate = !0;
				return;
			}
			this._isUpdating = !0;
			try {
				let e = /* @__PURE__ */ new Set(), t = new Set(_s({
					nodes: this._nodes,
					pages: this._pages,
					onPageNeeded: (t) => e.add(t),
					getSphere: (e) => this._getSphere(e),
					camera: this._viewer.scene.camera,
					viewportHeight: this._viewer.scene.canvas.clientHeight,
					sseThreshold: this._options.sseThreshold,
					maxVisibleNodes: this._options.maxVisibleNodes,
					maxPoints: this._options.maxPoints
				}));
				this._dispatchPageLoads(e), this._cancelStaleLoads(t);
				let n = !1;
				for (let e of t) {
					let t = this._nodeCache.peek(e);
					if (t) {
						let e = t.primitive;
						e.show || (e.show = !0, n = !0);
						continue;
					}
					this._pendingKeys.has(e) || this._loadNode(e);
				}
				let r = new Set(t), i = Ro(t);
				for (let e of this._selectedKeys) {
					if (t.has(e)) continue;
					let a = this._nodeCache.peek(e);
					if (!a) continue;
					let o = a.primitive;
					o.show && (this._isReplacementReady(e, i) ? (o.show = !1, n = !0) : r.add(e));
				}
				this._nodeCache.pin(r), this._selectedKeys = r, n && this._viewer.scene.requestRender();
			} finally {
				this._isUpdating = !1, this._pendingUpdate && (this._pendingUpdate = !1, this._updateLoD());
			}
		}
	}
	_dispatchPageLoads(e) {
		for (let t of e) this._pendingPages.has(t) || this._loadPage(t);
	}
	_cancelStaleLoads(e) {
		for (let t of this._pendingKeys) e.has(t) || this._cancels.get(t)?.();
	}
	_isReplacementReady(e, t) {
		let n = zo(e, t);
		return n.length === 0 || n.every((e) => {
			let t = this._nodeCache.peek(e);
			return !!t && t.primitive.show;
		});
	}
	async _loadNode(e) {
		this._pendingKeys.add(e);
		try {
			let t = this._nodes[e], n = this._rangeFetcher.fetch(t.pointDataOffset, t.pointDataOffset + t.pointDataLength);
			this._cancels.set(e, n.cancel);
			let r = performance.now(), i = await n;
			if (this._recordStage("fetch", r), this._destroyed) return;
			let a = {
				compressedBytes: i,
				copc: this._copc,
				node: t,
				proj: this._options.proj,
				projDef: this._options.projDef,
				geoidOffset: this._options.geoidOffset,
				zFactor: this._options.zFactor,
				zMin: this._copc.header.min[2],
				zMax: this._copc.header.max[2]
			}, o = this._workerPool.run(a, [i.buffer]);
			this._cancels.set(e, o.cancel);
			let s = performance.now(), c = await o;
			if (this._recordStage("decode", s), this._destroyed) return;
			let l = this._getSphere(e);
			this._growAutoIntensityRange(c.maxIntensity);
			let u = await Es(c, l, this._style, (e, t) => {
				this._destroyed || this._recordStage("upload", e, t);
			});
			if (this._destroyed) {
				u.destroy();
				return;
			}
			u.show = this._selectedKeys.has(e), this._viewer.scene.primitives.add(u), this._nodeCache.set(e, {
				key: e,
				primitive: u,
				pointCount: c.pointCount
			}), this._viewer.scene.requestRender();
		} catch (t) {
			if (this._destroyed || t.name === "AbortError") return;
			console.error(`[CopcDataSource] Failed to load node "${e}":`, t);
		} finally {
			this._pendingKeys.delete(e), this._cancels.delete(e);
		}
	}
	async _loadPage(e) {
		let t = this._pages[e];
		if (!t) return;
		let n = this._pageFailures.get(e);
		if (!(n && performance.now() - n.at < Is * 2 ** (n.count - 1))) {
			this._pendingPages.add(e);
			try {
				let { nodes: n, pages: r } = await Fo.Copc.loadHierarchyPage(this._pageGetter, t);
				if (this._destroyed) return;
				Object.assign(this._nodes, n);
				for (let e of Object.keys(n)) {
					let t = Lo(e);
					t > this._maxDepth && (this._maxDepth = t);
				}
				delete this._pages[e], Object.assign(this._pages, r), this._pageFailures.delete(e), this._updateLoD();
			} catch (t) {
				let r = performance.now(), i = n && r - n.at < Ls ? n.count + 1 : 1;
				this._pageFailures.set(e, {
					count: i,
					at: r
				}), i >= Fs || !Xo(t) ? (delete this._pages[e], this._pageFailures.delete(e), console.error(`[CopcDataSource] Giving up on hierarchy page "${e}" after ${i} attempt${i === 1 ? "" : "s"}:`, t)) : console.warn(`[CopcDataSource] Hierarchy page "${e}" failed (attempt ${i}/${Fs}), will retry:`, t);
			} finally {
				this._pendingPages.delete(e);
			}
		}
	}
	_destroyLoadedNode(e) {
		this._viewer.scene.primitives.remove(e.primitive), this._viewer.scene.requestRender();
	}
	_growAutoIntensityRange(e) {
		this._autoIntensityRange && (e <= this._style.intensityRange.y || (this._style.intensityRange.y = e));
	}
	get pixelSize() {
		return this._style.pixelSize;
	}
	set pixelSize(e) {
		this._style.pixelSize = e, this._viewer.scene.requestRender();
	}
	get opacity() {
		return this._style.opacity;
	}
	set opacity(e) {
		this._style.opacity = Ns(e), this._viewer.scene.requestRender();
	}
	get colorMode() {
		return this._options.colorMode;
	}
	set colorMode(e) {
		this._options.colorMode = e, this._style.colorMode = bs[e], this._viewer.scene.requestRender();
	}
	get classificationFilter() {
		return this._options.classificationFilter;
	}
	set classificationFilter(e) {
		let t = xs(e);
		this._options.classificationFilter = e, this._style.classMask = t, this._viewer.scene.requestRender();
	}
	get intensityRange() {
		return [this._style.intensityRange.x, this._style.intensityRange.y];
	}
	set intensityRange(e) {
		this._autoIntensityRange = e === void 0, this._options.intensityRange = e, this._style.intensityRange.x = e?.[0] ?? 0, this._style.intensityRange.y = e?.[1] ?? 1, this._viewer.scene.requestRender();
	}
	get heightOffset() {
		return this._style.heightOffset;
	}
	set heightOffset(e) {
		this._style.heightOffset = e, this._viewer.scene.requestRender();
	}
	get sseThreshold() {
		return this._options.sseThreshold;
	}
	set sseThreshold(e) {
		this._options.sseThreshold = e, this._updateLoD();
	}
	get maxDepth() {
		return this._maxDepth;
	}
	get nodeCount() {
		return Object.keys(this._nodes).length;
	}
	_recordStage(e, t, n = performance.now()) {
		let r = n;
		this._stageCounts[e]++;
		let i = this._stageSamples[e];
		i.push(r - t), i.length > Rs && i.shift();
		let a = `copcesium ${e}`;
		try {
			performance.measure(a, {
				start: t,
				end: r
			}), ++this._measureCount[e] >= Rs && (this._measureCount[e] = 0, performance.clearMeasures(a));
		} catch {}
	}
	_stageTiming(e) {
		let t = [...this._stageSamples[e]].sort((e, t) => e - t);
		return {
			count: this._stageCounts[e],
			p50: zs(t, .5),
			p95: zs(t, .95)
		};
	}
	get stats() {
		return {
			fileBytes: this._counter.fileBytes,
			requestCount: this._counter.requestCount,
			transferredBytes: this._counter.transferredBytes,
			pendingNodes: this._pendingKeys.size,
			fetch: this._stageTiming("fetch"),
			decode: this._stageTiming("decode"),
			upload: this._stageTiming("upload")
		};
	}
	get cacheSize() {
		return this._nodeCache.size;
	}
	destroy() {
		this._destroyed || (this._destroyed = !0, this._removeUpdateListener(), this._removeMoveEndListener(), this._rangeFetcher.destroy(), this._ownsPool && this._workerPool.destroy(), this._nodeCache.destroy());
	}
};
//#endregion
window.copcesium = { CopcDataSource: Vs, WorkerPool: Ds };
})(window.Cesium);
