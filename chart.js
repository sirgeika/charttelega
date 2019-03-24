'use strict';

let AXES_TYPE = {
  LINE: 'line',
  X: 'x'
};

let defaultOptions = {
  height: 600,
  width: 600,
  drawPart: 20
};

let months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let weekdays = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun' ];

let modes = {
  night: {
    id: 'night',
    bg: '#2a3240',
    border: '#394758',
    text: '#fff',
    rBg: '#44566b',
    axes: '#44566b',
    axesTxt: '#70797f',
    tooltipTxt: '#fff',
    tooltipShadow: '#262f3a',
    title: 'Switch to Day Mode'
  },
  day: {
    id: 'day',
    bg: '#fff',
    text: '#000',
    border: '#ddd',
    rBg: '#ecf0f1',
    axes: '#ecf0f1',
    axesTxt: '#70797f',
    tooltipTxt: '#595959',
    tooltipShadow: '#dadada',
    title: 'Switch to Night Mode'
  }
};

let moveTimeout = 50;
let frames = 50;
let MIN_INF = Number.NEGATIVE_INFINITY;

let noop = function() {};

let rangeSelector = 'range-selector';

let styleClasses = {
  mainChartWrap: 'main-chart-wrap',
  mainChart: 'main-chart',
  rangeChart: 'range-chart',
  tooltip: 'tooltip',
  rangeSelector: rangeSelector,
  rangeChartArea: 'range-chart-area',
  rsLeft: rangeSelector + '__left',
  rsLeftBar: rangeSelector + '__left-bar',
  rsCenter: rangeSelector + '__center',
  rsRight: rangeSelector + '__right',
  rsRightBar: rangeSelector + '__right-bar',
  checkAxes: 'check-axes',
  checkedLabel: 'checked-label',
  modeSwitcher: 'mode-switcher',
  axesLabels: 'axes-labels'
};

let formatDate = (d, weekday) => {
  let arr = [];
  if (weekday) {
    arr.push(weekdays[d.getDay()] + ',');
  }
  return arr.concat([
    months[d.getMonth()],
    d.getDate()
  ]).join(' ');
};

let createElement = function (root, tag, className) {
  let el = document.createElement(tag);
  if (className) {
    el.setAttribute('class', className);
  }
  return root.appendChild(el);
};

let clrScr = (ctx) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

let include = (n, min, max) => {
  return n >= min && n <= max;
};

let computeTickSize = function(min, max, noTicks) {
  let delta = (max - min) / noTicks,
    dec = -Math.floor(Math.log(delta) / Math.LN10);

  let magn = Math.pow(10, -dec),
    norm = delta / magn,
    size;

  if (norm < 1.5) {
    size = 1;
  } else if (norm < 3) {
    size = 2;
    if (norm > 2.25) {
      size = 2.5;
    }
  } else if (norm < 7.5) {
    size = 5;
  } else {
    size = 10;
  }

  size *= magn;
  return size;
};

let getAxisTickSize = function(min, max, range, ticks) {
  let noTicks = ticks ? ticks : 0.3 * Math.sqrt(range);
  return computeTickSize(min, max, noTicks);
};

let Axis = function(axis) {
  let obj = Object.assign(Object.create(Axis.prototype), axis);
  obj.max = MIN_INF;
  obj.indexMax = -1;
  obj.start = -1;
  obj.finish = -1;
  return obj;
};

Axis.prototype = {
  getStart() {
    return (this.start === -1 ? 0 : this.start);
  },
  getFinish() {
    return this.finish === -1 ? this.dots.length - 1 : this.finish;
  },
  maxY: function(start, finish) {
    start = start >= 0 ? start : this.getStart();
    finish = finish || this.getFinish();

    if (
      start === this.start &&
      finish === this.finish &&
      this.max !== MIN_INF
    ) {
      return this.max;
    }

    if (
      (this.start <= start && this.finish >= finish) &&
      (this.indexMax >= start && this.indexMax < finish) &&
      this.max !== MIN_INF
    ) {
      this.updateRange(start, finish);
      return this.max;
    }

    this.max = MIN_INF;
    for(let i = start; i <= finish; i++) {
      if (this.dots[i] > this.max) {
        this.max = this.dots[i];
        this.indexMax = i;
      }
    }
    this.updateRange(start, finish);
    return this.max;
  },
  updateRange: function(start, finish) {
    this.start = start;
    this.finish = finish;
  }
};

let axes = function(axes, x) {
  let y = axes.map(axis => new Axis(axis));

  return {
    y: y,
    x: x,
    getRangePos: function(callback) {
      let val;
      this.y.some(axis =>{
        if (axis.draw) {
          val = callback(axis);
        }
      });
      return val;
    },
    getRangePosition: function() {
      return {
        start: this.getRangePos(axis => axis.getStart()),
        finish: this.getRangePos(axis => axis.getFinish())
      };
    },
    maxY: function(start, finish) {
      let max = MIN_INF;
      this.y.forEach(axis => {
        if (axis.draw) {
          let m = axis.maxY(start, finish);
          if (m > max) {
            max = m;
          }
        }
      });
      return max;
    },
    checkAxes: function(axData) {
      this.y.some(a => {
        if (a.id === axData.id) {
          a.draw = axData.draw;
          return true;
        }
      });
    },
    clearMaxY: function() {
      this.y.forEach(axis => {
        axis.max = MIN_INF;
      });
    },
    getAxis(id) {
      return this.y.find(axis => {
        return axis.id === id;
      });
    }
  };
};

class Tooltip {
  constructor(elem, options) {
    this.ctx = elem.getContext('2d');
    this.options = {...options};
  }
  draw(x, y, rangePos) {
    let overlay = function(x1, y1, w, h) {
      return this.x >= x1 && this.x <= (x1 + w) &&
        this.y >= y1 && this.y <= (y1 + h);
    };

    this.hide();

    let ctx = this.ctx;
    let { start, finish } = rangePos;

    let height = ctx.canvas.height;
    let width = ctx.canvas.width;

    let fontValue = 'bold 18px verdana, sans-serif';
    let fontName = '14px verdana, sans-serif';
    let txtPadding = 10;
    let fontDate = 'bold 16px verdana, sans-serif';

    let textWidth = {
      val: 0,
      name: 0
    };

    let endAngel = (Math.PI/180) * 360;
    let rel = x / width;
    let parts = rangePos.delta;
    let ind  = Math.round(parts * rel);

    let ratioX = width / parts;
    let ratioY = height / this.options.axes.maxY(start, finish);
    let xPoint = ind * ratioX + rangePos.indentStart * ratioX;

    ctx.beginPath();
    ctx.moveTo(xPoint, 0);
    ctx.lineTo(xPoint, height);
    ctx.strokeStyle = this.options.mode.axes;
    ctx.stroke();

    this.options.axes.y.forEach((axis) => {
      if (axis.draw) {
        let yPoint = height - axis.dots[start + ind] * ratioY;

        ctx.beginPath();
        ctx.arc(xPoint, yPoint,5, 0, endAngel);
        ctx.strokeStyle = axis.color;
        ctx.fillStyle = this.options.mode.bg;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = fontValue;
        let txtValue = ctx.measureText(axis.dots[start + ind]);

        ctx.font = fontName;
        let txtName = ctx.measureText(axis.name);

        textWidth[axis.id] = txtValue.width > txtName.width
          ? txtValue
          : txtName;

        textWidth[axis.id].x = xPoint;
        textWidth[axis.id].y = yPoint;
        textWidth[axis.id].overlay = overlay.bind(textWidth[axis.id]);

        textWidth.val += textWidth[axis.id].width + txtPadding;
        textWidth.name += textWidth[axis.id].width + txtPadding;
      }
    });

    let dateStr = formatDate(this.options.axes.x[start + ind].date, true);

    ctx.font = fontDate;
    let textDate = ctx.measureText(dateStr);

    let rectWidth = Math.max(textDate.width, textWidth.name, textWidth.val) + 40;
    let rectHeight = 100;
    let cornerRadius = 20;
    let rectX = xPoint;
    let rectY = 0;
    let shiftLeft = false;

    rectX = rectX - rectWidth / 3;
    if ((rectX + rectWidth) > width) {
      rectX = width - rectWidth;
      shiftLeft = true;
    } else if (rectX <= 0) {
      rectX = txtPadding;
    }

    this.options.axes.y.some((axis) => {
      if (axis.draw) {
        if (textWidth[axis.id].overlay(rectX, rectY, rectWidth, rectHeight)) {
          if (shiftLeft) {
            rectX = xPoint - rectWidth - txtPadding;
          } else {
            rectX = xPoint + txtPadding * 2;
            if ((rectX + rectWidth) > width) {
              rectX = xPoint - rectWidth - txtPadding;
            }
          }
          return true;
        }
      }
    });

    if (rectX < 0) {
      rectX = txtPadding;
      rectY = Math.min(height - rectHeight, y);
    }

    ctx.save();

    ctx.beginPath();
    ctx.lineJoin = "round";
    ctx.lineWidth = 10;
    ctx.fillStyle = this.options.mode.bg;
    ctx.strokeStyle = this.options.mode.tooltipShadow;

    ctx.strokeRect(
      rectX,
      rectY + (cornerRadius / 2),
      rectWidth - cornerRadius,
      rectHeight - cornerRadius
    );

    ctx.fillRect(
      rectX,
      rectY + (cornerRadius / 2),
      rectWidth - cornerRadius,
      rectHeight - cornerRadius
    );

    ctx.beginPath();
    ctx.strokeStyle = this.options.mode.bg;
    ctx.strokeRect(
      rectX + 1,
      rectY + (cornerRadius / 2) + 1,
      rectWidth - cornerRadius - 3,
      rectHeight - cornerRadius - 3
    );

    ctx.beginPath();
    ctx.fillStyle = this.options.mode.tooltipTxt;
    ctx.font = fontDate;
    ctx.fillText(dateStr, rectX + 10, rectY + 25);

    let prevText = 0;

    this.options.axes.y.forEach((axis, index) => {
      if (axis.draw) {
        ctx.beginPath();
        ctx.fillStyle = axis.color;
        ctx.font = fontValue;
        ctx.fillText(axis.dots[start + ind], rectX + txtPadding + prevText, rectY +60);

        ctx.beginPath();
        ctx.font = fontName;
        ctx.fillText(axis.name, rectX + txtPadding + prevText, rectY + 80);

        prevText += txtPadding + textWidth[axis.id].width;
      }
    });

    ctx.restore();
  }
  hide() {
    clrScr(this.ctx);
  }
  setMode(mode) {
    this.options.mode = mode;
  }
}

class AxesLabels {
  constructor(elem, data, options) {
    this.elem = elem;
    this.data = data;
    this.options = {...options };
    this.height = 0;
    this.width = 0;
    if (this.elem) {
      this.ctx = this.elem.getContext('2d');
      this.height = this.ctx.canvas.height;
      this.width = this.ctx.canvas.width;
    }
    this.init();
  }

  init() {
    if (this.ctx) {
      this.ctx.transform(1, 0, 0, -1, 0, this.height);
    }
  }

  prepareY({min, max, ratio}) {
    let shift = 30;
    let prev, i = 1;
    let height = this.height - shift;
    let width = this.width;
    let tick = Math.ceil(getAxisTickSize(min, max, height));
    let aboveLine = 10;

    let labels = [];
    labels.push({
      x: 5,
      y: height - aboveLine,
      text: min,
      move: { x: 0, y: shift },
      line: { x: width, y: shift }
    });

    do {
      let y = tick * i;
      let yPos = height - (y * ratio) - aboveLine;

      if (yPos - 15 > 0) {
        labels.push({
          x: 5,
          y: yPos,
          text: y,
          move: { x: 0, y: y * ratio + shift },
          line: { x: width, y: y * ratio + shift}
        });
      }
      prev = y;
      i++;
    } while (prev <= max);

    return labels;
  }

  getDataStr(ind) {
    if (ind >= 0 && ind < this.data.x.length) {
      return formatDate(this.data.x[ind].date);
    }
    return '';
  }

  hasLabels() {
    return this.labelsX && this.labelsX.length
  }

  rightEdge() {
    return this.data.x.length - 3;
  }

  getAxisTicksMove(min) {
    let step = Math.abs(this.labelsX[1].ind - this.labelsX[0].ind);
    let i = this.labelsX.dir > 0
      ? 0
      : this.labelsX.length - 1;

    let ind = this.labelsX[i].ind;
    while (ind >= min) {
      ind -= step;
    }
    return {
      ind: Math.max(ind, 0),
      step
    };
  }

  getAxesTicksIncLeft(min, max, noTicks) {
    let ind = max;
    let step = -Math.ceil((max - min) / noTicks);
    if (this.hasLabels() && ind !== this.data.x.length - 1) {
      let i = this.labelsX.dir > 0
        ? this.labelsX.length - 1
        : 0;
      ind = this.labelsX[i].ind;
    } else if (step === -1 || step === -2) {
      ind = max;
    } else {
      ind = this.rightEdge();
    }
    return { step, ind };
  }

  getAxesTicksDecLeft(min, max, noTicks) {
    let ind = max;
    let step = -Math.ceil((max - min) / noTicks);
    if (this.hasLabels()) {
      if (step === -1) {
        ind = max;
      } else {
        let i = this.labelsX.dir > 0
          ? this.labelsX.length - 1
          : 0;
        ind = this.labelsX[i].ind;
      }
    } else {
      ind = this.rightEdge();
    }
    return { step, ind };
  }

  getAxesTicksMoveRight(min, max, noTicks) {
    let ind = min;
    if (this.hasLabels()) {
      let i = this.labelsX.dir > 0
        ? 0
        : this.labelsX.length - 1;
      ind = this.labelsX[i].ind;
    } else {
      ind = 2;
    }
    return {
      step: Math.ceil((max - min) / noTicks),
      ind
    };
  }

  getTicks(min, max, move, noTicks) {
    let tick, ind, step;
    switch (move) {
      case 'move':
        tick = this.getAxisTicksMove(min);
        break;
      case 'incRight':
      case 'decRight':
        tick = this.getAxesTicksMoveRight(min, max, noTicks);
        break;
      case 'incLeft':
        tick = this.getAxesTicksIncLeft(min, max, noTicks);
        break;
      case 'decLeft':
        tick = this.getAxesTicksDecLeft(min, max, noTicks);
        break;
      default:
        tick = Math.ceil(getAxisTickSize(min, max, this.width, noTicks));
        break;
    }
    return tick;
  }

  prepareX({min, max, ratio, move}) {
    if (move === 'none' && this.hasLabels()) {
      return this.labelsX;
    }

    let i = 1;
    let vertPos = this.height - 10;
    let startPos = 0, startX = 0;

    let tick = this.getTicks(min, max, move, 6);
    if (typeof tick === 'object') {
      if (tick.step < 0) {
        startX = this.width - (max - tick.ind) * ratio;
        max = tick.ind;
      } else {
        startX = (tick.ind - min) * ratio;
        min = tick.ind;
      }
      startPos = tick.ind;
      tick = tick.step;
    }

    let labels = [];
    labels.push({
      x: startX + 5,
      y: vertPos,
      text: this.getDataStr(startPos),
      ind: startPos
    });

    let newInd;
    do {
      let x = tick * i;
      let xPos = x * ratio + startX;
      newInd = startPos + x;

      labels.push({
        x: xPos,
        y: vertPos,
        text: this.getDataStr(newInd),
        ind: newInd
      });
      i++;
    } while (newInd + tick <= max && newInd + tick >= min);

    if (move === 'incLeft' && tick < 0 && labels[0].ind === this.rightEdge()) {
      labels[0].x = this.width - 40;
    }

    this.labelsX = labels;
    this.labelsX.dir = tick;
    return labels;
  }

  prepare(xData, yData) {
    return [
      this.prepareY(yData),
      this.prepareX(xData)
    ];
  }

  draw(xData, yData, colors) {
    if (!this.options.draw) {
      return;
    }

    clrScr(this.ctx);

    let axesLabels = this.prepare(xData, yData);
    let ctx = this.ctx;

    axesLabels.forEach(labels => {
      ctx.beginPath();
      ctx.fillStyle = colors.axesTxt;
      ctx.font = '14px verdana, sans-serif';

      labels.forEach(lbl => {
        if (lbl.move) {
          ctx.moveTo(lbl.move.x, lbl.move.y);
        }
        if (lbl.line) {
          ctx.lineTo(lbl.line.x, lbl.line.y);
        }

        ctx.save();
        ctx.resetTransform();
        ctx.fillText(lbl.text, lbl.x, lbl.y);
        ctx.restore();
      });

      ctx.strokeStyle = colors.axes;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
}

let Plot = function(elem, options) {
  this.elem = elem;
  this.ctx = elem.getContext('2d');
  this.options = options;

  this.axesLabels = new AxesLabels(
    options.axesLabelsElem,
    options.axes, {
    draw: options.drawLabels,
  });

  if (options.tooltip) {
    this.tooltipElem = options.tooltip;
    this.tooltip = new Tooltip(this.tooltipElem, {
      mode: options.mode,
      axes: options.axes
    });
  }
  this.init();
  this.bindEvents();
};

Plot.prototype = {
  init() {
    this.ctx.transform(1, 0, 0, -1, 0, this.height());
  },

  bindEvents() {
    if (this.tooltipElem) {
      this.tooltipElem.addEventListener('mousemove', this.showTooltip.bind(this));
      this.tooltipElem.addEventListener('mouseout', this.hideTooltip.bind(this));
    }
  },

  showTooltip(e) {
    this.tooltip.draw(e.offsetX, e.offsetY, this.posOptions);
  },

  hideTooltip() {
    this.tooltip.hide();
  },

  height: function() {
    return this.ctx.canvas.height;
  },

  width() {
    return this.ctx.canvas.width;
  },

  setMode(mode) {
    this.options.mode = mode;
    this.tooltip.setMode(mode);
  },

  setCheckedAxis(axData) {
    this.axesChecked = axData;
  },

  getRatios() {
    let oldMax = this.options.axes.maxY();
    this.options.axes.clearMaxY();
    this.options.axes.checkAxes(this.axesChecked);
    let newMax = this.options.axes.maxY();

    return {
      _diff: null,
      newMax,
      newVal: this.height() / newMax,
      oldVal: this.height() / oldMax,
      incMaxY: oldMax,
      stepMaxY: (newMax - oldMax) / frames,
      diff: function() {
        if (this._diff === null) {
          this._diff = (this.newVal - this.oldVal) / frames
        }
        return this._diff;
      }
    };
  },

  draw(options = {}) {
    let isLeftBar = (move) => {
      return move === 'incLeft' || move === 'decLeft';
    };

    this.posOptions = options;

    let finish = options.finish || this.options.axes.x.length;
    let start = options.start || 0;

    let move = options.move || 'incLeft';
    let maxY = options.maxY ||
      this.options.axes.maxY(start, start + options.delta);
    let ctx = this.ctx;

    let ratioX = this.width() / options.delta;
    let ratioY = options.ratioY || this.height() / maxY;

    let shiftX = 0, firstX = 0, startInd = start;
    if (isLeftBar(move)) {
      shiftX = ratioX * options.indentFinish || 0;
      firstX = this.width() + (shiftX ? ratioX - shiftX : 0);
      startInd = Math.min(finish + 1, this.options.axes.x.length - 1);
    } else {
      if (start - 1 >= 0) {
        startInd = start - 1;
        shiftX = ratioX * options.indentStart || 0;
        firstX = shiftX - ratioX;
      }
    }

    this.clrScr();

    this.axesLabels.draw(
      {
        min: start,
        max: finish,
        ratio: ratioX,
        move
      },
      { min: 0, max: maxY, ratio: ratioY },
      this.options.mode
    );

    this.options.axes.y.forEach(y => {
      if (y.draw || y.id === this.axesChecked.id) {
        ctx.beginPath();
        ctx.moveTo(firstX, y.dots[startInd] * ratioY);
        if (isLeftBar(move)) {
          let widthWithShift = this.width() + (shiftX ? ratioX - shiftX : 0);
          let prev = firstX;
          let i = startInd - 1;
          do {
            prev = widthWithShift - (startInd - i) * ratioX;
            ctx.lineTo(prev, y.dots[i] * ratioY);
            i--;
          } while (prev > 0);
          this.posOptions.start = i+ (prev ? 2 : 1);
          this.posOptions.indentStart = prev ? (prev + ratioX)/ratioX : 0;
        } else {
          for(let i = start; i <= start + options.delta; i++) {
            ctx.lineTo(shiftX + (i - start) * ratioX, y.dots[i] * ratioY);
          }
        }

        if (this.axesChecked && y.id === this.axesChecked.id) {
          ctx.globalAlpha = options.opacity;
        }

        ctx.strokeStyle = y.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    });
  },

  clrScr() {
    clrScr(this.ctx);
  }
};

class Chart {
  constructor(root, data, options) {
    this.root = root;

    this.options = Object.assign({}, defaultOptions, options);

    this.data = data;
    this.axes = [];
    this.moveElem = null;

    this.state = {
      mode: modes.day,
      maxY: 0,
      axesChecked: false
    };

    this.init();
    let xAxis = this.initTimeAxis();
    this.createElements();
    this.bindEvents();

    this.xRange = xAxis.length;

    this.mainPlot = new Plot(this.mainCanvas, {
      mode: this.state.mode,
      drawLabels: true,
      tooltip: this.tooltipCanvas,
      axes: axes(this.axes, xAxis),
      axesLabelsElem: this.labelsCanvas
    });

    this.rangePlot = new Plot(this.rangeCanvas, {
      axes: axes(this.axes, xAxis)
    });

    this.switchMode();
  }

  createElements() {
    let widthPx = this.options.width + 'px';
    let rangeCanvasHeightPx = Math.ceil(this.options.height / 10) + 'px';
    let rangeHeightPx = Math.ceil(this.options.height / 10 + 10) + 'px';

    let centerWidth = Math.ceil(this.options.width / 100 * this.options.drawPart);
    let leftWidth = this.options.width - centerWidth;

    this.root.style.width = widthPx;

    this.title = createElement(this.root, 'h2');
    this.title.innerText = this.options.title;

    let div = createElement(this.root, 'div', styleClasses.mainChartWrap);

    this.labelsCanvas = createElement(div, 'canvas', styleClasses.axesLabels);
    this.labelsCanvas.setAttribute('width', widthPx);
    this.labelsCanvas.setAttribute('height', (this.options.height / 3 * 2 + 30) + 'px');

    this.mainCanvas = createElement(div,'canvas', styleClasses.mainChart);
    this.mainCanvas.setAttribute('width', widthPx);
    this.mainCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    this.tooltipCanvas = createElement(div, 'canvas', styleClasses.tooltip);
    this.tooltipCanvas.setAttribute('width', widthPx);
    this.tooltipCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    let area = createElement(this.root, 'div', styleClasses.rangeChartArea);

    this.rangeCanvas = createElement(area, 'canvas', styleClasses.rangeChart);
    this.rangeCanvas.setAttribute('width', widthPx);
    this.rangeCanvas.setAttribute('height', rangeCanvasHeightPx);

    this.rSelector = createElement(area, 'div', styleClasses.rangeSelector);
    this.rSelector.style.width = widthPx;
    this.rSelector.style.height = rangeHeightPx;

    this.rsLeft = createElement(this.rSelector, 'div', styleClasses.rsLeft);
    this.rsLeft.style.height = rangeHeightPx;
    this.rsLeft.style.width = leftWidth + 'px';

    this.rsLeftBar = createElement(this.rSelector, 'div', styleClasses.rsLeftBar);
    this.rsLeftBar.style.left = leftWidth + 'px';
    this.rsLeftBar.style.height = rangeHeightPx;

    this.rsCenter = createElement(this.rSelector, 'div', styleClasses.rsCenter);
    this.rsCenter.style.height = rangeHeightPx;
    this.rsCenter.style.left = (leftWidth + this.rsLeftBar.clientWidth) + 'px';
    this.rsCenter.style.width = (centerWidth - this.rsLeftBar.clientWidth * 2) + 'px';

    this.rsRightBar = createElement(this.rSelector, 'div', styleClasses.rsRightBar);
    this.rsRightBar.style.height = rangeHeightPx;
    this.rsRight = createElement(this.rSelector, 'div', styleClasses.rsRight);
    this.rsRight.style.height = rangeHeightPx;

    this.createCheckboxAxes();

    let divSwitcher = createElement(this.root, 'div');
    divSwitcher.style.width = '250px';
    divSwitcher.style.margin = '0 auto';

    this.modeSwitcher = createElement(divSwitcher, 'span', styleClasses.modeSwitcher);
    this.modeSwitcher.innerText = this.state.mode.title;
    this.modeSwitcher.setAttribute('data-mode', 'night');
  }

  createCheckboxAxes() {
    let boxArea = createElement(this.root, 'div', styleClasses.checkAxes);

    this.checkboxAses = this.axes.map((axis) => {
      return {
        axis: axis,
        elem: this.createCheckbox(boxArea, axis)
      };
    });
  }

  createCheckbox(root, axis) {
    let elem = createElement(root, 'div');

    let id = axis.id + '_' +  Math.ceil(Math.random() * 1000);

    let input = createElement(elem, 'input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', id);
    input.setAttribute('checked', true);

    let label = createElement(elem, 'label');
    label.setAttribute('for', id);
    label.innerText = axis.name;

    let checkedLabel = createElement(label, 'span', styleClasses.checkedLabel);
    checkedLabel.style.borderColor = axis.color;
    checkedLabel.style.backgroundColor = axis.color;

    input.addEventListener('click', (e) => {
      checkedLabel.style.backgroundColor = e.target.checked
        ? axis.color
        : this.state.mode.bg;

      axis.draw = !axis.draw;
      this.setCheckedAxis(axis);
      this.drawChecked();
    });
    return checkedLabel;
  }

  setCheckedAxis(axData) {
    this.state.axesChecked = axData;
    this.mainPlot.setCheckedAxis(axData);
    this.rangePlot.setCheckedAxis(axData);
  }

  init() {
    let types = this.data.types;
    let axes = [];

    Object.keys(types).forEach(key => {
      let type = types[key];
      if (type === AXES_TYPE.LINE) {
        axes.push(key);
      } else {
        this.x = key;
      }
    }, this);

    this.axes = axes.map(axis => {
      let dots = this.data.columns.find(col => {
        return col[0] === axis;
      });

       return {
         id: axis,
         name: this.data.names[axis],
         color: this.data.colors[axis],
         dots: dots.slice(1),
         draw: true
       };
    }, this);
  }

  initTimeAxis() {
    let time = this.data.columns.find(col => {
      return col[0] === this.x;
    });

    let normTime = [];
    for (let i = 1; i < time.length; i++) {
      let val = time[i];
      normTime.push({
        raw: val,
        date: new Date(val)
      });
    }
    return normTime;
  }

  bindEvents() {
    this.rsLeftBar.addEventListener('mousedown', this.downLeftBar.bind(this));
    this.rsRightBar.addEventListener('mousedown', this.downRightBar.bind(this));
    this.rsCenter.addEventListener('mousedown', this.downRangeCenter.bind(this));
    this.rSelector.addEventListener('mousemove', this.mouseMove.bind(this));
    document.addEventListener('mouseup', this.mouseUp.bind(this));
    this.modeSwitcher.addEventListener('click', this.onSwitchMode.bind(this));
  }

  onSwitchMode() {
    let dataMode = this.modeSwitcher.getAttribute('data-mode');
    let newMode = modes[dataMode];
    if (newMode) {
      this.modeSwitcher.setAttribute('data-mode', this.state.mode.id);
      this.switchMode(newMode);
      this.mainPlot.draw(this.getRangePosition());
    }
  }

  switchMode(newMode) {
    newMode = newMode || this.state.mode;

    this.modeSwitcher.innerText = newMode.title;
    this.root.style.backgroundColor = newMode.bg;

    let divAxes = this.root.querySelectorAll('.' + styleClasses.checkAxes + ' div');
    divAxes.forEach(el => {
      el.style.borderColor = newMode.border;
      let lbl = el.querySelector('label');
      if (lbl) {
        lbl.style.color = newMode.text;
      }
    });

    this.rsLeftBar.style.backgroundColor = newMode.rBg;
    this.rsRightBar.style.backgroundColor = newMode.rBg;
    this.rsCenter.style.borderColor = newMode.rBg;
    this.rsRight.style.backgroundColor = newMode.rBg;
    this.rsLeft.style.backgroundColor = newMode.rBg;
    this.title.style.color = newMode.text;

    this.checkboxAses.forEach(d => {
      if (!d.axis.draw) {
        d.elem.style.backgroundColor = newMode.bg;
      }
    });

    if (newMode !== this.state.mode) {
      this.state.mode = newMode;
      this.mainPlot.setMode(this.state.mode); // todo: remove
    }
  }

  mouseMove(e) {
    if (!this.moveElem) {
      return;
    }
    this.moveElem.move(e.pageX);
  }

  mouseUp() {
    if (this.moveElem) {
      this.moveElem.restoreCursor();
      this.moveElem = null;
    }
  }

  setMoveElem(options) {
    let defaultOpts = {
      redraw: (typeMove) => {
        return this.redrawChart.bind(this, typeMove)
      },
      root: this.rSelector,
      rightBar: this.rsRightBar,
      leftBar: this.rsLeftBar,
      leftElem: this.rsLeft,
      rightElem: this.rsRight,
      centerElem: this.rsCenter,
      widthBar: this.rsLeftBar.clientWidth,
      widthRoot: this.rSelector.clientWidth,
      left: 0,
      restoreCursor: noop,
      move: noop
    };

    this.moveElem = Object.assign({}, defaultOpts, options);
  }

  downRangeCenter(e) {
    if (e.which !== 1) {
      return;
    }

    this.rsCenter.style.cursor = 'grabbing';

    let centerMove = {
      x: e.pageX,
      left: this.rsCenter.offsetLeft,
      restoreCursor: function() {
        this.centerElem.style.cursor = 'grab';
      },
      move: function(newX) {
        let self = this;
        setTimeout(function() {
          let shift = self.x - newX;
          if (!Math.abs(shift)) {
            return;
          }
          self.x = newX;
          self.left -= shift;

          let widthBar = self.widthBar;
          let widthRoot = self.widthRoot;
          let widthCenter = self.centerElem.clientWidth;

          self.left = self.left < widthBar
            ? widthBar
            : Math.min(self.left, widthRoot - widthCenter - widthBar);

          let leftBarPos = Math.max(self.left - widthBar, 0);
          let rightBarPos = self.left + widthCenter;
          let rightElemPos = rightBarPos + widthBar;

          self.centerElem.style.left = self.left + 'px';

          self.leftElem.style.width = leftBarPos + 'px';
          self.leftBar.style.left = leftBarPos + 'px';

          self.rightBar.style.left = rightBarPos + 'px';
          self.rightElem.style.left = rightElemPos + 'px';
          self.rightElem.style.width =
            (Math.max(widthRoot - rightElemPos, 0)) + 'px';

          window.requestAnimationFrame(self.redraw('move'));
        }, moveTimeout);
      }
    };
    this.setMoveElem(centerMove);
  }

  downRightBar(e) {
    if (e.which !== 1) {
      return;
    }

    let rightMove = {
      x: e.pageX,
      left: this.rsRightBar.offsetLeft,
      move: function(newX) {
        let self = this;
        setTimeout(function() {
          let shift = self.x - newX;
          if (!Math.abs(shift)) {
            return;
          }
          self.x = newX;
          self.left -= shift;

          let widthBar = self.widthBar;
          let widthRoot = self.widthRoot;
          let leftCenter = self.centerElem.offsetLeft;

          self.left = self.left < leftCenter
            ? leftCenter
            : Math.min(self.left, widthRoot - widthBar);

          self.rightBar.style.left = self.left + 'px';
          self.rightElem.style.width = (widthRoot - self.left - widthBar) + 'px';
          self.rightElem.style.left = (self.left + widthBar) + 'px';

          self.centerElem.style.width = (self.left - leftCenter) + 'px';

          let redraw = self.redraw(shift < 0 ? 'decRight' : 'incRight');
          window.requestAnimationFrame(redraw);
        }, moveTimeout);
      }
    };
    this.setMoveElem(rightMove);
  }

  downLeftBar(e) {
    if (e.which !== 1) {
      return;
    }

    let leftMove = {
      x: e.pageX,
      left: this.rsLeftBar.offsetLeft,
      move: function(newX) {
        let self = this;
        setTimeout(function() {
          let shift = self.x - newX;
          if (!Math.abs(shift)) {
            return;
          }
          self.x = newX;
          self.left -= shift;

          let widthBar = self.widthBar;
          let widthRoot = self.widthRoot;

          self.left = self.left < 0
            ? 0
            : self.left = Math.min(self.left, widthRoot - widthBar * 2);

          self.leftBar.style.left = self.left + 'px';
          self.leftElem.style.width = self.left + 'px';

          self.centerElem.style.width = (self.centerElem.clientWidth + shift) + 'px';
          self.centerElem.style.left = (self.left + widthBar) + 'px';

          let redraw = self.redraw(shift < 0 ? 'incLeft' : 'decLeft');
          window.requestAnimationFrame(redraw);
        }, moveTimeout);
      }
    };
    this.setMoveElem(leftMove);
  }

  getRangePosition() {
    let leftPos = this.rsLeftBar.offsetLeft;
    let rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
    let st = leftPos / this.options.width * this.xRange;
    let fin = rightPos / this.options.width * this.xRange;
    return {
      indentStart: Math.ceil(st) - st,
      indentFinish: fin - Math.floor(fin),
      start: Math.ceil(st),
      finish: Math.floor(fin) - 1,
      delta: Math.round(fin - st) - 1
    };
  }

  draw() {
    this.mainPlot.draw(this.getRangePosition());
    this.rangePlot.draw({delta: this.xRange});
  }

  redrawChart(move) {
    this.mainPlot.draw({...this.getRangePosition(), move});
  }

  drawChecked() {
    let mainRatio = this.mainPlot.getRatios(this.state.axesChecked);
    let rangeRatio = this.rangePlot.getRatios(this.state.axesChecked);

    mainRatio.oldVal += mainRatio.diff();
    rangeRatio.oldVal += rangeRatio.diff();

    let checked = this.state.axesChecked;
    let opacity = checked.draw ? 0 : 1;
    let opacityStep = (checked.draw ? 1 : -1) * 2 / 100;

    let options = this.getRangePosition();

    let step = () => {
      this.mainPlot.draw(Object.assign({
        ratioY: mainRatio.oldVal,
        opacity,
        maxY: mainRatio.incMaxY
      }, options));
      this.rangePlot.draw(Object.assign({
        ratioY: rangeRatio.oldVal,
        opacity,
        delta: this.xRange
      }));

      mainRatio.oldVal += mainRatio.diff();
      rangeRatio.oldVal += rangeRatio.diff();
      opacity += opacityStep;
      mainRatio.incMaxY += mainRatio.stepMaxY;

      if (
        mainRatio.diff() > 0 && mainRatio.oldVal < mainRatio.newVal ||
        mainRatio.diff() < 0 && mainRatio.oldVal > mainRatio.newVal ||
        (mainRatio.diff() === 0 && opacity > 0 && opacity < 1) ||
        (mainRatio.stepMaxY > 0 && mainRatio.incMaxY < mainRatio.newMax)
      ) {
        window.requestAnimationFrame(step);
      } else {
        this.state.axesChecked = false;
      }
    };
    window.requestAnimationFrame(step);
  }
}

let loadData = async function(src) {
  let resp = await fetch(src);
  return await resp.json();
};

let drawChart = async function(src) {
  let data = await loadData(src);

  data.forEach((d, ind) => {
    let elem = document.querySelector('#chart' + (ind + 1));
    if (elem) {
      let chart = new Chart(elem, d, {
        drawPart: 30,
        title: 'Followers'
      });
      chart.draw();
    }
  });
};