/**
 * 数据管理器
 * 负责粒子数据的聚合、分布统计和时间序列管理
 */
class DataManager {
  constructor(model) {
    this.model = model;
    this.data = {
      particles: [],
      radialDist: [],
      angularDist: [],
      timeSeries: []
    };
    this.binConfig = {
      radial: 50,
      angular: 36,
      maxHistory: 100
    };
  }

  update() {
    this.data.particles = this.model.getParticles();
    this.updateRadialDistribution();
    this.updateAngularDistribution();
    this.updateTimeSeries();
  }

  /** 计算径向分布直方图 */
  updateRadialDistribution() {
    const bins = this.binConfig.radial;
    const maxRadius = this.model.getShockRadius();
    const hist = new Array(bins).fill(0).map(() => ({ count: 0, mass: 0 }));

    this.data.particles.forEach(p => {
      // 三维球半径
      const r = Math.sqrt(p.x**2 + p.y**2 + (p.z || 0)**2);
      const binIdx = Math.min(bins-1, Math.floor((r / maxRadius) * bins));
      hist[binIdx].count++;
      hist[binIdx].mass += p.mass;
    });

    this.data.radialDist = hist.map((h, i) => ({
      radius: (i + 0.5) * maxRadius / bins,
      count: h.count,
      density: h.mass / (Math.PI * ((i+1)**2 - i**2) * (maxRadius/bins)**2)
    }));
  }

  /** 计算角向分布 */
  updateAngularDistribution() {
    const bins = this.binConfig.angular;
    const hist = new Array(bins).fill(0);

    this.data.particles.forEach(p => {
      const angle = Math.atan2(p.y, p.x) + Math.PI;  // [0, 2π]
      const binIdx = Math.floor((angle / (2*Math.PI)) * bins);
      hist[binIdx]++;
    });

    this.data.angularDist = hist.map((count, i) => ({
      angle: (i + 0.5) * 2*Math.PI / bins,
      count: count
    }));
  }

  /** 记录时间序列 */
  updateTimeSeries() {
    const state = this.model.getState();
    this.data.timeSeries.push({
      time: state.time,
      radius: state.radius,
      velocity: state.velocity,
      temperature: state.temperature,
      particleCount: this.data.particles.length
    });

    if (this.data.timeSeries.length > this.binConfig.maxHistory) {
      this.data.timeSeries.shift();
    }
  }

  getParticles() { return this.data.particles; }
  getRadialDist() { return this.data.radialDist; }
  getAngularDist() { return this.data.angularDist; }
  getTimeSeries() { return this.data.timeSeries; }
}