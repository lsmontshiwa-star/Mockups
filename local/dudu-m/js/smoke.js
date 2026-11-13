/* Ink smoke cursor. Fluid solver adapted from "WebGL Fluid Simulation" by Pavel Dobryakov (MIT, github.com/PavelDoGreat/WebGL-Fluid-Simulation).
   Usage: inkSmoke(canvas, {ink:[r,g,b], fade, force, radius, curl, area}) */
(function(){
window.inkSmoke=function(canvas,opt){
  const C=Object.assign({SIM:128,DYE:1024,fade:1.5,velFade:0.6,pressure:0.8,iters:20,curl:18,radius:0.22,force:6000,amount:0.22,ink:[0.08,0.085,0.09]},opt||{});
  const params={alpha:true,depth:false,stencil:false,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:false};
  let gl=canvas.getContext('webgl2',params);const isGL2=!!gl;
  if(!gl)gl=canvas.getContext('webgl',params);
  if(!gl)return null;
  // skip software rendering (slow machines)
  try{const d=gl.getExtension('WEBGL_debug_renderer_info');if(d&&/swiftshader|llvmpipe|software/i.test(gl.getParameter(d.UNMASKED_RENDERER_WEBGL))&&!opt.allowSoftware)return null}catch(e){}
  let half,lin;
  if(isGL2){gl.getExtension('EXT_color_buffer_float');lin=gl.getExtension('OES_texture_float_linear')}
  else{half=gl.getExtension('OES_texture_half_float');lin=gl.getExtension('OES_texture_half_float_linear');if(!half)return null}
  const T=isGL2?gl.HALF_FLOAT:half.HALF_FLOAT_OES;
  function supported(i,f){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,i,4,4,0,f,T,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return gl.checkFramebufferStatus(gl.FRAMEBUFFER)==gl.FRAMEBUFFER_COMPLETE}
  function fmt(i,f){if(!isGL2)return supported(gl.RGBA,gl.RGBA)?{i:gl.RGBA,f:gl.RGBA}:null;if(supported(i,f))return{i,f};if(i===gl.R16F)return fmt(gl.RG16F,gl.RG);if(i===gl.RG16F)return fmt(gl.RGBA16F,gl.RGBA);return null}
  const RGBA=isGL2?fmt(gl.RGBA16F,gl.RGBA):fmt(),RG=isGL2?fmt(gl.RG16F,gl.RG):RGBA,R=isGL2?fmt(gl.R16F,gl.RED):RGBA;
  if(!RGBA||!RG||!R)return null;

  function sh(type,src,kw){if(kw)src=kw.map(k=>'#define '+k+'\n').join('')+src;const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.warn(gl.getShaderInfoLog(s));return s}
  function prog(vs,fs){const p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm)}return{p,u,bind(){gl.useProgram(p)}}}
  const V=sh(gl.VERTEX_SHADER,`precision highp float;attribute vec2 aPosition;varying vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}`);
  const H='precision highp float;precision highp sampler2D;varying vec2 vUv,vL,vR,vT,vB;';
  const clearP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}`));
  const splatP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;void main(){vec2 p=vUv-point;p.x*=aspectRatio;vec3 s=exp(-dot(p,p)/radius)*color;gl_FragColor=vec4(texture2D(uTarget,vUv).xyz+s,1.);}`));
  const advP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uVelocity,uSource;uniform vec2 texelSize,dyeTexelSize;uniform float dt,dissipation;
    vec4 bilerp(sampler2D sam,vec2 uv,vec2 ts){vec2 st=uv/ts-.5;vec2 i=floor(st),f=fract(st);vec4 a=texture2D(sam,(i+vec2(.5,.5))*ts),b=texture2D(sam,(i+vec2(1.5,.5))*ts),c=texture2D(sam,(i+vec2(.5,1.5))*ts),d=texture2D(sam,(i+vec2(1.5,1.5))*ts);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
    void main(){
    #ifdef MANUAL
      vec2 co=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;vec4 r=bilerp(uSource,co,dyeTexelSize);
    #else
      vec2 co=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;vec4 r=texture2D(uSource,co);
    #endif
      gl_FragColor=r/(1.+dissipation*dt);}`,lin?null:['MANUAL']));
  const divP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.);}`));
  const curlP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x;gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.);}`));
  const vortP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture2D(uVelocity,vUv).xy+f*dt;gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.);}`));
  const presP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uPressure,uDivergence;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,d=texture2D(uDivergence,vUv).x;gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.);}`));
  const gradP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uPressure,uVelocity;void main(){float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x;vec2 v=texture2D(uVelocity,vUv).xy;v-=vec2(R-L,T-B);gl_FragColor=vec4(v,0.,1.);}`));
  const dispP=prog(V,sh(gl.FRAGMENT_SHADER,H+`uniform sampler2D uTexture;uniform vec3 ink;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float a=clamp(max(c.r,max(c.g,c.b)),0.,1.);a=smoothstep(0.,1.,a)*.92;gl_FragColor=vec4(ink*a,a);}`));

  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,-1,1,1,1,1,-1]),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
  gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(0);
  function blit(t,clear){if(!t){gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.bindFramebuffer(gl.FRAMEBUFFER,null)}else{gl.viewport(0,0,t.w,t.h);gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo)}if(clear){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)}gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0)}
  function fbo(w,h,F,filt){gl.activeTexture(gl.TEXTURE0);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,F.i,w,h,0,F.f,T,null);const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);return{t,fbo:fb,w,h,tx:1/w,ty:1/h,attach(id){gl.activeTexture(gl.TEXTURE0+id);gl.bindTexture(gl.TEXTURE_2D,t);return id}}}
  function dfbo(w,h,F,filt){let a=fbo(w,h,F,filt),b=fbo(w,h,F,filt);return{w,h,tx:a.tx,ty:a.ty,get read(){return a},get write(){return b},swap(){const t=a;a=b;b=t}}}
  function res(r){let ar=gl.drawingBufferWidth/gl.drawingBufferHeight;if(ar<1)ar=1/ar;const mn=Math.round(r),mx=Math.round(r*ar);return gl.drawingBufferWidth>gl.drawingBufferHeight?{w:mx,h:mn}:{w:mn,h:mx}}
  const filt=lin?gl.LINEAR:gl.NEAREST;let dye,vel,div,crl,pres;
  function init(){const s=res(C.SIM),d=res(C.DYE);gl.disable(gl.BLEND);dye=dfbo(d.w,d.h,RGBA,filt);vel=dfbo(s.w,s.h,RG,filt);div=fbo(s.w,s.h,R,gl.NEAREST);crl=fbo(s.w,s.h,R,gl.NEAREST);pres=dfbo(s.w,s.h,R,gl.NEAREST)}
  function size(){const d=Math.min(window.devicePixelRatio||1,2);const w=Math.floor(canvas.clientWidth*d),h=Math.floor(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;init()}}
  size();addEventListener('resize',size);

  function step(dt){gl.disable(gl.BLEND);
    curlP.bind();gl.uniform2f(curlP.u.texelSize,vel.tx,vel.ty);gl.uniform1i(curlP.u.uVelocity,vel.read.attach(0));blit(crl);
    vortP.bind();gl.uniform2f(vortP.u.texelSize,vel.tx,vel.ty);gl.uniform1i(vortP.u.uVelocity,vel.read.attach(0));gl.uniform1i(vortP.u.uCurl,crl.attach(1));gl.uniform1f(vortP.u.curl,C.curl);gl.uniform1f(vortP.u.dt,dt);blit(vel.write);vel.swap();
    divP.bind();gl.uniform2f(divP.u.texelSize,vel.tx,vel.ty);gl.uniform1i(divP.u.uVelocity,vel.read.attach(0));blit(div);
    clearP.bind();gl.uniform1i(clearP.u.uTexture,pres.read.attach(0));gl.uniform1f(clearP.u.value,C.pressure);blit(pres.write);pres.swap();
    presP.bind();gl.uniform2f(presP.u.texelSize,vel.tx,vel.ty);gl.uniform1i(presP.u.uDivergence,div.attach(0));for(let i=0;i<C.iters;i++){gl.uniform1i(presP.u.uPressure,pres.read.attach(1));blit(pres.write);pres.swap()}
    gradP.bind();gl.uniform2f(gradP.u.texelSize,vel.tx,vel.ty);gl.uniform1i(gradP.u.uPressure,pres.read.attach(0));gl.uniform1i(gradP.u.uVelocity,vel.read.attach(1));blit(vel.write);vel.swap();
    advP.bind();gl.uniform2f(advP.u.texelSize,vel.tx,vel.ty);if(!lin)gl.uniform2f(advP.u.dyeTexelSize,vel.tx,vel.ty);const vid=vel.read.attach(0);gl.uniform1i(advP.u.uVelocity,vid);gl.uniform1i(advP.u.uSource,vid);gl.uniform1f(advP.u.dt,dt);gl.uniform1f(advP.u.dissipation,C.velFade);blit(vel.write);vel.swap();
    if(!lin)gl.uniform2f(advP.u.dyeTexelSize,dye.tx,dye.ty);gl.uniform1i(advP.u.uVelocity,vel.read.attach(0));gl.uniform1i(advP.u.uSource,dye.read.attach(1));gl.uniform1f(advP.u.dissipation,C.fade);blit(dye.write);dye.swap()}
  function splat(x,y,dx,dy){const ar=canvas.width/canvas.height;let r=C.radius/100;if(ar>1)r*=ar;
    splatP.bind();gl.uniform1i(splatP.u.uTarget,vel.read.attach(0));gl.uniform1f(splatP.u.aspectRatio,ar);gl.uniform2f(splatP.u.point,x,y);gl.uniform3f(splatP.u.color,dx,dy,0);gl.uniform1f(splatP.u.radius,r);blit(vel.write);vel.swap();
    gl.uniform1i(splatP.u.uTarget,dye.read.attach(0));gl.uniform3f(splatP.u.color,C.amount,C.amount,C.amount);blit(dye.write);dye.swap()}
  function render(){gl.disable(gl.BLEND);dispP.bind();gl.uniform2f(dispP.u.texelSize,1/gl.drawingBufferWidth,1/gl.drawingBufferHeight);gl.uniform1i(dispP.u.uTexture,dye.read.attach(0));gl.uniform3f(dispP.u.ink,C.ink[0],C.ink[1],C.ink[2]);blit(null,true)}

  const area=C.area||canvas;let px=-1,py=-1,moved=false,dx=0,dy=0,nx=0,ny=0,idle=0,running=true,visible=true;
  area.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=1-(e.clientY-r.top)/r.height;if(px>=0){dx+=(x-px);dy+=(y-py)}px=x;py=y;nx=x;ny=y;moved=true;idle=0;wake()});
  area.addEventListener('pointerleave',()=>{px=-1});
  new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake()}).observe(canvas);
  let last=performance.now(),raf=0;
  function wake(){if(!raf){last=performance.now();raf=requestAnimationFrame(loop)}}
  function loop(now){raf=0;if(!visible)return;const dt=Math.min((now-last)/1000,1/60);last=now;size();
    if(moved){const ar=canvas.width/canvas.height;splat(nx,ny,dx*C.force*(ar<1?ar:1),dy*C.force*(ar>1?1/ar:1));dx=dy=0;moved=false}
    step(dt);render();idle+=dt;
    if(idle<C.fade*3.5)raf=requestAnimationFrame(loop)}
  wake();
  return{splat:(x,y,dx,dy)=>{splat(x,y,dx,dy);idle=0;wake()}};
};
})();
