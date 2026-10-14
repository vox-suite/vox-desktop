import { useEffect, useRef } from "react";
import { useTheme, useVoxColors, type VoxColor } from "@/lib/theme";

const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDpr;
uniform vec2 uMouse;
uniform vec3 uAccent;
uniform float uEnergy;
uniform vec3 uBase;
uniform vec3 uDot;
uniform float uVignette;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  float v=0.,a=.5;
  for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}
  return v;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  float t=uTime*(.025+.05*uEnergy);
  vec2 q=vec2(fbm(p*1.3+t),fbm(p*1.3+vec2(5.2,1.3)-t));
  float f=fbm(p*1.1+2.*q+t*.5);

  vec3 col=uBase;
  col=mix(col,uDot,smoothstep(.35,.95,f)*.018);

  vec2 cell=fract(gl_FragCoord.xy/(24.*uDpr))-.5;
  float dotMask=smoothstep(.085,.035,length(cell));
  col=mix(col,uDot,dotMask*(.05+.35*f*f));

  float vignette=smoothstep(1.35,.28,length((uv-.5)*vec2(1.15,1.)));
  col*=mix(uVignette,1.,vignette);
  col+=(hash(gl_FragCoord.xy+fract(uTime)*91.7)-.5)*.030;
  gl_FragColor=vec4(col,1.);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function SpaceShader({
  accent,
  energy,
}: {
  accent: VoxColor;
  energy: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const colors = useVoxColors();
  const vignette = useTheme() === "light" ? 0.94 : 0.55;
  const resolve = () => ({
    accent: hexToRgb(colors[accent]),
    base: hexToRgb(colors.background),
    dot: hexToRgb(colors["text-muted"]),
    vignette,
    energy,
  });
  const target = useRef(resolve());
  useEffect(() => {
    target.current = resolve();
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "size-full";
    host.appendChild(canvas);
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      host.removeChild(canvas);
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) {
      host.removeChild(canvas);
      return;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      host.removeChild(canvas);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes");
    const uTime = u("uTime");
    const uDpr = u("uDpr");
    const uMouse = u("uMouse");
    const uAccent = u("uAccent");
    const uEnergy = u("uEnergy");
    const uBase = u("uBase");
    const uDot = u("uDot");
    const uVignette = u("uVignette");

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const mouse = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };
    const current = {
      accent: [...target.current.accent],
      energy: target.current.energy,
    };
    let raf = 0;
    let last = 0;
    const start = performance.now();

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const draw = (now: number) => {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      for (let i = 0; i < 3; i++)
        current.accent[i] +=
          (target.current.accent[i] - current.accent[i]) * 0.04;
      current.energy += (target.current.energy - current.energy) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform1f(uDpr, dpr);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform3f(
        uAccent,
        current.accent[0],
        current.accent[1],
        current.accent[2],
      );
      gl.uniform1f(uEnergy, current.energy);
      gl.uniform3f(uBase, ...target.current.base);
      gl.uniform3f(uDot, ...target.current.dot);
      gl.uniform1f(uVignette, target.current.vignette);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 40) return;
      last = now;
      draw(now);
    };
    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (event.clientX - rect.left) / rect.width;
      mouse.ty = (event.clientY - rect.top) / rect.height;
    };
    window.addEventListener("pointermove", onMove);
    const observer = new ResizeObserver(() => {
      if (still) draw(performance.now());
    });
    observer.observe(canvas);
    if (still) draw(performance.now());
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      observer.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(color-mix(in_srgb,var(--vox-ink)_7%,transparent)_1px,transparent_1px)] [background-size:24px_24px]"
    />
  );
}
