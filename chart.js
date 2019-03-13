'use strict';

const AXES_TYPE = {
  LINE: 'line',
  X: 'x'
};

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

  downRangeCenter(e) {
    if (e.which !== 1) {
      return;
    }
    this.rsCenter.style.cursor = 'grabbing';
    this.moveElem = {
      root: this.rSelector,
      elem: this.rsCenter,
      rightBar: this.rsRightBar,
      leftBar: this.rsLeftBar,
      leftElem: this.rsLeft,
      rightElem: this.rsRight,
      x: e.pageX,
      left: this.rsCenter.offsetLeft,
      restoreCursor: function() {
        this.elem.style.cursor = 'grab';
      },
      move: function(newX) {
        const shift = this.x - newX;
        this.x = newX;
        this.left -= shift;

        const halfBar = this.rightBar.clientWidth / 2;

        this.left = this.left < -halfBar
          ? -halfBar
          : this.left = Math.min(this.left, this.root.clientWidth - this.elem.clientWidth);

        const leftRightBar = this.left + this.elem.clientWidth;
        const leftRight = leftRightBar + this.rightBar.clientWidth;

        this.elem.style.left = (this.left + this.rightBar.clientWidth) + 'px';
        this.leftElem.style.width = this.left + 'px';
        this.leftBar.style.left = this.left + 'px';

        this.rightBar.style.left = leftRightBar + 'px';
        this.rightElem.style.left = leftRight + 'px';
        this.rightElem.style.width = (Math.max(this.root.clientWidth - leftRight, 0)) + 'px';
      }
    }
  }

  downRightBar(e) {
    if (e.which !== 1) {
      return;
    }
    this.moveElem = {
      root: this.rSelector,
      elem: this.rsRightBar,
      rightElem: this.rsRight,
      centerElem: this.rsCenter,
      x: e.pageX,
      left: this.rsRightBar.offsetLeft,
      restoreCursor: noop,
      move: function(newX) {
        var self = this;
        setTimeout(function() {
          const shift = self.x - newX;
          self.x = newX;
          self.left -= shift;

          self.left = self.left < self.centerElem.offsetLeft
            ? self.centerElem.offsetLeft
            : Math.min(self.left, self.root.clientWidth - self.elem.clientWidth);

          self.elem.style.left = self.left + 'px';
          self.rightElem.style.width = (self.root.clientWidth - self.left - self.elem.clientWidth) + 'px';
          self.rightElem.style.left = (self.left + self.elem.clientWidth) + 'px';
          self.centerElem.style.width = (self.left - self.centerElem.offsetLeft) + 'px';
        }, 50);
      }
    };
  }

  downLeftBar(e) {
    if (e.which !== 1) {
      return;
    }
    this.moveElem = {
      root: this.rSelector,
      elem: this.rsLeftBar,
      leftElem: this.rsLeft,
      centerElem: this.rsCenter,
      x: e.pageX,
      left: this.rsLeftBar.offsetLeft,
      restoreCursor: noop,
      move: function(newX) {
        const shift = this.x - newX;
        this.x = newX;
        this.left -= shift;

        this.left = this.left < 0
          ? 0
          : this.left = Math.min(this.left, this.root.clientWidth - this.elem.clientWidth * 2);

        this.elem.style.left = this.left + 'px';
        this.leftElem.style.width = this.left + 'px';
        this.centerElem.style.width = (this.centerElem.clientWidth + shift) + 'px';
        this.centerElem.style.left = (this.left + this.elem.clientWidth) + 'px';
      }
    };
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