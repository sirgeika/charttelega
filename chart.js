'use strict';

const AXES_TYPE = {
  LINE: 'line',
  X: 'x'
};

const defaultOptions = {
  height: 600,
  width: 600,
  initialDraw: 20
};

const moveTimeout = 50;

const noop = function() {};

const rangeSelector = 'range-selector';

const styleClasses = {
  mainChart: 'main-chart',
  rangeChart: 'range-chart',
  rangeSelector: rangeSelector,
  rangeSelectorLeft: rangeSelector + '__left',
  rangeSelectorLeftBar: rangeSelector + '__left-bar',
  rangeSelectorCenter: rangeSelector + '__center',
  rangeSelectorRight: rangeSelector + '__right',
  rangeSelectorRightBar: rangeSelector + '__right-bar'
};

class Chart {
  constructor(root, data, options) {
    this.root = root;
    this.options = Object.assign({}, defaultOptions, options);

    // this.createElements()

    this.mainCanvas = root.querySelector('.' + styleClasses.mainChart);
    this.mainCtx = this.mainCanvas.getContext('2d');

    this.rangeCanvas = root.querySelector('.' + styleClasses.rangeChart);
    this.rangeCtx = this.rangeCanvas.getContext('2d');

    this.rsLeft = root.querySelector('.' + styleClasses.rangeSelectorLeft);
    this.rsRight = root.querySelector('.' + styleClasses.rangeSelectorRight);
    this.rsLeftBar = root.querySelector('.' + styleClasses.rangeSelectorLeftBar);
    this.rsRightBar = root.querySelector('.' + styleClasses.rangeSelectorRightBar);
    this.rsCenter = root.querySelector('.' + styleClasses.rangeSelectorCenter);
    this.rSelector = root.querySelector('.' + styleClasses.rangeSelector);

    this.data = data;
    this.axies = [];
    this.time = [];
    this.moveElem = null;

    this.init();
    this.initTimeAxis();
    this.bindEvents();
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
         dots: dots.slice(1)
       };
    }, this);
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

  setMoveElem(realMove) {
    var defaultMove = {
      redraw: this.__drawPart.bind(this),
      root: this.rSelector,
      rightBar: this.rsRightBar,
      leftBar: this.rsLeftBar,
      leftElem: this.rsLeft,
      rightElem: this.rsRight,
      centerElem: this.rsCenter,
      widthBar: this.rsLeftBar.clientWidth,
      widthRoot: this.root.clientWidth,
      left: 0,
      restoreCursor: noop,
      move: noop
    };

    this.moveElem = Object.assign({}, defaultMove, realMove);
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

  maxY() {
    let max = Number.NEGATIVE_INFINITY;

    this.axies.forEach(sr => {
     for(let i = 0; i < sr.dots.length; i++) {
       if (sr.dots[i] > max) {
         max = sr.dots[i];
       }
     }
    });
    return max;
  }

  calcInitialPosition() {
    const all = this.time.length;
    const displayElems = Math.ceil(all / 100 * this.options.initialDraw);
    const startInd = all - displayElems + 1;

    return {
      start: startInd,
      finish: all
    };
  }

  draw() {
    const pos = this.calcInitialPosition();
    this.initDraw();
    this.drawPart(this.mainCtx, pos.start, pos.finish);
    this.drawPart(this.rangeCtx);
  }

  __drawPart() {
      const leftPos = this.rsLeftBar.offsetLeft;
      const rightPos = this.rsRightBar.offsetLeft + this.rsRightBar.clientWidth;
      const start = Math.floor(leftPos / this.options.width * this.time.length);
      const finish = Math.ceil(rightPos / this.options.width * this.time.length);
      this.drawPart(this.mainCtx, start, finish);
  }

  drawPart(ctx, start=0, finish) {
    finish = finish || this.time.length;

    const ratioX = ctx.canvas.width / (finish - start);
    const ratioY = ctx.canvas.height / this.maxY();

    ctx.clearRect(0,0, ctx.canvas.width, ctx.canvas.height);

    this.axies.forEach(y => {
      ctx.beginPath();

      ctx.moveTo((this.time[start].val - start) * ratioX, y.dots[start] * ratioY);

      for(let i = start; i < finish; i++) {
        ctx.lineTo((this.time[i].val - start) * ratioX, y.dots[i] * ratioY);
      }

      ctx.strokeStyle = y.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
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
    initialDraw: 33
  });
  chart.draw();
};