import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// ../../node_modules/.bun/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS(function(exports, module) {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  }
});

// ../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS(function(exports, module) {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// ../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS(function(exports, module) {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// ../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/node.js
var require_node = __commonJS(function(exports, module) {
  var tty = __require("tty");
  var util = __require("util");
  exports.init = init;
  exports.log = log;
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.destroy = util.deprecate(() => {}, "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  exports.colors = [6, 2, 3, 4, 5, 1];
  try {
    const supportsColor = (()=>{throw new Error("Cannot require module "+"supports-color");})();
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
      exports.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ];
    }
  } catch (error) {}
  exports.inspectOpts = Object.keys(process.env).filter((key) => {
    return /^debug_/i.test(key);
  }).reduce((obj, key) => {
    const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
      return k.toUpperCase();
    });
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
      val = true;
    } else if (/^(no|off|false|disabled)$/i.test(val)) {
      val = false;
    } else if (val === "null") {
      val = null;
    } else {
      val = Number(val);
    }
    obj[prop] = val;
    return obj;
  }, {});
  function useColors() {
    return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
  }
  function formatArgs(args) {
    const { namespace: name, useColors } = this;
    if (useColors) {
      const c = this.color;
      const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
      const prefix = `  ${colorCode};1m${name} \x1B[0m`;
      args[0] = prefix + args[0].split(`
`).join(`
` + prefix);
      args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
    } else {
      args[0] = getDate() + name + " " + args[0];
    }
  }
  function getDate() {
    if (exports.inspectOpts.hideDate) {
      return "";
    }
    return new Date().toISOString() + " ";
  }
  function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + `
`);
  }
  function save(namespaces) {
    if (namespaces) {
      process.env.DEBUG = namespaces;
    } else {
      delete process.env.DEBUG;
    }
  }
  function load() {
    return process.env.DEBUG;
  }
  function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0;i < keys.length; i++) {
      debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.o = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
  };
  formatters.O = function(v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
  };
});

// ../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/index.js
var require_src = __commonJS(function(exports, module) {
  if (typeof process === "undefined" || process.type === "renderer" || false || process.__nwjs) {
    module.exports = require_browser();
  } else {
    module.exports = require_node();
  }
});

// ../../node_modules/.bun/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/src/index.js
var require_src2 = __commonJS(function(exports) {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  var fs_1 = __require("fs");
  var debug_1 = __importDefault(require_src());
  var log = debug_1.default("@kwsites/file-exists");
  function check(path, isFile, isDirectory) {
    log(`checking %s`, path);
    try {
      const stat = fs_1.statSync(path);
      if (stat.isFile() && isFile) {
        log(`[OK] path represents a file`);
        return true;
      }
      if (stat.isDirectory() && isDirectory) {
        log(`[OK] path represents a directory`);
        return true;
      }
      log(`[FAIL] path represents something other than a file or directory`);
      return false;
    } catch (e) {
      if (e.code === "ENOENT") {
        log(`[FAIL] path is not accessible: %o`, e);
        return false;
      }
      log(`[FATAL] %o`, e);
      throw e;
    }
  }
  function exists(path, type = exports.READABLE) {
    return check(path, (type & exports.FILE) > 0, (type & exports.FOLDER) > 0);
  }
  exports.exists = exists;
  exports.FILE = 1;
  exports.FOLDER = 2;
  exports.READABLE = exports.FILE + exports.FOLDER;
});

// ../../node_modules/.bun/@kwsites+file-exists@1.1.1/node_modules/@kwsites/file-exists/dist/index.js
var require_dist = __commonJS(function(exports) {
  function __export(m) {
    for (var p in m)
      if (!exports.hasOwnProperty(p))
        exports[p] = m[p];
  }
  Object.defineProperty(exports, "__esModule", { value: true });
  __export(require_src2());
});

// ../../node_modules/.bun/@kwsites+promise-deferred@1.1.1/node_modules/@kwsites/promise-deferred/dist/index.js
var require_dist2 = __commonJS(function(exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.createDeferred = exports.deferred = undefined;
  function deferred() {
    let done;
    let fail;
    let status = "pending";
    const promise = new Promise((_done, _fail) => {
      done = _done;
      fail = _fail;
    });
    return {
      promise,
      done(result) {
        if (status === "pending") {
          status = "resolved";
          done(result);
        }
      },
      fail(error) {
        if (status === "pending") {
          status = "rejected";
          fail(error);
        }
      },
      get fulfilled() {
        return status !== "pending";
      },
      get status() {
        return status;
      }
    };
  }
  exports.deferred = deferred;
  exports.createDeferred = deferred;
  exports.default = deferred;
});

// src/types.ts
import * as path from "path";
import * as os from "os";
var BUILT_IN_AGENT_NAMES = [
  "zetta",
  "architect-planner",
  "swarm-orchestrator",
  "scout-researcher",
  "forager-worker",
  "hygienic-reviewer"
];
var CUSTOM_AGENT_BASES = ["forager-worker", "hygienic-reviewer"];
var CUSTOM_AGENT_RESERVED_NAMES = [
  ...BUILT_IN_AGENT_NAMES,
  "hive",
  "architect",
  "swarm",
  "scout",
  "forager",
  "hygienic",
  "receiver",
  "build",
  "plan",
  "code"
];
var DEFAULT_AGENT_MODELS = {
  zetta: undefined,
  "architect-planner": undefined,
  "swarm-orchestrator": undefined,
  "scout-researcher": undefined,
  "forager-worker": undefined,
  "hygienic-reviewer": undefined
};
var DEFAULT_HIVE_CONFIG = {
  $schema: "https://raw.githubusercontent.com/hung319/agent-hive/main/packages/opencode-hive/schema/agent_hive.schema.json",
  enableToolsFor: [],
  disableSkills: [],
  disableMcps: [],
  agentMode: "unified",
  sandbox: "none",
  customAgents: {
    "forager-example-template": {
      baseAgent: "forager-worker",
      description: "Example template only: rename or delete this entry before use. Do not expect planners/orchestrators to select this placeholder agent as configured.",
      temperature: 0.2,
      variant: "high",
      autoLoadSkills: ["test-driven-development"]
    },
    "hygienic-example-template": {
      baseAgent: "hygienic-reviewer",
      description: "Example template only: rename or delete this entry before use. Do not expect planners/orchestrators to select this placeholder agent as configured.",
      autoLoadSkills: ["code-reviewer"]
    }
  },
  agents: {
    zetta: {
      temperature: 0.5,
      skills: [],
      autoLoadSkills: ["parallel-exploration"]
    },
    "architect-planner": {
      temperature: 0.7,
      skills: [],
      autoLoadSkills: ["parallel-exploration"]
    },
    "swarm-orchestrator": {
      temperature: 0.5,
      skills: [],
      autoLoadSkills: []
    },
    "scout-researcher": {
      temperature: 0.5,
      skills: [],
      autoLoadSkills: []
    },
    "forager-worker": {
      temperature: 0.3,
      autoLoadSkills: ["test-driven-development", "verification-before-completion"]
    },
    "hygienic-reviewer": {
      temperature: 0.3,
      skills: [],
      autoLoadSkills: []
    }
  },
  tokenTruncation: {
    enabled: true,
    maxChars: 30000,
    keepFirstPercent: 40,
    keepLastPercent: 40
  },
  sessionSnapshot: {
    enabled: true,
    maxSnapshotChars: 2048,
    includeActiveFeature: true,
    includePendingTasks: true,
    includeModifiedFiles: false
  },
  rtk: {
    enabled: false,
    command: "rtk"
  },
  vectorMemory: {
    enabled: false,
    indexPath: path.join(os.homedir(), ".config", "opencode", "hive", "vector-index"),
    dimensions: 384,
    compactionRestoration: {
      enabled: true,
      maxMemories: 5
    }
  },
  hiddenJudge: {
    enabled: false,
    maxRetries: 3,
    minToolCalls: 5,
    writeRatioThreshold: 0.1
  },
  userProfile: {
    enabled: false,
    analysisInterval: 10,
    maxPreferences: 20,
    confidenceDecayDays: 30
  }
};
// src/utils/paths.ts
import * as path2 from "path";
import * as fs from "fs";
var HIVE_DIR = ".hive";
var FEATURES_DIR = "features";
var TASKS_DIR = "tasks";
var CONTEXT_DIR = "context";
var PLAN_FILE = "plan.md";
var COMMENTS_FILE = "comments.json";
var FEATURE_FILE = "feature.json";
var STATUS_FILE = "status.json";
var REPORT_FILE = "report.md";
var APPROVED_FILE = "APPROVED";
function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}
function getHivePath(projectRoot) {
  return path2.join(projectRoot, HIVE_DIR);
}
function getFeaturesPath(projectRoot) {
  return path2.join(getHivePath(projectRoot), FEATURES_DIR);
}
function getFeaturePath(projectRoot, featureName) {
  return path2.join(getFeaturesPath(projectRoot), featureName);
}
function getPlanPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), PLAN_FILE);
}
function getCommentsPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), COMMENTS_FILE);
}
function getFeatureJsonPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), FEATURE_FILE);
}
function getContextPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), CONTEXT_DIR);
}
function getTasksPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), TASKS_DIR);
}
function getTaskPath(projectRoot, featureName, taskFolder) {
  return path2.join(getTasksPath(projectRoot, featureName), taskFolder);
}
function getTaskStatusPath(projectRoot, featureName, taskFolder) {
  return path2.join(getTaskPath(projectRoot, featureName, taskFolder), STATUS_FILE);
}
function getTaskReportPath(projectRoot, featureName, taskFolder) {
  return path2.join(getTaskPath(projectRoot, featureName, taskFolder), REPORT_FILE);
}
function getTaskSpecPath(projectRoot, featureName, taskFolder) {
  return path2.join(getTaskPath(projectRoot, featureName, taskFolder), "spec.md");
}
function getApprovedPath(projectRoot, featureName) {
  return path2.join(getFeaturePath(projectRoot, featureName), APPROVED_FILE);
}
var SUBTASKS_DIR = "subtasks";
var SPEC_FILE = "spec.md";
function getSubtasksPath(projectRoot, featureName, taskFolder) {
  return path2.join(getTaskPath(projectRoot, featureName, taskFolder), SUBTASKS_DIR);
}
function getSubtaskPath(projectRoot, featureName, taskFolder, subtaskFolder) {
  return path2.join(getSubtasksPath(projectRoot, featureName, taskFolder), subtaskFolder);
}
function getSubtaskStatusPath(projectRoot, featureName, taskFolder, subtaskFolder) {
  return path2.join(getSubtaskPath(projectRoot, featureName, taskFolder, subtaskFolder), STATUS_FILE);
}
function getSubtaskSpecPath(projectRoot, featureName, taskFolder, subtaskFolder) {
  return path2.join(getSubtaskPath(projectRoot, featureName, taskFolder, subtaskFolder), SPEC_FILE);
}
function getSubtaskReportPath(projectRoot, featureName, taskFolder, subtaskFolder) {
  return path2.join(getSubtaskPath(projectRoot, featureName, taskFolder, subtaskFolder), REPORT_FILE);
}
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
function fileExists(filePath) {
  return fs.existsSync(filePath);
}
function readJson(filePath) {
  if (!fs.existsSync(filePath))
    return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}
function writeJson(filePath, data) {
  ensureDir(path2.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
var DEFAULT_LOCK_OPTIONS = {
  timeout: 5000,
  retryInterval: 50,
  staleLockTTL: 30000
};
function getLockPath(filePath) {
  return `${filePath}.lock`;
}
function isLockStale(lockPath, staleTTL) {
  try {
    const stat = fs.statSync(lockPath);
    const age = Date.now() - stat.mtimeMs;
    return age > staleTTL;
  } catch {
    return true;
  }
}
async function acquireLock(filePath, options = {}) {
  const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };
  const lockPath = getLockPath(filePath);
  const lockDir = path2.dirname(lockPath);
  const startTime = Date.now();
  const lockContent = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
    filePath
  });
  ensureDir(lockDir);
  while (true) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, lockContent);
      fs.closeSync(fd);
      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      };
    } catch (err) {
      const error = err;
      if (error.code === "ENOENT") {
        ensureDir(lockDir);
      } else if (error.code === "EEXIST") {
        if (isLockStale(lockPath, opts.staleLockTTL)) {
          try {
            fs.unlinkSync(lockPath);
            continue;
          } catch {}
        }
      } else {
        throw error;
      }
      if (Date.now() - startTime >= opts.timeout) {
        throw new Error(`Failed to acquire lock on ${filePath} after ${opts.timeout}ms. ` + `Lock file: ${lockPath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, opts.retryInterval));
    }
  }
}
function acquireLockSync(filePath, options = {}) {
  const opts = { ...DEFAULT_LOCK_OPTIONS, ...options };
  const lockPath = getLockPath(filePath);
  const lockDir = path2.dirname(lockPath);
  const startTime = Date.now();
  const lockContent = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
    filePath
  });
  ensureDir(lockDir);
  while (true) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
      fs.writeSync(fd, lockContent);
      fs.closeSync(fd);
      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      };
    } catch (err) {
      const error = err;
      if (error.code === "ENOENT") {
        ensureDir(lockDir);
      } else if (error.code === "EEXIST") {
        if (isLockStale(lockPath, opts.staleLockTTL)) {
          try {
            fs.unlinkSync(lockPath);
            continue;
          } catch {}
        }
      } else {
        throw error;
      }
      if (Date.now() - startTime >= opts.timeout) {
        throw new Error(`Failed to acquire lock on ${filePath} after ${opts.timeout}ms. ` + `Lock file: ${lockPath}`);
      }
      const waitUntil = Date.now() + opts.retryInterval;
      while (Date.now() < waitUntil) {}
    }
  }
}
function writeAtomic(filePath, content) {
  ensureDir(path2.dirname(filePath));
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    throw error;
  }
}
function writeJsonAtomic(filePath, data) {
  writeAtomic(filePath, JSON.stringify(data, null, 2));
}
async function writeJsonLocked(filePath, data, options = {}) {
  const release = await acquireLock(filePath, options);
  try {
    writeJsonAtomic(filePath, data);
  } finally {
    release();
  }
}
function writeJsonLockedSync(filePath, data, options = {}) {
  const release = acquireLockSync(filePath, options);
  try {
    writeJsonAtomic(filePath, data);
  } finally {
    release();
  }
}
function deepMerge(target, patch) {
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    const patchValue = patch[key];
    if (patchValue === undefined) {
      continue;
    }
    if (patchValue !== null && typeof patchValue === "object" && !Array.isArray(patchValue) && result[key] !== null && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], patchValue);
    } else {
      result[key] = patchValue;
    }
  }
  return result;
}
async function patchJsonLocked(filePath, patch, options = {}) {
  const release = await acquireLock(filePath, options);
  try {
    const current = readJson(filePath) || {};
    const merged = deepMerge(current, patch);
    writeJsonAtomic(filePath, merged);
    return merged;
  } finally {
    release();
  }
}
function patchJsonLockedSync(filePath, patch, options = {}) {
  const release = acquireLockSync(filePath, options);
  try {
    const current = readJson(filePath) || {};
    const merged = deepMerge(current, patch);
    writeJsonAtomic(filePath, merged);
    return merged;
  } finally {
    release();
  }
}
function readText(filePath) {
  if (!fs.existsSync(filePath))
    return null;
  return fs.readFileSync(filePath, "utf-8");
}
function writeText(filePath, content) {
  ensureDir(path2.dirname(filePath));
  fs.writeFileSync(filePath, content);
}
// src/utils/detection.ts
import * as path3 from "path";
import * as fs2 from "fs";
function detectContext(cwd) {
  const result = {
    projectRoot: cwd,
    feature: null,
    task: null,
    isWorktree: false,
    mainProjectRoot: null
  };
  const normalizedCwd = normalizePath(cwd);
  const worktreeMatch = normalizedCwd.match(/(.+)\/\.hive\/\.worktrees\/([^/]+)\/([^/]+)/);
  if (worktreeMatch) {
    result.mainProjectRoot = worktreeMatch[1];
    result.feature = worktreeMatch[2];
    result.task = worktreeMatch[3];
    result.isWorktree = true;
    result.projectRoot = worktreeMatch[1];
    return result;
  }
  const gitPath = path3.join(cwd, ".git");
  if (fs2.existsSync(gitPath)) {
    const stat = fs2.statSync(gitPath);
    if (stat.isFile()) {
      const gitContent = fs2.readFileSync(gitPath, "utf-8").trim();
      const gitdirMatch = gitContent.match(/gitdir:\s*(.+)/);
      if (gitdirMatch) {
        const gitdir = gitdirMatch[1];
        const normalizedGitdir = normalizePath(gitdir);
        const worktreePathMatch = normalizedGitdir.match(/(.+)\/\.git\/worktrees\/(.+)/);
        if (worktreePathMatch) {
          const mainRepo = worktreePathMatch[1];
          const cwdWorktreeMatch = normalizedCwd.match(/\.hive\/\.worktrees\/([^/]+)\/([^/]+)/);
          if (cwdWorktreeMatch) {
            result.mainProjectRoot = mainRepo;
            result.feature = cwdWorktreeMatch[1];
            result.task = cwdWorktreeMatch[2];
            result.isWorktree = true;
            result.projectRoot = mainRepo;
            return result;
          }
        }
      }
    }
  }
  return result;
}
function listFeatures(projectRoot) {
  const featuresPath = getFeaturesPath(projectRoot);
  if (!fs2.existsSync(featuresPath))
    return [];
  return fs2.readdirSync(featuresPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}
function getFeatureData(projectRoot, featureName) {
  const featurePath = getFeaturePath(projectRoot, featureName);
  const featureJsonPath = path3.join(featurePath, "feature.json");
  return readJson(featureJsonPath);
}
function findProjectRoot(startDir) {
  let current = startDir;
  const root = path3.parse(current).root;
  while (current !== root) {
    if (fs2.existsSync(path3.join(current, ".hive"))) {
      return current;
    }
    if (fs2.existsSync(path3.join(current, ".git"))) {
      return current;
    }
    current = path3.dirname(current);
  }
  return null;
}
// src/services/featureService.ts
import * as fs3 from "fs";
class FeatureService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  create(name, ticket) {
    const featurePath = getFeaturePath(this.projectRoot, name);
    if (fileExists(featurePath)) {
      throw new Error(`Feature '${name}' already exists`);
    }
    ensureDir(featurePath);
    ensureDir(getContextPath(this.projectRoot, name));
    ensureDir(getTasksPath(this.projectRoot, name));
    const feature = {
      name,
      status: "planning",
      ticket,
      createdAt: new Date().toISOString()
    };
    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);
    return feature;
  }
  get(name) {
    return readJson(getFeatureJsonPath(this.projectRoot, name));
  }
  list() {
    const featuresPath = getFeaturesPath(this.projectRoot);
    if (!fileExists(featuresPath))
      return [];
    return fs3.readdirSync(featuresPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  }
  getActive() {
    const features = this.list();
    for (const name of features) {
      const feature = this.get(name);
      if (feature && feature.status !== "completed") {
        return feature;
      }
    }
    return null;
  }
  updateStatus(name, status) {
    const feature = this.get(name);
    if (!feature)
      throw new Error(`Feature '${name}' not found`);
    feature.status = status;
    if (status === "approved" && !feature.approvedAt) {
      feature.approvedAt = new Date().toISOString();
    }
    if (status === "completed" && !feature.completedAt) {
      feature.completedAt = new Date().toISOString();
    }
    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);
    return feature;
  }
  getInfo(name) {
    const feature = this.get(name);
    if (!feature)
      return null;
    const tasks = this.getTasks(name);
    const hasPlan = fileExists(getPlanPath(this.projectRoot, name));
    const comments = readJson(getCommentsPath(this.projectRoot, name));
    const commentCount = comments?.threads?.length || 0;
    return {
      name: feature.name,
      status: feature.status,
      tasks,
      hasPlan,
      commentCount
    };
  }
  getTasks(featureName) {
    const tasksPath = getTasksPath(this.projectRoot, featureName);
    if (!fileExists(tasksPath))
      return [];
    const folders = fs3.readdirSync(tasksPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    return folders.map((folder) => {
      const statusPath = `${tasksPath}/${folder}/status.json`;
      const status = readJson(statusPath);
      const name = folder.replace(/^\d+-/, "");
      return {
        folder,
        name,
        status: status?.status || "pending",
        origin: status?.origin || "plan",
        planTitle: status?.planTitle,
        summary: status?.summary
      };
    });
  }
  complete(name) {
    const feature = this.get(name);
    if (!feature)
      throw new Error(`Feature '${name}' not found`);
    if (feature.status === "completed") {
      throw new Error(`Feature '${name}' is already completed`);
    }
    return this.updateStatus(name, "completed");
  }
  setSession(name, sessionId) {
    const feature = this.get(name);
    if (!feature)
      throw new Error(`Feature '${name}' not found`);
    feature.sessionId = sessionId;
    writeJson(getFeatureJsonPath(this.projectRoot, name), feature);
  }
  getSession(name) {
    const feature = this.get(name);
    return feature?.sessionId;
  }
}
// src/services/planService.ts
import * as fs4 from "fs";

class PlanService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  write(featureName, content) {
    const planPath = getPlanPath(this.projectRoot, featureName);
    writeText(planPath, content);
    this.clearComments(featureName);
    this.revokeApproval(featureName);
    return planPath;
  }
  read(featureName) {
    const planPath = getPlanPath(this.projectRoot, featureName);
    const content = readText(planPath);
    if (content === null)
      return null;
    const comments = this.getComments(featureName);
    const isApproved = this.isApproved(featureName);
    return {
      content,
      status: isApproved ? "approved" : "planning",
      comments
    };
  }
  approve(featureName) {
    if (!fileExists(getPlanPath(this.projectRoot, featureName))) {
      throw new Error(`No plan.md found for feature '${featureName}'`);
    }
    const approvedPath = getApprovedPath(this.projectRoot, featureName);
    const timestamp = new Date().toISOString();
    fs4.writeFileSync(approvedPath, `Approved at ${timestamp}
`);
    const featurePath = getFeatureJsonPath(this.projectRoot, featureName);
    const feature = readJson(featurePath);
    if (feature) {
      feature.status = "approved";
      feature.approvedAt = timestamp;
      writeJson(featurePath, feature);
    }
  }
  isApproved(featureName) {
    return fileExists(getApprovedPath(this.projectRoot, featureName));
  }
  revokeApproval(featureName) {
    const approvedPath = getApprovedPath(this.projectRoot, featureName);
    if (fileExists(approvedPath)) {
      fs4.unlinkSync(approvedPath);
    }
    const featurePath = getFeatureJsonPath(this.projectRoot, featureName);
    const feature = readJson(featurePath);
    if (feature && feature.status === "approved") {
      feature.status = "planning";
      delete feature.approvedAt;
      writeJson(featurePath, feature);
    }
  }
  getComments(featureName) {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    const data = readJson(commentsPath);
    return data?.threads || [];
  }
  addComment(featureName, comment) {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    const data = readJson(commentsPath) || { threads: [] };
    const newComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    data.threads.push(newComment);
    writeJson(commentsPath, data);
    return newComment;
  }
  clearComments(featureName) {
    const commentsPath = getCommentsPath(this.projectRoot, featureName);
    writeJson(commentsPath, { threads: [] });
  }
}
// src/services/taskService.ts
import * as fs5 from "fs";
var TASK_STATUS_SCHEMA_VERSION = 1;

class TaskService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  sync(featureName) {
    const planPath = getPlanPath(this.projectRoot, featureName);
    const planContent = readText(planPath);
    if (!planContent) {
      throw new Error(`No plan.md found for feature '${featureName}'`);
    }
    const planTasks = this.parseTasksFromPlan(planContent);
    const warnings = this.collectSyncWarnings(planContent, planTasks);
    this.validateDependencyGraph(planTasks, featureName);
    const existingTasks = this.list(featureName);
    const result = {
      created: [],
      removed: [],
      kept: [],
      manual: [],
      ...warnings.length > 0 && { warnings }
    };
    const existingByName = new Map(existingTasks.map((t) => [t.folder, t]));
    for (const existing of existingTasks) {
      if (existing.origin === "manual") {
        result.manual.push(existing.folder);
        continue;
      }
      if (existing.status === "done" || existing.status === "in_progress") {
        result.kept.push(existing.folder);
        continue;
      }
      if (existing.status === "cancelled") {
        this.deleteTask(featureName, existing.folder);
        result.removed.push(existing.folder);
        continue;
      }
      const stillInPlan = planTasks.some((p) => p.folder === existing.folder);
      if (!stillInPlan) {
        this.deleteTask(featureName, existing.folder);
        result.removed.push(existing.folder);
      } else {
        result.kept.push(existing.folder);
      }
    }
    for (const planTask of planTasks) {
      if (!existingByName.has(planTask.folder)) {
        this.createFromPlan(featureName, planTask, planTasks, planContent);
        result.created.push(planTask.folder);
      }
    }
    return result;
  }
  create(featureName, name, order) {
    const tasksPath = getTasksPath(this.projectRoot, featureName);
    const existingFolders = this.listFolders(featureName);
    const nextOrder = order ?? this.getNextOrder(existingFolders);
    const folder = `${String(nextOrder).padStart(2, "0")}-${name}`;
    const taskPath = getTaskPath(this.projectRoot, featureName, folder);
    ensureDir(taskPath);
    const status = {
      status: "pending",
      origin: "manual",
      planTitle: name
    };
    writeJson(getTaskStatusPath(this.projectRoot, featureName, folder), status);
    return folder;
  }
  createFromPlan(featureName, task, allTasks, planContent) {
    const taskPath = getTaskPath(this.projectRoot, featureName, task.folder);
    ensureDir(taskPath);
    const dependsOn = this.resolveDependencies(task, allTasks);
    const status = {
      status: "pending",
      origin: "plan",
      planTitle: task.name,
      dependsOn
    };
    writeJson(getTaskStatusPath(this.projectRoot, featureName, task.folder), status);
    const specContent = this.buildSpecContent({
      featureName,
      task,
      dependsOn,
      allTasks,
      planContent
    });
    writeText(getTaskSpecPath(this.projectRoot, featureName, task.folder), specContent);
  }
  buildSpecContent(params) {
    const { featureName, task, dependsOn, allTasks, planContent, contextFiles = [], completedTasks = [] } = params;
    const getTaskType = (planSection, taskName) => {
      if (!planSection) {
        return null;
      }
      const fileTypeMatches = Array.from(planSection.matchAll(/-\s*(Create|Modify|Test):/gi)).map((match) => match[1].toLowerCase());
      const fileTypes = new Set(fileTypeMatches);
      if (fileTypes.size === 0) {
        return taskName.toLowerCase().includes("test") ? "testing" : null;
      }
      if (fileTypes.size === 1) {
        const onlyType = Array.from(fileTypes)[0];
        if (onlyType === "create")
          return "greenfield";
        if (onlyType === "test")
          return "testing";
      }
      if (fileTypes.has("modify")) {
        return "modification";
      }
      return null;
    };
    const specLines = [
      `# Task: ${task.folder}`,
      "",
      `## Feature: ${featureName}`,
      "",
      "## Dependencies",
      ""
    ];
    if (dependsOn.length > 0) {
      for (const dep of dependsOn) {
        const depTask = allTasks.find((t) => t.folder === dep);
        if (depTask) {
          specLines.push(`- **${depTask.order}. ${depTask.name}** (${dep})`);
        } else {
          specLines.push(`- ${dep}`);
        }
      }
    } else {
      specLines.push("_None_");
    }
    specLines.push("", "## Plan Section", "");
    const planSection = this.extractPlanSection(planContent ?? null, task);
    if (planSection) {
      specLines.push(planSection.trim());
    } else {
      specLines.push("_No plan section available._");
    }
    specLines.push("");
    const taskType = getTaskType(planSection, task.name);
    if (taskType) {
      specLines.push("## Task Type", "", taskType, "");
    }
    if (contextFiles.length > 0) {
      const contextCompiled = contextFiles.map((f) => `## ${f.name}

${f.content}`).join(`

---

`);
      specLines.push("## Context", "", contextCompiled, "");
    }
    if (completedTasks.length > 0) {
      const completedLines = completedTasks.map((t) => `- ${t.name}: ${t.summary}`);
      specLines.push("## Completed Tasks", "", ...completedLines, "");
    }
    return specLines.join(`
`);
  }
  extractPlanSection(planContent, task) {
    if (!planContent)
      return null;
    const escapedTitle = task.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRegex = new RegExp(`###\\s*\\d+\\.\\s*${escapedTitle}[\\s\\S]*?(?=###|$)`, "i");
    let taskMatch = planContent.match(titleRegex);
    if (!taskMatch && task.order > 0) {
      const orderRegex = new RegExp(`###\\s*${task.order}\\.\\s*[^\\n]+[\\s\\S]*?(?=###|$)`, "i");
      taskMatch = planContent.match(orderRegex);
    }
    return taskMatch ? taskMatch[0].trim() : null;
  }
  resolveDependencies(task, allTasks) {
    if (task.dependsOnNumbers !== null && task.dependsOnNumbers.length === 0) {
      return [];
    }
    if (task.dependsOnNumbers !== null) {
      return task.dependsOnNumbers.map((num) => allTasks.find((t) => t.order === num)?.folder).filter((folder) => folder !== undefined);
    }
    if (task.order === 1) {
      return [];
    }
    const previousTask = allTasks.find((t) => t.order === task.order - 1);
    return previousTask ? [previousTask.folder] : [];
  }
  validateDependencyGraph(tasks, featureName) {
    const taskNumbers = new Set(tasks.map((t) => t.order));
    for (const task of tasks) {
      if (task.dependsOnNumbers === null) {
        continue;
      }
      for (const depNum of task.dependsOnNumbers) {
        if (depNum === task.order) {
          throw new Error(`Invalid dependency graph in plan.md: Self-dependency detected for task ${task.order} ("${task.name}"). ` + `A task cannot depend on itself. Please fix the "Depends on:" line in plan.md.`);
        }
        if (!taskNumbers.has(depNum)) {
          throw new Error(`Invalid dependency graph in plan.md: Unknown task number ${depNum} referenced in dependencies for task ${task.order} ("${task.name}"). ` + `Available task numbers are: ${Array.from(taskNumbers).sort((a, b) => a - b).join(", ")}. ` + `Please fix the "Depends on:" line in plan.md.`);
        }
      }
    }
    this.detectCycles(tasks);
  }
  detectCycles(tasks) {
    const taskByOrder = new Map(tasks.map((t) => [t.order, t]));
    const getDependencies = (task) => {
      if (task.dependsOnNumbers !== null) {
        return task.dependsOnNumbers;
      }
      if (task.order === 1) {
        return [];
      }
      return [task.order - 1];
    };
    const visited = new Map;
    const path = [];
    const dfs = (taskOrder) => {
      const state = visited.get(taskOrder);
      if (state === 2) {
        return;
      }
      if (state === 1) {
        const cycleStart = path.indexOf(taskOrder);
        const cyclePath = [...path.slice(cycleStart), taskOrder];
        const cycleDesc = cyclePath.join(" -> ");
        throw new Error(`Invalid dependency graph in plan.md: Cycle detected in task dependencies: ${cycleDesc}. ` + `Tasks cannot have circular dependencies. Please fix the "Depends on:" lines in plan.md.`);
      }
      visited.set(taskOrder, 1);
      path.push(taskOrder);
      const task = taskByOrder.get(taskOrder);
      if (task) {
        const deps = getDependencies(task);
        for (const depOrder of deps) {
          dfs(depOrder);
        }
      }
      path.pop();
      visited.set(taskOrder, 2);
    };
    for (const task of tasks) {
      if (!visited.has(task.order)) {
        dfs(task.order);
      }
    }
  }
  writeSpec(featureName, taskFolder, content) {
    const specPath = getTaskSpecPath(this.projectRoot, featureName, taskFolder);
    writeText(specPath, content);
    return specPath;
  }
  update(featureName, taskFolder, updates, lockOptions) {
    const statusPath = getTaskStatusPath(this.projectRoot, featureName, taskFolder);
    if (!fileExists(statusPath)) {
      throw new Error(`Task '${taskFolder}' not found`);
    }
    const release = acquireLockSync(statusPath, lockOptions);
    try {
      const current = readJson(statusPath);
      if (!current) {
        throw new Error(`Task '${taskFolder}' not found`);
      }
      const updated = {
        ...current,
        ...updates,
        schemaVersion: TASK_STATUS_SCHEMA_VERSION
      };
      if (updates.status === "in_progress" && !current.startedAt) {
        updated.startedAt = new Date().toISOString();
      }
      if (updates.status === "done" && !current.completedAt) {
        updated.completedAt = new Date().toISOString();
      }
      writeJsonAtomic(statusPath, updated);
      return updated;
    } finally {
      release();
    }
  }
  patchBackgroundFields(featureName, taskFolder, patch, lockOptions) {
    const statusPath = getTaskStatusPath(this.projectRoot, featureName, taskFolder);
    const safePatch = {
      schemaVersion: TASK_STATUS_SCHEMA_VERSION
    };
    if (patch.idempotencyKey !== undefined) {
      safePatch.idempotencyKey = patch.idempotencyKey;
    }
    if (patch.workerSession !== undefined) {
      safePatch.workerSession = patch.workerSession;
    }
    return patchJsonLockedSync(statusPath, safePatch, lockOptions);
  }
  getRawStatus(featureName, taskFolder) {
    const statusPath = getTaskStatusPath(this.projectRoot, featureName, taskFolder);
    return readJson(statusPath);
  }
  get(featureName, taskFolder) {
    const statusPath = getTaskStatusPath(this.projectRoot, featureName, taskFolder);
    const status = readJson(statusPath);
    if (!status)
      return null;
    return {
      folder: taskFolder,
      name: taskFolder.replace(/^\d+-/, ""),
      status: status.status,
      origin: status.origin,
      planTitle: status.planTitle,
      summary: status.summary
    };
  }
  list(featureName) {
    const folders = this.listFolders(featureName);
    return folders.map((folder) => this.get(featureName, folder)).filter((t) => t !== null);
  }
  writeReport(featureName, taskFolder, report) {
    const reportPath = getTaskReportPath(this.projectRoot, featureName, taskFolder);
    writeText(reportPath, report);
    return reportPath;
  }
  listFolders(featureName) {
    const tasksPath = getTasksPath(this.projectRoot, featureName);
    if (!fileExists(tasksPath))
      return [];
    return fs5.readdirSync(tasksPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  }
  deleteTask(featureName, taskFolder) {
    const taskPath = getTaskPath(this.projectRoot, featureName, taskFolder);
    if (fileExists(taskPath)) {
      fs5.rmSync(taskPath, { recursive: true });
    }
  }
  getNextOrder(existingFolders) {
    if (existingFolders.length === 0)
      return 1;
    const orders = existingFolders.map((f) => parseInt(f.split("-")[0], 10)).filter((n) => !isNaN(n));
    return Math.max(...orders, 0) + 1;
  }
  collectSyncWarnings(planContent, planTasks) {
    if (planTasks.length > 0)
      return [];
    const lines = planContent.split(`
`);
    const hasTasksSection = lines.some((line) => /^##\s+Tasks\b/i.test(line));
    if (!hasTasksSection)
      return [];
    const headers = lines.filter((line) => /^###\s+/.test(line)).map((line) => line.trim());
    const detail = headers.length > 0 ? `Found headers that do not match: ${headers.slice(0, 3).map((h) => `"${h}"`).join(", ")}.` : 'No "###" task headers were found.';
    return [
      `No tasks were generated from the plan. ${detail} Task headers must look like "### 1. Task name" (number, dot, name).`
    ];
  }
  parseTasksFromPlan(content) {
    const tasks = [];
    const lines = content.split(`
`);
    let currentTask = null;
    let descriptionLines = [];
    const dependsOnRegex = /^\s*\*{0,2}Depends\s+on\*{0,2}\s*:\s*(.+)$/i;
    for (const line of lines) {
      const taskMatch = line.match(/^###\s+(\d+)\.\s+(.+)$/);
      if (taskMatch) {
        if (currentTask) {
          currentTask.description = descriptionLines.join(`
`).trim();
          tasks.push(currentTask);
        }
        const order = parseInt(taskMatch[1], 10);
        const rawName = taskMatch[2].trim();
        const folderName = rawName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const folder = `${String(order).padStart(2, "0")}-${folderName}`;
        currentTask = {
          folder,
          order,
          name: rawName,
          description: "",
          dependsOnNumbers: null
        };
        descriptionLines = [];
      } else if (currentTask) {
        if (line.match(/^##\s+/) || line.match(/^###\s+[^0-9]/)) {
          currentTask.description = descriptionLines.join(`
`).trim();
          tasks.push(currentTask);
          currentTask = null;
          descriptionLines = [];
        } else {
          const dependsMatch = line.match(dependsOnRegex);
          if (dependsMatch) {
            const value = dependsMatch[1].trim().toLowerCase();
            if (value === "none") {
              currentTask.dependsOnNumbers = [];
            } else {
              const numbers = value.split(/[,\s]+/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
              currentTask.dependsOnNumbers = numbers;
            }
          }
          descriptionLines.push(line);
        }
      }
    }
    if (currentTask) {
      currentTask.description = descriptionLines.join(`
`).trim();
      tasks.push(currentTask);
    }
    return tasks;
  }
  createSubtask(featureName, taskFolder, name, type) {
    const subtasksPath = getSubtasksPath(this.projectRoot, featureName, taskFolder);
    ensureDir(subtasksPath);
    const existingFolders = this.listSubtaskFolders(featureName, taskFolder);
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    const nextOrder = existingFolders.length + 1;
    const subtaskId = `${taskOrder}.${nextOrder}`;
    const folderName = `${nextOrder}-${this.slugify(name)}`;
    const subtaskPath = getSubtaskPath(this.projectRoot, featureName, taskFolder, folderName);
    ensureDir(subtaskPath);
    const subtaskStatus = {
      status: "pending",
      type,
      createdAt: new Date().toISOString()
    };
    writeJson(getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, folderName), subtaskStatus);
    const specContent = `# Subtask: ${name}

**Type:** ${type || "custom"}
**ID:** ${subtaskId}

## Instructions

_Add detailed instructions here_
`;
    writeText(getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, folderName), specContent);
    return {
      id: subtaskId,
      name,
      folder: folderName,
      status: "pending",
      type,
      createdAt: subtaskStatus.createdAt
    };
  }
  updateSubtask(featureName, taskFolder, subtaskId, status) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    const current = readJson(statusPath);
    if (!current) {
      throw new Error(`Subtask status not found for '${subtaskId}'`);
    }
    const updated = { ...current, status };
    if (status === "done" && !current.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    writeJson(statusPath, updated);
    const name = subtaskFolder.replace(/^\d+-/, "");
    return {
      id: subtaskId,
      name,
      folder: subtaskFolder,
      status,
      type: current.type,
      createdAt: current.createdAt,
      completedAt: updated.completedAt
    };
  }
  listSubtasks(featureName, taskFolder) {
    const folders = this.listSubtaskFolders(featureName, taskFolder);
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    return folders.map((folder, index) => {
      const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, folder);
      const status = readJson(statusPath);
      const name = folder.replace(/^\d+-/, "");
      const subtaskOrder = parseInt(folder.split("-")[0], 10) || index + 1;
      return {
        id: `${taskOrder}.${subtaskOrder}`,
        name,
        folder,
        status: status?.status || "pending",
        type: status?.type,
        createdAt: status?.createdAt,
        completedAt: status?.completedAt
      };
    });
  }
  deleteSubtask(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const subtaskPath = getSubtaskPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    if (fileExists(subtaskPath)) {
      fs5.rmSync(subtaskPath, { recursive: true });
    }
  }
  getSubtask(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    const status = readJson(statusPath);
    if (!status)
      return null;
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    const subtaskOrder = parseInt(subtaskFolder.split("-")[0], 10);
    const name = subtaskFolder.replace(/^\d+-/, "");
    return {
      id: `${taskOrder}.${subtaskOrder}`,
      name,
      folder: subtaskFolder,
      status: status.status,
      type: status.type,
      createdAt: status.createdAt,
      completedAt: status.completedAt
    };
  }
  writeSubtaskSpec(featureName, taskFolder, subtaskId, content) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const specPath = getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    writeText(specPath, content);
    return specPath;
  }
  writeSubtaskReport(featureName, taskFolder, subtaskId, content) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const reportPath = getSubtaskReportPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    writeText(reportPath, content);
    return reportPath;
  }
  readSubtaskSpec(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const specPath = getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    return readText(specPath);
  }
  readSubtaskReport(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findSubtaskFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const reportPath = getSubtaskReportPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    return readText(reportPath);
  }
  listSubtaskFolders(featureName, taskFolder) {
    const subtasksPath = getSubtasksPath(this.projectRoot, featureName, taskFolder);
    if (!fileExists(subtasksPath))
      return [];
    return fs5.readdirSync(subtasksPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  }
  findSubtaskFolder(featureName, taskFolder, subtaskId) {
    const folders = this.listSubtaskFolders(featureName, taskFolder);
    const subtaskOrder = subtaskId.split(".")[1];
    return folders.find((f) => f.startsWith(`${subtaskOrder}-`)) || null;
  }
  slugify(name) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }
}
// src/services/subtaskService.ts
import * as fs6 from "fs";
class SubtaskService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  create(featureName, taskFolder, name, type) {
    const subtasksPath = getSubtasksPath(this.projectRoot, featureName, taskFolder);
    ensureDir(subtasksPath);
    const existingFolders = this.listFolders(featureName, taskFolder);
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    const nextOrder = existingFolders.length + 1;
    const subtaskId = `${taskOrder}.${nextOrder}`;
    const folderName = `${nextOrder}-${this.slugify(name)}`;
    const subtaskPath = getSubtaskPath(this.projectRoot, featureName, taskFolder, folderName);
    ensureDir(subtaskPath);
    const subtaskStatus = {
      status: "pending",
      type,
      createdAt: new Date().toISOString()
    };
    writeJson(getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, folderName), subtaskStatus);
    const specContent = `# Subtask: ${name}

**Type:** ${type || "custom"}
**ID:** ${subtaskId}

## Instructions

_Add detailed instructions here_
`;
    writeText(getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, folderName), specContent);
    return {
      id: subtaskId,
      name,
      folder: folderName,
      status: "pending",
      type,
      createdAt: subtaskStatus.createdAt
    };
  }
  update(featureName, taskFolder, subtaskId, status) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    const current = readJson(statusPath);
    if (!current) {
      throw new Error(`Subtask status not found for '${subtaskId}'`);
    }
    const updated = { ...current, status };
    if (status === "done" && !current.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    writeJson(statusPath, updated);
    const name = subtaskFolder.replace(/^\d+-/, "");
    return {
      id: subtaskId,
      name,
      folder: subtaskFolder,
      status,
      type: current.type,
      createdAt: current.createdAt,
      completedAt: updated.completedAt
    };
  }
  list(featureName, taskFolder) {
    const folders = this.listFolders(featureName, taskFolder);
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    return folders.map((folder, index) => {
      const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, folder);
      const status = readJson(statusPath);
      const name = folder.replace(/^\d+-/, "");
      const subtaskOrder = parseInt(folder.split("-")[0], 10) || index + 1;
      return {
        id: `${taskOrder}.${subtaskOrder}`,
        name,
        folder,
        status: status?.status || "pending",
        type: status?.type,
        createdAt: status?.createdAt,
        completedAt: status?.completedAt
      };
    });
  }
  get(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const statusPath = getSubtaskStatusPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    const status = readJson(statusPath);
    if (!status)
      return null;
    const taskOrder = parseInt(taskFolder.split("-")[0], 10);
    const subtaskOrder = parseInt(subtaskFolder.split("-")[0], 10);
    const name = subtaskFolder.replace(/^\d+-/, "");
    return {
      id: `${taskOrder}.${subtaskOrder}`,
      name,
      folder: subtaskFolder,
      status: status.status,
      type: status.type,
      createdAt: status.createdAt,
      completedAt: status.completedAt
    };
  }
  writeSpec(featureName, taskFolder, subtaskId, content) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const specPath = getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    writeText(specPath, content);
    return specPath;
  }
  writeReport(featureName, taskFolder, subtaskId, content) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const reportPath = getSubtaskReportPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    writeText(reportPath, content);
    return reportPath;
  }
  readSpec(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const specPath = getSubtaskSpecPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    return readText(specPath);
  }
  readReport(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder)
      return null;
    const reportPath = getSubtaskReportPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    return readText(reportPath);
  }
  delete(featureName, taskFolder, subtaskId) {
    const subtaskFolder = this.findFolder(featureName, taskFolder, subtaskId);
    if (!subtaskFolder) {
      throw new Error(`Subtask '${subtaskId}' not found in task '${taskFolder}'`);
    }
    const subtaskPath = getSubtaskPath(this.projectRoot, featureName, taskFolder, subtaskFolder);
    if (fileExists(subtaskPath)) {
      fs6.rmSync(subtaskPath, { recursive: true });
    }
  }
  listFolders(featureName, taskFolder) {
    const subtasksPath = getSubtasksPath(this.projectRoot, featureName, taskFolder);
    if (!fileExists(subtasksPath))
      return [];
    return fs6.readdirSync(subtasksPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  }
  findFolder(featureName, taskFolder, subtaskId) {
    const folders = this.listFolders(featureName, taskFolder);
    const subtaskOrder = subtaskId.split(".")[1];
    return folders.find((f) => f.startsWith(`${subtaskOrder}-`)) || null;
  }
  slugify(name) {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }
}
// src/services/worktreeService.ts
import * as fs8 from "fs/promises";
import * as path4 from "path";

// ../../node_modules/.bun/@simple-git+args-pathspec@1.0.4/node_modules/@simple-git/args-pathspec/dist/index.mjs
var t = /* @__PURE__ */ new WeakMap;
function c(...n) {
  const e = new String(n);
  return t.set(e, n), e;
}
function r(n) {
  return n instanceof String && t.has(n);
}
function o(n) {
  return t.get(n) ?? [];
}

// ../../node_modules/.bun/simple-git@4.0.2/node_modules/simple-git/dist/index.mjs
var import_file_exists = __toESM(require_dist(), 1);
var import_debug = __toESM(require_src(), 1);
var import_promise_deferred = __toESM(require_dist2(), 1);
import { spawn as ve } from "node:child_process";
import { normalize as Se } from "node:path";

// ../../node_modules/.bun/@simple-git+argv-parser@2.0.1/node_modules/@simple-git/argv-parser/dist/index.mjs
function* x(e, n) {
  const t = n === "global";
  for (const o of e)
    o.isGlobal === t && (yield o);
}
var P = /* @__PURE__ */ new Set([
  "--add",
  "--edit",
  "--remove-section",
  "--rename-section",
  "--replace-all",
  "--unset",
  "--unset-all",
  "-e"
]);
var S = /* @__PURE__ */ new Set([
  "--get",
  "--get-all",
  "--get-color",
  "--get-colorbool",
  "--get-regexp",
  "--get-urlmatch",
  "--list",
  "-l"
]);
var E = /* @__PURE__ */ new Set([
  "edit",
  "remove-section",
  "rename-section",
  "set",
  "unset"
]);
var F = /* @__PURE__ */ new Set(["get", "get-color", "get-colorbool", "list"]);
function A(e, n) {
  for (const { name: o } of x(e, "task")) {
    if (P.has(o))
      return w(true, n);
    if (S.has(o))
      return w(false, n);
  }
  const t = n.at(0)?.toLowerCase();
  return t === undefined ? null : E.has(t) ? w(true, n.slice(1)) : F.has(t) ? w(false, n.slice(1)) : n.length === 1 ? w(false, n) : w(true, n);
}
function w(e = false, n = []) {
  const t = n.at(0)?.toLowerCase();
  return t === undefined ? null : {
    isWrite: e,
    isRead: !e,
    key: t,
    value: n.at(1)
  };
}
function O(e, n) {
  return n.isWrite && n.value !== undefined ? { key: n.key, value: n.value, scope: e } : { key: n.key, scope: e };
}
function G(e) {
  const n = e?.indexOf("=") || -1;
  return !e || n < 0 ? null : {
    key: e.slice(0, n).trim().toLowerCase(),
    value: e.slice(n + 1)
  };
}
function M(e) {
  for (const { name: n } of x(e, "task"))
    switch (n) {
      case "--global":
        return "global";
      case "--system":
        return "system";
      case "--worktree":
        return "worktree";
      case "--local":
        return "local";
      case "--file":
      case "-f":
        return "file";
    }
  return "local";
}
function N({ name: e }) {
  if (e === "-c" || e === "--config")
    return "inline";
  if (e === "--config-env")
    return "env";
}
function* $(e) {
  for (const n of e) {
    const t = N(n), o = t && G(n.value);
    o && (yield {
      ...o,
      scope: t
    });
  }
}
function D(e, n, t) {
  const o = {
    read: [],
    write: [...$(n)]
  };
  return e === "config" && L(o, M(n), A(n, t)), o;
}
function L(e, n, t) {
  if (t === null)
    return;
  const o = O(n, t);
  t.isWrite ? e.write.push(o) : e.read.push(o);
}
var C = {
  short: /* @__PURE__ */ new Map([
    ["c", true]
  ])
};
var I = {
  short: new Map([
    ["C", true],
    ["P", false],
    ["h", false],
    ["p", false],
    ["v", false],
    ...C.short.entries()
  ]),
  long: /* @__PURE__ */ new Set([
    "attr-source",
    "config-env",
    "exec-path",
    "git-dir",
    "list-cmds",
    "namespace",
    "super-prefix",
    "work-tree"
  ])
};
var R = {
  clone: {
    short: /* @__PURE__ */ new Map([
      ["b", true],
      ["j", true],
      ["l", false],
      ["n", false],
      ["o", true],
      ["q", false],
      ["s", false],
      ["u", true]
    ]),
    long: /* @__PURE__ */ new Set(["branch", "config", "jobs", "origin", "upload-pack", "u", "template"])
  },
  commit: {
    short: /* @__PURE__ */ new Map([
      ["C", true],
      ["F", true],
      ["c", true],
      ["m", true],
      ["t", true]
    ]),
    long: /* @__PURE__ */ new Set(["file", "message", "reedit-message", "reuse-message", "template"])
  },
  config: {
    short: /* @__PURE__ */ new Map([
      ["e", false],
      ["f", true],
      ["l", false]
    ]),
    long: /* @__PURE__ */ new Set(["blob", "comment", "default", "file", "type", "value"])
  },
  fetch: {
    short: /* @__PURE__ */ new Map,
    long: /* @__PURE__ */ new Set(["upload-pack"])
  },
  init: {
    short: /* @__PURE__ */ new Map,
    long: /* @__PURE__ */ new Set(["template"])
  },
  pull: {
    short: /* @__PURE__ */ new Map,
    long: /* @__PURE__ */ new Set(["upload-pack"])
  },
  push: {
    short: /* @__PURE__ */ new Map,
    long: /* @__PURE__ */ new Set(["exec", "receive-pack"])
  },
  rebase: {
    short: /* @__PURE__ */ new Map([
      ["X", true],
      ["f", false],
      ["i", false],
      ["k", false],
      ["m", false],
      ["n", false],
      ["q", false],
      ["r", false],
      ["s", true],
      ["v", false],
      ["x", true]
    ]),
    long: /* @__PURE__ */ new Set(["exec", "onto", "strategy", "strategy-option"])
  }
};
var T = { short: /* @__PURE__ */ new Map, long: /* @__PURE__ */ new Set };
function B(e) {
  const n = R[e ?? ""] ?? T;
  return {
    short: new Map([...C.short.entries(), ...n.short.entries()]),
    long: n.long
  };
}
function b(e, n = I) {
  if (e.startsWith("--")) {
    const t = e.indexOf("=");
    if (t > 2)
      return [{ name: e.slice(0, t), value: e.slice(t + 1), needsNext: false }];
    const o = e.slice(2);
    return [{ name: e, needsNext: n.long.has(o) }];
  }
  if (e.length === 2) {
    const t = e.charAt(1), o = n.short.get(t);
    return [{ name: e, needsNext: o === true }];
  }
  return j(e, n.short);
}
function j(e, n) {
  const t = e.slice(1).split(""), o = [];
  for (let a = 0;a < t.length; a++) {
    const s = t[a], r = n.get(s);
    if (r === undefined)
      return [{ name: e, needsNext: false }];
    if (r) {
      const i = t.slice(a + 1).join("");
      if (i && ![...i].every((m) => n.has(m)))
        return o.push({ name: `-${s}`, value: i, needsNext: false }), o;
    }
    o.push({ name: `-${s}`, needsNext: r });
  }
  return o;
}
function W(e, n = []) {
  let t = 0;
  for (;t < e.length; ) {
    const o = String(e[t]);
    if (!o.startsWith("-") || o.length < 2)
      break;
    const a = b(o);
    let s = t + 1;
    for (const r of a) {
      const i = {
        name: r.name,
        value: r.value,
        absorbedNext: false,
        isGlobal: true
      };
      r.needsNext && i.value === undefined && s < e.length && (i.value = String(e[s]), i.absorbedNext = true, s++), n.push(i);
    }
    t = s;
  }
  return { flags: n, taskIndex: t };
}
function V(e, n, t = []) {
  const o2 = B(n), a = [], s = [];
  let r2 = 0;
  for (;r2 < e.length; ) {
    const i = e[r2];
    if (r(i)) {
      s.push(...o(i)), r2++;
      continue;
    }
    const p = String(i);
    if (p === "--") {
      for (let d = r2 + 1;d < e.length; d++) {
        const g = e[d];
        r(g) ? s.push(...o(g)) : s.push(String(g));
      }
      break;
    }
    if (!p.startsWith("-") || p.length < 2) {
      a.push(p), r2++;
      continue;
    }
    const m = b(p, o2);
    let u = r2 + 1;
    for (const d of m) {
      const g = {
        name: d.name,
        value: d.value,
        absorbedNext: false,
        isGlobal: false
      };
      d.needsNext && g.value === undefined && u < e.length && !r(e[u]) && (g.value = String(e[u]), g.absorbedNext = true, u++), t.push(g);
    }
    r2 = u;
  }
  return { flags: t, positionals: a, pathspecs: s };
}
function* q({
  write: e
}) {
  for (const n of e)
    for (const t of K) {
      const o = t(n.key);
      o && (yield o);
    }
}
function f(e, n, t = String(e)) {
  const o = typeof e == "string" ? new RegExp(`\\s*${e.toLowerCase()}`) : e;
  return function(s) {
    if (o.test(s))
      return {
        category: n,
        message: `Configuring ${t} is not permitted without enabling ${n}`
      };
  };
}
function l(e, n) {
  const t = new RegExp(`\\s*${e.toLowerCase().replace(/\./g, "(..+)?.")}`);
  return f(t, n, e);
}
var K = [
  f("alias", "allowUnsafeAlias"),
  f("core.askPass", "allowUnsafeAskPass"),
  f("core.editor", "allowUnsafeEditor"),
  f("core.fsmonitor", "allowUnsafeFsMonitor"),
  f("core.gitProxy", "allowUnsafeGitProxy"),
  f("core.hooksPath", "allowUnsafeHooksPath"),
  f("core.pager", "allowUnsafePager"),
  f("core.sshCommand", "allowUnsafeSshCommand"),
  l("credential.helper", "allowUnsafeCredentialHelper"),
  l("diff.command", "allowUnsafeDiffExternal"),
  f("diff.external", "allowUnsafeDiffExternal"),
  l("difftool.cmd", "allowUnsafeDiffExternal"),
  l("diff.textconv", "allowUnsafeDiffTextConv"),
  l("filter.clean", "allowUnsafeFilter"),
  l("filter.process", "allowUnsafeFilter"),
  l("filter.smudge", "allowUnsafeFilter"),
  l("gpg.program", "allowUnsafeGpgProgram"),
  f("include.path", "allowUnsafeInclude"),
  l("includeIf", "allowUnsafeInclude"),
  f("init.templateDir", "allowUnsafeTemplateDir"),
  l("pager.", "allowUnsafePager"),
  l("merge.driver", "allowUnsafeMergeDriver"),
  l("mergetool.path", "allowUnsafeMergeDriver"),
  l("mergetool.cmd", "allowUnsafeMergeDriver"),
  l("protocol.allow", "allowUnsafeProtocolOverride"),
  l("remote.receivepack", "allowUnsafePack"),
  l("remote.uploadpack", "allowUnsafePack"),
  f("uploadpack.packObjectsHook", "allowUnsafePack"),
  f("sequence.editor", "allowUnsafeEditor"),
  l("submodule.update", "allowUnsafeSubmodule"),
  l("tar.command", "allowUnsafeCommandBinaries"),
  l("trailer.cmd", "allowUnsafeCommandBinaries"),
  l("trailer.command", "allowUnsafeCommandBinaries"),
  l("url.insteadOf", "allowUnsafeUrlRewrite")
];
function* H(e, n) {
  for (const t of n)
    for (const o of X) {
      const a = o(e, t);
      a && (yield a);
    }
}
function c2(e, n, t, { name: o = String(n), globalOnly: a = false, withValue: s = false } = {}) {
  const r = typeof n == "string" ? new RegExp(`\\s*${n.toLowerCase()}`) : n, i = `Use of ${e ? `${e} with option ` : ""}${o} is not permitted without enabling ${t}`;
  return function(m, u) {
    if (!(e && m !== e) && !(a && !u.isGlobal) && !(s && u.value === undefined) && r.test(u.name))
      return {
        category: t,
        message: i
      };
  };
}
var h = { globalOnly: true, withValue: true };
var X = [
  c2(null, /--(upload|receive)-pack/, "allowUnsafePack", {
    name: "--upload-pack or --receive-pack"
  }),
  c2("clone", /^-\w*u/, "allowUnsafePack"),
  c2("clone", "--u", "allowUnsafePack"),
  c2("push", /^--exec$/, "allowUnsafePack", { name: "--exec" }),
  c2("rebase", /^(-x|--ex(ec?)?)$/, "allowUnsafeExec", { name: "-x or --exec" }),
  c2(null, "--template", "allowUnsafeTemplateDir"),
  c2(null, "--exec-path", "allowUnsafeExec", h),
  c2(null, "--git-dir", "allowUnsafeConfigPaths", h),
  c2(null, "--work-tree", "allowUnsafeConfigPaths", h),
  c2(null, /^-C$/, "allowUnsafeConfigPaths", { ...h, name: "-C" })
];
function k(e, n, t) {
  return [...H(e, n), ...q(t)];
}
function Y(...e) {
  const { flags: n, taskIndex: t } = W(e), o = t < e.length ? String(e[t]).toLowerCase() : null, a = o !== null ? e.slice(t + 1) : [], { positionals: s, pathspecs: r } = V(a, o, n), i = D(o, n, s);
  return {
    task: o,
    flags: n.map(J),
    paths: r,
    config: i,
    vulnerabilities: z(k(o, n, i))
  };
}
function z(e) {
  return Object.defineProperty(e, "vulnerabilities", {
    value: e
  });
}
function J({ value: e, name: n }) {
  return e !== undefined ? { name: n, value: e } : { name: n };
}
var y = {
  editor: "allowUnsafeEditor",
  git_askpass: "allowUnsafeAskPass",
  git_config_global: "allowUnsafeConfigPaths",
  git_config_system: "allowUnsafeConfigPaths",
  git_config_count: "allowUnsafeConfigEnvCount",
  git_config_parameters: "allowUnsafeConfigEnvCount",
  git_config: "allowUnsafeConfigPaths",
  git_editor: "allowUnsafeEditor",
  git_exec_path: "allowUnsafeExec",
  git_external_diff: "allowUnsafeDiffExternal",
  git_pager: "allowUnsafePager",
  git_proxy_command: "allowUnsafeGitProxy",
  git_template_dir: "allowUnsafeTemplateDir",
  git_sequence_editor: "allowUnsafeEditor",
  git_ssh: "allowUnsafeSshCommand",
  git_ssh_command: "allowUnsafeSshCommand",
  pager: "allowUnsafePager",
  prefix: "allowUnsafeConfigPaths",
  ssh_askpass: "allowUnsafeAskPass",
  visual: "allowUnsafeEditor"
};
function* Q(e) {
  const n = parseInt(e.git_config_count ?? "0", 10);
  for (let t = 0;t < n; t++) {
    const o = e[`git_config_key_${t}`], a = e[`git_config_value_${t}`];
    o !== undefined && (yield { key: o.toLowerCase().trim(), value: a, scope: "env" });
  }
}
function* Z(e) {
  for (const n of Object.keys(e))
    if (_(n)) {
      const t = y[n];
      yield {
        category: t,
        message: `Use of "${n.toUpperCase()}" is not permitted without enabling ${t}`
      };
    }
}
function _(e) {
  return Object.hasOwn(y, e);
}
function ee(e) {
  const n = {};
  for (const [t, o] of Object.entries(e)) {
    const a = t.toLowerCase().trim();
    (_(a) || a.startsWith("git")) && (n[a] = String(o));
  }
  return n;
}
function ne(e) {
  const n = ee(e), t = {
    read: [],
    write: [...Q(n)]
  }, o = [
    ...Z(n),
    ...k(null, [], t)
  ];
  return {
    config: t,
    vulnerabilities: o
  };
}
function oe(e, n) {
  return [...Y(...e).vulnerabilities, ...ne(n).vulnerabilities];
}

// ../../node_modules/.bun/simple-git@4.0.2/node_modules/simple-git/dist/index.mjs
import { EventEmitter as Ce } from "node:events";

class O2 extends Error {
  constructor(e, n) {
    super(n), this.task = e, Object.setPrototypeOf(this, new.target.prototype);
  }
}

class Ae extends O2 {
  constructor(e, n) {
    super(undefined, n), this.config = e;
  }
}

class A2 extends O2 {
  constructor(e, n, r) {
    super(e, r), this.task = e, this.plugin = n, Object.setPrototypeOf(this, new.target.prototype);
  }
}

class at extends O2 {
  constructor(e, n) {
    super(undefined, n || String(e)), this.git = e;
  }
}

class xe extends O2 {
  constructor(e) {
    super(undefined, e);
  }
}
var I2 = "\x00";
var W2 = () => {};
function Ne(t) {
  return typeof t != "function" ? W2 : t;
}
function $e(t) {
  return typeof t == "function" && t !== W2;
}
function Pe(t, e) {
  const n = t.indexOf(e);
  return n <= 0 ? [t, ""] : [t.substr(0, n), t.substr(n + 1)];
}
function Me(t, e = 0) {
  return Dt(t) && t.length > e ? t[e] : undefined;
}
function N2(t, e = 0) {
  if (Dt(t) && t.length > e)
    return t[t.length - 1 - e];
}
function Dt(t) {
  return Bt(t);
}
function H2(t = "", e = true, n = `
`) {
  return t.split(n).reduce((r, s) => {
    const o = e ? s.trim() : s;
    return o && r.push(o), r;
  }, []);
}
function ut(t, e) {
  return H2(t, true).map((n) => e(n));
}
function Lt(t) {
  return import_file_exists.exists(t, import_file_exists.FOLDER);
}
function S2(t, e) {
  return Array.isArray(t) ? t.includes(e) || t.push(e) : t.add(e), e;
}
function De(t, e) {
  return Array.isArray(t) && !t.includes(e) && t.push(e), t;
}
function ct(t, e) {
  if (Array.isArray(t)) {
    const n = t.indexOf(e);
    n >= 0 && t.splice(n, 1);
  } else
    t.delete(e);
  return e;
}
var ft = Object.prototype.toString.call.bind(Object.prototype.toString);
function v(t) {
  return Array.isArray(t) ? t : [t];
}
function jt(t) {
  return t.replace(/[\s-]+(.)/g, (e, n) => n.toUpperCase());
}
function L2(t) {
  return v(t).map((e) => e instanceof String ? e : String(e));
}
function p(t, e = 0) {
  if (t == null)
    return e;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? e : n;
}
function U(t, e) {
  const n = [];
  for (let r = 0, s = t.length;r < s; r++)
    n.push(e, t[r]);
  return n;
}
function F2(t) {
  return (Array.isArray(t) ? Buffer.concat(t) : t).toString("utf-8");
}
function Le(t) {
  return t ? Buffer.isBuffer(t) ? t.length : Buffer.byteLength(t) : 0;
}
function je(t, e) {
  const n = {};
  return e.forEach((r) => {
    t[r] !== undefined && (n[r] = t[r]);
  }), n;
}
function wt(t = 0) {
  return new Promise((e) => setTimeout(e, t));
}
function bt(t) {
  if (t !== false)
    return t;
}
function d(t, e, n) {
  return e(t) ? t : arguments.length > 2 ? n : undefined;
}
var K2 = (t) => Array.isArray(t);
function st(t, e) {
  const n = r(t) ? "string" : typeof t;
  return /number|string|boolean/.test(n) && (!e || !e.includes(n));
}
var m = (t) => typeof t == "string" || r(t);
var Be = (t) => m(t) || Buffer.isBuffer(t);
var G2 = (t) => m(t) || Array.isArray(t) && t.every(m);
function lt(t) {
  return !!t && ft(t) === "[object Object]";
}
function Ie(t) {
  return typeof t == "function";
}
var Bt = (t) => t == null || "number|boolean|function".includes(typeof t) ? false : typeof t.length == "number";
var V2 = /* @__PURE__ */ ((t) => (t[t.SUCCESS = 0] = "SUCCESS", t[t.ERROR = 1] = "ERROR", t[t.NOT_FOUND = -2] = "NOT_FOUND", t[t.UNCLEAN = 128] = "UNCLEAN", t))(V2 || {});

class z2 {
  constructor(e, n) {
    this.stdOut = e, this.stdErr = n;
  }
  asStrings() {
    return new z2(this.stdOut.toString("utf8"), this.stdErr.toString("utf8"));
  }
}
function Ue() {
  throw new Error("LineParser:useMatches not implemented");
}

class l2 {
  constructor(e, n) {
    this.matches = [], this.useMatches = Ue, this.parse = (r, s) => (this.resetMatches(), this._regExp.every((o, i) => this.addMatch(o, i, r(i))) ? this.useMatches(s, this.prepareMatches()) !== false : false), this._regExp = Array.isArray(e) ? e : [e], n && (this.useMatches = n);
  }
  resetMatches() {
    this.matches.length = 0;
  }
  prepareMatches() {
    return this.matches;
  }
  addMatch(e, n, r) {
    const s = r && e.exec(r);
    return s && this.pushMatch(n, s), !!s;
  }
  pushMatch(e, n) {
    this.matches.push(...n.slice(1));
  }
}

class x2 extends l2 {
  addMatch(e, n, r) {
    return /^remote:\s/.test(String(r)) && super.addMatch(e, n, r);
  }
  pushMatch(e, n) {
    (e > 0 || n.length > 1) && super.pushMatch(e, n);
  }
}
var Fe = {
  binary: "git",
  maxConcurrentProcesses: 5,
  config: [],
  trimmed: false
};
function Ge(...t) {
  const e = process.cwd(), n = Object.assign({ baseDir: e, ...Fe }, ...t.filter((r) => typeof r == "object" && r));
  return n.baseDir = n.baseDir || e, n.trimmed = n.trimmed === true, n;
}
function It(t, e = []) {
  return lt(t) ? Object.keys(t).reduce((n, r2) => {
    const s = t[r2];
    if (r(s))
      n.push(s);
    else if (st(s, ["boolean"]))
      n.push(r2 + "=" + s);
    else if (Array.isArray(s))
      for (const o of s)
        st(o, ["string", "number"]) || n.push(r2 + "=" + o);
    else
      n.push(r2);
    return n;
  }, e) : e;
}
function h2(t, e = 0, n = false) {
  const r = [];
  for (let s = 0, o = e < 0 ? t.length : e;s < o; s++)
    "string|number".includes(typeof t[s]) && r.push(String(t[s]));
  return It(ht(t), r), n || r.push(...ze(t)), r;
}
function ze(t) {
  const e = typeof N2(t) == "function";
  return L2(d(N2(t, e ? 1 : 0), K2, []));
}
function ht(t) {
  const e = Ie(N2(t));
  return d(N2(t, e ? 1 : 0), lt);
}
function u(t, e = true) {
  const n = Ne(N2(t));
  return e || $e(n) ? n : undefined;
}
function Tt(t, e) {
  return t(e.stdOut, e.stdErr);
}
function E2(t, e, n, r = true) {
  return v(n).forEach((s) => {
    for (let o = H2(s, r), i = 0, a = o.length;i < a; i++) {
      const c = (y = 0) => {
        if (!(i + y >= a))
          return o[i + y];
      };
      e.some(({ parse: y }) => y(c, t));
    }
  }), t;
}
var mt = ({ exitCode: t }, e, n, r) => {
  if (t === V2.UNCLEAN && Ve(e))
    return n(Buffer.from("false"));
  r(e);
};
var Ut = (t) => t.trim() === "true";
function We(t) {
  switch (t) {
    case "bare":
      return Ke();
    case "root":
      return He();
  }
  return {
    commands: ["rev-parse", "--is-inside-work-tree"],
    format: "utf-8",
    onError: mt,
    parser: Ut
  };
}
function He() {
  return {
    commands: ["rev-parse", "--git-dir"],
    format: "utf-8",
    onError: mt,
    parser(e) {
      return /^\.(git)?$/.test(e.trim());
    }
  };
}
function Ke() {
  return {
    commands: ["rev-parse", "--is-bare-repository"],
    format: "utf-8",
    onError: mt,
    parser: Ut
  };
}
function Ve(t) {
  return /(Not a git repository|Kein Git-Repository)/i.test(String(t));
}

class Xe {
  constructor(e) {
    this.paths = [], this.files = [], this.folders = [], this.dryRun = e;
  }
}
var Ye = /^[a-z]+\s*/i;
var Qe = /^[a-z]+\s+[a-z]+\s*/i;
var Je = /\/$/;
function Ze(t, e) {
  const n = new Xe(t), r = t ? Qe : Ye;
  return H2(e).forEach((s) => {
    const o = s.replace(r, "");
    n.paths.push(o), (Je.test(o) ? n.folders : n.files).push(o);
  }), n;
}
var Ft = [];
function tn(t) {
  return {
    commands: Ft,
    format: "empty",
    parser: t
  };
}
function b2(t) {
  return {
    commands: Ft,
    format: "empty",
    parser() {
      throw typeof t == "string" ? new xe(t) : t;
    }
  };
}
function g(t, e = false) {
  return {
    commands: t,
    format: "utf-8",
    parser(n) {
      return e ? String(n).trim() : n;
    }
  };
}
function Gt(t) {
  return {
    commands: t,
    format: "buffer",
    parser(e) {
      return e;
    }
  };
}
function en(t) {
  return t.format === "buffer";
}
function kt(t) {
  return t.format === "empty" || !t.commands.length;
}
var nn = "Git clean interactive mode is not supported";
var rn = 'Git clean mode parameter ("n" or "f") is required';
var sn = "Git clean unknown option found in: ";
var zt = /* @__PURE__ */ ((t) => (t.DRY_RUN = "n", t.FORCE = "f", t.IGNORED_INCLUDED = "x", t.IGNORED_ONLY = "X", t.EXCLUDING = "e", t.QUIET = "q", t.RECURSIVE = "d", t))(zt || {});
var qt = /* @__PURE__ */ new Set([
  "i",
  ...L2(Object.values(zt))
]);
function on(t, e) {
  const { cleanMode: n, options: r, valid: s } = cn(t);
  return n ? s.options ? (r.push(...e), r.some(hn) ? b2(nn) : an(n, r)) : b2(sn + JSON.stringify(t)) : b2(rn);
}
function an(t, e) {
  return {
    commands: ["clean", `-${t}`, ...e],
    format: "utf-8",
    parser(r) {
      return Ze(t === "n", r);
    }
  };
}
function un(t) {
  return Array.isArray(t) && t.every((e) => qt.has(e));
}
function cn(t) {
  let e, n = [], r = { cleanMode: false, options: true };
  return t.replace(/[^a-z]i/g, "").split("").forEach((s) => {
    fn(s) ? (e = s, r.cleanMode = true) : r.options = r.options && ln(n[n.length] = `-${s}`);
  }), {
    cleanMode: e,
    options: n,
    valid: r
  };
}
function fn(t) {
  return t === "f" || t === "n";
}
function ln(t) {
  return /^-[a-z]$/i.test(t) && qt.has(t.charAt(1));
}
function hn(t) {
  return /^-[^\-]/.test(t) ? t.indexOf("i") > 0 : t === "--interactive";
}

class mn {
  constructor() {
    this.files = [], this.values = /* @__PURE__ */ Object.create(null);
  }
  get all() {
    return this._all || (this._all = this.files.reduce((e, n) => Object.assign(e, this.values[n]), {})), this._all;
  }
  addFile(e) {
    if (!(e in this.values)) {
      const n = N2(this.files);
      this.values[e] = n ? Object.create(this.values[n]) : {}, this.files.push(e);
    }
    return this.values[e];
  }
  addValue(e, n, r) {
    const s = this.addFile(e);
    Object.hasOwn(s, n) ? Array.isArray(s[n]) ? s[n].push(r) : s[n] = [s[n], r] : s[n] = r, this._all = undefined;
  }
}
function pn(t) {
  const e = new mn;
  for (const n of Wt(t))
    e.addValue(n.file, String(n.key), n.value);
  return e;
}
function dn(t, e) {
  let n = null;
  const r = [], s = /* @__PURE__ */ new Map;
  for (const o of Wt(t, e))
    o.key === e && (r.push(n = o.value), s.has(o.file) || s.set(o.file, []), s.get(o.file).push(n));
  return {
    key: e,
    paths: Array.from(s.keys()),
    scopes: s,
    value: n,
    values: r
  };
}
function gn(t) {
  return t.replace(/^(file):/, "");
}
function* Wt(t, e = null) {
  const n = t.split("\x00");
  for (let r = 0, s = n.length - 1;r < s; ) {
    const o = gn(n[r++]);
    let i = n[r++], a = e;
    if (i.includes(`
`)) {
      const c = Pe(i, `
`);
      a = c[0], i = c[1];
    }
    yield { file: o, key: a, value: i };
  }
}
var Ht = /* @__PURE__ */ ((t) => (t.system = "system", t.global = "global", t.local = "local", t.worktree = "worktree", t))(Ht || {});
function Y2(t, e) {
  return typeof t == "string" && Object.hasOwn(Ht, t) ? t : e;
}
function yn(t, e, n, r) {
  const s = ["config", `--${r}`];
  return n && s.push("--add"), s.push(t, e), {
    commands: s,
    format: "utf-8",
    parser(o) {
      return o;
    }
  };
}
function wn(t, e) {
  const n = ["config", "--null", "--show-origin", "--get-all", t];
  return e && n.splice(1, 0, `--${e}`), {
    commands: n,
    format: "utf-8",
    parser(r) {
      return dn(r, t);
    }
  };
}
function bn(t) {
  const e = ["config", "--list", "--show-origin", "--null"];
  return t && e.push(`--${t}`), {
    commands: e,
    format: "utf-8",
    parser(n) {
      return pn(n);
    }
  };
}
function Tn() {
  return {
    addConfig(t, e, ...n) {
      return this._runTask(yn(t, e, n[0] === true, Y2(n[1], "local")), u(arguments));
    },
    getConfig(t, e) {
      return this._runTask(wn(t, Y2(e, undefined)), u(arguments));
    },
    listConfig(...t) {
      return this._runTask(bn(Y2(t[0], undefined)), u(arguments));
    }
  };
}
var Kt = /* @__PURE__ */ ((t) => (t.ADDED = "A", t.COPIED = "C", t.DELETED = "D", t.MODIFIED = "M", t.RENAMED = "R", t.CHANGED = "T", t.UNMERGED = "U", t.UNKNOWN = "X", t.BROKEN = "B", t))(Kt || {});
var kn = new Set(Object.values(Kt));
function _n(t) {
  return kn.has(t);
}
var _t;
var vn = ["-h"];
var j2 = /* @__PURE__ */ Symbol("grepQuery");

class En {
  constructor() {
    this[_t] = [];
  }
  *[(_t = j2, Symbol.iterator)]() {
    for (const e of this[j2])
      yield e;
  }
  and(...e) {
    return e.length && this[j2].push("--and", "(", ...U(e, "-e"), ")"), this;
  }
  param(...e) {
    return this[j2].push(...U(e, "-e")), this;
  }
}
function Sn(...t) {
  return new En().param(...t);
}
function Rn(t) {
  const e = /* @__PURE__ */ new Set, n = {};
  return ut(t, (r) => {
    const [s, o, i] = r.split(I2);
    e.add(s), (n[s] = n[s] || []).push({
      line: p(o),
      path: s,
      preview: i
    });
  }), {
    paths: e,
    results: n
  };
}
function On() {
  return {
    grep(t) {
      const e = u(arguments), n = h2(arguments);
      for (const s of vn)
        if (n.includes(s))
          return this._runTask(b2(`git.grep: use of "${s}" is not supported.`), e);
      typeof t == "string" && (t = Sn().param(t));
      const r = ["grep", "--null", "-n", "--full-name", ...n, ...t];
      return this._runTask({
        commands: r,
        format: "utf-8",
        parser(s) {
          return Rn(s);
        }
      }, e);
    }
  };
}
var Vt = /* @__PURE__ */ ((t) => (t.MIXED = "mixed", t.SOFT = "soft", t.HARD = "hard", t.MERGE = "merge", t.KEEP = "keep", t))(Vt || {});
var Cn = L2(Object.values(Vt));
function An(t, e) {
  const n = ["reset"];
  return Xt(t) && n.push(`--${t}`), n.push(...e), g(n);
}
function xn(t) {
  if (Xt(t))
    return t;
  switch (typeof t) {
    case "string":
    case "undefined":
      return "soft";
  }
}
function Xt(t) {
  return typeof t == "string" && Cn.includes(t);
}
import_debug.default.formatters.L = (t) => String(Bt(t) ? t.length : "-");
import_debug.default.formatters.B = (t) => Buffer.isBuffer(t) ? t.toString("utf8") : ft(t);
function Nn() {
  return import_debug.default("simple-git");
}
function vt(t, e, n) {
  return !e || !String(e).replace(/\s*/, "") ? n ? (r, ...s) => {
    t(r, ...s), n(r, ...s);
  } : t : (r, ...s) => {
    t(`%s ${r}`, e, ...s), n && n(r, ...s);
  };
}
function $n(t, e, { namespace: n }) {
  if (typeof t == "string")
    return t;
  const r = e && e.namespace || "";
  return r.startsWith(n) ? r.substr(n.length + 1) : r || n;
}
function $2(t, e, n, r = Nn()) {
  const s = t && `[${t}]` || "", o = [], i = typeof e == "string" ? r.extend(e) : e, a = $n(d(e, m), i, r);
  return y(n);
  function c(w, T) {
    return S2(o, $2(t, a.replace(/^[^:]+/, w), T, r));
  }
  function y(w) {
    const T = w && `[${w}]` || "", k = i && vt(i, T) || W2, C = vt(r, `${s} ${T}`, k);
    return Object.assign(i ? k : C, {
      label: t,
      sibling: c,
      info: C,
      step: y
    });
  }
}
var M2 = class M {
  constructor(e = "GitExecutor") {
    this.logLabel = e, this._queue = /* @__PURE__ */ new Map;
  }
  withProgress(e) {
    return this._queue.get(e);
  }
  createProgress(e) {
    const n = M.getName(e.commands[0]), r = $2(this.logLabel, n);
    return {
      task: e,
      logger: r,
      name: n
    };
  }
  push(e) {
    const n = this.createProgress(e);
    return n.logger("Adding task to the queue, commands = %o", e.commands), this._queue.set(e, n), n;
  }
  fatal(e) {
    for (const [n, { logger: r }] of Array.from(this._queue.entries()))
      n === e.task ? (r.info("Failed %o", e), r("Fatal exception, any as-yet un-started tasks run through this executor will not be attempted")) : r.info("A fatal exception occurred in a previous task, the queue has been purged: %o", e.message), this.complete(n);
    if (this._queue.size !== 0)
      throw new Error(`Queue size should be zero after fatal: ${this._queue.size}`);
  }
  complete(e) {
    this.withProgress(e) && this._queue.delete(e);
  }
  attempt(e) {
    const n = this.withProgress(e);
    if (!n)
      throw new O2(undefined, "TasksPendingQueue: attempt called for an unknown task");
    return n.logger("Starting task"), n;
  }
  static getName(e = "empty") {
    return `task:${e}:${++M.counter}`;
  }
};
M2.counter = 0;
var ot = M2;

class Pn {
  constructor(e, n, r) {
    this._executor = e, this._scheduler = n, this._plugins = r, this._chain = Promise.resolve(), this._queue = new ot;
  }
  get cwd() {
    return this._cwd || this._executor.cwd;
  }
  set cwd(e) {
    this._cwd = e;
  }
  get env() {
    return this._executor.env;
  }
  get outputHandler() {
    return this._executor.outputHandler;
  }
  chain() {
    return this;
  }
  push(e) {
    return this._queue.push(e), this._chain = this._chain.then(() => this.attemptTask(e));
  }
  async attemptTask(e) {
    const n = await this._scheduler.next(), r = () => this._queue.complete(e);
    try {
      const { logger: s } = this._queue.attempt(e);
      return await (kt(e) ? this.attemptEmptyTask(e, s) : this.attemptRemoteTask(e, s));
    } catch (s) {
      throw this.onFatalException(e, s);
    } finally {
      r(), n();
    }
  }
  onFatalException(e, n) {
    const r = n instanceof O2 ? Object.assign(n, { task: e }) : new O2(e, n && String(n));
    return this._chain = Promise.resolve(), this._queue.fatal(r), r;
  }
  async attemptRemoteTask(e, n) {
    const r = this._plugins.exec("spawn.binary", "", this.taskContext(e, e.commands)), s = this._plugins.exec("spawn.args", [...e.commands], this.taskContext(e, e.commands)), o = await this.gitResponse(e, r, s, this.outputHandler, n.step("SPAWN")), i = await this.handleTaskData(e, s, o, n.step("HANDLE"));
    return n("passing response to task's parser as a %s", e.format), en(e) ? Tt(e.parser, i) : Tt(e.parser, i.asStrings());
  }
  async attemptEmptyTask(e, n) {
    return n("empty task bypassing child process to call to task's parser"), e.parser(this);
  }
  handleTaskData(e, n, r, s) {
    const { exitCode: o, rejection: i, stdOut: a, stdErr: c } = r;
    return new Promise((y, w) => {
      s("Preparing to handle process response exitCode=%d stdOut=", o);
      const { error: T } = this._plugins.exec("task.error", { error: i }, {
        ...this.taskContext(e, n),
        ...r
      });
      if (T && e.onError)
        return s.info("exitCode=%s handling with custom error handler"), e.onError(r, T, (k) => {
          s.info("custom error handler treated as success"), s("custom error returned a %s", ft(k)), y(new z2(Array.isArray(k) ? Buffer.concat(k) : k, Buffer.concat(c)));
        }, w);
      if (T)
        return s.info("handling as error: exitCode=%s stdErr=%s rejection=%o", o, c.length, i), w(T);
      s.info("retrieving task output complete"), y(new z2(Buffer.concat(a), Buffer.concat(c)));
    });
  }
  async gitResponse(e, n, r, s, o) {
    const i = o.sibling("output"), a = this._plugins.exec("spawn.options", {
      cwd: this.cwd,
      env: this.env,
      windowsHide: true
    }, this.taskContext(e, e.commands));
    return new Promise((c) => {
      const y = [], w = [];
      o.info("%s %o", n, r), o("%O", a);
      let T = this._beforeSpawn(e, r);
      if (T)
        return c({
          stdOut: y,
          stdErr: w,
          exitCode: 9901,
          rejection: T
        });
      this._plugins.exec("spawn.before", undefined, {
        ...this.taskContext(e, r),
        kill(C) {
          T = C || T;
        }
      });
      const k = ve(n, r, a);
      k.stdout.on("data", Et(y, "stdOut", o, i.step("stdOut"))), k.stderr.on("data", Et(w, "stdErr", o, i.step("stdErr"))), k.on("error", Mn(w, o)), s && (o("Passing child process stdOut/stdErr to custom outputHandler"), s(n, k.stdout, k.stderr, [...r])), this._plugins.exec("spawn.after", undefined, {
        ...this.taskContext(e, r),
        spawned: k,
        close(C, Te) {
          c({
            stdOut: y,
            stdErr: w,
            exitCode: C,
            rejection: T || Te
          });
        },
        kill(C) {
          k.killed || (T = C, k.kill("SIGINT"));
        }
      });
    });
  }
  _beforeSpawn(e, n) {
    let r;
    return this._plugins.exec("spawn.before", undefined, {
      ...this.taskContext(e, n),
      kill(s) {
        r = s || r;
      }
    }), r;
  }
  taskContext(e, n) {
    return {
      method: String(Me(e.commands) || ""),
      commands: n,
      env: { ...this.env },
      input: kt(e) ? undefined : e.input
    };
  }
}
function Mn(t, e) {
  return (n) => {
    e("[ERROR] child process exception %o", n), t.push(Buffer.from(String(n.stack), "ascii"));
  };
}
function Et(t, e, n, r) {
  return (s) => {
    n("%s received %L bytes", e, s), r("%B", s), t.push(s);
  };
}

class Dn {
  constructor(e, n, r) {
    this.cwd = e, this._scheduler = n, this._plugins = r, this._chain = this.chain();
  }
  chain() {
    return new Pn(this, this._scheduler, this._plugins);
  }
  push(e) {
    return this._chain.push(e);
  }
}
function Ln(t, e, n = W2) {
  const r = (o) => {
    n(null, o);
  }, s = (o) => {
    o?.task === t && n(o, undefined);
  };
  e.then(r, s);
}
function St(t, e) {
  return tn((n) => {
    if (!Lt(t))
      throw new Error(`Git.cwd: cannot change to non-directory "${t}"`);
    return (e || n).cwd = t;
  });
}
function Q2(t) {
  const e = ["checkout", ...t];
  return e[1] === "-b" && e.includes("-B") && (e[1] = ct(e, "-B")), g(e);
}
function jn() {
  return {
    checkout() {
      return this._runTask(Q2(h2(arguments, 1)), u(arguments));
    },
    checkoutBranch(t, e) {
      return this._runTask(Q2(["-b", t, e, ...h2(arguments)]), u(arguments));
    },
    checkoutLocalBranch(t) {
      return this._runTask(Q2(["-b", t, ...h2(arguments)]), u(arguments));
    }
  };
}
var Yt = (t, e, n) => {
  const r = ["clone", ...n];
  return m(t) && r.push(c(t)), m(e) && r.push(c(e)), g(r);
};
var Bn = (t, e, n) => (S2(n, "--mirror"), Yt(t, e, n));
function Rt(t, e, n, ...r) {
  return m(n) ? e(n, d(r[0], m), h2(arguments)) : b2(`git.${t}() requires a string 'repoPath'`);
}
function In() {
  return {
    clone(t, ...e) {
      return this._runTask(Rt("clone", Yt, d(t, m), ...e), u(arguments));
    },
    mirror(t, ...e) {
      return this._runTask(Rt("mirror", Bn, d(t, m), ...e), u(arguments));
    }
  };
}
var Un = [
  new l2(/^\[([^\s]+)( \([^)]+\))? ([^\]]+)/, (t, [e, n, r]) => {
    t.branch = e, t.commit = r, t.root = !!n;
  }),
  new l2(/\s*Author:\s(.+)/i, (t, [e]) => {
    const n = e.split("<"), r = n.pop();
    !r || !r.includes("@") || (t.author = {
      email: r.substr(0, r.length - 1),
      name: n.join("<").trim()
    });
  }),
  new l2(/(\d+)[^,]*(?:,\s*(\d+)[^,]*)(?:,\s*(\d+))/g, (t, [e, n, r]) => {
    t.summary.changes = parseInt(e, 10) || 0, t.summary.insertions = parseInt(n, 10) || 0, t.summary.deletions = parseInt(r, 10) || 0;
  }),
  new l2(/^(\d+)[^,]*(?:,\s*(\d+)[^(]+\(([+-]))?/, (t, [e, n, r]) => {
    t.summary.changes = parseInt(e, 10) || 0;
    const s = parseInt(n, 10) || 0;
    r === "-" ? t.summary.deletions = s : r === "+" && (t.summary.insertions = s);
  })
];
function Fn(t) {
  return E2({
    author: null,
    branch: "",
    commit: "",
    root: false,
    summary: {
      changes: 0,
      insertions: 0,
      deletions: 0
    }
  }, Un, t);
}
function Gn(t, e, n) {
  return {
    commands: [
      "-c",
      "core.abbrev=40",
      "commit",
      ...U(t, "-m"),
      ...e,
      ...n
    ],
    format: "utf-8",
    parser: Fn
  };
}
function zn() {
  return {
    commit(e, ...n) {
      const r = u(arguments), s = t(e) || Gn(v(e), v(d(n[0], G2, [])), [
        ...L2(d(n[1], K2, [])),
        ...h2(arguments, 0, true)
      ]);
      return this._runTask(s, r);
    }
  };
  function t(e) {
    return !G2(e) && b2("git.commit: requires the commit message to be supplied as a string/string[]");
  }
}
function qn() {
  return {
    count: 0,
    garbage: 0,
    inPack: 0,
    packs: 0,
    prunePackable: 0,
    size: 0,
    sizeGarbage: 0,
    sizePack: 0
  };
}
var Wn = new l2(/([a-z-]+): (\d+)$/, (t, [e, n]) => {
  const r = jt(e);
  Object.hasOwn(t, r) && (t[r] = p(n));
});
function Hn() {
  return {
    countObjects() {
      return this._runTask({
        commands: ["count-objects", "--verbose"],
        format: "utf-8",
        parser(t) {
          return E2(qn(), [Wn], t);
        }
      });
    }
  };
}
function Kn() {
  return {
    firstCommit() {
      return this._runTask(g(["rev-list", "--max-parents=0", "HEAD"], true), u(arguments));
    }
  };
}
function Vn(t, e) {
  const n = ["hash-object", t];
  return e && n.push("-w"), g(n, true);
}

class J2 {
  constructor(e, n, r, s) {
    this.bare = e, this.path = n, this.existing = r, this.gitDir = s;
  }
}
var Xn = /^Init.+ repository in (.+)$/;
var Yn = /^Rein.+ in (.+)$/;
function Qn(t, e, n) {
  const r = String(n).trim();
  let s;
  if (s = Xn.exec(r))
    return new J2(t, e, false, s[1]);
  if (s = Yn.exec(r))
    return new J2(t, e, true, s[1]);
  let o = "";
  const i = r.split(" ");
  for (;i.length; )
    if (i.shift() === "in") {
      o = i.join(" ");
      break;
    }
  return new J2(t, e, /^re/i.test(r), o);
}
var Qt = "--bare";
function Jn(t) {
  return t.includes(Qt);
}
function Zn(t = false, e, n) {
  const r = ["init", ...n];
  return t && !Jn(r) && r.splice(1, 0, Qt), {
    commands: r,
    format: "utf-8",
    parser(s) {
      return Qn(r.includes("--bare"), e, s);
    }
  };
}
function tr(t) {
  return t === undefined ? b2("interpretTrailers called without input content") : {
    format: "utf-8",
    parser(e) {
      return Object.fromEntries(ut(e, (n) => {
        const r = n.indexOf(":");
        return [
          jt(n.substring(0, r).toLowerCase()),
          n.substring(r + 2).trim()
        ];
      }));
    },
    commands: ["interpret-trailers", "--parse"],
    input: t
  };
}
function er() {
  return {
    interpretTrailers(t) {
      return this._runTask(tr(d(t, Be)), u(arguments));
    }
  };
}
var R2 = /* @__PURE__ */ ((t) => (t.NONE = "", t.STAT = "--stat", t.NUM_STAT = "--numstat", t.NAME_ONLY = "--name-only", t.NAME_STATUS = "--name-status", t))(R2 || {});
var Jt = /^--(stat|numstat|name-only|name-status)(=|$)/;
function pt(t) {
  for (let e = 0;e < t.length; e++) {
    const n = Jt.exec(t[e]);
    if (n)
      return `--${n[1]}`;
  }
  return "";
}
function nr(t) {
  return Jt.test(t);
}

class rr {
  constructor() {
    this.changed = 0, this.deletions = 0, this.insertions = 0, this.files = [];
  }
}
var Ot = [
  new l2(/^(.+)\s+\|\s+(\d+)(\s+[+\-]+)?$/, (t, [e, n, r = ""]) => {
    t.files.push({
      file: e.trim(),
      changes: p(n),
      insertions: r.replace(/[^+]/g, "").length,
      deletions: r.replace(/[^-]/g, "").length,
      binary: false
    });
  }),
  new l2(/^(.+) \|\s+Bin ([0-9.]+) -> ([0-9.]+) ([a-z]+)/, (t, [e, n, r]) => {
    t.files.push({
      file: e.trim(),
      before: p(n),
      after: p(r),
      binary: true
    });
  }),
  new l2(/^(.+)\s+\|\s+Bin\s*$/, (t, [e]) => {
    t.files.push({
      file: e.trim(),
      before: 0,
      after: 0,
      binary: true
    });
  }),
  new l2(/(\d+) files? changed\s*((?:, \d+ [^,]+){0,2})/, (t, [e, n]) => {
    const r = /(\d+) i/.exec(n), s = /(\d+) d/.exec(n);
    t.changed = p(e), t.insertions = p(r?.[1]), t.deletions = p(s?.[1]);
  })
];
var sr = [
  new l2(/(\d+)\t(\d+)\t(.+)$/, (t, [e, n, r]) => {
    const s = p(e), o = p(n);
    t.changed++, t.insertions += s, t.deletions += o, t.files.push({
      file: r,
      changes: s + o,
      insertions: s,
      deletions: o,
      binary: false
    });
  }),
  new l2(/-\t-\t(.+)$/, (t, [e]) => {
    t.changed++, t.files.push({
      file: e,
      after: 0,
      before: 0,
      binary: true
    });
  })
];
var or = [
  new l2(/(.+)$/, (t, [e]) => {
    t.changed++, t.files.push({
      file: e,
      changes: 0,
      insertions: 0,
      deletions: 0,
      binary: false
    });
  })
];
var ir = [
  new l2(/([ACDMRTUXB])([0-9]{0,3})\t(.[^\t]*)(\t(.[^\t]*))?$/, (t, [e, n, r, s, o]) => {
    t.changed++, t.files.push({
      file: o ?? r,
      changes: 0,
      insertions: 0,
      deletions: 0,
      binary: false,
      status: bt(_n(e) && e),
      from: bt(!!o && r !== o && r),
      similarity: p(n)
    });
  })
];
var ar = {
  [R2.NONE]: Ot,
  [R2.STAT]: Ot,
  [R2.NUM_STAT]: sr,
  [R2.NAME_STATUS]: ir,
  [R2.NAME_ONLY]: or
};
function Zt(t = R2.NONE) {
  const e = ar[t];
  return (n) => E2(new rr, e, n, false);
}
var te = "òòòòòò ";
var ee2 = " òò";
var ne2 = " ò ";
var ur = ["hash", "date", "message", "refs", "author_name", "author_email"];
function cr(t, e) {
  return e.reduce((n, r, s) => (n[r] = t[s] || "", n), /* @__PURE__ */ Object.create({ diff: null }));
}
function re(t = ne2, e = ur, n = R2.NONE) {
  const r = Zt(n);
  return function(s) {
    const o = H2(s.trim(), false, te).map(function(i) {
      const a = i.split(ee2), c = cr(a[0].split(t), e);
      return a.length > 1 && a[1].trim() && (c.diff = r(a[1])), c;
    });
    return {
      all: o,
      latest: o.length && o[0] || null,
      total: o.length
    };
  };
}
function fr(t) {
  let e = pt(t);
  const n = ["diff"];
  return e === R2.NONE && (e = R2.STAT, n.push("--stat=4096")), n.push(...t), dt(n) || {
    commands: n,
    format: "utf-8",
    parser: Zt(e)
  };
}
function dt(t) {
  const e = t.filter(nr);
  if (e.length > 1)
    return b2(`Summary flags are mutually exclusive - pick one of ${e.join(",")}`);
  if (e.length && t.includes("-z"))
    return b2(`Summary flag ${e} parsing is not compatible with null termination option '-z'`);
}
var se = /* @__PURE__ */ ((t) => (t[t["--pretty"] = 0] = "--pretty", t[t["max-count"] = 1] = "max-count", t[t.maxCount = 2] = "maxCount", t[t.n = 3] = "n", t[t.file = 4] = "file", t[t.format = 5] = "format", t[t.from = 6] = "from", t[t.to = 7] = "to", t[t.splitter = 8] = "splitter", t[t.symmetric = 9] = "symmetric", t[t.mailMap = 10] = "mailMap", t[t.multiLine = 11] = "multiLine", t[t.strictDate = 12] = "strictDate", t))(se || {});
function lr(t, e) {
  const n = [], r = [];
  return Object.keys(t).forEach((s) => {
    n.push(s), r.push(String(t[s]));
  }), [n, r.join(e)];
}
function hr(t) {
  return Object.keys(t).reduce((e, n) => ((n in se) || (e[n] = t[n]), e), {});
}
function oe2(t = {}, e = []) {
  const n = d(t.splitter, m, ne2), r = lt(t.format) ? t.format : {
    hash: "%H",
    date: t.strictDate === false ? "%ai" : "%aI",
    message: "%s",
    refs: "%D",
    body: t.multiLine ? "%B" : "%b",
    author_name: t.mailMap !== false ? "%aN" : "%an",
    author_email: t.mailMap !== false ? "%aE" : "%ae"
  }, [s, o] = lr(r, n), i = [], a = [
    `--pretty=format:${te}${o}${ee2}`,
    ...e
  ], c2 = t.n || t["max-count"] || t.maxCount;
  if (c2 && a.push(`--max-count=${c2}`), t.from || t.to) {
    const y = t.symmetric !== false ? "..." : "..";
    i.push(`${t.from || ""}${y}${t.to || ""}`);
  }
  return m(t.file) && a.push("--follow", c(t.file)), It(hr(t), a), {
    fields: s,
    splitter: n,
    commands: [...a, ...i]
  };
}
function mr(t, e, n) {
  const r = re(t, e, pt(n));
  return {
    commands: ["log", ...n],
    format: "utf-8",
    parser: r
  };
}
function pr() {
  return {
    log(...n) {
      const r = u(arguments), s = oe2(ht(arguments), L2(d(arguments[0], K2, []))), o = e(...n) || dt(s.commands) || t(s);
      return this._runTask(o, r);
    }
  };
  function t(n) {
    return mr(n.splitter, n.fields, n.commands);
  }
  function e(n, r) {
    return m(n) && m(r) && b2("git.log(string, string) should be replaced with git.log({ from: string, to: string })");
  }
}

class Z2 {
  constructor(e, n = null, r) {
    this.reason = e, this.file = n, this.meta = r;
  }
  toString() {
    return `${this.file}:${this.reason}`;
  }
}

class dr {
  constructor() {
    this.conflicts = [], this.merges = [], this.result = "success";
  }
  get failed() {
    return this.conflicts.length > 0;
  }
  get reason() {
    return this.result;
  }
  toString() {
    return this.conflicts.length ? `CONFLICTS: ${this.conflicts.join(", ")}` : "OK";
  }
}

class ie {
  constructor() {
    this.remoteMessages = {
      all: []
    }, this.created = [], this.deleted = [], this.files = [], this.deletions = {}, this.insertions = {}, this.summary = {
      changes: 0,
      deletions: 0,
      insertions: 0
    };
  }
}

class gr {
  constructor() {
    this.remote = "", this.hash = {
      local: "",
      remote: ""
    }, this.branch = {
      local: "",
      remote: ""
    }, this.message = "";
  }
  toString() {
    return this.message;
  }
}
function tt(t) {
  return t.objects = t.objects || {
    compressing: 0,
    counting: 0,
    enumerating: 0,
    packReused: 0,
    reused: { count: 0, delta: 0 },
    total: { count: 0, delta: 0 }
  };
}
function Ct(t) {
  const e = /^\s*(\d+)/.exec(t), n = /delta (\d+)/i.exec(t);
  return {
    count: p(e && e[1] || "0"),
    delta: p(n && n[1] || "0")
  };
}
var yr = [
  new x2(/^remote:\s*(enumerating|counting|compressing) objects: (\d+),/i, (t, [e, n]) => {
    const r = e.toLowerCase(), s = tt(t.remoteMessages);
    Object.assign(s, { [r]: p(n) });
  }),
  new x2(/^remote:\s*(enumerating|counting|compressing) objects: \d+% \(\d+\/(\d+)\),/i, (t, [e, n]) => {
    const r = e.toLowerCase(), s = tt(t.remoteMessages);
    Object.assign(s, { [r]: p(n) });
  }),
  new x2(/total ([^,]+), reused ([^,]+), pack-reused (\d+)/i, (t, [e, n, r]) => {
    const s = tt(t.remoteMessages);
    s.total = Ct(e), s.reused = Ct(n), s.packReused = p(r);
  })
];
var wr = [
  new x2(/^remote:\s*(.+)$/, (t, [e]) => (t.remoteMessages.all.push(e.trim()), false)),
  ...yr,
  new x2([/create a (?:pull|merge) request/i, /\s(https?:\/\/\S+)$/], (t, [e]) => {
    t.remoteMessages.pullRequestUrl = e;
  }),
  new x2([/found (\d+) vulnerabilities.+\(([^)]+)\)/i, /\s(https?:\/\/\S+)$/], (t, [e, n, r]) => {
    t.remoteMessages.vulnerabilities = {
      count: p(e),
      summary: n,
      url: r
    };
  })
];
function ae(t, e) {
  return E2({ remoteMessages: new br }, wr, e);
}

class br {
  constructor() {
    this.all = [];
  }
}
var Tr = /^\s*(.+?)\s+\|\s+\d+\s*(\+*)(-*)/;
var kr = /(\d+)\D+((\d+)\D+\(\+\))?(\D+(\d+)\D+\(-\))?/;
var _r = /^(create|delete) mode \d+ (.+)/;
var vr = [
  new l2(Tr, (t, [e, n, r]) => {
    t.files.push(e), n && (t.insertions[e] = n.length), r && (t.deletions[e] = r.length);
  }),
  new l2(kr, (t, [e, , n, , r]) => n !== undefined || r !== undefined ? (t.summary.changes = +e || 0, t.summary.insertions = +n || 0, t.summary.deletions = +r || 0, true) : false),
  new l2(_r, (t, [e, n]) => {
    S2(t.files, n), S2(e === "create" ? t.created : t.deleted, n);
  })
];
var Er = [
  new l2(/^from\s(.+)$/i, (t, [e]) => {
    t.remote = e;
  }),
  new l2(/^fatal:\s(.+)$/, (t, [e]) => {
    t.message = e;
  }),
  new l2(/([a-z0-9]+)\.\.([a-z0-9]+)\s+(\S+)\s+->\s+(\S+)$/, (t, [e, n, r, s]) => {
    t.branch.local = r, t.hash.local = e, t.branch.remote = s, t.hash.remote = n;
  })
];
var Sr = (t, e) => E2(new ie, vr, [t, e]);
var ue = (t, e) => Object.assign(new ie, Sr(t, e), ae(t, e));
function Rr(t, e) {
  const n = E2(new gr, Er, [t, e]);
  return n.message && n;
}
var Or = [
  new l2(/^Auto-merging\s+(.+)$/, (t, [e]) => {
    t.merges.push(e);
  }),
  new l2(/^CONFLICT\s+\((.+)\): Merge conflict in (.+)$/, (t, [e, n]) => {
    t.conflicts.push(new Z2(e, n));
  }),
  new l2(/^CONFLICT\s+\((.+\/delete)\): (.+) deleted in (.+) and/, (t, [e, n, r]) => {
    t.conflicts.push(new Z2(e, n, { deleteRef: r }));
  }),
  new l2(/^CONFLICT\s+\((.+)\):/, (t, [e]) => {
    t.conflicts.push(new Z2(e, null));
  }),
  new l2(/^Automatic merge failed;\s+(.+)$/, (t, [e]) => {
    t.result = e;
  })
];
var Cr = (t, e) => Object.assign(Ar(t), ue(t, e));
var Ar = (t) => E2(new dr, Or, t);
function At(t) {
  return t.length ? {
    commands: ["merge", ...t],
    format: "utf-8",
    parser(e, n) {
      const r = Cr(e, n);
      if (r.failed)
        throw new at(r);
      return r;
    }
  } : b2("Git.merge requires at least one option");
}
function xr(t, e, n) {
  const r = n.includes("deleted"), s = n.includes("tag") || /^refs\/tags/.test(t), o = !n.includes("new");
  return {
    deleted: r,
    tag: s,
    branch: !s,
    new: !o,
    alreadyUpdated: o,
    local: t,
    remote: e
  };
}
var Nr = [
  new l2(/^Pushing to (.+)$/, (t, [e]) => {
    t.repo = e;
  }),
  new l2(/^updating local tracking ref '(.+)'/, (t, [e]) => {
    t.ref = {
      ...t.ref || {},
      local: e
    };
  }),
  new l2(/^[=*-]\s+([^:]+):(\S+)\s+\[(.+)]$/, (t, [e, n, r]) => {
    t.pushed.push(xr(e, n, r));
  }),
  new l2(/^Branch '([^']+)' set up to track remote branch '([^']+)' from '([^']+)'/, (t, [e, n, r]) => {
    t.branch = {
      ...t.branch || {},
      local: e,
      remote: n,
      remoteName: r
    };
  }),
  new l2(/^([^:]+):(\S+)\s+([a-z0-9]+)\.\.([a-z0-9]+)$/, (t, [e, n, r, s]) => {
    t.update = {
      head: {
        local: e,
        remote: n
      },
      hash: {
        from: r,
        to: s
      }
    };
  })
];
var $r = (t, e) => {
  const n = Pr(t, e), r = ae(t, e);
  return {
    ...n,
    ...r
  };
};
var Pr = (t, e) => E2({ pushed: [] }, Nr, [t, e]);
function Mr(t = {}, e) {
  return S2(e, "--tags"), ce(t, e);
}
function ce(t = {}, e) {
  const n = ["push", ...e];
  return t.branch && n.splice(1, 0, t.branch), t.remote && n.splice(1, 0, t.remote), ct(n, "-v"), S2(n, "--verbose"), S2(n, "--porcelain"), {
    commands: n,
    format: "utf-8",
    parser: $r
  };
}
function Dr() {
  return {
    showBuffer() {
      const t = ["show", ...h2(arguments, 1)];
      return t.includes("--binary") || t.splice(1, 0, "--binary"), this._runTask(Gt(t), u(arguments));
    },
    show() {
      const t = ["show", ...h2(arguments, 1)];
      return this._runTask(g(t), u(arguments));
    }
  };
}
var Lr = /^(.+)\0(.+)$/;

class jr {
  constructor(e, n, r) {
    if (this.path = e, this.index = n, this.working_dir = r, n === "R" || r === "R") {
      const s = Lr.exec(e) || [null, e, e];
      this.from = s[2] || "", this.path = s[1] || "";
    }
  }
}

class Br {
  constructor() {
    this.not_added = [], this.conflicted = [], this.created = [], this.deleted = [], this.ignored = undefined, this.modified = [], this.renamed = [], this.files = [], this.staged = [], this.ahead = 0, this.behind = 0, this.current = null, this.tracking = null, this.detached = false, this.isClean = () => !this.files.length;
  }
}
function xt(t) {
  const [e, n] = t.split(I2);
  return {
    from: n || e,
    to: e
  };
}
function _2(t, e, n) {
  return [`${t}${e}`, n];
}
function et(t, ...e) {
  return e.map((n) => _2(t, n, (r, s) => r.conflicted.push(s)));
}
var Ir = new Map([
  _2(" ", "A", (t, e) => t.created.push(e)),
  _2(" ", "D", (t, e) => t.deleted.push(e)),
  _2(" ", "M", (t, e) => t.modified.push(e)),
  _2("A", " ", (t, e) => {
    t.created.push(e), t.staged.push(e);
  }),
  _2("A", "M", (t, e) => {
    t.created.push(e), t.staged.push(e), t.modified.push(e);
  }),
  _2("D", " ", (t, e) => {
    t.deleted.push(e), t.staged.push(e);
  }),
  _2("M", " ", (t, e) => {
    t.modified.push(e), t.staged.push(e);
  }),
  _2("M", "M", (t, e) => {
    t.modified.push(e), t.staged.push(e);
  }),
  _2("R", " ", (t, e) => {
    t.renamed.push(xt(e));
  }),
  _2("R", "M", (t, e) => {
    const n = xt(e);
    t.renamed.push(n), t.modified.push(n.to);
  }),
  _2("!", "!", (t, e) => {
    (t.ignored = t.ignored || []).push(e);
  }),
  _2("?", "?", (t, e) => t.not_added.push(e)),
  ...et("A", "A", "U"),
  ...et("D", "D", "U"),
  ...et("U", "A", "D", "U"),
  [
    "##",
    (t, e) => {
      const n = /ahead (\d+)/, r = /behind (\d+)/, s = /^(.+?(?=(?:\.{3}|\s|$)))/, o = /\.{3}(\S*)/, i = /\son\s(\S+?)(?=\.{3}|$)/;
      let a = n.exec(e);
      t.ahead = a && +a[1] || 0, a = r.exec(e), t.behind = a && +a[1] || 0, a = s.exec(e), t.current = d(a?.[1], m, null), a = o.exec(e), t.tracking = d(a?.[1], m, null), a = i.exec(e), a && (t.current = d(a?.[1], m, t.current)), t.detached = /\(no branch\)/.test(e);
    }
  ]
]);
var Ur = function(t) {
  const e = t.split(I2), n = new Br;
  for (let r = 0, s = e.length;r < s; ) {
    let o = e[r++].trim();
    o && (o.charAt(0) === "R" && (o += I2 + (e[r++] || "")), Fr(n, o));
  }
  return n;
};
function Fr(t, e) {
  const n = e.trim();
  switch (" ") {
    case n.charAt(2):
      return r(n.charAt(0), n.charAt(1), n.slice(3));
    case n.charAt(1):
      return r(" ", n.charAt(0), n.slice(2));
    default:
      return;
  }
  function r(s, o, i) {
    const a = `${s}${o}`, c = Ir.get(a);
    c && c(t, i), a !== "##" && a !== "!!" && t.files.push(new jr(i, s, o));
  }
}
var Gr = ["--null", "-z"];
function zr(t) {
  return {
    format: "utf-8",
    commands: [
      "status",
      "--porcelain",
      "-b",
      "-u",
      "--null",
      ...t.filter((n) => !Gr.includes(n))
    ],
    parser(n) {
      return Ur(n);
    }
  };
}
var fe = "installed=false";
function q2(t = 0, e = 0, n = 0, r = "", s = true) {
  return Object.defineProperty({
    major: t,
    minor: e,
    patch: n,
    agent: r,
    installed: s
  }, "toString", {
    value() {
      return `${this.major}.${this.minor}.${this.patch}`;
    },
    configurable: false,
    enumerable: false
  });
}
function qr() {
  return q2(0, 0, 0, "", false);
}
function Wr() {
  return {
    version() {
      return this._runTask({
        commands: ["--version"],
        format: "utf-8",
        parser: Kr,
        onError(t, e, n, r) {
          if (t.exitCode === V2.NOT_FOUND)
            return n(Buffer.from(fe));
          r(e);
        }
      });
    }
  };
}
var Hr = [
  new l2(/version (\d+)\.(\d+)\.(\d+)(?:\s*\((.+)\))?/, (t, [e, n, r, s = ""]) => {
    Object.assign(t, q2(p(e), p(n), p(r), s));
  }),
  new l2(/version (\d+)\.(\d+)\.(\D+)(.+)?$/, (t, [e, n, r, s = ""]) => {
    Object.assign(t, q2(p(e), p(n), r, s));
  })
];
function Kr(t) {
  return t === fe ? qr() : E2(q2(0, 0, 0, t), Hr, t);
}

class le {
  constructor(e) {
    this._executor = e;
  }
  _runTask(e, n) {
    const r = this._executor.chain(), s = r.push(e);
    return n && Ln(e, s, n), Object.create(this, {
      then: { value: s.then.bind(s) },
      catch: { value: s.catch.bind(s) },
      _executor: { value: r }
    });
  }
  add(e) {
    return this._runTask(g(["add", ...v(e)]), u(arguments));
  }
  cwd(e) {
    const n = u(arguments);
    return typeof e == "string" ? this._runTask(St(e, this._executor), n) : typeof e?.path == "string" ? this._runTask(St(e.path, e.root && this._executor || undefined), n) : this._runTask(b2("Git.cwd: workingDirectory must be supplied as a string"), n);
  }
  hashObject(e, n) {
    return this._runTask(Vn(e, n === true), u(arguments));
  }
  init(e) {
    return this._runTask(Zn(e === true, this._executor.cwd, h2(arguments)), u(arguments));
  }
  merge() {
    return this._runTask(At(h2(arguments)), u(arguments));
  }
  mergeFromTo(e, n) {
    return m(e) && m(n) ? this._runTask(At([e, n, ...h2(arguments)]), u(arguments, false)) : this._runTask(b2("Git.mergeFromTo requires that the 'remote' and 'branch' arguments are supplied as strings"));
  }
  outputHandler(e) {
    return this._executor.outputHandler = e, this;
  }
  push() {
    const e = ce({
      remote: d(arguments[0], m),
      branch: d(arguments[1], m)
    }, h2(arguments));
    return this._runTask(e, u(arguments));
  }
  stash() {
    return this._runTask(g(["stash", ...h2(arguments)]), u(arguments));
  }
  status() {
    return this._runTask(zr(h2(arguments)), u(arguments));
  }
}
Object.assign(le.prototype, jn(), In(), zn(), Tn(), Hn(), Kn(), On(), er(), pr(), Dr(), Wr());
var Vr = /* @__PURE__ */ (() => {
  let t = 0;
  return () => {
    t++;
    const { promise: e, done: n } = import_promise_deferred.createDeferred();
    return {
      promise: e,
      done: n,
      id: t
    };
  };
})();

class Xr {
  constructor(e = 2) {
    this.concurrency = e, this.logger = $2("", "scheduler"), this.pending = [], this.running = [], this.logger("Constructed, concurrency=%s", e);
  }
  schedule() {
    if (!this.pending.length || this.running.length >= this.concurrency) {
      this.logger("Schedule attempt ignored, pending=%s running=%s concurrency=%s", this.pending.length, this.running.length, this.concurrency);
      return;
    }
    const e = S2(this.running, this.pending.shift());
    this.logger("Attempting id=%s", e.id), e.done(() => {
      this.logger("Completing id=", e.id), ct(this.running, e), this.schedule();
    });
  }
  next() {
    const { promise: e, id: n } = S2(this.pending, Vr());
    return this.logger("Scheduling id=%s", n), this.schedule(), e;
  }
}
function Yr(t, e) {
  return g(["apply", ...e, ...t]);
}
var he = /* @__PURE__ */ ((t) => (t.CURRENT = "*", t.LINKED = "+", t))(he || {});

class Qr {
  constructor() {
    this.all = [], this.branches = {}, this.current = "", this.detached = false;
  }
  push(e, n, r, s, o) {
    e === "*" && (this.detached = n, this.current = r), this.all.push(r), this.branches[r] = {
      current: e === "*",
      linkedWorkTree: e === "+",
      name: r,
      commit: s,
      label: o
    };
  }
}
var Jr = [
  new l2(/^([*+]\s)?\((?:HEAD )?detached (?:from|at) (\S+)\)\s+([a-z0-9]+)\s(.*)$/, (t, [e, n, r, s]) => {
    t.push(Nt(e), true, n, r, s);
  }),
  new l2(/^([*+]\s)?(\S+)\s+([a-z0-9]+)\s?(.*)$/s, (t, [e, n, r, s]) => {
    t.push(Nt(e), false, n, r, s);
  })
];
var Zr = new l2(/^(\S+)$/s, (t, [e]) => {
  t.push(he.CURRENT, false, e, "", "");
});
function Nt(t) {
  return t ? t.charAt(0) : "";
}
function me(t, e = false) {
  return E2(new Qr, e ? [Zr] : Jr, t);
}

class ts {
  constructor() {
    this.all = [], this.branches = {}, this.errors = [];
  }
  get success() {
    return !this.errors.length;
  }
}
function es(t, e) {
  return {
    branch: t,
    hash: e,
    success: true
  };
}
function ns(t) {
  return {
    branch: t,
    hash: null,
    success: false
  };
}
var rs = /(\S+)\s+\(\S+\s([^)]+)\)/;
var pe = /^error[^']+'([^']+)'/m;
var ss = [
  new l2(rs, (t, [e, n]) => {
    const r = es(e, n);
    t.all.push(r), t.branches[e] = r;
  }),
  new l2(pe, (t, [e]) => {
    const n = ns(e);
    t.errors.push(n), t.all.push(n), t.branches[e] = n;
  })
];
var gt = (t, e) => E2(new ts, ss, [t, e]);
function de(t, e) {
  return e === V2.ERROR && pe.test(t);
}
function os2(t) {
  const e = ["-d", "-D", "--delete"];
  return t.some((n) => e.includes(n));
}
function is(t) {
  const e = os2(t), n = t.includes("--show-current"), r = ["branch", ...t];
  return r.length === 1 && r.push("-a"), r.includes("-v") || r.splice(1, 0, "-v"), {
    format: "utf-8",
    commands: r,
    parser(s, o) {
      return e ? gt(s, o).all[0] : me(s, n);
    }
  };
}
function as() {
  return {
    format: "utf-8",
    commands: ["branch", "-v"],
    parser(t) {
      return me(t);
    }
  };
}
function us(t, e = false) {
  return {
    format: "utf-8",
    commands: ["branch", "-v", e ? "-D" : "-d", ...t],
    parser(n, r) {
      return gt(n, r);
    },
    onError({ exitCode: n, stdOut: r }, s, o, i) {
      if (!de(String(s), n))
        return i(s);
      o(r);
    }
  };
}
function cs(t, e = false) {
  const n = {
    format: "utf-8",
    commands: ["branch", "-v", e ? "-D" : "-d", t],
    parser(r, s) {
      return gt(r, s).branches[t];
    },
    onError({ exitCode: r, stdErr: s, stdOut: o }, i, a, c) {
      if (!de(String(i), r))
        return c(i);
      throw new at(n.parser(F2(o), F2(s)), String(i));
    }
  };
  return n;
}
function fs7(t) {
  return {
    commands: ["check-ignore", ...t],
    format: "utf-8",
    parser: ls
  };
}
function ls(t) {
  return t.split(/\n/g).map(hs).filter(Boolean);
}
function hs(t) {
  const e = t.trim().replace(/^["']|["']$/g, "");
  return e && Se(e);
}
var ms = [
  new l2(/From (.+)$/, (t, [e]) => {
    t.remote = e;
  }),
  new l2(/\* \[new branch]\s+(\S+)\s*-> (.+)$/, (t, [e, n]) => {
    t.branches.push({
      name: e,
      tracking: n
    });
  }),
  new l2(/\* \[new tag]\s+(\S+)\s*-> (.+)$/, (t, [e, n]) => {
    t.tags.push({
      name: e,
      tracking: n
    });
  }),
  new l2(/- \[deleted]\s+\S+\s*-> (.+)$/, (t, [e]) => {
    t.deleted.push({
      tracking: e
    });
  }),
  new l2(/\s*([^.]+)\.\.(\S+)\s+(\S+)\s*-> (.+)$/, (t, [e, n, r, s]) => {
    t.updated.push({
      name: r,
      tracking: s,
      to: n,
      from: e
    });
  })
];
function ps(t, e) {
  return E2({
    raw: t,
    remote: null,
    branches: [],
    tags: [],
    updated: [],
    deleted: []
  }, ms, [t, e]);
}
function ds(t) {
  return /^--upload-pack(=|$)/.test(t);
}
function gs(t, e, n) {
  const r = ["fetch", ...n];
  return t && e && r.push(t, e), r.find(ds) ? b2("git.fetch: potential exploit argument blocked.") : {
    commands: r,
    format: "utf-8",
    parser: ps
  };
}
var ys = [
  new l2(/^Renaming (.+) to (.+)$/, (t, [e, n]) => {
    t.moves.push({ from: e, to: n });
  })
];
function ws(t) {
  return E2({ moves: [] }, ys, t);
}
function bs(t, e) {
  return {
    commands: ["mv", "-v", ...v(t), e],
    format: "utf-8",
    parser: ws
  };
}
function Ts(t, e, n) {
  const r = ["pull", ...n];
  return t && e && r.splice(1, 0, t, e), {
    commands: r,
    format: "utf-8",
    parser(s, o) {
      return ue(s, o);
    },
    onError(s, o, i, a) {
      const c = Rr(F2(s.stdOut), F2(s.stdErr));
      if (c)
        return a(new at(c));
      a(o);
    }
  };
}
function ks(t) {
  const e = {};
  return ge(t, ([n]) => e[n] = { name: n }), Object.values(e);
}
function _s(t) {
  const e = {};
  return ge(t, ([n, r, s]) => {
    Object.hasOwn(e, n) || (e[n] = {
      name: n,
      refs: { fetch: "", push: "" }
    }), s && r && (e[n].refs[s.replace(/[^a-z]/g, "")] = r);
  }), Object.values(e);
}
function ge(t, e) {
  ut(t, (n) => e(n.split(/\s+/)));
}
function vs(t, e, n) {
  return g(["remote", "add", ...n, t, e]);
}
function Es(t) {
  const e = ["remote"];
  return t && e.push("-v"), {
    commands: e,
    format: "utf-8",
    parser: t ? _s : ks
  };
}
function Ss(t) {
  const e = [...t];
  return e[0] !== "ls-remote" && e.unshift("ls-remote"), g(e);
}
function Rs(t) {
  const e = [...t];
  return e[0] !== "remote" && e.unshift("remote"), g(e);
}
function Os(t) {
  return g(["remote", "remove", t]);
}
function Cs(t = {}, e) {
  const n = oe2(t), r = ["stash", "list", ...n.commands, ...e], s = re(n.splitter, n.fields, pt(r));
  return dt(r) || {
    commands: r,
    format: "utf-8",
    parser: s
  };
}
function As(t, e) {
  return X2(["add", t, e]);
}
function xs(t) {
  return X2(["init", ...t]);
}
function X2(t) {
  const e = [...t];
  return e[0] !== "submodule" && e.unshift("submodule"), g(e);
}
function Ns(t) {
  return X2(["update", ...t]);
}

class $s {
  constructor(e, n) {
    this.all = e, this.latest = n;
  }
}
var Ps = function(t, e = false) {
  const n = t.split(`
`).map(Ds).filter(Boolean);
  e || n.sort(function(s, o) {
    const i = s.split("."), a = o.split(".");
    if (i.length === 1 || a.length === 1)
      return Ms(B2(i[0]), B2(a[0]));
    for (let c = 0, y = Math.max(i.length, a.length);c < y; c++) {
      const w = ye(B2(i[c]), B2(a[c]));
      if (w)
        return w;
    }
    return 0;
  });
  const r = e ? n[0] : [...n].reverse().find((s) => s.indexOf(".") >= 0);
  return new $s(n, r);
};
function Ms(t, e) {
  const n = Number.isNaN(t), r = Number.isNaN(e);
  return n !== r ? n ? 1 : -1 : n ? ye(t, e) : 0;
}
function ye(t, e) {
  return t === e ? 0 : t > e ? 1 : -1;
}
function Ds(t) {
  return t.trim();
}
function B2(t) {
  return typeof t == "string" && parseInt(t.replace(/^\D+/g, ""), 10) || 0;
}
function Ls(t = []) {
  const e = t.some((n) => /^--sort=/.test(n));
  return {
    format: "utf-8",
    commands: ["tag", "-l", ...t],
    parser(n) {
      return Ps(n, e);
    }
  };
}
function js(t) {
  return {
    format: "utf-8",
    commands: ["tag", t],
    parser() {
      return { name: t };
    }
  };
}
function Bs(t, e) {
  return {
    format: "utf-8",
    commands: ["tag", "-a", "-m", e, t],
    parser() {
      return { name: t };
    }
  };
}
function f2(t, e) {
  this._plugins = e, this._executor = new Dn(t.baseDir, new Xr(t.maxConcurrentProcesses), e), this._trimmed = t.trimmed;
}
(f2.prototype = Object.create(le.prototype)).constructor = f2;
f2.prototype.customBinary = function(t) {
  return this._plugins.reconfigure("binary", t), this;
};
f2.prototype.env = function(t, e) {
  return arguments.length === 1 && typeof t == "object" ? this._executor.env = t : (this._executor.env = this._executor.env || {})[t] = e, this;
};
f2.prototype.stashList = function(t) {
  return this._runTask(Cs(ht(arguments) || {}, K2(t) && t || []), u(arguments));
};
f2.prototype.mv = function(t, e) {
  return this._runTask(bs(t, e), u(arguments));
};
f2.prototype.checkoutLatestTag = function(t) {
  var e = this;
  return this.pull(function() {
    e.tags(function(n, r) {
      e.checkout(r.latest, t);
    });
  });
};
f2.prototype.pull = function(t, e, n, r) {
  return this._runTask(Ts(d(t, m), d(e, m), h2(arguments)), u(arguments));
};
f2.prototype.fetch = function(t, e) {
  return this._runTask(gs(d(t, m), d(e, m), h2(arguments)), u(arguments));
};
f2.prototype.tags = function(t, e) {
  return this._runTask(Ls(h2(arguments)), u(arguments));
};
f2.prototype.rebase = function() {
  return this._runTask(g(["rebase", ...h2(arguments)]), u(arguments));
};
f2.prototype.reset = function(t) {
  return this._runTask(An(xn(t), h2(arguments)), u(arguments));
};
f2.prototype.revert = function(t) {
  const e = u(arguments);
  return typeof t != "string" ? this._runTask(b2("Commit must be a string"), e) : this._runTask(g(["revert", ...h2(arguments, 0, true), t]), e);
};
f2.prototype.addTag = function(t) {
  const e = typeof t == "string" ? js(t) : b2("Git.addTag requires a tag name");
  return this._runTask(e, u(arguments));
};
f2.prototype.addAnnotatedTag = function(t, e) {
  return this._runTask(Bs(t, e), u(arguments));
};
f2.prototype.deleteLocalBranch = function(t, e, n) {
  return this._runTask(cs(t, typeof e == "boolean" ? e : false), u(arguments));
};
f2.prototype.deleteLocalBranches = function(t, e, n) {
  return this._runTask(us(t, typeof e == "boolean" ? e : false), u(arguments));
};
f2.prototype.branch = function(t, e) {
  return this._runTask(is(h2(arguments)), u(arguments));
};
f2.prototype.branchLocal = function(t) {
  return this._runTask(as(), u(arguments));
};
f2.prototype.raw = function(t) {
  const e = !Array.isArray(t), n = [].slice.call(e ? arguments : t, 0);
  for (let s = 0;s < n.length && e; s++)
    if (!st(n[s])) {
      n.splice(s, n.length - s);
      break;
    }
  n.push(...h2(arguments, 0, true));
  var r = u(arguments);
  return n.length ? this._runTask(g(n, this._trimmed), r) : this._runTask(b2("Raw: must supply one or more command to execute"), r);
};
f2.prototype.submoduleAdd = function(t, e, n) {
  return this._runTask(As(t, e), u(arguments));
};
f2.prototype.submoduleUpdate = function(t, e) {
  return this._runTask(Ns(h2(arguments, true)), u(arguments));
};
f2.prototype.submoduleInit = function(t, e) {
  return this._runTask(xs(h2(arguments, true)), u(arguments));
};
f2.prototype.subModule = function(t, e) {
  return this._runTask(X2(h2(arguments)), u(arguments));
};
f2.prototype.listRemote = function() {
  return this._runTask(Ss(h2(arguments)), u(arguments));
};
f2.prototype.addRemote = function(t, e, n) {
  return this._runTask(vs(t, e, h2(arguments)), u(arguments));
};
f2.prototype.removeRemote = function(t, e) {
  return this._runTask(Os(t), u(arguments));
};
f2.prototype.getRemotes = function(t, e) {
  return this._runTask(Es(t === true), u(arguments));
};
f2.prototype.remote = function(t, e) {
  return this._runTask(Rs(h2(arguments)), u(arguments));
};
f2.prototype.tag = function(t, e) {
  const n = h2(arguments);
  return n[0] !== "tag" && n.unshift("tag"), this._runTask(g(n), u(arguments));
};
f2.prototype.updateServerInfo = function(t) {
  return this._runTask(g(["update-server-info"]), u(arguments));
};
f2.prototype.pushTags = function(t, e) {
  const n = Mr({ remote: d(t, m) }, h2(arguments));
  return this._runTask(n, u(arguments));
};
f2.prototype.rm = function(t) {
  return this._runTask(g(["rm", "-f", ...v(t)]), u(arguments));
};
f2.prototype.rmKeepLocal = function(t) {
  return this._runTask(g(["rm", "--cached", ...v(t)]), u(arguments));
};
f2.prototype.catFile = function(t, e) {
  return this._catFile("utf-8", arguments);
};
f2.prototype.binaryCatFile = function() {
  return this._catFile("buffer", arguments);
};
f2.prototype._catFile = function(t, e) {
  var n = u(e), r = ["cat-file"], s = e[0];
  if (typeof s == "string")
    return this._runTask(b2("Git.catFile: options must be supplied as an array of strings"), n);
  Array.isArray(s) && r.push.apply(r, s);
  const o = t === "buffer" ? Gt(r) : g(r);
  return this._runTask(o, n);
};
f2.prototype.diff = function(t, e) {
  const n = m(t) ? b2("git.diff: supplying options as a single string is no longer supported, switch to an array of strings") : g(["diff", ...h2(arguments)]);
  return this._runTask(n, u(arguments));
};
f2.prototype.diffSummary = function() {
  return this._runTask(fr(h2(arguments, 1)), u(arguments));
};
f2.prototype.applyPatch = function(t) {
  const e = G2(t) ? Yr(v(t), h2([].slice.call(arguments, 1))) : b2("git.applyPatch requires one or more string patches as the first argument");
  return this._runTask(e, u(arguments));
};
f2.prototype.revparse = function() {
  const t = ["rev-parse", ...h2(arguments, true)];
  return this._runTask(g(t, true), u(arguments));
};
f2.prototype.clean = function(t, e, n) {
  const r = un(t), s = r && t.join("") || d(t, m) || "", o = h2([].slice.call(arguments, r ? 1 : 0));
  return this._runTask(on(s, o), u(arguments));
};
f2.prototype.exec = function(t) {
  const e = {
    commands: [],
    format: "utf-8",
    parser() {
      typeof t == "function" && t();
    }
  };
  return this._runTask(e);
};
f2.prototype.checkIgnore = function(t, e) {
  return this._runTask(fs7(v(d(t, G2, []))), u(arguments));
};
f2.prototype.checkIsRepo = function(t, e) {
  return this._runTask(We(d(t, m)), u(arguments));
};
function Is(t) {
  return t ? [{
    type: "spawn.before",
    action(r, s) {
      t.aborted && s.kill(new A2(undefined, "abort", "Abort already signaled"));
    }
  }, {
    type: "spawn.after",
    action(r, s) {
      function o() {
        s.kill(new A2(undefined, "abort", "Abort signal received"));
      }
      t.addEventListener("abort", o), s.spawned.on("close", () => t.removeEventListener("abort", o));
    }
  }] : undefined;
}
var Us = $2("", "plugin:allowEnvironment");
function Fs(t, e = false) {
  const n = new Set(t.map((r) => r.toLowerCase().trim()));
  return {
    type: "spawn.options",
    action(r, s) {
      const o = { ...r.env ?? process.env }, i = new Set(Object.keys(s.env).map((a) => a.toLowerCase().trim()));
      for (const a of Object.keys(o)) {
        const c = a.toLowerCase().trim();
        if (!(!Gs(c) || n.has(c))) {
          if (i.has(c))
            throw new A2(undefined, "allowEnvironment", `Use of "${a}" is blocked by the environment guard - add it to the allowEnvironment option to permit it`);
          Us("removing ambient guarded environment variable %s", a), delete o[a];
        }
      }
      return {
        ...r,
        env: {
          ...o,
          GIT_TEST_DISALLOW_ABBREVIATED_OPTIONS: String(!e)
        }
      };
    }
  };
}
function Gs(t) {
  const e = t.toLowerCase().trim();
  return e.startsWith("git_") || _(e);
}
function zs(t = {}) {
  return {
    type: "spawn.args",
    action(e, { env: n }) {
      for (const r of oe(e, n))
        if (t[r.category] !== true)
          throw new A2(undefined, "unsafe", r.message);
      return e;
    }
  };
}
function qs(t) {
  const e = U(t, "-c");
  return {
    type: "spawn.args",
    action(n) {
      return [...e, ...n];
    }
  };
}
var $t = import_promise_deferred.deferred().promise;
function Ws({
  onClose: t = true,
  onExit: e = 50
} = {}) {
  function n() {
    let s = -1;
    const o = {
      close: import_promise_deferred.deferred(),
      closeTimeout: import_promise_deferred.deferred(),
      exit: import_promise_deferred.deferred(),
      exitTimeout: import_promise_deferred.deferred()
    }, i = Promise.race([
      t === false ? $t : o.closeTimeout.promise,
      e === false ? $t : o.exitTimeout.promise
    ]);
    return r(t, o.close, o.closeTimeout), r(e, o.exit, o.exitTimeout), {
      close(a) {
        s = a, o.close.done();
      },
      exit(a) {
        s = a, o.exit.done();
      },
      get exitCode() {
        return s;
      },
      result: i
    };
  }
  function r(s, o, i) {
    s !== false && (s === true ? o.promise : o.promise.then(() => wt(s))).then(i.done);
  }
  return {
    type: "spawn.after",
    async action(s, { spawned: o, close: i }) {
      const a = n();
      let c = true, y = () => {
        c = false;
      };
      o.stdout?.on("data", y), o.stderr?.on("data", y), o.on("error", y), o.on("close", (w) => a.close(w)), o.on("exit", (w) => a.exit(w));
      try {
        await a.result, c && await wt(50), i(a.exitCode);
      } catch (w) {
        i(a.exitCode, w);
      }
    }
  };
}
var we = $2("", "plugin:binary");
var Hs = "Invalid value supplied for custom binary, requires a single string or an array containing either one or two strings";
var Ks = "Invalid value supplied for custom binary, restricted characters must be removed or supply the unsafe.allowUnsafeCustomBinary option";
function Vs(t) {
  return !t || !/^([a-z]:)?([a-z0-9/.\\_~-]+)$/i.test(t);
}
function Pt(t, e) {
  if (t.length < 1 || t.length > 2)
    throw new A2(undefined, "binary", Hs);
  if (t.some(Vs))
    if (e)
      we("permitted unsafe binary %o", t);
    else
      throw new A2(undefined, "binary", Ks);
  const [r, s] = t;
  return {
    binary: r,
    prefix: s
  };
}
function Xs(t, e = ["git"], n = false) {
  let r = Pt(v(e), n);
  t.on("binary", (s) => {
    r = Pt(v(s), n), we.info("reconfiguring %o", r);
  }), t.append("spawn.binary", () => r.binary), t.append("spawn.args", (s) => r.prefix ? [r.prefix, ...s] : s);
}
var be = {
  DISALLOWED_ABBREVIATED: {
    text: "disallowed abbreviated or ambiguous option",
    solution: "Unambiguous abbreviated options blocked with unsafe.allowAbbreviatedOptions setting: {message}"
  },
  UNKNOWN: {
    text: "~ unknown ~",
    solution: undefined
  }
};
function Ys(t) {
  if (!t)
    return "UNKNOWN";
  for (const [e, { text: n }] of Object.entries(be))
    if (t.startsWith(`fatal: ${n}`))
      return e;
  return "UNKNOWN";
}

class Qs extends O2 {
  constructor(e = "") {
    const n = Ys(e);
    super(undefined, be[n].solution?.replace("{message}", e) ?? e), this.reason = n;
  }
}
function Js(t) {
  return !!(t.exitCode && t.stdErr.length);
}
function Zs(t) {
  return Buffer.concat([...t.stdOut, ...t.stdErr]);
}
function to(t = false, e = Js, n = Zs) {
  return (r, s) => !t && r || !e(s) ? r : n(s);
}
function eo(t, e) {
  return t === 128 && e.startsWith("fatal:") ? new Qs(e) : new O2(undefined, e);
}
function Mt(t) {
  return {
    type: "task.error",
    action(e, n) {
      const r = t(e.error, {
        stdErr: n.stdErr,
        stdOut: n.stdOut,
        exitCode: n.exitCode
      });
      return Buffer.isBuffer(r) ? {
        error: eo(n.exitCode, r.toString("utf-8"))
      } : {
        error: r
      };
    }
  };
}
var nt = $2("", "plugin:input");
function no(t) {
  return {
    type: "spawn.after",
    action(e, { commands: n, input: r, spawned: { stdin: s } }) {
      if (!s)
        return;
      const o = t?.([...n]) ?? r;
      if (!o)
        return nt("generated zero length content, not writing to stdin");
      nt("writing %s bytes to stdin", Le(o)), s.on("error", (i) => {
        i.code !== "EPIPE" && nt("[ERROR] stdin error %o", i);
      }), s.end(o);
    }
  };
}

class ro {
  constructor() {
    this.plugins = /* @__PURE__ */ new Set, this.events = new Ce;
  }
  on(e, n) {
    this.events.on(e, n);
  }
  reconfigure(e, n) {
    this.events.emit(e, n);
  }
  append(e, n) {
    const r = S2(this.plugins, { type: e, action: n });
    return () => this.plugins.delete(r);
  }
  add(e) {
    const n = [];
    return v(e).forEach((r) => {
      r && this.plugins.add(S2(n, r));
    }), () => {
      n.forEach((r) => {
        this.plugins.delete(r);
      });
    };
  }
  exec(e, n, r) {
    let s = n;
    const o = Object.freeze(Object.create(r));
    for (const i of this.plugins)
      i.type === e && (s = i.action(s, o));
    return s;
  }
}
function so(t) {
  const e = "--progress", n = ["checkout", "clone", "fetch", "pull", "push"];
  return [{
    type: "spawn.args",
    action(o, i) {
      return n.includes(i.method) ? De(o, e) : o;
    }
  }, {
    type: "spawn.after",
    action(o, i) {
      i.commands.includes(e) && i.spawned.stderr?.on("data", (a) => {
        const c = /^([\s\S]+?):\s*(\d+)% \((\d+)\/(\d+)\)/.exec(a.toString("utf8"));
        c && t({
          method: i.method,
          stage: oo(c[1]),
          progress: p(c[2]),
          processed: p(c[3]),
          total: p(c[4])
        });
      });
    }
  }];
}
function oo(t) {
  return String(t.toLowerCase().split(" ", 1)) || "unknown";
}
function io(t) {
  const e = je(t, ["uid", "gid"]);
  return {
    type: "spawn.options",
    action(n) {
      return { ...e, ...n };
    }
  };
}
function ao() {
  return {
    type: "spawn.args",
    action(t) {
      const e = [];
      let n;
      function r2(s) {
        (n = n || []).push(...s);
      }
      for (let s = 0;s < t.length; s++) {
        const o2 = t[s];
        if (r(o2)) {
          r2(o(o2));
          continue;
        }
        if (o2 === "--") {
          r2(t.slice(s + 1).flatMap((i) => r(i) && o(i) || i));
          break;
        }
        e.push(o2);
      }
      return n ? [...e, "--", ...n.map(String)] : e;
    }
  };
}
function uo({
  block: t,
  stdErr: e = true,
  stdOut: n = true
}) {
  if (t > 0)
    return {
      type: "spawn.after",
      action(r, s) {
        let o;
        function i() {
          o && clearTimeout(o), o = setTimeout(c, t);
        }
        function a() {
          s.spawned.stdout?.off("data", i), s.spawned.stderr?.off("data", i), s.spawned.off("exit", a), s.spawned.off("close", a), o && clearTimeout(o);
        }
        function c() {
          a(), s.kill(new A2(undefined, "timeout", "block timeout reached"));
        }
        n && s.spawned.stdout?.on("data", i), e && s.spawned.stderr?.on("data", i), s.spawned.on("exit", a), s.spawned.on("close", a), i();
      }
    };
}
var wo = (t, e) => {
  const n = new ro, r = Ge(t && (typeof t == "string" ? { baseDir: t } : t) || {}, e);
  if (!Lt(r.baseDir))
    throw new Ae(r, "Cannot use simple-git on a directory that does not exist");
  return Array.isArray(r.config) && n.add(qs(r.config)), n.add(zs(r.unsafe)), n.add(Ws(r.completion)), r.abort && n.add(Is(r.abort)), r.progress && n.add(so(r.progress)), r.timeout && n.add(uo(r.timeout)), r.spawnOptions && n.add(io(r.spawnOptions)), n.add(ao()), n.add(no(r.input)), n.add(Mt(to(true))), r.errors && n.add(Mt(r.errors)), Xs(n, r.binary, r.unsafe?.allowUnsafeCustomBinary), n.add(Fs(r.allowEnvironment ?? [], r.unsafe?.allowAbbreviatedOptions)), new f2(r, n);
};

// src/services/worktreeService.ts
class WorktreeService {
  config;
  constructor(config) {
    this.config = config;
  }
  getGit(cwd) {
    return wo(cwd || this.config.baseDir);
  }
  getWorktreesDir() {
    return path4.join(this.config.hiveDir, ".worktrees");
  }
  getWorktreePath(feature, step) {
    return path4.join(this.getWorktreesDir(), feature, step);
  }
  async getStepStatusPath(feature, step) {
    const featurePath = path4.join(this.config.hiveDir, "features", feature);
    const tasksPath = path4.join(featurePath, "tasks", step, "status.json");
    try {
      await fs8.access(tasksPath);
      return tasksPath;
    } catch {}
    return path4.join(featurePath, "execution", step, "status.json");
  }
  getBranchName(feature, step) {
    return `hive/${feature}/${step}`;
  }
  async create(feature, step, baseBranch) {
    const worktreePath = this.getWorktreePath(feature, step);
    const branchName = this.getBranchName(feature, step);
    const git = this.getGit();
    await fs8.mkdir(path4.dirname(worktreePath), { recursive: true });
    let base;
    if (baseBranch) {
      base = baseBranch;
    } else {
      try {
        base = (await git.revparse(["HEAD"])).trim();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          const fsSync = await import("fs");
          const gitDirExists = fsSync.existsSync(path4.join(this.config.baseDir, ".git"));
          const dirEntries = fsSync.existsSync(this.config.baseDir) ? fsSync.readdirSync(this.config.baseDir).join(", ") : "DIR_NOT_FOUND";
          console.error(`[DIAG] baseDir=${this.config.baseDir} gitDirExists=${gitDirExists} entries=${dirEntries} cwd=${process.cwd()} home=${process.env.HOME} err=${msg}`);
        } catch {}
        throw new Error(`Failed to resolve HEAD in ${this.config.baseDir}: ${msg}. Ensure this directory is a valid git repository with at least one commit.`);
      }
    }
    const existing = await this.get(feature, step);
    if (existing) {
      return existing;
    }
    try {
      await git.raw(["worktree", "add", "-b", branchName, worktreePath, base]);
    } catch {
      try {
        await git.raw(["worktree", "add", worktreePath, branchName]);
      } catch (retryError) {
        throw new Error(`Failed to create worktree: ${retryError}`);
      }
    }
    const worktreeGit = this.getGit(worktreePath);
    const commit = (await worktreeGit.revparse(["HEAD"])).trim();
    return {
      path: worktreePath,
      branch: branchName,
      commit,
      feature,
      step
    };
  }
  async get(feature, step) {
    const worktreePath = this.getWorktreePath(feature, step);
    const branchName = this.getBranchName(feature, step);
    try {
      await fs8.access(worktreePath);
      const worktreeGit = this.getGit(worktreePath);
      const commit = (await worktreeGit.revparse(["HEAD"])).trim();
      return {
        path: worktreePath,
        branch: branchName,
        commit,
        feature,
        step
      };
    } catch {
      return null;
    }
  }
  async getDiff(feature, step, baseCommit) {
    const worktreePath = this.getWorktreePath(feature, step);
    const statusPath = await this.getStepStatusPath(feature, step);
    let base = baseCommit;
    if (!base) {
      try {
        const status = JSON.parse(await fs8.readFile(statusPath, "utf-8"));
        base = status.baseCommit;
      } catch {}
    }
    if (!base) {
      base = "HEAD~1";
    }
    const worktreeGit = this.getGit(worktreePath);
    try {
      await worktreeGit.raw(["add", "-A"]);
      const status = await worktreeGit.status();
      const hasStaged = status.staged.length > 0;
      let diffContent = "";
      let stat = "";
      if (hasStaged) {
        diffContent = await worktreeGit.diff(["--cached"]);
        stat = diffContent ? await worktreeGit.diff(["--cached", "--stat"]) : "";
      } else {
        diffContent = await worktreeGit.diff([`${base}..HEAD`]).catch(() => "");
        stat = diffContent ? await worktreeGit.diff([`${base}..HEAD`, "--stat"]) : "";
      }
      const statLines = stat.split(`
`).filter((l) => l.trim());
      const filesChanged = statLines.slice(0, -1).map((line) => line.split("|")[0].trim()).filter(Boolean);
      const summaryLine = statLines[statLines.length - 1] || "";
      const insertMatch = summaryLine.match(/(\d+) insertion/);
      const deleteMatch = summaryLine.match(/(\d+) deletion/);
      return {
        hasDiff: diffContent.length > 0,
        diffContent,
        filesChanged,
        insertions: insertMatch ? parseInt(insertMatch[1], 10) : 0,
        deletions: deleteMatch ? parseInt(deleteMatch[1], 10) : 0
      };
    } catch {
      return {
        hasDiff: false,
        diffContent: "",
        filesChanged: [],
        insertions: 0,
        deletions: 0
      };
    }
  }
  async exportPatch(feature, step, baseBranch) {
    const worktreePath = this.getWorktreePath(feature, step);
    const patchPath = path4.join(worktreePath, "..", `${step}.patch`);
    const base = baseBranch || "HEAD~1";
    const worktreeGit = this.getGit(worktreePath);
    const diff = await worktreeGit.diff([`${base}...HEAD`]);
    await fs8.writeFile(patchPath, diff);
    return patchPath;
  }
  async applyDiff(feature, step, baseBranch) {
    const { hasDiff, diffContent, filesChanged } = await this.getDiff(feature, step, baseBranch);
    if (!hasDiff) {
      return { success: true, filesAffected: [] };
    }
    const patchPath = path4.join(this.config.hiveDir, ".worktrees", feature, `${step}.patch`);
    try {
      await fs8.writeFile(patchPath, diffContent);
      const git = this.getGit();
      await git.applyPatch(patchPath);
      await fs8.unlink(patchPath).catch(() => {});
      return { success: true, filesAffected: filesChanged };
    } catch (error) {
      await fs8.unlink(patchPath).catch(() => {});
      const err = error;
      return {
        success: false,
        error: err.message || "Failed to apply patch",
        filesAffected: []
      };
    }
  }
  async revertDiff(feature, step, baseBranch) {
    const { hasDiff, diffContent, filesChanged } = await this.getDiff(feature, step, baseBranch);
    if (!hasDiff) {
      return { success: true, filesAffected: [] };
    }
    const patchPath = path4.join(this.config.hiveDir, ".worktrees", feature, `${step}.patch`);
    try {
      await fs8.writeFile(patchPath, diffContent);
      const git = this.getGit();
      await git.applyPatch(patchPath, ["-R"]);
      await fs8.unlink(patchPath).catch(() => {});
      return { success: true, filesAffected: filesChanged };
    } catch (error) {
      await fs8.unlink(patchPath).catch(() => {});
      const err = error;
      return {
        success: false,
        error: err.message || "Failed to revert patch",
        filesAffected: []
      };
    }
  }
  parseFilesFromDiff(diffContent) {
    const files = [];
    const regex = /^diff --git a\/(.+?) b\//gm;
    let match;
    while ((match = regex.exec(diffContent)) !== null) {
      files.push(match[1]);
    }
    return [...new Set(files)];
  }
  async revertFromSavedDiff(diffPath) {
    const diffContent = await fs8.readFile(diffPath, "utf-8");
    if (!diffContent.trim()) {
      return { success: true, filesAffected: [] };
    }
    const filesChanged = this.parseFilesFromDiff(diffContent);
    try {
      const git = this.getGit();
      await git.applyPatch(diffContent, ["-R"]);
      return { success: true, filesAffected: filesChanged };
    } catch (error) {
      const err = error;
      return {
        success: false,
        error: err.message || "Failed to revert patch",
        filesAffected: []
      };
    }
  }
  async remove(feature, step, deleteBranch = false) {
    const worktreePath = this.getWorktreePath(feature, step);
    const branchName = this.getBranchName(feature, step);
    const git = this.getGit();
    try {
      await git.raw(["worktree", "remove", worktreePath, "--force"]);
    } catch {
      await fs8.rm(worktreePath, { recursive: true, force: true });
    }
    try {
      await git.raw(["worktree", "prune"]);
    } catch {}
    if (deleteBranch) {
      try {
        await git.deleteLocalBranch(branchName, true);
      } catch {}
    }
  }
  async list(feature) {
    const worktreesDir = this.getWorktreesDir();
    const results = [];
    try {
      const features = feature ? [feature] : await fs8.readdir(worktreesDir);
      for (const feat of features) {
        const featurePath = path4.join(worktreesDir, feat);
        const stat2 = await fs8.stat(featurePath).catch(() => null);
        if (!stat2?.isDirectory())
          continue;
        const steps = await fs8.readdir(featurePath).catch(() => []);
        for (const step of steps) {
          const info = await this.get(feat, step);
          if (info) {
            results.push(info);
          }
        }
      }
    } catch {}
    return results;
  }
  async cleanup(feature) {
    const removed = [];
    const git = this.getGit();
    try {
      await git.raw(["worktree", "prune"]);
    } catch {}
    const worktreesDir = this.getWorktreesDir();
    const features = feature ? [feature] : await fs8.readdir(worktreesDir).catch(() => []);
    for (const feat of features) {
      const featurePath = path4.join(worktreesDir, feat);
      const stat2 = await fs8.stat(featurePath).catch(() => null);
      if (!stat2?.isDirectory())
        continue;
      const steps = await fs8.readdir(featurePath).catch(() => []);
      for (const step of steps) {
        const worktreePath = path4.join(featurePath, step);
        const stepStat = await fs8.stat(worktreePath).catch(() => null);
        if (!stepStat?.isDirectory())
          continue;
        try {
          const worktreeGit = this.getGit(worktreePath);
          await worktreeGit.revparse(["HEAD"]);
        } catch {
          await this.remove(feat, step, false);
          removed.push(worktreePath);
        }
      }
    }
    return { removed, pruned: true };
  }
  async checkConflicts(feature, step, baseBranch) {
    const { hasDiff, diffContent } = await this.getDiff(feature, step, baseBranch);
    if (!hasDiff) {
      return [];
    }
    const patchPath = path4.join(this.config.hiveDir, ".worktrees", feature, `${step}-check.patch`);
    try {
      await fs8.writeFile(patchPath, diffContent);
      const git = this.getGit();
      await git.applyPatch(patchPath, ["--check"]);
      await fs8.unlink(patchPath).catch(() => {});
      return [];
    } catch (error) {
      await fs8.unlink(patchPath).catch(() => {});
      const err = error;
      const stderr = err.message || "";
      const conflicts = stderr.split(`
`).filter((line) => line.includes("error: patch failed:")).map((line) => {
        const match = line.match(/error: patch failed: (.+):/);
        return match ? match[1] : null;
      }).filter((f) => f !== null);
      return conflicts;
    }
  }
  async checkConflictsFromSavedDiff(diffPath, reverse = false) {
    try {
      await fs8.access(diffPath);
    } catch {
      return [];
    }
    try {
      const git = this.getGit();
      const options = reverse ? ["--check", "-R"] : ["--check"];
      await git.applyPatch(diffPath, options);
      return [];
    } catch (error) {
      const err = error;
      const stderr = err.message || "";
      const conflicts = stderr.split(`
`).filter((line) => line.includes("error: patch failed:")).map((line) => {
        const match = line.match(/error: patch failed: (.+):/);
        return match ? match[1] : null;
      }).filter((f) => f !== null);
      return conflicts;
    }
  }
  async commitChanges(feature, step, message) {
    const worktreePath = this.getWorktreePath(feature, step);
    try {
      await fs8.access(worktreePath);
    } catch {
      return { committed: false, sha: "", message: "Worktree not found" };
    }
    const worktreeGit = this.getGit(worktreePath);
    try {
      await worktreeGit.add("-A");
      const status = await worktreeGit.status();
      const hasChanges = status.staged.length > 0 || status.modified.length > 0 || status.not_added.length > 0;
      if (!hasChanges) {
        const currentSha = (await worktreeGit.revparse(["HEAD"])).trim();
        return { committed: false, sha: currentSha, message: "No changes to commit" };
      }
      const commitMessage = message || `hive(${step}): task changes`;
      const result = await worktreeGit.commit(commitMessage, ["--allow-empty-message"]);
      return {
        committed: true,
        sha: result.commit,
        message: commitMessage
      };
    } catch (error) {
      const err = error;
      const currentSha = (await worktreeGit.revparse(["HEAD"]).catch(() => "")).trim();
      return {
        committed: false,
        sha: currentSha,
        message: err.message || "Commit failed"
      };
    }
  }
  async merge(feature, step, strategy = "merge") {
    const branchName = this.getBranchName(feature, step);
    const git = this.getGit();
    try {
      const branches = await git.branch();
      if (!branches.all.includes(branchName)) {
        return { success: false, merged: false, error: `Branch ${branchName} not found` };
      }
      const currentBranch = branches.current;
      const diffStat = await git.diff([`${currentBranch}...${branchName}`, "--stat"]);
      const filesChanged = diffStat.split(`
`).filter((l) => l.trim() && l.includes("|")).map((l) => l.split("|")[0].trim());
      if (strategy === "squash") {
        await git.raw(["merge", "--squash", branchName]);
        const result = await git.commit(`hive: merge ${step} (squashed)`);
        return {
          success: true,
          merged: true,
          sha: result.commit,
          filesChanged
        };
      } else if (strategy === "rebase") {
        const commits = await git.log([`${currentBranch}..${branchName}`]);
        const commitsToApply = [...commits.all].reverse();
        for (const commit of commitsToApply) {
          await git.raw(["cherry-pick", commit.hash]);
        }
        const head = (await git.revparse(["HEAD"])).trim();
        return {
          success: true,
          merged: true,
          sha: head,
          filesChanged
        };
      } else {
        const result = await git.merge([branchName, "--no-ff", "-m", `hive: merge ${step}`]);
        const head = (await git.revparse(["HEAD"])).trim();
        return {
          success: true,
          merged: !result.failed,
          sha: head,
          filesChanged,
          conflicts: result.conflicts?.map((c) => c.file || String(c)) || []
        };
      }
    } catch (error) {
      const err = error;
      if (err.message?.includes("CONFLICT") || err.message?.includes("conflict")) {
        await git.raw(["merge", "--abort"]).catch(() => {});
        await git.raw(["rebase", "--abort"]).catch(() => {});
        await git.raw(["cherry-pick", "--abort"]).catch(() => {});
        return {
          success: false,
          merged: false,
          error: "Merge conflicts detected",
          conflicts: this.parseConflictsFromError(error)
        };
      }
      return {
        success: false,
        merged: false,
        error: err.message || "Merge failed"
      };
    }
  }
  async hasUncommittedChanges(feature, step) {
    const worktreePath = this.getWorktreePath(feature, step);
    try {
      const worktreeGit = this.getGit(worktreePath);
      const status = await worktreeGit.status();
      return status.modified.length > 0 || status.not_added.length > 0 || status.staged.length > 0 || status.deleted.length > 0 || status.created.length > 0;
    } catch {
      return false;
    }
  }
  parseConflictsFromError(error) {
    const structured = error?.git;
    const fromResponse = (structured?.conflicts ?? []).map((entry) => entry?.file).filter((file) => typeof file === "string" && file.length > 0);
    if (fromResponse.length > 0)
      return [...new Set(fromResponse)];
    if (structured?.merges?.length)
      return [...new Set(structured.merges)];
    const errorMessage = error?.message ?? "";
    const conflicts = [];
    const lines = errorMessage.split(`
`);
    for (const line of lines) {
      if (line.includes("CONFLICT") && line.includes("Merge conflict in")) {
        const match = line.match(/Merge conflict in (.+)/);
        if (match)
          conflicts.push(match[1]);
      }
    }
    return conflicts;
  }
}
function createWorktreeService(projectDir) {
  return new WorktreeService({
    baseDir: projectDir,
    hiveDir: path4.join(projectDir, ".hive")
  });
}
// src/services/contextService.ts
import * as fs9 from "fs";
import * as path5 from "path";
class ContextService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  write(featureName, fileName, content) {
    const contextPath = getContextPath(this.projectRoot, featureName);
    ensureDir(contextPath);
    const filePath = path5.join(contextPath, this.normalizeFileName(fileName));
    writeText(filePath, content);
    const totalChars = this.list(featureName).reduce((sum, c) => sum + c.content.length, 0);
    if (totalChars > 20000) {
      return `${filePath}

⚠️ Context total: ${totalChars} chars (exceeds 20,000). Consider archiving older contexts with contextService.archive().`;
    }
    return filePath;
  }
  read(featureName, fileName) {
    const contextPath = getContextPath(this.projectRoot, featureName);
    const filePath = path5.join(contextPath, this.normalizeFileName(fileName));
    return readText(filePath);
  }
  list(featureName) {
    const contextPath = getContextPath(this.projectRoot, featureName);
    if (!fileExists(contextPath))
      return [];
    const files = fs9.readdirSync(contextPath, { withFileTypes: true }).filter((f) => f.isFile() && f.name.endsWith(".md")).map((f) => f.name);
    return files.map((name) => {
      const filePath = path5.join(contextPath, name);
      const stat = fs9.statSync(filePath);
      const content = readText(filePath) || "";
      return {
        name: name.replace(/\.md$/, ""),
        content,
        updatedAt: stat.mtime.toISOString()
      };
    });
  }
  delete(featureName, fileName) {
    const contextPath = getContextPath(this.projectRoot, featureName);
    const filePath = path5.join(contextPath, this.normalizeFileName(fileName));
    if (fileExists(filePath)) {
      fs9.unlinkSync(filePath);
      return true;
    }
    return false;
  }
  compile(featureName) {
    const files = this.list(featureName);
    if (files.length === 0)
      return "";
    const sections = files.map((f) => `## ${f.name}

${f.content}`);
    return sections.join(`

---

`);
  }
  archive(featureName) {
    const contexts = this.list(featureName);
    if (contexts.length === 0)
      return { archived: [], archivePath: "" };
    const contextPath = getContextPath(this.projectRoot, featureName);
    const archiveDir = path5.join(contextPath, "..", "archive");
    ensureDir(archiveDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archived = [];
    for (const ctx of contexts) {
      const archiveName = `${timestamp}_${ctx.name}.md`;
      const src = path5.join(contextPath, `${ctx.name}.md`);
      const dest = path5.join(archiveDir, archiveName);
      fs9.copyFileSync(src, dest);
      fs9.unlinkSync(src);
      archived.push(ctx.name);
    }
    return { archived, archivePath: archiveDir };
  }
  stats(featureName) {
    const contexts = this.list(featureName);
    if (contexts.length === 0)
      return { count: 0, totalChars: 0 };
    const sorted = [...contexts].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    return {
      count: contexts.length,
      totalChars: contexts.reduce((sum, c) => sum + c.content.length, 0),
      oldest: sorted[0].name,
      newest: sorted[sorted.length - 1].name
    };
  }
  normalizeFileName(name) {
    const normalized = name.replace(/\.md$/, "");
    return `${normalized}.md`;
  }
}
// src/services/sessionService.ts
import * as fs10 from "fs";
import * as path6 from "path";
class SessionService {
  projectRoot;
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }
  getSessionsPath(featureName) {
    return path6.join(getFeaturePath(this.projectRoot, featureName), "sessions.json");
  }
  getSessions(featureName) {
    const sessionsPath = this.getSessionsPath(featureName);
    return readJson(sessionsPath) || { sessions: [] };
  }
  saveSessions(featureName, data) {
    const sessionsPath = this.getSessionsPath(featureName);
    ensureDir(path6.dirname(sessionsPath));
    writeJson(sessionsPath, data);
  }
  track(featureName, sessionId, taskFolder) {
    const data = this.getSessions(featureName);
    const now = new Date().toISOString();
    let session = data.sessions.find((s) => s.sessionId === sessionId);
    if (session) {
      session.lastActiveAt = now;
      if (taskFolder)
        session.taskFolder = taskFolder;
    } else {
      session = {
        sessionId,
        taskFolder,
        startedAt: now,
        lastActiveAt: now
      };
      data.sessions.push(session);
    }
    if (!data.master) {
      data.master = sessionId;
    }
    this.saveSessions(featureName, data);
    return session;
  }
  setMaster(featureName, sessionId) {
    const data = this.getSessions(featureName);
    data.master = sessionId;
    this.saveSessions(featureName, data);
  }
  getMaster(featureName) {
    return this.getSessions(featureName).master;
  }
  list(featureName) {
    return this.getSessions(featureName).sessions;
  }
  get(featureName, sessionId) {
    return this.getSessions(featureName).sessions.find((s) => s.sessionId === sessionId);
  }
  getByTask(featureName, taskFolder) {
    return this.getSessions(featureName).sessions.find((s) => s.taskFolder === taskFolder);
  }
  remove(featureName, sessionId) {
    const data = this.getSessions(featureName);
    const index = data.sessions.findIndex((s) => s.sessionId === sessionId);
    if (index === -1)
      return false;
    data.sessions.splice(index, 1);
    if (data.master === sessionId) {
      data.master = data.sessions[0]?.sessionId;
    }
    this.saveSessions(featureName, data);
    return true;
  }
  findFeatureBySession(sessionId) {
    const featuresPath = path6.join(this.projectRoot, ".hive", "features");
    if (!fs10.existsSync(featuresPath))
      return null;
    const features = fs10.readdirSync(featuresPath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const feature of features) {
      const sessions = this.getSessions(feature);
      if (sessions.sessions.some((s) => s.sessionId === sessionId)) {
        return feature;
      }
      if (sessions.master === sessionId) {
        return feature;
      }
    }
    return null;
  }
  fork(featureName, fromSessionId) {
    const data = this.getSessions(featureName);
    const now = new Date().toISOString();
    const sourceSession = fromSessionId ? data.sessions.find((s) => s.sessionId === fromSessionId) : data.sessions.find((s) => s.sessionId === data.master);
    const newSessionId = `ses_fork_${Date.now()}`;
    const newSession = {
      sessionId: newSessionId,
      taskFolder: sourceSession?.taskFolder,
      startedAt: now,
      lastActiveAt: now
    };
    data.sessions.push(newSession);
    this.saveSessions(featureName, data);
    return newSession;
  }
  fresh(featureName, title) {
    const data = this.getSessions(featureName);
    const now = new Date().toISOString();
    const newSessionId = `ses_${title ? title.replace(/\s+/g, "_").toLowerCase() : Date.now()}`;
    const newSession = {
      sessionId: newSessionId,
      startedAt: now,
      lastActiveAt: now
    };
    data.sessions.push(newSession);
    this.saveSessions(featureName, data);
    return newSession;
  }
}
// src/services/configService.ts
import * as fs11 from "fs";
import * as path7 from "path";
class ConfigService {
  configPath;
  cachedConfig = null;
  cachedCustomAgentConfigs = null;
  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const configDir = path7.join(homeDir, ".config", "opencode");
    this.configPath = path7.join(configDir, "agent_hive.json");
  }
  getPath() {
    return this.configPath;
  }
  get() {
    if (this.cachedConfig !== null) {
      return this.cachedConfig;
    }
    try {
      if (!fs11.existsSync(this.configPath)) {
        this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
        this.cachedCustomAgentConfigs = null;
        return this.cachedConfig;
      }
      const raw = fs11.readFileSync(this.configPath, "utf-8");
      const stored = JSON.parse(raw);
      const storedCustomAgents = this.isObjectRecord(stored.customAgents) ? stored.customAgents : {};
      const mergedBuiltInAgents = BUILT_IN_AGENT_NAMES.reduce((acc, agentName) => {
        acc[agentName] = {
          ...DEFAULT_HIVE_CONFIG.agents?.[agentName],
          ...stored.agents?.[agentName]
        };
        return acc;
      }, {});
      const merged = {
        ...DEFAULT_HIVE_CONFIG,
        ...stored,
        agents: {
          ...DEFAULT_HIVE_CONFIG.agents,
          ...stored.agents,
          ...mergedBuiltInAgents
        },
        customAgents: {
          ...DEFAULT_HIVE_CONFIG.customAgents,
          ...storedCustomAgents
        }
      };
      this.cachedConfig = merged;
      this.cachedCustomAgentConfigs = null;
      return this.cachedConfig;
    } catch {
      this.cachedConfig = { ...DEFAULT_HIVE_CONFIG };
      this.cachedCustomAgentConfigs = null;
      return this.cachedConfig;
    }
  }
  set(updates) {
    this.cachedConfig = null;
    this.cachedCustomAgentConfigs = null;
    const current = this.get();
    const merged = {
      ...current,
      ...updates,
      agents: updates.agents ? {
        ...current.agents,
        ...updates.agents
      } : current.agents,
      customAgents: updates.customAgents ? {
        ...current.customAgents,
        ...updates.customAgents
      } : current.customAgents
    };
    const configDir = path7.dirname(this.configPath);
    if (!fs11.existsSync(configDir)) {
      fs11.mkdirSync(configDir, { recursive: true });
    }
    fs11.writeFileSync(this.configPath, JSON.stringify(merged, null, 2));
    this.cachedConfig = merged;
    this.cachedCustomAgentConfigs = null;
    return merged;
  }
  exists() {
    return fs11.existsSync(this.configPath);
  }
  init() {
    if (!this.exists()) {
      return this.set(DEFAULT_HIVE_CONFIG);
    }
    return this.get();
  }
  getAgentConfig(agent) {
    const resolvedAgent = agent === "hive" ? "zetta" : agent;
    const config = this.get();
    if (this.isBuiltInAgent(resolvedAgent)) {
      const agentConfig = config.agents?.[resolvedAgent] ?? {};
      const defaultAutoLoadSkills = DEFAULT_HIVE_CONFIG.agents?.[resolvedAgent]?.autoLoadSkills ?? [];
      const effectiveAutoLoadSkills = this.resolveAutoLoadSkills(defaultAutoLoadSkills, agentConfig.autoLoadSkills ?? [], this.isPlannerAgent(resolvedAgent));
      return {
        ...agentConfig,
        autoLoadSkills: effectiveAutoLoadSkills
      };
    }
    const customAgents = this.getCustomAgentConfigs();
    return customAgents[agent] ?? {};
  }
  getCustomAgentConfigs() {
    if (this.cachedCustomAgentConfigs !== null) {
      return this.cachedCustomAgentConfigs;
    }
    const config = this.get();
    const customAgents = this.isObjectRecord(config.customAgents) ? config.customAgents : {};
    const resolved = {};
    for (const [agentName, declaration] of Object.entries(customAgents)) {
      if (this.isReservedCustomAgentName(agentName)) {
        console.warn(`[hive:config] Skipping custom agent "${agentName}": reserved name`);
        continue;
      }
      if (!this.isObjectRecord(declaration)) {
        console.warn(`[hive:config] Skipping custom agent "${agentName}": invalid declaration (expected object)`);
        continue;
      }
      const baseAgent = declaration["baseAgent"];
      if (typeof baseAgent !== "string" || !this.isSupportedCustomAgentBase(baseAgent)) {
        console.warn(`[hive:config] Skipping custom agent "${agentName}": unsupported baseAgent "${String(baseAgent)}"`);
        continue;
      }
      const autoLoadSkillsValue = declaration["autoLoadSkills"];
      const additionalAutoLoadSkills = Array.isArray(autoLoadSkillsValue) ? autoLoadSkillsValue.filter((skill) => typeof skill === "string") : [];
      const baseAgentConfig = this.getAgentConfig(baseAgent);
      const effectiveAutoLoadSkills = this.resolveAutoLoadSkills(baseAgentConfig.autoLoadSkills ?? [], additionalAutoLoadSkills, this.isPlannerAgent(baseAgent));
      const descriptionValue = declaration["description"];
      const description = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
      if (!description) {
        console.warn(`[hive:config] Skipping custom agent "${agentName}": description must be a non-empty string`);
        continue;
      }
      const modelValue = declaration["model"];
      const temperatureValue = declaration["temperature"];
      const variantValue = declaration["variant"];
      const model = typeof modelValue === "string" ? modelValue.trim() || "" : baseAgentConfig.model || "";
      const variant = typeof variantValue === "string" ? variantValue.trim() || baseAgentConfig.variant : baseAgentConfig.variant;
      resolved[agentName] = {
        baseAgent,
        description,
        model,
        temperature: typeof temperatureValue === "number" ? temperatureValue : baseAgentConfig.temperature,
        variant,
        autoLoadSkills: effectiveAutoLoadSkills
      };
    }
    this.cachedCustomAgentConfigs = resolved;
    return this.cachedCustomAgentConfigs;
  }
  hasConfiguredAgent(agent) {
    if (this.isBuiltInAgent(agent)) {
      return true;
    }
    const customAgents = this.getCustomAgentConfigs();
    return customAgents[agent] !== undefined;
  }
  isBuiltInAgent(agent) {
    return BUILT_IN_AGENT_NAMES.includes(agent);
  }
  isReservedCustomAgentName(agent) {
    return CUSTOM_AGENT_RESERVED_NAMES.includes(agent);
  }
  isSupportedCustomAgentBase(baseAgent) {
    return CUSTOM_AGENT_BASES.includes(baseAgent);
  }
  isPlannerAgent(agent) {
    return agent === "zetta" || agent === "architect-planner";
  }
  isObjectRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  resolveAutoLoadSkills(baseAutoLoadSkills, additionalAutoLoadSkills, isPlannerAgent) {
    const effectiveAdditionalSkills = isPlannerAgent ? additionalAutoLoadSkills : additionalAutoLoadSkills.filter((skill) => skill !== "onboarding");
    const combinedAutoLoadSkills = [...baseAutoLoadSkills, ...effectiveAdditionalSkills];
    const uniqueAutoLoadSkills = Array.from(new Set(combinedAutoLoadSkills));
    const disabledSkills = this.getDisabledSkills();
    return uniqueAutoLoadSkills.filter((skill) => !disabledSkills.includes(skill));
  }
  isOmoSlimEnabled() {
    const config = this.get();
    return config.omoSlimEnabled === true;
  }
  getDisabledSkills() {
    const config = this.get();
    return config.disableSkills ?? [];
  }
  getDisabledMcps() {
    const config = this.get();
    return config.disableMcps ?? [];
  }
  getSandboxConfig() {
    const config = this.get();
    const mode = config.sandbox ?? "none";
    const image = config.dockerImage;
    const persistent = config.persistentContainers ?? mode === "docker";
    return { mode, ...image && { image }, persistent };
  }
  getHookCadence(hookName, options) {
    const config = this.get();
    const configuredCadence = config.hook_cadence?.[hookName];
    if (options?.safetyCritical && configuredCadence && configuredCadence > 1) {
      console.warn(`[hive:cadence] Ignoring cadence > 1 for safety-critical hook: ${hookName}`);
      return 1;
    }
    if (configuredCadence === undefined || configuredCadence === null) {
      return 1;
    }
    if (configuredCadence <= 0 || !Number.isInteger(configuredCadence)) {
      console.warn(`[hive:cadence] Invalid cadence ${configuredCadence} for ${hookName}, using 1`);
      return 1;
    }
    return configuredCadence;
  }
}
// src/services/agentsMdService.ts
import * as fs12 from "fs";
import * as path8 from "path";
class AgentsMdService {
  rootDir;
  contextService;
  constructor(rootDir, contextService) {
    this.rootDir = rootDir;
    this.contextService = contextService;
  }
  async init() {
    const agentsMdPath = path8.join(this.rootDir, "AGENTS.md");
    const existed = fileExists(agentsMdPath);
    if (existed) {
      const existing = readText(agentsMdPath);
      return { content: existing || "", existed: true };
    }
    const content = await this.scanAndGenerate();
    return { content, existed: false };
  }
  async sync(featureName) {
    const contexts = this.contextService.list(featureName);
    const agentsMdPath = path8.join(this.rootDir, "AGENTS.md");
    const current = await fs12.promises.readFile(agentsMdPath, "utf-8").catch(() => "");
    const findings = this.extractFindings(contexts);
    const proposals = this.generateProposals(findings, current);
    return { proposals, diff: this.formatDiff(current, proposals) };
  }
  apply(content) {
    const agentsMdPath = path8.join(this.rootDir, "AGENTS.md");
    const isNew = !fileExists(agentsMdPath);
    writeText(agentsMdPath, content);
    return { path: agentsMdPath, chars: content.length, isNew };
  }
  extractFindings(contexts) {
    const findings = [];
    const patterns = [
      /we\s+use\s+[^.\n]+/gi,
      /prefer\s+[^.\n]+\s+over\s+[^.\n]+/gi,
      /don't\s+use\s+[^.\n]+/gi,
      /do\s+not\s+use\s+[^.\n]+/gi,
      /(?:build|test|dev)\s+command:\s*[^.\n]+/gi,
      /[a-zA-Z]+\s+lives?\s+in\s+\/[^\s.\n]+/gi
    ];
    for (const context of contexts) {
      const lines = context.content.split(`
`);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
          continue;
        for (const pattern of patterns) {
          const matches = trimmed.match(pattern);
          if (matches) {
            for (const match of matches) {
              const finding = match.trim();
              if (finding && !findings.includes(finding)) {
                findings.push(finding);
              }
            }
          }
        }
      }
    }
    return findings;
  }
  generateProposals(findings, current) {
    const proposals = [];
    const currentLower = current.toLowerCase();
    for (const finding of findings) {
      const findingLower = finding.toLowerCase();
      if (!currentLower.includes(findingLower)) {
        proposals.push(finding);
      }
    }
    return proposals;
  }
  formatDiff(current, proposals) {
    if (proposals.length === 0)
      return "";
    const lines = proposals.map((p) => `+ ${p}`);
    return lines.join(`
`);
  }
  async scanAndGenerate() {
    const detections = await this.detectProjectInfo();
    return this.generateTemplate(detections);
  }
  async detectProjectInfo() {
    const packageJsonPath = path8.join(this.rootDir, "package.json");
    let packageJson = null;
    if (fileExists(packageJsonPath)) {
      try {
        const content = readText(packageJsonPath);
        packageJson = content ? JSON.parse(content) : null;
      } catch {}
    }
    const info = {
      packageManager: this.detectPackageManager(),
      language: this.detectLanguage(),
      testFramework: this.detectTestFramework(packageJson),
      buildCommand: packageJson?.scripts?.build || null,
      testCommand: packageJson?.scripts?.test || null,
      devCommand: packageJson?.scripts?.dev || null,
      isMonorepo: this.detectMonorepo(packageJson)
    };
    return info;
  }
  detectPackageManager() {
    if (fileExists(path8.join(this.rootDir, "bun.lockb")))
      return "bun";
    if (fileExists(path8.join(this.rootDir, "pnpm-lock.yaml")))
      return "pnpm";
    if (fileExists(path8.join(this.rootDir, "yarn.lock")))
      return "yarn";
    if (fileExists(path8.join(this.rootDir, "package-lock.json")))
      return "npm";
    return "npm";
  }
  detectLanguage() {
    if (fileExists(path8.join(this.rootDir, "tsconfig.json")))
      return "TypeScript";
    if (fileExists(path8.join(this.rootDir, "package.json")))
      return "JavaScript";
    if (fileExists(path8.join(this.rootDir, "requirements.txt")))
      return "Python";
    if (fileExists(path8.join(this.rootDir, "go.mod")))
      return "Go";
    if (fileExists(path8.join(this.rootDir, "Cargo.toml")))
      return "Rust";
    return "Unknown";
  }
  detectTestFramework(packageJson) {
    if (!packageJson)
      return null;
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    if (deps?.vitest)
      return "vitest";
    if (deps?.jest)
      return "jest";
    if (this.detectPackageManager() === "bun")
      return "bun test";
    if (deps?.pytest)
      return "pytest";
    return null;
  }
  detectMonorepo(packageJson) {
    if (!packageJson)
      return false;
    return !!packageJson.workspaces;
  }
  generateTemplate(info) {
    const sections = [];
    sections.push(`# Agent Guidelines
`);
    sections.push(`## Overview
`);
    sections.push(`This project uses AI-assisted development. Follow these guidelines.
`);
    sections.push(`## Build & Test Commands
`);
    sections.push("```bash");
    if (info.isMonorepo) {
      sections.push("# This is a monorepo using bun workspaces");
    }
    if (info.buildCommand) {
      sections.push(`# Build`);
      sections.push(`${info.packageManager} run build`);
      sections.push("");
    }
    if (info.testCommand) {
      sections.push(`# Run tests`);
      sections.push(`${info.packageManager} ${info.testCommand === "bun test" ? "test" : "run test"}`);
      sections.push("");
    }
    if (info.devCommand) {
      sections.push(`# Development mode`);
      sections.push(`${info.packageManager} run dev`);
    }
    sections.push("```\n");
    sections.push(`## Technology Stack
`);
    sections.push(`- **Language**: ${info.language}`);
    sections.push(`- **Package Manager**: ${info.packageManager}`);
    if (info.testFramework) {
      sections.push(`- **Test Framework**: ${info.testFramework}`);
    }
    if (info.isMonorepo) {
      sections.push(`- **Structure**: Monorepo with workspaces`);
    }
    sections.push("");
    sections.push(`## Code Style
`);
    sections.push(`Follow existing patterns in the codebase.
`);
    sections.push(`## Architecture Principles
`);
    sections.push(`Document key architectural decisions here.
`);
    return sections.join(`
`);
  }
}
// src/services/dockerSandboxService.ts
import { existsSync as existsSync5 } from "fs";
import { join as join9, sep } from "path";
import { execSync } from "child_process";

class DockerSandboxService {
  static detectImage(worktreePath) {
    if (existsSync5(join9(worktreePath, "Dockerfile"))) {
      return null;
    }
    if (existsSync5(join9(worktreePath, "package.json"))) {
      return "node:22-slim";
    }
    if (existsSync5(join9(worktreePath, "requirements.txt")) || existsSync5(join9(worktreePath, "pyproject.toml"))) {
      return "python:3.12-slim";
    }
    if (existsSync5(join9(worktreePath, "go.mod"))) {
      return "golang:1.22-slim";
    }
    if (existsSync5(join9(worktreePath, "Cargo.toml"))) {
      return "rust:1.77-slim";
    }
    return "ubuntu:24.04";
  }
  static buildRunCommand(worktreePath, command, image) {
    const escapedCommand = command.replace(/'/g, "'\\''");
    return `docker run --rm -v ${worktreePath}:/app -w /app ${image} sh -c '${escapedCommand}'`;
  }
  static containerName(worktreePath) {
    const parts = worktreePath.split(sep);
    const worktreeIdx = parts.indexOf(".worktrees");
    if (worktreeIdx === -1 || worktreeIdx + 2 >= parts.length) {
      return `hive-sandbox-${Date.now()}`;
    }
    const feature = parts[worktreeIdx + 1];
    const task = parts[worktreeIdx + 2];
    const name = `hive-${feature}-${task}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    return name.slice(0, 63);
  }
  static ensureContainer(worktreePath, image) {
    const name = this.containerName(worktreePath);
    try {
      execSync(`docker inspect --format='{{.State.Running}}' ${name}`, { stdio: "pipe" });
      return name;
    } catch {
      execSync(`docker run -d --name ${name} -v ${worktreePath}:/app -w /app ${image} tail -f /dev/null`, { stdio: "pipe" });
      return name;
    }
  }
  static buildExecCommand(containerName, command) {
    const escapedCommand = command.replace(/'/g, "'\\''");
    return `docker exec ${containerName} sh -c '${escapedCommand}'`;
  }
  static stopContainer(worktreePath) {
    const name = this.containerName(worktreePath);
    try {
      execSync(`docker rm -f ${name}`, { stdio: "ignore" });
    } catch {}
  }
  static isDockerAvailable() {
    try {
      execSync("docker info", { stdio: "ignore", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
  static wrapCommand(worktreePath, command, config) {
    if (command.startsWith("HOST: ")) {
      return command.substring(6);
    }
    if (config.mode === "none") {
      return command;
    }
    let image;
    if (config.image) {
      image = config.image;
    } else {
      image = this.detectImage(worktreePath);
      if (image === null) {
        return command;
      }
    }
    if (config.persistent) {
      const containerName = this.ensureContainer(worktreePath, image);
      return this.buildExecCommand(containerName, command);
    } else {
      return this.buildRunCommand(worktreePath, command, image);
    }
  }
}
// src/services/taskDependencyGraph.ts
function computeRunnableAndBlocked(tasks) {
  const statusByFolder = new Map;
  for (const task of tasks) {
    statusByFolder.set(task.folder, task.status);
  }
  const runnable = [];
  const blocked = {};
  const effectiveDepsByFolder = buildEffectiveDependencies(tasks);
  for (const task of tasks) {
    if (task.status !== "pending") {
      continue;
    }
    const deps = effectiveDepsByFolder.get(task.folder) ?? [];
    const unmetDeps = deps.filter((dep) => {
      const depStatus = statusByFolder.get(dep);
      return depStatus !== "done";
    });
    if (unmetDeps.length === 0) {
      runnable.push(task.folder);
    } else {
      blocked[task.folder] = unmetDeps;
    }
  }
  return { runnable, blocked };
}
function buildEffectiveDependencies(tasks) {
  const orderByFolder = new Map;
  const folderByOrder = new Map;
  for (const task of tasks) {
    const match = task.folder.match(/^(\d+)-/);
    if (!match) {
      orderByFolder.set(task.folder, null);
      continue;
    }
    const order = parseInt(match[1], 10);
    orderByFolder.set(task.folder, order);
    if (!folderByOrder.has(order)) {
      folderByOrder.set(order, task.folder);
    }
  }
  const effectiveDeps = new Map;
  for (const task of tasks) {
    if (task.dependsOn !== undefined) {
      effectiveDeps.set(task.folder, task.dependsOn);
      continue;
    }
    const order = orderByFolder.get(task.folder);
    if (!order || order <= 1) {
      effectiveDeps.set(task.folder, []);
      continue;
    }
    const previousFolder = folderByOrder.get(order - 1);
    effectiveDeps.set(task.folder, previousFolder ? [previousFolder] : []);
  }
  return effectiveDeps;
}
export {
  AgentsMdService,
  BUILT_IN_AGENT_NAMES,
  CUSTOM_AGENT_BASES,
  CUSTOM_AGENT_RESERVED_NAMES,
  ConfigService,
  ContextService,
  DEFAULT_AGENT_MODELS,
  DEFAULT_HIVE_CONFIG,
  DockerSandboxService,
  FeatureService,
  PlanService,
  SessionService,
  SubtaskService,
  TaskService,
  WorktreeService,
  acquireLock,
  acquireLockSync,
  buildEffectiveDependencies,
  computeRunnableAndBlocked,
  createWorktreeService,
  deepMerge,
  detectContext,
  ensureDir,
  fileExists,
  findProjectRoot,
  getApprovedPath,
  getCommentsPath,
  getContextPath,
  getFeatureData,
  getFeatureJsonPath,
  getFeaturePath,
  getFeaturesPath,
  getHivePath,
  getLockPath,
  getPlanPath,
  getSubtaskPath,
  getSubtaskReportPath,
  getSubtaskSpecPath,
  getSubtaskStatusPath,
  getSubtasksPath,
  getTaskPath,
  getTaskReportPath,
  getTaskSpecPath,
  getTaskStatusPath,
  getTasksPath,
  listFeatures,
  normalizePath,
  patchJsonLocked,
  patchJsonLockedSync,
  readJson,
  readText,
  writeAtomic,
  writeJson,
  writeJsonAtomic,
  writeJsonLocked,
  writeJsonLockedSync,
  writeText
};
