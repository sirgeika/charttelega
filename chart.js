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

const computeTickSize = function(min, max, noTicks) {
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
};

const getAxisTickSize = function(min, max, range) {
  const noTicks = 0.3 * Math.sqrt(range);
  return computeTickSize(min, max, noTicks);
};

class Chart {
  constructor(root, data, options) {
    this.root = root;

    this.options = Object.assign({}, defaultOptions, options);

    this.data = data;
    this.axes = [];
    this.time = [];
    this.moveElem = null;

    this.state = {
      mode: modes.day,
      maxY: 0,
      axesChecked: false
    };

    this.init();
    this.createElements();
    this.initDraw();
    this.bindEvents();

    this.switchMode();
  }

  static createElement(root, tag, className) {
    const el = document.createElement(tag);
    if (className) {
      el.setAttribute('class', className);
    }
    return root.appendChild(el);
  }

  createElements() {
    const widthPx = this.options.width + 'px';
    const rangeCanvasHeightPx = Math.ceil(this.options.height / 10) + 'px';
    const rangeHeightPx = Math.ceil(this.options.height / 10 + 10) + 'px';

    const centerWidth = Math.ceil(this.options.width / 100 * this.options.drawPart);
    const leftWidth = this.options.width - centerWidth;

    this.root.style.width = widthPx;

    const div = Chart.createElement(this.root, 'div', styleClasses.mainChartWrap);

    this.mainCanvas = Chart.createElement(div,'canvas', styleClasses.mainChart);
    this.mainCanvas.setAttribute('width', widthPx);
    this.mainCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    this.tooltipCanvas = Chart.createElement(div, 'canvas', styleClasses.tooltip);
    this.tooltipCanvas.setAttribute('width', widthPx);
    this.tooltipCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    const area = Chart.createElement(this.root, 'div', styleClasses.rangeChartArea);

    this.rangeCanvas = Chart.createElement(area, 'canvas', styleClasses.rangeChart);
    this.rangeCanvas.setAttribute('width', widthPx);
    this.rangeCanvas.setAttribute('height', rangeCanvasHeightPx);

    this.rSelector = Chart.createElement(area, 'div', styleClasses.rangeSelector);
    this.rSelector.style.width = widthPx;
    this.rSelector.style.height = rangeHeightPx;

    this.rsLeft = Chart.createElement(this.rSelector, 'div', styleClasses.rsLeft);
    this.rsLeft.style.height = rangeHeightPx;
    this.rsLeft.style.width = leftWidth + 'px';

    this.rsLeftBar = Chart.createElement(this.rSelector, 'div', styleClasses.rsLeftBar);
    this.rsLeftBar.style.height = rangeHeightPx;
    this.rsLeftBar.style.left = leftWidth + 'px';

    this.rsCenter = Chart.createElement(this.rSelector, 'div', styleClasses.rsCenter);
    this.rsCenter.style.height = rangeHeightPx;
    this.rsCenter.style.width = (centerWidth - this.rsLeftBar.clientWidth * 2) + 'px';
    this.rsCenter.style.left = (leftWidth + this.rsLeftBar.clientWidth) + 'px';

    this.rsRightBar = Chart.createElement(this.rSelector, 'div', styleClasses.rsRightBar);
    this.rsRightBar.style.height = rangeHeightPx;
    this.rsRight = Chart.createElement(this.rSelector, 'div', styleClasses.rsRight);
    this.rsRight.style.height = rangeHeightPx;

    this.createCheckboxAxes();

    const divSwitcher = Chart.createElement(this.root, 'div');
    divSwitcher.style.width = '250px';
    divSwitcher.style.margin = '0 auto';

    this.modeSwitcher = Chart.createElement(divSwitcher, 'span', styleClasses.modeSwitcher);
    this.modeSwitcher.innerText = this.state.mode.title;
    this.modeSwitcher.setAttribute('data-mode', 'night');
  }

  createCheckboxAxes() {
    const boxArea = Chart.createElement(this.root, 'div', styleClasses.checkAxes);

    this.checkboxAses = this.axes.map((axis) => {
      return {
        axis: axis,
        elem: this.createCheckbox(boxArea, axis)
      };
    });
  }

  createCheckbox(root, axis) {
    const elem = Chart.createElement(root, 'div');

    const id = axis.id + '_' +  Math.ceil(Math.random() * 1000);

    const input = Chart.createElement(elem, 'input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', id);
    input.setAttribute('checked', true);

    const label = Chart.createElement(elem, 'label');
    label.setAttribute('for', id);
    label.innerText = axis.name;

    const checkedLabel = Chart.createElement(label, 'span', styleClasses.checkedLabel);
    checkedLabel.style.borderColor = axis.color;
    checkedLabel.style.backgroundColor = axis.color;

    input.addEventListener('click', (e) => {
      checkedLabel.style.backgroundColor = e.target.checked
        ? axis.color
        : this.state.mode.bg;

      this.axes.some((a) => {
        const found = a.id === axis.id;
        if (found) {
          a.draw = !a.draw;
          this.state.axesChecked = a.id;
        }
        return found;
      });
      this.drawSmooth();
    });
    return checkedLabel;
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

    this.initTimeAxis();
  }

  initDraw() {
    this.mainCtx = this.mainCanvas.getContext('2d');
    this.rangeCtx = this.rangeCanvas.getContext('2d');
    this.tooltipCtx = this.tooltipCanvas.getContext('2d');

    this.mainCtx.transform(1, 0, 0, -1, 0, this.mainCtx.canvas.height);
    this.rangeCtx.transform(1, 0, 0, -1, 0, this.rangeCtx.canvas.height);
  }

  initTimeAxis() {
    const time = this.data.columns.find(col => {
      return col[0] === this.x;
    });

    for (let i = 1; i < time.length; i++) {
      const val = time[i];
      this.time.push({
        raw: val,
        date: new Date(val)
      });
    }
  }

  bindEvents() {
    this.tooltipCanvas.addEventListener('mousemove', this.showTooltip.bind(this));
    this.tooltipCanvas.addEventListener('mouseout', this.hideTooltip.bind(this));
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
      this.drawChart(this.mainCtx, true, this.start, this.finish);
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

    this.checkboxAses.forEach(d => {
      if (!d.axis.draw) {
        d.elem.style.backgroundColor = newMode.bg;
      }
    });

    if (newMode !== this.state.mode) {
      this.state.mode = newMode;
    }
  }

  showTooltip(e) {
    Chart.clrScr(this.tooltipCtx);
    this.drawTooltip(this.tooltipCtx, e.offsetX, e.offsetY);
  }

  hideTooltip() {
    Chart.clrScr(this.tooltipCtx)
  }

  static clrScr(ctx) {
    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);
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

  maxY(start = 0, finish) {
    let max = Number.NEGATIVE_INFINITY;

    finish = finish || this.time.length;

    this.axes.forEach(axis => {
      if (axis.draw) {
        for(let i = start; i < finish; i++) {
          if (axis.dots[i] > max) {
            max = axis.dots[i];
          }
        }
      }
    });
    return max;
  }

  getAxis(id) {
    return this.axes.find(axis => {
      return axis.id === id;
    });
  }

  calcRangePosition() {
    const leftPos = this.rsLeftBar.offsetLeft;
    const rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
    this.start = Math.floor(leftPos / this.options.width * this.time.length);
    this.finish = Math.ceil(rightPos / this.options.width * this.time.length);
  }

  drawTooltip(ctx, x, y) {
    const overlay = function(x1, y1, w, h) {
      return this.x >= x1 && this.x <= (x1 + w) &&
        this.y >= y1 && this.y <= (y1 + h);
    };

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
    const parts = this.finish - this.start - 1;
    const ind  = Math.round(parts * rel);

    const ratioX = width / parts;
    const ratioY = height / this.maxY(this.start, this.finish);
    const xPoint = ind * ratioX;

    ctx.beginPath();
    ctx.moveTo(xPoint, 0);
    ctx.lineTo(xPoint, height);
    ctx.strokeStyle = this.state.mode.axes;
    ctx.stroke();

    this.axes.forEach((axis) => {
      if (axis.draw) {
        const yPoint = height - axis.dots[this.start + ind] * ratioY;

        ctx.beginPath();
        ctx.arc(xPoint, yPoint,5, 0, endAngel);
        ctx.strokeStyle = axis.color;
        ctx.fillStyle = this.state.mode.bg;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.font = fontValue;
        const txtValue = ctx.measureText(axis.dots[this.start + ind]);

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

    const dateStr = this.time[this.start + ind].date.toLocaleString('en', {
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

    this.axes.some((axis) => {
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
    ctx.fillStyle = this.state.mode.bg;
    ctx.strokeStyle = this.state.mode.tooltipShadow;

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
    ctx.strokeStyle = this.state.mode.bg;
    ctx.strokeRect(
      rectX + 1,
      rectY + (cornerRadius / 2) + 1,
      rectWidth - cornerRadius - 3,
      rectHeight - cornerRadius - 3
    );

    ctx.beginPath();
    ctx.fillStyle = this.state.mode.tooltipTxt;
    ctx.font = fontDate;
    ctx.fillText(dateStr, rectX + 10, rectY + 25);

    let prevText = 0;

    this.axes.forEach((axis, index) => {
      if (axis.draw) {
        ctx.beginPath();
        ctx.fillStyle = axis.color;
        ctx.font = fontValue;
        ctx.fillText(axis.dots[this.start + ind], rectX + txtPadding + prevText, rectY +60);

        ctx.beginPath();
        ctx.font = fontName;
        ctx.fillText(axis.name, rectX + txtPadding + prevText, rectY + 80);

        prevText += txtPadding + textWidth[axis.id].width;
      }
    });

    ctx.restore();
  }

  draw() {
    this.calcRangePosition();
    this.mainMaxY = this.drawChart(this.mainCtx, true, this.start, this.finish);
    this.rangeMaxY = this.drawChart(this.rangeCtx);
  }

  redrawChart() {
    this.calcRangePosition();
    this.drawChart(this.mainCtx, true, this.start, this.finish);
  }

  drawChart(ctx, displayLabels, start=0, finish) {
    finish = finish || this.time.length;

    const maxY = this.maxY(start, finish);

    const ratioX = ctx.canvas.width / (finish - start - 1);
    const ratioY = ctx.canvas.height / maxY;

    Chart.clrScr(ctx);

    if (displayLabels) {
      this.drawAxesLabels(ctx, maxY, ratioX, ratioY);
    }

    this.axes.forEach(y => {
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

    return maxY;
  }

  drawSmooth() {

    const frames = 50;
    const newMainMax = this.maxY(this.start, this.finish);
    const newRangeMax = this.maxY();

    const ratio = {
      newMain: this.mainCtx.canvas.height / newMainMax,
      oldMain: this.mainCtx.canvas.height / this.mainMaxY,
      incMaxY: this.mainMaxY,
      stepMaxY: (newMainMax - this.mainMaxY) / frames,
      newRange: this.rangeCtx.canvas.height / newRangeMax,
      oldRange: this.rangeCtx.canvas.height / this.rangeMaxY
    };

    const mainDiff = (ratio.newMain - ratio.oldMain) / frames;
    ratio.oldMain += mainDiff;

    const rangeDiff = (ratio.newRange - ratio.oldRange) / frames;
    ratio.oldRange += rangeDiff;

    const checked = this.getAxis(this.state.axesChecked);
    let opacity = checked.draw ? 0 : 1;
    let opacityStep = (checked.draw ? 1 : -1) * 2 / 100;

    const step = () => {
      this.drawChartSmooth(this.mainCtx, ratio.oldMain, opacity,
        ratio.incMaxY, this.start, this.finish);
      this.drawChartSmooth(this.rangeCtx, ratio.oldRange, opacity);

      ratio.oldMain += mainDiff;
      ratio.oldRange += rangeDiff;
      opacity += opacityStep;
      ratio.incMaxY += ratio.stepMaxY;

      if (
        mainDiff > 0 && ratio.oldMain < ratio.newMain ||
        mainDiff < 0 && ratio.oldMain > ratio.newMain ||
        (mainDiff === 0 && opacity > 0 && opacity < 1)
      ) {
        window.requestAnimationFrame(step);
      } else {
        this.state.axesChecked = false;
        this.mainMaxY = newMainMax;
        this.rangeMaxY = newRangeMax;
        this.draw();
      }
    };
    window.requestAnimationFrame(step);
  }

  drawChartSmooth(ctx, ratioY, opacity, maxY, start=0, finish) {
    finish = finish || this.time.length;

    const ratioX = ctx.canvas.width / (finish - start - 1);

    Chart.clrScr(ctx);

    if (maxY) {
      this.drawAxesLabels(ctx, maxY, ratioX, ratioY);
    }

    this.axes.forEach(y => {
      if (y.draw || y.id === this.state.axesChecked) {
        ctx.beginPath();
        ctx.moveTo(0, y.dots[start] * ratioY);

        for(let i = start; i < finish; i++) {
          ctx.lineTo((i - start) * ratioX, y.dots[i] * ratioY);
        }

        if (y.id === this.state.axesChecked) {
          ctx.globalAlpha = opacity;
        }

        ctx.strokeStyle = y.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.globalAlpha = 1;
      }
    });
  }

  drawAxesLabels(ctx, maxY, ratioX, ratioY) {
    const height = ctx.canvas.height;

    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(ctx.canvas.width, 1);

    ctx.fillStyle = this.state.mode.axesTxt;
    ctx.font = '14px verdana, sans-serif';
    ctx.fillText('0', 5, 20);

    let prev, i = 1;
    const tick = getAxisTickSize(0, maxY, height);

    do {
      const y = tick * i;
      ctx.moveTo(0, y * ratioY);
      ctx.lineTo(ctx.canvas.width, y * ratioY );

      const yTxt = height - (y * ratioY) - 10;
      if (yTxt - 15 > 0) {
        ctx.save();
        ctx.resetTransform();
        ctx.fillText(y, 5, yTxt);
        ctx.restore();
      }

      prev = y;
      i++;
    } while (prev <= maxY);
    
    ctx.strokeStyle = this.state.mode.axes;
    ctx.lineWidth = 2;
    ctx.stroke();
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
        drawPart: 25
      });
      chart.draw();
    }
  });
};