/**
 * D3可视化引擎
 * 处理所有图表渲染和动画更新
 */
class Visualization {
  constructor(containerId) {
    this.container = d3.select(`#${containerId}`);
    this.margin = { top: 40, right: 60, bottom: 40, left: 60 };

    // 视角角度（度）
    this.azimuth = 45;   // 绕z轴旋转
    this.elevation = 20; // 抬头角

    // 视野范围（pc）
    this.viewRange = 10;

    this.resize();
    this.setupScales();
    this.setupSVG();
    window.addEventListener('resize', () => {
      this.resize();
      this.updateScales();
      this.updateAxes();
    });
  }

  resize() {
    const bbox = this.container.node().getBoundingClientRect();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  setupScales() {
    // 主图比例尺（随视野范围调整），保证长宽方向比例一致，冲击波保持为圆
    const minSide = Math.min(this.width, this.height);
    const halfSpan = Math.max(10, minSide / 2 - 40); // 留一点边缘
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.xScale = d3.scaleLinear()
      .domain([-this.viewRange, this.viewRange])
      .range([cx - halfSpan, cx + halfSpan]);
    this.yScale = d3.scaleLinear()
      .domain([-this.viewRange, this.viewRange])
      .range([cy + halfSpan, cy - halfSpan]);
    
    // 元素颜色映射
    this.colorScale = d3.scaleOrdinal()
      .domain(['Fe', 'Si', 'O', 'C'])
      .range(['#e74c3c', '#f39c12', '#3498db', '#2ecc71']);
    
    // 粒子大小映射 (基于质量)
    this.sizeScale = d3.scaleSqrt().domain([1e-25, 1e-22]).range([1, 6]);
  }

  setupSVG() {
    this.svg = this.container.append('svg')
      .attr('width', this.width)
      .attr('height', this.height);

    // 创建裁剪路径
    this.svg.append('defs').append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('x', this.margin.left)
      .attr('y', this.margin.top)
      .attr('width', this.width - this.margin.left - this.margin.right)
      .attr('height', this.height - this.margin.top - this.margin.bottom);

    this.chartGroup = this.svg.append('g').attr('clip-path', 'url(#chart-clip)');
    
    // 不再绘制坐标轴，只保留图例和中心标记/冲击波作为“参照”
    this.setupLegend();
    this.setupAnnotations();
  }

  // 坐标轴不再绘制，保留接口用于将来扩展
  setupAxes() {}

  updateScales() {
    const minSide = Math.min(this.width, this.height);
    const halfSpan = Math.max(10, minSide / 2 - 40);
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.xScale
      .domain([-this.viewRange, this.viewRange])
      .range([cx - halfSpan, cx + halfSpan]);
    this.yScale
      .domain([-this.viewRange, this.viewRange])
      .range([cy + halfSpan, cy - halfSpan]);
  }

  updateAxes() {
    this.svg
      .attr('width', this.width)
      .attr('height', this.height);

    // 更新裁剪区域为居中的正方形视野
    const minSide = Math.min(this.width, this.height);
    const halfSpan = Math.max(10, minSide / 2 - 40);
    const cx = this.width / 2;
    const cy = this.height / 2;

    this.svg.select('#chart-clip rect')
      .attr('x', cx - halfSpan)
      .attr('y', cy - halfSpan)
      .attr('width', halfSpan * 2)
      .attr('height', halfSpan * 2);
  }

  setupLegend() {
    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.width - 120}, 20)`);

    const elements = ['Fe', 'Si', 'O', 'C'];
    elements.forEach((elem, i) => {
      const item = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
      
      item.append('circle')
        .attr('r', 5)
        .attr('fill', this.colorScale(elem))
        .attr('opacity', 0.8);

      item.append('text')
        .attr('x', 12)
        .attr('y', 5)
        .text(elem)
        .style('font-size', '12px')
        .attr('fill', '#ecf0f1');
    });
  }

  setupAnnotations() {
    // 这里可以放置未来的 HUD 元素，目前主视野只保留粒子与冲击波
  }

  /** 设置视角 */
  setViewAngles(azimuthDeg, elevationDeg) {
    this.azimuth = azimuthDeg;
    this.elevation = elevationDeg;
  }

  /** 设置视野范围（pc） */
  setViewRange(rangePc) {
    this.viewRange = rangePc;
    this.updateScales();
    this.updateAxes();
  }

  /** 将3D坐标投影到2D平面 */
  project3DTo2D(p) {
    const az = (this.azimuth * Math.PI) / 180;
    const el = (this.elevation * Math.PI) / 180;

    // 绕Z轴旋转（方位）
    const cosAz = Math.cos(az);
    const sinAz = Math.sin(az);
    const x1 = p.x * cosAz - p.y * sinAz;
    const y1 = p.x * sinAz + p.y * cosAz;
    const z1 = p.z;

    // 绕X轴旋转（仰角）
    const cosEl = Math.cos(el);
    const sinEl = Math.sin(el);
    const x2 = x1;
    const y2 = y1 * cosEl - z1 * sinEl;
    const z2 = y1 * sinEl + z1 * cosEl;

    // 简单透视投影（z2 越大越“远”，缩小一些）
    const perspective = 1 / (1 + z2 / (this.viewRange * 2));
    return {
      xp: x2 * perspective,
      yp: y2 * perspective
    };
  }

  /** 主图更新 */
  updateMain(particles, shockRadius) {
    // 数据绑定
    const circles = this.chartGroup.selectAll('.particle')
      .data(particles, d => d.id);

    // 退出
    circles.exit()
      .transition().duration(300)
      .attr('r', 0)
      .remove();

    // 进入
    const circlesEnter = circles.enter()
      .append('circle')
      .attr('class', 'particle')
      .attr('r', 0)
      .attr('fill', d => this.colorScale(d.element))
      .attr('opacity', 0.7);

    // 更新
    circles.merge(circlesEnter)
      .transition().duration(50).ease(d3.easeLinear)
      .attr('cx', d => {
        const { xp } = this.project3DTo2D(d);
        return this.xScale(xp);
      })
      .attr('cy', d => {
        const { yp } = this.project3DTo2D(d);
        return this.yScale(yp);
      })
      .attr('r', d => this.sizeScale(d.mass));

    // 冲击波前沿
    this.updateShockFront(shockRadius);
  }

  updateShockFront(radius) {
    const shock = this.chartGroup.selectAll('.shock-front')
      .data([radius]);

    shock.enter()
      .append('circle')
      .attr('class', 'shock-front')
      .merge(shock)
      .transition().duration(50)
      .attr('cx', this.xScale(0))
      .attr('cy', this.yScale(0))
      .attr('r', this.xScale(radius) - this.xScale(0));

    shock.exit().remove();
  }

  // 径向/角向分布图已不再展示，这里留空方法占位，避免旧调用报错
  updateRadialChart() {}
  updateAngularChart() {}
}