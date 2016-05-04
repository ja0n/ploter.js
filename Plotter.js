export default class Plotter {
  constructor(el, opts) {
    let canvas = typeof el === 'string' ? document.querySelector(el) : el;
    this.ctx = canvas.getContext('2d');
    
    if (!canvas || !this.ctx)
      throw new Error({'Error': 'Canvas element not found.'});
    
    this.actors = [];
    this.editing = true;
    this.dragging = false;
    this.mousedown = {};
    this.offsetX = this.width/2;
    this.offsetY = this.height/2;
    this.vOffsetX = 0;
    this.vOffsetY = 0;
    this.vMaxOffsetX = 20;
    this.vMaxOffsetY = 20;
    this.scale = 1;
    this.minScale = 0.5;
    this.maxScale = 4;
    this.vScale = {
      width: 50,
      vWidth: 1,
      height: 50,
      vHeight: 5  ,
    };

    this.generatrix = 'x';

    this.origin = {
      x: 0,
      y: 0,
    };

    Object.assign(this, opts);

    canvas.addEventListener('mousedown', e => {
      e.preventDefault();
      const loc = this.windowToCanvas(e.clientX, e.clientY);
      const locNormalized = { x: this.normalizeX(loc.x), y: this.normalizeY(loc.y) };

      console.debug('mousedown', loc);
      console.debug('mousedown (normalized)', locNormalized);
      console.debug(`normalize debug | offsetX: ${this.offsetX} scale: ${this.scale}`);

      this.dragging = true;
      this.prevLoc = loc;
      this.dragCallback = function(loc) {
        let dtX = (loc.x - this.prevLoc.x)/this.scale;
        let dtY = (loc.y - this.prevLoc.y)/this.scale;
        this.offsetX += dtX;
        this.offsetY += dtY;
        this.prevLoc = loc;
      };
    });

    canvas.addEventListener('mousemove', e => {
      e.preventDefault(); // prevent selections
      let loc = this.windowToCanvas(e.clientX, e.clientY);
      if (this.dragging) {
        this.cursor('all-scroll');
        this.dragCallback(loc);
        this.runCycle();
        if (this.onDrag) this.onDrag();
        return;
      }
      this.cursor('auto');

    });

    canvas.addEventListener('mouseup', e => {
      this.dragging = false;
    });

    canvas.addEventListener('mousewheel', e => {
      e.preventDefault();

      if (e.deltaY > 0) {
        if (!(this.scale - 0.1 < this.minScale)) 
          this.scale -= 0.1;
      } else {
        if (!(this.scale + 0.1 > this.maxScale))
          this.scale += 0.1;
      }

      this.runCycle();
    });

    addEventListener('mousedown', e =>{
      this.canvasFocus = e.target == canvas;
    });

    addEventListener('keydown', e => {
      if (!this.canvasFocus) return;

      this.vOffsetX += this.vOffsetX < this.vMaxOffsetX ? 1 : 0;

      if (this.selected) {
        if (e.keyCode === 37) { // left
          this.selected.x -= this.vOffsetX;
        } else if (e.keyCode === 39) { // right
          this.selected.x += this.vOffsetX;
        }
      }
      else {
        if (e.keyCode === 37) { // left
          this.offsetX -= this.vOffsetX;
        } else if (e.keyCode === 39) { // right
          this.offsetX += this.vOffsetX;
        }
      }
      this.runCycle();
      if (this.onDrag) this.onDrag();
    });

    addEventListener('keyup', e => {
      if (!this.canvasFocus) return;
      this.vOffsetX = this.vOffsetY = 0;
    });
  }

  get width() {
    return this.ctx.canvas.width;
  }

  get height() {
    return this.ctx.canvas.height;
  }

  cursor(cursor) {
    let css = this.ctx.canvas.style;
    return cursor ? css.cursor = cursor : css.cursor;
  }

  setState(state) {
    this.state = state;
  }

  isState(state) {
    return this.state === state;
  }

  drawGrid(color = 'lightgrey', stepX = 25, stepY = 25) {
    const { ctx, vScale: { vWidth, vHeight } } = this;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    const width = this.width/this.scale;
    const height = this.height/this.scale;
    
    const startX = this.offsetX % stepX;
    const startY = this.offsetY % stepY;

    let text = -Math.floor((this.offsetX + stepX)/stepX);
    let textY = -Math.floor((this.offsetY + stepY)/stepY);
    
    ctx.font = "10pt Arial";
    ctx.fillStyle = '#000000';
    
    for (let i = startX - stepX + 0.5; i < width + stepX; i += stepX) {
      ctx.beginPath();
      ctx.moveTo(i - this.offsetX, 0 - this.offsetY);
      ctx.lineTo(i - this.offsetX, height - this.offsetY);

      const tWidth = ctx.measureText(text).width;
      const x = i - this.offsetX - (tWidth/2), y = this.origin.y + 15;
      ctx.fillText(text++ * vWidth, x, y);

      ctx.stroke();
    }

    for (let i = startY - stepY + 0.5; i < height + stepY; i += stepY) {
      ctx.beginPath();
      ctx.moveTo(0 - this.offsetX, i - this.offsetY);
      ctx.lineTo(width - this.offsetX, i - this.offsetY);

      const tWidth = ctx.measureText(-text).width;
      const x = this.origin.x - (tWidth + 15), y = i - this.offsetY - 20;
      ctx.fillText((-textY++ * vHeight).toFixed(1), x, y);
      
      ctx.stroke();
    }

    console.log('start', -Math.floor(this.offsetX/stepX));
    console.log('plus ahead', Math.ceil(width/stepX));

    ctx.restore();
  }
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
  startDragging(loc) {
    this.mousedown.x = loc.x;
    this.mousedown.y = loc.y;
  }
  windowToCanvas(x, y) {
    const canvas = this.ctx.canvas;
    const bbox = canvas.getBoundingClientRect();

    return { 
      x: x - bbox.left * (canvas.width  / bbox.width),
      y: y - bbox.top  * (canvas.height / bbox.height),
    };
  }
  drawHorizontalLine (y) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(0 - this.offsetX, y+0.5);
    ctx.lineTo(0 - this.offsetX + this.width/this.scale, y+0.5);
    ctx.stroke();
  }
  drawVerticalLine (x) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x+0.5, 0 - this.offsetY);
    ctx.lineTo(x+0.5, 0 - this.offsetY + this.height/this.scale);
    ctx.stroke();
  }
  
  drawAxes(xlabel = 'x', ylabel = 'y', opts) {
    var x_pad = this.x_padding + 0.5, y_pad = this.y_padding + 0.5;

    const { ctx, origin: { x, y } } = this;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;

    ctx.beginPath();


    ctx.moveTo(-this.offsetX, y/this.scale);
    ctx.lineTo(-this.offsetX + this.width/this.scale, y/this.scale);
    ctx.moveTo(x/this.scale, -this.offsetY);
    ctx.lineTo(x/this.scale, -this.offsetY + this.height/this.scale);
    ctx.stroke();

    // ctx.font = "12pt Arial";
    // ctx.fillStyle = '#000000';
    // ctx.textAlign = "left";
    // ctx.textBaseline = "top";
    // ctx.fillText(xlabel, this.width + this.x_padding + 15/2, this.y_max + this.y_padding - 10);
    // ctx.fillText(ylabel, this.x_min + 15 + 15/2, this.y_padding - 20 );

  }

  generatePoints(fx, n) {
    const { vScale } = this;
    const interval = this.width + Math.abs(this.offsetX);
    const width = this.width/this.scale/vScale.width;
    const k = width/n;

    const Points = new Array();

    const f = new Function('x', 'return ' + fx);
    

    const startX = -(Math.floor(this.offsetX/vScale.width) + 1);
    const endX = Math.ceil(this.width/vScale.width) + 1;

    for (let i = startX; i <= endX; i += k) {
      Points.push({ x: i, y: f(i) });
    }

    return Points;
  }

  drawPoints(data, opts) {
    if(!opts) 
      opts = { color: '#0000ff', dots: true, line: true };
    
    const { ctx, vScale: { vWidth, vHeight } } = this;
    const xScale = this.vScale.width/vWidth;
    const yScale = this.vScale.height/vHeight;

    ctx.save();

    ctx.beginPath();

    const origin = this.origin;

    data.forEach(({ x, y }) => {
      if (opts.line){
        ctx.lineTo(x*xScale,  -y*yScale);
      }
      if (opts.dots){
        ctx.beginPath();
        ctx.arc(x * xScale, -y * yScale, 1, 0, 2 * Math.PI, true);
        ctx.stroke();
      }
    });

    ctx.strokeStyle = opts.color;
    ctx.stroke();
    ctx.restore();
  }
  runCycle() {
    const { ctx, vScale } = this;
    this.clearCanvas();
    ctx.save();
    ctx.scale(this.scale, this.scale);
    ctx.translate(this.offsetX, this.offsetY);
    this.drawGrid('lightgray', vScale.width, vScale.height);
    this.drawAxes();

    const opts = { line: true, dots: false };
    const points = this.generatePoints(this.generatrix, 100);

    this.drawPoints(points, opts);

    ctx.restore();
  }
  normalizeX(x) {
    return (x - this.offsetX)/this.scale;
  }
  normalizeY(y) {
    return (y - this.offsetY)/this.scale;
  }

  round(number) {
    return +(Math.round(number * 2) / 2).toFixed(1)
  }
}

function squared(num) {
  return Math.pow(num, 2);
}