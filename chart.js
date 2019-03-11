'use strict';

const AXES_TYPE = {
  LINE: 'line',
  X: 'x'
};

const rangeSelector = 'range-selector';

const styleClasses = {
  mainChart: 'main-chart',
  rangeChart: 'range-chart',
  rangeSelector: rangeSelector,
  rangeSelectorLeft: rangeSelector + '-left',
  rangeSelectorLeftBar: rangeSelector + '-left-bar',
  rangeSelectorCenter: rangeSelector + '-center',
  rangeSelectorRight: rangeSelector + '-right',
  rangeSelectorRightBar: rangeSelector + '-right-bar'
};

class Chart {
  constructor(data, root) {
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

    this.data = data;
    this.series = [];

    this.init();
    this.initTimeAxis();
    this.bindEvents();
  }

  init() {
    const types = this.data.types;
    const series = [];

    Object.keys(types).forEach(key => {
      const type = types[key];
      if (type === AXES_TYPE.LINE) {
        series.push(key);
      } else {
        this.x = key;
      }
    }, this);

    this.series = series.map(sr => {
      const dots = this.data.columns.find(col => {
        return col[0] === sr;
      });

       return {
         id: sr,
         name: this.data.names[sr],
         color: this.data.colors[sr],
         dots: dots
       };
    }, this);
  }

  bindEvents() {
    this.mainCanvas.addEventListener('mousemove', e => {
      // console.log(e.x, e.y);
    });

    this.rsLeftBar.addEventListener('mousedown', this.moveLeftBar.bind(this));
    this.rsRightBar.addEventListener('mousedown', this.moveRightBar.bind(this));
    this.rsCenter.addEventListener('mousedown', this.moveRangeCenter.bind(this));
  }

  moveRangeCenter(e) {

  }

  moveRightBar(e) {

  }

  moveLeftBar(e) {

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

    this.series.forEach(sr => {
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

    this.series.forEach(y => {
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
  const chart = new Chart(data[0], document.querySelector('#chart1'));
  chart.draw();
};

// (function() {
//
// })();