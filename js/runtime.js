(function () {
  'use strict';
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var uid = 0;

  /* ---------- compile templates ---------- */
  function camel(s) { return s.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase(); }); }
  function parts(str) {
    var m = WHOLE.exec(str);
    if (m) return { raw: m[1] };
    if (str.indexOf('{{') < 0) return { s: str };
    var out = [], last = 0, r;
    HOLE.lastIndex = 0;
    while ((r = HOLE.exec(str))) { if (r.index > last) out.push(str.slice(last, r.index)); out.push({ p: r[1] }); last = HOLE.lastIndex; }
    if (last < str.length) out.push(str.slice(last));
    return { mix: out };
  }
  function compileKids(node) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) { var k = compile(c); if (k) out.push(k); }
    return out;
  }
  function compile(n) {
    if (n.nodeType === 3) {
      var t = n.nodeValue;
      if (/^\s*$/.test(t) && t.indexOf('\n') >= 0) return null;
      return { k: 'tx', id: ++uid, v: parts(t) };
    }
    if (n.nodeType !== 1) return null;
    var tag = n.localName;
    if (tag === 'sc-if') return { k: 'if', id: ++uid, test: parts(n.getAttribute('value') || ''), ch: compileKids(n) };
    if (tag === 'sc-for') return { k: 'for', id: ++uid, list: parts(n.getAttribute('list') || ''), as: n.getAttribute('as') || 'item', ch: compileKids(n) };
    if (tag === 'dc-import') {
      var props = [];
      for (var i = 0; i < n.attributes.length; i++) {
        var a = n.attributes[i];
        if (a.name === 'name' || a.name.indexOf('hint-') === 0) continue;
        props.push([camel(a.name), parts(a.value)]);
      }
      return { k: 'cmp', id: ++uid, name: n.getAttribute('name'), props: props };
    }
    var attrs = [];
    for (var j = 0; j < n.attributes.length; j++) { var b = n.attributes[j]; attrs.push([b.name, parts(b.value)]); }
    return { k: 'el', id: ++uid, tag: tag, ns: n.namespaceURI, attrs: attrs, ch: compileKids(n) };
  }

  /* ---------- evaluate ---------- */
  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var segs = path.split('.'), v;
    for (var i = scope.length - 1; i >= 0; i--) { if (scope[i] != null && segs[0] in Object(scope[i])) { v = scope[i][segs[0]]; break; } }
    for (var k = 1; k < segs.length && v != null; k++) v = v[segs[k]];
    return v;
  }
  function val(pt, scope) {
    if (pt.s != null) return pt.s;
    if (pt.raw != null) return lookup(pt.raw, scope);
    var s = '';
    for (var i = 0; i < pt.mix.length; i++) { var x = pt.mix[i]; if (typeof x === 'string') s += x; else { var v = lookup(x.p, scope); s += v == null ? '' : v; } }
    return s;
  }
  function str(pt, scope) { var v = val(pt, scope); return v == null ? '' : String(v); }

  /* ---------- build vnodes ---------- */
  function build(list, scope, key, out) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i], k = key + '/' + c.id;
      if (c.k === 'tx') out.push({ k: 'tx', key: k, v: str(c.v, scope) });
      else if (c.k === 'if') { if (val(c.test, scope)) build(c.ch, scope, k, out); }
      else if (c.k === 'for') {
        var arr = val(c.list, scope) || [];
        for (var j = 0; j < arr.length; j++) { var fr = { $index: j }; fr[c.as] = arr[j]; build(c.ch, scope.concat([fr]), k + '.' + j, out); }
      } else if (c.k === 'cmp') {
        var p = {};
        for (var q = 0; q < c.props.length; q++) p[c.props[q][0]] = val(c.props[q][1], scope);
        out.push({ k: 'cmp', key: k, name: c.name, props: p });
      } else {
        var a = {};
        for (var r = 0; r < c.attrs.length; r++) a[c.attrs[r][0]] = val(c.attrs[r][1], scope);
        var ch = [];
        build(c.ch, scope, k, ch);
        out.push({ k: 'el', key: k, tag: c.tag, ns: c.ns, a: a, ch: ch });
      }
    }
    return out;
  }

  /* ---------- patch DOM ---------- */
  var mounted = [];
  function listener(e) { var h = this.__h && this.__h[e.type]; if (h) return h.call(this, e); }
  function setAttrs(el, a, old) {
    var name;
    for (name in old) if (!(name in a)) setOne(el, name, null);
    for (name in a) if (!old || old[name] !== a[name]) setOne(el, name, a[name]);
  }
  function setOne(el, name, v) {
    if (name.length > 2 && name[0] === 'o' && name[1] === 'n') {
      var type = name.slice(2).toLowerCase();
      el.__h = el.__h || {};
      if (!el.__h[type] && typeof v === 'function') el.addEventListener(type, listener);
      el.__h[type] = typeof v === 'function' ? v : null;
      return;
    }
    if (v == null || v === false) el.removeAttribute(name);
    else el.setAttribute(name, v === true ? '' : String(v));
  }
  function create(vn) {
    if (vn.k === 'tx') { var t = document.createTextNode(vn.v); t.__vn = vn; return t; }
    if (vn.k === 'cmp') {
      var w = document.createElement('dc-c');
      w.__vn = vn;
      var C = getClass(vn.name);
      var inst = new C(withDefaults(vn.name, vn.props));
      inst.__dom = w; w.__inst = inst;
      inst.__render();
      mounted.push(inst);
      return w;
    }
    var el = vn.ns && vn.ns !== 'http://www.w3.org/1999/xhtml' ? document.createElementNS(vn.ns, vn.tag) : document.createElement(vn.tag);
    el.__vn = vn;
    setAttrs(el, vn.a, null);
    patchKids(el, vn.ch);
    return el;
  }
  function same(a, b) { return a.k === b.k && a.tag === b.tag && a.name === b.name && a.ns === b.ns; }
  function update(node, vn) {
    var o = node.__vn;
    node.__vn = vn;
    if (vn.k === 'tx') { if (o.v !== vn.v) node.nodeValue = vn.v; return; }
    if (vn.k === 'cmp') { var inst = node.__inst; inst.props = withDefaults(vn.name, vn.props); inst.__render(); return; }
    setAttrs(node, vn.a, o.a);
    patchKids(node, vn.ch);
  }
  function unmount(node) {
    if (node.nodeType !== 1) return;
    for (var c = node.firstChild; c; c = c.nextSibling) unmount(c);
    if (node.__inst) { var i = node.__inst; i.__dead = true; if (i.componentWillUnmount) try { i.componentWillUnmount(); } catch (e) { console.error(e); } }
  }
  function patchKids(parent, vns) {
    var old = {}, c;
    for (c = parent.firstChild; c; c = c.nextSibling) if (c.__vn) old[c.__vn.key] = c;
    var nodes = [];
    for (var i = 0; i < vns.length; i++) {
      var vn = vns[i], n = old[vn.key];
      if (n && same(n.__vn, vn)) { delete old[vn.key]; update(n, vn); }
      else n = create(vn);
      nodes.push(n);
    }
    for (var k in old) { unmount(old[k]); parent.removeChild(old[k]); }
    var cur = parent.firstChild;
    for (var j = 0; j < nodes.length; j++) {
      if (nodes[j] === cur) cur = cur.nextSibling;
      else parent.insertBefore(nodes[j], cur);
    }
  }

  /* ---------- components ---------- */
  var dirty = [], scheduled = false;
  function flush() {
    scheduled = false;
    var list = dirty; dirty = [];
    for (var i = 0; i < list.length; i++) { var c = list[i]; c.__queued = false; if (!c.__dead) c.__render(); }
    didMount();
  }
  function didMount() {
    while (mounted.length) {
      var m = mounted.shift();
      if (!m.__dead && m.componentDidMount) try { m.componentDidMount(); } catch (e) { console.error(e); }
    }
  }
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state, this.props);
    this.state = Object.assign({}, this.state, patch);
    if (!this.__queued) { this.__queued = true; dirty.push(this); }
    if (!scheduled) { scheduled = true; Promise.resolve().then(flush); }
  };
  DCLogic.prototype.forceUpdate = function () { this.setState({}); };
  DCLogic.prototype.renderVals = function () { return {}; };
  DCLogic.prototype.__render = function () {
    var vals;
    try { vals = this.renderVals() || {}; } catch (e) { console.error('[' + this.__name + ']', e); return; }
    patchKids(this.__dom, build(this.__tpl, [vals], '', []));
  };

  var classes = {}, defaults = {};
  function getClass(name) {
    if (classes[name]) return classes[name];
    var s = (window.__DC_SOURCES__ || {})[name];
    if (!s) throw new Error('Missing component ' + name);
    var x = s.indexOf('<x-dc>'), y = s.lastIndexOf('</x-dc>');
    var body = s.slice(x + 6, y).replace(/<helmet>[\s\S]*?<\/helmet>/, '');
    var doc = new DOMParser().parseFromString('<!doctype html><html><body>' + body + '</body></html>', 'text/html');
    var tpl = compileKids(doc.body);
    var sm = /<script type="text\/x-dc" data-dc-script(?: data-props='([^']*)')?>([\s\S]*)<\/script>/.exec(s);
    var dp = {};
    try { dp = sm[1] ? JSON.parse(sm[1]) : {}; } catch (e) {}
    var d = {};
    for (var k in dp) if (k[0] !== '$' && dp[k] && 'default' in dp[k]) d[k] = dp[k].default;
    defaults[name] = d;
    var Base = function (p) { DCLogic.call(this, p); };
    Base.prototype = Object.create(DCLogic.prototype);
    Base.prototype.constructor = Base;
    var C = new Function('DCLogic', sm[2] + '\n;return Component;')(Base);
    C.prototype.__tpl = tpl;
    C.prototype.__name = name;
    classes[name] = C;
    return C;
  }
  function withDefaults(name, p) {
    getClass(name);
    var d = defaults[name], o = {};
    for (var k in d) o[k] = d[k];
    for (var j in p) if (p[j] !== undefined) o[j] = p[j];
    return o;
  }

  window.DC = {
    mount: function (el, name, props) {
      patchKids(el, [{ k: 'cmp', key: 'root', name: name, props: props || {} }]);
      didMount();
    }
  };
})();
