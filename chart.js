'use strict';

const AXES_TYPE = {
  LINE: 'line',
  X: 'x'
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
  constructor(root, data) {
    this.root = root;

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
         dots: dots
       };
    }, this);
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
        }, moveTimeout);
      }
    };
    this.setMoveElem(leftMove);
  }

  initTimeAxis() {
    const time = this.data.columns.find(col => {
      return col[0] === this.x;
    });

    this.time = time.map((val, ind) => {
      return {
        raw: val,
        date: new Date(val),
        val: ind
      };
    });
  }

  maxY() {
    let max = Number.NEGATIVE_INFINITY;

    this.axies.forEach(sr => {
     for(let i = 1; i < sr.dots.length; i++) {
       if (sr.dots[i] > max) {
         max = sr.dots[i];
       }
     }
    });
    return max;
  }

  draw() {
    this.drawPart(this.mainCtx);
    this.drawPart(this.rangeCtx);
  }

  drawPart(ctx) {
    const ratioX = ctx.canvas.width / (this.time.length - 1);
    const ratioY = ctx.canvas.height / this.maxY();

    ctx.transform(1, 0, 0, -1, 0, ctx.canvas.height);

    this.axies.forEach(y => {
      ctx.beginPath();

      ctx.moveTo(this.time[1].val * ratioX, y.dots[1] * ratioY);

      for(let i = 2; i < this.time.length; i++) {
        ctx.lineTo(this.time[i].val * ratioX, y.dots[i] * ratioY);
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
  const chart = new Chart(document.querySelector('#chart1'), data[0]);
  chart.draw();
};

// (function() {
//
// })();