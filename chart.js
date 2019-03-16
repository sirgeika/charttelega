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

const colors = {
  white: '#fff',
  axes: '#ECF0F1',
  text: '#70797f'
};

//#2a3240

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
  checkedLabel: 'checked-label'
};

class Chart {
  constructor(root, data, options) {
    this.root = root;

    this.options = Object.assign({}, defaultOptions, options);

    this.data = data;
    this.axes = [];
    this.time = [];
    this.moveElem = null;

    this.init();
    this.createElements();
    this.initDraw();
    this.bindEvents();
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
    this.root.style.height = this.options.height + 'px';

    const div = Chart.createElement(this.root, 'div', styleClasses.mainChartWrap);

    // main chart
    this.mainCanvas = Chart.createElement(div,'canvas', styleClasses.mainChart);
    this.mainCanvas.setAttribute('width', widthPx);
    this.mainCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    this.tooltipCanvas = Chart.createElement(div, 'canvas', styleClasses.tooltip);
    this.tooltipCanvas.setAttribute('width', widthPx);
    this.tooltipCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    const area = Chart.createElement(this.root, 'div', styleClasses.rangeChartArea);

    // range chart
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
  }

  createCheckboxAxes() {
    const boxArea = Chart.createElement(this.root, 'div', styleClasses.checkAxes);

    this.axes.forEach((axis) => {
      this.createCheckbox(boxArea, axis);
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
        : colors.white;

      this.axes.some((a) => {
        const found = a.id === axis.id;
        if (found) {
          a.draw = !a.draw;
        }
        return found;
      });
      this.drawChart(this.rangeCtx);
      this.redrawChart();
    });
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
        date: new Date(val),
        val: i
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
  }

  showTooltip(e) {
    const ctx = this.tooltipCtx;
    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);
    this.drawTooltip(ctx, e.offsetX, e.offsetY);
  }

  hideTooltip() {
    const ctx = this.tooltipCtx;
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

  calcRangePosition() {
    const leftPos = this.rsLeftBar.offsetLeft;
    const rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
    this.start = Math.floor(leftPos / this.options.width * this.time.length);
    // if (this.start > 0) {
    //   this.start--;
    // }
    this.finish = Math.ceil(rightPos / this.options.width * this.time.length);
  }

  drawTooltip(ctx, x, y) {
    const height = ctx.canvas.height;
    const width = ctx.canvas.width;

    // line, circles
    const endAngel = (Math.PI/180) * 360;
    const rel = x / width;
    const ind  = Math.round((this.finish - this.start - 1) * rel);

    const ratioX = width / (this.finish - this.start - 1);
    const ratioY = height / this.maxY(this.start, this.finish);

    ctx.beginPath();
    ctx.moveTo(ind * ratioX, 0);
    ctx.lineTo(ind * ratioX, height);
    ctx.strokeStyle = colors.axes;
    ctx.stroke();

    this.axes.forEach((axis) => {
      if (axis.draw) {
        ctx.beginPath();
        ctx.arc(ind * ratioX, height - axis.dots[this.start + ind] * ratioY,
          5, 0, endAngel);
        ctx.strokeStyle = axis.color;
        ctx.fillStyle = colors.white;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }
    });

    // tooltip
    const rectWidth = 100;
    const rectHeight = 100;
    const cornerRadius = 20;
    const rectX = 0;
    const rectY = 0;

    // ctx.beginPath();
    // ctx.lineJoin = "round";
    // // ctx.lineWidth = 20;
    // ctx.fillStyle = colors.white;
    // ctx.strokeStyle = colors.white;
    //
    // ctx.strokeRect(
    //   rectX+(cornerRadius/2),
    //   rectY+(cornerRadius/2),
    //   rectWidth-cornerRadius,
    //   rectHeight-cornerRadius
    // );
    //
    // ctx.fillRect(
    //   rectX+(cornerRadius/2),
    //   rectY+(cornerRadius/2),
    //   rectWidth-cornerRadius,
    //   rectHeight-cornerRadius
    // );
  }

  draw() {
    this.calcRangePosition();
    this.drawChart(this.mainCtx, true, this.start, this.finish);
    this.drawChart(this.rangeCtx);
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

    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);

    if (displayLabels) {
      this.drawAxesLabels(ctx, maxY, ratioX, ratioY);
    }

    this.axes.forEach(y => {
      if (y.draw) {
        ctx.beginPath();

        ctx.moveTo(0, y.dots[start] * ratioY);

        for(let i = start; i < finish; i++) {
          ctx.lineTo((i - start) * ratioX, y.dots[i] * ratioY);
          // ctx.lineTo((this.time[i].val - start) * ratioX, y.dots[i] * ratioY);
        }

        ctx.strokeStyle = y.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });
  }

  drawAxesLabels(ctx, maxY, ratioX, ratioY) {
    const partCount = 5;
    const height = ctx.canvas.height;

    // dates
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(ctx.canvas.width, 1);

    ctx.fillStyle = colors.text;
    ctx.font = '14px verdana, sans-serif';
    ctx.fillText('0', 5, 20);

    //y
    let part = Math.round(maxY / partCount);
    const exp = part.toString(10).length - 1;
    const rank = Math.pow(10, exp);

    let roundPart = Math.round(part / rank) * rank;

    if (maxY - roundPart * partCount <= roundPart) {
      part = roundPart;
    }

    for (let i = 1; i <= partCount; i++) {
      const y = part * i;
      ctx.moveTo(0, y * ratioY);
      ctx.lineTo(ctx.canvas.width, y * ratioY );

      ctx.save();
      ctx.resetTransform();
      ctx.fillText(y, 5, height - (y * ratioY) - 10);
      ctx.restore();
    }

    ctx.strokeStyle = colors.axes;
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
  const chart = new Chart(document.querySelector('#chart1'),
    data[0], {
    drawPart: 31
  });
  chart.draw();

  // const chart2 = new Chart(document.querySelector('#chart2'),
  //   data[4], {
  //     drawPart: 31
  //   });
  // chart2.draw();
};