window.domToSvg = (prefix) => {
  const VW = innerWidth;
  const VH = innerHeight;
  const defs = [];
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  const measure = document.createElement("canvas").getContext("2d");
  let counter = 0;
  const symbols = new Map();
  const filters = new Map();
  const patterns = new Map();
  const uid = (kind) => `${prefix}-${kind}${counter++}`;
  const round = (n) => Math.round(n * 10) / 10;
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const colorCache = new Map();
  function rgba(value) {
    if (colorCache.has(value)) return colorCache.get(value);
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = "rgba(0,0,0,0)";
    pctx.fillStyle = value;
    pctx.fillRect(0, 0, 1, 1);
    const d = pctx.getImageData(0, 0, 1, 1).data;
    const out = [d[0], d[1], d[2], round(d[3] / 255)];
    colorCache.set(value, out);
    return out;
  }
  const fillAttrs = (value, attr = "fill") => {
    const [r, g, b, a] = rgba(value);
    if (a === 0) return "";
    return ` ${attr}="rgb(${r},${g},${b})"${a < 1 ? ` ${attr}-opacity="${a}"` : ""}`;
  };

  const FONT_MAP = [
    [/space grotesk/i, "var(--font-space-grotesk), Inter, sans-serif"],
    [/mono|menlo|consolas|courier/i, "var(--font-jetbrains-mono), ui-monospace, monospace"],
    [/inter|helvetica|arial|system-ui|sans-serif/i, "var(--font-inter), system-ui, sans-serif"],
  ];
  const FONT_CLASS = {
    "var(--font-space-grotesk), Inter, sans-serif": `${prefix}-g`,
    "var(--font-jetbrains-mono), ui-monospace, monospace": `${prefix}-m`,
    "var(--font-inter), system-ui, sans-serif": `${prefix}-i`,
  };
  const mapFont = (family) => {
    for (const [re, out] of FONT_MAP) if (re.test(family)) return out;
    return "var(--font-inter), system-ui, sans-serif";
  };

  function radiiOf(cs, w, h) {
    const read = (v, ref) => {
      const m = String(v).split(" ")[0];
      if (m.endsWith("%")) return (parseFloat(m) / 100) * ref;
      return parseFloat(m) || 0;
    };
    let tl = read(cs.borderTopLeftRadius, w);
    let tr = read(cs.borderTopRightRadius, w);
    let br = read(cs.borderBottomRightRadius, w);
    let bl = read(cs.borderBottomLeftRadius, w);
    const f = Math.min(
      1,
      tl + tr ? w / (tl + tr) : 1,
      bl + br ? w / (bl + br) : 1,
      tl + bl ? h / (tl + bl) : 1,
      tr + br ? h / (tr + br) : 1,
    );
    return [tl * f, tr * f, br * f, bl * f];
  }

  function shapePath(x, y, w, h, r) {
    const [tl, tr, br, bl] = r;
    return (
      `M${round(x + tl)} ${round(y)}H${round(x + w - tr)}` +
      (tr ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(x + w)} ${round(y + tr)}` : "") +
      `V${round(y + h - br)}` +
      (br ? `A${round(br)} ${round(br)} 0 0 1 ${round(x + w - br)} ${round(y + h)}` : "") +
      `H${round(x + bl)}` +
      (bl ? `A${round(bl)} ${round(bl)} 0 0 1 ${round(x)} ${round(y + h - bl)}` : "") +
      `V${round(y + tl)}` +
      (tl ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(x + tl)} ${round(y)}` : "") +
      "Z"
    );
  }

  function shapeEl(x, y, w, h, r, attrs) {
    if (r.every((v) => v === r[0])) {
      const rx = round(r[0]);
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"${rx ? ` rx="${rx}"` : ""}${attrs}/>`;
    }
    return `<path d="${shapePath(x, y, w, h, r)}"${attrs}/>`;
  }

  function splitTop(str) {
    const parts = [];
    let depth = 0;
    let cur = "";
    for (const ch of str) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  function parseShadows(value) {
    if (!value || value === "none") return [];
    return splitTop(value)
      .map((s) => {
        const inset = /\binset\b/.test(s);
        const nums = [...s.matchAll(/(-?[\d.]+)px/g)].map((m) => parseFloat(m[1]));
        const colorStr = s
          .replace(/\binset\b/g, "")
          .replace(/(-?[\d.]+)px/g, "")
          .trim();
        return { inset, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, color: colorStr };
      })
      .filter((s) => !s.inset && rgba(s.color)[3] > 0 && (s.blur > 0 || s.spread > 0 || s.x || s.y));
  }

  function gradientFill(image, w, h, x, y) {
    const m = image.match(/^(repeating-linear-gradient|linear-gradient|radial-gradient)\((.*)\)$/s);
    if (!m) return null;
    const kind = m[1];
    const args = splitTop(m[2]);
    const stopRe = /^(.*?)(?:\s+(-?[\d.]+)(px|%))?$/;
    const toStops = (list) =>
      list.map((s) => {
        const cm = s.match(/^(.*\))\s*(-?[\d.]+(?:px|%))?\s*(-?[\d.]+(?:px|%))?$/) || s.match(stopRe);
        return { color: (cm[1] || s).trim(), pos: cm[2] };
      });
    if (kind === "repeating-linear-gradient") {
      let list = args;
      if (/^(to |[\d.]+deg)/.test(list[0])) list = list.slice(1);
      const stops = toStops(list);
      const period = parseFloat(stops[stops.length - 1].pos);
      if (!period || !stops[stops.length - 1].pos.endsWith("px")) return null;
      if (
        stops.length === 4 &&
        parseFloat(stops[0].pos) === 0 &&
        stops[1].pos === stops[2].pos &&
        rgba(stops[2].color)[3] === 0
      )
        return { dash: { color: stops[0].color, on: parseFloat(stops[1].pos), period } };
      const pid = uid("p");
      let rects = "";
      for (let i = 0; i < stops.length - 1; i++) {
        const a = parseFloat(stops[i].pos);
        const b = parseFloat(stops[i + 1].pos);
        const fill = fillAttrs(stops[i].color);
        if (fill && b > a) rects += `<rect x="0" y="${a}" width="${w}" height="${b - a}"${fill}/>`;
      }
      defs.push(
        `<pattern id="${pid}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${period}" patternUnits="userSpaceOnUse">${rects}</pattern>`,
      );
      return `url(#${pid})`;
    }
    if (kind === "linear-gradient") {
      let angle = 180;
      let list = args;
      if (/^to /.test(list[0])) {
        const map = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
        angle = map[list[0]] ?? 180;
        list = list.slice(1);
      } else if (/deg$/.test(list[0])) {
        angle = parseFloat(list[0]);
        list = list.slice(1);
      }
      const stops = toStops(list);
      const rad = (angle * Math.PI) / 180;
      const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
      const cx = x + w / 2;
      const cy = y + h / 2;
      const dx = (Math.sin(rad) * len) / 2;
      const dy = (-Math.cos(rad) * len) / 2;
      const gid = uid("g");
      const st = stops
        .map((s, i) => {
          const [r, g, b, a] = rgba(s.color);
          const off = s.pos
            ? s.pos.endsWith("%")
              ? parseFloat(s.pos) / 100
              : parseFloat(s.pos) / len
            : i / Math.max(1, stops.length - 1);
          return `<stop offset="${round(off)}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>`;
        })
        .join("");
      defs.push(
        `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${round(cx - dx)}" y1="${round(cy - dy)}" x2="${round(cx + dx)}" y2="${round(cy + dy)}">${st}</linearGradient>`,
      );
      return `url(#${gid})`;
    }
    if (kind === "radial-gradient") {
      let list = args;
      let cx = x + w / 2;
      let cy = y + h / 2;
      let rx = Math.max(w, h) / 2;
      let ry = rx;
      if (!/^(rgb|oklab|oklch|color|#|[a-z]+\s*\()/i.test(list[0]) || /\bat\b|ellipse|circle|closest|farthest/.test(list[0])) {
        const head = list[0];
        const at = head.match(/at\s+(-?[\d.]+)(px|%)\s+(-?[\d.]+)(px|%)/);
        if (at) {
          cx = x + (at[2] === "%" ? (parseFloat(at[1]) / 100) * w : parseFloat(at[1]));
          cy = y + (at[4] === "%" ? (parseFloat(at[3]) / 100) * h : parseFloat(at[3]));
        }
        const size = head.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+at/);
        if (size) {
          rx = parseFloat(size[1]);
          ry = parseFloat(size[2]);
        } else if (/farthest-corner/.test(head)) {
          rx = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy)) / Math.SQRT2;
          ry = rx;
        }
        list = list.slice(1);
      }
      const stops = toStops(list);
      const gid = uid("g");
      const st = stops
        .map((s, i) => {
          const [r, g, b, a] = rgba(s.color);
          const off = s.pos ? (s.pos.endsWith("%") ? parseFloat(s.pos) / 100 : parseFloat(s.pos) / rx) : i / Math.max(1, stops.length - 1);
          return `<stop offset="${round(off)}" stop-color="rgb(${r},${g},${b})" stop-opacity="${a}"/>`;
        })
        .join("");
      defs.push(
        `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${round(cx)} ${round(cy)}) scale(${round(rx)} ${round(ry)})">${st}</radialGradient>`,
      );
      return `url(#${gid})`;
    }
    return null;
  }

  function imageEl(href, x, y, w, h, par) {
    if (href.length < 400)
      return `<image x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" href="${esc(href)}" preserveAspectRatio="${par}"/>`;
    const key = par + href;
    let sid = symbols.get(key);
    if (!sid) {
      sid = uid("s");
      symbols.set(key, sid);
      defs.push(`<symbol id="${sid}"><image width="100%" height="100%" href="${esc(href)}" preserveAspectRatio="${par}"/></symbol>`);
    }
    return `<use href="#${sid}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"/>`;
  }

  function dataUrl(canvas) {
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  const SVG_STYLE_PROPS = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "fill-opacity",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "letter-spacing",
    "text-anchor",
    "dominant-baseline",
  ];

  function serializeSvgNode(node) {
    if (node.nodeType === 3) return esc(node.nodeValue);
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "title", "desc", "metadata"].includes(tag)) return "";
    const cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return "";
    const attrs = [];
    const scope = (v) => v.replace(/url\(["']?#([^)"']+)["']?\)/g, (_, id) => `url(#${prefix}-${id})`);
    for (const a of node.attributes) {
      if (["class", "style", "xmlns"].includes(a.name)) continue;
      let value = a.value;
      if (a.name === "id") value = `${prefix}-${value}`;
      else if ((a.name === "href" || a.name === "xlink:href") && value.startsWith("#")) value = `#${prefix}-${value.slice(1)}`;
      else value = scope(value);
      attrs.push(`${a.name}="${esc(value)}"`);
    }
    const merged = new Map();
    for (const a of attrs.filter((x) => !/^(fill|stroke|opacity|font-family)=/.test(x))) {
      const eq = a.indexOf("=");
      merged.set(a.slice(0, eq), a.slice(eq + 1));
    }
    const put = (name, value) => {
      if (!merged.has(name)) merged.set(name, `"${esc(value)}"`);
    };
    for (const p of SVG_STYLE_PROPS) {
      if (p === "fill-opacity" || p === "stroke-opacity") continue;
      if (node.hasAttribute(p) && !["fill", "stroke", "opacity"].includes(p)) continue;
      let v = cs.getPropertyValue(p);
      if (!v || v === "normal") continue;
      if (p === "fill" || p === "stroke") {
        if (v === "none") merged.set(p, '"none"');
        else if (v.startsWith("url(")) merged.set(p, `"${esc(scope(v))}"`);
        else {
          const [r, g, b, al] = rgba(v);
          if (al === 0) merged.set(p, '"none"');
          else {
            merged.set(p, `"rgb(${r},${g},${b})"`);
            if (al < 1) merged.set(`${p}-opacity`, `"${al}"`);
          }
        }
        const rawOpacity = cs.getPropertyValue(`${p}-opacity`);
        if (rawOpacity && parseFloat(rawOpacity) < 1 && !merged.has(`${p}-opacity`)) merged.set(`${p}-opacity`, `"${rawOpacity}"`);
        continue;
      }
      if (p === "font-family") v = mapFont(v);
      put(p, v);
    }
    const attrString = [...merged].map(([k, v]) => `${k}=${v}`).join(" ");
    const kids = [...node.childNodes].map(serializeSvgNode).join("");
    return `<${tag} ${attrString}>${kids}</${tag}>`;
  }

  function fitEllipsis(text, font, spacing, maxWidth) {
    measure.font = font;
    measure.letterSpacing = spacing;
    if (measure.measureText(text).width <= maxWidth) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure.measureText(text.slice(0, mid).trimEnd() + "…").width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo).trimEnd() + "…";
  }

  const out = [];

  function emitText(el, cs, k, clipRight) {
    const color = cs.color;
    if (rgba(color)[3] === 0) return;
    const size = parseFloat(cs.fontSize) * k;
    const family = mapFont(cs.fontFamily);
    const spacing = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) * k;
    let ellipsisRight = null;
    for (let a = el, i = 0; a && i < 3; a = a.parentElement, i++) {
      const acs = getComputedStyle(a);
      if (acs.textOverflow === "ellipsis" && acs.overflowX !== "visible") {
        const r = a.getBoundingClientRect();
        ellipsisRight = r.right - (parseFloat(acs.paddingRight) + parseFloat(acs.borderRightWidth)) * k;
        break;
      }
    }
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      const text = node.nodeValue;
      const range = document.createRange();
      const lines = [];
      let cur = null;
      for (let i = 0; i < text.length; i++) {
        const space = /\s/.test(text[i]);
        if (space && !cur) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        if (!cur || Math.abs(rect.top - cur.top) > rect.height * 0.6) {
          if (space) continue;
          cur = { top: rect.top, height: rect.height, left: rect.left, right: rect.right, text: "" };
          lines.push(cur);
        }
        cur.text += text[i];
        if (!space) cur.right = Math.max(cur.right, rect.right);
      }
      for (const line of lines) {
        let str = line.text.replace(/\s+/g, " ").trim();
        if (!str) continue;
        if (cs.textTransform === "uppercase") str = str.toUpperCase();
        else if (cs.textTransform === "lowercase") str = str.toLowerCase();
        else if (cs.textTransform === "capitalize") str = str.replace(/\b\w/g, (c) => c.toUpperCase());
        let width = line.right - line.left;
        if (/^\s/.test(line.text)) line.left += 0;
        if (ellipsisRight !== null && line.right > ellipsisRight + 0.5) {
          str = fitEllipsis(str, `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`, `${spacing}px`, ellipsisRight - line.left);
          width = Math.min(width, ellipsisRight - line.left);
        }
        if (line.left > VW || line.left + width < 0 || line.top > VH || line.top + line.height < 0) continue;
        const useLength = str.length > 3 && !str.endsWith("…");
        out.push(
          `<text x="${round(line.left)}" y="${round(line.top + line.height / 2)}" font-size="${round(size)}" font-weight="${cs.fontWeight}"${cs.fontStyle === "italic" ? ' font-style="italic"' : ""} class="${FONT_CLASS[family] || ""}"${spacing ? ` letter-spacing="${round(spacing)}"` : ""} dominant-baseline="central"${fillAttrs(color)}${useLength ? ` textLength="${round(width)}" lengthAdjust="spacingAndGlyphs"` : ""} xml:space="preserve">${esc(str)}</text>`,
        );
      }
    }
  }

  function paintBox(el, cs, rect, k) {
    const x = rect.left;
    const y = rect.top;
    const w = rect.width;
    const h = rect.height;
    const r = radiiOf(cs, w, h).map((v) => v * k);
    for (const sh of parseShadows(cs.boxShadow)) {
      const [sr, sg, sb, sa] = rgba(sh.color);
      const sx = sh.x * k;
      const sy = sh.y * k;
      const sp = sh.spread * k;
      const blur = sh.blur * k;
      const mid = uid("m");
      const pad = blur * 3 + sp + Math.abs(sx) + Math.abs(sy) + 4;
      defs.push(
        `<mask id="${mid}" maskUnits="userSpaceOnUse" x="${round(x - pad)}" y="${round(y - pad)}" width="${round(w + pad * 2)}" height="${round(h + pad * 2)}"><rect x="${round(x - pad)}" y="${round(y - pad)}" width="${round(w + pad * 2)}" height="${round(h + pad * 2)}" fill="#fff"/>${shapeEl(x, y, w, h, r, ' fill="#000"')}</mask>`,
      );
      let filter = "";
      if (blur > 0) {
        const sigma = round(blur / 2);
        let fid = filters.get(sigma);
        if (!fid) {
          fid = uid("f");
          filters.set(sigma, fid);
          defs.push(
            `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sigma}"/></filter>`,
          );
        }
        filter = ` filter="url(#${fid})"`;
      }
      out.push(
        `<g mask="url(#${mid})">${shapeEl(x + sx - sp, y + sy - sp, w + sp * 2, h + sp * 2, r.map((v) => v + sp), ` fill="rgb(${sr},${sg},${sb})" fill-opacity="${sa}"${filter}`)}</g>`,
      );
    }
    const bg = rgba(cs.backgroundColor);
    if (bg[3] > 0) out.push(shapeEl(x, y, w, h, r, fillAttrs(cs.backgroundColor)));
    const image = cs.backgroundImage;
    if (image && image !== "none") {
      const fill = gradientFill(image, w, h, x, y);
      if (fill && fill.dash) {
        const y0 = Math.max(y, 0);
        const y1 = Math.min(y + h, VH);
        if (y1 > y0)
          out.push(
            `<path d="M${round(x + w / 2)} ${round(y0)}V${round(y1)}"${fillAttrs(fill.dash.color, "stroke")} stroke-width="${round(w)}" stroke-dasharray="${fill.dash.on} ${fill.dash.period - fill.dash.on}" stroke-dashoffset="${round(y0 - y)}"/>`,
          );
      } else if (fill) out.push(shapeEl(x, y, w, h, r, ` fill="${fill}"`));
    }
    const widths = ["Top", "Right", "Bottom", "Left"].map((s) => parseFloat(cs[`border${s}Width`]) * k || 0);
    const colors = ["Top", "Right", "Bottom", "Left"].map((s) => cs[`border${s}Color`]);
    const styles = ["Top", "Right", "Bottom", "Left"].map((s) => cs[`border${s}Style`]);
    if (widths.some((v) => v > 0)) {
      const uniform = widths.every((v) => v === widths[0]) && colors.every((c) => c === colors[0]) && styles.every((s) => s === styles[0]);
      if (uniform && styles[0] !== "none" && rgba(colors[0])[3] > 0) {
        const bw = widths[0];
        const dash = styles[0] === "dashed" ? ` stroke-dasharray="${round(bw * 3)} ${round(bw * 3)}"` : styles[0] === "dotted" ? ` stroke-dasharray="${bw} ${bw * 2}"` : "";
        out.push(
          shapeEl(x + bw / 2, y + bw / 2, w - bw, h - bw, r.map((v) => Math.max(0, v - bw / 2)), ` fill="none"${fillAttrs(colors[0], "stroke")} stroke-width="${round(bw)}"${dash}`),
        );
      } else {
        const sides = [
          [x, y, w, widths[0]],
          [x + w - widths[1], y, widths[1], h],
          [x, y + h - widths[2], w, widths[2]],
          [x, y, widths[3], h],
        ];
        sides.forEach((s, i) => {
          if (widths[i] > 0 && styles[i] !== "none" && rgba(colors[i])[3] > 0)
            out.push(`<rect x="${round(s[0])}" y="${round(s[1])}" width="${round(s[2])}" height="${round(s[3])}"${fillAttrs(colors[i])}/>`);
        });
      }
    }
    return r;
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "LINK", "META", "TITLE", "NOSCRIPT", "HEAD", "TEMPLATE"]);

  function walk(el, clip) {
    if (SKIP.has(el.tagName)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    if (cs.display === "contents") {
      for (const c of el.children) walk(c, clip);
      return;
    }
    if (cs.visibility === "hidden" && !el.children.length) return;
    const rect = el.getBoundingClientRect();
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) return;
    if (rect.width === 0 && rect.height === 0 && !el.children.length) return;
    if (rect.width <= 1.5 && rect.height <= 1.5 && cs.overflowX !== "visible") return;
    const visibleSvg = el instanceof SVGSVGElement && cs.overflow === "visible";
    const outside = !visibleSvg && (rect.right < clip.l || rect.left > clip.r || rect.bottom < clip.t || rect.top > clip.b);
    if (outside) return;
    const opacity = parseFloat(cs.opacity);
    if (opacity === 0) return;
    const mark = out.length;
    const k = el.offsetWidth ? rect.width / el.offsetWidth : 1;

    if (el instanceof SVGSVGElement) {
      const hasBox = el.hasAttribute("viewBox");
      const vb = hasBox ? el.getAttribute("viewBox") : `0 0 ${el.clientWidth || rect.width} ${el.clientHeight || rect.height}`;
      const kids = [...el.childNodes].map(serializeSvgNode).join("");
      const overflow = cs.overflow === "visible" ? ' overflow="visible"' : "";
      const par = el.getAttribute("preserveAspectRatio");
      out.push(
        `<svg x="${round(rect.left)}" y="${round(rect.top)}" width="${round(rect.width)}" height="${round(rect.height)}" viewBox="${esc(vb)}"${par ? ` preserveAspectRatio="${esc(par)}"` : ""}${overflow}${fillAttrs(cs.color, "color")}>${kids}</svg>`,
      );
    } else if (el instanceof HTMLCanvasElement) {
      const url = el.dataset.replica;
      if (url) out.push(imageEl(url, rect.left, rect.top, rect.width, rect.height, "none"));
    } else if (el instanceof HTMLImageElement) {
      if (el.currentSrc && /^data:/.test(el.currentSrc)) {
        const fit = cs.objectFit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
        out.push(imageEl(el.currentSrc, rect.left, rect.top, rect.width, rect.height, fit));
      }
    } else {
      const radii = paintBox(el, cs, rect, k);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const value = el.value || el.placeholder;
        if (value) {
          const pcs = el.value ? cs : getComputedStyle(el, "::placeholder");
          const size = parseFloat(cs.fontSize) * k;
          const px = rect.left + (parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)) * k;
          const family = FONT_CLASS[mapFont(cs.fontFamily)] || "";
          if (el instanceof HTMLTextAreaElement) {
            const maxWidth = el.clientWidth * k - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) * k;
            const lineHeight = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4) * k;
            measure.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
            const rows = [];
            for (const para of value.split("\n")) {
              let line = "";
              for (const word of para.split(" ")) {
                const test = line ? line + " " + word : word;
                if (line && measure.measureText(test).width > maxWidth) {
                  rows.push(line);
                  line = word;
                } else line = test;
              }
              rows.push(line);
            }
            const top = rect.top + (parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop)) * k;
            rows.forEach((row, i) => {
              out.push(
                `<text x="${round(px)}" y="${round(top + lineHeight * i + lineHeight / 2)}" font-size="${round(size)}" class="${family}" dominant-baseline="central"${fillAttrs(pcs.color)}>${esc(row)}</text>`,
              );
            });
          } else {
            out.push(
              `<text x="${round(px)}" y="${round(rect.top + rect.height / 2)}" font-size="${round(size)}" class="${family}" dominant-baseline="central"${fillAttrs(pcs.color)}>${esc(value)}</text>`,
            );
          }
        }
      } else {
        emitText(el, cs, k);
      }
      const clips = cs.overflowX !== "visible" || cs.overflowY !== "visible";
      const needsClip =
        clips &&
        el !== document.body &&
        el !== document.documentElement &&
        (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || radii.some((v) => v > 0));
      let childClip = clip;
      let clipId = null;
      if (needsClip) {
        const bw = ["Left", "Top", "Right", "Bottom"].map((s) => parseFloat(cs[`border${s}Width`]) * k || 0);
        const cx = rect.left + bw[0];
        const cy = rect.top + bw[1];
        const cw = rect.width - bw[0] - bw[2];
        const ch = rect.height - bw[1] - bw[3];
        clipId = uid("c");
        defs.push(`<clipPath id="${clipId}">${shapeEl(cx, cy, cw, ch, radii.map((v) => Math.max(0, v - bw[0])), "")}</clipPath>`);
        childClip = {
          l: Math.max(clip.l, cx),
          t: Math.max(clip.t, cy),
          r: Math.min(clip.r, cx + cw),
          b: Math.min(clip.b, cy + ch),
        };
        out.push(`<g clip-path="url(#${clipId})">`);
      }
      for (const c of el.children) walk(c, childClip);
      if (clipId) out.push("</g>");
    }
    if (opacity < 1 && out.length > mark) {
      out.splice(mark, 0, `<g opacity="${round(opacity)}">`);
      out.push("</g>");
    }
  }

  const rootBg = (() => {
    const b = getComputedStyle(document.body).backgroundColor;
    if (rgba(b)[3] > 0) return b;
    return getComputedStyle(document.documentElement).backgroundColor;
  })();
  walk(document.body, { l: 0, t: 0, r: VW, b: VH });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<style>${Object.entries(FONT_CLASS)
      .map(([family, cls]) => `.${cls}{font-family:${family}}`)
      .join("")}</style>` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    `<rect width="${VW}" height="${VH}"${fillAttrs(rootBg)}/>` +
    out.join("") +
    "</svg>"
  );
};
