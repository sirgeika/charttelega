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

const moveTimeout = 50;

const noop = function() {};

const rangeSelector = 'range-selector';

const styleClasses = {
  mainChart: 'main-chart',
  rangeChart: 'range-chart',
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
    this.axies = [];
    this.time = [];
    this.moveElem = null;

    this.init();

    this.createElements();

    this.mainCtx = this.mainCanvas.getContext('2d');
    this.rangeCtx = this.rangeCanvas.getContext('2d');

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
    const width = this.options.width + 'px';
    const rangeCanvasHeight = Math.ceil(this.options.height / 10) + 'px';
    const rangeHeight = Math.ceil(this.options.height / 10 + 10) + 'px';

    const centerWidth = Math.ceil(this.options.width / 100 * this.options.drawPart);
    const leftWidth = this.options.width - centerWidth;

    this.root.style.width = width;
    this.root.style.height = this.options.height + 'px';

    // main chart
    this.mainCanvas = Chart.createElement(this.root,'canvas', styleClasses.mainChart);
    this.mainCanvas.setAttribute('width', width);
    this.mainCanvas.setAttribute('height', (this.options.height / 3 * 2) + 'px');

    const area = Chart.createElement(this.root, 'div', styleClasses.rangeChartArea);

    // range chart
    this.rangeCanvas = Chart.createElement(area, 'canvas', styleClasses.rangeChart);
    this.rangeCanvas.setAttribute('width', width);
    this.rangeCanvas.setAttribute('height', rangeCanvasHeight);

    this.rSelector = Chart.createElement(area, 'div', styleClasses.rangeSelector);
    this.rSelector.style.width = width;
    this.rSelector.style.height = rangeHeight;

    this.rsLeft = Chart.createElement(this.rSelector, 'div', styleClasses.rsLeft);
    this.rsLeft.style.height = rangeHeight;
    this.rsLeft.style.width = leftWidth + 'px';

    this.rsLeftBar = Chart.createElement(this.rSelector, 'div', styleClasses.rsLeftBar);
    this.rsLeftBar.style.height = rangeHeight;
    this.rsLeftBar.style.left = leftWidth + 'px';

    this.rsCenter = Chart.createElement(this.rSelector, 'div', styleClasses.rsCenter);
    this.rsCenter.style.height = rangeHeight;
    this.rsCenter.style.width = (centerWidth - this.rsLeftBar.clientWidth) + 'px';
    this.rsCenter.style.left = (leftWidth + this.rsLeftBar.clientWidth) + 'px';

    this.rsRightBar = Chart.createElement(this.rSelector, 'div', styleClasses.rsRightBar);
    this.rsRightBar.style.height = rangeHeight;
    this.rsRight = Chart.createElement(this.rSelector, 'div', styleClasses.rsRight);
    this.rsRight.style.height = rangeHeight;

    this.createCheckboxAxes();
  }

  createCheckboxAxes() {
    const boxArea = Chart.createElement(this.root, 'div', styleClasses.checkAxes);

    this.axies.forEach((axis) => {
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
        : '#fff';

      this.axies.some((a) => {
        const finded = a.id === axis.id;
        if (finded) {
          a.draw = !a.draw;
        }
        return finded;
      });
      this.drawPart(this.rangeCtx);
      this.redrawPart();
    });
  }

  init() {
    const types = this.data.types;
    const axies = [];

    Object.keys(types).forEach(key => {
      const type = types[key];
      if (type === AXES_TYPE.LINE) {
        axies.push(key);
      } else {
        this.x = key;
      }
    }, this);

    this.axies = axies.map(axis => {
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
    this.mainCanvas.addEventListener('mousemove', e => {
      // console.log(e.x, e.y);
    });

    this.rsLeftBar.addEventListener('mousedown', this.downLeftBar.bind(this));
    this.rsRightBar.addEventListener('mousedown', this.downRightBar.bind(this));
    this.rsCenter.addEventListener('mousedown', this.downRangeCenter.bind(this));
    this.rSelector.addEventListener('mousemove', this.mouseMove.bind(this));
    document.addEventListener('mouseup', this.mouseUp.bind(this));
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
      redraw: this.redrawPart.bind(this),
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

          console.log(widthRoot);

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

  maxY(start, finish) {
    let max = Number.NEGATIVE_INFINITY;

    this.axies.forEach(axis => {
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

  calcInitialPosition() {
    const all = this.time.length;
    const displayElems = Math.ceil(all / 100 * this.options.drawPart);
    const startInd = all - displayElems + 1;

    return {
      start: startInd,
      finish: all
    };
  }

  draw() {
    const pos = this.calcInitialPosition();
    this.drawPart(this.mainCtx, pos.start, pos.finish);
    this.drawPart(this.rangeCtx);
  }

  redrawPart() {
      const leftPos = this.rsLeftBar.offsetLeft;
      const rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
      const start = Math.floor(leftPos / this.options.width * this.time.length);
      const finish = Math.ceil(rightPos / this.options.width * this.time.length);
      this.drawPart(this.mainCtx, start, finish);
  }

  drawPart(ctx, start=0, finish) {
    finish = finish || this.time.length;

    const ratioX = ctx.canvas.width / (finish - start);
    const ratioY = ctx.canvas.height / this.maxY(start, finish);

    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);

    this.axies.forEach(y => {
      if (y.draw) {
        ctx.beginPath();

        ctx.moveTo(0, y.dots[start] * ratioY);

        for(let i = start + 1; i < finish; i++) {
          ctx.lineTo((this.time[i].val - start) * ratioX, y.dots[i] * ratioY);
        }

        ctx.strokeStyle = y.color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });
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

  const chart2 = new Chart(document.querySelector('#chart2'),
    data[4], {
      drawPart: 31
    });
  chart2.draw();
};