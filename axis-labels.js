'use strict';

class AxisLabels {
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

  static getAxisTickSize(min, max, range) {
    let noTicks = 0.3 * Math.sqrt(range);
    return computeTickSize(min, max, noTicks);
  }

  prepareY(min, max, ratio) {
    let prev, i = 1;
    let height = this.options.height;
    let width = this.options.width;
    let tick = AxisLabels.getAxisTickSize(min, max, height);

    let labels = [];
    labels.push({
      x: 5,
      y: 20,
      text: '0',
      move: { x: 0, y: 1 },
      line: { x: width, y: 1 }
    });

    do {
      let y = tick * i;
      let yPos = height - (y * ratio) - 10;

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
  prepare(min, max, ratio, axis) {
    return axis === 'y'
      ? this.prepareY(min, max, ratio)
      : this.prepareY(min, max, ratio);
  }

  draw(min, max, ratio, colors, axis) {
    let labels = this.prepare(min, max, ratio, axis);
    let ctx = this.options.ctx;

    ctx.beginPath();
    ctx.fillStyle = colors.axesTxt;
    ctx.font = '14px verdana, sans-serif';

    labels.forEach(lbl => {
      ctx.moveTo(lbl.move.x, lbl.move.y);
      ctx.lineTo(lbl.line.x, lbl.line.y);

      ctx.save();
      ctx.resetTransform();
      ctx.fillText(lbl.text, lbl.x, lbl.y);
      ctx.restore();
    });

    ctx.strokeStyle = colors.axes;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}