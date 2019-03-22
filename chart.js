'use strict';

const AXES_TYPE = {
  LINE: 'line',
  X: 'x'
};

const defaultOptions = {
  height: 600,
  width: 600,
  drawPart: 20
};

const modes = {
  night: {
    id: 'night',
    bg: '#2a3240',
    border: '#394758',
    text: '#fff',
    range: '#44566b',
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
    range: '#ecf0f1',
    axes: '#ecf0f1',
    axesTxt: '#70797f',
    tooltipTxt: '#595959',
    tooltipShadow: '#dadada',
    title: 'Switch to Night Mode'
  }
};

const moveTimeout = 50;
const frames = 50;
const MIN_INF = Number.NEGATIVE_INFINITY;

const noop = function() {};

const rangeSelector = 'range-selector';

const styleClasses = {
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
  modeSwitcher: 'mode-switcher'
};

let createElement = function (root, tag, className) {
  const el = document.createElement(tag);
  if (className) {
    el.setAttribute('class', className);
  }
  return root.appendChild(el);
};

let clrScr = function(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
    return this.finish === -1 ? this.dots.length : this.finish;
  },
  maxY: function(start, finish) {
    start = start || this.getStart();
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
    for(let i = start; i < finish; i++) {
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
  const y = axes.map(axis => new Axis(axis));

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
    getRangePositionY: function() {
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

let Tooltip = function(elem, options) {
  this.ctx = elem.getContext('2d');
  this.options = {...options};
};

Tooltip.prototype = {
  draw: function(x, y, rangePos) {
    const overlay = function(x1, y1, w, h) {
      return this.x >= x1 && this.x <= (x1 + w) &&
        this.y >= y1 && this.y <= (y1 + h);
    };

    this.hide();

    let ctx = this.ctx;
    let { start, finish } = rangePos;

    const height = ctx.canvas.height;
    const width = ctx.canvas.width;

    const fontValue = 'bold 18px verdana, sans-serif';
    const fontName = '14px verdana, sans-serif';
    const txtPadding = 10;
    const fontDate = 'bold 16px verdana, sans-serif';

    let textWidth = {
      val: 0,
      name: 0
    };

    const endAngel = (Math.PI/180) * 360;
    const rel = x / width;
    const parts = finish - start - 1;
    const ind  = Math.round(parts * rel);

    const ratioX = width / parts;
    const ratioY = height / this.options.axes.maxY(start, finish);
    const xPoint = ind * ratioX;

    ctx.beginPath();
    ctx.moveTo(xPoint, 0);
    ctx.lineTo(xPoint, height);
    ctx.strokeStyle = this.options.mode.axes;
    ctx.stroke();

    this.options.axes.y.forEach((axis) => {
      if (axis.draw) {
        const yPoint = height - axis.dots[start + ind] * ratioY;

        ctx.beginPath();
        ctx.arc(xPoint, yPoint,5, 0, endAngel);
        ctx.strokeStyle = axis.color;
        ctx.fillStyle = this.options.mode.bg;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = fontValue;
        const txtValue = ctx.measureText(axis.dots[start + ind]);

        ctx.font = fontName;
        const txtName = ctx.measureText(axis.name);

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

    const dateStr = this.options.axes.x[start + ind].date.toLocaleString('en', {
      weekday: 'short',
      month: 'short',
      day: '2-digit'
    });

    ctx.font = fontDate;
    const textDate = ctx.measureText(dateStr);

    const rectWidth = Math.max(textDate.width, textWidth.name, textWidth.val) + 40;
    const rectHeight = 100;
    const cornerRadius = 20;
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
  },
  hide: function() {
    clrScr(this.ctx);
  },
  setMode: function(mode) {
    this.options.mode = mode;
  },
};

class AxesLabels {
  constructor(data, options) {
    this.data = data;
    this.options = { ...options };
  }

  static computeTickSize(min, max, noTicks) {
    const delta = (max - min) / noTicks,
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
  }

  static getAxisTickSize(min, max, range, ticks) {
    let noTicks = ticks ? ticks : 0.3 * Math.sqrt(range);
    return this.computeTickSize(min, max, noTicks);
  }

  prepareY({min, max, ratio}) {
    let prev, i = 1;
    let height = this.options.height;
    let width = this.options.width;
    let tick = AxesLabels.getAxisTickSize(min, max, height);
    const aboveLine = 10;

    let labels = [];
    labels.push({
      x: 5,
      y: height - aboveLine,
      text: min,
      move: { x: 0, y: 1 },
      line: { x: width, y: 1 }
    });

    do {
      let y = tick * i;
      let yPos = height - (y * ratio) - aboveLine;

      if (yPos - 15 > 0) {
        labels.push({
          x: 5,
          y: yPos,
          text: y,
          move: { x: 0, y: y * ratio },
          line: { x: width, y: y * ratio }
        });
      }
      prev = y;
      i++;
    } while (prev <= max);

    return labels;
  }

  getDataStr(ind) {
    if (ind < this.data.x.length) {
      return this.data.x[ind].date.toLocaleString('en', {
        month: 'short',
        day: '2-digit'
      });
    }
    return '';
  }

  prepareX({min, max, ratio}) {
    let prev = min, i = 1;
    let height = this.options.height;
    let width = this.options.width;
    let tick = AxesLabels.getAxisTickSize(min, max, width, 6);

    const vertPos = height - 10;

    let labels = [];
    labels.push({
      x: 5,
      y: vertPos,
      text: this.getDataStr(min),
      move: { x: 0, y: 1 },
    });

    do {
      let x = tick * i;
      let xPos = x * ratio;

      labels.push({
        x: xPos,
        y: vertPos,
        text: this.getDataStr(min + x),
        move: { x: xPos, y:  vertPos}
      });
      prev = min + x;
      i++;
    } while (prev + tick <= max);

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

    let axesLabels = this.prepare(xData, yData);
    let ctx = this.options.ctx;

    axesLabels.forEach(labels => {
      ctx.beginPath();
      ctx.fillStyle = colors.axesTxt;
      ctx.font = '14px verdana, sans-serif';

      labels.forEach(lbl => {
        ctx.moveTo(lbl.move.x, lbl.move.y);
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

  this.axesLabels = new AxesLabels(options.axes, {
    ctx: this.ctx,
    draw: options.drawLabels,
    width: this.width(),
    height: this.height()
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
    this.tooltip.draw(e.offsetX, e.offsetY, this.options.axes.getRangePositionY());
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

  draw({ start=0, finish } = {}) {
    finish = finish || this.options.axes.x.length;

    const maxY = this.options.axes.maxY(start, finish);
    const ctx = this.ctx;

    const ratioX = this.width() / (finish - start - 1);
    const ratioY = this.height() / maxY;

    this.clrScr();

    this.axesLabels.draw(
      { min: start, max: finish, ratio: ratioX },
      { min: 0, max: maxY, ratio: ratioY },
      this.options.mode
    );

    this.options.axes.y.forEach(y => {
      if (y.draw) {
        ctx.beginPath();
        ctx.moveTo(0, y.dots[start] * ratioY);

        for(let i = start; i < finish; i++) {
          ctx.lineTo((i - start) * ratioX, y.dots[i] * ratioY);
        }

        ctx.strokeStyle = y.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });
  },

  drawChecked(ratioY, opacity, maxY, start=0, finish) {
    finish = finish || this.options.axes.x.length;
    const ctx = this.ctx;
    const ratioX = this.width() / (finish - start - 1);

    this.clrScr();

    if (maxY) {
      this.axesLabels.draw(
        { min: start, max: finish, ratio: ratioX },
        { min: 0, max: maxY, ratio: ratioY },
        this.options.mode
      );
    }

    this.options.axes.y.forEach(y => {
      if (y.draw || y.id === this.axesChecked.id) {
        ctx.beginPath();
        ctx.moveTo(0, y.dots[start] * ratioY);

        for(let i = start; i < finish; i++) {
          ctx.lineTo((i - start) * ratioX, y.dots[i] * ratioY);
        }

        if (y.id === this.axesChecked.id) {
          ctx.globalAlpha = opacity;
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
      axes: axes(this.axes, xAxis)
    });

    this.rangePlot = new Plot(this.rangeCanvas, {
      axes: axes(this.axes, xAxis)
    });

    this.switchMode();
  }

  createElements() {
    const widthPx = this.options.width + 'px';
    const rangeCanvasHeightPx = Math.ceil(this.options.height / 10) + 'px';
    const rangeHeightPx = Math.ceil(this.options.height / 10 + 10) + 'px';

    const centerWidth = Math.ceil(this.options.width / 100 * this.options.drawPart);
    const leftWidth = this.options.width - centerWidth;

    this.root.style.width = widthPx;

    this.title = createElement(this.root, 'h2');
    this.title.innerText = this.options.title;

    const div = createElement(this.root, 'div', styleClasses.mainChartWrap);

    this.mainCanvas = createElement(div,'canvas', styleClasses.mainChart);
    this.mainCanvas.setAttribute('width', widthPx);
    this.mainCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    this.tooltipCanvas = createElement(div, 'canvas', styleClasses.tooltip);
    this.tooltipCanvas.setAttribute('width', widthPx);
    this.tooltipCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    const area = createElement(this.root, 'div', styleClasses.rangeChartArea);

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

    const divSwitcher = createElement(this.root, 'div');
    divSwitcher.style.width = '250px';
    divSwitcher.style.margin = '0 auto';

    this.modeSwitcher = createElement(divSwitcher, 'span', styleClasses.modeSwitcher);
    this.modeSwitcher.innerText = this.state.mode.title;
    this.modeSwitcher.setAttribute('data-mode', 'night');
  }

  createCheckboxAxes() {
    const boxArea = createElement(this.root, 'div', styleClasses.checkAxes);

    this.checkboxAses = this.axes.map((axis) => {
      return {
        axis: axis,
        elem: this.createCheckbox(boxArea, axis)
      };
    });
  }

  createCheckbox(root, axis) {
    const elem = createElement(root, 'div');

    const id = axis.id + '_' +  Math.ceil(Math.random() * 1000);

    const input = createElement(elem, 'input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', id);
    input.setAttribute('checked', true);

    const label = createElement(elem, 'label');
    label.setAttribute('for', id);
    label.innerText = axis.name;

    const checkedLabel = createElement(label, 'span', styleClasses.checkedLabel);
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
    const types = this.data.types;
    const axes = [];

    Object.keys(types).forEach(key => {
      const type = types[key];
      if (type === AXES_TYPE.LINE) {
        axes.push(key);
      } else {
        this.x = key;
      }
    }, this);

    this.axes = axes.map(axis => {
      const dots = this.data.columns.find(col => {
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
      const val = time[i];
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
    const dataMode = this.modeSwitcher.getAttribute('data-mode');
    const newMode = modes[dataMode];
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

    const divAxes = this.root.querySelectorAll('.' + styleClasses.checkAxes + ' div');
    divAxes.forEach(el => {
      el.style.borderColor = newMode.border;
      const lbl = el.querySelector('label');
      if (lbl) {
        lbl.style.color = newMode.text;
      }
    });

    this.rsLeftBar.style.backgroundColor = newMode.range;
    this.rsRightBar.style.backgroundColor = newMode.range;
    this.rsCenter.style.borderColor = newMode.range;
    this.rsRight.style.backgroundColor = newMode.range;
    this.rsLeft.style.backgroundColor = newMode.range;
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
    var defaultOpts = {
      redraw: this.redrawChart.bind(this),
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

    const centerMove = {
      x: e.pageX,
      left: this.rsCenter.offsetLeft,
      restoreCursor: function() {
        this.centerElem.style.cursor = 'grab';
      },
      move: function(newX) {
        const self = this;
        setTimeout(function() {
          const shift = self.x - newX;
          self.x = newX;
          self.left -= shift;

          const widthBar = self.widthBar;
          const widthRoot = self.widthRoot;
          const widthCenter = self.centerElem.clientWidth;

          self.left = self.left < widthBar
            ? widthBar
            : Math.min(self.left, widthRoot - widthCenter - widthBar);

          const leftBarPos = Math.max(self.left - widthBar, 0);
          const rightBarPos = self.left + widthCenter;
          const rightElemPos = rightBarPos + widthBar;

          self.centerElem.style.left = self.left + 'px';

          self.leftElem.style.width = leftBarPos + 'px';
          self.leftBar.style.left = leftBarPos + 'px';

          self.rightBar.style.left = rightBarPos + 'px';
          self.rightElem.style.left = rightElemPos + 'px';
          self.rightElem.style.width =
            (Math.max(widthRoot - rightElemPos, 0)) + 'px';

          window.requestAnimationFrame(self.redraw);
        }, moveTimeout);
      }
    };
    this.setMoveElem(centerMove);
  }

  downRightBar(e) {
    if (e.which !== 1) {
      return;
    }

    const rightMove = {
      x: e.pageX,
      left: this.rsRightBar.offsetLeft,
      move: function(newX) {
        const self = this;
        setTimeout(function() {
          const shift = self.x - newX;
          self.x = newX;
          self.left -= shift;

          const widthBar = self.widthBar;
          const widthRoot = self.widthRoot;
          const leftCenter = self.centerElem.offsetLeft;

          self.left = self.left < leftCenter
            ? leftCenter
            : Math.min(self.left, widthRoot - widthBar);

          self.rightBar.style.left = self.left + 'px';
          self.rightElem.style.width = (widthRoot - self.left - widthBar) + 'px';
          self.rightElem.style.left = (self.left + widthBar) + 'px';

          self.centerElem.style.width = (self.left - leftCenter) + 'px';

          window.requestAnimationFrame(self.redraw);
        }, moveTimeout);
      }
    };
    this.setMoveElem(rightMove);
  }

  downLeftBar(e) {
    if (e.which !== 1) {
      return;
    }

    const leftMove = {
      x: e.pageX,
      left: this.rsLeftBar.offsetLeft,
      move: function(newX) {
        const self = this;
        setTimeout(function() {
          const shift = self.x - newX;
          self.x = newX;
          self.left -= shift;

          const widthBar = self.widthBar;
          const widthRoot = self.widthRoot;

          self.left = self.left < 0
            ? 0
            : self.left = Math.min(self.left, widthRoot - widthBar * 2);

          self.leftBar.style.left = self.left + 'px';
          self.leftElem.style.width = self.left + 'px';

          self.centerElem.style.width = (self.centerElem.clientWidth + shift) + 'px';
          self.centerElem.style.left = (self.left + widthBar) + 'px';

          window.requestAnimationFrame(self.redraw);
        }, moveTimeout);
      }
    };
    this.setMoveElem(leftMove);
  }

  getRangePosition() {
    const leftPos = this.rsLeftBar.offsetLeft;
    const rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
    return {
      start: Math.floor(leftPos / this.options.width * this.xRange),
      finish: Math.ceil(rightPos / this.options.width * this.xRange)
    };
  }

  draw() {
    this.mainPlot.draw(this.getRangePosition());
    this.rangePlot.draw();
  }

  redrawChart() {
    this.mainPlot.draw(this.getRangePosition());
  }

  drawChecked() {
    let mainRatio = this.mainPlot.getRatios(this.state.axesChecked);
    let rangeRatio = this.rangePlot.getRatios(this.state.axesChecked);

    mainRatio.oldVal += mainRatio.diff();
    rangeRatio.oldVal += rangeRatio.diff();

    const checked = this.state.axesChecked;
    let opacity = checked.draw ? 0 : 1;
    let opacityStep = (checked.draw ? 1 : -1) * 2 / 100;

    let {start, finish} = this.getRangePosition();

    const step = () => {
      this.mainPlot.drawChecked(mainRatio.oldVal, opacity,
        mainRatio.incMaxY, start, finish);
      this.rangePlot.drawChecked(rangeRatio.oldVal, opacity);

      mainRatio.oldVal += mainRatio.diff();
      rangeRatio.oldVal += rangeRatio.diff();
      opacity += opacityStep;
      mainRatio.incMaxY += mainRatio.stepMaxY;

      if (
        mainRatio.diff() > 0 && mainRatio.oldVal < mainRatio.newVal ||
        mainRatio.diff() < 0 && mainRatio.oldVal > mainRatio.newVal ||
        (mainRatio.diff() === 0 && opacity > 0 && opacity < 1)
      ) {
        window.requestAnimationFrame(step);
      } else {
        this.state.axesChecked = false;
        this.draw();
      }
    };
    window.requestAnimationFrame(step);
  }
}

const loadData = async function(src) {
  const resp = await fetch(src);
  return await resp.json();
};

const drawChart = async function(src) {
  const data = await loadData(src);

  data.forEach((d, ind) => {
    const elem = document.querySelector('#chart' + (ind + 1));
    if (elem) {
      const chart = new Chart(elem, d, {
        drawPart: 25,
        title: 'Followers'
      });
      chart.draw();
    }
  });
};