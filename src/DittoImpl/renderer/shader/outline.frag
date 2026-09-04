uniform sampler2D tex;
/** 一倍纹理图的宽度（像素）*/
uniform float tw;
/** 一倍纹理图的高度（像素）*/
uniform float th;
/** 当前纹理图倍数 */
uniform float tsw;
uniform float tsh;

uniform float repeatX;
uniform float repeatY;
uniform float offsetX;
uniform float offsetY;

/** 一倍纹理图下，纹理图中截取坐标X（像素）*/
uniform float x;
/** 一倍纹理图下，纹理图中截取坐标Y（像素）*/
uniform float y;
/** 一倍纹理图下，纹理图中截取宽度（像素）*/
uniform float w;
/** 一倍纹理图下，纹理图中截取高度（像素）*/
uniform float h;
/** 描边宽度（像素）*/
uniform float outlineWidth;
/** 描边透明度（0~1）*/
uniform float outlineAlpha;
/** 描边颜色 */
uniform vec3 outlineColor;
/** 灰度 */
uniform float gray;
/** 混色强度 */
uniform float mixStength;
/** 混色 */
uniform vec3 mixColor;
/** opacity */
uniform float opacity;
uniform bool keepout;

uniform bool cover;
/** 色强度 */
uniform float coverStength;
/** 色 */
uniform vec3 coverColor;

/** 背景色 */
uniform vec3 bgColor;
/** 背景色透明度 */
uniform float bgAlpha;

/** 前景色 */
uniform vec3 fgColor;
/** 前景色透明度 */
uniform float fgAlpha;

uniform float deburrMin;
uniform float deburrMax;
uniform float deburrJudge;

/** 是否启用裁剪（overflow:hidden） */
uniform float clipEnabled;
/** 裁剪矩形（世界坐标，x0,y0,x1,y1） */
uniform vec4 clipRect;

// 灰度权重
const vec3 GRAY_WEIGHT = vec3(0.299, 0.587, 0.114);

const float gamma = 2.2;

varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 gamma_correct(vec3 color) {
  return pow(color, vec3(1.0 / gamma));
}

vec3 gamma_invert(vec3 color) {
  return pow(color, vec3(gamma));
}

vec3 to_gray(vec3 color, float strength) {
  float gray = dot(color, GRAY_WEIGHT);
  return mix(color, vec3(gray), strength);
}

vec4 bgfg(vec3 c0, float a0, vec3 c1, float a1) {
  if(a0 <= 0.0)
    return vec4(c1, a1);
  if(a1 <= 0.0)
    return vec4(c0, a0);
  vec4 ret = vec4(0, 0, 0, 0);
  ret.a = a0 * (1.0 - a1) + a1;
  ret.rgb = (c0 * a0 * (1.0 - a1) + c1 * a1) / ret.a;
  return ret;
}

vec4 apply(vec4 color) {
  if(cover) {
    color.rgb = gamma_correct(coverColor);
    color.a = coverStength;
  }
  if(gray > 0.0)
    color.rgb = to_gray(color.rgb, gray);
  if(mixStength > 0.0)
    color.rgb = mix(color.rgb, gamma_correct(mixColor), mixStength);
  if(bgAlpha > 0.0)
    color = bgfg(bgColor, bgAlpha, color.rgb, color.a);
  if(fgAlpha > 0.0)
    color = bgfg(color.rgb, color.a, fgColor, fgAlpha);
  color.a *= opacity;
  return color;
}

// 输入：rgb 0.0~1.0
// 输出：0.0~1.0，值越大越接近黑色
float getBlackRatio(vec4 rgba) {
    // 人眼感知亮度公式（标准）
    float luminance = 0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b;
    // 1 - 亮度 = 黑色接近度
     // 同时考虑透明度，越不透明越接近黑色
    return (1.0f - luminance) * rgba.a;
}


void main() {
  // 裁剪：超出祖先 overflow:hidden 视口的部分不绘制
  if(clipEnabled > 0.5) {
    vec2 wp = vWorldPosition.xy;
    if(wp.x < clipRect.x || wp.x > clipRect.z || wp.y < clipRect.y || wp.y > clipRect.w)
      discard;
  }
  /** 原图像素宽 */
  float ow = tw / tsw;
  /** 原图像素高 */
  float oh = th / tsh;

  float uv_x = vUv.x * w / ow + x / ow;
  float uv_y = 1.0 + vUv.y * h / oh - (y + h) / oh;
  vec2 uv = vec2(uv_x, uv_y);

  if(!keepout && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) {
    // 超出纹理图的部分将不显示
    gl_FragColor = vec4(0, 0, 0, 0);
    return;
  }
  vec4 color = texture2D(tex, uv);
  color.rgb = gamma_correct(color.rgb);

  // /* 无需描边时，仅处理颜色 */
  // if(outlineAlpha <= 0.0 || outlineWidth <= 0.0) {
  //   gl_FragColor = apply(color);
  //   return;
  // }

  /* 检查中心与四周颜色 */
  float outline = 0.0;
  vec2 texel = vec2(outlineWidth) / vec2(textureSize(tex, 0));
  float center = texture2D(tex, uv).a;

  // TODO 描边宽度大于1像素时，应该检查更多的周围像素
  vec2 coord_up = uv + vec2(0, -texel.y);
  vec2 coord_down = uv + vec2(0, texel.y);
  vec2 coord_left = uv + vec2(-texel.x, 0);
  vec2 coord_right = uv + vec2(texel.x, 0);
  
  float up = texture2D(tex, coord_up).a;
  float down = texture2D(tex, coord_down).a;
  float left = texture2D(tex, coord_left).a;
  float right = texture2D(tex, coord_right).a;

  float topUv    = 1.0 - (y + h) / oh;
  float bottomUv = 1.0 - y / oh;
  if (coord_up.y < topUv) up = 0.0;
  if (coord_down.y > bottomUv) down = 0.0;
  if (coord_left.x < x / ow) left = 0.0;
  if (coord_right.x > (x + w) / ow) right = 0.0;

  outline = max(max(abs(center - up), abs(center - down)), max(abs(center - left), abs(center - right)));
  
  if(outline > 0.5 && center < 0.5) {
    // 描边
    // 颜色与原图混合
    if(outlineAlpha > 0.0)
      color = vec4(gamma_correct(outlineColor), outlineAlpha);
    if(bgAlpha > 0.0)
      color = bgfg(bgColor, bgAlpha, color.rgb, color.a);
    if(fgAlpha > 0.0)
      color = bgfg(color.rgb, color.a, fgColor, fgAlpha);
    color.a *= opacity;
    gl_FragColor = color;
  } else if(outline > 0.5 && center >= 0.5 && deburrMax > deburrMin && deburrJudge < 1.0) {
    // 内边缘去毛刺
    float blackRatio = getBlackRatio(color);
    if(blackRatio > deburrJudge)
      color.a *= smoothstep(deburrMax, deburrMin, (blackRatio - deburrJudge) / (1.0 - deburrJudge));
    if(outlineAlpha > 0.0) 
        color = bgfg(gamma_correct(outlineColor), outlineAlpha, color.rgb, color.a);
    gl_FragColor = apply(color);
  } else  { 
    // 非边缘的像素
    gl_FragColor = apply(color);
  }
}