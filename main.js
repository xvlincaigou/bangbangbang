/**
 * 主模拟控制器
 * 协调模型、数据和可视化
 */
class SupernovaSimulation {
  constructor() {
    this.model = new SupernovaModel();
    this.dataManager = new DataManager(this.model);
    this.visualization = new Visualization('main-chart');
    
    this.isRunning = false;
    this.timeStep = 100;      // 年/帧
    this.animationSpeed = 1;
    this.frameDelay = 50;     // ms
    
    this.setupUI();
    this.update();
  }

  setupUI() {
    // 控制按钮
    document.getElementById('play-button').addEventListener('click', () => this.toggle());
    document.getElementById('reset-button').addEventListener('click', () => this.reset());
    
    // 速度滑块
    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', (e) => {
      this.animationSpeed = parseFloat(e.target.value);
      document.getElementById('speed-value').textContent = this.animationSpeed.toFixed(1) + 'x';
    });

    // 视角控制
    const azimuthSlider = document.getElementById('azimuth-slider');
    const azimuthValue = document.getElementById('azimuth-value');
    const elevationSlider = document.getElementById('elevation-slider');
    const elevationValue = document.getElementById('elevation-value');

    if (azimuthSlider && elevationSlider) {
      azimuthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.visualization.setViewAngles(val, this.visualization.elevation);
        azimuthValue.textContent = `${val.toFixed(0)}°`;
        this.update();
      });

      elevationSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.visualization.setViewAngles(this.visualization.azimuth, val);
        elevationValue.textContent = `${val.toFixed(0)}°`;
        this.update();
      });
    }

    // 视野尺度控制
    const viewSlider = document.getElementById('view-slider');
    const viewValue = document.getElementById('view-value');
    if (viewSlider) {
      viewSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.visualization.setViewRange(val);
        viewValue.textContent = `${val.toFixed(1)} pc`;
        this.update();
      });
    }
  }

  toggle() {
    this.isRunning = !this.isRunning;
    const btn = document.getElementById('play-button');
    btn.textContent = this.isRunning ? '⏸ 暂停' : '▶ 播放';
    btn.className = this.isRunning ? 'running' : '';

    if (this.isRunning) this.run();
  }

  run() {
    if (!this.isRunning) return;

    const dt = this.timeStep * this.animationSpeed;
    this.model.update(dt);
    this.dataManager.update();
    this.update();
    
    setTimeout(() => this.run(), this.frameDelay);
  }

  reset() {
    this.isRunning = false;
    document.getElementById('play-button').textContent = '▶ 播放';
    
    this.model = new SupernovaModel();
    this.dataManager = new DataManager(this.model);
    this.update();
  }

  update() {
    const particles = this.dataManager.getParticles();
    const state = this.model.getState();

    // 更新主图
    this.visualization.updateMain(particles, state.radius);

    // 更新信息面板
    document.getElementById('time-display').textContent = `时间: ${state.time.toFixed(1)} 年`;
    document.getElementById('radius-display').textContent = `冲击波半径: ${state.radius.toFixed(2)} pc`;
    document.getElementById('temp-display').textContent = `平均温度: ${state.temperature.toExponential(1)} K`;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.simulation = new SupernovaSimulation();
});