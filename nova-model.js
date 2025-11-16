/**
 * Sedov-Taylor超新星遗迹演化模型
 * 描述点爆炸在均匀介质中的自相似解
 */
class SupernovaModel {
  constructor(config = {}) {
    // 物理参数 (cgs单位制)
    this.energy = config.energy || 1e51;      // 爆炸能量 (erg)
    this.density = config.density || 1e-24;   // 环境密度 (g/cm³)
    this.time = 0;                             // 当前时间 (年)
    
    // 元素配置 (质量数、颜色、初始丰度)
    this.elements = config.elements || [
      { name: 'Fe', A: 56, color: '#e74c3c', massFrac: 0.15, D0: 1e18 },
      { name: 'Si', A: 28, color: '#f39c12', massFrac: 0.25, D0: 2e18 },
      { name: 'O',  A: 16, color: '#3498db', massFrac: 0.35, D0: 3e18 },
      { name: 'C',  A: 12, color: '#2ecc71', massFrac: 0.25, D0: 4e18 }
    ];
    
    this.particles = [];
    this.initializeParticles();
  }

  /** 计算冲击波半径 (pc) */
  getShockRadius() {
    const t_sec = this.time * 3.156e7;  // 年转秒
    const beta = 1.15;  // 绝热指数γ=5/3时的常数
    const factor = beta * Math.pow(this.energy / this.density, 0.2);
    const radius_cm = factor * Math.pow(t_sec, 0.4);
    return radius_cm / 3.086e18;  // 转秒差距
  }

  /** 冲击波速度 (km/s) */
  getShockVelocity() {
    const R_pc = this.getShockRadius();
    const R_cm = R_pc * 3.086e18;
    const t_sec = this.time * 3.156e7;
    return 0.4 * R_cm / t_sec / 1e5;  // cm/s 转 km/s
  }

  /** 冲击波后温度 (K) */
  getShockTemperature() {
    const v_shock = this.getShockVelocity() * 1e5;  // km/s 转 cm/s
    const mu = 0.6;  // 平均分子量
    const k_B = 1.38e-16;  // 玻尔兹曼常数
    return (3/16) * mu * (v_shock**2) / k_B;
  }

  /** 初始化粒子分布（3D球对称） */
  initializeParticles() {
    const totalParticles = 2000;
    let particleId = 0;

    this.elements.forEach(elem => {
      const nParticles = Math.floor(totalParticles * elem.massFrac);
      for (let i = 0; i < nParticles; i++) {
        // 初始位置: 中心高斯分布（无量纲r）
        const r0 = Math.abs(d3.randomNormal(0, 0.1)()) * 0.1;

        // 均匀采样球面方向
        const u = Math.random() * 2 - 1; // cos(phi)
        const phi = Math.acos(u);        // 极角 [0, π]
        const theta = Math.random() * 2 * Math.PI; // 方位角 [0, 2π]

        // 质量: 与元素质量数相关
        const mass = elem.A * 1.66e-24 * (0.5 + Math.random());  // 克

        this.particles.push({
          id: particleId++,
          element: elem.name,
          mass: mass,
          A: elem.A,
          color: elem.color,
          diffusionCoeff: elem.D0 / Math.sqrt(elem.A),
          // 自相似坐标
          xi: r0,          // 无量纲半径
          theta: theta,    // 方位角
          phi: phi,        // 极角
          // 笛卡尔坐标(实际物理单位, pc)
          x: 0,
          y: 0,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          temperature: 0,
          density: 0
        });
      }
    });
  }

  /** 速度剖面函数 (自相似解) */
  velocityProfile(xi) {
    // 标准Sedov解的无量纲速度函数
    if (xi < 0.8) {
      return 1.0 - 1.2*xi + 0.8*xi*xi;
    }
    return 0.5 * (1 - xi) / (1 - 0.8);  // 冲击波附近线性下降
  }

  /** 密度剖面函数 */
  densityProfile(xi) {
    const gamma = 5/3;
    const alpha = (gamma + 1) / (gamma - 1);
    return Math.pow(1 - xi, 1/(gamma-1)) * Math.pow(1 - xi/alpha, -1);
  }

  /** 更新物理状态（3D球对称演化） */
  update(dt) {
    this.time += dt;
    const R_shock_pc = this.getShockRadius();
    const R_shock_cm = R_shock_pc * 3.086e18;
    const v_shock_kms = this.getShockVelocity();
    const T_shock = this.getShockTemperature();

    this.particles.forEach(p => {
      // 1. 流体动力学传播（沿径向）
      const v_factor = this.velocityProfile(p.xi);
      const v_radial = v_shock_kms * 1e5 * v_factor;  // cm/s

      // 2. 扩散过程 (3D随机游走)
      const dt_sec = dt * 3.156e7;
      const diffusionDist = Math.sqrt(2 * p.diffusionCoeff * dt_sec);
      // 在球坐标中给扩散一个随机方向
      const u = Math.random() * 2 - 1;
      const diffPhi = Math.acos(u);
      const diffTheta = Math.random() * 2 * Math.PI;

      // 将扩散距离投影到径向方向的近似修正
      const radialStep = v_radial * dt_sec + diffusionDist * Math.cos(diffPhi);

      // 3. 更新自相似半径
      const dxi = radialStep / R_shock_cm;
      p.xi = Math.min(1.0, Math.max(0, p.xi + dxi));

      // 4. 小角度扰动（让壳层不是完全各向同性）
      p.theta += (Math.random() - 0.5) * 0.15;
      p.phi += (Math.random() - 0.5) * 0.15;

      // 保证角度在合理范围
      if (p.phi < 0) p.phi = -p.phi;
      if (p.phi > Math.PI) p.phi = 2 * Math.PI - p.phi;

      // 5. 转换为笛卡尔坐标（pc）
      const r_pc = p.xi * R_shock_pc;
      const sinPhi = Math.sin(p.phi);
      const cosPhi = Math.cos(p.phi);
      const cosTheta = Math.cos(p.theta);
      const sinTheta = Math.sin(p.theta);

      p.x = r_pc * sinPhi * cosTheta;
      p.y = r_pc * sinPhi * sinTheta;
      p.z = r_pc * cosPhi;

      // 6. 物理量计算
      const v_cart = v_radial; // 仅近似记录模长
      p.vx = v_cart * sinPhi * cosTheta;
      p.vy = v_cart * sinPhi * sinTheta;
      p.vz = v_cart * cosPhi;
      p.temperature = T_shock * Math.pow(1 - p.xi, 0.5);  // 简化冷却
      p.density = this.density * this.densityProfile(p.xi);
    });
  }

  getParticles() {
    return this.particles;
  }

  getState() {
    return {
      time: this.time,
      radius: this.getShockRadius(),
      velocity: this.getShockVelocity(),
      temperature: this.getShockTemperature()
    };
  }
}